import { useEffect, useMemo, useState } from "react";
import { Building2, KeyRound, PackagePlus, Pencil, Pill, Plus, ReceiptText, Save, ShieldCheck, Stethoscope, Trash2, UserRound, Wrench, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";

const emptyService = { name: "", default_fee: "", is_active: true };
const emptyMedicine = { medicine_name: "", generic_name: "", unit: "piece", quantity: "", reorder_level: "10", unit_price: "", expiry_date: "", notes: "" };
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function Tools() {
  const [tab, setTab] = useState("services");
  const [data, setData] = useState({ settings: null, serviceTypes: [], chargeTypes: [], medicines: [] });
  const [profile, setProfile] = useState({ fullname: "", username: "", role: "" });
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try {
      setLoading(true);
      const [overview, user] = await Promise.all([api("/tools/overview"), api("/auth/profile")]);
      setData(overview); setProfile(user);
    } catch (error) { setNotice({ type: "error", text: error.message }); }
    finally { setLoading(false); }
  };
  // Data is loaded once when this administration page opens.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);
  const show = (text, type = "success") => setNotice({ text, type });
  const tabs = [
    ["services", "Service Management", Stethoscope], ["inventory", "Medicine Inventory", Pill],
    ["charges", "Charge Types", ReceiptText],
    ["clinic", "Clinic Details", Building2], ["account", "Profile & Security", UserRound],
  ];
  return <div className="flex min-h-screen bg-slate-50">
    <Sidebar activeItem="Tools" />
    <div className="min-w-0 flex-1">
      <header className="m-4 overflow-hidden rounded-3xl bg-linear-to-r from-violet-700 via-fuchsia-600 to-pink-500 text-white shadow-xl shadow-fuchsia-200/50 sm:m-6">
        <div className="relative p-6 sm:p-8"><Wrench className="absolute -right-5 -bottom-7 h-40 w-40 rotate-12 text-white/10" />
          <p className="text-sm font-semibold text-fuchsia-100">System administration</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Tools</h1>
          <p className="mt-2 text-fuchsia-50">Manage services, medicine stock, clinic information, and your account.</p>
        </div>
      </header>
      <main className="px-4 pb-10 sm:px-6">
        {notice && <div className={`mb-5 flex justify-between rounded-2xl border px-4 py-3 text-sm ${notice.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}><span>{notice.text}</span><button onClick={() => setNotice(null)}><X size={17} /></button></div>}
        <div className="grid gap-6 xl:grid-cols-[250px_1fr]">
          <nav className="h-fit rounded-3xl bg-white p-3 shadow-sm">{tabs.map(([id, label, Icon]) =>
            <button key={id} onClick={() => setTab(id)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold ${tab === id ? "bg-fuchsia-50 text-fuchsia-700" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={19} />{label}</button>)}
          </nav>
          <section>{loading ? <Loading /> : <>
            {tab === "services" && <Services items={data.serviceTypes} reload={load} show={show} />}
            {tab === "inventory" && <Inventory items={data.medicines} reload={load} show={show} />}
            {tab === "charges" && <Charges items={data.chargeTypes || []} reload={load} show={show} />}
            {tab === "clinic" && <Clinic settings={data.settings} reload={load} show={show} />}
            {tab === "account" && <Account profile={profile} setProfile={setProfile} show={show} />}
          </>}</section>
        </div>
      </main>
    </div>
  </div>;
}

function Panel({ icon: Icon, title, description, action, children }) {
  return <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-50 text-fuchsia-700"><Icon size={21} /></div><div><h2 className="text-xl font-bold">{title}</h2><p className="text-sm text-slate-500">{description}</p></div></div>{action}</div>{children}</div>;
}
function Field({ label, ...props }) { return <label className="grid gap-1.5 text-sm font-semibold text-slate-700">{label}<input {...props} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal" /></label>; }
function Actions({ editing, close }) { return <div className="flex justify-end gap-2"><button type="button" onClick={close} className="rounded-xl border px-4 py-2.5 font-semibold text-slate-600">Cancel</button><button className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2.5 font-semibold text-white"><Save size={17} />{editing ? "Update" : "Save"}</button></div>; }
function IconButton({ icon: Icon, danger, onClick, label }) { return <button type="button" title={label} onClick={onClick} className={`rounded-lg p-2 ${danger ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}><Icon size={16} /></button>; }

function Services({ items, reload, show }) {
  const [form, setForm] = useState(emptyService), [editing, setEditing] = useState(null), [open, setOpen] = useState(false);
  const close = () => { setForm(emptyService); setEditing(null); setOpen(false); };
  const save = async (e) => { e.preventDefault(); try { const r = await api(editing ? `/services/${editing}` : "/services", { method: editing ? "PUT" : "POST", body: JSON.stringify(form) }); show(r.message); close(); await reload(); } catch (error) { show(error.message, "error"); } };
  const remove = async (item) => { if (!confirm(`Delete "${item.name}"?`)) return; try { await api(`/services/${item.id}`, { method: "DELETE" }); show("Service deleted."); await reload(); } catch (e) { show(e.message, "error"); } };
  return <Panel icon={Stethoscope} title="Service Management" description={`${items.length} configured services`} action={<button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2.5 font-semibold text-white"><Plus size={18} />Add service</button>}>
    {open && <form onSubmit={save} className="mt-6 grid gap-4 rounded-2xl bg-fuchsia-50/60 p-4 md:grid-cols-2"><Field label="Service name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /><Field label="Price" type="number" min="0" step=".01" value={form.default_fee} onChange={e => setForm({ ...form, default_fee: e.target.value })} required /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.is_active)} onChange={e => setForm({ ...form, is_active: e.target.checked })} />Active</label><Actions editing={editing} close={close} /></form>}
    <div className="mt-6 overflow-x-auto"><table className="w-full min-w-150 text-left"><thead><tr className="border-b text-xs uppercase text-slate-400"><th className="p-3">Service</th><th className="p-3">Fee</th><th className="p-3">Status</th><th /></tr></thead><tbody>{items.length ? items.map(i => <tr key={i.id} className="border-b border-slate-100"><td className="p-3"><b>{i.name}</b><p className="text-xs text-slate-400">{i.description || "No description"}</p></td><td className="p-3">{peso.format(i.default_fee || 0)}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${i.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{i.is_active ? "Active" : "Inactive"}</span></td><td><div className="flex justify-end gap-2"><IconButton label="Edit" icon={Pencil} onClick={() => { setEditing(i.id); setForm(i); setOpen(true); }} /><IconButton label="Delete" icon={Trash2} danger onClick={() => remove(i)} /></div></td></tr>) : <Empty span="4" text="No service types yet." />}</tbody></table></div>
  </Panel>;
}

function Charges({ items, reload, show }) {
  const empty = { name:"",category:"Miscellaneous",description:"",default_amount:"",is_active:true };
  const [form,setForm]=useState(empty),[editing,setEditing]=useState(null),[open,setOpen]=useState(false);
  const close=()=>{setForm(empty);setEditing(null);setOpen(false)};
  const save=async e=>{e.preventDefault();try{const r=await api(editing?`/tools/charge-types/${editing}`:"/tools/charge-types",{method:editing?"PUT":"POST",body:JSON.stringify(form)});show(r.message);close();await reload()}catch(error){show(error.message,"error")}};
  const remove=async item=>{if(!confirm(`Delete "${item.name}"?`))return;try{await api(`/tools/charge-types/${item.id}`,{method:"DELETE"});show("Charge type deleted.");await reload()}catch(error){show(error.message,"error")}};
  return <Panel icon={ReceiptText} title="Charge Types" description={`${items.length} reusable patient charges`} action={<button onClick={()=>setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2.5 font-semibold text-white"><Plus size={18}/>Add charge</button>}>
    {open&&<form onSubmit={save} className="mt-6 grid gap-4 rounded-2xl bg-fuchsia-50/60 p-4 md:grid-cols-2"><Field label="Charge name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/><Field label="Category" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} required/><Field label="Default amount" type="number" min="0" step=".01" value={form.default_amount} onChange={e=>setForm({...form,default_amount:e.target.value})} required/><Field label="Description" value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})}/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.is_active)} onChange={e=>setForm({...form,is_active:e.target.checked})}/>Available for new charges</label><Actions editing={editing} close={close}/></form>}
    <div className="mt-6 overflow-x-auto"><table className="w-full min-w-150 text-left"><thead><tr className="border-b text-xs uppercase text-slate-400"><th className="p-3">Charge</th><th>Category</th><th>Default Amount</th><th>Status</th><th/></tr></thead><tbody>{items.length?items.map(i=><tr key={i.id} className="border-b border-slate-100"><td className="p-3"><b>{i.name}</b><p className="text-xs text-slate-400">{i.description||"No description"}</p></td><td>{i.category}</td><td>{peso.format(i.default_amount||0)}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${i.is_active?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{i.is_active?"Active":"Inactive"}</span></td><td><div className="flex justify-end gap-2"><IconButton label="Edit" icon={Pencil} onClick={()=>{setEditing(i.id);setForm(i);setOpen(true)}}/><IconButton label="Delete" icon={Trash2} danger onClick={()=>remove(i)}/></div></td></tr>):<Empty span="5" text="No charge types yet."/>}</tbody></table></div>
  </Panel>;
}

function Inventory({ items, reload, show }) {
  const [form, setForm] = useState(emptyMedicine), [editing, setEditing] = useState(null), [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const filtered = useMemo(() => items.filter(i => `${i.medicine_name} ${i.generic_name || ""}`.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const close = () => { setForm(emptyMedicine); setEditing(null); setOpen(false); };
  const save = async e => { e.preventDefault(); try { const r = await api(editing ? `/tools/medicines/${editing}` : "/tools/medicines", { method: editing ? "PUT" : "POST", body: JSON.stringify(form) }); show(r.message); close(); await reload(); } catch (error) { show(error.message, "error"); } };
  const remove = async i => { if (!confirm(`Remove "${i.medicine_name}"?`)) return; try { await api(`/tools/medicines/${i.id}`, { method: "DELETE" }); show("Medicine removed."); await reload(); } catch (e) { show(e.message, "error"); } };
  const set = key => e => setForm({ ...form, [key]: e.target.value });
  return <Panel icon={Pill} title="Medicine Inventory" description={`${items.length} medicines · ${items.filter(i => +i.quantity <= +i.reorder_level).length} low stock`} action={<button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2.5 font-semibold text-white"><PackagePlus size={18} />Add medicine</button>}>
    {open && <form onSubmit={save} className="mt-6 grid gap-4 rounded-2xl bg-fuchsia-50/60 p-4 sm:grid-cols-2 lg:grid-cols-3">{[["Medicine name","medicine_name","text"],["Generic name","generic_name","text"],["Unit","unit","text"],["Quantity","quantity","number"],["Low-stock level","reorder_level","number"],["Unit price","unit_price","number"],["Expiry date","expiry_date","date"],["Notes","notes","text"]].map(([l,k,t]) => <Field key={k} label={l} type={t} min={t === "number" ? "0" : undefined} step={k === "unit_price" ? ".01" : undefined} value={form[k]} onChange={set(k)} required={["medicine_name","unit","quantity"].includes(k)} />)}<div className="sm:col-span-2 lg:col-span-3"><Actions editing={editing} close={close} /></div></form>}
    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search medicine…" className="mt-6 w-full max-w-md rounded-xl border border-slate-200 px-4 py-2.5" />
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-200 text-left"><thead><tr className="border-b text-xs uppercase text-slate-400"><th className="p-3">Medicine</th><th>Stock</th><th>Price</th><th>Expiry</th><th>Status</th><th /></tr></thead><tbody>{filtered.length ? filtered.map(i => { const low = +i.quantity <= +i.reorder_level; return <tr key={i.id} className="border-b border-slate-100"><td className="p-3"><b>{i.medicine_name}</b><p className="text-xs text-slate-400">{i.generic_name || "—"}</p></td><td>{i.quantity} {i.unit}</td><td>{peso.format(i.unit_price || 0)}</td><td>{i.expiry_date || "—"}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${low ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{low ? "Low stock" : "In stock"}</span></td><td><div className="flex justify-end gap-2"><IconButton label="Edit" icon={Pencil} onClick={() => { setEditing(i.id); setForm(Object.fromEntries(Object.entries(i).map(([k,v]) => [k,v ?? ""]))); setOpen(true); }} /><IconButton label="Delete" icon={Trash2} danger onClick={() => remove(i)} /></div></td></tr>; }) : <Empty span="6" text="No medicines found." />}</tbody></table></div>
  </Panel>;
}

function Clinic({ settings, reload, show }) {
  const [form, setForm] = useState(settings || { clinic_name: "", clinic_address: "", doctor_name: "" });
  const save = async e => { e.preventDefault(); try { const r = await api("/tools/clinic-settings", { method: "PUT", body: JSON.stringify(form) }); show(r.message); await reload(); } catch (error) { show(error.message, "error"); } };
  return <Panel icon={Building2} title="Clinic Details" description="Information used across the clinic system"><form onSubmit={save} className="mt-6 grid max-w-3xl gap-5">{[["Clinic name","clinic_name"],["Clinic address","clinic_address"],["Doctor / medical director","doctor_name"]].map(([l,k]) => <Field key={k} label={l} value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} required />)}<button className="inline-flex w-fit items-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-3 font-semibold text-white"><Save size={18} />Save clinic details</button></form></Panel>;
}

function Account({ profile, setProfile, show }) {
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const saveProfile = async e => { e.preventDefault(); try { const r = await api("/auth/profile", { method: "PUT", body: JSON.stringify(profile) }); setProfile(r.user); localStorage.setItem("currentUser", JSON.stringify(r.user)); show(r.message); } catch (error) { show(error.message, "error"); } };
  const savePassword = async e => { e.preventDefault(); if (pw.newPassword !== pw.confirmPassword) return show("New passwords do not match.", "error"); try { const r = await api("/auth/password", { method: "PUT", body: JSON.stringify(pw) }); setPw({ currentPassword: "", newPassword: "", confirmPassword: "" }); show(r.message); } catch (error) { show(error.message, "error"); } };
  return <div className="space-y-6"><Panel icon={UserRound} title="My Profile" description={`Signed in as ${profile.role}`}><form onSubmit={saveProfile} className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2"><Field label="Full name" value={profile.fullname} onChange={e => setProfile({ ...profile, fullname: e.target.value })} required /><Field label="Username" value={profile.username} onChange={e => setProfile({ ...profile, username: e.target.value })} required /><button className="inline-flex w-fit items-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-3 font-semibold text-white"><Save size={18} />Save profile</button></form></Panel>
    <Panel icon={KeyRound} title="Change Password" description="Use at least 8 characters"><form onSubmit={savePassword} className="mt-6 grid max-w-3xl gap-4"><Field label="Current password" type="password" value={pw.currentPassword} onChange={e => setPw({ ...pw, currentPassword: e.target.value })} required /><div className="grid gap-4 sm:grid-cols-2"><Field label="New password" type="password" minLength="8" value={pw.newPassword} onChange={e => setPw({ ...pw, newPassword: e.target.value })} required /><Field label="Confirm new password" type="password" minLength="8" value={pw.confirmPassword} onChange={e => setPw({ ...pw, confirmPassword: e.target.value })} required /></div><button className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 font-semibold text-white"><ShieldCheck size={18} />Update password</button></form></Panel></div>;
}
function Empty({ span, text }) { return <tr><td colSpan={span} className="p-10 text-center text-sm text-slate-400">{text}</td></tr>; }
function Loading() { return <div className="animate-pulse rounded-3xl bg-white p-6"><div className="h-7 w-52 rounded bg-slate-200" /><div className="mt-6 h-64 rounded-2xl bg-slate-100" /></div>; }
