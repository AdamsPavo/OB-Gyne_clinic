-- =========================================================
-- OB-GYN CLINIC MANAGEMENT SYSTEM
-- Target Database: MySQL 8
-- =========================================================

CREATE DATABASE IF NOT EXISTS obgyn_clinic
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE obgyn_clinic;

-- =========================================================
-- SETTINGS
-- =========================================================

CREATE TABLE settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,

  clinic_name VARCHAR(150) NOT NULL,
  clinic_address TEXT NOT NULL,
  doctor_name VARCHAR(150) NOT NULL,

  contact_number VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  clinic_logo_path VARCHAR(255) NULL,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  CONSTRAINT chk_settings_single_row
    CHECK (id = 1)
);

-- =========================================================
-- USERS
-- =========================================================
-- doctor = full access
-- staff  = limited access

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  full_name VARCHAR(150) NOT NULL,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,

  role ENUM('doctor', 'staff') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  last_login_at DATETIME NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uk_users_username (username),

  INDEX idx_users_role (role),
  INDEX idx_users_active (is_active)
);

-- =========================================================
-- PATIENTS
-- =========================================================

CREATE TABLE patients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  patient_number VARCHAR(30) NOT NULL,

  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NOT NULL,

  birth_date DATE NULL,
  civil_status VARCHAR(30) NULL,
  occupation VARCHAR(120) NULL,

  contact_number VARCHAR(30) NULL,
  address TEXT NULL,
  blood_type VARCHAR(5) NULL,

  allergies TEXT NULL,
  existing_illnesses TEXT NULL,
  previous_surgeries TEXT NULL,
  family_history TEXT NULL,
  ob_history TEXT NULL,
  pregnancy_history TEXT NULL,

  emergency_contact_name VARCHAR(150) NULL,
  emergency_contact_number VARCHAR(30) NULL,

  notes TEXT NULL,

  is_archived BOOLEAN NOT NULL DEFAULT FALSE,

  created_by BIGINT UNSIGNED NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uk_patients_patient_number (patient_number),

  INDEX idx_patients_name (
    last_name,
    first_name
  ),

  INDEX idx_patients_archived (is_archived),

  CONSTRAINT fk_patients_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

-- =========================================================
-- CONSULTATION CASES
-- =========================================================
-- Every patient visit creates a new consultation case.

CREATE TABLE consultation_cases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  case_number VARCHAR(30) NOT NULL,

  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,

  consultation_at DATETIME NOT NULL,

  chief_complaint TEXT NULL,
  history_present_illness TEXT NULL,

  blood_pressure VARCHAR(20) NULL,
  temperature_c DECIMAL(4,1) NULL,
  weight_kg DECIMAL(6,2) NULL,
  height_cm DECIMAL(6,2) NULL,

  treatment TEXT NULL,
  doctor_notes TEXT NULL,
  follow_up_date DATE NULL,

  case_status ENUM(
    'Open',
    'Completed',
    'Cancelled'
  ) NOT NULL DEFAULT 'Open',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uk_cases_case_number (case_number),

  INDEX idx_cases_patient_date (
    patient_id,
    consultation_at
  ),

  INDEX idx_cases_doctor (doctor_id),
  INDEX idx_cases_status (case_status),
  INDEX idx_cases_follow_up (follow_up_date),

  CONSTRAINT fk_cases_patient
    FOREIGN KEY (patient_id)
    REFERENCES patients(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_cases_doctor
    FOREIGN KEY (doctor_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

-- =========================================================
-- DIAGNOSES MASTER LIST
-- =========================================================

CREATE TABLE diagnoses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  code VARCHAR(30) NULL,
  diagnosis_name VARCHAR(255) NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uk_diagnoses_code (code),
  UNIQUE KEY uk_diagnoses_name (diagnosis_name)
);

-- =========================================================
-- CASE DIAGNOSES
-- =========================================================
-- A consultation case can contain several diagnoses.

CREATE TABLE case_diagnoses (
  consultation_case_id BIGINT UNSIGNED NOT NULL,
  diagnosis_id BIGINT UNSIGNED NOT NULL,

  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NULL,

  PRIMARY KEY (
    consultation_case_id,
    diagnosis_id
  ),

  INDEX idx_case_diagnoses_diagnosis (diagnosis_id),

  CONSTRAINT fk_case_diagnoses_case
    FOREIGN KEY (consultation_case_id)
    REFERENCES consultation_cases(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_case_diagnoses_diagnosis
    FOREIGN KEY (diagnosis_id)
    REFERENCES diagnoses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

-- =========================================================
-- PRESCRIPTIONS
-- =========================================================

CREATE TABLE prescriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  prescription_number VARCHAR(30) NOT NULL,
  consultation_case_id BIGINT UNSIGNED NOT NULL,

  prescription_date DATE NOT NULL,
  notes TEXT NULL,

  doctor_signature_path VARCHAR(255) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uk_prescriptions_number (
    prescription_number
  ),

  INDEX idx_prescriptions_case (
    consultation_case_id
  ),

  CONSTRAINT fk_prescriptions_case
    FOREIGN KEY (consultation_case_id)
    REFERENCES consultation_cases(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- =========================================================
-- PRESCRIPTION ITEMS
-- =========================================================

CREATE TABLE prescription_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  prescription_id BIGINT UNSIGNED NOT NULL,

  medicine VARCHAR(150) NOT NULL,
  dosage VARCHAR(100) NULL,
  frequency VARCHAR(100) NULL,
  duration VARCHAR(100) NULL,
  quantity VARCHAR(50) NULL,
  instructions TEXT NULL,

  PRIMARY KEY (id),

  INDEX idx_prescription_items_prescription (
    prescription_id
  ),

  CONSTRAINT fk_prescription_items_prescription
    FOREIGN KEY (prescription_id)
    REFERENCES prescriptions(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- =========================================================
-- LABORATORY REQUESTS
-- =========================================================

CREATE TABLE laboratory_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  request_number VARCHAR(30) NOT NULL,
  consultation_case_id BIGINT UNSIGNED NOT NULL,

  requested_at DATETIME NOT NULL,
  indication TEXT NULL,
  remarks TEXT NULL,

  status ENUM(
    'Pending',
    'Completed',
    'Released',
    'Cancelled'
  ) NOT NULL DEFAULT 'Pending',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uk_laboratory_requests_number (
    request_number
  ),

  INDEX idx_laboratory_requests_case (
    consultation_case_id
  ),

  INDEX idx_laboratory_requests_status (
    status
  ),

  CONSTRAINT fk_laboratory_requests_case
    FOREIGN KEY (consultation_case_id)
    REFERENCES consultation_cases(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- =========================================================
-- LABORATORY REQUEST ITEMS
-- =========================================================
-- Stores the tests requested by the doctor.

CREATE TABLE laboratory_request_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  laboratory_request_id BIGINT UNSIGNED NOT NULL,

  test_name VARCHAR(150) NOT NULL,
  instructions TEXT NULL,

  PRIMARY KEY (id),

  INDEX idx_lab_request_items_request (
    laboratory_request_id
  ),

  CONSTRAINT fk_lab_request_items_request
    FOREIGN KEY (laboratory_request_id)
    REFERENCES laboratory_requests(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- =========================================================
-- LABORATORY RESULTS
-- =========================================================

CREATE TABLE laboratory_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  laboratory_request_item_id BIGINT UNSIGNED NOT NULL,

  result_text TEXT NULL,
  result_file_path VARCHAR(255) NULL,

  completed_at DATETIME NULL,
  released_at DATETIME NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uk_lab_result_request_item (
    laboratory_request_item_id
  ),

  CONSTRAINT fk_lab_results_request_item
    FOREIGN KEY (laboratory_request_item_id)
    REFERENCES laboratory_request_items(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- =========================================================
-- BILLINGS
-- =========================================================
-- Each consultation case has one billing record.

CREATE TABLE billings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  receipt_number VARCHAR(30) NOT NULL,
  consultation_case_id BIGINT UNSIGNED NOT NULL,

  consultation_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  laboratory_charges DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  medicine_charges DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  other_charges DECIMAL(12,2) NOT NULL DEFAULT 0.00,

  discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,

  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  change_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,

  payment_status ENUM(
    'Paid',
    'Unpaid',
    'Partial',
    'Cancelled'
  ) NOT NULL DEFAULT 'Unpaid',

  payment_date DATETIME NULL,

  created_by BIGINT UNSIGNED NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uk_billings_receipt_number (
    receipt_number
  ),

  UNIQUE KEY uk_billings_case (
    consultation_case_id
  ),

  INDEX idx_billings_status (
    payment_status
  ),

  INDEX idx_billings_payment_date (
    payment_date
  ),

  CONSTRAINT fk_billings_case
    FOREIGN KEY (consultation_case_id)
    REFERENCES consultation_cases(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_billings_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

-- =========================================================
-- PAYMENTS
-- =========================================================

CREATE TABLE payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  billing_id BIGINT UNSIGNED NOT NULL,

  amount DECIMAL(12,2) NOT NULL,

  payment_method ENUM(
    'Cash'
  ) NOT NULL DEFAULT 'Cash',

  reference_number VARCHAR(100) NULL,

  received_by BIGINT UNSIGNED NULL,
  paid_at DATETIME NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  INDEX idx_payments_billing (
    billing_id
  ),

  INDEX idx_payments_paid_at (
    paid_at
  ),

  CONSTRAINT chk_payments_positive_amount
    CHECK (amount > 0),

  CONSTRAINT fk_payments_billing
    FOREIGN KEY (billing_id)
    REFERENCES billings(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_payments_received_by
    FOREIGN KEY (received_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

-- =========================================================
-- BACKUP LOGS
-- =========================================================

CREATE TABLE backup_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,

  backup_type ENUM(
    'Manual',
    'Automatic'
  ) NOT NULL DEFAULT 'Manual',

  created_by BIGINT UNSIGNED NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  INDEX idx_backup_logs_created_at (
    created_at
  ),

  CONSTRAINT fk_backup_logs_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);


-- =========================================================
-- preNATAL RECORDS
-- =========================================================
CREATE TABLE prenatal_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    consultation_case_id BIGINT UNSIGNED NOT NULL,
    patient_id BIGINT UNSIGNED NOT NULL,
    doctor_id BIGINT UNSIGNED NOT NULL,

    visit_date DATETIME NOT NULL,

    lmp_date DATE,
    estimated_delivery_date DATE,

    gestational_weeks INT,
    gestational_days INT,

    gravida INT,
    para INT,
    abortion_count INT,
    living_children INT,

    blood_pressure VARCHAR(20),
    temperature_c DECIMAL(4,1),
    weight_kg DECIMAL(6,2),
    height_cm DECIMAL(6,2),

    fundal_height_cm DECIMAL(5,2),
    fetal_heart_rate INT,
    fetal_movement VARCHAR(50),
    fetal_presentation VARCHAR(50),

    edema VARCHAR(50),

    risk_level ENUM(
        'Low Risk',
        'Moderate Risk',
        'High Risk'
    ) NOT NULL,

    risk_reasons TEXT,

    assessment TEXT,
    treatment TEXT,
    notes TEXT,

    next_visit_date DATE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_prenatal_patient (patient_id),
    INDEX idx_prenatal_case (consultation_case_id),

    CONSTRAINT fk_prenatal_case
        FOREIGN KEY (consultation_case_id)
        REFERENCES consultation_cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_prenatal_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_prenatal_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
);