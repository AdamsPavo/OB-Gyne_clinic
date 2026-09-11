import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Baby, Plus, Search, ArrowLeft, RefreshCw } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";

const input = "mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
const button = "inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const card = "rounded-3xl border border-slate-100 bg-white p-5 shadow-sm";
const date = (value) => value ? String(value).replace("T", " ").slice(0, 16) : "Not recorded";
const name = (record) => [record.first_name, record.middle_name, record.last_name].filter(Boolean).join(" ");
const ga = (value) => value ? `${value.weeks} weeks ${value.days} days` : "Not available";
const riskClass = (level) => level === "High Risk" ? "bg-rose-50 text-rose-700" : level === "Needs Monitoring" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700";
const risk = (record) => record.risk_level || record.suggested_risk?.level || "Low Risk";
const show = (value) => value === null || value === undefined || value === "" ? "Not recorded" : value;

function Field({ label, value, onChange, type = "text", options, required = false }) {
  return <label className="block text-sm font-medium text-slate-600">{label}
    {options ? <select required={required} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={input}>{options.map((option) => <option key={option} value={option}>{option || "Select"}</option>)}</select>
      : type === "textarea" ? <textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={input} />
      : <input required={required} type={type} step={type === "number" ? "any" : undefined} min={type === "number" ? "0" : undefined} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={input} />}
  </label>;
}
function Info({ label, value }) { return <div className="min-w-0 rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-800">{show(value)}</p></div>; }

function Editor({ title, record, fields, onSaved, extra = {}, saveLabel = "Save changes" }) {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(([key]) => [key, record[key] ?? ""])));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  return <form onSubmit={async (e) => {
    e.preventDefault(); if (saving) return; setSaving(true); setMessage("");
    try { await api(`/pregnancies/${record.id}`, { method: "PATCH", body: JSON.stringify({ ...form, ...extra }) }); await onSaved(); setMessage("Saved."); }
    catch (error) { setMessage(error.message); } finally { setSaving(false); }
  }} className={card}>
    <h2 className="text-lg font-bold text-slate-800">{title}</h2>
    <fieldset disabled={saving} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([key, label, type, options]) => <Field key={key} label={label} type={type} options={options} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} />)}
    </fieldset>
    <button disabled={saving} className={`${button} mt-4`}>{saving ? "Saving..." : saveLabel}</button>
    {message && <p role="status" className="mt-3 text-sm text-slate-700">{message}</p>}
  </form>;
}

function Trend({ title, points, lines }) {
  return <div className="min-w-0 rounded-2xl border border-slate-200 p-3"><h3 className="mb-3 text-sm font-semibold">{title}</h3>
    <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 8, right: 12, bottom: 8, left: -10 }}>
      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} /><Tooltip /><Legend />
      {lines.map(([key, label, color]) => <Line key={key} type="linear" dataKey={key} name={label} stroke={color} connectNulls={false} isAnimationActive={false} />)}
    </LineChart></ResponsiveContainer></div>
  </div>;
}

function PregnancyDetail({ record, onSaved, siblings }) {
  const [moving, setMoving] = useState(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [moveMessage, setMoveMessage] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);
  const points = record.visits.map((visit) => {
    const bp = String(visit.blood_pressure || "").match(/^(\d+)\s*\/\s*(\d+)$/);
    const numeric = (value) => value == null || value === "" ? null : Number(value);
    return { date: visit.visit_date?.slice(0, 10), systolic: bp ? +bp[1] : null, diastolic: bp ? +bp[2] : null,
      weight: numeric(visit.weight_kg), fhr: numeric(visit.fetal_heart_rate), fundal: numeric(visit.fundal_height_cm),
      ga: visit.current_dating_ga ? Number((visit.current_dating_ga.weeks + visit.current_dating_ga.days / 7).toFixed(1)) : null };
  });
  const summaryFields = [["status","Pregnancy status","select",["Active","Delivered","Completed","Closed","Needs review"]], ["lmp_date","LMP","date"],
    ["ultrasound_edd","Ultrasound EDD","date"],["manual_edd","Doctor-corrected EDD","date"],["edd_source","Official EDD source","select",["LMP","Ultrasound","Manual"]],
    ["gravida","Gravida","number"],["para","Para","number"],["abortion_count","Abortions","number"],["living_children","Living children","number"],["maternal_history","Important maternal history / conditions","textarea"]];
  const deliveryFields = [["actual_delivery_date","Actual delivery date","date"],["delivery_location","Delivery location"],["delivery_mode","Mode of delivery"],
    ["delivery_complications","Delivery complications","textarea"],["baby_sex","Baby sex"],["birth_weight_kg","Birth weight (kg)","number"],["birth_outcome","Baby outcome / birth status"],
    ["apgar","APGAR (include assessment times)"],["maternal_outcome","Maternal outcome"],["delivery_notes","Delivery notes / additional babies","textarea"]];
  return <div className="space-y-5">
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-pink-600">{record.pregnancy_number}</p><h1 className="text-2xl font-bold">{name(record)}</h1><p className="text-sm text-slate-500">{record.patient_number} · {record.status}</p></div>
        {record.status === "Active" && <Link className={button} to={`/consultations/new?prenatal=1&patient=${record.patient_id}&pregnancy=${record.id}`}><Plus size={17} />Add prenatal consultation</Link>}
      </div>
      {record.status === "Needs review" && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Historical visits were grouped by matching documented LMP. Review this pregnancy, move any misplaced visits, and select Active only if this is the current pregnancy.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="LMP" value={date(record.lmp_date)} /><Info label="LMP-based EDD" value={date(record.lmp_edd)} /><Info label="Ultrasound EDD" value={date(record.ultrasound_edd)} /><Info label={`Official EDD · ${record.edd_source}`} value={date(record.official_edd)} />
        <Info label={`Gestational age as of ${date(record.ga_reference_date)}`} value={ga(record.current_ga)} /><Info label="First prenatal visit" value={date(record.first_visit_date)} /><Info label="Prenatal visits" value={record.visit_count} /><Info label="Attending doctor" value={record.doctor_name} />
      </div>
    </section>
    <Editor key={`summary-${record.id}-${record.updated_at}`} title="Pregnancy summary" record={record} fields={summaryFields} onSaved={onSaved} />
    <section className={card}>
      <h2 className="text-lg font-bold">Pregnancy risk assessment</h2>
      <p className="mt-2 text-sm text-slate-600">Decision support based on recorded visits. The doctor must review the reasons and confirm or override the classification. This summary does not diagnose a condition.</p>
      <div className="mt-3 flex flex-wrap gap-3"><span className={`rounded-full px-3 py-1 text-sm font-semibold ${riskClass(record.suggested_risk.level)}`}>Suggested: {record.suggested_risk.level}</span><span className={`rounded-full px-3 py-1 text-sm font-semibold ${riskClass(risk(record))}`}>Doctor: {record.risk_level || "Not reviewed"}</span></div>
      {record.risk_needs_review && <p className="mt-2 text-sm text-amber-700">Review required. New or changed visits may affect the assessment.</p>}
      <ul className="mt-3 space-y-2 text-sm">{record.suggested_risk.reasons.map((entry, index) => <li key={index}>{entry.reason} <span className="text-slate-500">({entry.visits.map(date).join(", ")})</span></li>)}</ul>
      {!record.suggested_risk.reasons.length && <p className="mt-3 text-sm text-slate-500">No flags found in the recorded data. This does not establish the absence of risk.</p>}
      <p className="mt-3 text-xs text-slate-500">Blood-pressure flags use systolic ≥140 or diastolic ≥90 mmHg. <a className="underline" href={record.suggested_risk.source} target="_blank" rel="noreferrer">NICE antenatal guidance</a>. Other flags reflect documented visit findings. Lab interpretation and weight or fetal-heart-rate concerns require doctor review.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Existing maternal conditions" value={record.existing_illnesses} /><Info label="Previous obstetric history" value={record.ob_history} /></div>
    </section>
    <Editor key={`risk-${record.id}-${record.risk_reviewed_at}`} title="Doctor's risk review" record={record} fields={[["risk_level","Confirmed risk","select",["","Low Risk","Needs Monitoring","High Risk"]],["risk_reasons","Reasons / override rationale (including lab, weight, fetal, age or medical concerns)","textarea"]]} onSaved={onSaved} saveLabel="Confirm risk assessment" />
    <section className={card}><h2 className="text-lg font-bold">Maternal and fetal trends</h2><p className="mt-1 text-sm text-slate-500">Observed measurements in visit order. Missing readings remain gaps.</p>
      {points.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Trend title="Blood pressure (mmHg)" points={points} lines={[["systolic","Systolic","#db2777"],["diastolic","Diastolic","#0d9488"]]} />
        <Trend title="Maternal weight (kg)" points={points} lines={[["weight","Weight","#0d9488"]]} />
        <Trend title="Fetal heart rate (bpm)" points={points} lines={[["fhr","Fetal heart rate","#7c3aed"]]} />
        <Trend title="Fundal height (cm)" points={points} lines={[["fundal","Fundal height","#d97706"]]} />
        <Trend title="Gestational age by official EDD (weeks)" points={points} lines={[["ga","Gestational age","#2563eb"]]} />
      </div> : <p className="mt-3 text-sm text-slate-500">Trends appear after the first visit.</p>}
    </section>
    <section className={card}><h2 className="text-lg font-bold">Complete prenatal consultation timeline</h2>
      <div className="mt-4 space-y-3">{record.visits.map((visit, index) => <details key={visit.id} open={index === record.visits.length - 1} className="rounded-2xl border border-slate-200 p-4">
        <summary className="cursor-pointer font-semibold">Visit {index + 1} · {date(visit.visit_date)} · {ga(visit.current_dating_ga)}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="GA recorded at visit" value={visit.gestational_weeks == null ? null : `${visit.gestational_weeks} weeks ${visit.gestational_days || 0} days`} />
          <Info label="Blood pressure" value={visit.blood_pressure} /><Info label="Weight (kg)" value={visit.weight_kg} /><Info label="Temperature (°C)" value={visit.temperature_c} /><Info label="Fetal heart rate (bpm)" value={visit.fetal_heart_rate} /><Info label="Fundal height (cm)" value={visit.fundal_height_cm} />
          <Info label="Chief complaint / symptoms" value={visit.chief_complaint} /><Info label="Assessment" value={visit.assessment} /><Info label="Diagnoses" value={visit.diagnoses.map((d) => d.diagnosis_name).join(", ")} />
          <Info label="Lab findings" value={visit.lab_results || visit.laboratory_requests.flatMap((lab) => lab.items.filter((i) => i.result).map((i) => `${i.test_name}: ${i.result}`)).join("\n")} />
          <Info label="Prescription / medication" value={visit.prescriptions.flatMap((rx) => rx.items.map((i) => [i.medicine_name,i.dosage,i.frequency,i.duration,i.instructions].filter(Boolean).join("; "))).join("\n")} />
          <Info label="Doctor observations" value={[visit.doctor_notes,visit.notes].filter(Boolean).join("\n")} /><Info label="Fetal movement" value={visit.fetal_movement} /><Info label="Doctor" value={visit.doctor_name} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4">{visit.consultation_case_id && <Link className="text-sm font-semibold text-pink-700 underline" to={`/cases/${visit.consultation_case_id}`}>Consultation details / print</Link>}
          {siblings.length > 1 && <button className="text-sm text-slate-500 underline" onClick={() => { setMoving(visit.id); setMoveTarget(""); setMoveMessage(""); }}>Move to another pregnancy</button>}
        </div>
      </details>)}</div>
      {!record.visits.length && <p className="mt-3 text-sm text-slate-500">No visits yet.</p>}
      {moving && <form className="mt-4 rounded-xl bg-amber-50 p-4" onSubmit={async (e) => { e.preventDefault(); if (moveSaving) return; setMoveSaving(true); try { await api(`/pregnancies/${moveTarget}/visits/${moving}`, { method: "PUT", body: "{}" }); setMoving(null); await onSaved(); } catch (error) { setMoveMessage(error.message); } finally { setMoveSaving(false); } }}>
        <label className="text-sm font-medium">Correct pregnancy for this visit<select required value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} className={input}><option value="">Select pregnancy</option>{siblings.filter((p) => p.id !== record.id).map((p) => <option value={p.id} key={p.id}>{p.pregnancy_number} · LMP {date(p.lmp_date)} · {p.status}</option>)}</select></label>
        <button disabled={moveSaving} className={`${button} mt-3`}>Move visit</button><button type="button" className="ml-3 text-sm" onClick={() => setMoving(null)}>Cancel</button>{moveMessage && <p role="alert">{moveMessage}</p>}
      </form>}
    </section>
    <section className={card}><h2 className="text-lg font-bold">Laboratory history</h2>{record.visits.map((visit) => <div key={visit.id} className="mt-3 border-t border-slate-100 pt-3 text-sm"><strong>{date(visit.visit_date)}</strong><p className="mt-1 whitespace-pre-wrap">{show(visit.lab_results)}</p>{visit.laboratory_requests.map((lab) => <div key={lab.id} className="mt-2"><p className="font-medium">{lab.request_number} · {date(lab.requested_date)}</p>{lab.items.map((item) => <p key={item.id} className="whitespace-pre-wrap">{item.test_name}: {item.result || "Result not recorded per test"}{item.result_date ? ` (${item.result_date})` : ""}</p>)}</div>)}</div>)}</section>
    <section className={card}><h2 className="text-lg font-bold">Prescription / medication history</h2>{record.visits.flatMap((visit) => visit.prescriptions.map((rx) => <div key={rx.id} className="mt-3 border-t border-slate-100 pt-3 text-sm"><strong>{rx.prescription_number} · {date(rx.issued_date)}</strong>{rx.items.map((item) => <p key={item.id} className="mt-1 whitespace-pre-wrap">{[item.medicine_name,item.dosage,item.frequency,item.duration,item.instructions].filter(Boolean).join(" · ")}</p>)}{rx.notes && <p>{rx.notes}</p>}</div>))}</section>
    <section className={card}><h2 className="text-lg font-bold">Delivery record</h2><div className="mt-3 grid gap-3 sm:grid-cols-3"><Info label="Pregnancy status" value={record.status} /><Info label="Actual delivery date" value={date(record.actual_delivery_date)} /><Info label="Gestational age at delivery" value={ga(record.delivery_ga)} /></div><p className="mt-3 text-sm text-slate-500">Saving delivery details marks this pregnancy as Delivered and retains its complete visit history. A later pregnancy starts a separate record.</p></section>
    <Editor key={`delivery-${record.id}-${record.updated_at}`} title="Delivery details and outcomes" record={record} fields={deliveryFields} extra={{ status: "Delivered" }} onSaved={onSaved} saveLabel="Save delivery and close pregnancy" />
  </div>;
}

export default function PregnancyRecords() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("pregnancy");
  const patientFilter = params.get("patient");
  const legacyVisit = params.get("record");
  const [records, setRecords] = useState([]);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [newForm, setNewForm] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [newPatient, setNewPatient] = useState(patientFilter || "");
  const [lmp, setLmp] = useState("");
  const [creating, setCreating] = useState(false);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setLoading(true); setDetail(null); setMessage("");
      try {
        const [list, patientList] = await Promise.all([api("/pregnancies"), api("/patients")]);
        let id = selectedId;
        if (!id && legacyVisit) { const visit = await api(`/prenatal-records/${legacyVisit}`); id = visit.pregnancy_id; }
        const selected = id ? await api(`/pregnancies/${id}`) : null;
        if (!cancelled) { setRecords(list); setPatients(patientList); setDetail(selected); }
      } catch (error) { if (!cancelled) setMessage(error.message); }
      finally { if (!cancelled) setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [selectedId, legacyVisit, reload]);
  const visible = records.filter((record) => (!patientFilter || String(record.patient_id) === patientFilter) && (status === "All" || record.status === status) && `${name(record)} ${record.patient_number} ${record.pregnancy_number}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="flex min-h-screen bg-slate-50"><Sidebar activeItem="Prenatal Records" /><div className="min-w-0 flex-1">
    <header className="m-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-linear-to-r from-pink-700 to-rose-500 p-6 text-white sm:m-6"><div><p className="text-sm text-pink-100">Maternal health</p><h1 className="text-3xl font-bold">Prenatal Records</h1><p className="mt-1 text-sm text-pink-100">One pregnancy record, from first visit through delivery.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setNewForm(!newForm)} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-pink-700">Start new pregnancy</button><Link className="rounded-xl border border-white/50 px-4 py-2.5 text-sm font-semibold" to={`/consultations/new?prenatal=1${patientFilter ? `&patient=${patientFilter}` : ""}`}>Add prenatal consultation</Link></div></header>
    <main className="space-y-5 px-4 pb-8 sm:px-6">
      {message && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{message}</p>}
      {newForm && <form className={card} onSubmit={async (e) => { e.preventDefault(); if (creating) return; setCreating(true); setMessage(""); try { const created = await api("/pregnancies", { method: "POST", body: JSON.stringify({ patient_id: Number(newPatient), lmp_date: lmp }) }); setNewForm(false); setParams({ pregnancy: String(created.id) }); refresh(); } catch (error) { setMessage(error.message); } finally { setCreating(false); } }}>
        <h2 className="font-bold">Start a new pregnancy record</h2><p className="mt-1 text-sm text-slate-500">Use an existing active pregnancy for follow-up visits. Close it before starting a later pregnancy.</p><fieldset disabled={creating} className="mt-4 grid gap-4 sm:grid-cols-3"><Field label="Search patients" value={patientSearch} onChange={setPatientSearch} /><label className="text-sm font-medium text-slate-600">Patient<select required className={input} value={newPatient} onChange={(e) => setNewPatient(e.target.value)}><option value="">Select patient</option>{patients.filter((p) => String(p.id) === newPatient || `${name(p)} ${p.patient_number}`.toLowerCase().includes(patientSearch.toLowerCase())).map((p) => <option value={p.id} key={p.id}>{name(p)} · {p.patient_number}</option>)}</select></label><Field label="LMP (if known)" type="date" value={lmp} onChange={setLmp} /></fieldset><button disabled={creating} className={`${button} mt-4`}>{creating ? "Creating..." : "Create pregnancy record"}</button>
      </form>}
      <div className="flex gap-3">{(selectedId || legacyVisit) && <button onClick={() => { setParams(patientFilter ? { patient: patientFilter } : {}); setDetail(null); }} className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={17} />All pregnancy records</button>}<button className="ml-auto inline-flex items-center gap-2 text-sm text-slate-600" onClick={refresh}><RefreshCw size={16} />Refresh</button></div>
      {loading ? <p className="p-8 text-center text-slate-500">Loading pregnancy records...</p> : detail && (selectedId || legacyVisit) ? <PregnancyDetail key={detail.id} record={detail} onSaved={refresh} siblings={records.filter((p) => p.patient_id === detail.patient_id)} /> : <section className={card}>
        <div className="flex flex-wrap items-center gap-3"><Baby className="text-pink-600" /><h2 className="font-bold">Pregnancy directory ({visible.length})</h2></div>
        <div className="mt-4 flex flex-wrap gap-3"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><Search size={17} /><input aria-label="Search pregnancy records" className="w-full outline-none" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient or pregnancy number" /></label><select aria-label="Pregnancy status" className="rounded-xl border border-slate-200 px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>{["All","Active","Delivered","Completed","Closed","Needs review"].map((value) => <option key={value}>{value}</option>)}</select></div>
        <div className="mt-4 max-h-[65vh] overflow-auto"><table className="w-full min-w-200 text-left text-sm"><thead className="sticky top-0 bg-white text-xs uppercase text-slate-500"><tr>{["Patient / pregnancy","LMP / official EDD","Gestational age","Visits","Status / risk",""] .map((title) => <th key={title} className="p-3">{title}</th>)}</tr></thead><tbody>{visible.map((record) => <tr key={record.id} className="border-t border-slate-100"><td className="p-3"><p className="font-semibold">{name(record)}</p><p className="text-xs text-pink-600">{record.pregnancy_number} · {record.patient_number}</p></td><td className="p-3">{date(record.lmp_date)}<br />{date(record.official_edd)} ({record.edd_source})</td><td className="p-3">{ga(record.current_ga)}</td><td className="p-3">{record.visit_count}</td><td className="p-3"><p>{record.status}</p><span className={`mt-1 inline-block rounded-full px-2 py-1 text-xs ${riskClass(risk(record))}`}>{risk(record)}{record.risk_needs_review ? " · Review" : ""}</span></td><td className="p-3"><button className="font-semibold text-pink-700" onClick={() => setParams({ pregnancy: String(record.id), ...(patientFilter ? { patient: patientFilter } : {}) })}>Open record</button></td></tr>)}</tbody></table>{!visible.length && <p className="p-8 text-center text-slate-500">No pregnancy records found.</p>}</div>
      </section>}
    </main>
  </div></div>;
}
