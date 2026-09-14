const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const { initializePregnancies, savePrenatalVisit, createPregnancy, gestation, officialEdd, riskSummary } = require("../services/pregnancies");

function fixture() {
  const filename = require.resolve("../database/database");
  const source = fs.readFileSync(filename, "utf8").replace("new Database(databasePath)", 'new Database(":memory:")')
    .replace('require("../services/pregnancies").initializePregnancies(db);', "")
    .replace(/console.log\(`Added missing column:[^;]+;/, "");
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths; mod._compile(source, filename);
  const db = mod.exports;
  db.prepare("INSERT INTO users (id,fullname,full_name,username,password,password_hash,role,is_active) VALUES (1,'Test Doctor','Test Doctor','test','unused','unused','doctor',1)").run();
  db.exec("INSERT INTO patients (id,patient_number,first_name,last_name,birth_date) VALUES (1,'P-TEST1','Test','One','1995-01-01'),(2,'P-TEST2','Test','Two','1990-01-01')");
  db.prepare("INSERT INTO service_types (id,name,default_fee,is_active) VALUES (1,'Prenatal Checkup',100,1)").run();
  for (let id = 1; id <= 6; id++) db.prepare("INSERT INTO consultation_cases (id,case_number,patient_id,consultation_date,doctor_id,service_id) VALUES (?,?,?,?,1,1)").run(id, `CASE-${id}`, id === 6 ? 2 : 1, `2026-0${id}-05`);
  return db;
}
const visit = (id, extra = {}) => ({ consultation_case_id: id, patient_id: id === 6 ? 2 : 1, doctor_id: 1, visit_date: `2026-0${id}-05`, lmp_date: "2026-01-01", gravida: 2, para: 1, service_type: "Prenatal Checkup", ...extra });
function call(router, method, path, req) {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const response = { code: 200, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
  let index = 0; const next = () => route.stack[index++]?.handle({ path, method: method.toUpperCase(), user: { id: 1, role: "doctor" }, params: {}, query: {}, body: {}, ...req }, response, next);
  next(); return response;
}

test("migration groups identical LMPs, preserves unknown dates and is idempotent", () => {
  const db = fixture();
  try {
    db.exec(`INSERT INTO prenatal_records (patient_id,consultation_case_id,visit_date,lmp_date,estimated_delivery_date) VALUES
      (1,1,'2026-01-05','2026-01-01','2026-10-08'),(1,2,'2026-02-05','2026-01-01','2026-10-08'),
      (1,3,'2026-03-05',NULL,NULL),(2,6,'2026-06-05','2026-01-01','2026-10-08')`);
    initializePregnancies(db); initializePregnancies(db);
    const rows = db.prepare("SELECT pregnancy_id FROM prenatal_records ORDER BY id").all();
    assert.equal(rows[0].pregnancy_id, rows[1].pregnancy_id);
    assert.notEqual(rows[0].pregnancy_id, rows[2].pregnancy_id);
    assert.notEqual(rows[0].pregnancy_id, rows[3].pregnancy_id);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM pregnancy_records").get().n, 3);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM pregnancy_records WHERE status='Needs review'").get().n, 3);
    assert.throws(() => savePrenatalVisit(db, visit(4)), /Review/);
  } finally { db.close(); }
});

test("visits compile under one pregnancy; repeat save is idempotent; later pregnancy stays separate", () => {
  const db = fixture(); initializePregnancies(db);
  try {
    const first = savePrenatalVisit(db, visit(1));
    const second = savePrenatalVisit(db, visit(2));
    assert.equal(first.pregnancy_id, second.pregnancy_id);
    assert.equal(savePrenatalVisit(db, visit(2)).id, second.id);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM prenatal_records").get().n, 2);
    assert.throws(() => savePrenatalVisit(db, visit(6, { pregnancy_id: first.pregnancy_id })), /another patient/);
    assert.throws(() => savePrenatalVisit(db, visit(3, { lmp_date: "2026-02-01" })), /LMP differs/);
    db.prepare("UPDATE pregnancy_records SET status='Delivered',actual_delivery_date='2026-10-01' WHERE id=?").run(first.pregnancy_id);
    assert.throws(() => savePrenatalVisit(db, visit(3, { pregnancy_id: first.pregnancy_id })), /closed/);
    const later = createPregnancy(db, 1, { lmp_date: "2027-01-01", doctor_id: 1 });
    const third = savePrenatalVisit(db, visit(3, { pregnancy_id: later.id, lmp_date: "2027-01-01", visit_date: "2027-03-05" }));
    assert.equal(third.pregnancy_id, later.id);
    assert.notEqual(later.id, first.pregnancy_id);
    assert.throws(() => createPregnancy(db, 1), /already has/);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM prenatal_records WHERE pregnancy_id=?").get(first.pregnancy_id).n, 2);
  } finally { db.close(); }
});

test("EDD selection, chronological history, delivery closure and risk review are validated", () => {
  const db = fixture(); initializePregnancies(db);
  try {
    const one = savePrenatalVisit(db, visit(2, { blood_pressure: "145/95" }));
    savePrenatalVisit(db, visit(1, { blood_pressure: "140/90" }));
    const router = require("../routes/pregnancies")(db);
    const params = { id: String(one.pregnancy_id) };
    assert.equal(call(router, "patch", "/pregnancies/:id", { params, body: { edd_source: "Ultrasound" } }).code, 400);
    assert.equal(call(router, "patch", "/pregnancies/:id", { params, body: { edd_source: "Ultrasound", ultrasound_edd: "2026-10-15" } }).code, 200);
    assert.equal(call(router, "patch", "/pregnancies/:id", { params, body: { lmp_date: "2026-02-30" } }).code, 400);
    assert.equal(call(router, "patch", "/pregnancies/:id", { params, body: { risk_level: "High Risk", risk_reasons: "Clinician reviewed" } }).code, 200);
    let detail = call(router, "get", "/pregnancies/:id", { params }).body;
    assert.deepEqual(detail.visits.map((v) => v.consultation_case_id), [1, 2]);
    assert.equal(detail.official_edd, "2026-10-15");
    assert.equal(detail.lmp_edd, "2026-10-08");
    assert.equal(detail.risk_needs_review, false);
    assert.match(detail.suggested_risk.reasons[0].reason, /multiple visits/);
    db.prepare("UPDATE consultation_cases SET lab_results='Updated lab findings' WHERE id=1").run();
    detail = call(router, "get", "/pregnancies/:id", { params }).body;
    assert.equal(detail.risk_needs_review, true);
    assert.equal(detail.visits[0].lab_results, "Updated lab findings");
    assert.equal(call(router, "patch", "/pregnancies/:id", { params, body: { status: "Delivered" } }).code, 400);
    assert.equal(call(router, "patch", "/pregnancies/:id", { params, body: { status: "Delivered", actual_delivery_date: "2026-08-01", delivery_mode: "Cesarean", birth_weight_kg: 2.8 } }).code, 200);
    detail = call(router, "get", "/pregnancies/:id", { params }).body;
    assert.equal(detail.status, "Delivered");
    assert.ok(detail.delivery_ga);
    assert.equal(detail.visit_count, 2);
    assert.equal(call(router, "get", "/pregnancies/:id", { params, user: { id: 1, role: "staff" } }).code, 403);
  } finally { db.close(); }
});

test("dating and risk summaries are deterministic and keep missing measurements unknown", () => {
  assert.equal(officialEdd({ lmp_date: "2026-01-01", edd_source: "LMP" }), "2026-10-08");
  assert.deepEqual(gestation("2026-10-08", "2026-02-05"), { weeks: 5, days: 0 });
  assert.equal(gestation(null, "2026-02-05"), null);
  const risk = riskSummary([{ visit_date: "2026-02-05", risk_level: "High Risk", risk_reasons: '["Bleeding documented"]' }]);
  assert.equal(risk.level, "High Risk");
  assert.ok(risk.reasons.some((entry) => entry.reason === "Bleeding documented"));
});

test("creating a prenatal consultation atomically saves its visit and refuses a closed pregnancy without orphan cases", () => {
  const db = fixture(); initializePregnancies(db);
  const databaseModule = require.resolve("../database/database");
  const original = require.cache[databaseModule];
  require.cache[databaseModule] = { id: databaseModule, filename: databaseModule, loaded: true, exports: db };
  try {
    const router = require("../routes/clinic");
    const body = { patient_id: 1, doctor_id: 1, consultation_date: "2026-07-01T10:00", service_id: 1, lmp_date: "2026-01-01", diagnoses: ["Recorded assessment"], chief_complaint: "Review", gravida: 2, para: 1 };
    const result = call(router, "post", "/cases", { body });
    assert.equal(result.code, 201);
    assert.ok(result.body.pregnancy_id);
    assert.ok(db.prepare("SELECT id FROM prenatal_records WHERE consultation_case_id=? AND pregnancy_id=?").get(result.body.id, result.body.pregnancy_id));
    const count = db.prepare("SELECT COUNT(*) n FROM consultation_cases").get().n;
    const pregnancyRouter = require("../routes/pregnancies")(db);
    call(pregnancyRouter, "patch", "/pregnancies/:id", { params: { id: String(result.body.pregnancy_id) }, body: { status: "Completed" } });
    const oldError = console.error; console.error = () => {};
    let rejected;
    try { rejected = call(router, "post", "/cases", { body: { ...body, pregnancy_id: result.body.pregnancy_id } }); }
    finally { console.error = oldError; }
    assert.equal(rejected.code, 409);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM consultation_cases").get().n, count);
  } finally {
    if (original) require.cache[databaseModule] = original; else delete require.cache[databaseModule];
    delete require.cache[require.resolve("../routes/clinic")];
    db.close();
  }
});
