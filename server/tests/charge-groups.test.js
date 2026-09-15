const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { initializeChargeGroups } = require('../services/chargeGroups');

test('group migration retains existing charges, references, indexes and audit triggers', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys=ON');
  db.exec(`CREATE TABLE patient_charges(id INTEGER PRIMARY KEY, charge_number TEXT UNIQUE NOT NULL, notes TEXT);
    CREATE TABLE linked(id INTEGER PRIMARY KEY, charge_id INTEGER REFERENCES patient_charges(id));
    CREATE TABLE audit(charge_id INTEGER);
    CREATE INDEX charge_notes ON patient_charges(notes);
    INSERT INTO patient_charges VALUES(7,'CHG-000007','Original');
    INSERT INTO linked VALUES(1,7);
    CREATE TRIGGER track_charge AFTER INSERT ON patient_charges BEGIN INSERT INTO audit VALUES(NEW.id); END;`);
  try {
    initializeChargeGroups(db);
    initializeChargeGroups(db);
    assert.equal(db.pragma('foreign_keys',{simple:true}),1);
    assert.deepEqual(db.pragma('foreign_key_check'),[]);
    assert.deepEqual(db.prepare('SELECT * FROM patient_charges WHERE id=7').get(),{id:7,charge_number:'CHG-000007',notes:'Original'});
    db.prepare('INSERT INTO patient_charges VALUES(8,?,?)').run('CHG-000007','Second item');
    assert.equal(db.prepare('SELECT charge_id FROM audit').get().charge_id,8);
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name='charge_notes'").get());
    assert.equal(db.prepare('SELECT charge_id FROM linked').get().charge_id,7);
  } finally { db.close(); }
});
