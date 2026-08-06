import { Navigate } from "react-router-dom";
import { getCurrentUser } from "../auth";

export default function ProtectedRoute({ children, roles }) {
  const token = localStorage.getItem("obgyn_token");
  const user = getCurrentUser();
  if (!token || !user) return <Navigate to="/" replace />;
  if (roles?.length && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
