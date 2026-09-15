const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { migratePermissions, hasPermission } = require('../services/permissions');

test('staff document grants migrate once without granting clinical edits or changing blocked accounts', () => {
  const db = new Database(':memory:');
  try {
    db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY, role TEXT, permissions TEXT)');
    const insert = db.prepare('INSERT INTO users VALUES(?,?,?)');
    insert.run(1, 'staff', JSON.stringify({appointments:['view']}));
    insert.run(2, 'staff', '{}');
    migratePermissions(db);
    const user = () => db.prepare('SELECT * FROM users WHERE id=1').get();
    for (const module of ['consultations','prenatal','prescriptions','laboratory','billing']) {
      assert.equal(hasPermission(user(), module, 'view'), true);
      assert.equal(hasPermission(user(), module, 'print'), true);
      assert.equal(hasPermission(user(), module, 'edit'), false);
      assert.equal(hasPermission(user(), module, 'create'), false);
    }
    assert.equal(hasPermission(db.prepare('SELECT * FROM users WHERE id=2').get(), 'consultations'), false);
    db.prepare('UPDATE users SET permissions=? WHERE id=1').run(JSON.stringify({appointments:['view']}));
    migratePermissions(db);
    assert.equal(hasPermission(user(), 'consultations'), false);
  } finally { db.close(); }
});
