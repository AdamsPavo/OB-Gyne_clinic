const path = require("path");
const Database = require("better-sqlite3");

// Store the database inside the server folder.
const databasePath = path.join(__dirname, "..", "obgyn.db");

const db = new Database(databasePath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

/*
|--------------------------------------------------------------------------
| Create Base Tables
|--------------------------------------------------------------------------
|
| Do not create indexes here that depend on newly migrated columns.
| Those indexes are created after the migrations at the bottom.
|
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff'
      CHECK (role IN ('doctor', 'staff')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    clinic_name TEXT NOT NULL,
    clinic_address TEXT NOT NULL,
    doctor_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_number TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_name TEXT,
    birth_date TEXT,
    civil_status TEXT,
    occupation TEXT,
    contact_number TEXT,
    email TEXT,
    address TEXT,
    blood_type TEXT,
    allergies TEXT,
    existing_illnesses TEXT,
    previous_surgeries TEXT,
    family_history TEXT,
    ob_history TEXT,
    pregnancy_history TEXT,
    emergency_contact_name TEXT,
    emergency_contact_number TEXT,
    notes TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT,
    service TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
      REFERENCES patients(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS consultation_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_number TEXT UNIQUE NOT NULL,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER,
    appointment_id INTEGER,
    service_type TEXT,
    consultation_date TEXT NOT NULL,
    chief_complaint TEXT,
    history_present_illness TEXT,
    blood_pressure TEXT,
    temperature_c REAL,
    weight_kg REAL,
    height_cm REAL,
    treatment TEXT,
    doctor_notes TEXT,
    follow_up_date TEXT,
    case_status TEXT NOT NULL DEFAULT 'Open'
      CHECK (case_status IN ('Open', 'Completed', 'Cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
      REFERENCES patients(id),

    FOREIGN KEY (doctor_id)
      REFERENCES users(id)
      ON DELETE SET NULL,

    FOREIGN KEY (appointment_id)
      REFERENCES appointments(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS diagnoses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    diagnosis_name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS case_diagnoses (
    consultation_case_id INTEGER NOT NULL,
    diagnosis_id INTEGER NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    notes TEXT,

    PRIMARY KEY (
      consultation_case_id,
      diagnosis_id
    ),

    FOREIGN KEY (consultation_case_id)
      REFERENCES consultation_cases(id)
      ON DELETE CASCADE,

    FOREIGN KEY (diagnosis_id)
      REFERENCES diagnoses(id)
      ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS consultations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    consultation_date TEXT NOT NULL,
    chief_complaint TEXT,
    diagnosis TEXT,
    notes TEXT,
    follow_up_date TEXT,
    status TEXT DEFAULT 'Completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
      REFERENCES patients(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS prenatal_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    consultation_case_id INTEGER,
    appointment_id INTEGER,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER,
    service_type TEXT,

    visit_date TEXT NOT NULL,

    lmp_date TEXT,
    estimated_delivery_date TEXT,

    gestational_age_weeks INTEGER,
    gestational_weeks INTEGER,
    gestational_days INTEGER,

    gravida INTEGER,
    para INTEGER,
    abortion_count INTEGER,
    living_children INTEGER,
    number_of_fetuses INTEGER NOT NULL DEFAULT 1,

    blood_pressure TEXT,
    temperature_c REAL,
    weight_kg REAL,
    height_cm REAL,

    fundal_height_cm REAL,
    fetal_heart_rate INTEGER,
    fetal_movement TEXT,
    fetal_presentation TEXT,

    edema TEXT,

    risk_level TEXT NOT NULL DEFAULT 'Low Risk',

    risk_reasons TEXT,
    assessment TEXT,
    treatment TEXT,
    notes TEXT,

    next_visit_date TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (consultation_case_id)
      REFERENCES consultation_cases(id)
      ON DELETE CASCADE,

    FOREIGN KEY (appointment_id)
      REFERENCES appointments(id)
      ON DELETE SET NULL,

    FOREIGN KEY (patient_id)
      REFERENCES patients(id)
      ON DELETE CASCADE,

    FOREIGN KEY (doctor_id)
      REFERENCES users(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prescription_number TEXT UNIQUE NOT NULL,
    patient_id INTEGER NOT NULL,
    consultation_id INTEGER,
    consultation_case_id INTEGER,
    diagnosis TEXT,
    issued_date TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
      REFERENCES patients(id)
      ON DELETE CASCADE,

    FOREIGN KEY (consultation_id)
      REFERENCES consultations(id)
      ON DELETE SET NULL,

    FOREIGN KEY (consultation_case_id)
      REFERENCES consultation_cases(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS prescription_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prescription_id INTEGER NOT NULL,
    medicine_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    duration TEXT,
    quantity TEXT,
    instructions TEXT,

    FOREIGN KEY (prescription_id)
      REFERENCES prescriptions(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS laboratory_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number TEXT UNIQUE NOT NULL,
    patient_id INTEGER NOT NULL,
    consultation_id INTEGER,
    consultation_case_id INTEGER,
    indication TEXT,
    requested_date TEXT NOT NULL,
    status TEXT DEFAULT 'Requested',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
      REFERENCES patients(id)
      ON DELETE CASCADE,

    FOREIGN KEY (consultation_id)
      REFERENCES consultations(id)
      ON DELETE SET NULL,

    FOREIGN KEY (consultation_case_id)
      REFERENCES consultation_cases(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS laboratory_request_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    laboratory_request_id INTEGER NOT NULL,
    test_name TEXT NOT NULL,
    instructions TEXT,
    status TEXT DEFAULT 'Requested',
    result TEXT,
    result_date TEXT,

    FOREIGN KEY (laboratory_request_id)
      REFERENCES laboratory_requests(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    patient_id INTEGER NOT NULL,
    consultation_case_id INTEGER,
    invoice_date TEXT NOT NULL,
    due_date TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    paid_amount REAL NOT NULL DEFAULT 0,
    payment_status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
      REFERENCES patients(id)
      ON DELETE CASCADE,

    FOREIGN KEY (consultation_case_id)
      REFERENCES consultation_cases(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    payment_date TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT,
    reference_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (invoice_id)
      REFERENCES invoices(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS report_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_name TEXT NOT NULL,
    report_period TEXT,
    file_format TEXT,
    generated_by INTEGER,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (generated_by)
      REFERENCES users(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS backup_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_name TEXT UNIQUE NOT NULL,
    file_path TEXT,
    file_size_bytes INTEGER,
    backup_type TEXT DEFAULT 'Manual',
    status TEXT DEFAULT 'Completed',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by)
      REFERENCES users(id)
      ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_patient
    ON appointments(patient_id);

  CREATE INDEX IF NOT EXISTS idx_consultations_patient
    ON consultations(patient_id);

  CREATE INDEX IF NOT EXISTS idx_cases_patient
    ON consultation_cases(patient_id, consultation_date);

  CREATE INDEX IF NOT EXISTS idx_prenatal_patient
    ON prenatal_records(patient_id);

  CREATE INDEX IF NOT EXISTS idx_prescriptions_patient
    ON prescriptions(patient_id);

  CREATE INDEX IF NOT EXISTS idx_lab_requests_patient
    ON laboratory_requests(patient_id);

  CREATE INDEX IF NOT EXISTS idx_invoices_patient
    ON invoices(patient_id);
`);

/*
|--------------------------------------------------------------------------
| Migration Helper
|--------------------------------------------------------------------------
|
| CREATE TABLE IF NOT EXISTS does not change an existing table.
| This function checks whether a column already exists before adding it.
|
*/

function addColumnIfMissing(tableName, columnDefinition) {
  const columnName = columnDefinition.trim().split(/\s+/)[0];

  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((column) => column.name);

  if (columns.includes(columnName)) {
    return;
  }

  db.exec(`
    ALTER TABLE ${tableName}
    ADD COLUMN ${columnDefinition}
  `);

  console.log(`Added missing column: ${tableName}.${columnName}`);
}

/*
|--------------------------------------------------------------------------
| Patient Migrations
|--------------------------------------------------------------------------
*/

const patientColumns = [
  "civil_status TEXT",
  "occupation TEXT",
  "allergies TEXT",
  "existing_illnesses TEXT",
  "previous_surgeries TEXT",
  "family_history TEXT",
  "ob_history TEXT",
  "pregnancy_history TEXT",
  "notes TEXT",
  "is_archived INTEGER NOT NULL DEFAULT 0",
];

for (const column of patientColumns) {
  addColumnIfMissing("patients", column);
}

/*
|--------------------------------------------------------------------------
| Consultation Case Migrations
|--------------------------------------------------------------------------
*/

const consultationCaseColumns = [
  "appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL",
  "service_type TEXT",
  "updated_at DATETIME",
];

for (const column of consultationCaseColumns) {
  addColumnIfMissing("consultation_cases", column);
}

/*
|--------------------------------------------------------------------------
| Prenatal Record Migrations
|--------------------------------------------------------------------------
*/

const prenatalColumns = [
  "consultation_case_id INTEGER REFERENCES consultation_cases(id) ON DELETE CASCADE",
  "appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL",
  "doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
  "service_type TEXT",

  "lmp_date TEXT",
  "estimated_delivery_date TEXT",

  "gestational_age_weeks INTEGER",
  "gestational_weeks INTEGER",
  "gestational_days INTEGER",

  "gravida INTEGER",
  "para INTEGER",
  "abortion_count INTEGER",
  "living_children INTEGER",
  "number_of_fetuses INTEGER NOT NULL DEFAULT 1",

  "blood_pressure TEXT",
  "temperature_c REAL",
  "weight_kg REAL",
  "height_cm REAL",

  "fundal_height_cm REAL",
  "fetal_heart_rate INTEGER",
  "fetal_movement TEXT",
  "fetal_presentation TEXT",
  "edema TEXT",

  "risk_level TEXT NOT NULL DEFAULT 'Low Risk'",
  "risk_reasons TEXT",
  "assessment TEXT",
  "treatment TEXT",
  "notes TEXT",
  "next_visit_date TEXT",

  "created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
];

for (const column of prenatalColumns) {
  addColumnIfMissing("prenatal_records", column);
}

/*
|--------------------------------------------------------------------------
| Prescription Migrations
|--------------------------------------------------------------------------
*/

const prescriptionColumns = [
  "consultation_case_id INTEGER REFERENCES consultation_cases(id) ON DELETE SET NULL",
];

for (const column of prescriptionColumns) {
  addColumnIfMissing("prescriptions", column);
}

/*
|--------------------------------------------------------------------------
| Prescription Item Migrations
|--------------------------------------------------------------------------
*/

const prescriptionItemColumns = [
  "quantity TEXT",
];

for (const column of prescriptionItemColumns) {
  addColumnIfMissing("prescription_items", column);
}

/*
|--------------------------------------------------------------------------
| Laboratory Request Migrations
|--------------------------------------------------------------------------
*/

const laboratoryRequestColumns = [
  "consultation_case_id INTEGER REFERENCES consultation_cases(id) ON DELETE SET NULL",
];

for (const column of laboratoryRequestColumns) {
  addColumnIfMissing("laboratory_requests", column);
}

/*
|--------------------------------------------------------------------------
| Laboratory Request Item Migrations
|--------------------------------------------------------------------------
*/

const laboratoryRequestItemColumns = [
  "instructions TEXT",
];

for (const column of laboratoryRequestItemColumns) {
  addColumnIfMissing("laboratory_request_items", column);
}

/*
|--------------------------------------------------------------------------
| Invoice Migrations
|--------------------------------------------------------------------------
*/

const invoiceColumns = [
  "consultation_case_id INTEGER REFERENCES consultation_cases(id) ON DELETE SET NULL",
];

for (const column of invoiceColumns) {
  addColumnIfMissing("invoices", column);
}

/*
|--------------------------------------------------------------------------
| Create Indexes After Migrations
|--------------------------------------------------------------------------
|
| These indexes use columns that may not have existed in older databases.
| They must be created only after the missing columns are added.
|
*/

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_cases_appointment
    ON consultation_cases(appointment_id);

  CREATE INDEX IF NOT EXISTS idx_prenatal_case
    ON prenatal_records(consultation_case_id);

  CREATE INDEX IF NOT EXISTS idx_prenatal_appointment
    ON prenatal_records(appointment_id);

  CREATE INDEX IF NOT EXISTS idx_prenatal_doctor
    ON prenatal_records(doctor_id);

  CREATE INDEX IF NOT EXISTS idx_prescriptions_case
    ON prescriptions(consultation_case_id);

  CREATE INDEX IF NOT EXISTS idx_lab_requests_case
    ON laboratory_requests(consultation_case_id);

  CREATE INDEX IF NOT EXISTS idx_invoices_case
    ON invoices(consultation_case_id);
`);

module.exports = db;