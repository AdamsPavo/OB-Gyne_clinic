import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Clock3,
  FilePlus2,
  FlaskConical,
  PhilippinePeso,
  RefreshCw,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import { api } from "../api/client";

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const todayLabel = new Date().toLocaleDateString("en-PH", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export default function Dashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api("/dashboard");
      setData(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const cards = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      {
        label: "Total Patients",
        value: Number(data.totalPatients || 0),
        description: "Active patient records",
        icon: Users,
        iconClass: "bg-pink-100 text-pink-600",
        accentClass: "from-pink-500 to-rose-400",
      },
      {
        label: "Today's Consultations",
        value: Number(data.consultationsToday || 0),
        description: "Consultations recorded today",
        icon: Stethoscope,
        iconClass: "bg-teal-100 text-teal-700",
        accentClass: "from-teal-600 to-cyan-500",
      },
      {
        label: "Today's Income",
        value: currency.format(
          Number(data.incomeToday || 0),
        ),
        description: "Payments collected today",
        icon: PhilippinePeso,
        iconClass:
          "bg-emerald-100 text-emerald-700",
        accentClass:
          "from-emerald-600 to-green-500",
      },
      {
        label: "Pending Laboratory",
        value: Number(data.pendingLabs || 0),
        description: "Requested or pending results",
        icon: FlaskConical,
        iconClass: "bg-amber-100 text-amber-700",
        accentClass:
          "from-amber-500 to-orange-400",
      },
    ];
  }, [data]);

  const recentPatients =
    data?.recentPatients || [];

  const followUps = data?.followUps || [];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeItem="Dashboard" />

      <div className="min-w-0 flex-1">
        <header className="m-4 overflow-hidden rounded-3xl bg-linear-to-r from-pink-600 via-rose-500 to-orange-400 text-white shadow-xl shadow-pink-200/60 sm:m-6">
          <div className="relative p-6 sm:p-8">
            <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/10" />
            <div className="absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-white/10" />

            <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div>
                <p className="text-sm font-medium text-pink-100">
                  OB-GYN Clinic Management
                </p>

                <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                  Clinic Dashboard
                </h1>

                <p className="mt-3 max-w-2xl text-sm text-pink-50 sm:text-base">
                  Monitor today&apos;s clinic
                  activity, patient records,
                  consultations, laboratory
                  requests, and income.
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-medium ring-1 ring-white/20">
                  <CalendarDays size={17} />
                  {todayLabel}
                </div>
              </div>

              <button
                type="button"
                onClick={loadDashboard}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-white px-5 py-3 font-semibold text-pink-600 shadow-sm transition hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-60 lg:self-center"
              >
                <RefreshCw
                  size={18}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />
                Refresh dashboard
              </button>
            </div>
          </div>
        </header>

        <main className="space-y-6 px-4 pb-10 sm:px-6">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map(
                  (_, index) => (
                    <div
                      key={index}
                      className="animate-pulse rounded-3xl bg-white p-5 shadow-sm"
                    >
                      <div className="h-4 w-28 rounded bg-slate-200" />
                      <div className="mt-4 h-9 w-24 rounded bg-slate-200" />
                      <div className="mt-3 h-3 w-36 rounded bg-slate-100" />
                    </div>
                  ),
                )
              : cards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <article
                      key={card.label}
                      className="group relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                    >
                      <div
                        className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${card.accentClass}`}
                      />

                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-500">
                            {card.label}
                          </p>

                          <p className="mt-2 truncate text-3xl font-bold text-slate-900">
                            {card.value}
                          </p>

                          <p className="mt-2 text-xs text-slate-400">
                            {card.description}
                          </p>
                        </div>

                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${card.iconClass}`}
                        >
                          <Icon size={23} />
                        </div>
                      </div>
                    </article>
                  );
                })}
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <QuickAction
              title="Add Patient"
              description="Register a new patient"
              icon={UserPlus}
              onClick={() =>
                navigate("/patients")
              }
              className="bg-pink-50 text-pink-700"
            />

            <QuickAction
              title="New Appointment"
              description="Schedule a clinic visit"
              icon={CalendarDays}
              onClick={() =>
                navigate("/appointments")
              }
              className="bg-blue-50 text-blue-700"
            />

            <QuickAction
              title="New Consultation"
              description="Open consultation form"
              icon={FilePlus2}
              onClick={() =>
                navigate("/consultations")
              }
              className="bg-teal-50 text-teal-700"
            />

            <QuickAction
              title="Billing and Cashier"
              description="Process clinic payments"
              icon={PhilippinePeso}
              onClick={() =>
                navigate("/billing")
              }
              className="bg-emerald-50 text-emerald-700"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
                    <Users size={21} />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Recent Patients
                    </h2>

                    <p className="text-sm text-slate-500">
                      Newly registered patient
                      records
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/patients")
                  }
                  className="inline-flex items-center gap-2 text-sm font-semibold text-pink-600 transition hover:text-pink-700"
                >
                  View all
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="mt-5">
                {loading ? (
                  <ListSkeleton />
                ) : recentPatients.length ? (
                  <div className="space-y-3">
                    {recentPatients.map(
                      (patient) => (
                        <button
                          type="button"
                          key={patient.id}
                          onClick={() =>
                            navigate(
                              `/patients/${patient.id}`,
                            )
                          }
                          className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-100 px-4 py-3 text-left transition hover:border-pink-200 hover:bg-pink-50/50"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 font-bold text-pink-700">
                              {String(
                                patient.first_name ||
                                  "P",
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">
                                {patient.last_name},{" "}
                                {patient.first_name}
                              </p>

                              <p className="truncate text-xs text-slate-400">
                                {patient.contact_number ||
                                  "No contact number"}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-600">
                            {patient.patient_number}
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={Users}
                    title="No patients yet"
                    description="Registered patients will appear here."
                  />
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                    <Clock3 size={21} />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Upcoming Follow-ups
                    </h2>

                    <p className="text-sm text-slate-500">
                      Scheduled patient follow-up
                      dates
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/consultations")
                  }
                  className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 transition hover:text-teal-800"
                >
                  View cases
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="mt-5">
                {loading ? (
                  <ListSkeleton />
                ) : followUps.length ? (
                  <div className="space-y-3">
                    {followUps.map(
                      (followUp) => (
                        <div
                          key={
                            followUp.case_number
                          }
                          className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                              <Stethoscope
                                size={18}
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">
                                {followUp.last_name},{" "}
                                {followUp.first_name}
                              </p>

                              <p className="text-xs text-slate-400">
                                {followUp.case_number}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-teal-700">
                              {formatDate(
                                followUp.follow_up_date,
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Follow-up date
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="No follow-ups scheduled"
                    description="Upcoming follow-up schedules will appear here."
                  />
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <ClinicOverviewCard
              title="Patient Records"
              value={data?.totalPatients || 0}
              description="Total active patients in the clinic database."
              icon={Users}
              className="bg-pink-50 text-pink-700"
            />

            <ClinicOverviewCard
              title="Clinic Activity"
              value={
                data?.consultationsToday || 0
              }
              description="Consultation records created today."
              icon={Activity}
              className="bg-teal-50 text-teal-700"
            />

            <ClinicOverviewCard
              title="Laboratory Queue"
              value={data?.pendingLabs || 0}
              description="Laboratory requests awaiting completion."
              icon={FlaskConical}
              className="bg-amber-50 text-amber-700"
            />
          </section>
        </main>
      </div>
    </div>
  );
}

function QuickAction({
  title,
  description,
  icon: Icon,
  onClick,
  className,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-between gap-4 rounded-3xl bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${className}`}
        >
          <Icon size={21} />
        </div>

        <div>
          <p className="font-bold text-slate-900">
            {title}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <ArrowRight
        size={18}
        className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-500"
      />
    </button>
  );
}

function ClinicOverviewCard({
  title,
  value,
  description,
  icon: Icon,
  className,
}) {
  return (
    <article className="rounded-3xl bg-white p-5 shadow-sm">
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${className}`}
      >
        <Icon size={21} />
      </div>

      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        {description}
      </p>
    </article>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-8 text-center">
      <Icon className="mx-auto mb-3 text-slate-300" />

      <p className="font-semibold text-slate-600">
        {title}
      </p>

      <p className="mt-1 text-sm text-slate-400">
        {description}
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map(
        (_, index) => (
          <div
            key={index}
            className="flex animate-pulse items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-200" />

              <div>
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
              </div>
            </div>

            <div className="h-6 w-20 rounded-full bg-slate-100" />
          </div>
        ),
      )}
    </div>
  );
}