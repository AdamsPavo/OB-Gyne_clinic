import { can } from "../auth";
import PermissionButton from "./PermissionButton";
import { useState } from "react";
import { api } from "../api/client";
import { printMedicalCertificate } from "../utils/permissionedPrint";
import PatientSearch from "./PatientSearch";
import clinicLogo from "../assets/OBLOGO.png";

const fullName = patient => [patient?.first_name, patient?.middle_name, patient?.last_name].filter(Boolean).join(" ");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

export default function MedicalCertificateForm({ charge, patients = [], onClose, onSaved, onDraftSave }) {
  const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const canEdit = can("charges", "edit");
  const draft = Boolean(onDraftSave);
  const initial = typeof charge.certificate === "string" ? JSON.parse(charge.certificate) : charge.certificate || null;
  const [saved, setSaved] = useState(initial);
  const [editing, setEditing] = useState(canEdit && (draft || !initial));
  const [patientId, setPatientId] = useState(String(charge.patient_id || ""));
  const [form, setForm] = useState(initial || {
    issued_date: today(), examination_date: today(), recipient_name:charge.recipient_name||"",
    purpose: "This certificate is issued upon the patient's request for whatever lawful purpose it may serve.",
    findings: "", recommendations: "", physician: user.role === "doctor" ? (user.full_name || user.fullname || "") : "", license_number: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const patient = patients.find(item => String(item.id) === patientId);
  const walkIn = patient?.patient_number === "OPD-WALK-IN" || charge.patient_number === "OPD-WALK-IN";
  const patientName = walkIn ? form.recipient_name || "" : draft ? fullName(patient) : charge.patient_name;
  const patientNumber = draft ? patient?.patient_number : charge.patient_number;
  const update = key => event => setForm({ ...form, [key]: event.target.value });
  const inputClass = "rounded border border-slate-300 bg-slate-50 px-2 py-1.5 font-normal disabled:border-transparent disabled:bg-white";
  const print = event => {
    if (!event.currentTarget.form.reportValidity()) return;
    if (!patientName || !form.findings.trim() || !form.physician.trim()) {
      setError("Select a patient and complete the findings and physician name before printing.");
      return;
    }
    setError("");
    printMedicalCertificate({ ...charge, ...form, patient_name: patientName, patient_number: patientNumber });
  };
  const save = async event => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (draft) {
        await onDraftSave(form, patientId);
        onClose();
      } else {
        const result = await api(`/patient-charges/${charge.id}/certificate`, { method: "PUT", body: JSON.stringify(form) });
        setSaved(result.certificate); setForm(result.certificate); setEditing(false); await onSaved();
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="certificate-title">
    <form onSubmit={save} className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between gap-4"><h2 id="certificate-title" className="text-xl font-bold">Medical Certificate</h2><button type="button" disabled={busy} onClick={onClose}>Close</button></div>
      {error && <p role="alert" className="mt-3 text-red-600">{error}</p>}
      {!canEdit && !saved && <p className="mt-4">A doctor or administrator can complete this certificate.</p>}
      <fieldset disabled={!editing || busy} className="mt-5 space-y-6 rounded-lg border border-slate-200 p-5 sm:p-8">
        <div className="flex items-center justify-center gap-3 border-b border-slate-200 pb-5"><img src={clinicLogo} alt="Clinic logo" className="h-16 w-16 object-contain"/><div><p className="text-xl font-bold">OB-GYN Clinic</p><p className="text-sm text-slate-500">Medical Certificate</p></div></div>
        <div className="flex flex-wrap justify-between gap-3 text-sm"><span>{patientNumber || "Patient number"}{charge.charge_number ? ` / MC-${charge.charge_number}` : ""}</span><label>Issue date <input aria-label="Issue date" type="date" required value={form.issued_date} onChange={update("issued_date")} className={inputClass}/></label></div>
        {draft && <PatientSearch patients={patients} value={patientId} onChange={value => {setPatientId(value);setForm(current=>({...current,recipient_name:"",findings:"",recommendations:""}));}}/>}
        {walkIn && <label className="grid gap-1 text-sm font-semibold">Certificate recipient's full name<input required value={form.recipient_name||""} onChange={update("recipient_name")} className={inputClass}/></label>}
        <h3 className="text-center text-xl font-bold uppercase tracking-wide">Medical Certificate</h3>
        <p className="font-semibold">To whom it may concern:</p>
        <div className="leading-8">This is to certify that <strong>{patientName || "[Patient name]"}</strong> was examined on <input aria-label="Examination date" type="date" required value={form.examination_date} onChange={update("examination_date")} className={inputClass}/> with the following findings:</div>
        <label className="grid gap-2 text-sm font-semibold">Clinical findings / diagnosis<textarea required rows={3} value={form.findings} placeholder="Enter the patient's clinical findings or diagnosis" onChange={update("findings")} className={inputClass}/></label>
        <label className="grid gap-2 text-sm font-semibold">Recommendations / rest period<textarea rows={3} value={form.recommendations} placeholder="Enter recommendations and rest dates, if applicable" onChange={update("recommendations")} className={inputClass}/></label>
        <label className="grid gap-2 text-sm font-semibold">Purpose / issuance statement<textarea rows={3} value={form.purpose} onChange={update("purpose")} className={inputClass}/></label>
        <div className="ml-auto grid max-w-xs gap-3 pt-6 text-sm"><label className="grid gap-1">Physician name<input required value={form.physician} onChange={update("physician")} className={inputClass}/></label><label className="grid gap-1">License number<input value={form.license_number} onChange={update("license_number")} className={inputClass}/></label><p className="mt-5 border-t border-slate-400 pt-2 text-center">Physician signature</p></div>
      </fieldset>
      <div className="mt-5 flex flex-wrap gap-3">
        {canEdit && (editing ? <button disabled={busy} className="rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white">{busy ? "Saving..." : draft ? "Use certificate & return to charges" : "Save certificate"}</button> : <button type="button" onClick={() => setEditing(true)} className="rounded-xl border px-4 py-2">Edit certificate</button>)}
        {(canEdit || saved) && <PermissionButton module="charges" action="print" type="button" disabled={busy} onClick={print} className="rounded-xl bg-slate-800 px-4 py-2 font-semibold text-white disabled:opacity-50">Print certificate</PermissionButton>}
      </div>
      {draft && <p className="mt-3 text-sm text-slate-500">The certificate is saved with the charge when you select Add to Patient Bill.</p>}
    </form>
  </div>;
}
