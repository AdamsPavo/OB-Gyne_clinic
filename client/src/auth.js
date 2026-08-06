export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem("currentUser")) || null; } catch { return null; }
}
export const hasRole = (...roles) => roles.includes(getCurrentUser()?.role);
export const canAccess = (roles) => !roles?.length || hasRole(...roles);
