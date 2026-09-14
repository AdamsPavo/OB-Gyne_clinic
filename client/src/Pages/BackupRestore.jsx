import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, DatabaseBackup, Download, FileUp, Plus, RefreshCw, RotateCcw, ShieldCheck, Trash2, X } from "lucide-react";
import PermissionButton from "../components/PermissionButton";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";
import { getCurrentUser } from "../auth";
const sizeLabel = bytes => bytes < 1024 * 1024 ? `${Math.max(1,Math.ceil(bytes/1024))} KB` : `${(bytes/1024/1024).toFixed(1)} MB`;
const route = name => `/backups/${encodeURIComponent(name)}`;

export default function BackupRestore({ embedded = false }) {
  const isAdmin = getCurrentUser()?.role === "admin";
  const [backups,setBackups] = useState([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState("");
  const [notice,setNotice] = useState(null);
  const [preview,setPreview] = useState(null);
  const [confirmation,setConfirmation] = useState("");
  const [restoreError,setRestoreError] = useState("");
  const upload = useRef(null);
  const dialog = useRef(null);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setBackups(await api("/backups")); }
    catch(error) { setNotice({error:true,text:error.message}); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{
    let cancelled=false;
    api("/backups").then(rows=>{if(!cancelled)setBackups(rows);})
      .catch(error=>{if(!cancelled)setNotice({error:true,text:error.message});})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    if (!preview) return;
    const focused = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow="hidden"; dialog.current?.querySelector("input")?.focus();
    const key = event => {
      if (event.key === "Escape" && !lock.current) setPreview(null);
      if (event.key !== "Tab") return;
      const controls=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
      const first=controls[0], last=controls.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener("keydown",key);
    return ()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",key);focused?.focus();};
  },[preview]);
  const run = async (label,work) => {
    if(lock.current) return;
    lock.current=true;setBusy(label);setNotice(null);
    try { await work(); }
    catch(error){setNotice({error:true,text:error.message});}
    finally{lock.current=false;setBusy("");}
  };
  const create = () => run("Creating backup…",async()=>{
    const result=await api("/backups",{method:"POST"});
    setNotice({text:`${result.message} ${result.name}`});await refresh();
  });
  const importFile = event => {
    const file=event.target.files?.[0];event.target.value="";
    if(!file)return;
    if(!file.name.toLowerCase().endsWith(".db") || file.size>100*1024*1024){setNotice({error:true,text:"Choose a .db file no larger than 100 MB."});return;}
    run("Importing and validating backup…",async()=>{
      const result=await api("/backups/import",{method:"POST",headers:{"Content-Type":"application/octet-stream"},body:file});
      setNotice({text:result.message});await refresh();
    });
  };
  const download = backup => run("Preparing download…",async()=>{
    const blob=await api(`${route(backup.name)}/download`,{responseType:"blob"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=backup.name;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    setNotice({text:"Backup download started. Store the file in a secure location."});
  });
  const inspect = backup => run("Checking backup…",async()=>{
    const result=await api(`${route(backup.name)}/preview`);
    setConfirmation("");setRestoreError("");setPreview(result);
  });
  const remove = backup => {
    if(!window.confirm(`Permanently delete backup ${backup.name}? This does not delete current clinic records.`))return;
    run("Deleting backup…",async()=>{await api(route(backup.name),{method:"DELETE"});setNotice({text:"Backup deleted."});await refresh();});
  };
  const restore = async event => {
    event.preventDefault();
    if(lock.current || confirmation!==preview?.name)return;
    lock.current=true;setBusy("Saving recovery copy and restoring…");setRestoreError("");
    try {
      await api(`${route(preview.name)}/restore`,{method:"POST",body:JSON.stringify({confirmation})});
      for(const key of ["obgyn_token","token","currentUser","user"])localStorage.removeItem(key);
      window.location.assign("/?restored=1");
    } catch(error){setRestoreError(error.message);lock.current=false;setBusy("");}
  };
  return <div className={embedded?"min-w-0":"flex min-h-screen bg-slate-50"}>
    {!embedded&&<Sidebar activeItem="Backup & Restore"/>}<div className="min-w-0 flex-1">
    <header className={`clinic-page-header flex flex-wrap items-center justify-between gap-4 bg-linear-to-r from-teal-700 via-emerald-600 to-cyan-500 p-6 text-white ${embedded?"mb-5":"m-4 sm:m-6"}`}><div><h1 className="text-3xl font-bold">Backup & Restore</h1><p className="mt-2 text-teal-100">Protect your clinic records with complete database snapshots.</p></div><PermissionButton module="backups" action="create" disabled={Boolean(busy)} onClick={create} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-teal-700"><Plus size={18}/>Create backup</PermissionButton></header>
    <main className={embedded?"space-y-5":"space-y-5 px-4 pb-8 sm:px-6"}>
      <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"><ShieldCheck size={21} className="shrink-0"/><p>Backups contain all clinic records, settings, and user accounts. Before restoring, the system validates the file and saves a recovery copy.{!isAdmin&&" Only Admin can download, import, delete, or restore a full database."}</p></div>
      {notice&&<p role={notice.error?"alert":"status"} className={`break-words rounded-xl p-4 text-sm ${notice.error?"bg-red-50 text-red-700":"bg-emerald-50 text-emerald-800"}`}>{notice.text}</p>}
      {busy&&<p role="status" className="flex items-center gap-2 text-sm font-medium text-teal-800"><RefreshCw size={16} className="animate-spin"/>{busy}</p>}
      <section className="rounded-3xl border border-teal-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><DatabaseBackup className="text-teal-600"/><div><h2 className="text-lg font-bold">Saved backups</h2><p className="text-sm text-slate-500">{backups.length} file(s) stored on the clinic server</p></div></div><div className="flex flex-wrap gap-2"><button disabled={Boolean(busy)||loading} onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"><RefreshCw size={16}/>Refresh</button>{isAdmin&&<><input ref={upload} type="file" accept=".db" aria-label="Import database backup" onChange={importFile} className="hidden"/><button disabled={Boolean(busy)} onClick={()=>upload.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800"><FileUp size={17}/>Import .db file</button></>}</div></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr>{["Backup file","Saved","Size",...(isAdmin?["Actions"]:[])].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{backups.map(backup=><tr key={backup.name}><td className="p-3"><p className="max-w-sm break-all font-medium">{backup.name}</p>{backup.recovery&&<span className="mt-1 inline-block rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">Automatic recovery copy</span>}</td><td className="whitespace-nowrap p-3 text-sm">{new Date(backup.createdAt).toLocaleString()}</td><td className="whitespace-nowrap p-3 text-sm">{sizeLabel(backup.size)}</td>{isAdmin&&<td className="p-3"><div className="flex gap-2"><button disabled={Boolean(busy)} onClick={()=>download(backup)} aria-label={`Download ${backup.name}`} className="rounded-lg border p-2 text-teal-700" title="Download"><Download size={18}/></button><button disabled={Boolean(busy)} onClick={()=>inspect(backup)} className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-3 py-2 text-sm font-semibold text-white"><RotateCcw size={16}/>Restore</button><button disabled={Boolean(busy)} onClick={()=>remove(backup)} aria-label={`Delete ${backup.name}`} className="rounded-lg border border-rose-100 p-2 text-rose-600" title="Delete backup"><Trash2 size={18}/></button></div></td>}</tr>)}{!backups.length&&<tr><td colSpan={isAdmin?4:3} className="p-10 text-center text-sm text-slate-500">{loading?"Loading backups…":"No backups yet. Create a snapshot to protect your current records."}</td></tr>}</tbody></table></div>
        {isAdmin&&<p className="mt-4 text-xs text-slate-500">Import supports clinic SQLite .db backups up to 100 MB. Importing a file does not replace your records.</p>}
      </section>
    </main></div>
    {preview&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><form ref={dialog} onSubmit={restore} role="dialog" aria-modal="true" aria-labelledby="restore-title" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><AlertTriangle className="text-amber-600"/><h2 id="restore-title" className="text-xl font-bold">Restore this backup?</h2></div><button type="button" aria-label="Cancel restore" disabled={Boolean(busy)} onClick={()=>setPreview(null)} className="rounded-lg p-2 text-slate-500"><X size={20}/></button></div><p className="mt-4 break-all rounded-xl bg-slate-50 p-3 text-sm font-semibold">{preview.name}</p><dl className="my-4 grid grid-cols-3 gap-3 text-center">{[["Patients",preview.patients],["Appointments",preview.appointments],["Users",preview.users]].map(([label,value])=><div key={label} className="rounded-xl bg-teal-50 p-3"><dt className="text-xs text-teal-800">{label}</dt><dd className="mt-1 text-xl font-bold text-teal-900">{value}</dd></div>)}</dl><p className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">This replaces current patients, clinical records, billing, inventory, settings, and user accounts with this backup. A recovery copy is saved first. Everyone must sign in again using credentials from the restored backup.</p><label className="mt-5 grid gap-2 text-sm font-medium">Type the full backup filename to confirm<input value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={Boolean(busy)} autoComplete="off" spellCheck={false} className="w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>{restoreError&&<p role="alert" className="mt-3 text-sm text-red-700">{restoreError}</p>}{busy&&<p role="status" className="mt-3 text-sm text-teal-800">{busy} Please keep this page open.</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" disabled={Boolean(busy)} onClick={()=>setPreview(null)} className="rounded-xl border px-4 py-2.5">Cancel</button><button disabled={Boolean(busy)||confirmation!==preview.name} className="rounded-xl bg-pink-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">Restore database</button></div></form></div>}
  </div>;
}
