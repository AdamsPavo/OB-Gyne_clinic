const DAY = 86400000;
const dateOnly = (value) => typeof value === "string" ? value.slice(0, 10) : "";
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (value, days) => validDate(value) ? new Date(Date.parse(value) + days * DAY).toISOString().slice(0, 10) : null;
const officialEdd = (record) => record.edd_source === "Ultrasound" ? record.ultrasound_edd : record.edd_source === "Manual" ? record.manual_edd : addDays(record.lmp_date, 280);
const gestation = (edd, date) => {
  if (!validDate(edd) || !validDate(dateOnly(date))) return null;
  const days = 280 + Math.round((Date.parse(dateOnly(date)) - Date.parse(edd)) / DAY);
  return days < 0 ? null : { weeks: Math.floor(days / 7), days: days % 7 };
};
const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };

function initializePregnancies(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS pregnancy_records (
    id INTEGER PRIMARY KEY, pregnancy_number TEXT UNIQUE, patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Delivered','Completed','Closed','Needs review')),
    lmp_date TEXT, ultrasound_edd TEXT, manual_edd TEXT, edd_source TEXT NOT NULL DEFAULT 'LMP',
    gravida INTEGER, para INTEGER, abortion_count INTEGER, living_children INTEGER, doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    maternal_history TEXT, risk_level TEXT, risk_reasons TEXT, risk_reviewed_at TEXT, risk_reviewed_by INTEGER,
    actual_delivery_date TEXT, delivery_location TEXT, delivery_mode TEXT, delivery_complications TEXT,
    baby_sex TEXT, birth_weight_kg REAL, birth_outcome TEXT, apgar TEXT, maternal_outcome TEXT, delivery_notes TEXT,
    closed_date TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_pregnancy_per_patient ON pregnancy_records(patient_id) WHERE status='Active';
    CREATE INDEX IF NOT EXISTS pregnancy_patient ON pregnancy_records(patient_id);`);
  for (const column of ["pregnancy_id INTEGER REFERENCES pregnancy_records(id)", "official_edd TEXT", "edd_source TEXT", "risk_reasons TEXT"]) {
    if (!db.prepare("PRAGMA table_info(prenatal_records)").all().some((entry) => entry.name === column.split(" ")[0])) db.exec(`ALTER TABLE prenatal_records ADD COLUMN ${column}`);
  }
  db.exec("CREATE INDEX IF NOT EXISTS prenatal_pregnancy_visits ON prenatal_records(pregnancy_id,visit_date)");
  db.exec(`CREATE TRIGGER IF NOT EXISTS pregnancy_review_after_lab_results AFTER UPDATE OF lab_results ON consultation_cases
    BEGIN UPDATE pregnancy_records SET risk_reviewed_at=NULL,updated_at=CURRENT_TIMESTAMP
      WHERE id IN (SELECT pregnancy_id FROM prenatal_records WHERE consultation_case_id=NEW.id); END;`);
  // Only identical documented LMPs identify a historical group automatically.
  // Unknown pregnancy boundaries remain separate and require clinician review.
  db.transaction(() => {
    const visits = db.prepare("SELECT * FROM prenatal_records WHERE pregnancy_id IS NULL ORDER BY visit_date,id").all();
    const groups = new Map();
    for (const visit of visits) {
      const lmp = validDate(visit.lmp_date) ? visit.lmp_date : null;
      const key = `${visit.patient_id}:${lmp || `unknown-${visit.id}`}`;
      let pregnancyId = groups.get(key);
      if (!pregnancyId) {
        const result = db.prepare(`INSERT INTO pregnancy_records (patient_id,status,lmp_date,manual_edd,edd_source,gravida,para,abortion_count,living_children,doctor_id)
          VALUES (?,'Needs review',?,?,?,?,?,?,?,?)`).run(visit.patient_id, lmp, visit.estimated_delivery_date || null,
          lmp ? "LMP" : validDate(visit.estimated_delivery_date) ? "Manual" : "LMP", visit.gravida, visit.para, visit.abortion_count, visit.living_children, visit.doctor_id);
        pregnancyId = Number(result.lastInsertRowid);
        db.prepare("UPDATE pregnancy_records SET pregnancy_number=? WHERE id=?").run(`PG-${String(pregnancyId).padStart(6, "0")}`, pregnancyId);
        groups.set(key, pregnancyId);
      }
      db.prepare("UPDATE prenatal_records SET pregnancy_id=?,official_edd=estimated_delivery_date,edd_source=? WHERE id=?").run(pregnancyId, lmp ? "LMP" : "Manual", visit.id);
    }
  })();
}

function currentPregnancy(db, patientId) {
  return db.prepare("SELECT * FROM pregnancy_records WHERE patient_id=? AND status='Active'").get(patientId) || null;
}

function createPregnancy(db, patientId, values = {}) {
  if (!db.prepare("SELECT id FROM patients WHERE id=? AND is_archived=0").get(patientId)) fail("Select an active patient.");
  if (currentPregnancy(db, patientId)) fail("This patient already has an active pregnancy. Close it before starting another.", 409);
  const lmp = values.lmp_date || null;
  if (lmp && !validDate(lmp)) fail("Enter a valid LMP date.");
  const result = db.prepare(`INSERT INTO pregnancy_records (patient_id,lmp_date,gravida,para,abortion_count,living_children,doctor_id,maternal_history)
    VALUES (?,?,?,?,?,?,?,?)`).run(patientId, lmp, values.gravida ?? null, values.para ?? null, values.abortion_count ?? null,
    values.living_children ?? null, values.doctor_id || null, values.maternal_history || null);
  const id = Number(result.lastInsertRowid);
  db.prepare("UPDATE pregnancy_records SET pregnancy_number=? WHERE id=?").run(`PG-${String(id).padStart(6, "0")}`, id);
  return db.prepare("SELECT * FROM pregnancy_records WHERE id=?").get(id);
}

const visitFields = ["patient_id","consultation_case_id","appointment_id","doctor_id","visit_date","service_type","lmp_date","estimated_delivery_date",
  "gestational_weeks","gestational_days","gravida","para","abortion_count","living_children","number_of_fetuses","blood_pressure","temperature_c","weight_kg","height_cm",
  "fundal_height_cm","fetal_heart_rate","fetal_movement","fetal_presentation","edema","risk_level","risk_reasons","assessment","treatment","notes","next_visit_date","pregnancy_id","official_edd","edd_source"];

function savePrenatalVisit(db, values, editId) {
  return db.transaction(() => {
    const linkedCase = db.prepare("SELECT * FROM consultation_cases WHERE id=? AND patient_id=?").get(values.consultation_case_id, values.patient_id);
    if (!linkedCase) fail("The consultation does not belong to this patient.");
    if (!validDate(dateOnly(values.visit_date))) fail("Enter a valid visit date.");
    const existing = editId ? db.prepare("SELECT * FROM prenatal_records WHERE id=?").get(editId)
      : db.prepare("SELECT * FROM prenatal_records WHERE consultation_case_id=? ORDER BY id LIMIT 1").get(linkedCase.id);
    if (editId && !existing) fail("Prenatal visit not found.", 404);
    if (existing && (existing.patient_id !== linkedCase.patient_id || existing.consultation_case_id !== linkedCase.id)) fail("The visit belongs to another consultation.");
    let pregnancy = existing?.pregnancy_id ? db.prepare("SELECT * FROM pregnancy_records WHERE id=?").get(existing.pregnancy_id)
      : values.pregnancy_id ? db.prepare("SELECT * FROM pregnancy_records WHERE id=?").get(values.pregnancy_id) : currentPregnancy(db, linkedCase.patient_id);
    if (values.pregnancy_id && (!pregnancy || Number(values.pregnancy_id) !== pregnancy.id)) fail("Pregnancy does not match this visit.");
    if (!pregnancy) {
      if (db.prepare("SELECT id FROM pregnancy_records WHERE patient_id=? AND status='Needs review'").get(linkedCase.patient_id)) fail("Review the patient's historical pregnancies in Prenatal Records and activate the current pregnancy, or start a new pregnancy.", 409);
      pregnancy = createPregnancy(db, linkedCase.patient_id, values);
    }
    if (pregnancy.patient_id !== linkedCase.patient_id) fail("Pregnancy belongs to another patient.");
    if (!existing && pregnancy.status !== "Active") fail("This pregnancy is closed or awaiting review. New visits must use an active pregnancy.", 409);
    if (!existing && values.lmp_date && pregnancy.lmp_date && values.lmp_date !== pregnancy.lmp_date) fail("LMP differs from the current pregnancy. Correct the pregnancy summary or start a new pregnancy before saving.", 409);
    if (!pregnancy.lmp_date && values.lmp_date) {
      if (!validDate(values.lmp_date)) fail("Enter a valid LMP date.");
      db.prepare("UPDATE pregnancy_records SET lmp_date=? WHERE id=?").run(values.lmp_date, pregnancy.id);
      pregnancy.lmp_date = values.lmp_date;
    }
    const edd = officialEdd(pregnancy);
    const ga = gestation(edd, values.visit_date);
    const body = { ...(existing || {}), ...values, pregnancy_id: pregnancy.id, lmp_date: pregnancy.lmp_date,
      estimated_delivery_date: edd, official_edd: edd, edd_source: pregnancy.edd_source,
      gestational_weeks: ga?.weeks ?? null, gestational_days: ga?.days ?? null };
    if (Array.isArray(body.risk_reasons)) body.risk_reasons = JSON.stringify(body.risk_reasons);
    const fields = visitFields.filter((key) => body[key] !== undefined);
    const params = fields.map((key) => body[key] === "" ? null : body[key]);
    let id = existing?.id;
    if (existing) db.prepare(`UPDATE prenatal_records SET ${fields.map((key) => `${key}=?`).join(",")} WHERE id=?`).run(...params, id);
    else id = Number(db.prepare(`INSERT INTO prenatal_records (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`).run(...params).lastInsertRowid);
    db.prepare("UPDATE pregnancy_records SET risk_reviewed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(pregnancy.id);
    const latest = db.prepare("SELECT id FROM prenatal_records WHERE pregnancy_id=? ORDER BY datetime(visit_date) DESC,id DESC LIMIT 1").get(pregnancy.id);
    if (latest.id === id) db.prepare(`UPDATE pregnancy_records SET gravida=COALESCE(?,gravida),para=COALESCE(?,para),
      abortion_count=COALESCE(?,abortion_count),living_children=COALESCE(?,living_children),doctor_id=COALESCE(?,doctor_id) WHERE id=?`)
      .run(body.gravida ?? null, body.para ?? null, body.abortion_count ?? null, body.living_children ?? null, body.doctor_id || null, pregnancy.id);
    return { id, pregnancy_id: pregnancy.id, pregnancy_number: pregnancy.pregnancy_number };
  })();
}

const parseReasons = (value) => { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return value ? String(value).split(/\n|\|/).filter(Boolean) : []; } };
function riskSummary(visits) {
  const reasons = []; let level = "Low Risk";
  const elevated = visits.filter((visit) => { const match = String(visit.blood_pressure || "").match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/); return match && (+match[1] >= 140 || +match[2] >= 90); });
  if (elevated.length) { level = "Needs Monitoring"; reasons.push({ reason: elevated.length > 1 ? "Elevated blood pressure recorded at multiple visits" : "Elevated blood pressure recorded", visits: elevated.map((v) => v.visit_date) }); }
  const severe = elevated.filter((visit) => { const [systolic, diastolic] = visit.blood_pressure.split("/").map(Number); return systolic >= 160 || diastolic >= 110; });
  if (severe.length) { level = "High Risk"; reasons.push({ reason: "Severely elevated blood pressure recorded; requires clinical review", visits: severe.map((v) => v.visit_date) }); }
  for (const visit of visits) {
    const flags = parseReasons(visit.risk_reasons);
    if (/high/i.test(visit.risk_level)) { level = "High Risk"; flags.push("High risk recorded at this visit"); }
    else if (/moderate|monitor/i.test(visit.risk_level) && level !== "High Risk") { level = "Needs Monitoring"; flags.push("Monitoring indicated at this visit"); }
    if (Number(visit.number_of_fetuses) > 1) { flags.push("Multiple pregnancy recorded"); if (level === "Low Risk") level = "Needs Monitoring"; }
    for (const reason of new Set(flags)) reasons.push({ reason, visits: [visit.visit_date] });
  }
  if (reasons.length && level === "Low Risk") level = "Needs Monitoring";
  return { level, reasons, source: "https://www.nice.org.uk/guidance/ng201/chapter/recommendations" };
}

module.exports = { initializePregnancies, currentPregnancy, createPregnancy, savePrenatalVisit, officialEdd, gestation, addDays, validDate, dateOnly, today, riskSummary, fail };
