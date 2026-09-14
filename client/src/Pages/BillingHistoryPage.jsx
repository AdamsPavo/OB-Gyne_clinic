import { useEffect, useState } from "react";
import { api } from "../api/client";
import BillingHistory from "../components/BillingHistory";
export default function BillingHistoryPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api("/billing-history").then(setRows).catch(error => setError(error.message)); }, []);
  return <div className="p-4 sm:p-6"><header className="mb-6 rounded-3xl bg-linear-to-r from-pink-700 to-rose-500 p-6 text-white"><h1 className="text-3xl font-bold">Billing History</h1><p className="mt-2 text-pink-100">Review paid invoices and statements of account.</p></header>{error && <p role="alert" className="mb-4 text-red-600">{error}</p>}<BillingHistory rows={rows} /></div>;
}
