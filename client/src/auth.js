export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem("currentUser")) || null; } catch { return null; }
}
export const hasRole = (...roles) => roles.includes(getCurrentUser()?.role);
export const canAccess = (roles) => !roles?.length || hasRole(...roles);

export { modules, actionLabel, fullPermissions, normalizePermissions, permissionsFor, moduleForPath } from "../../shared/permissions.mjs";
import { hasPermission, canVisit } from "../../shared/permissions.mjs";
export const can = (module, action = "view") => hasPermission(getCurrentUser(), module, action);
export const canOpen = (path) => canVisit(getCurrentUser(), path);
