import { useCallback, useEffect, useRef, useState } from "react";
import { LockKeyhole, Plus, Search, Users, X } from "lucide-react";
import PermissionsEditor from "../components/PermissionsEditor";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";
import { can, fullPermissions, getCurrentUser, normalizePermissions, permissionsFor } from "../auth";
import { legacyPermissions, permissionPreset, togglePermission } from "../../../shared/permissions.mjs";
const blank = { full_name:"", username:"", password:"", confirmPassword:"", role:"staff", is_active:true, permissions:{dashboard:["view"]} };
const button = "rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm font-semibold text-pink-700 hover:bg-pink-50 disabled:opacity-50";

export default function UserManagement() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef(null);
  const saveLock = useRef(false);
  const load = useCallback(async () => {
    try { setLoading(true); setUsers(await api(`/users?search=${encodeURIComponent(search)}`)); }
    catch (error) { setNotice(error.message); }
    finally { setLoading(false); }
  }, [search]);
  useEffect(() => { const timer = setTimeout(load, 200); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector("input")?.focus();
    const keydown = event => {
      if (event.key === "Escape" && !saveLock.current) setOpen(false);
      if (event.key !== "Tab") return;
      const items = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [open]);
  const start = (user = null) => {
    setEditing(user); setError("");
    setForm(user ? {...blank, ...user, permissions:permissionsFor(user), is_active:Boolean(user.is_active)} : {...blank, permissions:isAdmin ? {dashboard:["view"]} : legacyPermissions("staff")});
    setOpen(true);
  };
  const locked = !isAdmin || form.role === "admin";
  const selected = form.role === "admin" ? fullPermissions() : normalizePermissions(form.permissions);
  const preset = mode => {
    if (locked) return;
    const permissions = permissionPreset(mode, selected);
    setForm({...form, permissions});
  };
  const toggle = (module, action, checked) => {
    if (locked) return;
    setForm({...form, permissions:togglePermission(selected,module,action,checked)});
  };
  const save = async event => {
    event.preventDefault();
    if (saveLock.current) return;
    if (!editing && form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    saveLock.current = true; setSaving(true); setError("");
    try {
      const payload = {...form, permissions:selected};
      if (!isAdmin) delete payload.permissions;
      await api(editing ? `/users/${editing.id}` : "/users", {method:editing ? "PUT" : "POST", body:JSON.stringify(payload)});
      setOpen(false); setNotice("User saved successfully. Access permissions take effect on the next login or refresh.");
      if (editing?.id === currentUser.id) { window.location.reload(); return; }
      await load();
    } catch (error) { setError(error.message); }
    finally { saveLock.current = false; setSaving(false); }
  };
  const action = async (user, type) => {
    try {
      if (type === "password") {
        const password = prompt(`New password for ${user.full_name}:`);
        if (!password) return;
        await api(`/users/${user.id}/password`, {method:"PUT", body:JSON.stringify({password})});
      } else if (type === "status") {
        if (!confirm(`${user.is_active ? "Deactivate" : "Activate"} ${user.full_name}?`)) return;
        await api(`/users/${user.id}/status`, {method:"PUT", body:JSON.stringify({is_active:!user.is_active})});
      } else {
        if (!confirm(`Delete ${user.full_name}? Deactivation is safer for linked records.`)) return;
        await api(`/users/${user.id}`, {method:"DELETE"});
      }
      setNotice("User account updated."); await load();
    } catch (error) { setNotice(error.message); }
  };
  return <div className="flex min-h-screen bg-pink-50/40"><Sidebar activeItem="User Management" /><main className="min-w-0 flex-1 p-4 sm:p-6">
    <header className="clinic-page-header mb-6 flex flex-wrap items-center justify-between gap-4 bg-linear-to-r from-pink-700 via-pink-600 to-rose-500 p-6 text-white">
      <div><p className="text-sm text-pink-100">Administration</p><h1 className="text-3xl font-bold">User Management</h1><p className="mt-2 text-pink-100">Manage clinic accounts and give each person the access they need.</p></div>
      {can("users","create") && <button onClick={() => start()} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-pink-700"><Plus size={18} />Add User</button>}
    </header>
    {notice && <p role="status" className="mb-5 rounded-xl border border-pink-200 bg-pink-50 p-4 text-sm text-pink-900">{notice}</p>}
    <section className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><Users className="text-pink-600" /><div><h2 className="font-bold">Clinic accounts</h2><p className="text-sm text-slate-500">{users.length} account(s) {search && "matching your search"}</p></div></div><label className="flex items-center gap-2 rounded-xl border border-pink-200 px-3 py-2"><Search size={17} className="text-pink-500" /><input aria-label="Search users" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or username" className="min-w-0 outline-none" /></label></div>
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr>{["Full name","Username","Role","Status","Access","Created","Actions"].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{users.map(user => <tr key={user.id}><td className="px-4 py-4 font-semibold">{user.full_name}</td><td className="px-4">{user.username}</td><td className="px-4 capitalize">{user.role}</td><td className="px-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{user.is_active ? "Active" : "Inactive"}</span></td><td className="px-4 text-sm">{user.role === "admin" ? "Full access · locked" : `${Object.values(permissionsFor(user)).filter(actions => actions.includes("view")).length} modules`}</td><td className="px-4 text-sm">{new Date(user.created_at).toLocaleDateString()}</td><td className="px-4"><div className="flex gap-3 text-sm font-medium">{can("users","edit") && <><button onClick={() => start(user)} className="text-pink-700">Edit</button><button onClick={() => action(user,"password")} className="text-blue-700">Reset password</button><button onClick={() => action(user,"status")} className="text-amber-700">{user.is_active ? "Deactivate" : "Activate"}</button></>}{can("users","delete") && <button onClick={() => action(user,"delete")} className="text-red-700">Delete</button>}</div></td></tr>)}{!users.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500">{loading ? "Loading accounts…" : "No users found."}</td></tr>}</tbody></table></div></section>
    {!isAdmin && <p className="mt-4 flex items-center gap-2 text-sm text-slate-600"><LockKeyhole size={16} />Only Admin can change user permissions and roles.</p>}
  </main>
  {open && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"><form ref={dialog} onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="user-editor-title" className="mx-auto my-3 max-w-5xl rounded-3xl bg-white shadow-2xl">
    <div className="flex items-center justify-between gap-4 rounded-t-3xl bg-linear-to-r from-pink-700 to-rose-500 p-6 text-white"><div><h2 id="user-editor-title" className="text-2xl font-bold">{editing ? "Edit user" : "Create user"}</h2><p className="mt-1 text-sm text-pink-100">Account details and individual access permissions</p></div><button type="button" aria-label="Close user editor" disabled={saving} onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/20"><X /></button></div>
    <div className="space-y-6 p-5 sm:p-6"><section><h3 className="mb-4 font-bold text-slate-900">Account details</h3><div className="grid gap-4 sm:grid-cols-2">{[["full_name","Full name","text"],["username","Username","text"],...(!editing ? [["password","Password","password"],["confirmPassword","Confirm password","password"]] : [])].map(([name,label,type]) => <label key={name} className="grid gap-1.5 text-sm font-medium text-slate-700">{label}<input name={name} type={type} minLength={type === "password" ? 8 : undefined} autoComplete={type === "password" ? "new-password" : "off"} value={form[name]} onChange={event => setForm({...form,[name]:event.target.value})} required className="w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>)}<label className="grid gap-1.5 text-sm font-medium text-slate-700">Role<select disabled={!isAdmin} value={form.role} onChange={event => setForm({...form,role:event.target.value,permissions:event.target.value === "admin" ? fullPermissions() : form.role === "admin" ? {} : form.permissions})} className="rounded-xl border border-slate-200 px-3 py-2.5"><option value="admin">Admin</option><option value="doctor">Doctor</option><option value="staff">Staff</option></select></label></div></section>
    <PermissionsEditor role={form.role} locked={locked} selected={selected} saving={saving} onPreset={preset} onToggle={toggle} />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    </div><footer className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-3xl border-t border-pink-100 bg-white p-5"><button type="button" disabled={saving} onClick={() => setOpen(false)} className={button}>Cancel</button><button disabled={saving} className="rounded-xl bg-pink-600 px-5 py-2.5 font-semibold text-white hover:bg-pink-700 disabled:opacity-50">{saving ? "Saving…" : "Save User"}</button></footer>
  </form></div>}
  </div>;
}
