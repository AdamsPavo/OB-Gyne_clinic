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
    const user = db.prepare(`SELECT id, full_name, username, role, is_active FROM users WHERE id = ?`).get(payload.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ message: "This account is inactive or no longer exists." });
    }
    req.user = user;
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
