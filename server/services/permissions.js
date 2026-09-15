const { legacyPermissions, permissionsFor, canRequest, hasPermission } = require('../../shared/permissions.mjs');
function migratePermissions(db) {
  if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'permissions')) db.exec('ALTER TABLE users ADD COLUMN permissions TEXT');
  db.transaction(() => {
    const update = db.prepare('UPDATE users SET permissions=? WHERE id=?');
    for (const user of db.prepare('SELECT id, role FROM users WHERE permissions IS NULL').all()) update.run(JSON.stringify(legacyPermissions(user.role)), user.id);
  })();
  // Apply the requested staff document access once; later administrator changes persist.
  db.exec('CREATE TABLE IF NOT EXISTS permission_migrations (name TEXT PRIMARY KEY)');
  db.transaction(() => {
    const name = 'staff-consultation-print-v1';
    if (db.prepare('SELECT 1 FROM permission_migrations WHERE name=?').get(name)) return;
    const update = db.prepare('UPDATE users SET permissions=? WHERE id=?');
    for (const user of db.prepare("SELECT id, role, permissions FROM users WHERE role='staff'").all()) {
      if (!hasPermission(user, 'appointments')) continue;
      const grants = permissionsFor(user);
      for (const module of ['consultations','prenatal','prescriptions','laboratory','billing']) {
        grants[module] = [...new Set([...grants[module], 'view', 'print'])];
      }
      update.run(JSON.stringify(grants), user.id);
    }
    db.prepare('INSERT INTO permission_migrations(name) VALUES(?)').run(name);
  })();
  // Older account-creation integrations also receive persisted legacy defaults.
  const defaults = role => JSON.stringify(legacyPermissions(role)).replaceAll("'", "''");
  db.exec(`DROP TRIGGER IF EXISTS users_permission_defaults; CREATE TRIGGER users_permission_defaults AFTER INSERT ON users WHEN NEW.permissions IS NULL BEGIN
    UPDATE users SET permissions=CASE NEW.role WHEN 'admin' THEN '${defaults('admin')}' WHEN 'doctor' THEN '${defaults('doctor')}' ELSE '${defaults('staff')}' END WHERE id=NEW.id;
  END;`);
}
const publicUser = user => {
  if (!user) return null;
  const { password, password_hash, ...safe } = user;
  return {...safe, permissions:permissionsFor(user)};
};
function permissionGuard(req,res,next) {
  const requestPath = req.path.replace(/\/+$/, '') || '/';
  if (!canRequest(req.user, requestPath, req.method, req.body)) return res.status(403).json({message:'You do not have permission to perform this action.'});
  if (req.method === 'GET') {
    const json = res.json.bind(res);
    const pick = (record, keys) => Object.fromEntries(keys.filter(k => k in record).map(k => [k,record[k]]));
    res.json = data => {
      if (res.statusCode >= 400) return json(data);
      if (requestPath === '/patients' && !hasPermission(req.user,'patients') && Array.isArray(data)) data = data.map(row => pick(row,['id','patient_number','first_name','middle_name','last_name']));
      if (/^\/patients\/[^/]+\/cases$/.test(requestPath) && !hasPermission(req.user,'consultations') && Array.isArray(data)) data = data.map(row => pick(row,['id','case_number','patient_id','consultation_date','display_service_type','service_type']));
      if (requestPath === '/inventory/overview' && !hasPermission(req.user,'inventory')) data = { items: (data.items || []).map(row => pick(row,['id','item_name','item_code','generic_name','brand','category','unit_of_measurement','current_stock','selling_price','is_archived'])) };
      if (requestPath === '/tools/overview' && !hasPermission(req.user,'tools')) data = { settings: data.settings, serviceTypes:[], chargeTypes:[], medicines:[] };
      if (requestPath === '/tools/overview' && !hasPermission(req.user,'settings')) data = {...data, settings:null};
      if (/^\/cases\/[^/]+$/.test(requestPath)) {
        data = {...data};
        for (const [module,key,empty] of [['prescriptions','prescriptions',[]],['laboratory','laboratory_requests',[]],['prenatal','prenatal_record',null],['billing','invoice',null]]) if (!hasPermission(req.user,module)) data[key] = empty;
        if (!hasPermission(req.user,'laboratory')) data.lab_results = '';
      }
      if (requestPath === '/dashboard') {
        data = {...data};
        for (const [module,keys] of [['patients',['totalPatients','recentPatients']],['consultations',['consultationsToday','followUps']],['laboratory',['pendingLabs']],['billing',['incomeToday']],['inventory',['inventory']]]) {
          if (!hasPermission(req.user,module)) keys.forEach(key => { delete data[key]; });
        }
      }
      return json(data);
    };
  }
  next();
}
module.exports = { migratePermissions, publicUser, permissionGuard, hasPermission, permissionsFor };
