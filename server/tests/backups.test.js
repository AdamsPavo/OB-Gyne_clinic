const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const Database = require('better-sqlite3');
const {createBackupService} = require('../services/backups');
function fixture() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'obgyn-backup-test-'));
  const filename=require.resolve('../database/database');
  const source=fs.readFileSync(filename,'utf8').replace('new Database(databasePath)',`new Database(${JSON.stringify(path.join(directory,'live.db'))})`).replace(/console.log\(`Added missing column:[^;]+;/,'');
  const mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;mod._compile(source,filename);
  const db=mod.exports;
  db.prepare("INSERT INTO users (id,fullname,full_name,username,password,password_hash,role,is_active) VALUES(1,'Admin','Admin','admin','test-hash','test-hash','admin',1)").run();
  const backupDirectory=path.join(directory,'backups');
  return {db,mod,filename,directory,backupDirectory,basePatients:db.prepare('SELECT COUNT(*) n FROM patients').get().n,service:createBackupService(db,backupDirectory),cleanup(){
    db.close();
    if(path.dirname(directory)!==os.tmpdir() || !path.basename(directory).startsWith('obgyn-backup-test-'))throw new Error('Unexpected test directory.');
    fs.rmSync(directory,{recursive:true,force:true});
  }};
}
const addPatient=(db,id,name)=>db.prepare('INSERT INTO patients(id,patient_number,first_name,last_name) VALUES(?,?,?,?)').run(id,`P-${id}`,name,'Test');

test('SQLite snapshots include WAL data; restoration keeps a recovery copy and resets sessions',async()=>{
  const f=fixture();
  try {
    addPatient(f.db,1,'Original');
    const tableNames=f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'app_runtime_state' ORDER BY name").all().map(row=>row.name);
    const readTables=()=>Object.fromEntries(tableNames.map(name=>[name,f.db.prepare(`SELECT * FROM "${name}"`).all()]));
    const originalTables=readTables();
    const backup=await f.service.create();
    assert.ok(backup.size>0);
    assert.equal(f.service.inspect(backup.name).patients,f.basePatients+1);
    const source=new Database(f.service.download(backup.name),{readonly:true});
    assert.equal(source.prepare('SELECT first_name FROM patients WHERE id=1').get().first_name,'Original');source.close();
    addPatient(f.db,2,'Recent');
    f.db.prepare("UPDATE patients SET first_name='Changed' WHERE id=1").run();
    const beforeTriggers=f.db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all();
    const result=await f.service.restore(backup.name,1);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM patients').get().n,f.basePatients+1);
    assert.equal(f.db.prepare('SELECT first_name FROM patients WHERE id=1').get().first_name,'Original');
    assert.deepEqual(readTables(),originalTables);
    assert.equal(f.db.pragma('foreign_keys',{simple:true}),1);
    assert.deepEqual(f.db.pragma('foreign_key_check'),[]);
    assert.deepEqual(f.db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all(),beforeTriggers);
    assert.notEqual(f.db.prepare('SELECT session_version FROM app_runtime_state').get().session_version,'0');
    const recovery=new Database(f.service.download(result.recovery),{readonly:true});
    assert.equal(recovery.prepare('SELECT COUNT(*) n FROM patients').get().n,f.basePatients+2);recovery.close();
    assert.equal(f.service.list().length,2);
    addPatient(f.db,3,'After restore');
    assert.equal(f.db.prepare('SELECT first_name FROM patients WHERE id=3').get().first_name,'After restore');
  } finally {f.cleanup();}
});

test('invalid files and paths are rejected; valid imports can be listed and deleted',async()=>{
  const f=fixture();
  try {
    const backup=await f.service.create();
    await assert.rejects(f.service.import(Buffer.from('not sqlite')),{status:422});
    assert.equal(f.service.list().length,1);
    assert.throws(()=>f.service.download('../live.db'),{status:400});
    assert.throws(()=>f.service.download('missing.db'),{status:404});
    const imported=await f.service.import(fs.readFileSync(f.service.download(backup.name)));
    assert.ok(imported.name.startsWith('imported-'));
    await f.service.remove(imported.name);
    assert.equal(f.service.list().length,1);
    const invalid=path.join(f.backupDirectory,'no-admin.db');fs.copyFileSync(f.service.download(backup.name),invalid);
    const source=new Database(invalid);source.prepare("UPDATE users SET role='doctor'").run();source.close();
    await assert.rejects(f.service.restore('no-admin.db',1),/active Admin/);
    assert.equal(f.db.prepare('SELECT role FROM users WHERE id=1').get().role,'admin');
  }finally{f.cleanup();}
});

test('a mid-restore failure rolls back all changes and restores triggers and foreign-key enforcement',async()=>{
  const f=fixture();
  try {
    addPatient(f.db,1,'Snapshot');const backup=await f.service.create();addPatient(f.db,2,'Must survive');
    const triggerCount=f.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='trigger'").get().n;
    const proxy=new Proxy(f.db,{get(target,key){if(key==='exec')return sql=>{if(sql.startsWith('INSERT INTO main."patients"'))throw new Error('Simulated write failure');return target.exec(sql);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
    await assert.rejects(createBackupService(proxy,f.backupDirectory).restore(backup.name,1),/existing database was retained/);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM patients').get().n,f.basePatients+2);
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='trigger'").get().n,triggerCount);
    assert.equal(f.db.pragma('foreign_keys',{simple:true}),1);
    assert.equal(f.db.pragma('database_list').some(row=>row.name==='restore_source'),false);
    assert.equal(f.db.prepare('SELECT session_version FROM app_runtime_state').get().session_version,'0');
    assert.ok(f.service.list().some(backup=>backup.recovery));
  }finally{f.cleanup();}
});

test('backup HTTP endpoints enforce Admin access, confirmation, maintenance, downloads, and session revocation',async()=>{
  const f=fixture();const original=require.cache[f.filename];require.cache[f.filename]=f.mod;
  const deps=['../middleware/auth','../routes/auth'];for(const dep of deps)delete require.cache[require.resolve(dep)];
  let server;
  try {
    const express=require('express'),jwt=require('jsonwebtoken'),bcrypt=require('bcrypt');
    const hash=await bcrypt.hash('backup-password',4);
    f.db.prepare('UPDATE users SET password=?,password_hash=? WHERE id=1').run(hash,hash);
    f.db.prepare("INSERT INTO users (id,fullname,full_name,username,password,password_hash,role,permissions) VALUES(2,'Doctor','Doctor','doctor',?,?,'doctor',?)").run(hash,hash,JSON.stringify({backups:['view','create','edit','delete']}));
    const {requireAuth,JWT_SECRET}=require('../middleware/auth');
    const maintenance=require('../services/maintenance');
    const app=express();app.use('/api',maintenance.middleware);app.use(express.json());
    let pendingResponse,started;const pendingStarted=new Promise(resolve=>{started=resolve;});
    app.get('/api/slow-test',(req,res)=>{pendingResponse=res;started();});
    app.use('/api/auth',require('../routes/auth'));
    app.use('/api',requireAuth,require('../routes/backups')(f.db,f.backupDirectory));
    server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
    const base=`http://127.0.0.1:${server.address().port}/api`;
    const tokens={1:jwt.sign({id:1},JWT_SECRET),2:jwt.sign({id:2},JWT_SECRET)};
    const raw=(id,url,method='GET',body)=>fetch(base+url,{method,headers:{...(id?{Authorization:`Bearer ${tokens[id]}`} : {}),'Content-Type':Buffer.isBuffer(body)?'application/octet-stream':'application/json'},...(body===undefined?{}:{body:Buffer.isBuffer(body)?body:JSON.stringify(body)})});
    const call=async(...args)=>{const res=await raw(...args);return {status:res.status,body:res.status===204?null:await res.json()};};
    assert.equal((await call(null,'/backups')).status,401);
    maintenance.beginRestore();
    assert.equal((await call(1,'/auth/profile')).status,503);
    maintenance.endRestore();
    const created=await call(1,'/backups','POST');assert.equal(created.status,201);
    const name=created.body.name,url=`/backups/${name}`;
    assert.equal((await call(2,url+'/download')).status,403);
    assert.equal((await call(2,url+'/restore','POST',{confirmation:name})).status,403);
    assert.equal((await call(2,url,'DELETE')).status,403);
    assert.equal((await call(1,url+'/restore','POST',{confirmation:'wrong'})).status,400);
    assert.equal((await call(1,url+'/preview')).body.users,2);
    const downloaded=await raw(1,url+'/download');assert.match(downloaded.headers.get('content-disposition'),/attachment/);
    const bytes=Buffer.from(await downloaded.arrayBuffer());assert.equal(bytes.subarray(0,15).toString(),'SQLite format 3');
    assert.equal((await call(1,'/backups/import','POST',bytes)).status,201);
    const pending=raw(1,'/slow-test');await pendingStarted;
    assert.equal((await call(1,url+'/restore','POST',{confirmation:name})).status,409);
    pendingResponse.json({done:true});await pending;
    const restored=await call(1,url+'/restore','POST',{confirmation:name});assert.equal(restored.status,200,JSON.stringify(restored.body));
    assert.ok(restored.body.recovery.startsWith('before-restore-'));
    assert.equal((await call(1,'/auth/profile')).status,401);
    const login=await call(null,'/auth/login','POST',{username:'admin',password:'backup-password'});assert.equal(login.status,200);
    tokens[1]=login.body.token;assert.equal((await call(1,'/auth/profile')).status,200);
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    require('../services/maintenance').endRestore();
    if(original)require.cache[f.filename]=original;else delete require.cache[f.filename];
    for(const dep of deps)delete require.cache[require.resolve(dep)];
    f.cleanup();
  }
});
