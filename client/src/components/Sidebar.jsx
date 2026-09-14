import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { canOpen, modules } from "../auth";
import { useWorkspace } from "./Workspace";

import {
  CalendarDays,
  ClipboardPlus,
  CreditCard,
  FileBarChart,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Pill,
  ReceiptText,
  Settings2,
  UserCog,
  Users,
  X,
} from "lucide-react";

import Logo from "../assets/OBLOGO.png";

const menuItems = [
  {
    name: "Dashboard",
    icon: <LayoutDashboard size={19} />,
    path: "/dashboard",
  },
  {
    name: "Patients",
    icon: <Users size={19} />,
    path: "/patients",
  },
  {
    name: "Appointments",
    icon: <CalendarDays size={19} />,
    path: "/appointments",
  },
  {
    name: "Consultations",
    icon: <ClipboardPlus size={19} />,
    path: "/consultations",
  },
  {
    name: "Prenatal Records",
    icon: <HeartPulse size={19} />,
    path: "/prenatal-records",
  },
  {
    name: "Prescriptions",
    icon: <Pill size={19} />,
    path: "/prescriptions",
  },
  {
    name: "Billing",
    icon: <CreditCard size={19} />,
    path: "/billing",
  },
  {
    name: "Reports",
    icon: <FileBarChart size={19} />,
    path: "/reports",
  },
  {
    name: "Tools",
    icon: <Settings2 size={19} />,
    path: "/tools",
  },
  {
    name: "Inventory",
    icon: <Package size={19} />,
    path: "/inventory",
  },
  {
    name: "Other Charges",
    icon: <ReceiptText size={19} />,
    path: "/patient-charges",
  },
  {
    name: "User Management",
    icon: <UserCog size={19} />,
    path: "/users",
  },
];

menuItems.push(
  { name: "Laboratory Requests", icon: <ClipboardPlus size={19} />, path: "/laboratory-requests" },
  { name: "Billing History", icon: <ReceiptText size={19} />, path: "/billing-history" },
  { name: "Backup & Restore", icon: <Settings2 size={19} />, path: "/backup-restore" },
  { name: "Settings", icon: <Settings2 size={19} />, path: "/settings" },
);

const storedUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser"));
  } catch {
    return null;
  }
};

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "US";

export default function Sidebar({
  activeItem = "Dashboard",
  managed = false,
}) {
  const navigate = useNavigate();
  const workspace = useWorkspace();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [user] = useState(storedUser);

  const menuTrigger = useRef(null);
  const navigationRef = useRef(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event) => {
      if (event.matches) setMobileOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    document.body.style.overflow = "hidden";
    navigationRef.current?.querySelector("button")?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuTrigger.current?.focus();
      }
      if (event.key === "Tab") {
        const buttons = [...navigationRef.current.querySelectorAll("button")].filter((button) => button.getClientRects().length);
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
      document.removeEventListener("keydown", handleKey);
    };
  }, [mobileOpen]);

  /*
   * When Workspace manages the sidebar,
   * prevent another Sidebar from rendering.
   */
  if (workspace && !managed) {
    return null;
  }

  /*
   * Filter sidebar menu based on account role.
   */
  const items = modules.map(module => ({...menuItems.find(item => item.path === module.path), category:module.category})).filter(item => item.path && canOpen(item.path));

  const fullname =
    user?.fullname ||
    user?.full_name ||
    "Logged-in User";

  const role =
    user?.role === "admin"
      ? "Administrator"
      : user?.role === "doctor"
        ? "Doctor"
        : "Clinic Staff";

  /*
   * Navigate using Workspace tabs when Workspace exists.
   * Otherwise use normal React Router navigation.
   */
  const handleNavigation = (path) => {
    setMobileOpen(false);

    if (workspace) {
      workspace.openTab(path);
    } else {
      navigate(path);
    }
  };

  /*
   * Logout
   */
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("obgyn_token");
    localStorage.removeItem("currentUser");

    if (workspace) {
      window.location.assign("/");
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <>
      <header className="clinic-mobile-header">
        <div className="flex min-w-0 items-center gap-3">
          <img src={Logo} alt="" className="h-10 w-10 object-contain" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">OB-GYN Clinic</p>
            <p className="truncate text-xs text-slate-500">{activeItem}</p>
          </div>
        </div>
        <button ref={menuTrigger} type="button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="clinic-navigation" onClick={() => setMobileOpen(true)} className="rounded-xl p-2.5 text-slate-600 hover:bg-pink-50">
          <Menu size={22} />
        </button>
      </header>
      {mobileOpen && <button type="button" tabIndex={-1} aria-label="Close navigation" onClick={() => { setMobileOpen(false); menuTrigger.current?.focus(); }} className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden" />}
      <aside ref={navigationRef} id="clinic-navigation" aria-label="Clinic navigation" className={`clinic-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="clinic-sidebar-brand flex h-24 shrink-0 items-center gap-3 border-b border-slate-100 px-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-pink-100 bg-white">
            <img src={Logo} alt="OB-GYN Clinic" className="h-10 w-10 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold tracking-tight text-slate-900">OB-GYN Clinic</h1>
            <p className="mt-1 text-[11px] font-medium text-slate-500">Clinic management</p>
          </div>
          <button type="button" aria-label="Close navigation" onClick={() => { setMobileOpen(false); menuTrigger.current?.focus(); }} className="rounded-lg p-2 text-slate-500 lg:hidden"><X size={20} /></button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5" aria-label="Main navigation">
          <div className="space-y-1">
            {items.map((item, index) => {
              const active = item.name === activeItem;
              return (
                <div key={item.name}>
                  {(index === 0 || items[index - 1].category !== item.category) && <p className={`clinic-nav-label ${index ? "mt-5" : ""}`}>{item.category}</p>}
                  <button type="button" onClick={() => handleNavigation(item.path)} aria-current={active ? "page" : undefined} className={`clinic-nav-item ${active ? "is-active" : ""}`}>
                    <span className="shrink-0" aria-hidden="true">{item.icon}</span>
                    <span className="truncate">{item.name}</span>
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-pink-600" />}
                  </button>
                </div>
              );
            })}
          </div>
        </nav>
        <div className="shrink-0 border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-pink-100/70 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-bold text-pink-700">{initials(fullname)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800" title={fullname}>{fullname}</p>
              <p className="mt-0.5 text-xs text-slate-500">{role}</p>
            </div>
          </div>
          <button type="button" onClick={logout} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-700"><LogOut size={16} />Sign out</button>
        </div>
      </aside>
    </>
  );
}
