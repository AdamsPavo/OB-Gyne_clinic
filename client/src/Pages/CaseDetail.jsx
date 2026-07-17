import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BriefcaseMedical,
  Printer,
} from "lucide-react";
import {
  Link,
  useParams,
} from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";
import {
  printCase,
  printLaboratoryRequest,
  printPrescription,
} from "../utils/print";

const dash = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return value;
};

export default function CaseDetail() {
  const { id } = useParams();

  const [record, setRecord] =
    useState(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const loadCase = async () => {
      try {
        setError("");

        const data = await api(
          `/cases/${id}`,
        );

        setRecord(data);
      } catch (error) {
        setError(error.message);
      }
    };

    loadCase();
  }, [id]);

  if (!record) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar activeItem="Consultations" />

        <div className="flex flex-1 items-center justify-center p-8">
          <p
            className={
              error
                ? "text-red-600"
                : "text-slate-600"
            }
          >
            {error ||
              "Loading consultation case…"}
          </p>
        </div>
      </div>
    );
  }

  const patientName = [
    record.first_name,
    record.middle_name,
    record.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  const documentRecord = (item) => ({
    ...record,
    ...item,
    patient_name: patientName,
  });

  const diagnoses =
    record.diagnoses
      ?.map(
        (item) =>
          item.diagnosis_name,
      )
      .filter(Boolean)
      .join(", ") || "";

  const serviceType =
    record.service_type ||
    record.consultation_service ||
    record.appointment_service ||
    record.service ||
    "";

  const prescriptions =
    Array.isArray(record.prescriptions)
      ? record.prescriptions
      : [];

  const laboratoryRequests =
    Array.isArray(
      record.laboratory_requests,
    )
      ? record.laboratory_requests
      : [];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeItem="Consultations" />

      <div className="min-w-0 flex-1">
        <header className="m-4 rounded-3xl bg-linear-to-r from-teal-700 to-teal-500 p-6 text-white sm:m-6">
          <Link
            to={`/patients/${record.patient_id}`}
            className="inline-flex items-center gap-2 text-sm text-teal-100 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Patient record
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-teal-100">
                Consultation record
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                Consultation{" "}
                {record.case_number}
              </h1>

              <p className="mt-2 text-teal-100">
                {patientName} ·{" "}
                {record.consultation_date}
              </p>
            </div>

            {serviceType && (
              <div className="rounded-2xl border border-white/20 bg-white/15 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-100">
                  Type of Service
                </p>

                <p className="mt-1 flex items-center gap-2 font-bold text-white">
                  <BriefcaseMedical
                    size={17}
                  />

                  {serviceType}
                </p>
              </div>
            )}
          </div>
        </header>

        <main className="space-y-6 px-4 pb-8 sm:px-6">
          {error && (
            <p className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
              {error}
            </p>
          )}

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Consultation details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Case status:{" "}
                  <span className="font-semibold text-teal-700">
                    {record.case_status}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  printCase({
                    ...record,
                    service_type:
                      serviceType,
                    patient_name:
                      patientName,
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
              >
                <Printer size={17} />
                Print consultation
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Detail
                label="Type of Service"
                value={serviceType}
                highlighted
              />

              <Detail
                label="Consultation Date"
                value={
                  record.consultation_date
                }
              />

              <Detail
                label="Follow-up Date"
                value={
                  record.follow_up_date
                }
              />

              <Detail
                label="Chief Complaint"
                value={
                  record.chief_complaint
                }
              />

              <Detail
                label="History of Present Illness"
                value={
                  record.history_present_illness
                }
              />

              <Detail
                label="Diagnosis"
                value={diagnoses}
              />

              <Detail
                label="Treatment"
                value={record.treatment}
              />

              <Detail
                label="Doctor's Notes"
                value={
                  record.doctor_notes
                }
              />

              {record.appointment_id && (
                <Detail
                  label="Appointment Reference"
                  value={`Appointment #${record.appointment_id}`}
                />
              )}
            </div>

            <h3 className="mt-7 text-sm font-bold uppercase tracking-wide text-slate-500">
              Vital signs
            </h3>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Detail
                label="Blood Pressure"
                value={
                  record.blood_pressure
                }
              />

              <Detail
                label="Temperature"
                value={
                  record.temperature_c !==
                    null &&
                  record.temperature_c !==
                    undefined &&
                  record.temperature_c !==
                    ""
                    ? `${record.temperature_c} °C`
                    : ""
                }
              />

              <Detail
                label="Weight"
                value={
                  record.weight_kg !==
                    null &&
                  record.weight_kg !==
                    undefined &&
                  record.weight_kg !==
                    ""
                    ? `${record.weight_kg} kg`
                    : ""
                }
              />

              <Detail
                label="Height"
                value={
                  record.height_cm !==
                    null &&
                  record.height_cm !==
                    undefined &&
                  record.height_cm !==
                    ""
                    ? `${record.height_cm} cm`
                    : ""
                }
              />
            </div>
          </section>

          <Documents
            title="Medicine prescriptions"
            rows={prescriptions}
            number="prescription_number"
            itemName="medicine_name"
            empty="No prescriptions issued for this case."
            onPrint={(item) =>
              printPrescription(
                documentRecord(item),
              )
            }
          />

          <Documents
            title="Laboratory requests"
            rows={laboratoryRequests}
            number="request_number"
            itemName="test_name"
            empty="No laboratory requests issued for this case."
            onPrint={(item) =>
              printLaboratoryRequest(
                documentRecord(item),
              )
            }
          />
        </main>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  highlighted = false,
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlighted
          ? "border-teal-200 bg-teal-50"
          : "border-slate-100 bg-slate-50"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          highlighted
            ? "text-teal-600"
            : "text-slate-400"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-1 whitespace-pre-wrap text-sm ${
          highlighted
            ? "font-bold text-teal-800"
            : "text-slate-700"
        }`}
      >
        {dash(value)}
      </p>
    </div>
  );
}

function Documents({
  title,
  rows = [],
  number,
  itemName,
  empty,
  onPrint,
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-800">
        {title}
      </h2>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-170 text-left">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="p-3">
                Number
              </th>

              <th className="p-3">
                Date
              </th>

              <th className="p-3">
                Items
              </th>

              <th className="p-3 text-right">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100"
                >
                  <td className="p-3 font-semibold text-pink-600">
                    {dash(
                      item[number],
                    )}
                  </td>

                  <td className="p-3 text-sm text-slate-600">
                    {dash(
                      item.issued_date ||
                        item.requested_date,
                    )}
                  </td>

                  <td className="p-3 text-sm text-slate-600">
                    {item.items
                      ?.map(
                        (entry) =>
                          entry[
                            itemName
                          ],
                      )
                      .filter(Boolean)
                      .join(", ") ||
                      "—"}
                  </td>

                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        onPrint(item)
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                    >
                      <Printer
                        size={16}
                      />
                      Print
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="4"
                  className="p-8 text-center text-sm text-slate-500"
                >
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}