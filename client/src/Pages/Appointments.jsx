import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Edit,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";

const blankForm = {
  patient_id: "",
  service: "",
  appointment_date: "",
  status: "Scheduled",
};

const services = [
  "General Consultation",
  "Prenatal Checkup",
  "Postnatal Checkup",
  "Gynecological Consultation",
  "Family Planning",
  "Ultrasound",
  "Pap Smear",
  "Follow-up Consultation",
  "Laboratory Review",
  "Other",
];

const statuses = [
  "Scheduled",
  "Confirmed",
  "Completed",
  "Cancelled",
  "No Show",
];

const getLoggedInUser = () => {
  try {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const statusStyle = (status) => {
  switch (status) {
    case "Confirmed":
      return "bg-blue-50 text-blue-700";

    case "Completed":
      return "bg-emerald-50 text-emerald-700";

    case "Cancelled":
      return "bg-rose-50 text-rose-700";

    case "No Show":
      return "bg-amber-50 text-amber-700";

    default:
      return "bg-pink-50 text-pink-700";
  }
};

export default function Appointments() {
  const navigate = useNavigate();

  const [searchParams, setSearchParams] =
    useSearchParams();

  const currentUser = getLoggedInUser();

  const role = String(
    currentUser?.role || "",
  ).toLowerCase();

  const isDoctor = role === "doctor";

  const isSecretary =
    role === "secretary" ||
    role === "admin";

  const canManageAppointments =
    isDoctor || isSecretary;

  const selectedPatientFromUrl =
    searchParams.get("patient") || "";

  const [appointments, setAppointments] =
    useState([]);

  const [patients, setPatients] =
    useState([]);

  const [form, setForm] = useState({
    ...blankForm,
    patient_id: selectedPatientFromUrl,
  });

  const [search, setSearch] =
    useState("");

  const [showForm, setShowForm] =
    useState(
      Boolean(selectedPatientFromUrl) &&
        canManageAppointments,
    );

  const [editingId, setEditingId] =
    useState(null);

  const [message, setMessage] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const loadAppointments = async () => {
    try {
      const data = await api("/appointments");

      setAppointments(
        Array.isArray(data) ? data : [],
      );
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadPatients = async () => {
    try {
      const data = await api("/patients");

      setPatients(
        Array.isArray(data) ? data : [],
      );
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    Promise.all([
      loadAppointments(),
      loadPatients(),
    ]);
  }, []);

  useEffect(() => {
    if (
      !selectedPatientFromUrl ||
      !canManageAppointments
    ) {
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      patient_id: selectedPatientFromUrl,
    }));

    setShowForm(true);
  }, [
    selectedPatientFromUrl,
    canManageAppointments,
  ]);

  const patientMap = useMemo(() => {
    return new Map(
      patients.map((patient) => [
        String(patient.id),
        `${patient.last_name}, ${
          patient.first_name
        }${
          patient.middle_name
            ? ` ${patient.middle_name}`
            : ""
        }`,
      ]),
    );
  }, [patients]);

  const matchesSearch = (
    appointment,
  ) => {
    const value = search
      .trim()
      .toLowerCase();

    if (!value) {
      return true;
    }

    const patientName =
      patientMap.get(
        String(appointment.patient_id),
      ) || "";

    return [
      patientName,
      appointment.service,
      appointment.status,
      appointment.appointment_date,
    ]
      .join(" ")
      .toLowerCase()
      .includes(value);
  };

  const activeAppointments = useMemo(() => {
    return appointments.filter(
      (appointment) => {
        const status =
          appointment.status || "Scheduled";

        return (
          status !== "Completed" &&
          matchesSearch(appointment)
        );
      },
    );
  }, [
    appointments,
    patientMap,
    search,
  ]);

  const completedAppointments = useMemo(() => {
    return appointments.filter(
      (appointment) =>
        appointment.status ===
          "Completed" &&
        matchesSearch(appointment),
    );
  }, [
    appointments,
    patientMap,
    search,
  ]);

  const openNewAppointment = () => {
    if (!canManageAppointments) return;

    setEditingId(null);
    setMessage("");

    setForm({
      ...blankForm,
      patient_id:
        selectedPatientFromUrl,
    });

    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(blankForm);

    if (selectedPatientFromUrl) {
      const updatedParams =
        new URLSearchParams(
          searchParams,
        );

      updatedParams.delete("patient");

      setSearchParams(updatedParams);
    }
  };

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const saveAppointment = async (
    event,
  ) => {
    event.preventDefault();

    if (!canManageAppointments) {
      setMessage(
        "You do not have permission to manage appointments.",
      );
      return;
    }

    setMessage("");

    if (!form.patient_id) {
      setMessage(
        "Please select a patient.",
      );
      return;
    }

    if (!form.service) {
      setMessage(
        "Please select a service.",
      );
      return;
    }

    if (!form.appointment_date) {
      setMessage(
        "Please select the appointment date and time.",
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        patient_id: Number(
          form.patient_id,
        ),
        service: form.service,
        appointment_date:
          form.appointment_date,
        status: form.status,
      };

      if (editingId) {
        await api(
          `/appointments/${editingId}`,
          {
            method: "PUT",
            body: JSON.stringify(
              payload,
            ),
          },
        );
      } else {
        await api("/appointments", {
          method: "POST",
          body: JSON.stringify(
            payload,
          ),
        });
      }

      await loadAppointments();
      closeForm();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const editAppointment = (
    appointment,
  ) => {
    if (!canManageAppointments) return;

    setEditingId(appointment.id);

    setForm({
      patient_id: String(
        appointment.patient_id || "",
      ),

      service:
        appointment.service || "",

      appointment_date:
        appointment.appointment_date
          ? appointment.appointment_date.slice(
              0,
              16,
            )
          : "",

      status:
        appointment.status ||
        "Scheduled",
    });

    setMessage("");
    setShowForm(true);
  };

  const deleteAppointment = async (
    appointment,
  ) => {
    if (!canManageAppointments) return;

    const patientName =
      patientMap.get(
        String(
          appointment.patient_id,
        ),
      ) || "this patient";

    const confirmed =
      window.confirm(
        `Delete the appointment for ${patientName}?`,
      );

    if (!confirmed) return;

    try {
      await api(
        `/appointments/${appointment.id}`,
        {
          method: "DELETE",
        },
      );

      await loadAppointments();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const diagnosePatient = (
    appointment,
  ) => {
    if (!isDoctor) return;

    navigate(
      `/consultations/new?patient=${appointment.patient_id}&appointment=${appointment.id}`,
    );
  };

  const AppointmentTable = ({
    records,
    completed = false,
  }) => (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-212.5 text-left">
        <thead>
          <tr className="border-b text-xs uppercase text-slate-400">
            <th className="p-3">
              Patient
            </th>

            <th className="p-3">
              Service
            </th>

            <th className="p-3">
              Date and time
            </th>

            <th className="p-3">
              Status
            </th>

            <th className="p-3 text-right">
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {records.length ? (
            records.map(
              (appointment) => (
                <tr
                  key={appointment.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          completed
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-pink-50 text-pink-600"
                        }`}
                      >
                        <User size={17} />
                      </div>

                      <div>
                        <p className="font-semibold text-slate-800">
                          {patientMap.get(
                            String(
                              appointment.patient_id,
                            ),
                          ) ||
                            `Patient #${appointment.patient_id}`}
                        </p>

                        <p className="text-xs text-slate-400">
                          Patient ID:{" "}
                          {
                            appointment.patient_id
                          }
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="p-3 text-sm text-slate-600">
                    {appointment.service ||
                      "—"}
                  </td>

                  <td className="p-3 text-sm text-slate-600">
                    {formatDate(
                      appointment.appointment_date,
                    )}
                  </td>

                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(
                        appointment.status,
                      )}`}
                    >
                      {appointment.status ||
                        "Scheduled"}
                    </span>
                  </td>

                  <td className="whitespace-nowrap p-3 text-right">
                    {!completed &&
                      isDoctor && (
                        <button
                          type="button"
                          onClick={() =>
                            diagnosePatient(
                              appointment,
                            )
                          }
                          disabled={[
                            "Cancelled",
                            "No Show",
                          ].includes(
                            appointment.status,
                          )}
                          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <Stethoscope
                            size={17}
                          />

                          Diagnose
                        </button>
                      )}

                    {!completed &&
                      canManageAppointments && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              editAppointment(
                                appointment,
                              )
                            }
                            className="mr-1 rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                            title="Edit appointment"
                          >
                            <Edit
                              size={18}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteAppointment(
                                appointment,
                              )
                            }
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete appointment"
                          >
                            <Trash2
                              size={18}
                            />
                          </button>
                        </>
                      )}

                    {completed && (
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600">
                        <CheckCircle2
                          size={17}
                        />

                        Consultation completed
                      </span>
                    )}
                  </td>
                </tr>
              ),
            )
          ) : (
            <tr>
              <td
                colSpan="5"
                className="p-10 text-center text-sm text-slate-500"
              >
                {completed
                  ? "No completed consultations found."
                  : "No active appointments found."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeItem="Appointments" />

      <div className="min-w-0 flex-1">
        <header className="m-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-linear-to-r from-pink-600 to-rose-400 p-6 text-white sm:m-6">
          <div>
            <p className="text-sm text-pink-100">
              {isDoctor
                ? "Doctor Appointment Queue"
                : "Appointment Management"}
            </p>

            <h1 className="text-3xl font-bold">
              Appointments
            </h1>

            <p className="mt-1 text-sm text-pink-100">
              {isDoctor
                ? "Select an appointed patient to begin consultation."
                : "Schedule and manage patient appointments."}
            </p>
          </div>

          {canManageAppointments && (
            <button
              type="button"
              onClick={
                openNewAppointment
              }
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-pink-600 shadow-sm hover:bg-pink-50"
            >
              <Plus size={19} />
              New appointment
            </button>
          )}
        </header>

        <main className="space-y-6 px-4 pb-8 sm:px-6">
          <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-pink-50 p-3">
                <CalendarDays className="text-pink-600" />
              </div>

              <div>
                <h2 className="font-bold text-slate-800">
                  {isDoctor
                    ? "Patients waiting for consultation"
                    : "Active appointments"}
                </h2>

                <p className="text-sm text-slate-500">
                  {
                    activeAppointments.length
                  }{" "}
                  active appointment
                  {activeAppointments.length ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>
            </div>

            <label className="mt-6 flex max-w-xl items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-pink-400">
              <Search
                size={18}
                className="text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search patient, service, status, or date"
                className="w-full outline-none"
              />
            </label>

            {message && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {message}
              </p>
            )}

            <AppointmentTable
              records={
                activeAppointments
              }
            />
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3">
                <CheckCircle2 className="text-emerald-600" />
              </div>

              <div>
                <h2 className="font-bold text-slate-800">
                  Completed consultations
                </h2>

                <p className="text-sm text-slate-500">
                  {
                    completedAppointments.length
                  }{" "}
                  completed consultation
                  {completedAppointments.length ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>
            </div>

            <AppointmentTable
              records={
                completedAppointments
              }
              completed
            />
          </section>
        </main>
      </div>

      {showForm && canManageAppointments && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4">
          <form
            onSubmit={
              saveAppointment
            }
            className="mx-auto my-8 max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {editingId
                    ? "Edit appointment"
                    : "Schedule appointment"}
                </h2>

                <p className="text-sm text-slate-500">
                  Appointment form for doctors and secretaries
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X />
              </button>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-600 sm:col-span-2">
                Patient

                <select
                  name="patient_id"
                  value={
                    form.patient_id
                  }
                  onChange={
                    handleChange
                  }
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <option value="">
                    Select patient
                  </option>

                  {patients.map(
                    (patient) => (
                      <option
                        key={
                          patient.id
                        }
                        value={
                          patient.id
                        }
                      >
                        {
                          patient.patient_number
                        }{" "}
                        —{" "}
                        {
                          patient.last_name
                        }
                        ,{" "}
                        {
                          patient.first_name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-600">
                Service

                <select
                  name="service"
                  value={form.service}
                  onChange={
                    handleChange
                  }
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <option value="">
                    Select service
                  </option>

                  {services.map(
                    (service) => (
                      <option
                        key={service}
                        value={service}
                      >
                        {service}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-600">
                Status

                <select
                  name="status"
                  value={form.status}
                  onChange={
                    handleChange
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  {statuses.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-600 sm:col-span-2">
                Appointment date and time

                <input
                  type="datetime-local"
                  name="appointment_date"
                  value={
                    form.appointment_date
                  }
                  onChange={
                    handleChange
                  }
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                />
              </label>
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl px-4 py-2.5"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-pink-600 px-5 py-2.5 font-semibold text-white disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update appointment"
                    : "Save appointment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}