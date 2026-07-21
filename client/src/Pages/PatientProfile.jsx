import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Edit,
  Eye,
  Printer,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import Sidebar from "../components/Sidebar";
import { api } from "../api/client";
import { printCase } from "../utils/print";

const dash = (value) => value || "—";

const blankForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  birth_date: "",
  civil_status: "",
  occupation: "",
  contact_number: "",
  address: "",
  blood_type: "",
  allergies: "",
  existing_illnesses: "",
  previous_surgeries: "",
  family_history: "",
  ob_history: "",
  pregnancy_history: "",
  emergency_contact_name: "",
  emergency_contact_number: "",
  notes: "",
};

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [cases, setCases] = useState([]);
  const [form, setForm] = useState(blankForm);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showEdit, setShowEdit] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const loadPatient = async () => {
    try {
      setError("");

      const [profile, encounters] =
        await Promise.all([
          api(`/patients/${id}`),
          api(`/patients/${id}/cases`),
        ]);

      setPatient(profile);
      setCases(
        Array.isArray(encounters)
          ? encounters
          : [],
      );
    } catch (error) {
      setError(error.message);
    }
  };

  useEffect(() => {
    loadPatient();
  }, [id]);

  const printConsultation = async (
    caseId,
  ) => {
    try {
      setError("");

      const caseData = await api(
        `/cases/${caseId}`,
      );

      printCase(caseData);
    } catch (error) {
      setError(error.message);
    }
  };

  const openEditForm = () => {
    setError("");
    setMessage("");

    setForm({
      first_name:
        patient.first_name || "",
      middle_name:
        patient.middle_name || "",
      last_name:
        patient.last_name || "",
      birth_date:
        patient.birth_date
          ? patient.birth_date.slice(0, 10)
          : "",
      civil_status:
        patient.civil_status || "",
      occupation:
        patient.occupation || "",
      contact_number:
        patient.contact_number || "",
      address:
        patient.address || "",
      blood_type:
        patient.blood_type || "",
      allergies:
        patient.allergies || "",
      existing_illnesses:
        patient.existing_illnesses || "",
      previous_surgeries:
        patient.previous_surgeries || "",
      family_history:
        patient.family_history || "",
      ob_history:
        patient.ob_history || "",
      pregnancy_history:
        patient.pregnancy_history || "",
      emergency_contact_name:
        patient.emergency_contact_name || "",
      emergency_contact_number:
        patient.emergency_contact_number ||
        "",
      notes:
        patient.notes || "",
    });

    setShowEdit(true);
  };

  const closeEditForm = () => {
    if (saving) return;

    setShowEdit(false);
    setForm(blankForm);
  };

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const updatePatient = async (
    event,
  ) => {
    event.preventDefault();

    if (
      !form.first_name.trim() ||
      !form.last_name.trim()
    ) {
      setError(
        "First name and last name are required.",
      );

      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await api(`/patients/${id}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });

      await loadPatient();

      setShowEdit(false);
      setMessage(
        "Patient information updated successfully.",
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePatient = async () => {
    const patientName =
      `${patient.first_name || ""} ${
        patient.last_name || ""
      }`
        .replace(/\s+/g, " ")
        .trim();

    const confirmed = window.confirm(
      `Delete ${patientName}'s patient record?\n\nThis action may also affect related appointments, consultations, prescriptions, laboratory requests, and billing records.`,
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      await api(`/patients/${id}`, {
        method: "DELETE",
      });

      navigate("/patients", {
        replace: true,
      });
    } catch (error) {
      setError(error.message);
      setDeleting(false);
    }
  };

  const inputField = (
    name,
    label,
    type = "text",
    required = false,
  ) => (
    <label className="text-sm font-medium text-slate-600">
      {label}

      <input
        type={type}
        name={name}
        value={form[name]}
        onChange={handleChange}
        required={required}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
      />
    </label>
  );

  const textareaField = (
    name,
    label,
  ) => (
    <label className="text-sm font-medium text-slate-600">
      {label}

      <textarea
        name={name}
        value={form[name]}
        onChange={handleChange}
        rows={3}
        className="mt-1 w-full resize-y rounded-xl border border-slate-200 p-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
      />
    </label>
  );

  if (!patient) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar activeItem="Patients" />

        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-slate-600">
            {error ||
              "Loading patient record…"}
          </p>
        </div>
      </div>
    );
  }

  const name =
    `${patient.first_name} ${
      patient.middle_name || ""
    } ${patient.last_name}`
      .replace(/\s+/g, " ")
      .trim();

  const patientDetails = [
    [
      "Birthdate",
      patient.birth_date
        ? patient.birth_date.slice(0, 10)
        : "",
    ],
    [
      "Civil status",
      patient.civil_status,
    ],
    [
      "Occupation",
      patient.occupation,
    ],
    [
      "Contact",
      patient.contact_number,
    ],
    [
      "Blood type",
      patient.blood_type,
    ],
    [
      "Address",
      patient.address,
    ],
    [
      "Emergency contact",
      patient.emergency_contact_name,
    ],
    [
      "Emergency contact number",
      patient.emergency_contact_number,
    ],
    [
      "Allergies",
      patient.allergies,
    ],
    [
      "Existing illnesses",
      patient.existing_illnesses,
    ],
    [
      "Previous surgeries",
      patient.previous_surgeries,
    ],
    [
      "Family history",
      patient.family_history,
    ],
    [
      "OB history",
      patient.ob_history,
    ],
    [
      "Pregnancy history",
      patient.pregnancy_history,
    ],
    [
      "Notes",
      patient.notes,
    ],
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeItem="Patients" />

      <div className="min-w-0 flex-1">
        <header className="m-4 rounded-3xl bg-linear-to-r from-pink-600 to-rose-400 p-6 text-white sm:m-6">
          <Link
            to="/patients"
            className="inline-flex items-center gap-1 text-sm text-pink-100 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Patients
          </Link>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                {name}
              </h1>

              <p className="text-pink-100">
                Patient No.{" "}
                {patient.patient_number}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openEditForm}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold text-pink-600 shadow-sm transition hover:bg-pink-50"
              >
                <Edit size={18} />
                Edit patient
              </button>

              <button
                type="button"
                onClick={deletePatient}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl border border-white/50 bg-rose-700 px-4 py-2.5 font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={18} />

                {deleting
                  ? "Deleting..."
                  : "Delete patient"}
              </button>
            </div>
          </div>
        </header>

        <main className="space-y-6 px-4 pb-8 sm:px-6">
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </p>
          )}

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Patient details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Personal and medical
                  information
                </p>
              </div>

              <button
                type="button"
                onClick={openEditForm}
                className="inline-flex items-center gap-2 rounded-xl border border-pink-200 px-4 py-2 text-sm font-semibold text-pink-600 transition hover:bg-pink-50"
              >
                <Edit size={16} />
                Edit
              </button>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {patientDetails.map(
                ([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl bg-slate-50 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {label}
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {dash(value)}
                    </p>
                  </div>
                ),
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">
              Consultation records
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Open a case to view
              consultation details, medicine
              prescriptions, and laboratory
              requests.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-180 text-left">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-400">
                    <th className="p-3">
                      Case
                    </th>

                    <th className="p-3">
                      Date
                    </th>

                    <th className="p-3">
                      Complaint
                    </th>

                    <th className="p-3">
                      Follow-up
                    </th>

                    <th className="p-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {cases.length ? (
                    cases.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100"
                      >
                        <td className="p-3 font-semibold text-teal-700">
                          <Link
                            to={`/cases/${item.id}`}
                            className="hover:underline"
                          >
                            {item.case_number}
                          </Link>
                        </td>

                        <td className="p-3 text-sm text-slate-600">
                          {item.consultation_date
                            ? item.consultation_date.slice(
                                0,
                                16,
                              )
                            : "—"}
                        </td>

                        <td className="p-3 text-sm text-slate-600">
                          {dash(
                            item.chief_complaint,
                          )}
                        </td>

                        <td className="p-3 text-sm text-slate-600">
                          {dash(
                            item.follow_up_date,
                          )}
                        </td>

                        <td className="whitespace-nowrap p-3 text-right">
                          <Link
                            to={`/cases/${item.id}`}
                            className="mr-2 inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition hover:bg-slate-50"
                          >
                            <Eye size={15} />
                            Open
                          </Link>

                          <button
                            type="button"
                            onClick={() =>
                              printConsultation(
                                item.id,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition hover:bg-slate-50"
                          >
                            <Printer size={15} />
                            Print
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="p-8 text-center text-sm text-slate-500"
                      >
                        No consultation
                        records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {showEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4">
          <form
            onSubmit={updatePatient}
            className="mx-auto my-8 max-w-4xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Edit patient
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Update the patient's
                  personal and medical
                  information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditForm}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inputField(
                "first_name",
                "First name",
                "text",
                true,
              )}

              {inputField(
                "middle_name",
                "Middle name",
              )}

              {inputField(
                "last_name",
                "Last name",
                "text",
                true,
              )}

              {inputField(
                "birth_date",
                "Birthdate",
                "date",
              )}

              {inputField(
                "civil_status",
                "Civil status",
              )}

              {inputField(
                "occupation",
                "Occupation",
              )}

              {inputField(
                "contact_number",
                "Contact number",
              )}

              {inputField(
                "blood_type",
                "Blood type",
              )}

              {inputField(
                "emergency_contact_name",
                "Emergency contact",
              )}

              {inputField(
                "emergency_contact_number",
                "Emergency contact number",
              )}
            </div>

            <div className="mt-4">
              {textareaField(
                "address",
                "Address",
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {textareaField(
                "allergies",
                "Allergies",
              )}

              {textareaField(
                "existing_illnesses",
                "Existing illnesses",
              )}

              {textareaField(
                "previous_surgeries",
                "Previous surgeries",
              )}

              {textareaField(
                "family_history",
                "Family history",
              )}

              {textareaField(
                "ob_history",
                "OB history",
              )}

              {textareaField(
                "pregnancy_history",
                "Pregnancy history",
              )}

              <div className="sm:col-span-2">
                {textareaField(
                  "notes",
                  "Notes",
                )}
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditForm}
                disabled={saving}
                className="rounded-xl px-4 py-2.5 font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-5 py-2.5 font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={18} />

                {saving
                  ? "Saving..."
                  : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}