const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { modules, fullPermissions, normalizePermissions, permissionsFor, hasPermission, canRequest, canVisit } = require('../../shared/permissions.mjs');
const { migratePermissions } = require('../services/permissions');

test('permission rules preserve explicit denials, action levels, and Admin invariants', () => {
  const admin = {role:'admin', permissions:{}};
  for (const module of modules) for (const action of module.actions) assert.ok(hasPermission(admin,module.id,action));
  const viewer = {role:'doctor', permissions:{patients:['view'], billing:['view','print'], appointments:['view']}};
  assert.ok(canVisit(viewer,'/patients/23'));
  assert.equal(canVisit(viewer,'/consultations/new'),false);
  assert.equal(canRequest(viewer,'/patients/23','DELETE'),false);
  assert.equal(canRequest(viewer,'/patients/23/archive','PATCH'),false);
  assert.equal(canRequest(viewer,'/invoices/1/payments','POST',{}),false);
  assert.equal(canRequest(viewer,'/invoices/1','PUT',{payment_status:'Paid'}),false);
  assert.equal(canRequest(viewer,'/unknown','GET'),false);
  assert.equal(canRequest({role:'staff',permissions:{laboratory:['view','edit']}},'/consultations/1','DELETE',{lab_results:''}),false);
  assert.equal(canRequest({role:'staff',permissions:{laboratory:['view','edit']}},'/cases/1','PATCH',{lab_results:''}),true);
  assert.equal(hasPermission({role:'doctor',permissions:{}},'patients'),false);
  assert.equal(hasPermission({role:'doctor',permissions:'invalid'},'patients'),false);
  assert.deepEqual(normalizePermissions({patients:['delete','unknown']} ).patients,['view','delete']);
});

test('additive migration persists defaults once and does not overwrite per-user grants', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  try {
    db.exec("CREATE TABLE users(id INTEGER PRIMARY KEY,role TEXT); INSERT INTO users VALUES(1,'doctor'),(2,'staff'),(3,'admin')");
    migratePermissions(db);
    assert.ok(hasPermission(db.prepare('SELECT * FROM users WHERE id=1').get(),'consultations','create'));
    assert.equal(hasPermission(db.prepare('SELECT * FROM users WHERE id=2').get(),'patients','delete'),false);
    db.prepare("UPDATE users SET permissions='{}' WHERE id=1").run();
    migratePermissions(db);
    assert.deepEqual(permissionsFor(db.prepare('SELECT * FROM users WHERE id=1').get()), Object.fromEntries(modules.map(m=>[m.id,[]])));
    db.exec("INSERT INTO users(id,role) VALUES(4,'staff')");
    assert.ok(JSON.parse(db.prepare('SELECT permissions FROM users WHERE id=4').get().permissions).patients.includes('view'));
  } finally { db.close(); }
});

test('HTTP authorization enforces stored grants, denies privilege escalation, and refreshes sessions', async () => {
  const filename = require.resolve('../database/database');
  const source = fs.readFileSync(filename,'utf8').replace('new Database(databasePath)','new Database(":memory:")').replace(/console.log\(`Added missing column:[^;]+;/,'');
  const mod = new Module(filename,module); mod.filename=filename; mod.paths=module.paths; mod._compile(source,filename);
  const db = mod.exports;
  const original = require.cache[filename]; require.cache[filename] = mod;
  const dependencies = ['../middleware/auth','../routes/auth','../routes/users','../routes/clinic'];
  for (const dep of dependencies) delete require.cache[require.resolve(dep)];
  let server;
  try {
    const hash = await bcrypt.hash('testing-password',4);
    const insert = db.prepare('INSERT INTO users(id,fullname,full_name,username,password,password_hash,role,permissions) VALUES(?,?,?,?,?,?,?,?)');
    insert.run(1,'Admin','Admin','admin',hash,hash,'admin','{}');
    insert.run(2,'Viewer','Viewer','viewer',hash,hash,'doctor',JSON.stringify({patients:['view'],users:['view','edit'],billing:['view','print'],appointments:['view']}));
    insert.run(3,'Scheduler','Scheduler','scheduler',hash,hash,'staff',JSON.stringify({appointments:['view','create']}));
    insert.run(4,'No access','No access','noaccess',hash,hash,'staff','{}');
    db.exec("INSERT INTO patients (id,patient_number,first_name,last_name,allergies) VALUES (10,'P-PERM','Permission','Patient','Sensitive clinical detail')");
    const app = express(); app.use(express.json());
    const {requireAuth, JWT_SECRET} = require('../middleware/auth');
    app.use('/api/auth',require('../routes/auth'));
    app.use('/api/users',require('../routes/users'));
    app.use('/api',requireAuth,require('../routes/clinic'));
    server = await new Promise(resolve => { const instance=app.listen(0,'127.0.0.1',()=>resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const tokens = Object.fromEntries([1,2,3,4].map(id=>[id,jwt.sign({id,role:'admin'},JWT_SECRET)])); // Claimed JWT role is deliberately forged; DB role must win.
    const request = async (id,path,method='GET',body) => {
      const response = await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(id?{Authorization:`Bearer ${tokens[id]}`}:{})},...(body === undefined ? {} : {body:JSON.stringify(body)})});
      return {status:response.status,body:response.status===204?null:await response.json()};
    };
    assert.equal((await request(null,'/patients')).status,401);
    assert.equal((await request(4,'/patients')).status,403);
    assert.equal((await request(2,'/patients/10','DELETE')).status,403);
    assert.equal((await request(2,'/patients/10/archive','PATCH')).status,403);
    assert.equal((await request(2,'/invoices/1/payments','POST',{amount:100})).status,403);
    assert.equal((await request(2,'/invoices/1','PUT',{payment_status:'Paid',paid_amount:100})).status,403);
    assert.equal((await request(2,'/backups','POST')).status,403);
    assert.equal((await request(2,'/cases/1')).status,403);
    const lookups = await request(3,'/patients');
    assert.equal(lookups.status,200); assert.ok(lookups.body.find(p=>p.id===10));
    assert.equal(lookups.body.find(p=>p.id===10).allergies,undefined);
    assert.equal((await request(3,'/patients/')).body.find(p=>p.id===10).allergies,undefined);
    assert.equal((await request(3,'/patients/10')).status,403);
    assert.equal((await request(2,'/users/3','PUT',{full_name:'Scheduler',username:'scheduler',role:'staff',permissions:fullPermissions()})).status,403);
    assert.equal((await request(2,'/users/1/password','PUT',{password:'new-password'})).status,403);
    assert.equal((await request(2,'/auth/register','POST',{fullname:'Backdoor',username:'backdoor',password:'password123'})).status,403);
    assert.equal((await request(2,'/auth/profile','PUT',{fullname:'Viewer',username:'viewer',role:'admin',permissions:fullPermissions()})).status,200);
    assert.equal(db.prepare('SELECT role FROM users WHERE id=2').get().role,'doctor');
    assert.equal((await request(2,'/auth/authorize','POST',{module:'patients',action:'delete'})).status,403);
    assert.equal((await request(2,'/auth/authorize','POST',{module:'billing',action:'print'})).status,200);
    let saved = await request(1,'/users/3','PUT',{full_name:'Scheduler',username:'scheduler',role:'staff',permissions:{patients:['view']}});
    assert.equal(saved.status,200,JSON.stringify(saved.body));
    assert.deepEqual(saved.body.permissions.patients,['view']);
    assert.equal((await request(3,'/appointments')).status,403); // Same token, newly stored permissions.
    const profile = await request(3,'/auth/profile');
    assert.deepEqual(profile.body.permissions.patients,['view']);
    const login = await request(null,'/auth/login','POST',{username:'scheduler',password:'testing-password'});
    assert.equal(login.status,200); assert.deepEqual(login.body.user.permissions.patients,['view']);
    saved = await request(1,'/users/3','PUT',{full_name:'Scheduler',username:'scheduler',role:'staff',permissions:{}});
    assert.equal(saved.status,200); assert.equal((await request(3,'/patients')).status,403);
    assert.ok((await request(1,'/auth/profile')).body.permissions.backups.includes('delete'));
    const created = await request(1,'/users','POST',{full_name:'Custom user',username:'custom',role:'staff',password:'new-password',confirmPassword:'new-password',permissions:{laboratory:['view','create']}});
    assert.equal(created.status,201,JSON.stringify(created.body));
    assert.deepEqual(created.body.permissions.laboratory,['view','create']);
    tokens[created.body.id] = jwt.sign({id:created.body.id},JWT_SECRET);
    assert.equal((await request(created.body.id,'/laboratory-requests')).status,200);
    assert.equal((await request(created.body.id,'/laboratory-requests','POST',{})).status,400);
    assert.equal((await request(created.body.id,'/reports/summary')).status,403);
    assert.equal((await request(1,'/users/3','PUT',{full_name:'Scheduler',username:'scheduler',role:'staff',permissions:{patients:['superuser']}})).status,400);
  } finally {
    if (server) await new Promise(resolve=>server.close(resolve));
    db.close();
    if (original) require.cache[filename]=original; else delete require.cache[filename];
    for (const dep of dependencies) delete require.cache[require.resolve(dep)];
  }
});
