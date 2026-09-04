import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "./Workspace";
import { CalendarDays, ClipboardPlus, CreditCard, DatabaseBackup, FileBarChart, HeartPulse, LayoutDashboard, LogOut, Menu, Package, Pill, ReceiptText, Settings2, UserCog, Users, X } from "lucide-react";
import Logo from "../assets/OBLOGO.png";

const menuItems=[
 {name:"Dashboard",icon:<LayoutDashboard size={19}/>,path:"/dashboard"},
 {name:"Patients",icon:<Users size={19}/>,path:"/patients"},
 {name:"Appointments",icon:<CalendarDays size={19}/>,path:"/appointments"},
 {name:"Consultations",icon:<ClipboardPlus size={19}/>,path:"/consultations",roles:["admin","doctor"]},
 {name:"Prenatal Records",icon:<HeartPulse size={19}/>,path:"/prenatal-records",roles:["admin","doctor"]},
 {name:"Prescriptions",icon:<Pill size={19}/>,path:"/prescriptions",roles:["admin","doctor"]},
 {name:"Billing",icon:<CreditCard size={19}/>,path:"/billing"},
 {name:"Reports",icon:<FileBarChart size={19}/>,path:"/reports"},
 {name:"Backup / Restore",icon:<DatabaseBackup size={19}/>,path:"/backup-restore",roles:["admin","doctor"]},
 {name:"Tools",icon:<Settings2 size={19}/>,path:"/tools",roles:["admin","doctor"]},
 {name:"Inventory",icon:<Package size={19}/>,path:"/inventory"},
 {name:"Patient Charges",icon:<ReceiptText size={19}/>,path:"/patient-charges"},
 {name:"User Management",icon:<UserCog size={19}/>,path:"/users",roles:["admin","doctor"]},
];
const storedUser=()=>{try{return JSON.parse(localStorage.getItem("currentUser"))}catch{return null}};
const initials=(name="")=>name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"US";

export default function Sidebar({activeItem="Dashboard"}){
 const navigate=useNavigate(),workspace=useWorkspace(),[mobileOpen,setMobileOpen]=useState(false),[user]=useState(storedUser);
 const items=menuItems.filter(item=>!item.roles||item.roles.includes(user?.role));
 const fullname=user?.fullname||user?.full_name||"Logged-in User";
 const role=user?.role==="admin"?"Administrator":user?.role==="doctor"?"Doctor":"Clinic Staff";
 const logout=()=>{localStorage.removeItem("token");localStorage.removeItem("obgyn_token");localStorage.removeItem("currentUser");if(workspace){window.location.assign("/")}else{navigate("/",{replace:true})}};
 return <>
  <header className="fixed inset-x-0 top-12 z-40 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 shadow-sm backdrop-blur lg:hidden"><div className="flex items-center gap-3"><img src={Logo} alt="OB-GYN Clinic" className="h-10 w-10 rounded-xl bg-pink-50 p-1"/><div><p className="font-bold text-slate-900">OB-GYN Clinic</p><p className="text-xs text-slate-500">{activeItem}</p></div></div><button type="button" aria-label="Open navigation" onClick={()=>setMobileOpen(true)} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700"><Menu size={22}/></button></header>
  {mobileOpen&&<button type="button" aria-label="Close navigation" onClick={()=>setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"/>}
  <aside className={`fixed bottom-0 left-0 top-12 z-50 flex h-[calc(100vh-3rem)] w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 lg:sticky lg:top-12 lg:z-auto lg:h-[calc(100vh-3rem)] lg:translate-x-0 lg:shadow-lg ${mobileOpen?"translate-x-0":"-translate-x-full"}`}>
   <div className="bg-linear-to-br from-pink-600 via-rose-500 to-rose-400 px-5 py-6 text-white"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow"><img src={Logo} alt="OB-GYN Clinic" className="h-10 w-10"/></div><div><h1 className="text-lg font-bold">OB-GYN Clinic</h1><p className="text-xs text-pink-100">Management System</p></div><button type="button" aria-label="Close navigation" onClick={()=>setMobileOpen(false)} className="ml-auto rounded-xl bg-white/15 p-2 lg:hidden"><X size={20}/></button></div></div>
  <nav className="flex-1 space-y-1 px-3 py-5"><p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Workspace</p>{items.map(item=>{const active=item.name===activeItem;return <button type="button" onClick={()=>{setMobileOpen(false);if(workspace){workspace.openTab(item.path)}else{navigate(item.path)}}} key={item.name} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${active?"bg-pink-50 text-pink-700 shadow-sm ring-1 ring-pink-100":"text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${active?"bg-pink-500 text-white shadow-sm":"bg-slate-100 text-slate-500 group-hover:bg-white"}`}>{item.icon}</span>{item.name}</button>})}</nav>
   <div className="border-t border-slate-100 p-4"><div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-500 font-bold text-white">{initials(fullname)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{fullname}</p><p className="text-xs text-slate-500">{role}</p></div><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100"/></div><button type="button" onClick={logout} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"><LogOut size={17}/>Sign out</button></div>
  </aside>
 </>;
}
