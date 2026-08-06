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

  CREATE TABLE IF NOT EXISTS service_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    default_fee REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS charge_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL DEFAULT 'Miscellaneous',
    description TEXT,
    default_amount REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS patient_charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    charge_number TEXT UNIQUE NOT NULL,
    patient_id INTEGER NOT NULL,
    charge_type_id INTEGER NOT NULL,
    consultation_case_id INTEGER,
    invoice_id INTEGER NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_amount REAL NOT NULL,
    total_amount REAL NOT NULL,
    charge_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Billed',
    created_by TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (charge_type_id) REFERENCES charge_types(id),
    FOREIGN KEY (consultation_case_id) REFERENCES consultation_cases(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  );

  CREATE TABLE IF NOT EXISTS medicine_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_name TEXT NOT NULL,
    generic_name TEXT,
    unit TEXT NOT NULL DEFAULT 'piece',
    quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 10,
    unit_price REAL NOT NULL DEFAULT 0,
    expiry_date TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT UNIQUE NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT,
    description TEXT,
    unit_of_measurement TEXT NOT NULL,
    supplier TEXT,
    current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    minimum_stock_level INTEGER NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0,
    storage_location TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_item_id INTEGER NOT NULL,
    batch_number TEXT,
    expiration_date TEXT,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_cost REAL NOT NULL DEFAULT 0,
    supplier TEXT,
    received_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
  );

  CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_number TEXT UNIQUE NOT NULL,
    inventory_item_id INTEGER NOT NULL,
    inventory_batch_id INTEGER,
    transaction_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    batch_number TEXT,
    expiration_date TEXT,
    supplier TEXT,
    unit_cost REAL NOT NULL DEFAULT 0,
    patient_id INTEGER,
    consultation_case_id INTEGER,
    prescription_id INTEGER,
    reason TEXT,
    department TEXT,
    requested_by TEXT,
    performed_by TEXT,
    reference_number TEXT,
    transaction_date TEXT NOT NULL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
    FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (consultation_case_id) REFERENCES consultation_cases(id),
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
  );

  CREATE TABLE IF NOT EXISTS prescription_dispensing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prescription_id INTEGER NOT NULL,
    prescription_item_id INTEGER NOT NULL,
    inventory_item_id INTEGER NOT NULL,
    quantity_dispensed INTEGER NOT NULL,
    dispensed_by TEXT,
    dispensed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
    FOREIGN KEY (prescription_item_id) REFERENCES prescription_items(id),
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
  );

  CREATE TABLE IF NOT EXISTS inventory_activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    inventory_item_id INTEGER,
    performed_by TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
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

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    patient_id INTEGER NOT NULL,
    consultation_case_id INTEGER,
    source_type TEXT NOT NULL,
    source_id INTEGER,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
    final_amount_cents INTEGER NOT NULL DEFAULT 0,
    remarks TEXT,
    is_void INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (consultation_case_id) REFERENCES consultation_cases(id)
  );

  CREATE TABLE IF NOT EXISTS billing_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    invoice_item_id INTEGER,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('Addition','Deduction')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    reason TEXT NOT NULL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id)
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

/* Backward-compatible user migration. Legacy aliases are retained because
   existing clinical queries still use fullname/password. */
const userSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql || "";
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
if (!userColumns.includes("full_name") || !userColumns.includes("password_hash") || !userColumns.includes("is_active") || !userSql.includes("'admin'")) {
  db.pragma("foreign_keys = OFF");
  db.pragma("legacy_alter_table = ON");
  db.transaction(() => {
    db.exec(`ALTER TABLE users RENAME TO users_legacy;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, fullname TEXT NOT NULL, full_name TEXT NOT NULL,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE, password TEXT NOT NULL, password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','doctor','staff')),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`);
    const old = db.prepare("PRAGMA table_info(users_legacy)").all().map((column) => column.name);
    const full = old.includes("full_name") ? "COALESCE(full_name, fullname)" : "fullname";
    const hash = old.includes("password_hash") ? "COALESCE(password_hash, password)" : "password";
    const active = old.includes("is_active") ? "is_active" : "1";
    const updated = old.includes("updated_at") ? "COALESCE(updated_at, created_at)" : "created_at";
    db.exec(`INSERT INTO users (id,fullname,full_name,username,password,password_hash,role,is_active,created_at,updated_at)
      SELECT id,fullname,${full},username,password,${hash},LOWER(role),${active},created_at,${updated} FROM users_legacy;
      DROP TABLE users_legacy;`);
  })();
  db.pragma("legacy_alter_table = OFF");
  db.pragma("foreign_keys = ON");
}

db.exec(`CREATE TABLE IF NOT EXISTS user_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, acting_user_id INTEGER, target_user_id INTEGER,
  action TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (acting_user_id) REFERENCES users(id) ON DELETE SET NULL
); CREATE INDEX IF NOT EXISTS idx_user_audit_created ON user_audit_logs(created_at);`);

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
  "service_id INTEGER REFERENCES service_types(id) ON DELETE RESTRICT",
  "service_name TEXT",
  "service_price REAL NOT NULL DEFAULT 0",
  "updated_at DATETIME",
];

for (const column of consultationCaseColumns) {
  addColumnIfMissing("consultation_cases", column);
}

const appointmentColumns = [
  "service_id INTEGER REFERENCES service_types(id) ON DELETE RESTRICT",
  "service_name TEXT",
  "service_price REAL NOT NULL DEFAULT 0",
  "updated_at DATETIME",
];
for (const column of appointmentColumns) addColumnIfMissing("appointments", column);

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
  "appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL",
  "total_discount REAL NOT NULL DEFAULT 0",
  "grand_total REAL NOT NULL DEFAULT 0",
  "remaining_balance REAL NOT NULL DEFAULT 0",
  "billing_status TEXT NOT NULL DEFAULT 'Draft'",
  "created_by TEXT",
  "updated_at DATETIME",
];

for (const column of invoiceColumns) {
  addColumnIfMissing("invoices", column);
}

const paymentColumns = [
  "patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL",
  "receipt_number TEXT",
  "received_by TEXT",
  "remarks TEXT",
];
for (const column of paymentColumns) {
  addColumnIfMissing("payments", column);
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
  CREATE UNIQUE INDEX IF NOT EXISTS uk_active_invoice_case
    ON invoices(consultation_case_id)
    WHERE consultation_case_id IS NOT NULL AND payment_status <> 'Cancelled';
  CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
    ON invoice_items(invoice_id, is_void);
  CREATE UNIQUE INDEX IF NOT EXISTS uk_invoice_item_source
    ON invoice_items(invoice_id, source_type, source_id)
    WHERE source_id IS NOT NULL AND is_void = 0;
  CREATE INDEX IF NOT EXISTS idx_billing_adjustments_invoice
    ON billing_adjustments(invoice_id);

  CREATE INDEX IF NOT EXISTS idx_service_types_active
    ON service_types(is_active, name);
  CREATE INDEX IF NOT EXISTS idx_charge_types_active
    ON charge_types(is_active, name);
  CREATE INDEX IF NOT EXISTS idx_patient_charges_patient
    ON patient_charges(patient_id, charge_date);
  CREATE INDEX IF NOT EXISTS idx_patient_charges_invoice
    ON patient_charges(invoice_id);

  CREATE INDEX IF NOT EXISTS idx_medicine_inventory_name
    ON medicine_inventory(medicine_name);

  CREATE INDEX IF NOT EXISTS idx_medicine_inventory_expiry
    ON medicine_inventory(expiry_date);

  CREATE INDEX IF NOT EXISTS idx_inventory_items_category
    ON inventory_items(category, is_archived);
  CREATE INDEX IF NOT EXISTS idx_inventory_batches_fefo
    ON inventory_batches(inventory_item_id, expiration_date, quantity);
  CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date
    ON inventory_transactions(transaction_date, transaction_type);
  CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item
    ON inventory_transactions(inventory_item_id);
`);

module.exports = db;
