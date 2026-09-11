function initializeBillingHistory(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS billing_audit (
    id INTEGER PRIMARY KEY, invoice_id INTEGER NOT NULL, table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL, action TEXT NOT NULL, old_record TEXT, new_record TEXT,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ); CREATE INDEX IF NOT EXISTS idx_billing_audit_invoice ON billing_audit(invoice_id,id);`);
  for (const table of ['invoices', 'invoice_items', 'payments', 'billing_adjustments', 'patient_charges']) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
    const json = prefix => `json_object(${columns.map(column => `'${column}',${prefix}."${column}"`).join(',')})`;
    const invoiceId = prefix => `${prefix}.${table === 'invoices' ? 'id' : 'invoice_id'}`;
    db.exec(`DROP TRIGGER IF EXISTS audit_${table}_insert; DROP TRIGGER IF EXISTS audit_${table}_update;
      CREATE TRIGGER IF NOT EXISTS retain_${table} BEFORE DELETE ON ${table}
      BEGIN SELECT RAISE(ABORT,'Billing records are permanent. Use an adjustment or archive instead.'); END;
      CREATE TRIGGER IF NOT EXISTS audit_${table}_insert AFTER INSERT ON ${table} BEGIN
        INSERT INTO billing_audit(invoice_id,table_name,record_id,action,new_record)
        VALUES (${invoiceId('NEW')},'${table}',NEW.id,'Created',${json('NEW')}); END;
      CREATE TRIGGER IF NOT EXISTS audit_${table}_update AFTER UPDATE ON ${table} BEGIN
        INSERT INTO billing_audit(invoice_id,table_name,record_id,action,old_record,new_record)
        VALUES (${invoiceId('OLD')},'${table}',OLD.id,'Updated',${json('OLD')},${json('NEW')}); END;`);
    db.exec(`INSERT INTO billing_audit(invoice_id,table_name,record_id,action,new_record)
      SELECT ${invoiceId('existing')},'${table}',existing.id,'Existing record',${json('existing')}
      FROM ${table} existing WHERE NOT EXISTS (SELECT 1 FROM billing_audit audit
        WHERE audit.table_name='${table}' AND audit.record_id=existing.id);`);
  }
  db.exec(`CREATE TRIGGER IF NOT EXISTS retain_billing_audit BEFORE DELETE ON billing_audit
    BEGIN SELECT RAISE(ABORT,'Billing audit history cannot be deleted.'); END;
    CREATE TRIGGER IF NOT EXISTS preserve_billing_audit BEFORE UPDATE ON billing_audit
    BEGIN SELECT RAISE(ABORT,'Billing audit history cannot be changed.'); END;`);
}
module.exports = { initializeBillingHistory };
