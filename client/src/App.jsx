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
import AppErrorBoundary from "./components/AppErrorBoundary";

function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/patients" element={<Patient />} />

          <Route
            path="/patients/:id"
            element={<PatientProfile />}
          />

          <Route
            path="/cases/:id"
            element={<CaseDetail />}
          />

          <Route
            path="/appointments"
            element={<Appointments />}
          />

          <Route
            path="/consultations"
            element={<Consultations />}
          />

          <Route
            path="/consultations/new"
            element={<Consultations />}
          />

          <Route
            path="/prenatal-records"
            element={<PrenatalRecords />}
          />

          <Route
            path="/prescriptions"
            element={<Prescriptions />}
          />

          <Route
            path="/billing"
            element={<Billing />}
          />

          <Route
            path="/reports"
            element={<Reports />}
          />

          <Route
            path="/backup-restore"
            element={<BackupRestore />}
          />

          <Route
            path="/laboratory-requests"
            element={
              <ClinicModule moduleName="Laboratory Requests" />
            }
          />

          <Route
            path="/settings"
            element={<ClinicModule moduleName="Settings" />}
          />
        </Routes>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

export default App;