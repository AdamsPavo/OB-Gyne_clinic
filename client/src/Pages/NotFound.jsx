import { ArrowLeft, Home } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function NotFound(){
 const navigate=useNavigate();
 return <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 via-white to-pink-50 p-6"><section className="w-full max-w-lg rounded-3xl border border-white bg-white/90 p-8 text-center shadow-xl shadow-slate-200/60 backdrop-blur"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 text-2xl font-black text-pink-600">404</div><h1 className="mt-6 text-3xl font-bold text-slate-900">Page not found</h1><p className="mx-auto mt-3 max-w-sm text-slate-500">The page may have moved, or your account may not have access to it.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={()=>navigate(-1)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"><ArrowLeft size={18}/>Go back</button><Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-pink-700"><Home size={18}/>Dashboard</Link></div></section></main>;
}
