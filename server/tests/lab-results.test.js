const { test } = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

test("lab results persist, validate input, and stay within their consultation", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE laboratory_requests (id INTEGER PRIMARY KEY, consultation_case_id INTEGER);
    CREATE TABLE laboratory_request_items (id INTEGER PRIMARY KEY, laboratory_request_id INTEGER,
      test_name TEXT, result TEXT, result_date TEXT, status TEXT);
    INSERT INTO laboratory_requests VALUES (1, 10), (2, 20);
    INSERT INTO laboratory_request_items VALUES (1, 1, 'CBC', NULL, NULL, 'Requested'),
      (2, 2, 'Urinalysis', NULL, NULL, 'Requested');`);
  const databaseModule = require.resolve("../database/database");
  const original = require.cache[databaseModule];
  require.cache[databaseModule] = { id: databaseModule, filename: databaseModule, loaded: true, exports: db };
  try {
    const router = require("../routes/clinic");
    const handler = router.stack.find((layer) => layer.route?.path === "/cases/:id/lab-results/:itemId").route.stack[0].handle;
    const invoke = (body, id = "10", itemId = "1", role = "doctor") => {
      const response = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
      handler({ params: { id, itemId }, body, user: { role } }, response);
      return response;
    };
    const valid = { result: "Reported findings", result_date: "2026-09-11" };
    assert.equal(invoke(valid).code, 200);
    assert.equal(db.prepare("SELECT result FROM laboratory_request_items WHERE id=1").get().result, valid.result);
    assert.equal(invoke({ ...valid, result: "Updated findings" }).body.result, "Updated findings");
    assert.equal(invoke(valid, "10", "2").code, 404);
    assert.equal(db.prepare("SELECT result FROM laboratory_request_items WHERE id=2").get().result, null);
    assert.equal(invoke({ ...valid, result: "  " }).code, 400);
    assert.equal(invoke({ ...valid, result_date: "2026-02-30" }).code, 400);
    assert.equal(invoke(valid, "invalid").code, 400);
    assert.equal(invoke(valid, "10", "1", "staff").code, 403);
    assert.equal(invoke(valid, "10", "1", "admin").code, 200);

    db.exec(`CREATE TABLE consultation_cases (id INTEGER PRIMARY KEY, patient_id INTEGER, appointment_id INTEGER, chief_complaint TEXT, lab_results TEXT);
      CREATE TABLE diagnoses (id INTEGER PRIMARY KEY, diagnosis_name TEXT UNIQUE);
      CREATE TABLE case_diagnoses (consultation_case_id INTEGER, diagnosis_id INTEGER, is_primary INTEGER);
      INSERT INTO consultation_cases VALUES (10, 1, NULL, 'Original complaint', NULL);`);
    const editHandler = router.stack.find((layer) => layer.route?.path === "/cases/:id" && layer.route.methods.patch).route.stack[0].handle;
    const edit = (body, role = "doctor") => {
      const response = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
      editHandler({ params: { id: "10" }, body, user: { role } }, response);
      return response;
    };
    assert.equal(edit({ chief_complaint: "Updated complaint", diagnoses: ["Diagnosis A", "Diagnosis A"] }).code, 200);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM consultation_cases").get().count, 1);
    assert.equal(db.prepare("SELECT chief_complaint FROM consultation_cases WHERE id=10").get().chief_complaint, "Updated complaint");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM case_diagnoses").get().count, 1);
    assert.equal(edit({ chief_complaint: "Another update", diagnoses: [] }).code, 200);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM case_diagnoses").get().count, 0);
    assert.equal(edit({ chief_complaint: "Rejected", diagnoses: "invalid" }).code, 400);
    assert.equal(edit({ chief_complaint: "Rejected" }, "staff").code, 403);
    assert.equal(edit({ lab_results: "CBC: Reported findings\nUrinalysis: Reported findings" }).code, 200);
    assert.equal(db.prepare("SELECT lab_results FROM consultation_cases WHERE id=10").get().lab_results, "CBC: Reported findings\nUrinalysis: Reported findings");
    assert.equal(edit({ lab_results: { invalid: true } }).code, 400);
    assert.equal(edit({ lab_results: "" }).code, 200);
    assert.equal(db.prepare("SELECT lab_results FROM consultation_cases WHERE id=10").get().lab_results, "");
    assert.equal(db.prepare("SELECT result FROM laboratory_request_items WHERE id=1").get().result, valid.result);
  } finally {
    if (original) require.cache[databaseModule] = original;
    else delete require.cache[databaseModule];
    delete require.cache[require.resolve("../routes/clinic")];
    db.close();
  }
});
