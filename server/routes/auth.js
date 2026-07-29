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

function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication is required.",
    });
  }

  const token = authorization.split(" ")[1];

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired session.",
    });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication is required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action.",
      });
    }

    next();
  };
}

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
          username,
          password,
          role
        )
        VALUES (?, ?, ?, ?)
      `).run(
        doctor.name.trim(),
        doctor.username.trim(),
        doctorPasswordHash,
        "doctor"
      );

      const staffResult = db.prepare(`
        INSERT INTO users (
          fullname,
          username,
          password,
          role
        )
        VALUES (?, ?, ?, ?)
      `).run(
        staff.name.trim(),
        staff.username.trim(),
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
          fullname,
          username,
          password,
          role
        FROM users
        WHERE LOWER(username) = LOWER(?)
      `)
      .get(username.trim());

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
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
        fullname: user.fullname,
        username: user.username,
        role: user.role,
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
  requireRole("doctor"),
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
          username,
          password,
          role
        )
        VALUES (?, ?, ?, ?)
      `).run(
        fullname.trim(),
        username.trim(),
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
    "SELECT id, fullname, username, role, created_at FROM users WHERE id = ?"
  ).get(req.user.id);
  if (!user) return res.status(404).json({ message: "User account not found." });
  res.json(user);
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
  db.prepare("UPDATE users SET fullname = ?, username = ? WHERE id = ?")
    .run(fullname, username, req.user.id);
  const user = db.prepare(
    "SELECT id, fullname, username, role FROM users WHERE id = ?"
  ).get(req.user.id);
  res.json({ message: "Profile updated successfully.", user });
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

module.exports = router;
