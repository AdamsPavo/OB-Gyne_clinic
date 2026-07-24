import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  PhilippinePeso,
  Printer,
  RefreshCw,
  Stethoscope,
  TrendingUp,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Sidebar from "../components/Sidebar";
import { api } from "../api/client";

const COLORS = [
  "#0f766e",
  "#db2777",
  "#f59e0b",
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#ea580c",
  "#0891b2",
  "#be123c",
  "#4f46e5",
];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const formatShortCurrency = (value) => {
  const amount = Number(value || 0);

  if (amount >= 1_000_000) {
    return `₱${(amount / 1_000_000).toFixed(1)}M`;
  }

  if (amount >= 1_000) {
    return `₱${(amount / 1_000).toFixed(1)}K`;
  }

  return `₱${amount.toFixed(0)}`;
};

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

const formatChartDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
};

const formatMonth = (value) => {
  if (!value) {
    return "—";
  }

  const [year, month] = String(value).split("-");

  const date = new Date(
    Number(year),
    Number(month) - 1,
    1,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-PH", {
    month: "short",
    year: "numeric",
  });
};

export default function Reports() {
  const [data, setData] = useState({
    cases: [],
    income: [],
    diagnoses: [],
  });

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api("/reports/summary");

      setData({
        cases: Array.isArray(response?.cases)
          ? response.cases
          : [],
        income: Array.isArray(response?.income)
          ? response.income
          : [],
        diagnoses: Array.isArray(
          response?.diagnoses,
        )
          ? response.diagnoses
          : [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const consultationData = useMemo(() => {
    return data.cases
      .filter((item) => {
        const date = String(item.date || "");

        const matchesFrom =
          !dateFrom || date >= dateFrom;

        const matchesTo =
          !dateTo || date <= dateTo;

        return matchesFrom && matchesTo;
      })
      .map((item) => ({
        ...item,
        consultations: Number(
          item.consultations || 0,
        ),
        displayDate: formatChartDate(
          item.date,
        ),
      }))
      .sort(
        (a, b) =>
          new Date(a.date) - new Date(b.date),
      );
  }, [data.cases, dateFrom, dateTo]);

  const incomeData = useMemo(() => {
    const fromMonth = dateFrom
      ? dateFrom.slice(0, 7)
      : "";

    const toMonth = dateTo
      ? dateTo.slice(0, 7)
      : "";

    return data.income
      .filter((item) => {
        const month = String(
          item.month || "",
        );

        const matchesFrom =
          !fromMonth || month >= fromMonth;

        const matchesTo =
          !toMonth || month <= toMonth;

        return matchesFrom && matchesTo;
      })
      .map((item) => ({
        ...item,
        income: Number(item.income || 0),
        displayMonth: formatMonth(
          item.month,
        ),
      }))
      .sort((a, b) =>
        String(a.month).localeCompare(
          String(b.month),
        ),
      );
  }, [data.income, dateFrom, dateTo]);

  const diagnosisData = useMemo(() => {
    return data.diagnoses
      .map((item) => ({
        name:
          item.diagnosis_name ||
          "Unknown diagnosis",
        value: Number(item.count || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data.diagnoses]);

  const totals = useMemo(() => {
    const consultations =
      consultationData.reduce(
        (total, item) =>
          total + item.consultations,
        0,
      );

    const income = incomeData.reduce(
      (total, item) =>
        total + item.income,
      0,
    );

    const diagnosisCases =
      diagnosisData.reduce(
        (total, item) =>
          total + item.value,
        0,
      );

    return {
      consultations,
      income,
      diagnosisCases,
      diagnosisTypes:
        diagnosisData.length,
    };
  }, [
    consultationData,
    incomeData,
    diagnosisData,
  ]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeItem="Reports" />

      <div className="min-w-0 flex-1">
        <header className="m-4 rounded-3xl bg-linear-to-r from-teal-700 to-teal-500 p-6 text-white shadow-lg shadow-teal-200/50 sm:m-6 sm:p-8 print:m-0 print:rounded-none">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <BarChart3 size={26} />
              </div>

              <div>
                <h1 className="text-3xl font-bold sm:text-4xl">
                  Clinic Reports
                </h1>

                <p className="mt-2 text-teal-100">
                  Visual summaries of
                  consultations, income, and
                  common diagnoses.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row print:hidden">
              <button
                type="button"
                onClick={loadReports}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 py-3 font-semibold ring-1 ring-white/30 transition hover:bg-white/25 disabled:opacity-60"
              >
                <RefreshCw
                  size={18}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-teal-700 transition hover:bg-teal-50"
              >
                <Printer size={18} />
                Print
              </button>
            </div>
          </div>
        </header>

        <main className="space-y-6 px-4 pb-10 sm:px-6">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="rounded-3xl bg-white p-5 shadow-sm print:hidden sm:p-6">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">
                  <CalendarDays size={22} />
                </div>

                <div>
                  <h2 className="font-bold text-slate-900">
                    Report period
                  </h2>

                  <p className="text-sm text-slate-500">
                    Filter consultations and
                    income by date.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className="mb-2 block text-xs font-bold uppercase text-slate-400">
                    From
                  </span>

                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) =>
                      setDateFrom(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-xs font-bold uppercase text-slate-400">
                    To
                  </span>

                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) =>
                      setDateTo(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  />
                </label>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="self-end rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Clear filters
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Consultations"
              value={totals.consultations}
              description="Recorded consultations"
              icon={Stethoscope}
              iconClass="bg-teal-100 text-teal-700"
            />

            <SummaryCard
              title="Clinic income"
              value={formatCurrency(
                totals.income,
              )}
              description="Collected payments"
              icon={PhilippinePeso}
              iconClass="bg-emerald-100 text-emerald-700"
            />

            <SummaryCard
              title="Diagnosis cases"
              value={totals.diagnosisCases}
              description="Diagnosis occurrences"
              icon={Activity}
              iconClass="bg-orange-100 text-orange-700"
            />

            <SummaryCard
              title="Diagnosis types"
              value={totals.diagnosisTypes}
              description="Different diagnoses"
              icon={TrendingUp}
              iconClass="bg-blue-100 text-blue-700"
            />
          </section>

          {loading ? (
            <section className="rounded-3xl bg-white p-14 text-center shadow-sm">
              <RefreshCw className="mx-auto mb-3 animate-spin text-teal-600" />

              <p className="text-sm text-slate-500">
                Loading report charts...
              </p>
            </section>
          ) : (
            <>
              <section className="grid gap-6 xl:grid-cols-2">
                <ChartCard
                  title="Consultations by day"
                  description="Daily consultation activity"
                  icon={Stethoscope}
                >
                  {consultationData.length ? (
                    <ResponsiveContainer
                      width="100%"
                      height={320}
                    >
                      <LineChart
                        data={consultationData}
                        margin={{
                          top: 10,
                          right: 20,
                          left: -15,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />

                        <XAxis
                          dataKey="displayDate"
                          tick={{
                            fill: "#64748b",
                            fontSize: 12,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          allowDecimals={false}
                          tick={{
                            fill: "#64748b",
                            fontSize: 12,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip
                          formatter={(value) => [
                            `${value} consultation${
                              Number(value) === 1
                                ? ""
                                : "s"
                            }`,
                            "Consultations",
                          ]}
                          labelFormatter={(
                            label,
                            payload,
                          ) =>
                            payload?.[0]
                              ?.payload?.date
                              ? formatDate(
                                  payload[0]
                                    .payload
                                    .date,
                                )
                              : label
                          }
                        />

                        <Legend />

                        <Line
                          type="monotone"
                          dataKey="consultations"
                          name="Consultations"
                          stroke="#0f766e"
                          strokeWidth={3}
                          dot={{
                            r: 4,
                            fill: "#0f766e",
                          }}
                          activeDot={{
                            r: 7,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </ChartCard>

                <ChartCard
                  title="Income by month"
                  description="Monthly collected clinic income"
                  icon={PhilippinePeso}
                >
                  {incomeData.length ? (
                    <ResponsiveContainer
                      width="100%"
                      height={320}
                    >
                      <BarChart
                        data={incomeData}
                        margin={{
                          top: 10,
                          right: 20,
                          left: 5,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />

                        <XAxis
                          dataKey="displayMonth"
                          tick={{
                            fill: "#64748b",
                            fontSize: 12,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          tickFormatter={
                            formatShortCurrency
                          }
                          tick={{
                            fill: "#64748b",
                            fontSize: 12,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip
                          formatter={(value) => [
                            formatCurrency(value),
                            "Income",
                          ]}
                        />

                        <Legend />

                        <Bar
                          dataKey="income"
                          name="Clinic income"
                          fill="#059669"
                          radius={[8, 8, 0, 0]}
                          maxBarSize={65}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </ChartCard>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                <ChartCard
                  title="Most common diagnoses"
                  description="Top diagnoses by number of cases"
                  icon={Activity}
                >
                  {diagnosisData.length ? (
                    <ResponsiveContainer
                      width="100%"
                      height={380}
                    >
                      <BarChart
                        data={diagnosisData}
                        layout="vertical"
                        margin={{
                          top: 10,
                          right: 25,
                          left: 30,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="#e2e8f0"
                        />

                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={{
                            fill: "#64748b",
                            fontSize: 12,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          type="category"
                          dataKey="name"
                          width={135}
                          tick={{
                            fill: "#475569",
                            fontSize: 12,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip
                          formatter={(value) => [
                            `${value} case${
                              Number(value) === 1
                                ? ""
                                : "s"
                            }`,
                            "Cases",
                          ]}
                        />

                        <Bar
                          dataKey="value"
                          name="Cases"
                          fill="#f97316"
                          radius={[0, 8, 8, 0]}
                          maxBarSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </ChartCard>

                <ChartCard
                  title="Diagnosis distribution"
                  description="Share of the most common diagnoses"
                  icon={BarChart3}
                >
                  {diagnosisData.length ? (
                    <ResponsiveContainer
                      width="100%"
                      height={380}
                    >
                      <PieChart>
                        <Pie
                          data={diagnosisData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="45%"
                          innerRadius={65}
                          outerRadius={115}
                          paddingAngle={3}
                        >
                          {diagnosisData.map(
                            (item, index) => (
                              <Cell
                                key={item.name}
                                fill={
                                  COLORS[
                                    index %
                                      COLORS.length
                                  ]
                                }
                              />
                            ),
                          )}
                        </Pie>

                        <Tooltip
                          formatter={(
                            value,
                            name,
                          ) => [
                            `${value} case${
                              Number(value) === 1
                                ? ""
                                : "s"
                            }`,
                            name,
                          ]}
                        />

                        <Legend
                          verticalAlign="bottom"
                          height={70}
                          formatter={(value) => (
                            <span className="text-xs text-slate-600">
                              {value}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </ChartCard>
              </section>

              <section className="grid gap-6 xl:grid-cols-3">
                <DataTable
                  title="Consultations"
                  columns={[
                    "Date",
                    "Total",
                  ]}
                  rows={consultationData}
                  renderRow={(item) => (
                    <tr
                      key={item.date}
                      className="border-b border-slate-100"
                    >
                      <td className="p-3 text-sm text-slate-700">
                        {formatDate(item.date)}
                      </td>

                      <td className="p-3 text-right font-bold text-teal-700">
                        {item.consultations}
                      </td>
                    </tr>
                  )}
                />

                <DataTable
                  title="Monthly income"
                  columns={[
                    "Month",
                    "Income",
                  ]}
                  rows={incomeData}
                  renderRow={(item) => (
                    <tr
                      key={item.month}
                      className="border-b border-slate-100"
                    >
                      <td className="p-3 text-sm text-slate-700">
                        {item.displayMonth}
                      </td>

                      <td className="p-3 text-right font-bold text-emerald-700">
                        {formatCurrency(
                          item.income,
                        )}
                      </td>
                    </tr>
                  )}
                />

                <DataTable
                  title="Diagnoses"
                  columns={[
                    "Diagnosis",
                    "Cases",
                  ]}
                  rows={diagnosisData}
                  renderRow={(item) => (
                    <tr
                      key={item.name}
                      className="border-b border-slate-100"
                    >
                      <td className="p-3 text-sm text-slate-700">
                        {item.name}
                      </td>

                      <td className="p-3 text-right font-bold text-orange-700">
                        {item.value}
                      </td>
                    </tr>
                  )}
                />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
}) {
  return (
    <article className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 truncate text-2xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}
        >
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

function ChartCard({
  title,
  description,
  icon: Icon,
  children,
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <Icon size={21} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {title}
          </h2>

          <p className="text-sm text-slate-500">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-72 items-center justify-center rounded-2xl bg-slate-50">
      <div className="text-center">
        <BarChart3 className="mx-auto mb-3 text-slate-300" />

        <p className="font-semibold text-slate-600">
          No chart data available
        </p>

        <p className="mt-1 text-sm text-slate-400">
          Records will appear here once
          available.
        </p>
      </div>
    </div>
  );
}

function DataTable({
  title,
  columns,
  rows,
  renderRow,
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">
        {title}
      </h2>

      <div className="mt-4 max-h-80 overflow-auto">
        <table className="w-full min-w-80 text-left">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
              {columns.map(
                (column, index) => (
                  <th
                    key={column}
                    className={`p-3 ${
                      index ===
                      columns.length - 1
                        ? "text-right"
                        : ""
                    }`}
                  >
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map(renderRow)
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="p-8 text-center text-sm text-slate-500"
                >
                  No data recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}