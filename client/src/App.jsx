import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./Pages/Register";
import Dashboard from "./pages/Dashboard";
import Patient from "./Pages/Patient";
import Appointments from "./Pages/Appointments";
import Consultations from "./Pages/Consultations";
import PrenatalRecords from "./Pages/PrenatalRecords";
import Prescriptions from "./Pages/Prescriptions";
import Billing from "./Pages/Billing";
import Reports from "./Pages/Reports";
import BackupRestore from "./Pages/BackupRestore";


function App(){

  return (

    <BrowserRouter>

      <Routes>

        <Route 
          path="/" 
          element={<Login/>}
        />

        <Route path="/register" element={<Register />} />


        <Route
          path="/dashboard"
          element={<Dashboard/>}
        />

        <Route
          path="/patients"
          element={<Patient/>}
        />

        <Route path="/appointments" element={<Appointments />} />
        <Route path="/consultations" element={<Consultations />} />
        <Route path="/prenatal-records" element={<PrenatalRecords />} />
        <Route path="/prescriptions" element={<Prescriptions />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/backup-restore" element={<BackupRestore />} />


      </Routes>

    </BrowserRouter>

  );

}


export default App;
