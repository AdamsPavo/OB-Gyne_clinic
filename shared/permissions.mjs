// Shared by the browser and server. Unknown modules and routes deny access.
const crud = ['view', 'create', 'edit', 'delete', 'print'];
export const modules = [
  ['dashboard', 'Dashboard', '/dashboard', 'Overview', ['view']],
  ['patients', 'Patients', '/patients', 'Clinical', crud],
  ['appointments', 'Appointments', '/appointments', 'Clinical', [...crud, 'complete']],
  ['consultations', 'Consultations', '/consultations', 'Clinical', [...crud, 'complete']],
  ['prenatal', 'Prenatal Records', '/prenatal-records', 'Clinical', [...crud, 'complete']],
  ['prescriptions', 'Prescriptions', '/prescriptions', 'Clinical', [...crud, 'complete']],
  ['laboratory', 'Laboratory Requests', '/laboratory-requests', 'Clinical', [...crud, 'complete']],
  ['billing', 'Billing', '/billing', 'Finance', [...crud, 'complete']],
  ['billingHistory', 'Billing History', '/billing-history', 'Finance', ['view', 'print']],
  ['charges', 'Other Charges', '/patient-charges', 'Finance', crud],
  ['reports', 'Reports', '/reports', 'Finance', ['view', 'print', 'export']],
  ['inventory', 'Inventory', '/inventory', 'Operations', [...crud, 'complete']],
  ['tools', 'Tools', '/tools', 'Operations', crud],
  ['settings', 'Settings', '/settings', 'Administration', ['view', 'edit']],
  ['users', 'User Management', '/users', 'Administration', crud],
  ['backups', 'Backup & Restore', '/backup-restore', 'Administration', ['view', 'create', 'delete', 'export', 'restore']],
].map(([id, label, path, category, actions]) => ({id, label, path, category, actions}));
export const actionLabel = (module, action) => action === 'complete'
  ? ({billing:'Collect payment', prescriptions:'Dispense', prenatal:'Complete pregnancy'}[module] || 'Complete')
  : action.charAt(0).toUpperCase() + action.slice(1);
export const fullPermissions = () => Object.fromEntries(modules.map(m => [m.id, [...m.actions]]));
export function normalizePermissions(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = {}; } }
  return Object.fromEntries(modules.map(m => {
    const actions = value && Array.isArray(value[m.id]) ? value[m.id] : [];
    const valid = m.actions.filter(a => actions.includes(a));
    if (valid.length && !valid.includes('view')) valid.unshift('view');
    return [m.id, valid];
  }));
}
export function legacyPermissions(role) {
  if (role === 'admin') return fullPermissions();
  const result = normalizePermissions({});
  const allowed = role === 'doctor'
    ? ['dashboard','patients','appointments','consultations','prenatal','prescriptions','laboratory','billing','billingHistory','charges','reports','inventory','tools','users']
    : role === 'staff' ? ['dashboard','patients','appointments','prescriptions','laboratory','billing','billingHistory','charges','reports','inventory','tools'] : [];
  for (const id of allowed) {
    result[id] = role === 'doctor' ? [...modules.find(m => m.id === id).actions]
      : ['view', 'print'].filter(a => modules.find(m => m.id === id).actions.includes(a));
  }
  if (role === 'staff') {
    for (const id of ['consultations','prenatal','prescriptions','laboratory','billing']) result[id] = [...new Set([...result[id], 'view', 'print'])];
    for (const id of ['patients','appointments','billing','charges','inventory']) result[id].push('create','edit');
    result.charges = ['view','create','print'];
    result.billing.push('complete');
    result.prescriptions.push('complete');
  }
  return result;
}
export const permissionsFor = user => user?.role === 'admin' ? fullPermissions()
  : user?.permissions == null ? legacyPermissions(user?.role) : normalizePermissions(user.permissions);
export const hasPermission = (user, module, action = 'view') => !!permissionsFor(user)[module]?.includes(action);
const cleanPath = path => String(path).split(/[?#]/)[0].replace(/\/+$/, '') || '/';
export function moduleForPath(path) {
  path = cleanPath(path);
  if (/^\/cases(?:\/|$)/.test(path)) return 'consultations';
  if (/^\/pregnancies(?:\/|$)/.test(path)) return 'prenatal';
  return modules.find(m => path === m.path || path.startsWith(m.path + '/'))?.id;
}
export const canVisit = (user, path) => hasPermission(user, moduleForPath(path));
export function permissionPreset(mode, selected = {}) {
  if (mode === 'clear') return {};
  if (mode === 'full') return fullPermissions();
  return Object.fromEntries(modules.map(m => [m.id, mode === 'select' && selected[m.id]?.length ? [...selected[m.id]] : ['view']]));
}
export function togglePermission(selected, module, action, checked) {
  const next = normalizePermissions(selected);
  const definition = modules.find(m => m.id === module);
  if (!definition?.actions.includes(action)) return next;
  next[module] = checked ? [...new Set(['view', ...next[module], action])]
    : action === 'view' ? [] : next[module].filter(a => a !== action);
  return next;
}
export function canRequest(user, path, method = 'GET', body = {}) {
  path = cleanPath(path).replace(/^\/api(?=\/)/, '');
  method = method.toUpperCase();
  const read = method === 'GET' || method === 'HEAD';
  const has = (id, action = 'view') => hasPermission(user, id, action);
  const any = ids => ids.some(id => has(id));
  if (read && path === '/patients') return any(['patients','appointments','consultations','prenatal','prescriptions','laboratory','billing','charges','billingHistory']);
  if (read && /^\/patients\/[^/]+\/cases$/.test(path)) return any(['consultations','prescriptions','laboratory','billing','charges']);
  if (read && /^\/patients\/[^/]+\/billing-history$/.test(path)) return has('billingHistory');
  if (read && path === '/inventory/overview') return any(['inventory','prescriptions','charges']);
  if (read && path === '/tools/overview') return any(['tools','settings']);
  if (read && /^\/(services(?:\/[^/]+)?|service-types)$/.test(path)) return any(['tools','appointments','consultations']);
  if (read && path === '/charge-types') return any(['tools','charges']);
  let module = moduleForPath(path);
  if (/^\/(invoices|billings|payments)(\/|$)/.test(path)) module = 'billing';
  if (/^\/report-exports(\/|$)/.test(path)) module = 'reports';
  if (/^\/(services|service-types|charge-types)(\/|$)/.test(path)) module = 'tools';
  if (/^\/backups(\/|$)/.test(path)) module = 'backups';
  if (path === '/tools/clinic-settings') module = 'settings';
  if (/^\/cases\/[^/]+\/lab-results\/[^/]+$/.test(path)) return method === 'PUT' && has('laboratory','edit');
  if (method === 'PATCH' && /^\/cases\/[^/]+$/.test(path) && body && Object.keys(body).length === 1 && Object.hasOwn(body,'lab_results')) return has('laboratory','edit');
  let action = read ? 'view' : ({POST:'create',PUT:'edit',PATCH:'edit',DELETE:'delete'}[method]);
  if (!action || !module) return false;
  if (!read && (/\/payments$/.test(path) || module === 'billing' && (path.startsWith('/payments') || body?.payment_status !== undefined || body?.paid_amount !== undefined))) action = 'complete';
  if (!read && (/\/dispense$/.test(path) || /^(Delivered|Completed|Closed)$/.test(body?.status || body?.case_status || ''))) action = 'complete';
  if (!read && /\/void$/.test(path)) action = 'delete';
  if (module === 'backups') {
    if (/\/restore$/.test(path)) action = 'restore';
    if (/\/download$/.test(path)) action = 'export';
    if (path !== '/backups' && user?.role !== 'admin') return false;
  }
  if (!has(module, action)) return false;
  if (!read && module === 'consultations') {
    if (body?.lab_results !== undefined && !has('laboratory','edit')) return false;
    if (body?.prescription?.items?.length && !has('prescriptions','create')) return false;
    if ((body?.laboratory?.items?.length || body?.laboratory?.other_test) && !has('laboratory','create')) return false;
  }
  return true;
}
