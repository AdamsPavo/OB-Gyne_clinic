import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../assets/OBLOGO.png";

const menuItems = [
  { name: "Dashboard", icon: "⌂", path: "/dashboard" },
  { name: "Patients", icon: "♁", path: "/patients" },
  { name: "Appointments", icon: "◷", path: "/appointments" },
  {
    name: "Consultations",
    icon: "+",
    path: "/consultations",
    roles: ["doctor"],
  },
  {
    name: "Prenatal Records",
    icon: "♥",
    path: "/prenatal-records",
    roles: ["doctor"],
  },
  {
    name: "Prescriptions",
    icon: "◉",
    path: "/prescriptions",
    roles: ["doctor"],
  },
  { name: "Billing", icon: "□", path: "/billing" },
  { name: "Reports", icon: "▥", path: "/reports" },
  {
    name: "Backup / Restore",
    icon: "↻",
    path: "/backups",
    roles: ["doctor"],
  },
];

function getStoredUser() {
  try {
    const storedUser = localStorage.getItem("currentUser");

    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error("Unable to read current user:", error);
    return null;
  }
}

function getInitials(fullname = "") {
  const parts = fullname
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "US";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function Sidebar({ activeItem = "Dashboard" }) {
  const navigate = useNavigate();

  const currentUser = useMemo(() => getStoredUser(), []);

  const visibleMenuItems = menuItems.filter((item) => {
    if (!item.roles) {
      return true;
    }

    return item.roles.includes(currentUser?.role);
  });

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");

    navigate("/login", {
      replace: true,
    });
  };

  const fullname =
    currentUser?.fullname ||
    currentUser?.full_name ||
    "Logged-in User";

  const role =
    currentUser?.role === "doctor"
      ? "Doctor"
      : currentUser?.role === "staff"
        ? "Clinic Staff"
        : "User";

  const initials = getInitials(fullname);

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-pink-100 bg-white shadow-xl lg:flex">
      <div className="bg-linear-to-br from-pink-500 to-rose-400 px-6 py-6 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
            <img
              src={Logo}
              alt="OB-GYN Clinic"
              className="h-10 w-10"
            />
          </div>

          <div>
            <h1 className="text-xl font-bold">
              OB-GYN Clinic
            </h1>

            <p className="text-sm text-pink-100">
              Management System
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6">
        <p className="mb-3 px-3 text-xs font-semibold uppercase text-gray-400">
          Main Menu
        </p>

        {visibleMenuItems.map((item) => {
          const isActive =
            item.name === activeItem;

          const classes = `group relative flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left transition-all duration-300 ${
            isActive
              ? "bg-pink-100 text-pink-600 shadow-sm"
              : "text-gray-600 hover:bg-pink-50 hover:text-pink-600"
          }`;

          return (
            <Link
              to={item.path}
              key={item.name}
              className={classes}
            >
              <span
                className={`absolute left-0 h-8 w-1 rounded-r-full bg-pink-500 ${
                  isActive ? "" : "hidden"
                }`}
              />

              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
                  isActive
                    ? "bg-pink-200"
                    : "bg-gray-100 group-hover:bg-pink-100"
                }`}
              >
                {item.icon}
              </span>

              <span className="font-medium">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-pink-100 bg-linear-to-r from-pink-50 to-rose-50 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500 font-bold text-white shadow-md">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-gray-800">
              {fullname}
            </h3>

            <p className="text-xs text-gray-500">
              {role}
            </p>
          </div>

          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 w-full rounded-xl bg-red-50 py-3 font-medium text-red-500 transition hover:bg-red-100"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;