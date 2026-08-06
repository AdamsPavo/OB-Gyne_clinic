import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./Pages/Login";
import Register from "./Pages/Register";
import Dashboard from "./Pages/Dashboard";
import Patient from "./Pages/Patient";
import PatientProfile from "./Pages/PatientProfile";
import CaseDetail from "./Pages/CaseDetail";
import Appointments from "./Pages/Appointments";
import Consultations from "./Pages/Consultations";
import PrenatalRecords from "./Pages/PrenatalRecords";
import Prescriptions from "./Pages/Prescriptions";
import Billing from "./Pages/Billing";
import Reports from "./Pages/Reports";
import BackupRestore from "./Pages/BackupRestore";
import ClinicModule from "./Pages/ClinicModule";
import Tools from "./Pages/Tools";
import Inventory from "./Pages/Inventory";
import PatientCharges from "./Pages/PatientCharges";
import AppErrorBoundary from "./components/AppErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import UserManagement from "./Pages/UserManagement";
import NotFound from "./Pages/NotFound";

const protect = (element, roles) => <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;

function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={protect(<Dashboard />)} />

          <Route path="/patients" element={protect(<Patient />)} />

          <Route
            path="/patients/:id"
            element={protect(<PatientProfile />)}
          />

          <Route
            path="/cases/:id"
            element={protect(<CaseDetail />, ["admin", "doctor"])}
          />

          <Route
            path="/appointments"
            element={protect(<Appointments />)}
          />

          <Route
            path="/consultations"
            element={protect(<Consultations />, ["admin", "doctor"])}
          />

          <Route
            path="/consultations/new"
            element={protect(<Consultations />, ["admin", "doctor"])}
          />

          <Route
            path="/prenatal-records"
            element={protect(<PrenatalRecords />, ["admin", "doctor"])}
          />

          <Route
            path="/prescriptions"
            element={protect(<Prescriptions />, ["admin", "doctor"])}
          />

          <Route
            path="/billing"
            element={protect(<Billing />)}
          />

          <Route
            path="/reports"
            element={protect(<Reports />, ["admin", "doctor"])}
          />

          <Route
            path="/backup-restore"
            element={protect(<BackupRestore />, ["admin", "doctor"])}
          />

          <Route
            path="/laboratory-requests"
            element={
              protect(<ClinicModule moduleName="Laboratory Requests" />, ["admin", "doctor"])
            }
          />

          <Route path="/tools" element={protect(<Tools />, ["admin", "doctor"])} />
          <Route path="/inventory" element={protect(<Inventory />)} />
          <Route path="/patient-charges" element={protect(<PatientCharges />)} />
          <Route path="/settings" element={protect(<Tools />, ["admin", "doctor"])} />
          <Route path="/users" element={protect(<UserManagement />, ["admin", "doctor"])} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
