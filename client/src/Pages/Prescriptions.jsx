import { useEffect, useState } from "react";
import {
  FlaskConical,
  Pill,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";
import {
  printLaboratoryRequest,
  printPrescription,
} from "../utils/print";

const today = () => new Date().toISOString().slice(0, 10);

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

const createBlankForm = () => ({
  patient_id: "",
  consultation_case_id: "",
  date: today(),
  note: "",
  notes: "",
  medicineItems: [{ ...blankMedicine }],
  labItems: [{ ...blankLab }],
});

export default function Prescriptions() {
  const [patients, setPatients] = useState([]);
  const [cases, setCases] = useState([]);
  const [records, setRecords] = useState([]);
  const [labs, setLabs] = useState([]);
  const [tab, setTab] = useState("rx");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(createBlankForm);

  const load = async () => {
    try {
      const [patientsData, prescriptions, laboratories] =
        await Promise.all([
          api("/patients"),
          api("/prescriptions"),
          api("/laboratory-requests"),
        ]);

      setPatients(Array.isArray(patientsData) ? patientsData : []);
      setRecords(Array.isArray(prescriptions) ? prescriptions : []);
      setLabs(Array.isArray(laboratories) ? laboratories : []);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectPatient = async (patientId) => {
    setForm((current) => ({
      ...current,
      patient_id: patientId,
      consultation_case_id: "",
    }));

    try {
      const patientCases = patientId
        ? await api(`/patients/${patientId}/cases`)
        : [];

      setCases(Array.isArray(patientCases) ? patientCases : []);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const setField = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const updateMedicine = (index, key, value) => {
    setForm((current) => ({
      ...current,
      medicineItems: current.medicineItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const addMedicine = () => {
    setForm((current) => ({
      ...current,
      medicineItems: [
        ...current.medicineItems,
        { ...blankMedicine },
      ],
    }));
  };

  const removeMedicine = (index) => {
    setForm((current) => ({
      ...current,
      medicineItems:
        current.medicineItems.length === 1
          ? [{ ...blankMedicine }]
          : current.medicineItems.filter(
              (_, itemIndex) => itemIndex !== index,
            ),
    }));
  };

  const updateLab = (index, value) => {
    setForm((current) => ({
      ...current,
      labItems: current.labItems.map((item, itemIndex) =>
        itemIndex === index ? { test_name: value } : item,
      ),
    }));
  };

  const addLab = () => {
    setForm((current) => ({
      ...current,
      labItems: [...current.labItems, { ...blankLab }],
    }));
  };

  const removeLab = (index) => {
    setForm((current) => ({
      ...current,
      labItems:
        current.labItems.length === 1
          ? [{ ...blankLab }]
          : current.labItems.filter(
              (_, itemIndex) => itemIndex !== index,
            ),
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      if (!form.patient_id) {
        throw new Error("Please select a patient.");
      }

      if (!form.consultation_case_id) {
        throw new Error("Please select a consultation case.");
      }

      if (tab === "rx") {
        const items = form.medicineItems
          .map((item) => ({
            medicine_name: item.medicine_name.trim(),
            dosage: item.dosage.trim(),
            frequency: item.frequency.trim(),
            duration: item.duration.trim(),
            instructions: item.instructions.trim(),
          }))
          .filter((item) => item.medicine_name);

        if (!items.length) {
          throw new Error("Please add at least one medicine.");
        }

        const result = await api("/prescriptions", {
          method: "POST",
          body: JSON.stringify({
            patient_id: Number(form.patient_id),
            consultation_case_id: Number(
              form.consultation_case_id,
            ),
            issued_date: form.date,
            diagnosis: form.note.trim() || null,
            notes: form.notes.trim() || null,
            items,
          }),
        });

        setMessage(
          `${result.prescription_number} saved and linked to the selected case.`,
        );
      } else {
        const items = form.labItems
          .map((item) => ({
            test_name: item.test_name.trim(),
          }))
          .filter((item) => item.test_name);

        if (!items.length) {
          throw new Error(
            "Please add at least one laboratory test.",
          );
        }

        const result = await api("/laboratory-requests", {
          method: "POST",
          body: JSON.stringify({
            patient_id: Number(form.patient_id),
            consultation_case_id: Number(
              form.consultation_case_id,
            ),
            requested_date: form.date,
            indication: form.note.trim() || null,
            notes: form.notes.trim() || null,
            items,
          }),
        });

        setMessage(
          `${result.request_number} saved and linked to the selected case.`,
        );
      }

      setForm(createBlankForm());
      setCases([]);
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (record) => {
    const isPrescription = tab === "rx";
    const number =
      record.prescription_number || record.request_number;

    if (
      !window.confirm(
        `Delete ${
          isPrescription
            ? "prescription"
            : "laboratory request"
        } ${number}? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await api(
        `${
          isPrescription
            ? "/prescriptions"
            : "/laboratory-requests"
        }/${record.id}`,
        {
          method: "DELETE",
        },
      );

      setMessage(`${number} deleted.`);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const changeTab = (nextTab) => {
    setTab(nextTab);
    setMessage("");
  };

  const list = tab === "rx" ? records : labs;

  const print = (record) =>
    tab === "rx"
      ? printPrescription(record)
      : printLaboratoryRequest(record);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeItem="Prescriptions" />

      <div className="min-w-0 flex-1">
        <header className="m-4 rounded-3xl bg-linear-to-r from-pink-600 to-rose-400 p-6 text-white sm:m-6">
          <h1 className="text-3xl font-bold">
            Prescriptions & Laboratory
          </h1>

          <p className="mt-2 text-pink-100">
            Create detailed medicine prescriptions and laboratory
            requests linked to an existing consultation case.
          </p>
        </header>

        <main className="space-y-6 px-4 pb-8 sm:px-6">
          <form
            onSubmit={save}
            className="mx-auto w-full rounded-3xl bg-white p-6 shadow-sm"
          >
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => changeTab("rx")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  tab === "rx"
                    ? "bg-white text-pink-600 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                Prescription
              </button>

              <button
                type="button"
                onClick={() => changeTab("lab")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  tab === "lab"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                Laboratory
              </button>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <span
                className={`rounded-xl p-2 ${
                  tab === "rx"
                    ? "bg-pink-100 text-pink-600"
                    : "bg-blue-100 text-blue-600"
                }`}
              >
                {tab === "rx" ? <Pill /> : <FlaskConical />}
              </span>

              <div>
                <h2 className="text-lg font-bold">
                  New{" "}
                  {tab === "rx"
                    ? "prescription"
                    : "laboratory request"}
                </h2>

                <p className="text-sm text-slate-500">
                  Use the same detailed form available on the
                  consultation page.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm font-medium text-slate-600">
              Patient

              <select
                required
                value={form.patient_id}
                onChange={(event) =>
                  selectPatient(event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
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

            <label className="mt-4 block text-sm font-medium text-slate-600">
              Consultation case

              <select
                required
                disabled={!form.patient_id}
                value={form.consultation_case_id}
                onChange={setField("consultation_case_id")}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">Select consultation case</option>

                {cases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.case_number} —{" "}
                    {item.consultation_date?.slice(0, 10)}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-sm font-medium text-slate-600">
              {tab === "rx" ? "Issued date" : "Requested date"}

              <input
                required
                type="date"
                value={form.date}
                onChange={setField("date")}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-slate-600">
              {tab === "rx" ? "Diagnosis" : "Clinical indication"}

              <input
                value={form.note}
                onChange={setField("note")}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"
              />
            </label>

            {tab === "rx" ? (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-700">
                    Medicines
                  </h3>

                  <button
                    type="button"
                    onClick={addMedicine}
                    className="inline-flex items-center gap-2 rounded-xl border border-pink-200 px-3 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-50"
                  >
                    <Plus size={16} />
                    Add medicine
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {form.medicineItems.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-700">
                          Medicine {index + 1}
                        </p>

                        <button
                          type="button"
                          onClick={() => removeMedicine(index)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                                updateMedicine(
                                  index,
                                  key,
                                  event.target.value,
                                )
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-700">
                    Laboratory tests
                  </h3>

                  <button
                    type="button"
                    onClick={addLab}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    <Plus size={16} />
                    Add test
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {form.labItems.map((item, index) => (
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
              </div>
            )}

            <label className="mt-5 block text-sm font-medium text-slate-600">
              Notes

              <textarea
                rows="3"
                value={form.notes}
                onChange={setField("notes")}
                className="mt-1 w-full rounded-xl border border-slate-200 p-3"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className={`mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                tab === "rx"
                  ? "bg-pink-600 hover:bg-pink-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              <Plus size={17} />

              {saving
                ? "Saving..."
                : `Save ${
                    tab === "rx"
                      ? "prescription"
                      : "laboratory request"
                  }`}
            </button>

            {message && (
              <p className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-700">
                {message}
              </p>
            )}
          </form>

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span
                className={`rounded-xl p-2 ${
                  tab === "rx"
                    ? "bg-pink-100 text-pink-600"
                    : "bg-blue-100 text-blue-600"
                }`}
              >
                {tab === "rx" ? <Pill /> : <FlaskConical />}
              </span>

              <div>
                <h2 className="text-lg font-bold">
                  Saved{" "}
                  {tab === "rx"
                    ? "prescriptions"
                    : "laboratory requests"}
                </h2>

                <p className="text-sm text-slate-500">
                  {list.length} saved document
                  {list.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-200 text-left">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-400">
                    <th className="p-3">Number</th>
                    <th className="p-3">Case</th>
                    <th className="p-3">Patient</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Items</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {list.length ? (
                    list.map((record) => (
                      <tr
                        key={record.id}
                        className="border-b border-slate-100"
                      >
                        <td className="p-3 font-semibold text-pink-600">
                          {record.prescription_number ||
                            record.request_number}
                        </td>

                        <td className="p-3">
                          {record.case_number || "Legacy record"}
                        </td>

                        <td className="p-3">
                          {record.patient_name}
                        </td>

                        <td className="p-3">
                          {record.issued_date ||
                            record.requested_date}
                        </td>

                        <td className="p-3">
                          {record.items?.length || 0}
                        </td>

                        <td className="whitespace-nowrap p-3 text-right">
                          <button
                            type="button"
                            onClick={() => print(record)}
                            className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"
                          >
                            <Printer size={15} />
                            Print
                          </button>

                          <button
                            type="button"
                            onClick={() => remove(record)}
                            className="ml-2 inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="6"
                        className="p-8 text-center text-sm text-slate-500"
                      >
                        No saved documents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}