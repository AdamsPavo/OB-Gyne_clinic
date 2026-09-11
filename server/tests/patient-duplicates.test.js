const { test } = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

test("patient registration checks normalized full name and birthdate, including archived records", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE patients (id INTEGER PRIMARY KEY, patient_number TEXT UNIQUE,
    first_name TEXT, middle_name TEXT, last_name TEXT, birth_date TEXT, is_archived INTEGER DEFAULT 0);
    INSERT INTO patients VALUES (1, 'P-000001', 'Ana  Maria', 'Cruz', 'Santos', '1990-01-01', 0);
    INSERT INTO patients VALUES (2, 'P-000002', 'Bea', NULL, 'Reyes', '1991-02-02', 1);`);
  const databaseModule = require.resolve("../database/database");
  const original = require.cache[databaseModule];
  require.cache[databaseModule] = { id: databaseModule, filename: databaseModule, loaded: true, exports: db };
  try {
    const router = require("../routes/clinic");
    const handler = router.stack.find((layer) => layer.route?.path === "/patients" && layer.route.methods.post).route.stack[0].handle;
    const register = (body) => {
      const response = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
      handler({ body }, response);
      return response;
    };
    const patient = { first_name: " ana maria ", middle_name: "CRUZ", last_name: "santos", birth_date: "1990-01-01" };
    assert.equal(register(patient).code, 409);
    assert.equal(register(patient).body.patient_id, 1);
    assert.equal(register({ first_name: "BEA", middle_name: " ", last_name: "reyes", birth_date: "1991-02-02" }).code, 409);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM patients").get().count, 2);
    assert.equal(register({ ...patient, birth_date: "1990-01-02" }).code, 201);
    assert.equal(register({ ...patient, middle_name: "Lopez" }).code, 201);
    assert.equal(register({ ...patient, first_name: "  " }).code, 400);
    assert.equal(register({ ...patient, first_name: 123 }).code, 400);
    assert.equal(register({ first_name: "Celia", last_name: "Reyes", birth_date: "1992-03-03" }).code, 201);
    assert.equal(register({ first_name: "celia", middle_name: "", last_name: "reyes", birth_date: "1992-03-03" }).code, 409);
  } finally {
    if (original) require.cache[databaseModule] = original;
    else delete require.cache[databaseModule];
    delete require.cache[require.resolve("../routes/clinic")];
    db.close();
  }
});
