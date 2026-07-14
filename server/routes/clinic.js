const express = require("express");
const db = require("../database/database");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const nextNumber = (prefix, table, column) => {
  const latest = db.prepare(`SELECT ${column} AS value FROM ${table} ORDER BY id DESC LIMIT 1`).get();
  const value = latest?.value?.match(/(\d+)$/)?.[1] || "0";
  return `${prefix}-${String(Number(value) + 1).padStart(6, "0")}`;
};

router.get("/dashboard", (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const totalPatients = db
      .prepare("SELECT COUNT(*) AS count FROM patients WHERE is_archived = 0")
      .get().count;

    const consultationsToday = db
      .prepare(
        "SELECT COUNT(*) AS count FROM consultation_cases WHERE consultation_date LIKE ?"
      )
      .get(`${today}%`).count;

    const pendingLabs = db
      .prepare(
        "SELECT COUNT(*) AS count FROM laboratory_requests WHERE status IN ('Requested','Pending')"
      )
      .get().count;

    const incomeToday = db
      .prepare(
        `SELECT COALESCE(SUM(paid_amount),0) AS income
         FROM invoices
         WHERE invoice_date LIKE ?`
      )
      .get(`${today}%`).income;

    const recentPatients = db
      .prepare(`
        SELECT
          id,
          patient_number,
          first_name,
          last_name,
          contact_number
        FROM patients
        WHERE is_archived = 0
        ORDER BY created_at DESC
        LIMIT 5
      `)
      .all();

    const followUps = db
      .prepare(`
        SELECT
          c.case_number,
          c.follow_up_date,
          p.first_name,
          p.last_name
        FROM consultation_cases c
        JOIN patients p
          ON p.id = c.patient_id
        WHERE c.follow_up_date >= ?
        ORDER BY c.follow_up_date
        LIMIT 5
      `)
      .all(today);

    res.json({
      totalPatients,
      consultationsToday,
      pendingLabs,
      incomeToday,
      recentPatients,
      followUps,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
  }
});

router.get("/patients", (req, res) => {
  const search = `%${(req.query.search || "").trim()}%`;
  const archived = req.query.archived === "true" ? 1 : 0;
  const rows = db.prepare(`SELECT p.*, (SELECT MAX(consultation_date) FROM consultation_cases c WHERE c.patient_id=p.id) AS last_visit
    FROM patients p WHERE p.is_archived = ? AND (p.first_name || ' ' || p.last_name LIKE ? OR p.patient_number LIKE ? OR p.contact_number LIKE ?)
    ORDER BY p.last_name, p.first_name`).all(archived, search, search, search);
  res.json(rows);
});

router.get("/patients/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ message: "Patient not found." });
  res.json(row);
});

router.post("/patients", (req, res) => {
  const { first_name, last_name, ...details } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ message: "First and last name are required." });
  const patient_number = nextNumber("P", "patients", "patient_number");
  const fields = ["patient_number", "first_name", "last_name", ...Object.keys(details).filter(k => !["id", "patient_number"].includes(k))];
  const values = [patient_number, first_name.trim(), last_name.trim(), ...Object.keys(details).filter(k => !["id", "patient_number"].includes(k)).map(k => details[k] || null)];
  const result = db.prepare(`INSERT INTO patients (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`).run(...values);
  res.status(201).json({ id: result.lastInsertRowid, patient_number });
});

router.patch("/patients/:id/archive", (req, res) => {
  const result = db.prepare("UPDATE patients SET is_archived = 1 WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Patient not found." });
  res.json({ message: "Patient archived." });
});

router.get("/patients/:id/cases", (req, res) => {
  res.json(db.prepare("SELECT * FROM consultation_cases WHERE patient_id = ? ORDER BY consultation_date DESC").all(req.params.id));
});

router.post("/cases", (req, res) => {
  const { patient_id, doctor_id, consultation_date, diagnoses = [], ...caseData } = req.body;
  if (!patient_id || !consultation_date) return res.status(400).json({ message: "Patient and consultation date are required." });
  const patient = db.prepare("SELECT id FROM patients WHERE id = ? AND is_archived = 0").get(patient_id);
  if (!patient) return res.status(400).json({ message: "Select an active patient." });
  const create = db.transaction(() => {
    const case_number = nextNumber("CASE", "consultation_cases", "case_number");
    const fields = ["case_number", "patient_id", "doctor_id", "consultation_date", ...Object.keys(caseData)];
    const values = [case_number, patient_id, doctor_id || null, consultation_date, ...Object.values(caseData)];
    const result = db.prepare(`INSERT INTO consultation_cases (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`).run(...values);
    const addDiagnosis = db.prepare("INSERT OR IGNORE INTO diagnoses (diagnosis_name) VALUES (?)");
    const linkDiagnosis = db.prepare("INSERT INTO case_diagnoses (consultation_case_id, diagnosis_id, is_primary) VALUES (?, ?, ?)");
    diagnoses.filter(Boolean).forEach((name, index) => { addDiagnosis.run(name); linkDiagnosis.run(result.lastInsertRowid, db.prepare("SELECT id FROM diagnoses WHERE diagnosis_name=?").get(name).id, index === 0 ? 1 : 0); });
    db.prepare("INSERT INTO invoices (invoice_number, patient_id, consultation_case_id, invoice_date, payment_status) VALUES (?, ?, ?, ?, 'Pending')").run(`OR-${case_number.replace("CASE-", "")}`, patient_id, result.lastInsertRowid, consultation_date);
    return { id: result.lastInsertRowid, case_number };
  });
  res.status(201).json(create());
});

router.get("/cases/:id", (req, res) => {
  const record = db.prepare(`SELECT c.*, p.patient_number, p.first_name, p.last_name, p.birth_date, p.address, p.contact_number,
    COALESCE(u.fullname, (SELECT doctor_name FROM settings WHERE id=1), 'Attending Physician') AS doctor_name,
    COALESCE((SELECT clinic_name FROM settings WHERE id=1), 'OB-GYN Clinic') AS clinic_name,
    COALESCE((SELECT clinic_address FROM settings WHERE id=1), '') AS clinic_address
    FROM consultation_cases c JOIN patients p ON p.id=c.patient_id LEFT JOIN users u ON u.id=c.doctor_id WHERE c.id=?`).get(req.params.id);
  if (!record) return res.status(404).json({ message: "Case not found." });
  record.diagnoses = db.prepare("SELECT d.* FROM diagnoses d JOIN case_diagnoses cd ON cd.diagnosis_id=d.id WHERE cd.consultation_case_id=?").all(record.id);
  const prescriptionItems = db.prepare("SELECT * FROM prescription_items WHERE prescription_id=?");
  record.prescriptions = db.prepare(`SELECT pr.*, c.case_number FROM prescriptions pr JOIN consultation_cases c ON c.id=pr.consultation_case_id WHERE pr.consultation_case_id=? ORDER BY pr.id DESC`).all(record.id).map((item) => ({ ...item, items: prescriptionItems.all(item.id) }));
  const labItems = db.prepare("SELECT * FROM laboratory_request_items WHERE laboratory_request_id=?");
  record.laboratory_requests = db.prepare(`SELECT lr.*, c.case_number FROM laboratory_requests lr JOIN consultation_cases c ON c.id=lr.consultation_case_id WHERE lr.consultation_case_id=? ORDER BY lr.id DESC`).all(record.id).map((item) => ({ ...item, items: labItems.all(item.id) }));
  record.invoice = db.prepare("SELECT * FROM invoices WHERE consultation_case_id=?").get(record.id);
  res.json(record);
});

router.patch("/cases/:id", (req, res) => {
  const allowed = ["chief_complaint", "history_present_illness", "blood_pressure", "temperature_c", "weight_kg", "height_cm", "treatment", "doctor_notes", "follow_up_date", "case_status"];
  const fields = Object.keys(req.body).filter((field) => allowed.includes(field));
  if (!fields.length) return res.status(400).json({ message: "No valid case fields supplied." });
  const result = db.prepare(`UPDATE consultation_cases SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`).run(...fields.map((field) => req.body[field] || null), req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Case not found." });
  res.json({ message: "Case updated." });
});

router.post("/billings/:caseId/payments", (req, res) => {
  const { amount, payment_method = "Cash" } = req.body;
  if (!Number(amount) || Number(amount) <= 0) return res.status(400).json({ message: "Enter a valid payment amount." });
  const invoice = db.prepare("SELECT * FROM invoices WHERE consultation_case_id = ?").get(req.params.caseId);
  if (!invoice) return res.status(404).json({ message: "Billing transaction not found." });
  const add = db.transaction(() => {
    db.prepare("INSERT INTO payments (invoice_id, payment_date, amount, payment_method) VALUES (?, datetime('now'), ?, ?)").run(invoice.id, amount, payment_method);
    const paid = Number(invoice.paid_amount) + Number(amount);
    const total = Number(invoice.total_amount);
    const status = total > 0 && paid >= total ? "Paid" : "Partial";
    db.prepare("UPDATE invoices SET paid_amount=?, payment_status=? WHERE id=?").run(paid, status, invoice.id);
  });
  add(); res.status(201).json({ message: "Payment recorded." });
});

router.get("/reports/summary", (req, res) => {
  const cases = db.prepare("SELECT substr(consultation_date,1,10) AS date, COUNT(*) AS consultations FROM consultation_cases GROUP BY substr(consultation_date,1,10) ORDER BY date DESC LIMIT 31").all();
  const income = db.prepare("SELECT substr(invoice_date,1,7) AS month, COALESCE(SUM(paid_amount),0) AS income FROM invoices GROUP BY substr(invoice_date,1,7) ORDER BY month DESC LIMIT 12").all();
  const diagnoses = db.prepare("SELECT d.diagnosis_name, COUNT(*) AS count FROM case_diagnoses cd JOIN diagnoses d ON d.id=cd.diagnosis_id GROUP BY d.id ORDER BY count DESC LIMIT 10").all();
  res.json({ cases, income, diagnoses });
});

const backupDir = path.join(__dirname, "..", "storage", "backups");
router.get("/backups", (req, res) => {
  if (!fs.existsSync(backupDir)) return res.json([]);
  res.json(fs.readdirSync(backupDir).filter((name) => name.endsWith(".db")).map((name) => ({ name, createdAt: fs.statSync(path.join(backupDir, name)).mtime, size: fs.statSync(path.join(backupDir, name)).size })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});
router.post("/backups", (req, res) => {
  fs.mkdirSync(backupDir, { recursive: true });
  const name = `obgyn-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
  db.pragma("wal_checkpoint(FULL)");
  fs.copyFileSync(path.join(__dirname, "..", "obgyn.db"), path.join(backupDir, name));
  res.status(201).json({ name, message: "Backup created." });
});

const resources = {
  appointments: { table: "appointments", required: ["patient_id", "appointment_date", "service"] },
  consultations: { table: "consultations", required: ["patient_id", "consultation_date"] },
  "prenatal-records": { table: "prenatal_records", required: ["patient_id", "visit_date"] },
  invoices: { table: "invoices", required: ["invoice_number", "patient_id", "invoice_date"] },
  payments: { table: "payments", required: ["invoice_id", "payment_date", "amount"] },
  "report-exports": { table: "report_exports", required: ["report_name"] },
  backups: { table: "backup_records", required: ["backup_name"] },
};

router.get("/billings", (req, res) => {
  const rows = db.prepare(`SELECT i.*, c.case_number, p.first_name || ' ' || p.last_name AS patient_name
    FROM invoices i
    LEFT JOIN consultation_cases c ON c.id=i.consultation_case_id
    JOIN patients p ON p.id=i.patient_id
    ORDER BY i.id DESC`).all();
  res.json(rows);
});

function assertFields(body, required) {
  return required.find((field) => body[field] === undefined || body[field] === null || body[field] === "");
}

Object.entries(resources).forEach(([path, resource]) => {
  router.get(`/${path}`, (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${resource.table} ORDER BY id DESC`).all();
    res.json(rows);
  });

  router.get(`/${path}/:id`, (req, res) => {
    const row = db.prepare(`SELECT * FROM ${resource.table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ message: "Record not found." });
    res.json(row);
  });

  router.post(`/${path}`, (req, res) => {
    const missing = assertFields(req.body, resource.required);
    if (missing) return res.status(400).json({ message: `${missing} is required.` });
    const fields = Object.keys(req.body);
    const values = fields.map((field) => req.body[field]);
    const result = db.prepare(`INSERT INTO ${resource.table} (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`).run(...values);
    res.status(201).json({ id: result.lastInsertRowid, message: "Record created." });
  });

  router.put(`/${path}/:id`, (req, res) => {
    const fields = Object.keys(req.body);
    if (!fields.length) return res.status(400).json({ message: "No fields to update." });
    const result = db.prepare(`UPDATE ${resource.table} SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`).run(...fields.map((field) => req.body[field]), req.params.id);
    if (!result.changes) return res.status(404).json({ message: "Record not found." });
    res.json({ message: "Record updated." });
  });

  router.delete(`/${path}/:id`, (req, res) => {
    const result = db.prepare(`DELETE FROM ${resource.table} WHERE id = ?`).run(req.params.id);
    if (!result.changes) return res.status(404).json({ message: "Record not found." });
    res.status(204).end();
  });
});

router.get("/prescriptions", (req, res) => {
  const records = req.query.patient_id
    ? db.prepare(`SELECT p.*, pt.first_name || ' ' || pt.last_name AS patient_name, c.case_number FROM prescriptions p JOIN patients pt ON pt.id = p.patient_id LEFT JOIN consultation_cases c ON c.id=p.consultation_case_id WHERE p.patient_id = ? ORDER BY p.id DESC`).all(req.query.patient_id)
    : db.prepare(`SELECT p.*, pt.first_name || ' ' || pt.last_name AS patient_name, c.case_number FROM prescriptions p JOIN patients pt ON pt.id = p.patient_id LEFT JOIN consultation_cases c ON c.id=p.consultation_case_id ORDER BY p.id DESC`).all();
  const items = db.prepare("SELECT * FROM prescription_items WHERE prescription_id = ?");
  res.json(records.map((record) => ({ ...record, items: items.all(record.id) })));
});

router.post("/prescriptions", (req, res) => {
  const { prescription_number, patient_id, issued_date, diagnosis, consultation_case_id, notes, items = [] } = req.body;
  if (!patient_id || !issued_date || !consultation_case_id) return res.status(400).json({ message: "patient_id, case, and issued_date are required." });
  const linkedCase = db.prepare("SELECT id FROM consultation_cases WHERE id=? AND patient_id=?").get(consultation_case_id, patient_id);
  if (!linkedCase) return res.status(400).json({ message: "The selected case does not belong to this patient." });
  const number = prescription_number || nextNumber("RX", "prescriptions", "prescription_number");
  const create = db.transaction(() => {
    const result = db.prepare("INSERT INTO prescriptions (prescription_number, patient_id, issued_date, diagnosis, consultation_case_id, notes) VALUES (?, ?, ?, ?, ?, ?)").run(number, patient_id, issued_date, diagnosis || null, consultation_case_id, notes || null);
    const insertItem = db.prepare("INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration, instructions) VALUES (?, ?, ?, ?, ?, ?)");
    items.forEach((item) => insertItem.run(result.lastInsertRowid, item.medicine_name, item.dosage || null, item.frequency || null, item.duration || null, item.instructions || null));
    return result.lastInsertRowid;
  });
  res.status(201).json({ id: create(), prescription_number: number, message: "Prescription created." });
});

router.delete("/prescriptions/:id", (req, res) => {
  const result = db.prepare("DELETE FROM prescriptions WHERE id=?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Prescription not found." });
  res.status(204).end();
});

router.get("/laboratory-requests", (req, res) => {
  const records = req.query.patient_id
    ? db.prepare(`SELECT r.*, pt.first_name || ' ' || pt.last_name AS patient_name, c.case_number FROM laboratory_requests r JOIN patients pt ON pt.id = r.patient_id LEFT JOIN consultation_cases c ON c.id=r.consultation_case_id WHERE r.patient_id=? ORDER BY r.id DESC`).all(req.query.patient_id)
    : db.prepare(`SELECT r.*, pt.first_name || ' ' || pt.last_name AS patient_name, c.case_number FROM laboratory_requests r JOIN patients pt ON pt.id = r.patient_id LEFT JOIN consultation_cases c ON c.id=r.consultation_case_id ORDER BY r.id DESC`).all();
  const items = db.prepare("SELECT * FROM laboratory_request_items WHERE laboratory_request_id = ?");
  res.json(records.map((record) => ({ ...record, items: items.all(record.id) })));
});

router.post("/laboratory-requests", (req, res) => {
  const { request_number, patient_id, requested_date, indication, consultation_case_id, notes, items = [] } = req.body;
  if (!patient_id || !requested_date || !consultation_case_id) return res.status(400).json({ message: "patient_id, case, and requested_date are required." });
  const linkedCase = db.prepare("SELECT id FROM consultation_cases WHERE id=? AND patient_id=?").get(consultation_case_id, patient_id);
  if (!linkedCase) return res.status(400).json({ message: "The selected case does not belong to this patient." });
  const number = request_number || nextNumber("LAB", "laboratory_requests", "request_number");
  const create = db.transaction(() => {
    const result = db.prepare("INSERT INTO laboratory_requests (request_number, patient_id, requested_date, indication, consultation_case_id, notes) VALUES (?, ?, ?, ?, ?, ?)").run(number, patient_id, requested_date, indication || null, consultation_case_id, notes || null);
    const insertItem = db.prepare("INSERT INTO laboratory_request_items (laboratory_request_id, test_name) VALUES (?, ?)");
    items.forEach((item) => insertItem.run(result.lastInsertRowid, item.test_name));
    return result.lastInsertRowid;
  });
  res.status(201).json({ id: create(), request_number: number, message: "Laboratory request created." });
});

router.delete("/laboratory-requests/:id", (req, res) => {
  const result = db.prepare("DELETE FROM laboratory_requests WHERE id=?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Laboratory request not found." });
  res.status(204).end();
});

module.exports = router;
