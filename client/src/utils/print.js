import clinicLogo from "../assets/OBLOGO.png";

const esc = (value) =>
  String(value ?? "—").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

const styles = `
  @page {
    size: A4;
    margin: 10mm;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
  }

  body {
    color: #172033;
    font-family: Inter, Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
  }

  .sheet {
    width: 100%;
    max-width: 190mm;
    margin: 0 auto;
  }

  .clinic-header {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px 18px;
    color: white;
    background: linear-gradient(120deg, #e6007e, #fb5b7b);
    border-radius: 16px 16px 5px 5px;
  }

  .logo-box {
    display: grid;
    place-items: center;
    flex: 0 0 51px;
    width: 51px;
    height: 51px;
    border-radius: 14px;
    background: white;
    overflow: hidden;
  }

  .logo-box img {
    width: 46px;
    height: 46px;
    object-fit: contain;
  }

  .clinic-header h1 {
    margin: 0;
    font-size: 21px;
    letter-spacing: -0.3px;
  }

  .clinic-header p {
    margin: 1px 0 0;
    font-size: 10px;
    opacity: 0.92;
  }

  .doctor {
    margin-left: auto !important;
    text-align: right;
    max-width: 220px;
  }

  .document-band {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 17px;
    border: 1px solid #f5d4e2;
    border-top: 0;
    background: #fff7fb;
  }

  .document-type {
    margin: 0;
    color: #be185d;
    font-size: 15px;
    font-weight: 800;
  }

  .document-meta {
    margin: 2px 0 0;
    color: #6b7280;
    font-size: 10px;
  }

  .document-number {
    color: #be185d;
    font-size: 12px;
    font-weight: 800;
    text-align: right;
  }

  .patient-card {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
    margin: 20px 0;
    border: 1px solid #e9d5e2;
    border-radius: 10px;
    overflow: hidden;
    background: #e9d5e2;
  }

  .field {
    min-height: 55px;
    padding: 10px 12px;
    background: #fff;
  }

  .label {
    color: #9ca3af;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  .value {
    margin-top: 3px;
    color: #1f2937;
    font-size: 12px;
    font-weight: 600;
  }

  h2 {
    margin: 22px 0 9px;
    padding-left: 10px;
    border-left: 4px solid #ec4899;
    color: #334155;
    font-size: 13px;
  }

  .note {
    margin: 0;
    padding: 12px;
    border-radius: 9px;
    background: #f8fafc;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .details .note {
    min-height: 55px;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid #e5e7eb;
    border-radius: 9px;
    overflow: hidden;
  }

  li {
    padding: 11px 13px;
    border-bottom: 1px solid #e5e7eb;
  }

  li:last-child {
    border-bottom: 0;
  }

  .empty {
    color: #64748b;
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 30px;
    margin-top: 54px;
    padding-top: 15px;
    border-top: 1px solid #e5e7eb;
    color: #64748b;
    font-size: 10px;
  }

  .signature {
    min-width: 220px;
    padding-top: 8px;
    border-top: 1px solid #475569;
    color: #334155;
    text-align: center;
  }

  /* CONSULTATION AND PRESCRIPTION: ONE A4 PAGE */

  .one-page-sheet {
    width: 100%;
    height: 275mm;
    max-height: 275mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transform-origin: top left;
  }

  .one-page-sheet .clinic-header {
    padding: 9px 13px;
    gap: 10px;
    border-radius: 12px 12px 4px 4px;
  }

  .one-page-sheet .logo-box {
    width: 43px;
    height: 43px;
    flex-basis: 43px;
    border-radius: 10px;
  }

  .one-page-sheet .logo-box img {
    width: 38px;
    height: 38px;
  }

  .one-page-sheet .clinic-header h1 {
    font-size: 17px;
  }

  .one-page-sheet .clinic-header p {
    font-size: 8px;
  }

  .one-page-sheet .doctor {
    font-size: 8px;
  }

  .one-page-sheet .document-band {
    padding: 7px 12px;
  }

  .one-page-sheet .document-type {
    font-size: 12px;
  }

  .one-page-sheet .document-meta {
    font-size: 8px;
  }

  .one-page-sheet .document-number {
    font-size: 9px;
  }

  .one-page-sheet .patient-card {
    margin: 8px 0;
  }

  .one-page-sheet .field {
    min-height: 39px;
    padding: 6px 9px;
  }

  .one-page-sheet .label {
    font-size: 7px;
  }

  .one-page-sheet .value {
    margin-top: 1px;
    font-size: 10px;
  }

  .one-page-sheet h2 {
    margin: 8px 0 5px;
    padding-left: 7px;
    border-left-width: 3px;
    font-size: 10px;
  }

  .one-page-sheet .note {
    padding: 7px 9px;
    border-radius: 6px;
    font-size: 9px;
    line-height: 1.25;
  }

  .one-page-sheet .details {
    gap: 6px;
  }

  .one-page-sheet .details .note {
    min-height: 42px;
  }

  .one-page-sheet ul {
    border-radius: 6px;
  }

  .one-page-sheet li {
    padding: 7px 9px;
    font-size: 9px;
    line-height: 1.25;
    break-inside: avoid;
  }

  .one-page-sheet .footer {
    margin-top: auto;
    padding-top: 8px;
    font-size: 8px;
  }

  .one-page-sheet .signature {
    min-width: 180px;
    padding-top: 4px;
  }

  .rx-symbol {
    margin: 6px 0 1px;
    color: #be185d;
    font-family: Georgia, serif;
    font-size: 25px;
    font-weight: 800;
    line-height: 1;
  }

  /* LABORATORY REQUEST: ONE A4 PAGE */

  .lab-sheet {
    width: 100%;
    height: 275mm;
    max-height: 275mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .lab-sheet .clinic-header {
    padding: 9px 13px;
    gap: 10px;
    border-radius: 12px 12px 4px 4px;
  }

  .lab-sheet .logo-box {
    width: 43px;
    height: 43px;
    flex-basis: 43px;
    border-radius: 10px;
  }

  .lab-sheet .logo-box img {
    width: 38px;
    height: 38px;
  }

  .lab-sheet .clinic-header h1 {
    font-size: 17px;
  }

  .lab-sheet .clinic-header p {
    font-size: 8px;
  }

  .lab-sheet .doctor {
    font-size: 8px;
  }

  .lab-sheet .document-band {
    padding: 7px 12px;
  }

  .lab-sheet .document-type {
    font-size: 12px;
  }

  .lab-sheet .document-meta {
    font-size: 8px;
  }

  .lab-sheet .document-number {
    font-size: 9px;
  }

  .lab-sheet .patient-card {
    margin: 8px 0;
  }

  .lab-sheet .field {
    min-height: 39px;
    padding: 6px 9px;
  }

  .lab-sheet .label {
    font-size: 7px;
  }

  .lab-sheet .value {
    margin-top: 1px;
    font-size: 10px;
  }

  .lab-sheet h2 {
    margin: 8px 0 5px;
    padding-left: 7px;
    border-left-width: 3px;
    font-size: 10px;
  }

  .lab-sheet .note {
    padding: 7px 9px;
    font-size: 9px;
    line-height: 1.3;
  }

  .lab-test-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5px;
  }

  .lab-test-item {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    min-height: 28px;
    padding: 5px 6px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #fff;
    font-size: 8.5px;
    line-height: 1.15;
    break-inside: avoid;
  }

  .lab-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 13px;
    width: 13px;
    height: 13px;
    border: 1px solid #475569;
    font-size: 8px;
    font-weight: 800;
  }

  .lab-sheet .footer {
    margin-top: auto;
    padding-top: 8px;
    font-size: 8px;
  }

  .lab-sheet .signature {
    min-width: 180px;
    padding-top: 4px;
  }

  @media print {
    html,
    body {
      width: 210mm;
      min-height: 297mm;
    }

    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .sheet {
      max-width: none;
    }

    .one-page-sheet,
    .lab-sheet {
      page-break-inside: avoid;
      page-break-after: avoid;
      break-inside: avoid-page;
      break-after: avoid-page;
    }
  }
`;

const open = (title, body, className = "sheet") => {
  const win = window.open("", "_blank");

  if (!win) {
    window.alert(
      "The print window was blocked. Allow pop-ups, then try again.",
    );
    return;
  }

  win.document.open();

  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${esc(title)}</title>
        <style>${styles}</style>
      </head>

      <body>
        <main class="${className}">
          ${body}
        </main>
      </body>
    </html>
  `);

  win.document.close();

  let printed = false;

  const fitOnePage = () => {
    const page = win.document.querySelector(".one-page-sheet");

    if (!page) return;

    page.style.zoom = "1";

    const availableHeight = page.clientHeight;
    const requiredHeight = page.scrollHeight;

    if (requiredHeight > availableHeight) {
      const calculatedScale = availableHeight / requiredHeight;

      /*
        Do not shrink below 68%.
        This keeps the printed text readable.
      */
      const scale = Math.max(0.68, calculatedScale);

      page.style.zoom = String(scale);
    }
  };

  const print = () => {
    if (printed) return;

    fitOnePage();

    printed = true;

    win.focus();
    win.print();
  };

  const logo = win.document.querySelector(".logo-box img");

  if (logo) {
    if (logo.complete) {
      win.setTimeout(print, 300);
    } else {
      logo.addEventListener("load", print, {
        once: true,
      });

      logo.addEventListener("error", print, {
        once: true,
      });
    }
  }

  win.setTimeout(print, 800);
};

const patientName = (record) =>
  record.patient_name ||
  [record.first_name, record.middle_name, record.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

const header = (record, type, number, date) => `
  <header class="clinic-header">
    <div class="logo-box">
      <img src="${clinicLogo}" alt="Clinic logo">
    </div>

    <div>
      <h1>${esc(record.clinic_name || "OB-GYN Clinic")}</h1>

      <p>
        ${esc(record.clinic_address || "Clinic Management System")}
      </p>
    </div>

    <p class="doctor">
      <b>${esc(record.doctor_name || "Attending Physician")}</b>
      <br>
      OB-GYN Specialist
    </p>
  </header>

  <section class="document-band">
    <div>
      <p class="document-type">
        ${esc(type)}
      </p>

      <p class="document-meta">
        Issued ${esc(date)} · Case No. ${esc(record.case_number)}
      </p>
    </div>

    <div class="document-number">
      ${esc(number)}
    </div>
  </section>

  <section class="patient-card">
    <div class="field">
      <div class="label">Patient name</div>

      <div class="value">
        ${esc(patientName(record))}
      </div>
    </div>

    <div class="field">
      <div class="label">Patient number</div>

      <div class="value">
        ${esc(record.patient_number)}
      </div>
    </div>
  </section>
`;

const footer = () => `
  <footer class="footer">
    <span>
      This document is part of the patient's confidential medical record.
    </span>

    <span class="signature">
      Physician signature
    </span>
  </footer>
`;

const list = (items, renderer) =>
  items?.length
    ? `<ul>${items.map(renderer).join("")}</ul>`
    : `<p class="note empty">No items recorded.</p>`;

/*
  CONSULTATION PRINT
  Compact and limited to one A4 page.
*/
export const printCase = (record) =>
  open(
    `Consultation ${record.case_number}`,
    `
      ${header(
        record,
        "Consultation Record",
        record.case_number,
        record.consultation_date,
      )}

      <h2>Clinical details</h2>

      <div class="details">
        <div class="note">
          <b>Chief complaint</b>
          <br>
          ${esc(record.chief_complaint)}
        </div>

        <div class="note">
          <b>Diagnosis</b>
          <br>
          ${esc(
            record.diagnoses
              ?.map((item) => item.diagnosis_name)
              .filter(Boolean)
              .join(", "),
          )}
        </div>

        <div class="note">
          <b>History of present illness</b>
          <br>
          ${esc(record.history_present_illness)}
        </div>

        <div class="note">
          <b>Treatment</b>
          <br>
          ${esc(record.treatment)}
        </div>
      </div>

      <h2>Vital signs</h2>

      <p class="note">
        Blood pressure:
        <b>${esc(record.blood_pressure)}</b>

        &nbsp; · &nbsp;

        Temperature:
        <b>${esc(record.temperature_c)} °C</b>

        &nbsp; · &nbsp;

        Weight:
        <b>${esc(record.weight_kg)} kg</b>

        &nbsp; · &nbsp;

        Height:
        <b>${esc(record.height_cm)} cm</b>
      </p>

      <h2>Doctor's notes</h2>

      <p class="note">
        ${esc(record.doctor_notes)}
      </p>

      ${footer()}
    `,
    "sheet one-page-sheet consultation-sheet",
  );

/*
  MEDICINE PRESCRIPTION PRINT
  Compact and limited to one A4 page.
*/
export const printPrescription = (record) =>
  open(
    `Prescription ${record.prescription_number}`,
    `
      ${header(
        record,
        "Medicine Prescription",
        record.prescription_number,
        record.issued_date,
      )}

      <h2>Clinical note</h2>

      <p class="note">
        ${esc(record.diagnosis || record.notes)}
      </p>

      <div class="rx-symbol">Rx</div>

      <h2>Prescribed medicines</h2>

      ${list(
        record.items,
        (item, index) => `
          <li>
            <b>
              ${index + 1}. ${esc(item.medicine_name)}
            </b>

            ${
              item.dosage
                ? `
                  <span> — ${esc(item.dosage)}</span>
                `
                : ""
            }

            ${
              item.frequency
                ? `
                  <span> · ${esc(item.frequency)}</span>
                `
                : ""
            }

            ${
              item.duration
                ? `
                  <span> · ${esc(item.duration)}</span>
                `
                : ""
            }

            ${
              item.quantity
                ? `
                  <span> · Qty: ${esc(item.quantity)}</span>
                `
                : ""
            }

            ${
              item.instructions
                ? `
                  <br>
                  <span>
                    <b>Instructions:</b>
                    ${esc(item.instructions)}
                  </span>
                `
                : ""
            }
          </li>
        `,
      )}

      ${footer()}
    `,
    "sheet one-page-sheet prescription-sheet",
  );

/*
  LABORATORY REQUEST PRINT
*/
export const printLaboratoryRequest = (record) => {
  const tests = Array.isArray(record.items) ? record.items : [];

  const testItems = tests.length
    ? tests
        .map(
          (item) => `
            <div class="lab-test-item">
              <span class="lab-check">✓</span>

              <span>
                <b>${esc(item.test_name)}</b>
              </span>
            </div>
          `,
        )
        .join("")
    : `
        <p class="note empty">
          No laboratory tests selected.
        </p>
      `;

  const indication = record.indication || "";
  const notes = record.notes || "";

  return open(
    `Laboratory request ${record.request_number}`,
    `
      ${header(
        record,
        "Laboratory Request",
        record.request_number,
        record.requested_date,
      )}

      ${
        indication
          ? `
            <h2>Clinical indication</h2>

            <p class="note">
              ${esc(indication)}
            </p>
          `
          : ""
      }

      <h2>Requested laboratory tests</h2>

      <div class="lab-test-grid">
        ${testItems}
      </div>

      ${
        notes
          ? `
            <h2>Remarks / instructions</h2>

            <p class="note">
              ${esc(notes)}
            </p>
          `
          : ""
      }

      ${footer()}
    `,
    "sheet lab-sheet",
  );
};