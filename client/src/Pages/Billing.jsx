import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Edit3,
  PhilippinePeso,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import { api } from "../api/client";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getStatus = (invoice) => {
  const total = Number(invoice.total_amount || 0);
  const paid = Number(invoice.paid_amount || 0);

  if (total > 0 && paid >= total) {
    return "Paid";
  }

  if (paid > 0) {
    return "Partial";
  }

  return invoice.payment_status || "Pending";
};

const getStatusStyle = (status) => {
  switch (status) {
    case "Paid":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";

    case "Partial":
      return "bg-amber-50 text-amber-700 ring-amber-200";

    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
};

export default function Billing() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");

  const [selectedInvoice, setSelectedInvoice] =
    useState(null);

  const [showCashier, setShowCashier] =
    useState(false);

  const [totalAmount, setTotalAmount] =
    useState("");

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("Cash");

  const [cashReceived, setCashReceived] =
    useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const loadBillings = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await api("/billings");

      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillings();
  }, []);

  const summary = useMemo(() => {
    return rows.reduce(
      (totals, invoice) => {
        const total = Number(
          invoice.total_amount || 0,
        );

        const paid = Number(
          invoice.paid_amount || 0,
        );

        const balance = Math.max(
          total - paid,
          0,
        );

        totals.totalBilled += total;
        totals.totalCollected += paid;
        totals.outstanding += balance;

        if (getStatus(invoice) === "Paid") {
          totals.paidInvoices += 1;
        }

        return totals;
      },
      {
        totalBilled: 0,
        totalCollected: 0,
        outstanding: 0,
        paidInvoices: 0,
      },
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    return rows.filter((invoice) => {
      const status = getStatus(invoice);

      const matchesStatus =
        statusFilter === "All" ||
        status === statusFilter;

      const searchableText = [
        invoice.invoice_number,
        invoice.case_number,
        invoice.patient_name,
        invoice.payment_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !keyword ||
        searchableText.includes(keyword);

      return matchesStatus && matchesSearch;
    });
  }, [rows, search, statusFilter]);

  const openCashier = (invoice) => {
    const total = Number(
      invoice.total_amount || 0,
    );

    const paid = Number(
      invoice.paid_amount || 0,
    );

    const balance = Math.max(
      total - paid,
      0,
    );

    setSelectedInvoice(invoice);
    setTotalAmount(
      total > 0 ? String(total) : "",
    );

    setPaymentAmount(
      balance > 0 ? String(balance) : "",
    );

    setPaymentMethod("Cash");
    setCashReceived("");
    setError("");
    setMessage("");
    setShowCashier(true);
  };

  const closeCashier = () => {
    if (submitting) {
      return;
    }

    setShowCashier(false);
    setSelectedInvoice(null);
    setTotalAmount("");
    setPaymentAmount("");
    setCashReceived("");
    setMessage("");
  };

  const currentPaid = Number(
    selectedInvoice?.paid_amount || 0,
  );

  const enteredTotal = Number(
    totalAmount || 0,
  );

  const enteredPayment = Number(
    paymentAmount || 0,
  );

  const currentBalance = Math.max(
    enteredTotal - currentPaid,
    0,
  );

  const newBalance = Math.max(
    currentBalance - enteredPayment,
    0,
  );

  const change =
    paymentMethod === "Cash"
      ? Math.max(
          Number(cashReceived || 0) -
            enteredPayment,
          0,
        )
      : 0;

  const updateLocalInvoice = (
    invoiceId,
    updates,
  ) => {
    setRows((previous) =>
      previous.map((invoice) =>
        Number(invoice.id) ===
        Number(invoiceId)
          ? {
              ...invoice,
              ...updates,
            }
          : invoice,
      ),
    );
  };

  const saveBillOnly = async () => {
    if (!selectedInvoice) {
      return;
    }

    if (
      !Number.isFinite(enteredTotal) ||
      enteredTotal <= 0
    ) {
      setError(
        "Please enter a valid total bill.",
      );

      return;
    }

    if (enteredTotal < currentPaid) {
      setError(
        "The total bill cannot be lower than the amount already paid.",
      );

      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      await api(
        `/invoices/${selectedInvoice.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            total_amount: enteredTotal,
          }),
        },
      );

      const status =
        currentPaid >= enteredTotal
          ? "Paid"
          : currentPaid > 0
            ? "Partial"
            : "Pending";

      updateLocalInvoice(
        selectedInvoice.id,
        {
          total_amount: enteredTotal,
          payment_status: status,
        },
      );

      setSelectedInvoice((previous) => ({
        ...previous,
        total_amount: enteredTotal,
        payment_status: status,
      }));

      setMessage(
        "Billing amount saved successfully.",
      );

      await loadBillings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const collectPayment = async () => {
    if (!selectedInvoice) {
      return;
    }

    if (!selectedInvoice.case_number) {
      setError(
        "This is a legacy billing record and is not linked to a consultation case.",
      );

      return;
    }

    if (
      !Number.isFinite(enteredTotal) ||
      enteredTotal <= 0
    ) {
      setError(
        "Set the total bill before collecting payment.",
      );

      return;
    }

    if (enteredTotal < currentPaid) {
      setError(
        "The total bill cannot be lower than the amount already paid.",
      );

      return;
    }

    if (
      !Number.isFinite(enteredPayment) ||
      enteredPayment <= 0
    ) {
      setError(
        "Please enter a valid payment amount.",
      );

      return;
    }

    if (enteredPayment > currentBalance) {
      setError(
        `Payment cannot exceed the remaining balance of ${formatCurrency(
          currentBalance,
        )}.`,
      );

      return;
    }

    if (
      paymentMethod === "Cash" &&
      Number(cashReceived || 0) <
        enteredPayment
    ) {
      setError(
        "Cash received cannot be lower than the payment amount.",
      );

      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      await api(
        `/invoices/${selectedInvoice.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            total_amount: enteredTotal,
          }),
        },
      );

      await api(
        `/billings/${selectedInvoice.id}/payments`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: enteredPayment,
            payment_method: paymentMethod,
          }),
        },
      ).catch(async (firstError) => {
        /*
         * The existing backend payment route uses
         * the consultation case ID.
         */
        const caseId =
          selectedInvoice.consultation_case_id;

        if (!caseId) {
          throw firstError;
        }

        return api(
          `/billings/${caseId}/payments`,
          {
            method: "POST",
            body: JSON.stringify({
              amount: enteredPayment,
              payment_method:
                paymentMethod,
            }),
          },
        );
      });

      const updatedPaid =
        currentPaid + enteredPayment;

      const updatedStatus =
        updatedPaid >= enteredTotal
          ? "Paid"
          : "Partial";

      const completedTransaction = {
        ...selectedInvoice,
        total_amount: enteredTotal,
        paid_amount: updatedPaid,
        payment_status: updatedStatus,
        payment_amount: enteredPayment,
        payment_method: paymentMethod,
        cash_received:
          paymentMethod === "Cash"
            ? Number(cashReceived || 0)
            : enteredPayment,
        change,
        payment_date:
          new Date().toISOString(),
      };

      setSelectedInvoice(
        completedTransaction,
      );

      setMessage(
        `Payment of ${formatCurrency(
          enteredPayment,
        )} recorded successfully.`,
      );

      setPaymentAmount(
        updatedStatus === "Paid"
          ? ""
          : String(
              Math.max(
                enteredTotal -
                  updatedPaid,
                0,
              ),
            ),
      );

      setCashReceived("");

      await loadBillings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = () => {
    if (!selectedInvoice) {
      return;
    }

    const total = Number(
      selectedInvoice.total_amount ||
        enteredTotal ||
        0,
    );

    const paid = Number(
      selectedInvoice.paid_amount || 0,
    );

    const payment = Number(
      selectedInvoice.payment_amount || 0,
    );

    const remainingBalance = Math.max(
      total - paid,
      0,
    );

    const receiptWindow = window.open(
      "",
      "_blank",
      "width=760,height=900",
    );

    if (!receiptWindow) {
      setError(
        "The receipt window was blocked. Allow pop-ups and try again.",
      );

      return;
    }

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>
            Receipt ${
              selectedInvoice.invoice_number ||
              ""
            }
          </title>

          <style>
            @page {
              size: A4;
              margin: 14mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              color: #172033;
              font-family:
                Arial,
                sans-serif;
            }

            .receipt {
              width: 100%;
              max-width: 720px;
              margin: 0 auto;
              border: 1px solid #e2e8f0;
              border-radius: 18px;
              overflow: hidden;
            }

            .header {
              padding: 28px;
              color: white;
              background:
                linear-gradient(
                  120deg,
                  #db2777,
                  #fb7185
                );
            }

            .header h1 {
              margin: 0;
              font-size: 28px;
            }

            .header p {
              margin: 7px 0 0;
              opacity: 0.9;
            }

            .content {
              padding: 28px;
            }

            .details {
              display: grid;
              grid-template-columns:
                1fr 1fr;
              gap: 14px;
            }

            .item {
              padding: 13px;
              border-radius: 12px;
              background: #f8fafc;
            }

            .label {
              margin-bottom: 5px;
              color: #64748b;
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
            }

            .value {
              font-size: 15px;
              font-weight: 700;
            }

            .summary {
              margin-top: 24px;
              border-top:
                1px dashed #cbd5e1;
              padding-top: 18px;
            }

            .row {
              display: flex;
              justify-content:
                space-between;
              padding: 8px 0;
            }

            .total {
              margin-top: 8px;
              padding-top: 14px;
              border-top:
                2px solid #172033;
              font-size: 18px;
              font-weight: bold;
            }

            .footer {
              margin-top: 36px;
              text-align: center;
              color: #64748b;
              font-size: 12px;
            }

            @media print {
              .receipt {
                border: 0;
              }
            }
          </style>
        </head>

        <body>
          <div class="receipt">
            <div class="header">
              <h1>Official Payment Receipt</h1>
              <p>OB-GYN Clinic Billing and Cashier</p>
            </div>

            <div class="content">
              <div class="details">
                <div class="item">
                  <div class="label">
                    Invoice number
                  </div>

                  <div class="value">
                    ${
                      selectedInvoice.invoice_number ||
                      "—"
                    }
                  </div>
                </div>

                <div class="item">
                  <div class="label">
                    Payment date
                  </div>

                  <div class="value">
                    ${formatDate(
                      selectedInvoice.payment_date ||
                        new Date(),
                    )}
                  </div>
                </div>

                <div class="item">
                  <div class="label">
                    Patient
                  </div>

                  <div class="value">
                    ${
                      selectedInvoice.patient_name ||
                      "—"
                    }
                  </div>
                </div>

                <div class="item">
                  <div class="label">
                    Consultation case
                  </div>

                  <div class="value">
                    ${
                      selectedInvoice.case_number ||
                      "Legacy record"
                    }
                  </div>
                </div>
              </div>

              <div class="summary">
                <div class="row">
                  <span>Total bill</span>
                  <strong>
                    ${formatCurrency(total)}
                  </strong>
                </div>

                <div class="row">
                  <span>
                    Current payment
                  </span>

                  <strong>
                    ${formatCurrency(payment)}
                  </strong>
                </div>

                <div class="row">
                  <span>Payment method</span>

                  <strong>
                    ${
                      selectedInvoice.payment_method ||
                      paymentMethod
                    }
                  </strong>
                </div>

                ${
                  selectedInvoice.payment_method ===
                    "Cash" ||
                  paymentMethod === "Cash"
                    ? `
                      <div class="row">
                        <span>Cash received</span>

                        <strong>
                          ${formatCurrency(
                            selectedInvoice.cash_received ||
                              0,
                          )}
                        </strong>
                      </div>

                      <div class="row">
                        <span>Change</span>

                        <strong>
                          ${formatCurrency(
                            selectedInvoice.change ||
                              0,
                          )}
                        </strong>
                      </div>
                    `
                    : ""
                }

                <div class="row">
                  <span>Total amount paid</span>

                  <strong>
                    ${formatCurrency(paid)}
                  </strong>
                </div>

                <div class="row total">
                  <span>Remaining balance</span>

                  <span>
                    ${formatCurrency(
                      remainingBalance,
                    )}
                  </span>
                </div>
              </div>

              <div class="footer">
                Thank you. Please keep this
                receipt for your records.
              </div>
            </div>
          </div>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    receiptWindow.document.close();
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeItem="Billing" />

      <div className="min-w-0 flex-1">
        <header className="m-4 rounded-3xl bg-linear-to-r from-pink-600 to-rose-400 p-6 text-white shadow-lg shadow-pink-200/50 sm:m-6 sm:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                <WalletCards size={25} />
              </div>

              <h1 className="text-3xl font-bold sm:text-4xl">
                Billing and Cashier
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-pink-100 sm:text-base">
                Manage consultation charges,
                collect payments, monitor
                outstanding balances, and print
                receipts.
              </p>
            </div>

            <button
              type="button"
              onClick={loadBillings}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-pink-600 shadow-sm transition hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={18}
                className={
                  loading ? "animate-spin" : ""
                }
              />

              Refresh records
            </button>
          </div>
        </header>

        <main className="space-y-6 px-4 pb-10 sm:px-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Total billed"
              value={formatCurrency(
                summary.totalBilled,
              )}
              description="Value of all invoices"
              icon={ReceiptText}
              iconClass="bg-pink-100 text-pink-600"
            />

            <SummaryCard
              title="Total collected"
              value={formatCurrency(
                summary.totalCollected,
              )}
              description="Payments received"
              icon={Banknote}
              iconClass="bg-emerald-100 text-emerald-600"
            />

            <SummaryCard
              title="Outstanding"
              value={formatCurrency(
                summary.outstanding,
              )}
              description="Remaining balance"
              icon={Clock3}
              iconClass="bg-amber-100 text-amber-600"
            />

            <SummaryCard
              title="Paid invoices"
              value={summary.paidInvoices}
              description={`${rows.length} total billing records`}
              icon={CheckCircle2}
              iconClass="bg-blue-100 text-blue-600"
            />
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
                  <CreditCard size={22} />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Cashier transactions
                  </h2>

                  <p className="text-sm text-slate-500">
                    {filteredRows.length} billing
                    record
                    {filteredRows.length === 1
                      ? ""
                      : "s"}{" "}
                    displayed
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search patient, case, or invoice"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-100 sm:w-80"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value,
                    )
                  }
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
                >
                  <option value="All">
                    All statuses
                  </option>

                  <option value="Pending">
                    Pending
                  </option>

                  <option value="Partial">
                    Partial
                  </option>

                  <option value="Paid">
                    Paid
                  </option>
                </select>
              </div>
            </div>

            {error && !showCashier && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-262.5 text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                    <th className="p-3">
                      Invoice
                    </th>

                    <th className="p-3">
                      Patient
                    </th>

                    <th className="p-3">
                      Case
                    </th>

                    <th className="p-3">
                      Date
                    </th>

                    <th className="p-3 text-right">
                      Total
                    </th>

                    <th className="p-3 text-right">
                      Paid
                    </th>

                    <th className="p-3 text-right">
                      Balance
                    </th>

                    <th className="p-3 text-center">
                      Status
                    </th>

                    <th className="p-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan="9"
                        className="p-10 text-center"
                      >
                        <RefreshCw className="mx-auto mb-3 animate-spin text-pink-500" />

                        <p className="text-sm text-slate-500">
                          Loading billing
                          records...
                        </p>
                      </td>
                    </tr>
                  ) : filteredRows.length ? (
                    filteredRows.map(
                      (invoice) => {
                        const total = Number(
                          invoice.total_amount ||
                            0,
                        );

                        const paid = Number(
                          invoice.paid_amount ||
                            0,
                        );

                        const balance =
                          Math.max(
                            total - paid,
                            0,
                          );

                        const status =
                          getStatus(invoice);

                        return (
                          <tr
                            key={invoice.id}
                            className="border-b border-slate-100 transition hover:bg-pink-50/40"
                          >
                            <td className="p-3">
                              <p className="font-bold text-pink-600">
                                {invoice.invoice_number ||
                                  "—"}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                ID #{invoice.id}
                              </p>
                            </td>

                            <td className="p-3">
                              <p className="font-semibold text-slate-800">
                                {invoice.patient_name ||
                                  "Unknown patient"}
                              </p>
                            </td>

                            <td className="p-3 text-sm text-slate-600">
                              {invoice.case_number ||
                                "Legacy record"}
                            </td>

                            <td className="p-3 text-sm text-slate-600">
                              {formatDate(
                                invoice.invoice_date,
                              )}
                            </td>

                            <td className="p-3 text-right font-semibold text-slate-800">
                              {formatCurrency(
                                total,
                              )}
                            </td>

                            <td className="p-3 text-right font-semibold text-emerald-600">
                              {formatCurrency(
                                paid,
                              )}
                            </td>

                            <td className="p-3 text-right font-semibold text-amber-600">
                              {formatCurrency(
                                balance,
                              )}
                            </td>

                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${getStatusStyle(
                                  status,
                                )}`}
                              >
                                {status}
                              </span>
                            </td>

                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  openCashier(
                                    invoice,
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-700"
                              >
                                {status === "Paid" ? (
                                  <ReceiptText
                                    size={16}
                                  />
                                ) : (
                                  <PhilippinePeso
                                    size={16}
                                  />
                                )}

                                {status === "Paid"
                                  ? "View"
                                  : "Cashier"}
                              </button>
                            </td>
                          </tr>
                        );
                      },
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan="9"
                        className="p-12 text-center"
                      >
                        <ReceiptText className="mx-auto mb-3 text-slate-300" />

                        <p className="font-semibold text-slate-600">
                          No billing records
                          found
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          Try changing your
                          search or status filter.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {showCashier && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-pink-500">
                  Billing transaction
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {selectedInvoice.patient_name ||
                    "Patient billing"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeCashier}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={22} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-3">
                <DetailBox
                  label="Invoice"
                  value={
                    selectedInvoice.invoice_number ||
                    "—"
                  }
                />

                <DetailBox
                  label="Case"
                  value={
                    selectedInvoice.case_number ||
                    "Legacy record"
                  }
                />

                <DetailBox
                  label="Invoice date"
                  value={formatDate(
                    selectedInvoice.invoice_date,
                  )}
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {message}
                </div>
              )}

              <section className="rounded-3xl border border-slate-200 p-5">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-pink-50 p-2 text-pink-600">
                    <Edit3 size={19} />
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900">
                      Consultation charges
                    </h3>

                    <p className="text-sm text-slate-500">
                      Set the final amount that
                      the patient must pay.
                    </p>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Total bill
                  </span>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                      ₱
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={totalAmount}
                      onChange={(event) =>
                        setTotalAmount(
                          event.target.value,
                        )
                      }
                      disabled={
                        getStatus(
                          selectedInvoice,
                        ) === "Paid"
                      }
                      placeholder="0.00"
                      className="w-full rounded-2xl border border-slate-200 py-3 pl-9 pr-4 text-lg font-bold outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-100 disabled:bg-slate-100"
                    />
                  </div>
                </label>

                {getStatus(
                  selectedInvoice,
                ) !== "Paid" && (
                  <button
                    type="button"
                    onClick={saveBillOnly}
                    disabled={submitting}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-pink-200 bg-pink-50 px-5 py-3 text-sm font-bold text-pink-700 transition hover:bg-pink-100 disabled:opacity-60"
                  >
                    <Edit3 size={17} />

                    Save billing amount
                  </button>
                )}
              </section>

              <div className="grid gap-4 sm:grid-cols-3">
                <AmountBox
                  label="Total bill"
                  value={formatCurrency(
                    enteredTotal,
                  )}
                  className="bg-slate-50 text-slate-800"
                />

                <AmountBox
                  label="Already paid"
                  value={formatCurrency(
                    currentPaid,
                  )}
                  className="bg-emerald-50 text-emerald-700"
                />

                <AmountBox
                  label="Current balance"
                  value={formatCurrency(
                    currentBalance,
                  )}
                  className="bg-amber-50 text-amber-700"
                />
              </div>

              {currentBalance > 0 ? (
                <section className="rounded-3xl border border-slate-200 p-5">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                      <Banknote size={20} />
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900">
                        Collect payment
                      </h3>

                      <p className="text-sm text-slate-500">
                        Full and partial payments
                        are accepted.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Payment amount
                      </span>

                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                          ₱
                        </span>

                        <input
                          type="number"
                          min="0"
                          max={currentBalance}
                          step="0.01"
                          value={paymentAmount}
                          onChange={(event) =>
                            setPaymentAmount(
                              event.target
                                .value,
                            )
                          }
                          placeholder="0.00"
                          className="w-full rounded-2xl border border-slate-200 py-3 pl-9 pr-4 font-bold outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Payment method
                      </span>

                      <select
                        value={paymentMethod}
                        onChange={(event) =>
                          setPaymentMethod(
                            event.target.value,
                          )
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
                      >
                        <option value="Cash">
                          Cash
                        </option>

                        <option value="GCash">
                          GCash
                        </option>

                        <option value="Maya">
                          Maya
                        </option>

                        <option value="Bank Transfer">
                          Bank transfer
                        </option>

                        <option value="Card">
                          Debit/Credit card
                        </option>
                      </select>
                    </label>
                  </div>

                  {paymentMethod === "Cash" && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">
                          Cash received
                        </span>

                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                            ₱
                          </span>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              cashReceived
                            }
                            onChange={(
                              event,
                            ) =>
                              setCashReceived(
                                event.target
                                  .value,
                              )
                            }
                            placeholder="0.00"
                            className="w-full rounded-2xl border border-slate-200 py-3 pl-9 pr-4 font-bold outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
                          />
                        </div>
                      </label>

                      <AmountBox
                        label="Change"
                        value={formatCurrency(
                          change,
                        )}
                        className="bg-blue-50 text-blue-700"
                      />
                    </div>
                  )}

                  <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">
                        Balance after payment
                      </span>

                      <strong className="text-lg text-slate-900">
                        {formatCurrency(
                          newBalance,
                        )}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={collectPayment}
                    disabled={submitting}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-pink-200 transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <RefreshCw
                        size={19}
                        className="animate-spin"
                      />
                    ) : (
                      <PhilippinePeso
                        size={19}
                      />
                    )}

                    {submitting
                      ? "Processing payment..."
                      : "Confirm payment"}
                  </button>
                </section>
              ) : (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <CheckCircle2 className="mx-auto mb-3 text-emerald-600" />

                  <h3 className="text-lg font-bold text-emerald-800">
                    Account fully paid
                  </h3>

                  <p className="mt-1 text-sm text-emerald-700">
                    This invoice has no remaining
                    balance.
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCashier}
                  className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={printReceipt}
                  disabled={
                    !selectedInvoice.payment_amount
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Printer size={18} />

                  Print latest receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
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
    </div>
  );
}

function DetailBox({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 font-bold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function AmountBox({
  label,
  value,
  className,
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${className}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">
        {label}
      </p>

      <p className="mt-2 text-xl font-bold">
        {value}
      </p>
    </div>
  );
}