const express = require("express");
const { currentPregnancy, createPregnancy, savePrenatalVisit, officialEdd, gestation, addDays, validDate, dateOnly, today, riskSummary, fail } = require("../services/pregnancies");

module.exports = (db) => {
  const router = express.Router();
  const clinical = require("../services/permissions").permissionGuard;
  const handle = (fn) => (req, res) => { try { fn(req, res); } catch (error) { res.status(error.status || 400).json({ message: error.message }); } };
  const base = `SELECT g.*,p.first_name,p.middle_name,p.last_name,p.patient_number,p.birth_date,p.existing_illnesses,p.family_history,p.ob_history,
    COALESCE(u.fullname,'Attending Physician') doctor_name FROM pregnancy_records g JOIN patients p ON p.id=g.patient_id LEFT JOIN users u ON u.id=g.doctor_id`;
  const visitsFor = (id) => db.prepare(`SELECT pr.*,c.case_number,c.chief_complaint,c.history_present_illness,c.doctor_notes,c.lab_results,
    COALESCE(u.fullname,'Attending Physician') doctor_name
    FROM prenatal_records pr LEFT JOIN consultation_cases c ON c.id=pr.consultation_case_id LEFT JOIN users u ON u.id=pr.doctor_id
    WHERE pr.pregnancy_id=? ORDER BY datetime(pr.visit_date),pr.id`).all(id);
  const summary = (record, visits) => {
    const edd = officialEdd(record);
    const reference = record.actual_delivery_date || (record.status !== "Active" ? record.closed_date || dateOnly(visits.at(-1)?.visit_date) : today());
    return { ...record, lmp_edd: addDays(record.lmp_date, 280), official_edd: edd, current_ga: gestation(edd, reference),
      ga_reference_date: reference, delivery_ga: gestation(edd, record.actual_delivery_date), visit_count: visits.length,
      first_visit_date: visits[0]?.visit_date || null, latest_visit_date: visits.at(-1)?.visit_date || null,
      suggested_risk: riskSummary(visits), risk_needs_review: !record.risk_reviewed_at };
  };
  router.get("/pregnancies", clinical, handle((req, res) => {
    const rows = db.prepare(`${base} ${req.query.patient_id ? "WHERE g.patient_id=?" : ""} ORDER BY g.id DESC`).all(...(req.query.patient_id ? [req.query.patient_id] : []));
    res.json(rows.map((record) => summary(record, visitsFor(record.id))));
  }));
  router.get("/pregnancies/current/:patientId", clinical, handle((req, res) => {
    const record = currentPregnancy(db, req.params.patientId);
    const needsReview = !!db.prepare("SELECT id FROM pregnancy_records WHERE patient_id=? AND status='Needs review'").get(req.params.patientId);
    res.json({ pregnancy: record ? summary(record, visitsFor(record.id)) : null, needs_review: !record && needsReview });
  }));
  router.get("/pregnancies/:id", clinical, handle((req, res) => {
    const record = db.prepare(`${base} WHERE g.id=?`).get(req.params.id);
    if (!record) fail("Pregnancy record not found.", 404);
    const visits = visitsFor(record.id).map((visit) => ({ ...visit,
      current_dating_ga: gestation(officialEdd(record), visit.visit_date),
      diagnoses: db.prepare(`SELECT d.diagnosis_name FROM diagnoses d JOIN case_diagnoses cd ON cd.diagnosis_id=d.id WHERE cd.consultation_case_id=?`).all(visit.consultation_case_id),
      prescriptions: db.prepare("SELECT * FROM prescriptions WHERE consultation_case_id=? ORDER BY issued_date,id").all(visit.consultation_case_id).map((rx) => ({ ...rx, items: db.prepare("SELECT * FROM prescription_items WHERE prescription_id=?").all(rx.id) })),
      laboratory_requests: db.prepare("SELECT * FROM laboratory_requests WHERE consultation_case_id=? ORDER BY requested_date,id").all(visit.consultation_case_id).map((lab) => ({ ...lab, items: db.prepare("SELECT * FROM laboratory_request_items WHERE laboratory_request_id=?").all(lab.id) })),
    }));
    res.json({ ...summary(record, visits), visits });
  }));
  router.post("/pregnancies", clinical, handle((req, res) => {
    const created = db.transaction(() => createPregnancy(db, Number(req.body.patient_id), { ...req.body, doctor_id: req.user.id }))();
    res.status(201).json(created);
  }));
  router.patch("/pregnancies/:id", clinical, handle((req, res) => {
    const record = db.prepare("SELECT * FROM pregnancy_records WHERE id=?").get(req.params.id);
    if (!record) fail("Pregnancy record not found.", 404);
    const allowed = ["status","lmp_date","ultrasound_edd","manual_edd","edd_source","gravida","para","abortion_count","living_children","doctor_id","maternal_history","risk_level","risk_reasons",
      "actual_delivery_date","delivery_location","delivery_mode","delivery_complications","baby_sex","birth_weight_kg","birth_outcome","apgar","maternal_outcome","delivery_notes"];
    const changes = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key] === "" ? null : req.body[key]]));
    if (!Object.keys(changes).length) fail("No pregnancy changes supplied.");
    const next = { ...record, ...changes };
    if (!["Active","Delivered","Completed","Closed","Needs review"].includes(next.status)) fail("Select a valid pregnancy status.");
    for (const key of ["lmp_date","ultrasound_edd","manual_edd","actual_delivery_date"]) if (next[key] && !validDate(next[key])) fail(`Enter a valid ${key.replaceAll("_", " ")}.`);
    if (!["LMP","Ultrasound","Manual"].includes(next.edd_source)) fail("Select a valid EDD source.");
    if (next.edd_source === "Ultrasound" && !next.ultrasound_edd) fail("Enter the ultrasound EDD before selecting it as official.");
    if (next.edd_source === "Manual" && !next.manual_edd) fail("Enter a manual EDD before selecting it as official.");
    if (next.status === "Delivered" && !next.actual_delivery_date) fail("Enter the actual delivery date.");
    if (next.actual_delivery_date && next.status === "Active") fail("Mark a delivered pregnancy as Delivered or Completed.");
    if (next.actual_delivery_date && next.lmp_date && next.actual_delivery_date < next.lmp_date) fail("Delivery date cannot precede LMP.");
    if (next.actual_delivery_date && next.actual_delivery_date > today()) fail("Actual delivery date cannot be in the future.");
    for (const key of ["gravida","para","abortion_count","living_children"]) if (next[key] != null && (!Number.isInteger(Number(next[key])) || Number(next[key]) < 0)) fail("Obstetric history counts must be non-negative integers.");
    if (next.birth_weight_kg != null && (!Number.isFinite(Number(next.birth_weight_kg)) || Number(next.birth_weight_kg) <= 0)) fail("Birth weight must be a positive number in kg.");
    if (next.risk_level && !["Low Risk","Needs Monitoring","High Risk"].includes(next.risk_level)) fail("Select a valid risk level.");
    if (req.body.risk_level !== undefined && !next.risk_level) fail("Select a risk classification before confirming the review.");
    if (next.status === "Active") {
      const active = currentPregnancy(db, record.patient_id);
      if (active && active.id !== record.id) fail("Close the other active pregnancy before activating this record.", 409);
    }
    if (changes.status && changes.status !== record.status) changes.closed_date = ["Delivered","Completed","Closed"].includes(changes.status) ? next.actual_delivery_date || today() : null;
    if (changes.risk_level) { changes.risk_reviewed_at = new Date().toISOString(); changes.risk_reviewed_by = req.user.id; }
    const fields = Object.keys(changes);
    db.prepare(`UPDATE pregnancy_records SET ${fields.map((key) => `${key}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...Object.values(changes), record.id);
    res.json({ id: record.id, message: "Pregnancy record updated." });
  }));
  // Existing visits may be reconciled after a doctor reviews historical grouping.
  router.put("/pregnancies/:id/visits/:visitId", clinical, handle((req, res) => {
    const target = db.prepare("SELECT * FROM pregnancy_records WHERE id=?").get(req.params.id);
    const visit = db.prepare("SELECT * FROM prenatal_records WHERE id=?").get(req.params.visitId);
    if (!target || !visit || target.patient_id !== visit.patient_id) fail("The visit and pregnancy must belong to the same patient.");
    db.transaction(() => {
      db.prepare("UPDATE prenatal_records SET pregnancy_id=? WHERE id=?").run(target.id, visit.id);
      db.prepare("UPDATE pregnancy_records SET risk_reviewed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id IN (?,?)").run(target.id, visit.pregnancy_id);
    })();
    res.json({ message: "Visit moved to the selected pregnancy." });
  }));
  router.post("/prenatal-records", clinical, handle((req, res) => res.status(201).json(savePrenatalVisit(db, { ...req.body, doctor_id: req.user.id }))));
  router.put("/prenatal-records/:id", clinical, handle((req, res) => res.json(savePrenatalVisit(db, { ...req.body, doctor_id: req.user.id }, Number(req.params.id)))));
  router.delete("/prenatal-records/:id", clinical, (req, res) => res.status(409).json({ message: "Prenatal visits are retained in pregnancy history. Correct the visit instead of deleting it." }));
  return router;
};
