const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../database/database");
const { requireAuth, allowRoles } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, allowRoles("admin", "doctor"));
const fields = `id, full_name, username, role, is_active, created_at, updated_at`;
const getUser = (id) => db.prepare(`SELECT ${fields} FROM users WHERE id = ?`).get(id);
const audit = (actor, target, action) => db.prepare(`INSERT INTO user_audit_logs (acting_user_id, target_user_id, action) VALUES (?, ?, ?)`).run(actor, target, action);
const forbiddenAdmin = (req, target) => req.user.role === "doctor" && target.role === "admin";

router.get("/", (req, res) => {
  const q = `%${String(req.query.search || "").trim()}%`;
  res.json(db.prepare(`SELECT ${fields} FROM users WHERE full_name LIKE ? OR username LIKE ? ORDER BY created_at DESC`).all(q, q));
});

router.post("/", async (req, res) => {
  const fullName = req.body.full_name?.trim();
  const username = req.body.username?.trim();
  const password = req.body.password;
  if (req.body.confirmPassword !== undefined && password !== req.body.confirmPassword) return res.status(400).json({ message: "Passwords do not match." });
  const role = String(req.body.role || "").toLowerCase();
  if (!fullName || !username || !password) return res.status(400).json({ message: "Full name, username, and password are required." });
  if (password.length < 8) return res.status(400).json({ message: "Password must contain at least 8 characters." });
  if (!['admin','doctor','staff'].includes(role)) return res.status(400).json({ message: "Invalid role." });
  if (role === "admin" && req.user.role !== "admin") return res.status(403).json({ message: "Only an Admin can create Admin accounts." });
  if (db.prepare("SELECT id FROM users WHERE LOWER(username)=LOWER(?)").get(username)) return res.status(409).json({ message: "Username already exists." });
  const hash = await bcrypt.hash(password, 12);
  const active = req.body.is_active === false || req.body.is_active === 0 ? 0 : 1;
  const result = db.prepare(`INSERT INTO users (fullname, full_name, username, password, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(fullName, fullName, username, hash, hash, role, active);
  audit(req.user.id, result.lastInsertRowid, "User created");
  res.status(201).json(getUser(result.lastInsertRowid));
});

router.put("/:id", (req, res) => {
  const target = getUser(req.params.id);
  if (!target) return res.status(404).json({ message: "User not found." });
  if (forbiddenAdmin(req, target)) return res.status(403).json({ message: "Doctors cannot manage Admin accounts." });
  const fullName = req.body.full_name?.trim(); const username = req.body.username?.trim(); const role = String(req.body.role || target.role).toLowerCase();
  if (!fullName || !username || !['admin','doctor','staff'].includes(role)) return res.status(400).json({ message: "Valid full name, username, and role are required." });
  if ((target.role === 'admin' || role === 'admin') && req.user.role !== 'admin') return res.status(403).json({ message: "Only an Admin can manage Admin accounts." });
  if (target.username.toLowerCase() === 'admin' && (username.toLowerCase() !== 'admin' || role !== 'admin')) return res.status(403).json({ message: "The default Admin username and role cannot be changed." });
  if (target.role === 'admin' && role !== 'admin' && target.is_active && db.prepare("SELECT COUNT(*) total FROM users WHERE role='admin' AND is_active=1").get().total <= 1) return res.status(400).json({ message: "The last active Admin cannot be changed to another role." });
  const duplicate = db.prepare("SELECT id FROM users WHERE LOWER(username)=LOWER(?) AND id<>?").get(username, target.id);
  if (duplicate) return res.status(409).json({ message: "Username already exists." });
  db.prepare(`UPDATE users SET fullname=?, full_name=?, username=?, role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(fullName, fullName, username, role, target.id);
  audit(req.user.id, target.id, "User updated"); res.json(getUser(target.id));
});

router.put("/:id/password", async (req, res) => {
  const target = getUser(req.params.id); const password = req.body.password;
  if (!target) return res.status(404).json({ message: "User not found." });
  if (forbiddenAdmin(req, target)) return res.status(403).json({ message: "Doctors cannot reset an Admin password." });
  if (!password || password.length < 8) return res.status(400).json({ message: "Password must contain at least 8 characters." });
  const hash = await bcrypt.hash(password, 12);
  db.prepare(`UPDATE users SET password=?, password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(hash, hash, target.id);
  audit(req.user.id, target.id, "Password reset"); res.json({ message: "Password reset successfully." });
});

router.put("/:id/status", (req, res) => {
  const target = getUser(req.params.id); const active = req.body.is_active ? 1 : 0;
  if (!target) return res.status(404).json({ message: "User not found." });
  if (forbiddenAdmin(req, target)) return res.status(403).json({ message: "Doctors cannot manage Admin accounts." });
  if (!active && target.id === req.user.id) return res.status(400).json({ message: "You cannot deactivate your own account." });
  if (!active && target.username.toLowerCase() === 'admin') return res.status(403).json({ message: "The default Admin account cannot be deactivated." });
  if (!active && target.role === 'admin' && db.prepare("SELECT COUNT(*) total FROM users WHERE role='admin' AND is_active=1").get().total <= 1) return res.status(400).json({ message: "The last active Admin cannot be deactivated." });
  db.prepare(`UPDATE users SET is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(active, target.id);
  audit(req.user.id, target.id, active ? "Account activated" : "Account deactivated"); res.json(getUser(target.id));
});

router.delete("/:id", (req, res) => {
  const target = getUser(req.params.id);
  if (!target) return res.status(404).json({ message: "User not found." });
  if (target.id === req.user.id) return res.status(400).json({ message: "You cannot delete your own account." });
  if (target.username.toLowerCase() === 'admin') return res.status(403).json({ message: "The default Admin account cannot be deleted." });
  if (forbiddenAdmin(req, target) || (target.role === 'admin' && req.user.role !== 'admin')) return res.status(403).json({ message: "Only an Admin can manage Admin accounts." });
  if (target.role === 'admin' && target.is_active && db.prepare("SELECT COUNT(*) total FROM users WHERE role='admin' AND is_active=1").get().total <= 1) return res.status(400).json({ message: "The last active Admin cannot be deleted." });
  try { db.prepare("DELETE FROM users WHERE id=?").run(target.id); audit(req.user.id, target.id, "User deleted"); res.status(204).end(); }
  catch { res.status(409).json({ message: "This user is linked to clinic records. Deactivate the account instead." }); }
});

module.exports = router;
