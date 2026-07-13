const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../database/database");

const router = express.Router();

router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    try {
        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || "change-this-development-secret",
            { expiresIn: "8h" }
        );

        res.json({ token, user: { id: user.id, fullname: user.fullname, username: user.username, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error." });
    }
});

/*
    REGISTER
*/
router.post("/register", async (req, res) => {

    const { fullname, username, password, role } = req.body;

    if (!fullname || !username || !password) {
        return res.status(400).json({
            message: "Please fill in all required fields."
        });
    }

    try {

        // Check if username already exists
        const existingUser = db.prepare(
            "SELECT * FROM users WHERE username = ?"
        ).get(username);

        if (existingUser) {
            return res.status(409).json({
                message: "Username already exists."
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // This is a single-doctor clinic system: only one account may be created.
        const userCount = db.prepare("SELECT COUNT(*) AS total FROM users").get().total;
        if (userCount > 0) {
            return res.status(403).json({ message: "This clinic system already has its doctor account." });
        }
        const accountRole = "doctor";

        // Insert user
        const result = db.prepare(`
            INSERT INTO users
            (fullname, username, password, role)
            VALUES (?, ?, ?, ?)
        `).run(
            fullname,
            username,
            hashedPassword,
            accountRole
        );

        res.status(201).json({
            message: "User registered successfully.",
            userId: result.lastInsertRowid
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error."
        });

    }

});

module.exports = router;
