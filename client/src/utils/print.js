import clinicLogo from "../assets/OBLOGO.png";

const esc = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const styles = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #172033; font-family: Inter, Arial, sans-serif; font-size: 12px; line-height: 1.5; }
  .sheet { max-width: 190mm; margin: 0 auto; }
  .clinic-header { display: flex; align-items: center; gap: 15px; padding: 15px 18px; color: white; background: linear-gradient(120deg, #e6007e, #fb5b7b); border-radius: 16px 16px 5px 5px; }
  .logo-box { display: grid; place-items: center; flex: 0 0 51px; width: 51px; height: 51px; border-radius: 14px; background: white; overflow: hidden; }
  .logo-box img { width: 46px; height: 46px; object-fit: contain; }
  .clinic-header h1 { margin: 0; font-size: 21px; letter-spacing: -.3px; }
  .clinic-header p { margin: 1px 0 0; font-size: 10px; opacity: .92; }
  .doctor { margin-left: auto !important; text-align: right; max-width: 220px; }
  .document-band { display: flex; justify-content: space-between; gap: 16px; padding: 12px 17px; border: 1px solid #f5d4e2; border-top: 0; background: #fff7fb; }
  .document-type { margin: 0; color: #be185d; font-size: 15px; font-weight: 800; }
  .document-meta { margin: 2px 0 0; color: #6b7280; font-size: 10px; }
  .document-number { color: #be185d; font-size: 12px; font-weight: 800; text-align: right; }
  .patient-card { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; margin: 20px 0; border: 1px solid #e9d5e2; border-radius: 10px; overflow: hidden; background: #e9d5e2; }
  .field { min-height: 55px; padding: 10px 12px; background: #fff; }
  .label { color: #9ca3af; font-size: 9px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; }
  .value { margin-top: 3px; color: #1f2937; font-size: 12px; font-weight: 600; }
  h2 { margin: 22px 0 9px; padding-left: 10px; border-left: 4px solid #ec4899; color: #334155; font-size: 13px; }
  .note { margin: 0; padding: 12px; border-radius: 9px; background: #f8fafc; white-space: pre-wrap; }
  .details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .details .note { min-height: 55px; }
  ul { margin: 0; padding: 0; list-style: none; border: 1px solid #e5e7eb; border-radius: 9px; overflow: hidden; }
  li { padding: 11px 13px; border-bottom: 1px solid #e5e7eb; }
  li:last-child { border-bottom: 0; }
  .empty { color: #64748b; }
  .footer { display: flex; justify-content: space-between; gap: 30px; margin-top: 54px; padding-top: 15px; border-top: 1px solid #e5e7eb; color: #64748b; font-size: 10px; }
  .signature { min-width: 220px; padding-top: 8px; border-top: 1px solid #475569; color: #334155; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .sheet { max-width: none; } }
`;

const open = (title, body) => {
  const win = window.open("", "_blank");
  if (!win) { window.alert("The print window was blocked. Allow pop-ups, then try again."); return; }
  win.document.open();
  win.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>${styles}</style></head><body><main class="sheet">${body}</main></body></html>`);
  win.document.close();
  let printed = false;
  const print = () => { if (printed) return; printed = true; win.focus(); win.print(); };
  const logo = win.document.querySelector(".logo-box img");
  if (logo) logo.addEventListener("load", print, { once: true });
  win.setTimeout(print, 700);
};

const patientName = (record) => record.patient_name || `${record.first_name || ""} ${record.last_name || ""}`.trim();
const header = (record, type, number, date) => `<header class="clinic-header"><div class="logo-box"><img src="${clinicLogo}" alt="Clinic logo"></div><div><h1>${esc(record.clinic_name || "OB-GYN Clinic")}</h1><p>${esc(record.clinic_address || "Clinic Management System")}</p></div><p class="doctor"><b>${esc(record.doctor_name || "Attending Physician")}</b><br>OB-GYN Specialist</p></header><section class="document-band"><div><p class="document-type">${esc(type)}</p><p class="document-meta">Issued ${esc(date)} · Case No. ${esc(record.case_number)}</p></div><div class="document-number">${esc(number)}</div></section><section class="patient-card"><div class="field"><div class="label">Patient name</div><div class="value">${esc(patientName(record))}</div></div><div class="field"><div class="label">Patient number</div><div class="value">${esc(record.patient_number)}</div></div></section>`;
const footer = () => `<footer class="footer"><span>This document is part of the patient's confidential medical record.</span><span class="signature">Physician signature</span></footer>`;
const list = (items, renderer) => items?.length ? `<ul>${items.map(renderer).join("")}</ul>` : `<p class="note empty">No items recorded.</p>`;

export const printCase = (record) => open(`Consultation ${record.case_number}`, `${header(record, "Consultation Record", record.case_number, record.consultation_date)}<h2>Clinical details</h2><div class="details"><div class="note"><b>Chief complaint</b><br>${esc(record.chief_complaint)}</div><div class="note"><b>Diagnosis</b><br>${esc(record.diagnoses?.map((item) => item.diagnosis_name).join(", "))}</div><div class="note"><b>History of present illness</b><br>${esc(record.history_present_illness)}</div><div class="note"><b>Treatment</b><br>${esc(record.treatment)}</div></div><h2>Vital signs</h2><p class="note">Blood pressure: <b>${esc(record.blood_pressure)}</b> &nbsp; · &nbsp; Temperature: <b>${esc(record.temperature_c)} °C</b> &nbsp; · &nbsp; Weight: <b>${esc(record.weight_kg)} kg</b> &nbsp; · &nbsp; Height: <b>${esc(record.height_cm)} cm</b></p><h2>Doctor's notes</h2><p class="note">${esc(record.doctor_notes)}</p>${footer()}`);

export const printPrescription = (record) => open(`Prescription ${record.prescription_number}`, `${header(record, "Medicine Prescription", record.prescription_number, record.issued_date)}<h2>Clinical note</h2><p class="note">${esc(record.diagnosis || record.notes)}</p><h2>Prescribed medicines</h2>${list(record.items, (item) => `<li><b>${esc(item.medicine_name)}</b>${item.dosage ? ` — ${esc(item.dosage)}` : ""}${item.frequency ? ` · ${esc(item.frequency)}` : ""}${item.duration ? ` · ${esc(item.duration)}` : ""}${item.instructions ? `<br><span>${esc(item.instructions)}</span>` : ""}</li>`)}${footer()}`);

export const printLaboratoryRequest = (record) => open(`Laboratory request ${record.request_number}`, `${header(record, "Laboratory Request", record.request_number, record.requested_date)}<h2>Indication / remarks</h2><p class="note">${esc(record.indication || record.notes)}</p><h2>Requested laboratory tests</h2>${list(record.items, (item) => `<li><b>${esc(item.test_name)}</b></li>`)}${footer()}`);
