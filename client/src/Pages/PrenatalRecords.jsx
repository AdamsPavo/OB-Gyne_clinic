import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Baby,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  HeartPulse,
  RefreshCw,
  Search,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import { api } from "../api/client";

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const calculateAge = (birthDate) => {
  if (!birthDate) return "—";

  const birth = new Date(`${birthDate}T00:00:00`);

  if (Number.isNaN(birth.getTime())) {
    return "—";
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();

  const monthDifference =
    today.getMonth() - birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }

  return age;
};

const getPatientName = (record) => {
  const name = [
    record.first_name,
    record.middle_name,
    record.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    name ||
    record.patient_name ||
    record.full_name ||
    "Unknown patient"
  );
};

const getGestationalAge = (record) => {
  const weeks =
    record.gestational_weeks ??
    record.gestational_age_weeks;

  const days = record.gestational_days ?? 0;

  if (
    weeks === null ||
    weeks === undefined ||
    weeks === ""
  ) {
    return "—";
  }

  return `${weeks} week${Number(weeks) === 1 ? "" : "s"}${
    Number(days) > 0
      ? `, ${days} day${Number(days) === 1 ? "" : "s"}`
      : ""
  }`;
};

const riskBadge = (riskLevel) => {
  const normalized = String(
    riskLevel || "Low Risk",
  ).toLowerCase();

  if (normalized.includes("high")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (normalized.includes("moderate")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const parseRiskReasons = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean);
    }
  } catch {
    // The stored value may be plain text.
  }

  return String(value)
    .split(/\n|,|\|/)
    .map((reason) => reason.trim())
    .filter(Boolean);
};

const DetailItem = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
      {label}
    </p>

    <p className="mt-1 wrap-break-word text-sm font-semibold text-slate-700">
      {value || "—"}
    </p>
  </div>
);

export default function PrenatalRecords() {
  const [searchParams] = useSearchParams();

  const selectedPatientFromUrl =
    searchParams.get("patient") || "";

  const selectedRecordFromUrl =
    searchParams.get("record") || "";

  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] =
    useState("All");

  const [selectedRecord, setSelectedRecord] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [currentPage, setCurrentPage] =
    useState(1);

  const recordsPerPage = 10;

  const loadRecords = async () => {
    setLoading(true);
    setMessage("");

    try {
      const data = await api("/prenatal-records");

      const recordList = Array.isArray(data)
        ? data
        : data?.records || [];

      setRecords(recordList);

      if (selectedRecordFromUrl) {
        const matchingRecord = recordList.find(
          (record) =>
            String(record.id) ===
            String(selectedRecordFromUrl),
        );

        if (matchingRecord) {
          setSelectedRecord(matchingRecord);
        }
      }
    } catch (error) {
      setMessage(
        error.message ||
          "Unable to load prenatal records.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, riskFilter]);

  const filteredRecords = useMemo(() => {
    const searchValue = search
      .trim()
      .toLowerCase();

    return records.filter((record) => {
      if (
        selectedPatientFromUrl &&
        String(record.patient_id) !==
          String(selectedPatientFromUrl)
      ) {
        return false;
      }

      const patientName =
        getPatientName(record).toLowerCase();

      const patientNumber = String(
        record.patient_number || "",
      ).toLowerCase();

      const serviceType = String(
        record.service_type || "",
      ).toLowerCase();

      const matchesSearch =
        !searchValue ||
        patientName.includes(searchValue) ||
        patientNumber.includes(searchValue) ||
        serviceType.includes(searchValue);

      const recordRisk = String(
        record.risk_level || "Low Risk",
      ).toLowerCase();

      const matchesRisk =
        riskFilter === "All" ||
        recordRisk === riskFilter.toLowerCase();

      return matchesSearch && matchesRisk;
    });
  }, [
    records,
    search,
    riskFilter,
    selectedPatientFromUrl,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRecords.length / recordsPerPage,
    ),
  );

  const pageStart =
    (currentPage - 1) * recordsPerPage;

  const displayedRecords = filteredRecords.slice(
    pageStart,
    pageStart + recordsPerPage,
  );

  const statistics = useMemo(() => {
    const highRisk = records.filter((record) =>
      String(record.risk_level || "")
        .toLowerCase()
        .includes("high"),
    ).length;

    const moderateRisk = records.filter((record) =>
      String(record.risk_level || "")
        .toLowerCase()
        .includes("moderate"),
    ).length;

    const lowRisk = records.filter((record) => {
      const risk = String(
        record.risk_level || "Low Risk",
      ).toLowerCase();

      return (
        !risk.includes("high") &&
        !risk.includes("moderate")
      );
    }).length;

    return {
      total: records.length,
      highRisk,
      moderateRisk,
      lowRisk,
    };
  }, [records]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeItem="Prenatal Records" />

      <div className="min-w-0 flex-1">
        <header className="m-4 rounded-3xl bg-linear-to-r from-pink-700 via-pink-600 to-rose-500 p-6 text-white shadow-sm sm:m-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-pink-100">
                Maternal health monitoring
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                Prenatal Records
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-pink-100">
                Review pregnancy history, gestational
                progress, fetal assessment, and pregnancy
                risk levels.
              </p>
            </div>

            <Link
              to="/consultations"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-pink-700 shadow-sm transition hover:bg-pink-50"
            >
              <Stethoscope size={17} />
              New consultation
            </Link>
          </div>
        </header>

        <main className="px-4 pb-8 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    Total records
                  </p>

                  <p className="mt-2 text-3xl font-bold text-slate-800">
                    {statistics.total}
                  </p>
                </div>

                <div className="rounded-2xl bg-pink-50 p-3 text-pink-600">
                  <Baby size={24} />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    Low risk
                  </p>

                  <p className="mt-2 text-3xl font-bold text-emerald-600">
                    {statistics.lowRisk}
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <HeartPulse size={24} />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    Moderate risk
                  </p>

                  <p className="mt-2 text-3xl font-bold text-amber-600">
                    {statistics.moderateRisk}
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                  <AlertTriangle size={24} />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    High risk
                  </p>

                  <p className="mt-2 text-3xl font-bold text-rose-600">
                    {statistics.highRisk}
                  </p>
                </div>

                <div className="rounded-2xl bg-rose-50 p-3 text-rose-600">
                  <AlertTriangle size={24} />
                </div>
              </div>
            </div>
          </div>

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Saved prenatal records
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedPatientFromUrl
                    ? "Showing records for the selected patient."
                    : "Search and review all prenatal visits."}
                </p>
              </div>

              <button
                type="button"
                onClick={loadRecords}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={
                    loading ? "animate-spin" : ""
                  }
                />
                Refresh
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search patient name, number, or service"
                  className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
                />
              </div>

              <select
                value={riskFilter}
                onChange={(event) =>
                  setRiskFilter(event.target.value)
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
              >
                <option value="All">
                  All risk levels
                </option>

                <option value="Low Risk">
                  Low Risk
                </option>

                <option value="Moderate Risk">
                  Moderate Risk
                </option>

                <option value="High Risk">
                  High Risk
                </option>
              </select>
            </div>

            {message && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {message}
              </div>
            )}

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Patient
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Visit date
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Gestational age
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Fetal heart rate
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Risk level
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {loading ? (
                      <tr>
                        <td
                          colSpan="6"
                          className="px-4 py-14 text-center text-sm text-slate-500"
                        >
                          <RefreshCw className="mx-auto mb-3 animate-spin text-pink-500" />

                          Loading prenatal records…
                        </td>
                      </tr>
                    ) : displayedRecords.length > 0 ? (
                      displayedRecords.map((record) => (
                        <tr
                          key={record.id}
                          className="transition hover:bg-pink-50/40"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-700">
                                <UserRound size={18} />
                              </div>

                              <div>
                                <p className="font-semibold text-slate-800">
                                  {getPatientName(record)}
                                </p>

                                <p className="mt-0.5 text-xs text-slate-500">
                                  {record.patient_number ||
                                    `Patient ID: ${record.patient_id}`}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                            {formatDate(record.visit_date)}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                            {getGestationalAge(record)}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                            {record.fetal_heart_rate
                              ? `${record.fetal_heart_rate} bpm`
                              : "—"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${riskBadge(
                                record.risk_level,
                              )}`}
                            >
                              {record.risk_level ||
                                "Low Risk"}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedRecord(record)
                              }
                              className="inline-flex items-center gap-2 rounded-xl bg-pink-50 px-3 py-2 text-sm font-semibold text-pink-700 transition hover:bg-pink-100"
                            >
                              <Eye size={16} />
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="6"
                          className="px-4 py-14 text-center"
                        >
                          <Baby
                            size={38}
                            className="mx-auto text-slate-300"
                          />

                          <p className="mt-3 font-semibold text-slate-600">
                            No prenatal records found
                          </p>

                          <p className="mt-1 text-sm text-slate-400">
                            Try changing your search or
                            risk filter.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {!loading && filteredRecords.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-700">
                    {pageStart + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-slate-700">
                    {Math.min(
                      pageStart + recordsPerPage,
                      filteredRecords.length,
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700">
                    {filteredRecords.length}
                  </span>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.max(1, page - 1),
                      )
                    }
                    disabled={currentPage === 1}
                    className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(
                          totalPages,
                          page + 1,
                        ),
                      )
                    }
                    disabled={
                      currentPage === totalPages
                    }
                    className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-100 text-pink-700">
                  <Baby size={24} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-pink-600">
                    Prenatal record
                  </p>

                  <h2 className="text-xl font-bold text-slate-800">
                    {getPatientName(selectedRecord)}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Visit on{" "}
                    {formatDate(selectedRecord.visit_date)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedRecord(null)
                }
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink-100 bg-pink-50 p-4">
                <div>
                  <p className="text-sm text-slate-500">
                    Pregnancy risk assessment
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${riskBadge(
                      selectedRecord.risk_level,
                    )}`}
                  >
                    {selectedRecord.risk_level ||
                      "Low Risk"}
                  </span>
                </div>

                {selectedRecord.patient_id && (
                  <Link
                    to={`/patients/${selectedRecord.patient_id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-pink-700 shadow-sm transition hover:bg-pink-100"
                  >
                    <UserRound size={17} />
                    Patient profile
                  </Link>
                )}
              </div>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <UserRound
                    size={19}
                    className="text-pink-600"
                  />

                  <h3 className="font-bold text-slate-800">
                    Patient and visit information
                  </h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailItem
                    label="Patient number"
                    value={
                      selectedRecord.patient_number ||
                      `ID ${selectedRecord.patient_id}`
                    }
                  />

                  <DetailItem
                    label="Age"
                    value={
                      calculateAge(
                        selectedRecord.birth_date,
                      ) === "—"
                        ? "—"
                        : `${calculateAge(
                            selectedRecord.birth_date,
                          )} years old`
                    }
                  />

                  <DetailItem
                    label="Visit date"
                    value={formatDateTime(
                      selectedRecord.visit_date,
                    )}
                  />

                  <DetailItem
                    label="Service"
                    value={
                      selectedRecord.service_type ||
                      "Prenatal Checkup"
                    }
                  />

                  <DetailItem
                    label="Doctor"
                    value={
                      selectedRecord.doctor_name ||
                      selectedRecord.fullname ||
                      "—"
                    }
                  />

                  <DetailItem
                    label="Blood pressure"
                    value={
                      selectedRecord.blood_pressure
                    }
                  />

                  <DetailItem
                    label="Temperature"
                    value={
                      selectedRecord.temperature_c !==
                        null &&
                      selectedRecord.temperature_c !==
                        undefined
                        ? `${selectedRecord.temperature_c} °C`
                        : "—"
                    }
                  />

                  <DetailItem
                    label="Weight"
                    value={
                      selectedRecord.weight_kg !==
                        null &&
                      selectedRecord.weight_kg !==
                        undefined
                        ? `${selectedRecord.weight_kg} kg`
                        : "—"
                    }
                  />
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays
                    size={19}
                    className="text-pink-600"
                  />

                  <h3 className="font-bold text-slate-800">
                    Pregnancy dates
                  </h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailItem
                    label="Last menstrual period"
                    value={formatDate(
                      selectedRecord.lmp_date,
                    )}
                  />

                  <DetailItem
                    label="Estimated delivery date"
                    value={formatDate(
                      selectedRecord.estimated_delivery_date,
                    )}
                  />

                  <DetailItem
                    label="Gestational age"
                    value={getGestationalAge(
                      selectedRecord,
                    )}
                  />

                  <DetailItem
                    label="Next prenatal visit"
                    value={formatDate(
                      selectedRecord.next_visit_date,
                    )}
                  />
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Baby
                    size={19}
                    className="text-pink-600"
                  />

                  <h3 className="font-bold text-slate-800">
                    Obstetric history
                  </h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <DetailItem
                    label="Gravida"
                    value={String(
                      selectedRecord.gravida ?? "—",
                    )}
                  />

                  <DetailItem
                    label="Para"
                    value={String(
                      selectedRecord.para ?? "—",
                    )}
                  />

                  <DetailItem
                    label="Abortions"
                    value={String(
                      selectedRecord.abortion_count ??
                        "—",
                    )}
                  />

                  <DetailItem
                    label="Living children"
                    value={String(
                      selectedRecord.living_children ??
                        "—",
                    )}
                  />

                  <DetailItem
                    label="Number of fetuses"
                    value={String(
                      selectedRecord.number_of_fetuses ??
                        1,
                    )}
                  />
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <HeartPulse
                    size={19}
                    className="text-pink-600"
                  />

                  <h3 className="font-bold text-slate-800">
                    Fetal assessment
                  </h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailItem
                    label="Fundal height"
                    value={
                      selectedRecord.fundal_height_cm !==
                        null &&
                      selectedRecord.fundal_height_cm !==
                        undefined
                        ? `${selectedRecord.fundal_height_cm} cm`
                        : "—"
                    }
                  />

                  <DetailItem
                    label="Fetal heart rate"
                    value={
                      selectedRecord.fetal_heart_rate
                        ? `${selectedRecord.fetal_heart_rate} bpm`
                        : "—"
                    }
                  />

                  <DetailItem
                    label="Fetal movement"
                    value={
                      selectedRecord.fetal_movement
                    }
                  />

                  <DetailItem
                    label="Fetal presentation"
                    value={
                      selectedRecord.fetal_presentation
                    }
                  />

                  <DetailItem
                    label="Edema"
                    value={selectedRecord.edema}
                  />

                  <DetailItem
                    label="Height"
                    value={
                      selectedRecord.height_cm !==
                        null &&
                      selectedRecord.height_cm !==
                        undefined
                        ? `${selectedRecord.height_cm} cm`
                        : "—"
                    }
                  />
                </div>
              </section>

              {parseRiskReasons(
                selectedRecord.risk_reasons,
              ).length > 0 && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle size={19} />

                    <h3 className="font-bold">
                      Risk factors
                    </h3>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {parseRiskReasons(
                      selectedRecord.risk_reasons,
                    ).map((reason, index) => (
                      <li
                        key={`${reason}-${index}`}
                        className="flex gap-2 text-sm text-amber-800"
                      >
                        <span>•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="font-bold text-slate-800">
                  Clinical notes
                </h3>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <DetailItem
                    label="Assessment"
                    value={selectedRecord.assessment}
                  />

                  <DetailItem
                    label="Treatment"
                    value={selectedRecord.treatment}
                  />

                  <div className="md:col-span-2">
                    <DetailItem
                      label="Prenatal notes"
                      value={selectedRecord.notes}
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}