const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const express = require('express');
const { initializeLaboratoryProcedures } = require('../services/laboratoryProcedures');
const { permissionGuard } = require('../services/permissions');

test('laboratory catalog persists additions, validates duplicates and restricts management', async () => {
  const db = new Database(':memory:');
  initializeLaboratoryProcedures(db);
  const initial = db.prepare('SELECT COUNT(*) count FROM laboratory_procedures').get().count;
  assert.equal(initial, 34);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = req.headers['x-reader'] ? { role: 'staff', permissions: { laboratory: ['view', 'create'] } } : { role: 'admin' };
    next();
  });
  app.use(permissionGuard);
  app.use(require('../routes/laboratoryProcedures')(db));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = (path, method = 'GET', body, reader = false) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(reader ? { 'x-reader': '1' } : {}) }, body: body && JSON.stringify(body),
  });
  try {
    const path = '/tools/laboratory-procedures';
    const procedure = { name: 'Custom Procedure', category: 'Custom Category', is_active: true };
    assert.equal((await request(path, 'POST', procedure, true)).status, 403);
    assert.equal((await request(path, 'POST', { name: ' ' })).status, 400);
    assert.equal((await request(path, 'POST', procedure)).status, 201);
    assert.equal((await request(path, 'POST', { ...procedure, name: 'custom procedure' })).status, 409);
    let rows = await (await request('/laboratory-procedures', 'GET', undefined, true)).json();
    const added = rows.find(row => row.name === procedure.name);
    assert.equal(added.category, procedure.category);
    assert.equal((await request(`${path}/${added.id}`, 'PUT', { ...procedure, is_active: false })).status, 200);
    initializeLaboratoryProcedures(db);
    rows = await (await request('/laboratory-procedures')).json();
    assert.ok(!rows.some(row => row.id === added.id));
    assert.equal(db.prepare('SELECT COUNT(*) count FROM laboratory_procedures').get().count, initial + 1);
    assert.equal((await request(`${path}/999999`, 'PUT', procedure)).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});
