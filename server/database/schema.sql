-- Target MySQL 8 schema for the Electron production build.
-- The running development server continues to use database.js (SQLite) until MySQL is configured.
CREATE TABLE settings (
  id TINYINT PRIMARY KEY DEFAULT 1,
  clinic_name VARCHAR(150) NOT NULL,
  clinic_address TEXT NOT NULL,
  doctor_name VARCHAR(150) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_number VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100), last_name VARCHAR(100) NOT NULL,
  birth_date DATE, civil_status VARCHAR(30), occupation VARCHAR(120),
  contact_number VARCHAR(30), address TEXT, blood_type VARCHAR(5),
  allergies TEXT, existing_illnesses TEXT, previous_surgeries TEXT,
  family_history TEXT, ob_history TEXT, pregnancy_history TEXT,
  emergency_contact_name VARCHAR(150), emergency_contact_number VARCHAR(30),
  notes TEXT, is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE consultation_cases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_number VARCHAR(20) NOT NULL UNIQUE,
  patient_id BIGINT UNSIGNED NOT NULL, doctor_id BIGINT UNSIGNED NOT NULL,
  consultation_at DATETIME NOT NULL, chief_complaint TEXT, history_present_illness TEXT,
  blood_pressure VARCHAR(20), temperature_c DECIMAL(4,1), weight_kg DECIMAL(5,2), height_cm DECIMAL(5,2),
  treatment TEXT, doctor_notes TEXT, follow_up_date DATE,
  case_status ENUM('Open','Completed','Cancelled') NOT NULL DEFAULT 'Open',
  FOREIGN KEY (patient_id) REFERENCES patients(id), FOREIGN KEY (doctor_id) REFERENCES users(id),
  INDEX idx_case_patient_date (patient_id, consultation_at)
);

CREATE TABLE diagnoses (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, code VARCHAR(20) UNIQUE, diagnosis_name VARCHAR(255) NOT NULL UNIQUE);
CREATE TABLE case_diagnoses (
  consultation_case_id BIGINT UNSIGNED NOT NULL, diagnosis_id BIGINT UNSIGNED NOT NULL, is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (consultation_case_id, diagnosis_id),
  FOREIGN KEY (consultation_case_id) REFERENCES consultation_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (diagnosis_id) REFERENCES diagnoses(id)
);
CREATE TABLE prescriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, prescription_number VARCHAR(20) NOT NULL UNIQUE,
  consultation_case_id BIGINT UNSIGNED NOT NULL, prescription_date DATE NOT NULL, doctor_signature_path VARCHAR(255),
  FOREIGN KEY (consultation_case_id) REFERENCES consultation_cases(id)
);
CREATE TABLE prescription_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, prescription_id BIGINT UNSIGNED NOT NULL, medicine VARCHAR(150) NOT NULL,
  dosage VARCHAR(100), frequency VARCHAR(100), duration VARCHAR(100), instructions TEXT,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
);
CREATE TABLE laboratory_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, request_number VARCHAR(20) NOT NULL UNIQUE,
  consultation_case_id BIGINT UNSIGNED NOT NULL, requested_at DATETIME NOT NULL, remarks TEXT,
  status ENUM('Pending','Completed','Released') NOT NULL DEFAULT 'Pending',
  FOREIGN KEY (consultation_case_id) REFERENCES consultation_cases(id)
);
CREATE TABLE laboratory_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, laboratory_request_id BIGINT UNSIGNED NOT NULL,
  test_name VARCHAR(150) NOT NULL, result_text TEXT, result_file_path VARCHAR(255), released_at DATETIME,
  FOREIGN KEY (laboratory_request_id) REFERENCES laboratory_requests(id) ON DELETE CASCADE
);
CREATE TABLE billings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, receipt_number VARCHAR(30) NOT NULL UNIQUE,
  consultation_case_id BIGINT UNSIGNED NOT NULL UNIQUE, consultation_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  laboratory_charges DECIMAL(12,2) NOT NULL DEFAULT 0, medicine_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0, total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0, change_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status ENUM('Paid','Unpaid','Partial') NOT NULL DEFAULT 'Unpaid', payment_date DATETIME,
  FOREIGN KEY (consultation_case_id) REFERENCES consultation_cases(id)
);
CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, billing_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL, payment_method ENUM('Cash') NOT NULL DEFAULT 'Cash', paid_at DATETIME NOT NULL,
  FOREIGN KEY (billing_id) REFERENCES billings(id)
);
CREATE TABLE backup_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, file_name VARCHAR(255) NOT NULL, file_path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
