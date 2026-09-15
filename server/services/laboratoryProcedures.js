const defaults = require('./laboratoryProcedureDefaults');

function initializeLaboratoryProcedures(db) {
  db.transaction(() => {
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='laboratory_procedures'").get()) return;
    db.exec(`CREATE TABLE laboratory_procedures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      category TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
    )`);
    const insert = db.prepare('INSERT INTO laboratory_procedures(name,category) VALUES(?,?)');
    for (const group of defaults) for (const name of group.tests) insert.run(name, group.category);
  })();
}

module.exports = { initializeLaboratoryProcedures };
