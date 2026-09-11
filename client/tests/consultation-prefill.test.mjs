import { test } from "node:test";
import assert from "node:assert/strict";
import { latestConsultation, prefillConsultation } from "../src/utils/consultationPrefill.js";

test("latest consultation uses visit date, then ID, and handles patients with no visits", () => {
  const records = [{ id: 40, consultation_date: "2025-01-01" }, { id: 2, consultation_date: "2026-01-01 10:00" }, { id: 3, consultation_date: "2026-01-01T10:00" }];
  assert.equal(latestConsultation(records).id, 3);
  assert.equal(records[0].id, 40);
  assert.equal(latestConsultation([]), null);
});

test("prefill reuses history and LMP without copying current findings, identifiers or orders", () => {
  const form = { patient_id: "1", service_type: "Prenatal Checkup", history_present_illness: "", gravida: "", para: "", abortion_count: "", living_children: "", consultation_date: "2026-09-11", chief_complaint: "", diagnoses: "", lmp_date: "", weight_kg: "" };
  const previous = { id: 99, patient_id: 1, chief_complaint: "Old complaint", diagnoses: [{ diagnosis_name: "Old diagnosis" }], history_present_illness: "Relevant history", weight_kg: 60, prenatal_record: { gravida: 2, para: 1, abortion_count: 0, living_children: 1, lmp_date: "2025-01-01" }, prescriptions: [{}] };
  const next = prefillConsultation(form, previous);
  assert.equal(next.history_present_illness, "Relevant history");
  assert.equal(next.gravida, "2");
  assert.equal(next.abortion_count, "0");
  assert.equal(next.lmp_date, "2025-01-01");
  for (const key of ["patient_id", "consultation_date", "chief_complaint", "diagnoses", "weight_kg"]) assert.equal(next[key], form[key]);
  assert.equal(next.id, undefined);
  assert.equal(next.prescriptions, undefined);
  assert.equal(form.history_present_illness, "");
});

test("prenatal dates load together while preserving changed or cleared dates", () => {
  const previous = { prenatal_record: { lmp_date: "2026-01-01", estimated_delivery_date: "2026-10-08" } };
  const form = { service_type: "Prenatal Checkup", lmp_date: "", expected_delivery_date: "" };
  const loaded = prefillConsultation(form, previous);
  assert.equal(loaded.lmp_date, "2026-01-01");
  assert.equal(loaded.expected_delivery_date, "2026-10-08");
  const changed = prefillConsultation({ ...form, lmp_date: "2026-02-01", expected_delivery_date: "2026-11-08" }, previous);
  assert.equal(changed.lmp_date, "2026-02-01");
  assert.equal(changed.expected_delivery_date, "2026-11-08");
  const cleared = prefillConsultation(form, previous, new Set(["lmp_date"]));
  assert.equal(cleared.lmp_date, "");
  assert.equal(cleared.expected_delivery_date, "");
  const general = prefillConsultation({ ...form, service_type: "General Consultation" }, previous);
  assert.equal(general.lmp_date, "");
  assert.equal(general.expected_delivery_date, "");
});

test("prefill preserves doctor edits and does not copy prenatal fields into general visits", () => {
  const previous = { history_present_illness: "Old history", prenatal_record: { gravida: 2 } };
  assert.equal(prefillConsultation({ history_present_illness: "New history" }, previous).history_present_illness, "New history");
  assert.equal(prefillConsultation({ history_present_illness: "" }, previous, new Set(["history_present_illness"])).history_present_illness, "");
  assert.equal(prefillConsultation({ service_type: "General Consultation", gravida: "" }, previous).gravida, "");
});
