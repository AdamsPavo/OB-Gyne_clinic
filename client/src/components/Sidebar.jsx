import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
    roles: ["admin", "doctor"],
  },
  {
    name: "Prenatal Records",
    icon: <HeartPulse size={19} />,
    path: "/prenatal-records",
    roles: ["admin", "doctor"],
  },
  {
    name: "Prescriptions",
    icon: <Pill size={19} />,
    path: "/prescriptions",
    roles: ["admin", "doctor"],
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
    roles: ["admin", "doctor"],
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
    roles: ["admin", "doctor"],
  },
];

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
  const items = menuItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

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
      {/* =========================================================
          MOBILE TOP HEADER
         ========================================================= */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          {/* Mobile Logo */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-50">
            <img
              src={Logo}
              alt="OB-GYN Clinic"
              className="h-11 w-11 object-contain"
            />
          </div>

          {/* Mobile Clinic Name */}
          <div className="min-w-0">
            <p className="truncate text-base font-bold leading-tight text-slate-900">
              OB-GYN Clinic
            </p>

            <p className="truncate text-xs text-slate-500">
              {activeItem}
            </p>
          </div>
        </div>

        {/* Open Sidebar Button */}
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:bg-slate-50"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* =========================================================
          MOBILE DARK OVERLAY
         ========================================================= */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* =========================================================
          SIDEBAR
         ========================================================= */}
      <aside
        className={`
          fixed bottom-0 left-0 top-0 z-50
          flex h-screen w-72 shrink-0 flex-col
          border-r border-slate-200
          bg-white
          shadow-2xl
          transition-transform duration-300

          lg:sticky
          lg:top-0
          lg:z-auto
          lg:h-screen
          lg:translate-x-0
          lg:shadow-lg

          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        {/* =======================================================
            SIDEBAR HEADER / LOGO
            Same top level as Workspace Tab Bar
           ======================================================= */}
        <div className="relative z-20 flex h-23 shrink-0 items-center gap-3 bg-linear-to-br from-pink-600 via-rose-500 to-rose-400 px-3 text-white shadow-sm">
          {/* Larger Logo */}
          <div className="flex h-17 w-17 shrink-0 items-center justify-center rounded-xl bg-white shadow-md">
            <img
              src={Logo}
              alt="OB-GYN Clinic"
              className="h-11 w-11 object-contain"
            />
          </div>

          {/* Clinic Name */}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight text-white">
              OB-GYN Clinic
            </h1>

            <p className="truncate text-[10px] font-medium text-pink-100">
              Management System
            </p>
          </div>

          {/* Mobile Sidebar Close Button */}
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-xl bg-white/15 p-2 transition hover:bg-white/25 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* =======================================================
            SIDEBAR NAVIGATION
            Only this section scrolls
           ======================================================= */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>

          <div className="space-y-1">
            {items.map((item) => {
              const active = item.name === activeItem;

              return (
                <button
                  type="button"
                  key={item.name}
                  onClick={() => handleNavigation(item.path)}
                  className={`
                    group flex w-full items-center gap-3
                    rounded-xl px-3 py-2.5
                    text-left text-sm font-semibold
                    transition-all duration-200

                    ${
                      active
                        ? "bg-pink-50 text-pink-700 shadow-sm ring-1 ring-pink-100"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }
                  `}
                >
                  {/* Menu Icon */}
                  <span
                    className={`
                      flex h-9 w-9 shrink-0
                      items-center justify-center
                      rounded-lg transition-all

                      ${
                        active
                          ? "bg-pink-500 text-white shadow-sm"
                          : "bg-slate-100 text-slate-500 group-hover:bg-white"
                      }
                    `}
                  >
                    {item.icon}
                  </span>

                  {/* Menu Name */}
                  <span className="truncate">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* =======================================================
            USER ACCOUNT AREA
           ======================================================= */}
        <div className="shrink-0 border-t border-slate-100 bg-white p-4">
          {/* User Information */}
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            {/* User Initials */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500 font-bold text-white shadow-sm">
              {initials(fullname)}
            </div>

            {/* Name and Role */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">
                {fullname}
              </p>

              <p className="truncate text-xs text-slate-500">
                {role}
              </p>
            </div>

            {/* Online Indicator */}
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-100"
              title="Online"
            />
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={logout}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
