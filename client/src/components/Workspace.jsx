/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  CalendarDays,
  ClipboardPlus,
  CreditCard,
  DatabaseBackup,
  FileBarChart,
  HeartPulse,
  LayoutDashboard,
  Package,
  Pill,
  ReceiptText,
  Settings2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { getCurrentUser } from "../auth";
import Appointments from "../Pages/Appointments";
import BackupRestore from "../Pages/BackupRestore";
import Billing from "../Pages/Billing";
import CaseDetail from "../Pages/CaseDetail";
import ClinicModule from "../Pages/ClinicModule";
import Consultations from "../Pages/Consultations";
import Dashboard from "../Pages/Dashboard";
import Inventory from "../Pages/Inventory";
import NotFound from "../Pages/NotFound";
import Patient from "../Pages/Patient";
import PatientCharges from "../Pages/PatientCharges";
import PatientProfile from "../Pages/PatientProfile";
import PrenatalRecords from "../Pages/PrenatalRecords";
import Prescriptions from "../Pages/Prescriptions";
import Reports from "../Pages/Reports";
import Tools from "../Pages/Tools";
import UserManagement from "../Pages/UserManagement";

const WorkspaceContext = createContext(null);

const definitions = [
  { match: /^\/dashboard$/, path: "/dashboard", title: "Dashboard", icon: LayoutDashboard, permanent: true, element: <Dashboard /> },
  { match: /^\/patients$/, path: "/patients", title: "Patients", icon: Users, element: <Patient /> },
  { match: /^\/patients\/[^/]+$/, title: "Patient Record", icon: Users, element: <PatientProfile /> },
  { match: /^\/cases\/[^/]+$/, title: "Case Detail", icon: ClipboardPlus, roles: ["admin", "doctor"], element: <CaseDetail /> },
  { match: /^\/appointments$/, path: "/appointments", title: "Appointments", icon: CalendarDays, element: <Appointments /> },
  { match: /^\/consultations(?:\/new)?$/, path: "/consultations", title: "Consultations", icon: ClipboardPlus, roles: ["admin", "doctor"], element: <Consultations /> },
  { match: /^\/prenatal-records$/, path: "/prenatal-records", title: "Prenatal Records", icon: HeartPulse, roles: ["admin", "doctor"], element: <PrenatalRecords /> },
  { match: /^\/prescriptions$/, path: "/prescriptions", title: "Prescriptions", icon: Pill, roles: ["admin", "doctor"], element: <Prescriptions /> },
  { match: /^\/billing$/, path: "/billing", title: "Billing", icon: CreditCard, element: <Billing /> },
  { match: /^\/reports$/, path: "/reports", title: "Reports", icon: FileBarChart, roles: ["admin", "doctor"], element: <Reports /> },
  { match: /^\/backup-restore$/, path: "/backup-restore", title: "Backup / Restore", icon: DatabaseBackup, roles: ["admin", "doctor"], element: <BackupRestore /> },
  { match: /^\/laboratory-requests$/, path: "/laboratory-requests", title: "Laboratory Requests", icon: ClipboardPlus, roles: ["admin", "doctor"], element: <ClinicModule moduleName="Laboratory Requests" /> },
  { match: /^\/(tools|settings)$/, path: "/tools", title: "Tools", icon: Settings2, roles: ["admin", "doctor"], element: <Tools /> },
  { match: /^\/inventory$/, path: "/inventory", title: "Inventory", icon: Package, element: <Inventory /> },
  { match: /^\/patient-charges$/, path: "/patient-charges", title: "Patient Charges", icon: ReceiptText, element: <PatientCharges /> },
  { match: /^\/users$/, path: "/users", title: "User Management", icon: UserCog, roles: ["admin", "doctor"], element: <UserManagement /> },
];

const getDefinition = (pathname) => definitions.find((definition) => definition.match.test(pathname));
const tabKey = (path) => {
  const [pathname] = path.split("?");
  // Query parameters carry workflow context (patient/appointment IDs), but do
  // not represent a different main-module tab.
  return getDefinition(pathname)?.path || path;
};
const createTab = (path) => {
  const [pathname] = path.split("?");
  const definition = getDefinition(pathname);
  return { id: tabKey(path), path, title: definition?.title || "Workspace", icon: definition?.icon || LayoutDashboard, permanent: Boolean(definition?.permanent) };
};

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

function TabContent({ path }) {
  const definition = getDefinition(path.split("?")[0]);
  const user = getCurrentUser();
  if (!definition || (definition.roles && !definition.roles.includes(user?.role))) return <NotFound />;
  return (
    <Routes location={path}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/patients" element={<Patient />} />
      <Route path="/patients/:id" element={<PatientProfile />} />
      <Route path="/cases/:id" element={<CaseDetail />} />
      <Route path="/appointments" element={<Appointments />} />
      <Route path="/consultations" element={<Consultations />} />
      <Route path="/consultations/new" element={<Consultations />} />
      <Route path="/prenatal-records" element={<PrenatalRecords />} />
      <Route path="/prescriptions" element={<Prescriptions />} />
      <Route path="/billing" element={<Billing />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/backup-restore" element={<BackupRestore />} />
      <Route path="/laboratory-requests" element={<ClinicModule moduleName="Laboratory Requests" />} />
      <Route path="/tools" element={<Tools />} />
      <Route path="/settings" element={<Tools />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/patient-charges" element={<PatientCharges />} />
      <Route path="/users" element={<UserManagement />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function MountedTab({ tab, active }) {
  return (
    <div className={active ? "block min-w-0 flex-1" : "hidden"} aria-hidden={!active}>
      <TabContent path={tab.path} />
    </div>
  );
}

export default function Workspace() {
  const outerLocation = useLocation();
  const outerNavigate = useNavigate();
  const user = getCurrentUser();
  const initialPath = getDefinition(outerLocation.pathname)
    ? `${outerLocation.pathname}${outerLocation.search}`
    : "/dashboard";
  const [tabs, setTabs] = useState(() => [createTab(initialPath)]);
  const [activeTabId, setActiveTabId] = useState(() => tabKey(initialPath));

  const openTab = useCallback((path) => {
    const pathname = path.split("?")[0];
    const definition = getDefinition(pathname);
    if (!definition || (definition.roles && !definition.roles.includes(user?.role))) return;
    const id = tabKey(path);
    setTabs((current) => current.some((tab) => tab.id === id) ? current : [...current, createTab(path)]);
    setActiveTabId(id);
    outerNavigate(path);
  }, [outerNavigate, user?.role]);

  const activateTab = useCallback((tab) => {
    setActiveTabId(tab.id);
    outerNavigate(tab.path);
  }, [outerNavigate]);

  useEffect(() => {
    const path = `${outerLocation.pathname}${outerLocation.search}`;
    const definition = getDefinition(outerLocation.pathname);
    if (!definition) return;
    // Synchronize an in-tab navigation (for example, opening a patient record)
    // with the active tab's route without remounting the other tab components.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTabs((current) => current.map((tab) => tab.id === activeTabId
      ? { ...tab, path, title: definition.title, icon: definition.icon }
      : tab));
  }, [activeTabId, outerLocation.pathname, outerLocation.search]);

  const closeTab = useCallback((event, tabId) => {
    event.stopPropagation();
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === tabId);
      const next = current.filter((tab) => tab.id !== tabId);
      if (tabId === activeTabId) setActiveTabId(next[Math.max(0, index - 1)]?.id || "/dashboard");
      return next;
    });
  }, [activeTabId]);

  const contextValue = useMemo(() => ({ openTab }), [openTab]);

  if (!localStorage.getItem("obgyn_token") || !user) return <Navigate to="/" replace />;

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <nav aria-label="Open workspace tabs" className="sticky top-0 z-[100] flex h-12 shrink-0 items-end overflow-x-auto border-b border-slate-300 bg-slate-200 px-2 pt-1 shadow-sm">
          <div className="flex h-full min-w-max items-end gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === activeTabId;
              return <button key={tab.id} type="button" onClick={() => activateTab(tab)} className={`group flex h-10 max-w-60 items-center gap-2 rounded-t-xl border border-b-0 px-3 text-sm font-semibold transition ${active ? "border-slate-300 bg-white text-slate-800 shadow-sm" : "border-transparent bg-slate-300/70 text-slate-600 hover:bg-slate-100"}`}>
                <Icon size={16} className={active ? "text-pink-600" : "text-slate-500"} />
                <span className="truncate">{tab.title}</span>
                {!tab.permanent && <span role="button" tabIndex={0} aria-label={`Close ${tab.title}`} onClick={(event) => closeTab(event, tab.id)} onKeyDown={(event) => event.key === "Enter" && closeTab(event, tab.id)} className="ml-1 rounded-md p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><X size={15} /></span>}
              </button>;
            })}
          </div>
        </nav>
        <div className="flex min-h-0 flex-1">
          {tabs.map((tab) => <MountedTab key={tab.id} tab={tab} active={tab.id === activeTabId} />)}
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
