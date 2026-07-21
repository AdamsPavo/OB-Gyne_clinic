import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Lock,
  MapPin,
  Stethoscope,
  UserRoundPlus,
  Users,
} from "lucide-react";

import { api } from "../api/client";

const initialForm = {
  clinicName: "",
  clinicAddress: "",
  doctorName: "",

  doctorUsername: "",
  doctorPassword: "",

  staffName: "",
  staffUsername: "",
  staffPassword: "",
};

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => {
    setForm((previous) => ({
      ...previous,
      [key]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      await api("/auth/setup", {
        method: "POST",
        body: JSON.stringify({
          clinicName: form.clinicName,
          clinicAddress: form.clinicAddress,

          doctor: {
            name: form.doctorName,
            username: form.doctorUsername,
            password: form.doctorPassword,
            role: "doctor",
          },

          staff: {
            name: form.staffName,
            username: form.staffUsername,
            password: form.staffPassword,
            role: "staff",
          },
        }),
      });

      navigate("/");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-rose-50 via-white to-teal-50 p-5">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
        <form
          onSubmit={submit}
          className="w-full rounded-3xl border border-pink-100 bg-white p-7 shadow-xl sm:p-10"
        >
          <div className="mb-8">
            <p className="text-sm font-semibold text-teal-700">
              FIRST-TIME SETUP
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-800">
              Set up your clinic accounts
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Create one doctor account with full access and one staff account
              with limited access.
            </p>
          </div>

          <section className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-pink-100 p-2 text-pink-600">
                <Building2 size={20} />
              </span>

              <div>
                <h2 className="font-bold text-slate-800">
                  Clinic information
                </h2>
                <p className="text-sm text-slate-500">
                  General information shown on printed documents.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                label="Clinic name"
                icon={Building2}
                value={form.clinicName}
                onChange={update("clinicName")}
                placeholder="Perdido OB-GYN Clinic"
              />

              <Field
                label="Clinic address"
                icon={MapPin}
                value={form.clinicAddress}
                onChange={update("clinicAddress")}
                placeholder="Complete clinic address"
              />
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-pink-200 bg-pink-50/40 p-5">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-pink-100 p-2 text-pink-600">
                  <Stethoscope size={20} />
                </span>

                <div>
                  <h2 className="font-bold text-slate-800">Doctor account</h2>
                  <p className="text-sm text-slate-500">
                    Has full access to all system functions.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <Field
                  label="Doctor's name"
                  icon={Stethoscope}
                  value={form.doctorName}
                  onChange={update("doctorName")}
                  placeholder="Dr. Maria Santos"
                />

                <Field
                  label="Doctor username"
                  icon={UserRoundPlus}
                  value={form.doctorUsername}
                  onChange={update("doctorUsername")}
                  placeholder="doctor"
                />

                <PasswordField
                  label="Doctor password"
                  value={form.doctorPassword}
                  onChange={update("doctorPassword")}
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="mt-5 rounded-xl bg-white p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">Full access</p>
                <p className="mt-1">
                  Dashboard, patients, appointments, consultations,
                  prescriptions, laboratory requests, cashiering, reports,
                  settings, backup, and user management.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-teal-100 p-2 text-teal-700">
                  <Users size={20} />
                </span>

                <div>
                  <h2 className="font-bold text-slate-800">Staff account</h2>
                  <p className="text-sm text-slate-500">
                    Has access only to permitted administrative functions.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <Field
                  label="Staff name"
                  icon={Users}
                  value={form.staffName}
                  onChange={update("staffName")}
                  placeholder="Staff full name"
                />

                <Field
                  label="Staff username"
                  icon={UserRoundPlus}
                  value={form.staffUsername}
                  onChange={update("staffUsername")}
                  placeholder="staff"
                />

                <PasswordField
                  label="Staff password"
                  value={form.staffPassword}
                  onChange={update("staffPassword")}
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="mt-5 rounded-xl bg-white p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">Limited access</p>
                <p className="mt-1">
                  Patient registration, appointment scheduling, cashiering,
                  and selected reports.
                </p>
              </div>
            </section>
          </div>

          {message && (
            <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 py-3 font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              "Saving clinic accounts..."
            ) : (
              <>
                Finish setup
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
}) {
  return (
    <label className="block text-sm font-semibold text-slate-600">
      {label}

      <span className="relative mt-1.5 block">
        <Icon
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-500"
        />

        <input
          required
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
        />
      </span>
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}) {
  return (
    <label className="block text-sm font-semibold text-slate-600">
      {label}

      <span className="relative mt-1.5 block">
        <Lock
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-500"
        />

        <input
          required
          minLength={8}
          type="password"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
        />
      </span>
    </label>
  );
}