import { useEffect, useMemo, useState } from "react";
import { PhilippinePeso, Plus, Search, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";
import { useSearchParams } from "react-router-dom";

const today=()=>new Date().toISOString().slice(0,10);
const blank={patient_id:"",charge_type_id:"",consultation_case_id:"",quantity:"1",unit_amount:"",description:"",charge_date:today(),notes:""};
const money=v=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(v||0));

export default function PatientCharges(){
 const [searchParams]=useSearchParams();
 const patientFromUrl=searchParams.get("patient")||"";
 const caseFromUrl=searchParams.get("case")||"";
 const [patients,setPatients]=useState([]),[types,setTypes]=useState([]),[charges,setCharges]=useState([]),[cases,setCases]=useState([]),[form,setForm]=useState(blank),[search,setSearch]=useState(""),[notice,setNotice]=useState(""),[saving,setSaving]=useState(false);
 const load=async()=>{try{const [p,t,c,patientCases]=await Promise.all([api("/patients"),api("/charge-types"),api("/patient-charges"),patientFromUrl?api(`/patients/${patientFromUrl}/cases`):Promise.resolve([])]);setPatients(p);setTypes(t);setCharges(c);setCases(patientCases);if(patientFromUrl)setForm(current=>({...current,patient_id:patientFromUrl,consultation_case_id:caseFromUrl}))}catch(e){setNotice(e.message)}};
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{load()},[]);
 const selectPatient=async value=>{setForm({...form,patient_id:value,consultation_case_id:""});try{setCases(value?await api(`/patients/${value}/cases`):[])}catch(e){setNotice(e.message)}};
 const selectType=value=>{const selected=types.find(t=>String(t.id)===String(value));setForm({...form,charge_type_id:value,unit_amount:selected?.default_amount??"",description:selected?.description||""})};
 const total=(Number(form.quantity)||0)*(Number(form.unit_amount)||0);
 const save=async e=>{e.preventDefault();if(!confirm(`Add this ${money(total)} charge to the patient's bill?`))return;try{setSaving(true);const current=JSON.parse(localStorage.getItem("currentUser")||"{}");const r=await api("/patient-charges",{method:"POST",body:JSON.stringify({...form,created_by:current.fullname||current.username})});setNotice(`${r.charge_number} added to invoice ${r.invoice_number}.`);setForm(blank);setCases([]);await load()}catch(x){setNotice(x.message)}finally{setSaving(false)}};
 const list=useMemo(()=>charges.filter(c=>`${c.charge_number} ${c.patient_name} ${c.charge_name} ${c.invoice_number}`.toLowerCase().includes(search.toLowerCase())),[charges,search]);
 return <div className="flex min-h-screen bg-slate-50"><Sidebar activeItem="Patient Charges"/><div className="min-w-0 flex-1">
  <header className="m-4 rounded-3xl bg-linear-to-r from-indigo-700 via-violet-600 to-fuchsia-500 p-6 text-white shadow-xl shadow-violet-200/50 sm:m-6"><p className="text-sm text-violet-100">Billing add-ons and miscellaneous fees</p><h1 className="text-3xl font-bold">Patient Charges</h1><p className="mt-2 text-violet-50">Add medical certificates, procedures, supplies, and any charge configured in Tools.</p></header>
  <main className="space-y-6 px-4 pb-10 sm:px-6">{notice&&<div className="flex justify-between rounded-2xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">{notice}<button onClick={()=>setNotice("")}><X size={17}/></button></div>}
   <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="rounded-2xl bg-violet-50 p-3 text-violet-700"><Plus/></span><div><h2 className="text-xl font-bold">Add Patient Charge</h2><p className="text-sm text-slate-500">Prices come from Tools but may be adjusted for this transaction.</p></div></div>
    <form onSubmit={save} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
     <Select label="Patient" value={form.patient_id} onChange={e=>selectPatient(e.target.value)} required><option value="">Select patient</option>{patients.map(p=><option key={p.id} value={p.id}>{p.patient_number} — {p.last_name}, {p.first_name}</option>)}</Select>
     <Select label="Charge Type" value={form.charge_type_id} onChange={e=>selectType(e.target.value)} required><option value="">Select configured charge</option>{types.map(t=><option key={t.id} value={t.id}>{t.name} — {money(t.default_amount)}</option>)}</Select>
     <Select label="Consultation Case (optional)" value={form.consultation_case_id} onChange={set("consultation_case_id",form,setForm)} disabled={!form.patient_id}><option value="">Standalone miscellaneous bill</option>{cases.map(c=><option key={c.id} value={c.id}>{c.case_number} — {String(c.consultation_date).slice(0,10)}</option>)}</Select>
     <Field label="Quantity" type="number" min="1" value={form.quantity} onChange={set("quantity",form,setForm)} required/><Field label="Unit Amount" type="number" min="0" step=".01" value={form.unit_amount} onChange={set("unit_amount",form,setForm)} required/><Field label="Charge Date" type="date" value={form.charge_date} onChange={set("charge_date",form,setForm)} required/>
     <Field label="Description" value={form.description} onChange={set("description",form,setForm)}/><Field label="Notes" value={form.notes} onChange={set("notes",form,setForm)}/>
     <div className="flex items-center justify-between rounded-2xl bg-violet-50 px-4 py-3"><span className="text-sm font-bold text-violet-600">Total Charge</span><strong className="text-xl text-violet-800">{money(total)}</strong></div>
     <div className="md:col-span-2 xl:col-span-3"><button disabled={saving||!types.length} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-50"><PhilippinePeso size={18}/>{saving?"Adding...":"Add to Patient Bill"}</button>{!types.length&&<p className="mt-2 text-sm text-amber-600">Add an active charge type in Tools first.</p>}</div>
    </form>
   </section>
   <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">Charge History</h2><p className="text-sm text-slate-500">{charges.length} patient charge{charges.length===1?"":"s"}</p></div><label className="flex items-center gap-2 rounded-xl border px-3 py-2"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search charges"/></label></div>
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-225 text-left"><thead><tr className="border-b text-xs uppercase text-slate-400">{["Charge #","Patient","Charge","Case","Quantity","Amount","Invoice","Status","Date"].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{list.length?list.map(c=><tr key={c.id} className="border-b border-slate-100"><td className="p-3 font-bold text-violet-700">{c.charge_number}</td><td>{c.patient_name}<small className="block text-slate-400">{c.patient_number}</small></td><td>{c.charge_name}<small className="block text-slate-400">{c.category}</small></td><td>{c.case_number||"Standalone"}</td><td>{c.quantity}</td><td className="font-bold">{money(c.total_amount)}</td><td>{c.invoice_number}</td><td>{c.payment_status}</td><td>{c.charge_date}</td></tr>):<tr><td colSpan="9" className="p-10 text-center text-slate-400">No patient charges yet.</td></tr>}</tbody></table></div>
   </section>
  </main></div></div>
}
const set=(key,form,setForm)=>e=>setForm({...form,[key]:e.target.value});
function Field({label,...props}){return <label className="grid gap-1.5 text-sm font-semibold text-slate-600">{label}<input {...props} className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal"/></label>}
function Select({label,children,...props}){return <label className="grid gap-1.5 text-sm font-semibold text-slate-600">{label}<select {...props} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal disabled:bg-slate-100">{children}</select></label>}
