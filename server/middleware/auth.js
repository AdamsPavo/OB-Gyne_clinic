const jwt = require("jsonwebtoken");
const db = require("../database/database");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-development-secret";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication is required." });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const version = db.prepare("SELECT session_version FROM app_runtime_state WHERE id=1").get()?.session_version || "0";
    if ((payload.sessionVersion || "0") !== version) return res.status(401).json({ message: "The database was restored. Please sign in again." });
    const user = db.prepare(`SELECT id, full_name, username, role, is_active, permissions FROM users WHERE id = ?`).get(payload.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ message: "This account is inactive or no longer exists." });
    }
    req.user = require("../services/permissions").publicUser(user);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ message: "You do not have permission to perform this action." });
}

module.exports = { requireAuth, allowRoles, JWT_SECRET };
