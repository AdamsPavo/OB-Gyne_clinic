// A charge number identifies a submission; each row remains an individual item.
function initializeChargeGroups(db) {
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='patient_charges'").get()?.sql;
  if (!schema || !/charge_number TEXT UNIQUE NOT NULL/i.test(schema)) return;
  const foreignKeys = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='patient_charges' AND sql IS NOT NULL").all();
      const triggers = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name='patient_charges'").all();
      const quote = name => `"${name.replaceAll('"', '""')}"`;
      for (const trigger of triggers) db.exec(`DROP TRIGGER ${quote(trigger.name)}`);
      db.exec(schema.replace(/CREATE TABLE\s+"?patient_charges"?/i, 'CREATE TABLE patient_charges_grouped')
        .replace(/charge_number TEXT UNIQUE NOT NULL/i, 'charge_number TEXT NOT NULL'));
      db.exec('INSERT INTO patient_charges_grouped SELECT * FROM patient_charges; DROP TABLE patient_charges; ALTER TABLE patient_charges_grouped RENAME TO patient_charges;');
      for (const index of indexes) db.exec(index.sql);
      for (const trigger of triggers) db.exec(trigger.sql);
      db.exec('CREATE INDEX IF NOT EXISTS idx_patient_charge_number ON patient_charges(charge_number)');
      if (db.pragma('foreign_key_check').length) throw new Error('Charge grouping migration found invalid references.');
    })();
  } finally { db.pragma(`foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`); }
}

function groupCharges(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.invoice_id}:${row.patient_id}:${row.charge_number}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].map(items => {
    items.sort((a,b) => a.id-b.id);
    const first = items[0];
    return { ...first, items,
      charge_name: items.length === 1 ? first.charge_name : `${items.length} items`,
      category: items.length === 1 ? first.category : 'Multiple items',
      inventory_item_id: items.find(item => item.inventory_item_id)?.inventory_item_id || null,
      quantity: items.reduce((sum,item) => sum+Number(item.quantity),0),
      total_amount: items.reduce((sum,item) => sum+Math.round(Number(item.total_amount)*100),0)/100,
      status: items.every(item => item.status === 'Deleted') ? 'Deleted' : 'Billed',
    };
  });
}
module.exports = { initializeChargeGroups, groupCharges };
