import { useState } from "react";

export default function PatientSearch({ patients, value, onChange }) {
  const [search, setSearch] = useState("");
  const name = patient => [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
  const selected = patients.find(patient => patient.patient_number !== "OPD-WALK-IN" && String(patient.id) === String(value));
  const matches = patients.filter(patient => patient.patient_number !== "OPD-WALK-IN" && `${name(patient)} ${patient.patient_number}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 10);
  const choose = id => { onChange(String(id)); setSearch(""); };
  return <div className="space-y-2 text-sm">
    <label className="grid gap-1 font-semibold">Search patient<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search patient name or number" className="rounded-lg border border-slate-300 p-2 font-normal"/></label>
    {search.trim() && <div className="max-h-48 overflow-y-auto rounded-lg border bg-white">{matches.length ? matches.map(patient => <button type="button" key={patient.id} onClick={() => choose(patient.id)} className="block w-full px-3 py-2 text-left hover:bg-violet-50">{name(patient)} ({patient.patient_number})</button>) : <p className="p-3">No matching patients.</p>}</div>}

    <p className="rounded-lg bg-slate-50 p-2">Selected patient: <strong>{selected ? name(selected) : "None"}</strong></p>
  </div>;
}
