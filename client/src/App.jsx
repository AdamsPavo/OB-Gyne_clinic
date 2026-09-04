import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./Pages/Login";
import Register from "./Pages/Register";
import AppErrorBoundary from "./components/AppErrorBoundary";
import Workspace from "./components/Workspace";

function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route path="/register" element={<Register />} />

          <Route path="*" element={<Workspace />} />
        </Routes>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
