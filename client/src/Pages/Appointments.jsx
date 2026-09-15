import { can } from "../auth";
import PermissionButton from "../components/PermissionButton";
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
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";

const localDateTime = () => {
  const date = new Date();
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 16);
};

const createBlankForm = () => ({
  patient_id: "",
  service: "",
  service_id: "",
  appointment_date: localDateTime(),
  status: "Scheduled",
});

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





  const isDoctor = can("consultations", "create") && can("appointments", "complete");



  const canManageAppointments =
    can("appointments", "create") || can("appointments", "edit");

  const selectedPatientFromUrl =
    searchParams.get("patient") || "";

  const [appointments, setAppointments] =
    useState([]);
  const [serviceTypes, setServiceTypes] =
    useState([]);

  const [patients, setPatients] =
    useState([]);

  const [form, setForm] = useState({
    ...createBlankForm(),
    patient_id: selectedPatientFromUrl,
  });

  const [search, setSearch] =
    useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [activePatientIndex, setActivePatientIndex] = useState(-1);

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
      api("/services/active").then((records) =>
        setServiceTypes(
          Array.isArray(records) ? records : [],
        ),
      ),
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

  const matchingPatients = useMemo(() => {
    const terms = patientSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return patients.filter((patient) => {
      const searchable = `${patientMap.get(String(patient.id)) || ""} ${patient.patient_number || ""}`.toLowerCase();
      return terms.every((term) => searchable.includes(term));
    });
  }, [patients, patientMap, patientSearch]);

  const selectedPatientName = patientMap.get(String(form.patient_id));

  const selectPatient = (patient) => {
    setForm((current) => ({ ...current, patient_id: String(patient.id) }));
    setPatientSearch("");
    setPatientSearchOpen(false);
    setActivePatientIndex(-1);
  };


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

    setPatientSearch("");
    setPatientSearchOpen(false);
    setActivePatientIndex(-1);
    setEditingId(null);
    setMessage("");

    setForm({
      ...createBlankForm(),
      patient_id:
        selectedPatientFromUrl,
    });

    setShowForm(true);
  };

  const closeForm = () => {
    setPatientSearch("");
    setPatientSearchOpen(false);
    setActivePatientIndex(-1);
    setShowForm(false);
    setEditingId(null);
    setForm(createBlankForm());

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
        service_id: Number(form.service_id),
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
    setPatientSearch("");
    setPatientSearchOpen(false);
    setActivePatientIndex(-1);

    setForm({
      patient_id: String(
        appointment.patient_id || "",
      ),

      service:
        appointment.service || "",
      service_id: String(appointment.service_id || ""),

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
    <div
      tabIndex={0}
      role="region"
      aria-label={completed ? "Completed consultations" : "Active appointments"}
      className="mt-6 max-h-[min(360px,45dvh)] min-h-0 overflow-auto overscroll-contain"
    >
      <table className="w-full min-w-212.5 text-left">
        <thead className="sticky top-0 z-10 bg-pink-100">
          <tr className="border-b text-xs uppercase text-slate-400">
            <th className="sticky top-0 z-10 bg-pink-100 p-3">
              Patient
            </th>

            <th className="sticky top-0 z-10 bg-pink-100 p-3">
              Service
            </th>

            <th className="sticky top-0 z-10 bg-pink-100 p-3">
              Date and time
            </th>

            <th className="sticky top-0 z-10 bg-pink-100 p-3">
              Status
            </th>

            <th className="sticky top-0 z-10 bg-pink-100 p-3 text-right">
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
                  className={`border-b border-slate-100 hover:bg-slate-50 ${completed && appointment.consultation_case_id && can("consultations") ? "cursor-pointer" : ""}`}
                  onClick={completed && appointment.consultation_case_id && can("consultations") ? (event) => {
                    if (!event.target.closest("a, button")) navigate(`/cases/${appointment.consultation_case_id}`);
                  } : undefined}
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
                        <PermissionButton module="consultations" action={"create"}
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
                        </PermissionButton>
                      )}

                    {!completed &&
                      canManageAppointments && (
                        <>
                          <PermissionButton module="appointments" action={"edit"}
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
                          </PermissionButton>

                          <PermissionButton module="appointments" action={"delete"}
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
                          </PermissionButton>
                        </>
                      )}

                    {completed && appointment.consultation_case_id && can("consultations") ? (
                      <Link to={`/cases/${appointment.consultation_case_id}`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600">
                        <CheckCircle2 size={17} /> View consultation / Print
                      </Link>
                    ) : completed && (
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600">
                        <CheckCircle2
                          size={17}
                        />

                        {appointment.consultation_case_id ? "Consultation access required" : "No linked consultation"}
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
        <header className="clinic-page-header m-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-linear-to-r from-pink-600 to-rose-400 p-6 text-white sm:m-6">
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
            <PermissionButton module="appointments" action={"create"}
              type="button"
              onClick={
                openNewAppointment
              }
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-pink-600 shadow-sm hover:bg-pink-50"
            >
              <Plus size={19} />
              Add appointment
            </PermissionButton>
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

          <section className="flex min-h-0 scroll-mt-16 flex-col rounded-3xl bg-white p-5 shadow-sm sm:p-6">
            <div className="flex shrink-0 items-center gap-3">
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
            className="mx-auto my-4 max-h-[calc(100dvh-4rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {editingId
                    ? "Edit appointment"
                    : "Schedule appointment"}
                </h2>

                <p className="text-sm text-slate-500">
                  Select a patient and enter the appointment details.
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
              <div
                className="relative sm:col-span-2"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setPatientSearchOpen(false);
                    setActivePatientIndex(-1);
                  }
                }}
              >
                <label className="block text-sm font-medium text-slate-600">
                  Patient
                  <span className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-pink-400">
                    <Search size={18} className="shrink-0 text-slate-400" />
                    <input
                      type="text"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={patientSearchOpen}
                      aria-controls="appointment-patient-results"
                      aria-activedescendant={patientSearchOpen && matchingPatients[activePatientIndex] ? `appointment-patient-${matchingPatients[activePatientIndex].id}` : undefined}
                      autoComplete="off"
                      value={patientSearch}
                      onFocus={() => setPatientSearchOpen(true)}
                      onChange={(event) => {
                        setPatientSearch(event.target.value);
                        setPatientSearchOpen(true);
                        setActivePatientIndex(-1);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                          event.preventDefault();
                          setPatientSearchOpen(true);
                          const next = event.key === "ArrowDown"
                            ? Math.min(activePatientIndex + 1, matchingPatients.length - 1)
                            : Math.max(activePatientIndex - 1, 0);
                          setActivePatientIndex(next);
                          if (matchingPatients[next]) {
                            document.getElementById(`appointment-patient-${matchingPatients[next].id}`)?.scrollIntoView({ block: "nearest" });
                          }
                        } else if (event.key === "Enter" && patientSearchOpen) {
                          event.preventDefault();
                          if (matchingPatients[activePatientIndex]) selectPatient(matchingPatients[activePatientIndex]);
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          setPatientSearchOpen(false);
                          setActivePatientIndex(-1);
                        }
                      }}
                      placeholder="Search by full name or patient number"
                      className="min-w-0 w-full outline-none"
                    />
                  </span>
                </label>
                {patientSearchOpen && (
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    <ul id="appointment-patient-results" role="listbox" aria-label="Patients">
                      {matchingPatients.map((patient, index) => (
                        <li
                          key={patient.id}
                          id={`appointment-patient-${patient.id}`}
                          role="option"
                          aria-selected={String(patient.id) === String(form.patient_id)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectPatient(patient)}
                          className={`cursor-pointer px-3 py-2.5 text-sm hover:bg-pink-50 ${index === activePatientIndex ? "bg-pink-50" : ""}`}
                        >
                          <span className="block break-words font-medium text-slate-800">{patientMap.get(String(patient.id))}</span>
                          {patient.patient_number && <span className="text-xs text-slate-500">{patient.patient_number}</span>}
                        </li>
                      ))}
                    </ul>
                    {matchingPatients.length === 0 && (
                      <p role="status" className="px-3 py-2.5 text-sm text-slate-500">No patients match your search.</p>
                    )}
                  </div>
                )}
              </div>

              {selectedPatientName && (
                <div aria-live="polite" className="rounded-xl bg-pink-50 px-4 py-3 sm:col-span-2">
                  <p className="text-xs font-medium text-slate-500">Selected patient</p>
                  <p className="break-words font-semibold text-pink-700">{selectedPatientName}</p>
                </div>
              )}

              <label className="text-sm font-medium text-slate-600">
                Service

                <select
                  name="service_id"
                  value={form.service_id}
                  onChange={(event) => {
                    const selected = serviceTypes.find((service) => String(service.id) === event.target.value);
                    setForm((current) => ({ ...current, service_id: event.target.value, service: selected?.service_name || "" }));
                  }}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <option value="">
                    Select service
                  </option>

                  {serviceTypes.map(
                    (service) => (
                      <option
                        key={service.id}
                        value={service.id}
                      >
                        {service.name}
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

            {message && <p role="alert" className="mt-4 text-sm text-red-600">{message}</p>}

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl px-4 py-2.5"
              >
                Cancel
              </button>

              <PermissionButton module="appointments" action={editingId ? "edit" : "create"}
                type="submit"
                disabled={saving}
                className="rounded-xl bg-pink-600 px-5 py-2.5 font-semibold text-white disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update appointment"
                    : "Save appointment"}
              </PermissionButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
