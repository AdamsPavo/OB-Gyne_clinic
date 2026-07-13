const express = require("express");
const db = require("../database/database");

const router = express.Router();

const resources = {
  patients: { table: "patients", required: ["patient_number", "first_name", "last_name"] },
  appointments: { table: "appointments", required: ["patient_id", "appointment_date", "service"] },
  consultations: { table: "consultations", required: ["patient_id", "consultation_date"] },
  "prenatal-records": { table: "prenatal_records", required: ["patient_id", "visit_date"] },
  invoices: { table: "invoices", required: ["invoice_number", "patient_id", "invoice_date"] },
  payments: { table: "payments", required: ["invoice_id", "payment_date", "amount"] },
  "report-exports": { table: "report_exports", required: ["report_name"] },
  backups: { table: "backup_records", required: ["backup_name"] },
};

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
  const records = db.prepare(`SELECT p.*, pt.first_name || ' ' || pt.last_name AS patient_name FROM prescriptions p JOIN patients pt ON pt.id = p.patient_id ORDER BY p.id DESC`).all();
  const items = db.prepare("SELECT * FROM prescription_items WHERE prescription_id = ?");
  res.json(records.map((record) => ({ ...record, items: items.all(record.id) })));
});

router.post("/prescriptions", (req, res) => {
  const { prescription_number, patient_id, issued_date, diagnosis, consultation_id, notes, items = [] } = req.body;
  if (!prescription_number || !patient_id || !issued_date) return res.status(400).json({ message: "prescription_number, patient_id, and issued_date are required." });
  const create = db.transaction(() => {
    const result = db.prepare("INSERT INTO prescriptions (prescription_number, patient_id, issued_date, diagnosis, consultation_id, notes) VALUES (?, ?, ?, ?, ?, ?)").run(prescription_number, patient_id, issued_date, diagnosis || null, consultation_id || null, notes || null);
    const insertItem = db.prepare("INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration, instructions) VALUES (?, ?, ?, ?, ?, ?)");
    items.forEach((item) => insertItem.run(result.lastInsertRowid, item.medicine_name, item.dosage || null, item.frequency || null, item.duration || null, item.instructions || null));
    return result.lastInsertRowid;
  });
  res.status(201).json({ id: create(), message: "Prescription created." });
});

router.get("/laboratory-requests", (req, res) => {
  const records = db.prepare(`SELECT r.*, pt.first_name || ' ' || pt.last_name AS patient_name FROM laboratory_requests r JOIN patients pt ON pt.id = r.patient_id ORDER BY r.id DESC`).all();
  const items = db.prepare("SELECT * FROM laboratory_request_items WHERE laboratory_request_id = ?");
  res.json(records.map((record) => ({ ...record, items: items.all(record.id) })));
});

router.post("/laboratory-requests", (req, res) => {
  const { request_number, patient_id, requested_date, indication, consultation_id, notes, items = [] } = req.body;
  if (!request_number || !patient_id || !requested_date) return res.status(400).json({ message: "request_number, patient_id, and requested_date are required." });
  const create = db.transaction(() => {
    const result = db.prepare("INSERT INTO laboratory_requests (request_number, patient_id, requested_date, indication, consultation_id, notes) VALUES (?, ?, ?, ?, ?, ?)").run(request_number, patient_id, requested_date, indication || null, consultation_id || null, notes || null);
    const insertItem = db.prepare("INSERT INTO laboratory_request_items (laboratory_request_id, test_name) VALUES (?, ?)");
    items.forEach((item) => insertItem.run(result.lastInsertRowid, item.test_name));
    return result.lastInsertRowid;
  });
  res.status(201).json({ id: create(), message: "Laboratory request created." });
});

module.exports = router;
