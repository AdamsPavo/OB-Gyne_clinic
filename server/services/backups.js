const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { migratePermissions } = require('./permissions');
const quote = name => `"${name.replaceAll('"','""')}"`;
const fail = (message, status = 422) => { const error = new Error(message); error.status=status; throw error; };
const tables = db => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'app_runtime_state' ORDER BY name").all().map(row=>row.name);
const columns = (db, table) => db.prepare(`PRAGMA table_info(${quote(table)})`).all();

function createBackupService(db, directory) {
  const root = path.resolve(directory);
  let busy = false;
  const ensureDirectory = () => fs.mkdirSync(root,{recursive:true});
  const resolve = name => {
    if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.db$/.test(name) || name.includes('..')) fail('Invalid backup filename.',400);
    const filename = path.resolve(root,name);
    if (path.dirname(filename) !== root) fail('Invalid backup filename.',400);
    if (!fs.existsSync(filename)) fail('Backup file not found.',404);
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('Invalid backup file.',400);
    return filename;
  };
  const metadata = name => {
    const stats = fs.statSync(resolve(name));
    return {name,size:stats.size,createdAt:stats.mtime.toISOString(),recovery:name.startsWith('before-restore-')};
  };
  const inspect = filename => {
    let source;
    try {
      source = new Database(filename,{readonly:true,fileMustExist:true});
      source.pragma('trusted_schema = OFF');
      if (source.pragma('integrity_check',{simple:true}) !== 'ok') fail('The backup failed the SQLite integrity check.');
      if (source.pragma('foreign_key_check').length) fail('The backup contains broken record relationships.');
      const targetTables = tables(db), sourceTables = tables(source);
      if (JSON.stringify(targetTables) !== JSON.stringify(sourceTables)) fail('This backup uses a different database version. Restore a backup made by this version of the clinic application.');
      for (const table of targetTables) {
        const existing = columns(db,table), incoming = columns(source,table);
        const missing = existing.filter(column => !incoming.some(other=>other.name===column.name));
        // Backups made before per-user permissions are migrated to legacy defaults.
        if (missing.some(column => table !== 'users' || column.name !== 'permissions') || incoming.some(column=>!existing.some(other=>other.name===column.name && other.type===column.type && other.pk===column.pk))) fail(`The backup's ${table} structure is not compatible with this application.`);
      }
      if (!source.prepare("SELECT 1 FROM users WHERE role='admin' AND is_active=1 AND length(password_hash)>0 LIMIT 1").get()) fail('The backup must contain an active Admin account so you can sign in after restoring.');
      return {patients:source.prepare('SELECT COUNT(*) count FROM patients').get().count,users:source.prepare('SELECT COUNT(*) count FROM users').get().count,appointments:source.prepare('SELECT COUNT(*) count FROM appointments').get().count,tables:targetTables.length};
    } catch (error) {
      if (error.status) throw error;
      fail('This file is not a valid, compatible clinic SQLite backup.');
    } finally { source?.close(); }
  };
  const snapshot = async prefix => {
    ensureDirectory();
    const name = `${prefix}-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}.db`;
    const filename = path.join(root,name), staging = `${filename}.partial`;
    try {
      await db.backup(staging);
      // SQLite backup() includes committed WAL data; the live DB stays open.
      const check = new Database(staging,{readonly:true,fileMustExist:true});
      try { if (check.pragma('integrity_check',{simple:true}) !== 'ok') fail('The snapshot failed validation.'); } finally { check.close(); }
      fs.renameSync(staging,filename);
      return metadata(name);
    } finally { if (fs.existsSync(staging)) fs.unlinkSync(staging); }
  };
  const exclusive = async work => {
    if (busy) fail('Another backup operation is running. Please wait.',409);
    busy = true;
    try { return await work(); } finally { busy=false; }
  };
  return {
    list() {
      ensureDirectory();
      return fs.readdirSync(root).filter(name=>/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.db$/.test(name) && !name.includes('..')).flatMap(name=>{try{return [metadata(name)];}catch{return [];}}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    },
    create: () => exclusive(()=>snapshot('obgyn')),
    inspect: name => ({...metadata(name),...inspect(resolve(name))}),
    download: resolve,
    import: bytes => exclusive(async () => {
      if (!Buffer.isBuffer(bytes) || !bytes.length) fail('Choose a SQLite .db backup file.',400);
      if (bytes.length > 100 * 1024 * 1024) fail('The upload limit is 100 MB.',413);
      ensureDirectory();
      const name = `imported-${Date.now()}-${randomUUID().slice(0,8)}.db`;
      const staging = path.join(root,`${name}.partial`);
      try {
        fs.writeFileSync(staging,bytes,{flag:'wx'});
        inspect(staging);
        fs.renameSync(staging,path.join(root,name));
        return metadata(name);
      } finally { if (fs.existsSync(staging)) fs.unlinkSync(staging); }
    }),
    remove: name => exclusive(async () => { fs.unlinkSync(resolve(name)); }),
    restore: (name, actor) => exclusive(async () => {
      const filename = resolve(name);
      inspect(filename);
      const recovery = await snapshot('before-restore');
      // Authorization may have changed while SQLite was creating the recovery copy.
      const currentActor = db.prepare('SELECT role,is_active FROM users WHERE id=?').get(actor);
      if (!currentActor?.is_active || currentActor.role !== 'admin') fail('Only an active Admin can restore the database.',403);
      let attached = false;
      try {
        db.prepare('ATTACH DATABASE ? AS restore_source').run(filename); attached=true;
        const targetTables = tables(db);
        const triggers = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND sql IS NOT NULL").all();
        db.pragma('foreign_keys = OFF');
        db.transaction(() => {
          // Existing audit/default triggers must not manufacture history during a restore.
          for (const trigger of triggers) db.exec(`DROP TRIGGER ${quote(trigger.name)}`);
          for (const table of targetTables) db.exec(`DELETE FROM main.${quote(table)}`);
          for (const table of targetTables) {
            const sourceColumns = db.prepare(`PRAGMA restore_source.table_info(${quote(table)})`).all().map(column=>quote(column.name)).join(',');
            db.exec(`INSERT INTO main.${quote(table)} (${sourceColumns}) SELECT ${sourceColumns} FROM restore_source.${quote(table)}`);
          }
          if (db.prepare("SELECT 1 FROM restore_source.sqlite_master WHERE name='sqlite_sequence'").get()) {
            db.exec('DELETE FROM main.sqlite_sequence; INSERT INTO main.sqlite_sequence SELECT * FROM restore_source.sqlite_sequence');
          }
          for (const trigger of triggers) db.exec(trigger.sql);
          migratePermissions(db);
          if (db.pragma('foreign_key_check').length) fail('The restore would create invalid record relationships. No changes were applied.');
          db.prepare('INSERT INTO app_runtime_state(id,session_version) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET session_version=excluded.session_version').run(randomUUID());
        })();
      } catch (error) {
        if (error.status) throw error;
        fail('The restore could not be completed. The existing database was retained.');
      } finally {
        db.pragma('foreign_keys = ON');
        if (attached) db.exec('DETACH DATABASE restore_source');
      }
      return {name,recovery:recovery.name,message:'Database restored successfully. Sign in using an account from the restored backup.'};
    }),
  };
}
module.exports = { createBackupService };
