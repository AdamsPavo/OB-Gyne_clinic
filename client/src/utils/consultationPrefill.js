export const latestConsultation = (records) => [...records].sort((a, b) => {
  const timestamp = (record) => Date.parse(String(record.consultation_date || "").replace(" ", "T")) || 0;
  return timestamp(b) - timestamp(a) || Number(b.id) - Number(a.id);
})[0] || null;

// Reuse history and pregnancy dates, never a previous visit's findings or orders.
export function prefillConsultation(form, previous, touched = new Set()) {
  const values = { history_present_illness: previous.history_present_illness };
  if (/prenatal/i.test(form.service_type) && previous.prenatal_record) {
    for (const key of ["gravida", "para", "abortion_count", "living_children", "lmp_date"]) {
      values[key] = previous.prenatal_record[key];
    }
    if (!touched.has("lmp_date") && (!form.lmp_date || form.lmp_date === previous.prenatal_record.lmp_date)) {
      values.expected_delivery_date = previous.prenatal_record.estimated_delivery_date;
    }
  }
  const next = { ...form };
  for (const [key, value] of Object.entries(values)) {
    if (!touched.has(key) && (next[key] === "" || next[key] == null) && value != null) {
      next[key] = String(value);
    }
  }
  return next;
}
