import PermissionButton from "../components/PermissionButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhilippinePeso, Plus, Search, XCircle, X } from "lucide-react";
import PatientSearch from "../components/PatientSearch";
import MedicalCertificateForm from "../components/MedicalCertificateForm";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";
import { Link, useSearchParams } from "react-router-dom";
import { useWorkspace } from "../components/Workspace";

const today=()=>new Date().toISOString().slice(0,10);
const blank={patient_id:"",walk_in_name:"",charge_type_id:"",inventory_item_id:"",consultation_case_id:"",quantity:"1",unit_amount:"",description:"",charge_date:today(),notes:""};
const money=v=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(v||0));

export default function PatientCharges(){
 const workspace=useWorkspace();
 const [searchParams]=useSearchParams();
 const patientFromUrl=searchParams.get("patient")||"";
 const caseFromUrl=searchParams.get("case")||"";
 const [patients,setPatients]=useState([]),[types,setTypes]=useState([]),[inventoryItems,setInventoryItems]=useState([]),[inventoryCart,setInventoryCart]=useState([]),[charges,setCharges]=useState([]),[cases,setCases]=useState([]),[form,setForm]=useState(blank),[search,setSearch]=useState(""),[inventorySearch,setInventorySearch]=useState(""),[notice,setNotice]=useState(""),[saving,setSaving]=useState(false);
 const [historyFilter,setHistoryFilter]=useState("All");
 const [deletingCharge,setDeletingCharge]=useState(null),[deleteReason,setDeleteReason]=useState(""),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState("");
 const deleteCharge=async event=>{
  event.preventDefault();
  if(deleting || !deleteReason.trim())return;
  try{
   setDeleting(true);setDeleteError("");
   const result=await api(`/patient-charges/${deletingCharge.id}`,{method:"DELETE",body:JSON.stringify({reason:deleteReason.trim()})});
   setDeletingCharge(null);setDeleteReason("");setNotice(result.message);
   window.dispatchEvent(new Event("patient-charges-saved"));await load();
  }catch(error){setDeleteError(error.message)}finally{setDeleting(false)}
 };
 const [detailCharge,setDetailCharge]=useState(null);
 const [certificateCharge,setCertificateCharge]=useState(null);
 const load=useCallback(async()=>{try{const [p,t,inventory,c,patientCases]=await Promise.all([api("/patients?include_walk_in=true"),api("/charge-types"),api("/inventory/overview"),api("/patient-charges"),patientFromUrl?api(`/patients/${patientFromUrl}/cases`):Promise.resolve([])]);setPatients(p);if(!patientFromUrl)setForm(current=>({...current,patient_id:current.patient_id||String(p.find(patient=>patient.patient_number==="OPD-WALK-IN")?.id||"")}));setTypes(t.filter(type=>type.name!=="Inventory Item"));setInventoryItems(inventory.items||[]);setCharges(c);setCases(patientCases);if(patientFromUrl)setForm(current=>({...current,patient_id:patientFromUrl,consultation_case_id:caseFromUrl}))}catch(e){setNotice(e.message)}},[patientFromUrl,caseFromUrl]);
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{load()},[load]);
 const patientRequest=useRef(0);
 const selectPatient=async value=>{
  const request=++patientRequest.current;
  setForm(current=>({...current,patient_id:value,consultation_case_id:"",certificate:null,walk_in_name:""}));setCases([]);
  try{const result=value&&patients.find(p=>String(p.id)===String(value))?.patient_number!=="OPD-WALK-IN"?await api(`/patients/${value}/cases`):[];if(request===patientRequest.current)setCases(result)}catch(e){if(request===patientRequest.current)setNotice(e.message)}
 };
 const openCertificate=(certificate=form.certificate)=>setCertificateCharge({patient_id:form.patient_id,certificate,recipient_name:form.walk_in_name,draft:true});
 const selectType=value=>{const selected=types.find(t=>String(t.id)===String(value));
  const certificate=value===form.charge_type_id?form.certificate:null;
  setForm({...form,charge_type_id:value,inventory_item_id:"",unit_amount:selected?.default_amount??"",description:selected?.description||"",certificate});
  if(/medical cert/i.test(`${selected?.name} ${selected?.category}`))openCertificate(certificate);
 };
 const saveDraft=async(certificate,patientId)=>{
  if(!patientId)throw new Error("Select a patient.");
  const patientCases=patients.find(p=>String(p.id)===String(patientId))?.patient_number==="OPD-WALK-IN"?[]:await api(`/patients/${patientId}/cases`);
  setCases(patientCases);
  setForm(current=>({...current,patient_id:patientId,walk_in_name:certificate.recipient_name||"",consultation_case_id:String(current.patient_id)===String(patientId)?current.consultation_case_id:"",certificate}));
 };

 const selectInventoryItem=value=>{const selected=inventoryItems.find(item=>String(item.id)===String(value));setForm({...form,inventory_item_id:value,charge_type_id:"",certificate:null,unit_amount:selected?.selling_price??"",description:selected?.item_name||""})};
 const inventoryMatches=useMemo(()=>{const keyword=inventorySearch.trim().toLowerCase();return inventoryItems.filter(item=>!keyword||`${item.item_code} ${item.item_name}`.toLowerCase().includes(keyword)).slice(0,8)},[inventoryItems,inventorySearch]);
 const total=(Number(form.quantity)||0)*(Number(form.unit_amount)||0);
 const cartTotal=inventoryCart.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.unit_amount),0);
 const addInventoryItem=()=>{if(!form.inventory_item_id)return;const item=inventoryItems.find(entry=>String(entry.id)===String(form.inventory_item_id));const quantity=Math.max(1,parseInt(form.quantity,10)||1);setInventoryCart(current=>[...current,{inventory_item_id:form.inventory_item_id,item_name:item?.item_name||form.description,quantity,unit_amount:form.unit_amount,description:form.description}]);setForm({...form,inventory_item_id:"",quantity:"1",unit_amount:"",description:""})};
 const removeInventoryItem=index=>setInventoryCart(current=>current.filter((_,itemIndex)=>itemIndex!==index));
 const payableTotal=cartTotal+((form.charge_type_id||form.inventory_item_id)?total:0);
 const save=async e=>{e.preventDefault();
  const lines=[...inventoryCart,...((form.charge_type_id||form.inventory_item_id)?[{...form}]:[])];
  if(!lines.length){setNotice("Select a charge or inventory item.");return;}
  if(!confirm(`Add ${money(payableTotal)} to this patient's bill?`))return;
  try{setSaving(true);const current=JSON.parse(localStorage.getItem("currentUser")||"{}");
   const result=await api("/patient-charges",{method:"POST",body:JSON.stringify({...form,items:lines,created_by:current.fullname||current.username})});
   window.dispatchEvent(new Event("patient-charges-saved"));
   setNotice(`Charge ${result.charge_number} saved with ${lines.length} item(s) on invoice ${result.invoice_number}.`);
   setForm({...blank,charge_date:today()});setInventoryCart([]);setCases([]);await load();
   const certificateLine=lines.findIndex(line=>line.certificate);
   if(certificateLine>=0){const patient=patients.find(p=>String(p.id)===String(form.patient_id));setCertificateCharge({...result.charges[certificateLine],patient_id:form.patient_id,patient_name:[patient?.first_name,patient?.middle_name,patient?.last_name].filter(Boolean).join(" "),patient_number:patient?.patient_number,certificate:lines[certificateLine].certificate});}
  }catch(x){setNotice(x.message)}finally{setSaving(false)}
 };

 const list=useMemo(()=>charges.filter(c=>
  (historyFilter==="All" || (historyFilter==="Cancelled" ? c.status==="Deleted" : c.status!=="Deleted")) &&
  `${c.charge_number} ${c.patient_name} ${c.charge_name} ${c.invoice_number} ${c.case_number||""} ${(c.items||[]).map(item=>item.charge_name).join(" ")}`.toLowerCase().includes(search.trim().toLowerCase())
 ),[charges,search,historyFilter]);
 return <div className="flex min-h-screen bg-slate-50"><Sidebar activeItem="Other Charges"/><div className="min-w-0 flex-1">
  <header className="clinic-page-header m-4 rounded-3xl bg-linear-to-r from-indigo-700 via-violet-600 to-fuchsia-500 p-6 text-white shadow-xl shadow-violet-200/50 sm:m-6"><p className="text-sm text-violet-100">Billing add-ons and miscellaneous fees</p><h1 className="text-3xl font-bold">Other Charges</h1><p className="mt-2 text-violet-50">Add medical certificates, procedures, supplies, and any charge configured in Tools.</p></header>
  <main className="space-y-6 px-4 pb-10 sm:px-6">
   {patientFromUrl && <Link to="/billing" onClick={event=>{if(workspace && event.button===0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey){event.preventDefault();workspace.openTab("/billing")}}} className="inline-flex rounded-xl border border-pink-200 bg-white px-4 py-2 font-semibold text-pink-700">Back to Billing</Link>}
{notice&&<div role="status" className="flex justify-between rounded-2xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice("")}><X size={17}/></button></div>}
   <nav aria-label="Other Charges sections" className="flex flex-wrap gap-2">
    <a href="#add-charge" className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">Add a charge</a>
    <a href="#charge-history" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">View charge history ({charges.length})</a>
   </nav>
   <section id="add-charge" className="scroll-mt-20 rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="rounded-2xl bg-violet-50 p-3 text-violet-700"><Plus/></span><div><h2 className="text-xl font-bold">Add Other Charge</h2><p className="text-sm text-slate-500">Choose a patient, add a service or supply, then review the total before saving.</p></div></div>
    <form onSubmit={save} className="mt-6 space-y-6">
     <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <h3 className="mb-4 font-bold text-slate-800">1. Patient and case</h3>
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
     <PatientSearch patients={patients} value={form.patient_id} onChange={selectPatient}/>
     <Select label="Case number" value={form.consultation_case_id} onChange={set("consultation_case_id",form,setForm)}><option value="">OPD Walk-in</option>{cases.map(c=><option key={c.id} value={c.id}>{c.case_number} - {String(c.consultation_date).slice(0,10)}</option>)}</Select>
     {patients.find(p=>String(p.id)===String(form.patient_id))?.patient_number==="OPD-WALK-IN"&&<Field label="Patient full name" required value={form.walk_in_name||""} onChange={event=>setForm({...form,walk_in_name:event.target.value,certificate:form.certificate?{...form.certificate,recipient_name:event.target.value}:null})}/>}
      </div>
      <p className="mt-3 text-xs text-slate-500">Search for an existing patient, or enter the walk-in patient's name. Choose a consultation case or leave OPD Walk-in selected.</p>
     </section>
     <section>
      <h3 className="mb-3 font-bold text-slate-800">2. Select charges</h3>
      <div className="grid items-start gap-4 lg:grid-cols-2">
     <div className="rounded-2xl border border-slate-200 p-4 sm:p-5"><p className="mb-3 text-sm font-bold uppercase tracking-wide text-violet-700">Other Charges</p><Select label="Charge Type" value={form.charge_type_id} onChange={e=>selectType(e.target.value)} required={!form.inventory_item_id&&!inventoryCart.length}><option value="">Select configured charge</option>{types.map(t=><option key={t.id} value={t.id}>{t.name} — {money(t.default_amount)}</option>)}</Select>{/medical cert/i.test(`${types.find(t=>String(t.id)===String(form.charge_type_id))?.name} ${types.find(t=>String(t.id)===String(form.charge_type_id))?.category}`)&&<button type="button" onClick={()=>openCertificate()} className="mt-3 rounded-lg bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-800">{form.certificate?"Edit prepared certificate":"Open certificate form"}</button>}</div>
     <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4 sm:p-5"><div className="mb-3"><p className="text-sm font-bold uppercase tracking-wide text-teal-700">Inventory Item Charges</p><p className="text-xs text-slate-500">Search an item, set the quantity, then add it to the charge list. Saving deducts available, unexpired stock.</p></div><div className="grid gap-4"><div className="grid gap-1.5 text-sm font-semibold text-slate-600"><span>Search Inventory Item</span><input value={inventorySearch} onChange={event=>setInventorySearch(event.target.value)} placeholder="Search by item name or code" className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal"/><div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1">{inventoryMatches.length?inventoryMatches.map(item=><button key={item.id} type="button" onClick={()=>selectInventoryItem(item.id)} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${String(form.inventory_item_id)===String(item.id)?"bg-teal-100 text-teal-800":"hover:bg-slate-50"}`}><span>{item.item_code} — {item.item_name}</span><span className="text-right text-xs">{item.current_stock} available · {item.selling_price==null?"Set selling price in Inventory":money(item.selling_price)}</span></button>):<p className="p-3 text-sm font-normal text-slate-400">No inventory items found.</p>}</div></div><div className="grid content-start gap-3 sm:grid-cols-2"><Field label="Quantity" type="number" min="1" step="1" value={form.quantity} onChange={set("quantity",form,setForm)}/><Field label="Unit Price (from Inventory)" type="number" value={form.unit_amount} disabled/><button type="button" onClick={addInventoryItem} disabled={!form.inventory_item_id} className="rounded-xl bg-teal-600 px-4 py-2.5 font-bold text-white disabled:opacity-50 sm:col-span-2">Add item to charge list</button></div></div>{inventoryCart.length>0&&<div className="mt-4 rounded-xl bg-white p-3"><p className="font-bold text-teal-800">Items to charge</p>{inventoryCart.map((item,index)=><div key={`${item.inventory_item_id}-${index}`} className="mt-2 flex items-center justify-between gap-3 text-sm"><span>{item.item_name} — {item.quantity} × {money(item.unit_amount)}</span><button type="button" onClick={()=>removeInventoryItem(index)} className="text-rose-600">Remove</button></div>)}</div>}</div>

      </div>
     </section>
     <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <h3 className="mb-4 font-bold text-slate-800">3. Review billing details</h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
     <Field label="Unit amount" type="number" min="0" step=".01" value={form.unit_amount} onChange={set("unit_amount",form,setForm)} disabled={Boolean(form.inventory_item_id)} required={!inventoryCart.length}/><Field label="Charge Date" type="date" value={form.charge_date} onChange={set("charge_date",form,setForm)} required/>
     <Field label="Description" value={form.description} onChange={set("description",form,setForm)}/><Field label="Notes" value={form.notes} onChange={set("notes",form,setForm)}/>
      </div>
     </section>
     <div className="flex flex-col gap-4 rounded-2xl bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between">
     <div className="flex items-center justify-between gap-6"><span className="text-sm font-bold text-violet-600">Total Charge</span><strong className="text-xl text-violet-800">{money(payableTotal)}</strong></div>
     <div className="md:col-span-2 xl:col-span-3"><PermissionButton module="charges" action={"create"} disabled={saving||!form.patient_id||(!form.charge_type_id&&!form.inventory_item_id&&!inventoryCart.length)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-50 sm:w-auto"><PhilippinePeso size={18}/>{saving?"Adding...":"Add to Patient Bill"}</PermissionButton>{!types.length&&!inventoryItems.length&&<p className="mt-2 text-sm text-amber-600">Add an active charge type or inventory item first.</p>}</div>
     </div>
    </form>
   </section>
   <section id="charge-history" className="scroll-mt-20 rounded-3xl bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
     <div><h2 className="text-xl font-bold">Charge history</h2><p className="mt-1 text-sm text-slate-500">Select a row to view charge details, or use its actions to open a document or cancel the charge.</p></div>
     <label className="flex w-full items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 focus-within:ring-2 focus-within:ring-violet-400 sm:w-80"><Search size={18} className="shrink-0 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search charge history" placeholder="Patient, charge, case or invoice" className="min-w-0 w-full outline-none"/>{search&&<button type="button" aria-label="Clear search" onClick={()=>setSearch("")}><X size={16}/></button>}</label>
    </div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
     <div className="flex gap-1 rounded-xl bg-slate-100 p-1" aria-label="Filter charges">{["All","Active","Cancelled"].map(filter=><button key={filter} type="button" aria-pressed={historyFilter===filter} onClick={()=>setHistoryFilter(filter)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${historyFilter===filter?"bg-white text-violet-700 shadow-sm":"text-slate-600 hover:bg-white/60"}`}>{filter} <span className="ml-1 text-xs">{charges.filter(c=>filter==="All"||(filter==="Cancelled"?c.status==="Deleted":c.status!=="Deleted")).length}</span></button>)}</div>
     <p role="status" className="text-sm text-slate-500">Showing {list.length} of {charges.length} charges</p>
    </div>
    <div role="region" aria-label="Charge history" tabIndex={0} className="mt-4 max-h-[65dvh] overflow-auto rounded-xl border border-slate-200 focus-visible:outline-violet-500">
     <table className="w-full min-w-[850px] border-separate border-spacing-0 text-left text-sm">
      <thead className="sticky top-0 z-10 bg-slate-100"><tr>{["Charge / Date","Patient","Details","Amount","Invoice / Case","Status","Actions"].map(h=><th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600" key={h}>{h}</th>)}</tr></thead>
      <tbody>{list.length?list.map(c=><tr key={c.id} tabIndex={0} aria-label={`View details for ${c.charge_number}`} onClick={event=>{if(!event.target.closest("button, a, summary, details"))setDetailCharge(c)}} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==="Enter"||event.key===" ")){event.preventDefault();setDetailCharge(c)}}} className="cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-500 [&>td]:border-t [&>td]:border-slate-100 [&>td]:px-4 [&>td]:py-4 [&>td]:align-top hover:bg-violet-50/40">
       <td><strong className="whitespace-nowrap text-violet-700">{c.charge_number}</strong><small className="mt-1 block text-slate-500">{c.charge_date}</small></td>
       <td><span className="font-semibold text-slate-800">{c.patient_name}</span><small className="mt-1 block text-slate-500">{c.patient_number}</small></td>
       <td><span className="font-medium">{c.charge_name}</span><small className="mt-1 block text-slate-500">{c.category} ? Qty {c.quantity}</small></td>
       <td className="whitespace-nowrap font-bold text-slate-900">{money(c.total_amount)}</td>
       <td><span className="whitespace-nowrap">{c.invoice_number}</span><small className="mt-1 block text-slate-500">{c.case_number||"No linked case"}</small></td>
       <td><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${c.status==="Deleted"?"bg-rose-50 text-rose-700":c.payment_status==="Paid"?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800"}`}>{c.status==="Deleted"?"Cancelled":c.payment_status}</span>
        {c.status==="Deleted"&&<details className="mt-2 min-w-36 max-w-64 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-violet-700">Cancellation details</summary><p className="mt-2 whitespace-pre-wrap break-words">{c.notes?.replaceAll("Deleted by","Cancelled by")}</p></details>}
       </td>
       <td><div className="flex flex-col items-start gap-2">
        {c.status!=="Deleted"&&/medical cert/i.test(`${c.charge_name} ${c.category}`)&&<button type="button" onClick={()=>setCertificateCharge(c)} className="whitespace-nowrap rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-700">View certificate</button>}
        {c.status!=="Deleted"&&<PermissionButton module="charges" action="delete" type="button" onClick={()=>{setDeletingCharge(c);setDeleteReason("");setDeleteError("")}} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-200 px-3 py-2 font-semibold text-rose-700 hover:bg-rose-50"><XCircle size={15}/>Cancel charge</PermissionButton>}
        {c.status==="Deleted"&&<span className="text-xs text-slate-400">Kept in history</span>}
       </div></td>
      </tr>):<tr><td colSpan="7" className="p-10 text-center"><p className="font-semibold text-slate-700">{charges.length?"No charges match your search":"No charges yet"}</p><p className="mt-1 text-sm text-slate-500">{charges.length?"Try another name or change the status filter.":"Add a charge above to see it here."}</p>{charges.length>0&&<button type="button" onClick={()=>{setSearch("");setHistoryFilter("All")}} className="mt-3 font-semibold text-violet-700">Clear filters</button>}</td></tr>}</tbody>
     </table>
    </div>
   </section>
  </main>
  {detailCharge&&<ChargeDialog titleId="charge-details-title" onClose={()=>setDetailCharge(null)}>
   <section className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
    <header className="flex items-start justify-between gap-5 border-b border-slate-100 pb-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Charge details</p><h2 id="charge-details-title" className="mt-1 text-xl font-bold">{detailCharge.charge_number}</h2><p className="mt-1 text-sm text-slate-500">{detailCharge.charge_name}</p></div><button type="button" autoFocus aria-label="Close charge details" onClick={()=>setDetailCharge(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20}/></button></header>
    <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
     {[["Patient",detailCharge.patient_name],["Patient number",detailCharge.patient_number],["Charge type",detailCharge.charge_name],["Category",detailCharge.category],["Invoice number",detailCharge.invoice_number],["Case number",detailCharge.case_number||"No linked case"],["Charge date",detailCharge.charge_date],["Charge status",detailCharge.status==="Deleted"?"Cancelled":detailCharge.status],["Payment status",detailCharge.payment_status],["Recorded by",detailCharge.created_by],["Quantity",detailCharge.quantity],["Unit amount",detailCharge.items?.length>1?"See items below":money(detailCharge.unit_amount)]].map(([label,value])=><div key={label}><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value??"Not recorded"}</dd></div>)}
    </dl>
    <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-2">Item</th><th>Qty</th><th>Unit price</th><th>Amount</th><th>Document</th></tr></thead><tbody>{(detailCharge.items||[detailCharge]).map(item=><tr key={item.id} className="border-b border-slate-100"><td className="py-3"><strong>{item.charge_name}</strong><p className="text-xs text-slate-500">{item.description}</p></td><td>{item.quantity}</td><td>{money(item.unit_amount)}</td><td>{money(item.total_amount)}</td><td>{item.status!=="Deleted"&&/medical cert/i.test(`${item.charge_name} ${item.category}`)&&<button type="button" onClick={()=>{setDetailCharge(null);setCertificateCharge(item)}} className="rounded-lg bg-violet-50 px-2 py-1 text-violet-700">View certificate</button>}</td></tr>)}</tbody></table></div>
    <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-violet-50 p-4"><span className="font-semibold text-violet-800">Charge amount</span><strong className="text-xl text-violet-900">{money(detailCharge.total_amount)}</strong></div>
    <section className="mt-5"><h3 className="text-sm font-semibold text-slate-700">Description</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{detailCharge.description||"No description recorded."}</p></section>
    <section className="mt-4"><h3 className="text-sm font-semibold text-slate-700">{detailCharge.status==="Deleted"?"Notes and cancellation details":"Notes"}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{detailCharge.notes?.replaceAll("Deleted by","Cancelled by")||"No notes recorded."}</p></section>
    <footer className="mt-6 flex justify-end border-t border-slate-100 pt-4"><button type="button" onClick={()=>setDetailCharge(null)} className="rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white">Close details</button></footer>
   </section>
  </ChargeDialog>}
  {deletingCharge&&<ChargeDialog busy={deleting} onClose={()=>setDeletingCharge(null)}><form onSubmit={deleteCharge} role="dialog" aria-modal="true" aria-labelledby="delete-charge-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
   <h2 id="delete-charge-title" className="text-xl font-bold">Cancel charge {deletingCharge.charge_number}</h2>
   <p className="mt-2 text-sm text-slate-600">Review the charge and explain why it should be cancelled.</p>
   <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm"><div className="col-span-2"><dt className="text-xs text-slate-500">Patient</dt><dd className="font-semibold">{deletingCharge.patient_name}</dd></div><div><dt className="text-xs text-slate-500">Charge</dt><dd className="font-semibold">{deletingCharge.charge_name}</dd></div><div><dt className="text-xs text-slate-500">Amount</dt><dd className="font-bold">{money(deletingCharge.total_amount)}</dd></div><div className="col-span-2"><dt className="text-xs text-slate-500">Invoice</dt><dd>{deletingCharge.invoice_number}</dd></div></dl>
   <p className="mt-3 text-sm text-slate-600">All items under this charge number will be cancelled and the bill total updated. This charge and your reason stay in history.</p>
   <div className="mt-4 flex flex-wrap gap-2" aria-label="Suggested cancellation reasons">{["Duplicate charge","Incorrect item","Service not provided"].map(reason=><button key={reason} type="button" disabled={deleting} onClick={()=>setDeleteReason(reason)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">{reason}</button>)}</div>
   {deletingCharge.inventory_item_id&&<p className="mt-2 text-sm text-amber-700">This removes the bill charge. Record any physical stock return separately in Inventory.</p>}
   <label className="mt-4 grid gap-2 text-sm font-semibold">Reason for cancellation<textarea autoFocus required maxLength={1000} rows={3} placeholder="For example: This item was charged twice." value={deleteReason} onChange={event=>setDeleteReason(event.target.value)} disabled={deleting} className="rounded-xl border border-slate-300 p-3"/></label>
   {deleteError&&<p role="alert" className="mt-3 text-sm text-red-600">{deleteError}</p>}
   <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={deleting} onClick={()=>setDeletingCharge(null)} className="rounded-xl border px-4 py-2">Keep charge</button><PermissionButton module="charges" action="delete" disabled={deleting||!deleteReason.trim()} className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{deleting?"Cancelling...":"Cancel charge"}</PermissionButton></div>
  </form></ChargeDialog>}
  {certificateCharge&&<MedicalCertificateForm patients={patients} onDraftSave={certificateCharge.draft?saveDraft:undefined} charge={certificateCharge} onClose={()=>setCertificateCharge(null)} onSaved={load}/>}</div></div>
}
const set=(key,form,setForm)=>e=>setForm({...form,[key]:e.target.value});
function Field({label,...props}){return <label className="grid gap-1.5 text-sm font-semibold text-slate-600">{label}<input {...props} className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal"/></label>}
function Select({label,children,...props}){return <label className="grid gap-1.5 text-sm font-semibold text-slate-600">{label}<select {...props} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal disabled:bg-slate-100">{children}</select></label>}

function ChargeDialog({busy,onClose,children,titleId="delete-charge-title"}) {
 const dialog=useRef(null);
 useEffect(()=>{
  const element=dialog.current;
  element.showModal();
  return ()=>element.close();
 },[]);
 return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if(!busy)onClose()}} className="m-auto max-h-[95dvh] max-w-[calc(100vw-2rem)] rounded-2xl bg-transparent p-0 backdrop:bg-slate-950/40">{children}</dialog>;
}
