import PermissionButton from "../components/PermissionButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhilippinePeso, Plus, Search, X } from "lucide-react";
import PatientSearch from "../components/PatientSearch";
import MedicalCertificateForm from "../components/MedicalCertificateForm";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";
import { useSearchParams } from "react-router-dom";

const today=()=>new Date().toISOString().slice(0,10);
const blank={patient_id:"",walk_in_name:"",charge_type_id:"",inventory_item_id:"",consultation_case_id:"",quantity:"1",unit_amount:"",description:"",charge_date:today(),notes:""};
const money=v=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(v||0));

export default function PatientCharges(){
 const [searchParams]=useSearchParams();
 const patientFromUrl=searchParams.get("patient")||"";
 const caseFromUrl=searchParams.get("case")||"";
 const [patients,setPatients]=useState([]),[types,setTypes]=useState([]),[inventoryItems,setInventoryItems]=useState([]),[inventoryCart,setInventoryCart]=useState([]),[charges,setCharges]=useState([]),[cases,setCases]=useState([]),[form,setForm]=useState(blank),[search,setSearch]=useState(""),[inventorySearch,setInventorySearch]=useState(""),[notice,setNotice]=useState(""),[saving,setSaving]=useState(false);
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
   setNotice(`${lines.length} charge(s) added to invoice ${result.invoice_number}. Medical certificate forms are available in Charge History.`);
   setForm({...blank,charge_date:today()});setInventoryCart([]);setCases([]);await load();
   const certificateLine=lines.findIndex(line=>line.certificate);
   if(certificateLine>=0){const patient=patients.find(p=>String(p.id)===String(form.patient_id));setCertificateCharge({...result.charges[certificateLine],patient_id:form.patient_id,patient_name:[patient?.first_name,patient?.middle_name,patient?.last_name].filter(Boolean).join(" "),patient_number:patient?.patient_number,certificate:lines[certificateLine].certificate});}
  }catch(x){setNotice(x.message)}finally{setSaving(false)}
 };

 const list=useMemo(()=>charges.filter(c=>`${c.charge_number} ${c.patient_name} ${c.charge_name} ${c.invoice_number}`.toLowerCase().includes(search.toLowerCase())),[charges,search]);
 return <div className="flex min-h-screen bg-slate-50"><Sidebar activeItem="Other Charges"/><div className="min-w-0 flex-1">
  <header className="clinic-page-header m-4 rounded-3xl bg-linear-to-r from-indigo-700 via-violet-600 to-fuchsia-500 p-6 text-white shadow-xl shadow-violet-200/50 sm:m-6"><p className="text-sm text-violet-100">Billing add-ons and miscellaneous fees</p><h1 className="text-3xl font-bold">Other Charges</h1><p className="mt-2 text-violet-50">Add medical certificates, procedures, supplies, and any charge configured in Tools.</p></header>
  <main className="space-y-6 px-4 pb-10 sm:px-6">{notice&&<div className="flex justify-between rounded-2xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">{notice}<button onClick={()=>setNotice("")}><X size={17}/></button></div>}
   <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="rounded-2xl bg-violet-50 p-3 text-violet-700"><Plus/></span><div><h2 className="text-xl font-bold">Add Other Charge</h2><p className="text-sm text-slate-500">Prices come from Tools but may be adjusted for this transaction.</p></div></div>
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
     <div className="md:col-span-2 xl:col-span-3"><PermissionButton module="charges" action={"create"} disabled={saving||(!types.length&&!inventoryItems.length)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-50 sm:w-auto"><PhilippinePeso size={18}/>{saving?"Adding...":"Add to Patient Bill"}</PermissionButton>{!types.length&&!inventoryItems.length&&<p className="mt-2 text-sm text-amber-600">Add an active charge type or inventory item first.</p>}</div>
     </div>
    </form>
   </section>
   <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">Charge History</h2><p className="text-sm text-slate-500">{list.length} of {charges.length} patient charge{charges.length===1?"":"s"}</p></div><label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 sm:w-72"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search charge history" placeholder="Patient, charge or invoice" className="min-w-0 w-full outline-none"/></label></div>
    <div role="region" aria-label="Charge history" tabIndex={0} className="mt-5 max-h-[calc(100dvh-14rem)] min-h-40 overflow-auto overscroll-contain rounded-xl border border-slate-200"><table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:whitespace-nowrap"><thead className="sticky top-0 z-10 bg-slate-100 shadow-sm"><tr className="border-b text-xs uppercase text-slate-400">{["Charge #","Patient","Charge","Case","Quantity","Amount","Invoice","Status","Date","Document"].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{list.length?list.map(c=><tr key={c.id} className="border-b border-slate-100 even:bg-slate-50/70 hover:bg-violet-50/50"><td className="p-3 font-bold text-violet-700">{c.charge_number}</td><td>{c.patient_name}<small className="block text-slate-400">{c.patient_number}</small></td><td>{c.charge_name}<small className="block text-slate-400">{c.category}</small></td><td>{c.case_number||"Standalone"}</td><td>{c.quantity}</td><td className="font-bold">{money(c.total_amount)}</td><td>{c.invoice_number}</td><td>{c.payment_status}</td><td>{c.charge_date}</td><td>{/medical cert/i.test(`${c.charge_name} ${c.category}`)&&<button type="button" onClick={()=>setCertificateCharge(c)} className="rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">Medical certificate</button>}</td></tr>):<tr><td colSpan="10" className="p-10 text-center text-slate-400">No patient charges yet.</td></tr>}</tbody></table></div>
   </section>
  </main>{certificateCharge&&<MedicalCertificateForm patients={patients} onDraftSave={certificateCharge.draft?saveDraft:undefined} charge={certificateCharge} onClose={()=>setCertificateCharge(null)} onSaved={load}/>}</div></div>
}
const set=(key,form,setForm)=>e=>setForm({...form,[key]:e.target.value});
function Field({label,...props}){return <label className="grid gap-1.5 text-sm font-semibold text-slate-600">{label}<input {...props} className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal"/></label>}
function Select({label,children,...props}){return <label className="grid gap-1.5 text-sm font-semibold text-slate-600">{label}<select {...props} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal disabled:bg-slate-100">{children}</select></label>}
