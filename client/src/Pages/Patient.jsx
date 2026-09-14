import { can } from "../auth";
import PermissionButton from "../components/PermissionButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Plus, Search, Trash2 as Archive, Users, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useWorkspace } from "../components/Workspace";
import { api } from "../api/client";

const blank = { first_name: "", middle_name: "", last_name: "", birth_date: "", civil_status: "", occupation: "", address: "", blood_type: "", allergies: "", existing_illnesses: "", previous_surgeries: "", family_history: "", ob_history: "", pregnancy_history: "", notes: "" };
const normalizePatientName = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const age = (date) => date ? Math.floor((Date.now() - new Date(date).getTime()) / 31557600000) : "—";

export default function Patient() {
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const [patients, setPatients] = useState([]), [search, setSearch] = useState(""), [form, setForm] = useState(blank), [show, setShow] = useState(false), [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);
  const duplicate = useMemo(() => {
    if (!form.birth_date || !normalizePatientName(form.first_name) || !normalizePatientName(form.last_name)) return null;
    return patients.find((patient) => patient.birth_date === form.birth_date &&
      ["first_name", "middle_name", "last_name"].every((key) => normalizePatientName(patient[key]) === normalizePatientName(form[key])));
  }, [patients, form]);
  const load = () => api("/patients").then(setPatients).catch((error) => setMessage(error.message));
  useEffect(() => { load(); }, []);
  const rows = useMemo(() => patients.filter((patient) => `${patient.patient_number} ${patient.first_name} ${patient.last_name} ${patient.contact_number || ""}`.toLowerCase().includes(search.toLowerCase())), [patients, search]);
  const save = async (event) => {
  event.preventDefault();
  if (saveInProgress.current || duplicate) return;
  saveInProgress.current = true;
  setSaving(true);

  try {
    setMessage("");

    const newPatient = await api("/patients", {
      method: "POST",
      body: JSON.stringify(form),
    });

    // Refresh patient list
    await load();

    // Reset form
    setForm(blank);

    // Close modal
    setShow(false);

    // Redirect to Appointment page
    const appointmentPath = can("appointments") ? `/appointments?patient=${newPatient.id}` : `/patients/${newPatient.id}`;
    if (workspace) workspace.openTab(appointmentPath);
    else navigate(appointmentPath);

  } catch (error) {
    setMessage(error.message);
  } finally {
    saveInProgress.current = false;
    setSaving(false);
  }
};

  const archive = async (id) => { if (!confirm("Permanently delete this patient and ALL related clinical and billing transactions? This cannot be undone.")) return; await api(`/patients/${id}`, { method: "DELETE" }); load(); };
  const input = (key, label, type = "text") => <label className="text-sm font-medium text-slate-600">{label}<input type={type} required={["first_name", "last_name"].includes(key)} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>;
  return <div className={`flex min-h-0 bg-slate-50 ${workspace ? "h-[calc(100dvh-3rem)]" : "h-dvh"}`}><Sidebar activeItem="Patients" /><div className="flex min-h-0 min-w-0 flex-1 flex-col"><header className="clinic-page-header m-4 flex shrink-0 flex-wrap items-center justify-between gap-4 rounded-3xl bg-linear-to-r from-pink-600 to-rose-400 p-6 text-white sm:m-6"><div><p className="text-sm text-pink-100">Patient Management</p><h1 className="text-3xl font-bold">Patients</h1></div><PermissionButton module="patients" action={"create"} onClick={() => setShow(true)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-pink-600"><Plus size={19} />Add patient</PermissionButton></header><main className="flex min-h-0 flex-1 flex-col px-4 pb-8 sm:px-6"><section className="flex min-h-0 flex-col rounded-3xl bg-white p-5 shadow-sm"><div className="flex shrink-0 items-center gap-3"><Users className="text-pink-600" /><div><h2 className="font-bold text-slate-800">Patient directory</h2><p className="text-sm text-slate-500">{patients.length} active patient{patients.length === 1 ? "" : "s"}</p></div></div><label className="mt-5 flex max-w-xl shrink-0 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5"><Search size={18} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, patient number, or contact" className="w-full outline-none" /></label>{message && <p className="mt-3 text-sm text-red-600">{message}</p>}<div tabIndex={0} role="region" aria-label="Patient list" className="mt-5 min-h-0 overflow-auto overscroll-contain"><table className="w-full min-w-212.5 text-left"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b text-xs uppercase text-slate-400"><th className="p-3">Patient</th><th className="p-3">Number</th><th className="p-3">Age</th><th className="p-3">Contact</th><th className="p-3">Last visit</th><th /></tr></thead><tbody>{rows.length ? rows.map((patient) => <tr key={patient.id} className="border-b border-slate-50"><td className="p-3 font-semibold"><Link to={`/patients/${patient.id}`} className="hover:text-pink-600 hover:underline">{patient.last_name}, {patient.first_name} {patient.middle_name || ""}</Link></td><td className="p-3 text-pink-600">{patient.patient_number}</td><td className="p-3">{age(patient.birth_date)}</td><td className="p-3">{patient.contact_number || "—"}</td><td className="p-3">{patient.last_visit?.slice(0, 10) || "No consultation"}</td><td className="whitespace-nowrap p-3"><Link to={`/patients/${patient.id}`} className="mr-1 inline-flex rounded-lg p-2 text-slate-500 hover:bg-pink-50 hover:text-pink-600" title="Open patient record"><Eye size={18} /></Link><PermissionButton module="patients" action={"delete"} onClick={() => archive(patient.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Archive"><Archive size={18} /></PermissionButton></td></tr>) : <tr><td colSpan="6" className="p-8 text-center text-sm text-slate-500">No patients found.</td></tr>}</tbody></table></div></section></main></div>{show && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4"><form onSubmit={save} onChange={() => setMessage("")} className="mx-auto my-8 max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-xl font-bold">Register patient</h2><p className="text-sm text-slate-500">One profile is retained across all future consultations.</p></div><button type="button" onClick={() => setShow(false)}><X /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-3">{input("first_name", "First name")}{input("middle_name", "Middle name")}{input("last_name", "Last name")}{input("birth_date", "Birthdate", "date")}<label className="text-sm font-medium text-slate-600">Civil status<select value={form.civil_status} onChange={(event) => setForm({ ...form, civil_status: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="">Select civil status</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option><option value="Divorced">Divorced</option></select></label>{input("occupation", "Occupation")}{input("blood_type", "Blood type")}</div><label className="mt-4 block text-sm font-medium text-slate-600">Address<textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label><div className="mt-4 grid gap-4 sm:grid-cols-2">{["allergies", "existing_illnesses", "previous_surgeries", "family_history", "ob_history", "pregnancy_history", "notes"].map((key) => <label key={key} className="text-sm font-medium capitalize text-slate-600">{key.replaceAll("_", " ")}<textarea value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label>)}</div>{duplicate && <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">A patient with this full name and birthdate already exists: <strong>{duplicate.patient_number}</strong>. <Link to={`/patients/${duplicate.id}`} className="font-semibold underline">Open existing patient record</Link> or correct the registration details.</div>}{message && <p role="alert" className="mt-4 text-sm text-red-600">{message}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShow(false)} className="px-4">Cancel</button><PermissionButton module="patients" action={"create"} disabled={saving || Boolean(duplicate)} className="rounded-xl bg-pink-600 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save patient"}</PermissionButton></div></form></div>}</div>;
}
