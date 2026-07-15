import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  Pill,
  Plus,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";

const now = () => new Date().toISOString().slice(0, 16);
const today = () => new Date().toISOString().slice(0, 10);

const createInitialForm = (patientId = "") => ({
  patient_id: patientId,
  consultation_date: now(),
  chief_complaint: "",
  history_present_illness: "",
  blood_pressure: "",
  temperature_c: "",
  weight_kg: "",
  height_cm: "",
  diagnoses: "",
  treatment: "",
  doctor_notes: "",
  follow_up_date: "",
});

const blankMedicine = {
  medicine_name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

const blankLab = {
  test_name: "",
};

export default function Consultations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const patientIdFromUrl = searchParams.get("patient") || "";
  const appointmentIdFromUrl = searchParams.get("appointment") || "";

  const [patients, setPatients] = useState([]);
  const [appointment, setAppointment] = useState(null);

  const [form, setForm] = useState(() =>
    createInitialForm(patientIdFromUrl),
  );

  const [prescription, setPrescription] = useState({
    issued_date: today(),
    diagnosis: "",
    notes: "",
    items: [{ ...blankMedicine }],
  });

  const [laboratory, setLaboratory] = useState({
    requested_date: today(),
    indication: "",
    notes: "",
    items: [{ ...blankLab }],
  });

  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      setResult("");

      try {
        const requests = [api("/patients")];

        if (appointmentIdFromUrl) {
          requests.push(api(`/appointments/${appointmentIdFromUrl}`));
        }

        const [patientRecords, appointmentRecord] =
          await Promise.all(requests);

        setPatients(
          Array.isArray(patientRecords) ? patientRecords : [],
        );

        if (appointmentRecord) {
          setAppointment(appointmentRecord);

          setForm((currentForm) => ({
            ...currentForm,
            patient_id: String(
              appointmentRecord.patient_id ||
                patientIdFromUrl ||
                "",
            ),
            consultation_date:
              appointmentRecord.appointment_date
                ? appointmentRecord.appointment_date.slice(0, 16)
                : currentForm.consultation_date,
          }));
        } else if (patientIdFromUrl) {
          setForm((currentForm) => ({
            ...currentForm,
            patient_id: String(patientIdFromUrl),
          }));
        }
      } catch (error) {
        setResult(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [patientIdFromUrl, appointmentIdFromUrl]);

  const selectedPatient = patients.find(
    (patient) =>
      String(patient.id) === String(form.patient_id),
  );

  const set = (key) => (event) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: event.target.value,
    }));
  };

  const setPrescriptionField = (key) => (event) => {
    setPrescription((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const setLaboratoryField = (key) => (event) => {
    setLaboratory((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const updateMedicine = (index, key, value) => {
    setPrescription((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const addMedicine = () => {
    setPrescription((current) => ({
      ...current,
      items: [...current.items, { ...blankMedicine }],
    }));
  };

  const removeMedicine = (index) => {
    setPrescription((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? [{ ...blankMedicine }]
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateLab = (index, value) => {
    setLaboratory((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { test_name: value } : item,
      ),
    }));
  };

  const addLab = () => {
    setLaboratory((current) => ({
      ...current,
      items: [...current.items, { ...blankLab }],
    }));
  };

  const removeLab = (index) => {
    setLaboratory((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? [{ ...blankLab }]
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setResult("");

    try {
      if (!form.patient_id) {
        throw new Error("Please select a patient.");
      }

      if (!form.chief_complaint.trim()) {
        throw new Error("Chief complaint is required.");
      }

      const diagnoses = form.diagnoses
        .split("\n")
        .map((diagnosis) => diagnosis.trim())
        .filter(Boolean);

      const body = {
        ...form,
        patient_id: Number(form.patient_id),
        doctor_id: currentUser.id || null,
        diagnoses,
      };

      const record = await api("/cases", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const medicineItems = prescription.items
        .map((item) => ({
          medicine_name: item.medicine_name.trim(),
          dosage: item.dosage.trim(),
          frequency: item.frequency.trim(),
          duration: item.duration.trim(),
          instructions: item.instructions.trim(),
        }))
        .filter((item) => item.medicine_name);

      if (medicineItems.length) {
        await api("/prescriptions", {
          method: "POST",
          body: JSON.stringify({
            patient_id: Number(form.patient_id),
            consultation_case_id: record.id,
            issued_date: prescription.issued_date,
            diagnosis:
              prescription.diagnosis.trim() ||
              diagnoses.join(", ") ||
              null,
            notes: prescription.notes.trim() || null,
            items: medicineItems,
          }),
        });
      }

      const labItems = laboratory.items
        .map((item) => ({
          test_name: item.test_name.trim(),
        }))
        .filter((item) => item.test_name);

      if (labItems.length) {
        await api("/laboratory-requests", {
          method: "POST",
          body: JSON.stringify({
            patient_id: Number(form.patient_id),
            consultation_case_id: record.id,
            requested_date: laboratory.requested_date,
            indication: laboratory.indication.trim() || null,
            notes: laboratory.notes.trim() || null,
            items: labItems,
          }),
        });
      }

      if (appointmentIdFromUrl && appointment) {
        await api(`/appointments/${appointmentIdFromUrl}`, {
          method: "PUT",
          body: JSON.stringify({
            patient_id: appointment.patient_id,
            service: appointment.service,
            appointment_date: appointment.appointment_date,
            status: "Completed",
          }),
        });
      }

      const extras = [
        medicineItems.length ? "prescription" : "",
        labItems.length ? "laboratory request" : "",
      ].filter(Boolean);

      setResult(
        `Consultation saved as ${record.case_number}${
          extras.length ? ` with ${extras.join(" and ")}` : ""
        }.`,
      );

      setTimeout(() => {
        navigate(`/cases/${record.id}`);
      }, 800);
    } catch (error) {
      setResult(error.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (
    key,
    label,
    type = "text",
    options = {},
  ) => (
    <label className="text-sm font-medium text-slate-600">
      {label}
      <input
        type={type}
        value={form[key]}
        onChange={set(key)}
        min={options.min}
        step={options.step}
        required={options.required}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar activeItem="Consultations" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-slate-500">
            Loading consultation form…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeItem="Consultations" />

      <div className="min-w-0 flex-1">
        <header className="m-4 rounded-3xl bg-linear-to-r from-teal-700 to-teal-500 p-6 text-white sm:m-6">
          <Link
            to="/appointments"
            className="inline-flex items-center gap-2 text-sm text-teal-100 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to appointments
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-teal-100">
                Clinical encounter
              </p>
              <h1 className="mt-1 text-3xl font-bold">
                New consultation case
              </h1>
              <p className="mt-2 text-teal-100">
                Consultation, prescription, and laboratory request in one page.
              </p>
            </div>

            {appointmentIdFromUrl && (
              <div className="rounded-2xl bg-white/15 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-teal-100">
                  Appointment
                </p>
                <p className="mt-1 font-semibold">
                  #{appointmentIdFromUrl}
                </p>
              </div>
            )}
          </div>
        </header>

        <main className="px-4 pb-8 sm:px-6">
          <form
            onSubmit={submit}
            className="mx-auto max-w-6xl space-y-6"
          >
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-teal-50 p-3">
                  <Stethoscope className="text-teal-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Consultation
                  </h2>
                  <p className="text-sm text-slate-500">
                    Record the patient’s clinical encounter.
                  </p>
                </div>
              </div>

              {selectedPatient && appointmentIdFromUrl && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-teal-700">
                      <UserRound size={21} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                        Appointed patient
                      </p>
                      <p className="font-bold text-slate-800">
                        {selectedPatient.last_name},{" "}
                        {selectedPatient.first_name}{" "}
                        {selectedPatient.middle_name || ""}
                      </p>
                      <p className="text-sm text-slate-500">
                        {selectedPatient.patient_number}
                        {appointment?.service
                          ? ` • ${appointment.service}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-teal-700">
                    <CheckCircle2 size={15} />
                    Selected from appointment
                  </span>
                </div>
              )}

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-600">
                  Patient
                  <select
                    required
                    value={form.patient_id}
                    onChange={set("patient_id")}
                    disabled={Boolean(appointmentIdFromUrl)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">Select patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.patient_number} — {patient.last_name},{" "}
                        {patient.first_name}
                      </option>
                    ))}
                  </select>
                </label>

                {field(
                  "consultation_date",
                  "Consultation date and time",
                  "datetime-local",
                  { required: true },
                )}

                {field(
                  "follow_up_date",
                  "Follow-up date",
                  "date",
                )}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-600">
                  Chief complaint
                  <textarea
                    required
                    rows="4"
                    value={form.chief_complaint}
                    onChange={set("chief_complaint")}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>

                <label className="text-sm font-medium text-slate-600">
                  History of present illness
                  <textarea
                    rows="4"
                    value={form.history_present_illness}
                    onChange={set("history_present_illness")}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              </div>

              <h3 className="mt-7 font-bold text-slate-700">
                Vital signs
              </h3>

              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {field("blood_pressure", "Blood pressure")}
                {field("temperature_c", "Temperature °C", "number", {
                  min: "0",
                  step: "0.1",
                })}
                {field("weight_kg", "Weight kg", "number", {
                  min: "0",
                  step: "0.1",
                })}
                {field("height_cm", "Height cm", "number", {
                  min: "0",
                  step: "0.1",
                })}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-600">
                  Diagnosis, one per line
                  <textarea
                    rows="5"
                    value={form.diagnoses}
                    onChange={set("diagnoses")}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>

                <label className="text-sm font-medium text-slate-600">
                  Treatment
                  <textarea
                    rows="5"
                    value={form.treatment}
                    onChange={set("treatment")}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              </div>

              <label className="mt-5 block text-sm font-medium text-slate-600">
                Doctor's notes
                <textarea
                  rows="4"
                  value={form.doctor_notes}
                  onChange={set("doctor_notes")}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-pink-50 p-3">
                    <Pill className="text-pink-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      Prescription
                    </h2>
                    <p className="text-sm text-slate-500">
                      Leave all medicine names blank when no prescription is needed.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addMedicine}
                  className="inline-flex items-center gap-2 rounded-xl border border-pink-200 px-4 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-50"
                >
                  <Plus size={16} />
                  Add medicine
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-600">
                  Issued date
                  <input
                    type="date"
                    value={prescription.issued_date}
                    onChange={setPrescriptionField("issued_date")}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </label>

                <label className="text-sm font-medium text-slate-600">
                  Prescription diagnosis
                  <input
                    value={prescription.diagnosis}
                    onChange={setPrescriptionField("diagnosis")}
                    placeholder="Uses consultation diagnosis when blank"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </label>
              </div>

              <div className="mt-5 space-y-4">
                {prescription.items.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-700">
                        Medicine {index + 1}
                      </h3>
                      <button
                        type="button"
                        onClick={() => removeMedicine(index)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                      {[
                        ["medicine_name", "Medicine name"],
                        ["dosage", "Dosage"],
                        ["frequency", "Frequency"],
                        ["duration", "Duration"],
                        ["instructions", "Instructions"],
                      ].map(([key, label]) => (
                        <label
                          key={key}
                          className="text-sm font-medium text-slate-600"
                        >
                          {label}
                          <input
                            value={item[key]}
                            onChange={(event) =>
                              updateMedicine(index, key, event.target.value)
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <label className="mt-5 block text-sm font-medium text-slate-600">
                Prescription notes
                <textarea
                  rows="3"
                  value={prescription.notes}
                  onChange={setPrescriptionField("notes")}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3"
                />
              </label>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-50 p-3">
                    <FlaskConical className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      Laboratory request
                    </h2>
                    <p className="text-sm text-slate-500">
                      Leave all test names blank when no laboratory request is needed.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addLab}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                >
                  <Plus size={16} />
                  Add test
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-600">
                  Requested date
                  <input
                    type="date"
                    value={laboratory.requested_date}
                    onChange={setLaboratoryField("requested_date")}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </label>

                <label className="text-sm font-medium text-slate-600">
                  Clinical indication
                  <input
                    value={laboratory.indication}
                    onChange={setLaboratoryField("indication")}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </label>
              </div>

              <div className="mt-5 space-y-3">
                {laboratory.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-end gap-3 rounded-2xl border border-slate-200 p-4"
                  >
                    <label className="flex-1 text-sm font-medium text-slate-600">
                      Test {index + 1}
                      <input
                        value={item.test_name}
                        onChange={(event) =>
                          updateLab(index, event.target.value)
                        }
                        placeholder="Example: Complete blood count"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => removeLab(index)}
                      className="rounded-lg p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>

              <label className="mt-5 block text-sm font-medium text-slate-600">
                Laboratory notes
                <textarea
                  rows="3"
                  value={laboratory.notes}
                  onChange={setLaboratoryField("notes")}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3"
                />
              </label>
            </section>

            {result && (
              <p
                className={`rounded-xl p-4 text-sm ${
                  result.toLowerCase().includes("saved")
                    ? "bg-teal-50 text-teal-800"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {result}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                to="/appointments"
                className="rounded-xl px-5 py-3 font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} />
                {saving
                  ? "Saving all records..."
                  : "Save consultation and requests"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}