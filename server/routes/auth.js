const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../database/database");

const router = express.Router();

const JWT_SECRET =
  process.env.JWT_SECRET || "change-this-development-secret";

/*
|--------------------------------------------------------------------------
| Authentication middleware
|--------------------------------------------------------------------------
*/

const { requireAuth: authenticate } = require("../middleware/auth");
const { publicUser } = require("../services/permissions");

/*
|--------------------------------------------------------------------------
| Setup status
|--------------------------------------------------------------------------
*/

router.get("/setup-status", (req, res) => {
  try {
    const userCount = db
      .prepare("SELECT COUNT(*) AS total FROM users")
      .get().total;

    const settings = db
      .prepare(`
        SELECT
          clinic_name,
          clinic_address,
          doctor_name
        FROM settings
        WHERE id = 1
      `)
      .get();

    res.json({
      configured: userCount > 0,
      settings: settings || null,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to check clinic setup.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| First-time setup
|--------------------------------------------------------------------------
|
| Expected body:
|
| {
|   clinicName: "...",
|   clinicAddress: "...",
|   doctor: {
|     name: "...",
|     username: "...",
|     password: "..."
|   },
|   staff: {
|     name: "...",
|     username: "...",
|     password: "..."
|   }
| }
|
*/

router.post("/setup", async (req, res) => {
  const {
    clinicName,
    clinicAddress,
    doctor,
    staff,
  } = req.body;

  if (
    !clinicName?.trim() ||
    !clinicAddress?.trim() ||
    !doctor?.name?.trim() ||
    !doctor?.username?.trim() ||
    !doctor?.password ||
    !staff?.name?.trim() ||
    !staff?.username?.trim() ||
    !staff?.password
  ) {
    return res.status(400).json({
      message: "Clinic, doctor, and staff details are required.",
    });
  }

  if (doctor.password.length < 8 || staff.password.length < 8) {
    return res.status(400).json({
      message: "Passwords must contain at least 8 characters.",
    });
  }

  if (
    doctor.username.trim().toLowerCase() ===
    staff.username.trim().toLowerCase()
  ) {
    return res.status(400).json({
      message: "Doctor and staff usernames must be different.",
    });
  }

  const existingUsers = db
    .prepare("SELECT COUNT(*) AS total FROM users")
    .get().total;

  if (existingUsers > 0) {
    return res.status(403).json({
      message: "This clinic has already been configured.",
    });
  }

  try {
    const doctorPasswordHash = await bcrypt.hash(
      doctor.password,
      12
    );

    const staffPasswordHash = await bcrypt.hash(
      staff.password,
      12
    );

    const setupClinic = db.transaction(() => {
      db.prepare(`
        INSERT INTO settings (
          id,
          clinic_name,
          clinic_address,
          doctor_name
        )
        VALUES (1, ?, ?, ?)
      `).run(
        clinicName.trim(),
        clinicAddress.trim(),
        doctor.name.trim()
      );

      const doctorResult = db.prepare(`
        INSERT INTO users (
          fullname,
          full_name,
          username,
          password,
          password_hash,
          role
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        doctor.name.trim(),
        doctor.name.trim(),
        doctor.username.trim(),
        doctorPasswordHash,
        doctorPasswordHash,
        "doctor"
      );

      const staffResult = db.prepare(`
        INSERT INTO users (
          fullname,
          full_name,
          username,
          password,
          password_hash,
          role
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        staff.name.trim(),
        staff.name.trim(),
        staff.username.trim(),
        staffPasswordHash,
        staffPasswordHash,
        "staff"
      );

      return {
        doctorId: doctorResult.lastInsertRowid,
        staffId: staffResult.lastInsertRowid,
      };
    });

    const result = setupClinic();

    res.status(201).json({
      message: "Clinic and user accounts configured successfully.",
      users: result,
    });
  } catch (error) {
    console.error(error);

    if (
      error.code === "SQLITE_CONSTRAINT_UNIQUE" ||
      String(error.message).includes("UNIQUE constraint failed")
    ) {
      return res.status(409).json({
        message: "One of the usernames is already in use.",
      });
    }

    res.status(500).json({
      message: "Unable to configure clinic.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username?.trim() || !password) {
    return res.status(400).json({
      message: "Username and password are required.",
    });
  }

  try {
    const user = db
      .prepare(`
        SELECT
          id,
          full_name,
          username,
          password_hash,
          role,
          is_active,
          permissions
        FROM users
        WHERE LOWER(username) = LOWER(?)
      `)
      .get(username.trim());

    if (
      !user ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "This account is inactive. Contact an administrator." });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        sessionVersion: db.prepare("SELECT session_version FROM app_runtime_state WHERE id=1").get()?.session_version || "0",
      },
      JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    res.json({
      token,
      user: {
        id: user.id,
        fullname: user.full_name,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
        is_active: Boolean(user.is_active),
        permissions: publicUser(user).permissions,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Create another staff account
|--------------------------------------------------------------------------
|
| Doctor-only route.
|
| POST /auth/register
| Authorization: Bearer <token>
|
| {
|   fullname: "...",
|   username: "...",
|   password: "..."
| }
|
*/

router.post(
  "/register",
  authenticate,
  (req, res, next) => req.user.role === "admin" ? next() : res.status(403).json({ message: "Only Admin can create accounts through this legacy endpoint." }),
  async (req, res) => {
    const {
      fullname,
      username,
      password,
    } = req.body;

    if (
      !fullname?.trim() ||
      !username?.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Please fill in all required fields.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    try {
      const existingUser = db
        .prepare(`
          SELECT id
          FROM users
          WHERE LOWER(username) = LOWER(?)
        `)
        .get(username.trim());

      if (existingUser) {
        return res.status(409).json({
          message: "Username already exists.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const result = db.prepare(`
        INSERT INTO users (
          fullname,
          full_name,
          username,
          password,
          password_hash,
          role
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        fullname.trim(),
        fullname.trim(),
        username.trim(),
        hashedPassword,
        hashedPassword,
        "staff"
      );

      res.status(201).json({
        message: "Staff account created successfully.",
        user: {
          id: result.lastInsertRowid,
          fullname: fullname.trim(),
          username: username.trim(),
          role: "staff",
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Unable to create staff account.",
      });
    }
  }
);

router.get("/profile", authenticate, (req, res) => {
  const user = db.prepare(
    "SELECT id, fullname, full_name, username, role, is_active, permissions, created_at FROM users WHERE id = ?"
  ).get(req.user.id);
  if (!user) return res.status(404).json({ message: "User account not found." });
  res.json(publicUser(user));
});

router.put("/profile", authenticate, (req, res) => {
  const fullname = req.body.fullname?.trim();
  const username = req.body.username?.trim();
  if (!fullname || !username) {
    return res.status(400).json({ message: "Full name and username are required." });
  }
  const duplicate = db.prepare(
    "SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id <> ?"
  ).get(username, req.user.id);
  if (duplicate) return res.status(409).json({ message: "Username already exists." });
  db.prepare("UPDATE users SET fullname = ?, full_name = ?, username = ? WHERE id = ?")
    .run(fullname, fullname, username, req.user.id);
  const user = db.prepare(
    "SELECT id, fullname, full_name, username, role, is_active, permissions FROM users WHERE id = ?"
  ).get(req.user.id);
  res.json({ message: "Profile updated successfully.", user: publicUser(user) });
});

router.put("/password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new passwords are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: "New password must contain at least 8 characters." });
  }
  const user = db.prepare("SELECT password FROM users WHERE id = ?").get(req.user.id);
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(400).json({ message: "Current password is incorrect." });
  }
  const password = await bcrypt.hash(newPassword, 12);
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(password, req.user.id);
  res.json({ message: "Password changed successfully." });
});

router.post("/authorize", authenticate, (req, res) => {
  const { hasPermission } = require("../services/permissions");
  const { modules } = require("../../shared/permissions.mjs");
  const { module, action } = req.body;
  if (!modules.some(m => m.id === module && m.actions.includes(action)) || !hasPermission(req.user,module,action)) return res.status(403).json({message:"You do not have permission to perform this action."});
  res.json({allowed:true});
});

module.exports = router;
