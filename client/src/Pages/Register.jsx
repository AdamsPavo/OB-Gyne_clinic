import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowRight, Lock, ShieldCheck, User, UserRoundPlus } from "lucide-react";
import OBlogo from "../assets/OBLOGO.png";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullname: "", username: "", password: "", role: "admin" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const register = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await axios.post("http://localhost:5000/api/auth/register", form);
      setMessage("Account created. You can now sign in.");
      setTimeout(() => navigate("/"), 900);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to create account.");
    } finally { setLoading(false); }
  };

  return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fff7fa] via-white to-[#ffe6ef] p-6"><div className="w-full max-w-md rounded-[40px] border border-white/50 bg-gradient-to-br from-pink-500/90 via-rose-400/90 to-pink-300/90 p-8 shadow-[0_25px_70px_rgba(236,72,153,.35)] sm:p-10"><div className="mb-7 flex justify-center"><div className="rounded-full bg-white p-4 shadow-xl"><img src={OBlogo} alt="OB-GYN Clinic" className="h-20 w-20 object-contain" /></div></div><div className="text-center"><h1 className="text-3xl font-bold text-slate-800">Create Clinic Account</h1><p className="mt-2 text-sm text-slate-600">Set up the first clinic administrator account.</p></div><form onSubmit={register} className="mt-7 space-y-4"><label className="block text-sm font-semibold text-slate-700">Full name<div className="relative mt-1.5"><User className="absolute left-4 top-3 text-pink-500" size={19} /><input required value={form.fullname} onChange={(event) => setForm({ ...form, fullname: event.target.value })} className="w-full rounded-2xl border border-pink-100 py-3 pl-11 pr-4" placeholder="Dr. Maria Santos" /></div></label><label className="block text-sm font-semibold text-slate-700">Username<div className="relative mt-1.5"><UserRoundPlus className="absolute left-4 top-3 text-pink-500" size={19} /><input required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="w-full rounded-2xl border border-pink-100 py-3 pl-11 pr-4" placeholder="Choose a username" /></div></label><label className="block text-sm font-semibold text-slate-700">Password<div className="relative mt-1.5"><Lock className="absolute left-4 top-3 text-pink-500" size={19} /><input required minLength="8" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="w-full rounded-2xl border border-pink-100 py-3 pl-11 pr-4" placeholder="At least 8 characters" /></div></label><label className="block text-sm font-semibold text-slate-700">First account role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-1.5 w-full rounded-2xl border border-pink-100 bg-white px-4 py-3"><option value="admin">Administrator</option><option value="doctor">Doctor</option><option value="staff">Staff</option></select></label>{message && <p className={`rounded-xl px-3 py-2 text-sm ${message.startsWith("Account") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{message}</p>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 py-3.5 font-semibold text-white disabled:opacity-60">{loading ? "Creating account..." : <>Create Account <ArrowRight size={18} /></>}</button></form><p className="mt-6 text-center text-sm text-slate-600">Already have an account? <Link to="/" className="font-semibold text-pink-700">Sign in</Link></p><div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-600"><ShieldCheck size={16} /> Secure clinic access</div></div></div>;
}
