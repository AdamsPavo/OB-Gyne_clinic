import { Link } from "react-router-dom";
import { ArchiveRestore, CalendarDays, CreditCard, FileBarChart, FileHeart, House, Pill, Stethoscope, Users } from "lucide-react";
import Logo from "../assets/OBLOGO.png";

const menuItems = [
  { name: "Dashboard", icon: House, path: "/dashboard" }, { name: "Patients", icon: Users, path: "/patients" }, { name: "Appointments", icon: CalendarDays, path: "/appointments" }, { name: "Consultations", icon: Stethoscope, path: "/consultations" }, { name: "Prenatal Records", icon: FileHeart, path: "/prenatal-records" }, { name: "Prescriptions", icon: Pill, path: "/prescriptions" }, { name: "Billing", icon: CreditCard, path: "/billing" }, { name: "Reports", icon: FileBarChart, path: "/reports" }, { name: "Backup / Restore", icon: ArchiveRestore, path: "/backup-restore" },
];

function Sidebar({ activeItem = "Dashboard" }) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const doctorName = user.fullname ? (user.fullname.startsWith("Dr.") ? user.fullname : `Dr. ${user.fullname}`) : "Doctor";
  const initials = doctorName.replace("Dr. ", "").split(" ").map((name) => name[0]).slice(0, 2).join("").toUpperCase();
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); window.location.href = "/"; };
  return <aside className="hidden h-screen w-72 shrink-0 flex-col border-r border-pink-100 bg-white shadow-xl lg:flex"><div className="bg-gradient-to-br from-pink-500 to-rose-400 px-6 py-6 text-white"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white"><img src={Logo} alt="OB-GYN Clinic" className="h-10 w-10" /></div><div><h1 className="text-xl font-bold">OB-GYN Clinic</h1><p className="text-sm text-pink-100">Management System</p></div></div></div><nav className="flex-1 space-y-2 px-4 py-6"><p className="mb-3 px-3 text-xs font-semibold uppercase text-gray-400">Main Menu</p>{menuItems.map((item) => { const isActive = item.name === activeItem; const Icon = item.icon; return <Link to={item.path} key={item.name} className={`group relative flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left transition-all duration-300 ${isActive ? "bg-pink-100 text-pink-600 shadow-sm" : "text-gray-600 hover:bg-pink-50 hover:text-pink-600"}`}><span className={`absolute left-0 h-8 w-1 rounded-r-full bg-pink-500 ${isActive ? "" : "hidden"}`} /><span className={`flex h-9 min-w-9 items-center justify-center rounded-lg transition ${isActive ? "bg-pink-200" : "bg-gray-100 group-hover:bg-pink-100"}`}><Icon size={18} strokeWidth={2.2} /></span><span className="font-medium">{item.name}</span></Link>; })}</nav><div className="border-t border-gray-100 p-4"><div className="flex items-center gap-3 rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 p-4"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500 font-bold text-white shadow-md">{initials}</div><div className="flex-1"><h3 className="text-sm font-bold text-gray-800">{doctorName}</h3><p className="text-xs text-gray-500">OB-GYN Specialist</p></div><span className="h-2.5 w-2.5 rounded-full bg-green-500" /></div><button onClick={logout} className="mt-3 w-full rounded-xl bg-red-50 py-3 font-medium text-red-500 transition hover:bg-red-100">Logout</button></div></aside>;
}

export default Sidebar;
