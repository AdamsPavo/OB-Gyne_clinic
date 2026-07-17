import { useEffect, useState } from "react";
import { ArrowLeft, Eye, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";
import { printCase } from "../utils/print";

const dash = (value) => value || "—";

export default function PatientProfile() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null), [cases, setCases] = useState([]), [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api(`/patients/${id}`), api(`/patients/${id}/cases`)])
      .then(([profile, encounters]) => { setPatient(profile); setCases(encounters); })
      .catch((error) => setError(error.message));
  }, [id]);
  const printConsultation = async (caseId) => { try { printCase(await api(`/cases/${caseId}`)); } catch (error) { setError(error.message); } };
  if (!patient) return <p className="p-8 text-slate-600">{error || "Loading patient record…"}</p>;
  const name = `${patient.first_name} ${patient.middle_name || ""} ${patient.last_name}`.replace(/\s+/g, " ").trim();
  return <div className="flex min-h-screen bg-slate-50"><Sidebar activeItem="Patients" /><div className="min-w-0 flex-1"><header className="m-4 rounded-3xl bg-linear-to-r from-pink-600 to-rose-400 p-6 text-white sm:m-6"><Link to="/patients" className="inline-flex items-center gap-1 text-sm text-pink-100"><ArrowLeft size={16} />Patients</Link><h1 className="mt-4 text-3xl font-bold">{name}</h1><p className="text-pink-100">Patient No. {patient.patient_number}</p></header><main className="space-y-6 px-4 pb-8 sm:px-6">{error && <p className="text-red-600">{error}</p>}<section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Patient details</h2><div className="mt-4 grid gap-4 sm:grid-cols-3">{[["Birthdate", patient.birth_date], ["Contact", patient.contact_number], ["Blood type", patient.blood_type], ["Address", patient.address], ["Allergies", patient.allergies], ["Existing illnesses", patient.existing_illnesses], ["OB history", patient.ob_history], ["Pregnancy history", patient.pregnancy_history], ["Notes", patient.notes]].map(([label, value]) => <div key={label}><p className="text-xs font-semibold uppercase text-slate-400">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm">{dash(value)}</p></div>)}</div></section><section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Consultation records</h2><p className="mt-1 text-sm text-slate-500">Open a case to view consultation details, medicine prescriptions, and laboratory requests.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-180 text-left"><thead><tr className="border-b text-xs uppercase text-slate-400"><th className="p-3">Case</th><th className="p-3">Date</th><th className="p-3">Complaint</th><th className="p-3">Follow-up</th><th /></tr></thead><tbody>{cases.length ? cases.map((item) => <tr key={item.id} className="border-b"><td className="p-3 font-semibold text-teal-700"><Link to={`/cases/${item.id}`} className="hover:underline">{item.case_number}</Link></td><td className="p-3">{item.consultation_date}</td><td className="p-3">{dash(item.chief_complaint)}</td><td className="p-3">{dash(item.follow_up_date)}</td><td className="p-3 whitespace-nowrap"><Link to={`/cases/${item.id}`} className="mr-2 inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><Eye size={15} />Open</Link><button onClick={() => printConsultation(item.id)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><Printer size={15} />Print</button></td></tr>) : <tr><td colSpan="5" className="p-6 text-center text-sm text-slate-500">No consultation records.</td></tr>}</tbody></table></div></section></main></div></div>;
}
