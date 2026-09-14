import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fullPermissions, modules, permissionPreset, togglePermission } from '../../shared/permissions.mjs';
import { MemoryRouter } from 'react-router-dom';

test('rendered navigation, URL guards, and action buttons respect individual permissions', async () => {
  const server = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
  const storage = new Map();
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem:key=>storage.get(key) ?? null, setItem:(key,value)=>storage.set(key,value) };
  try {
    const {default:PermissionsEditor} = await server.ssrLoadModule('/src/components/PermissionsEditor.jsx');
    const editor = renderToStaticMarkup(React.createElement(PermissionsEditor,{role:'admin',locked:true,selected:fullPermissions(),saving:false,onPreset:()=>{},onToggle:()=>{}}));
    assert.match(editor,/Access Permissions/);
    assert.match(editor,/automatically enabled and cannot be removed/);
    assert.equal((editor.match(/checked=/g) || []).length,modules.reduce((count,m)=>count+m.actions.length,0));
    assert.equal((editor.match(/<fieldset disabled/g) || []).length,5);
    assert.match(editor,/Permission summary before saving/);
    const {TabContent} = await server.ssrLoadModule('/src/components/Workspace.jsx');
    const {default:Sidebar} = await server.ssrLoadModule('/src/components/Sidebar.jsx');
    const {default:ProtectedRoute} = await server.ssrLoadModule('/src/components/ProtectedRoute.jsx');
    const {default:PermissionButton} = await server.ssrLoadModule('/src/components/PermissionButton.jsx');
    const render = (element, path='/patients') => renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[path]},element));
    storage.set('obgyn_token','test-session');
    storage.set('currentUser',JSON.stringify({role:'doctor',full_name:'Limited user',permissions:{patients:['view']}}));
    const navigation = render(React.createElement(Sidebar));
    assert.match(navigation,/>Patients</);
    assert.doesNotMatch(navigation,/>Billing</);
    assert.doesNotMatch(navigation,/>User Management</);
    assert.doesNotMatch(navigation,/>Consultations</);
    const denied = render(React.createElement(ProtectedRoute,null,React.createElement('p',null,'Restricted content')),'/users');
    assert.match(denied,/You do not have permission to access this page\./);
    assert.doesNotMatch(denied,/Restricted content/);
    assert.match(render(React.createElement(TabContent,{path:'/users'}),'/users'),/You do not have permission to access this page/);
    const allowed = render(React.createElement(ProtectedRoute,null,React.createElement('p',null,'Patient directory')),'/patients');
    assert.match(allowed,/Patient directory/);
    assert.match(render(React.createElement(PermissionButton,{module:'patients',action:'delete'},'Delete')),/disabled/);
    storage.set('currentUser',JSON.stringify({role:'admin',full_name:'Admin',permissions:{}}));
    assert.doesNotMatch(render(React.createElement(PermissionButton,{module:'patients',action:'delete'},'Delete')),/disabled/);
    const adminNavigation = render(React.createElement(Sidebar));
    assert.match(adminNavigation,/>User Management</);
    assert.match(adminNavigation,/>Laboratory Requests</);
    assert.match(adminNavigation,/>Settings</);
  } finally {
    if (original === undefined) delete globalThis.localStorage; else globalThis.localStorage=original;
    await server.close();
  }
});

test('checkbox presets and action toggles retain explicit view-only and empty grants', () => {
  const full = permissionPreset('full');
  assert.deepEqual(full,fullPermissions());
  assert.deepEqual(permissionPreset('clear',full),{});
  assert.ok(Object.values(permissionPreset('view',full)).every(actions=>actions.length===1 && actions[0]==='view'));
  const selected = permissionPreset('select',{patients:['view','edit']});
  assert.deepEqual(selected.patients,['view','edit']);
  assert.ok(selected.billing.includes('view'));
  const checked = togglePermission({},'patients','edit',true);
  assert.deepEqual(checked.patients,['view','edit']);
  assert.deepEqual(togglePermission(checked,'patients','view',false).patients,[]);
});
