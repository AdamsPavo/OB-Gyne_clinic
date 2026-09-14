import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser, canOpen } from "../auth";

import AccessDenied from "./AccessDenied";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem("obgyn_token");
  const user = getCurrentUser();
  if (!token || !user) return <Navigate to="/" replace />;
  if (!canOpen(location.pathname)) return <AccessDenied />;
  return children;
}
