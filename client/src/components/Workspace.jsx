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
import { getCurrentUser, canOpen } from "../auth";
import Sidebar from "./Sidebar";
import Appointments from "../Pages/Appointments";
import BackupRestore from "../Pages/BackupRestore";
import Billing from "../Pages/Billing";
import CaseDetail from "../Pages/CaseDetail";
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

import { api } from "../api/client";
import AccessDenied from "./AccessDenied";
import BillingHistoryPage from "../Pages/BillingHistoryPage";

const WorkspaceContext = createContext(null);

const definitions = [
  { match: /^\/dashboard$/, path: "/dashboard", title: "Dashboard", icon: LayoutDashboard, permanent: true, element: <Dashboard /> },
  { match: /^\/patients$/, path: "/patients", title: "Patients", icon: Users, element: <Patient /> },
  { match: /^\/patients\/[^/]+$/, title: "Patient Record", icon: Users, element: <PatientProfile /> },
  { match: /^\/cases\/[^/]+$/, title: "Case Detail", icon: ClipboardPlus, element: <CaseDetail /> },
  { match: /^\/appointments$/, path: "/appointments", title: "Appointments", icon: CalendarDays, element: <Appointments /> },
  { match: /^\/consultations(?:\/new)?$/, path: "/consultations", title: "Consultations", icon: ClipboardPlus, element: <Consultations /> },
  { match: /^\/prenatal-records$/, path: "/prenatal-records", title: "Prenatal Records", icon: HeartPulse, element: <PrenatalRecords /> },
  { match: /^\/prescriptions$/, path: "/prescriptions", title: "Prescriptions", icon: Pill, element: <Prescriptions /> },
  { match: /^\/billing$/, path: "/billing", title: "Billing", icon: CreditCard, element: <Billing /> },
  { match: /^\/reports$/, path: "/reports", title: "Reports", icon: FileBarChart, element: <Reports /> },
  { match: /^\/backup-restore$/, path: "/backup-restore", title: "Backup & Restore", icon: DatabaseBackup, element: <BackupRestore /> },
  { match: /^\/laboratory-requests$/, path: "/laboratory-requests", title: "Laboratory Requests", icon: ClipboardPlus, element: <Prescriptions laboratoryOnly /> },
  { match: /^\/settings$/, path: "/settings", title: "Settings", icon: Settings2, element: <Tools settingsOnly /> },
  { match: /^\/billing-history$/, path: "/billing-history", title: "Billing History", icon: ReceiptText, element: <BillingHistoryPage /> },
  { match: /^\/tools$/, path: "/tools", title: "Tools", icon: Settings2, element: <Tools /> },
  { match: /^\/inventory$/, path: "/inventory", title: "Inventory", icon: Package, element: <Inventory /> },
  { match: /^\/patient-charges$/, path: "/patient-charges", title: "Other Charges", icon: ReceiptText, element: <PatientCharges /> },
  { match: /^\/users$/, path: "/users", title: "User Management", icon: UserCog, element: <UserManagement /> },
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

export function TabContent({ path }) {
  const definition = getDefinition(path.split("?")[0]);
  if (!definition) return <NotFound />;
  if (!canOpen(path)) return <AccessDenied />;
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
      <Route path="/laboratory-requests" element={<Prescriptions laboratoryOnly />} />
      <Route path="/tools" element={<Tools />} />
      <Route path="/settings" element={<Tools settingsOnly />} />
      <Route path="/billing-history" element={<BillingHistoryPage />} />
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

function Workspace() {
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
    if (!definition || !canOpen(path)) return;
    const id = tabKey(path);
    setTabs((current) => current.some((tab) => tab.id === id) ? current : [...current, createTab(path)]);
    setActiveTabId(id);
    outerNavigate(path);
  }, [outerNavigate]);

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

      if (tabId === activeTabId) {
        const nextTab = next[Math.max(0, index - 1)] || next[0] || createTab("/dashboard");
        setActiveTabId(nextTab.id);
        outerNavigate(nextTab.path);
      }

      return next.length ? next : [createTab("/dashboard")];
    });
  }, [activeTabId, outerNavigate]);

  const contextValue = useMemo(() => ({ openTab }), [openTab]);

  if (!localStorage.getItem("obgyn_token") || !user) return <Navigate to="/" replace />;

  const activeItem = tabs.find((tab) => tab.id === activeTabId)?.title || "Dashboard";

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className="clinic-workspace flex min-h-screen bg-slate-50">
        <Sidebar activeItem={activeItem} managed />

        <div className="min-w-0 flex-1">
          <nav aria-label="Open workspace tabs" className="clinic-workspace-tabs sticky top-0 z-30 flex h-12 shrink-0 items-center overflow-x-auto border-b border-slate-200 bg-white px-4">
            <div className="flex h-full min-w-max items-end gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = tab.id === activeTabId;
                return <div key={tab.id} className={`clinic-workspace-tab ${active ? "is-active" : ""}`}>
                  <button type="button" aria-current={active ? "page" : undefined} onClick={() => activateTab(tab)} className="flex h-full min-w-0 items-center gap-2 px-3 text-sm font-medium">
                  <Icon size={16} className={active ? "text-pink-600" : "text-slate-500"} />
                  <span className="truncate">{tab.title}</span>
                  </button>
                  {!tab.permanent && <button type="button" aria-label={`Close ${tab.title}`} onClick={(event) => closeTab(event, tab.id)} className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-pink-100 hover:text-pink-800"><X size={15} /></button>}
                </div>;
              })}
            </div>
          </nav>

          <div className="clinic-workspace-content flex min-h-0 flex-1">
            {tabs.map((tab) => <MountedTab key={tab.id} tab={tab} active={tab.id === activeTabId} />)}
          </div>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}

// Do not mount protected pages with stale localStorage grants during a refresh.
export default function SessionWorkspace() {
  const [session, setSession] = useState({ loading: true, error: "", expired: false });
  useEffect(() => {
    let cancelled = false;
    api("/auth/profile").then(user => {
      if (cancelled) return;
      localStorage.setItem("currentUser", JSON.stringify(user));
      setSession({ loading:false, error:"", expired:false });
    }).catch(error => {
      if (!cancelled) setSession({loading:false, error:error.message, expired:error.status === 401});
    });
    return () => { cancelled = true; };
  }, []);
  if (!localStorage.getItem("obgyn_token") || session.expired) return <Navigate to="/" replace />;
  if (session.loading) return <div role="status" className="grid min-h-screen place-items-center bg-pink-50 text-pink-800">Loading your workspace permissions?</div>;
  if (session.error) return <div role="alert" className="m-8 rounded-2xl bg-rose-50 p-6 text-rose-800"><p>{session.error}</p><button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-white">Try again</button></div>;
  return <Workspace />;
}
