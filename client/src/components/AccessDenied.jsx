import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { canOpen, modules } from "../auth";
export default function AccessDenied() {
  const first = modules.find(module => canOpen(module.path));
  return <section role="alert" className="m-6 rounded-3xl border border-pink-200 bg-pink-50 p-8 text-center"><ShieldAlert className="mx-auto text-pink-600" size={40} /><h1 className="mt-4 text-2xl font-bold text-slate-900">Access restricted</h1><p className="mt-3 text-slate-700">You do not have permission to access this page.</p><p className="mt-2 text-sm text-slate-500">Contact your Admin to request access.</p>{first && <Link to={first.path} className="mt-6 inline-flex rounded-xl bg-pink-600 px-5 py-3 font-semibold text-white">Open {first.label}</Link>}</section>;
}
