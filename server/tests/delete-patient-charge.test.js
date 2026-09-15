const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { deletePatientCharge } = require('../services/deletePatientCharge');
const { canRequest } = require('../../shared/permissions.mjs');

test('charge cancellation requires a reason, updates the linked bill once, and retains history', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE patient_charges(id INTEGER PRIMARY KEY,invoice_id INTEGER,status TEXT,notes TEXT,charge_number TEXT,patient_id INTEGER);
    CREATE TABLE invoices(id INTEGER PRIMARY KEY,billing_status TEXT,total_amount REAL);
    CREATE TABLE invoice_items(id INTEGER PRIMARY KEY,invoice_id INTEGER,source_type TEXT,source_id INTEGER,is_void INTEGER,remarks TEXT,final_amount_cents INTEGER);
    INSERT INTO invoices VALUES(1,'Draft',250),(2,'Finalized',150);
    INSERT INTO patient_charges VALUES(1,1,'Billed','Original note','CHG-1',1),(2,2,'Billed',NULL,'CHG-2',1);
    INSERT INTO invoice_items VALUES(1,1,'manual_charge',1,0,NULL,15000),(2,1,'consultation_service',1,0,NULL,10000),(3,2,'manual_charge',2,0,NULL,15000);`);
  const actor = { id: 7, username: 'cashier' };
  const recalculate = id => {
    const total = db.prepare('SELECT SUM(final_amount_cents)/100.0 total FROM invoice_items WHERE invoice_id=? AND is_void=0').get(id).total || 0;
    db.prepare('UPDATE invoices SET total_amount=? WHERE id=?').run(total,id);
    return db.prepare('SELECT * FROM invoices WHERE id=?').get(id);
  };
  try {
    for (const reason of [undefined, '', '   ', 'a'.repeat(1001)])
      assert.throws(() => deletePatientCharge(db,1,reason,actor,recalculate), { status: 400 });
    assert.throws(() => deletePatientCharge(db,2,'Duplicate',actor,recalculate), { status: 409 });
    assert.throws(() => deletePatientCharge(db,999,'Duplicate',actor,recalculate), { status: 404 });
    assert.throws(() => deletePatientCharge(db,1,'Duplicate',actor,() => { throw new Error('Failure'); }));
    assert.equal(db.prepare('SELECT status FROM patient_charges WHERE id=1').get().status, 'Billed');
    assert.equal(db.prepare('SELECT is_void FROM invoice_items WHERE id=1').get().is_void, 0);
    assert.equal(deletePatientCharge(db,1,'Duplicate charge',actor,recalculate).total_amount, 100);
    const charge = db.prepare('SELECT * FROM patient_charges WHERE id=1').get();
    assert.equal(charge.status, 'Deleted');
    assert.match(charge.notes, /Original note\nCancelled by cashier \(ID 7\) at .*: Duplicate charge/);
    assert.equal(db.prepare('SELECT is_void FROM invoice_items WHERE id=2').get().is_void, 0);
    assert.throws(() => deletePatientCharge(db,1,'Again',actor,recalculate), { status: 409 });
    assert.equal(canRequest({role:'staff',permissions:{charges:['view','create']}},'/patient-charges/1','DELETE'), false);
    assert.equal(canRequest({role:'staff',permissions:{charges:['view','delete']}},'/patient-charges/1','DELETE'), true);
  } finally { db.close(); }
});
