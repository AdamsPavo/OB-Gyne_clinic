const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../database/database");

const router = express.Router();

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

        // Insert user
        const result = db.prepare(`
            INSERT INTO users
            (fullname, username, password, role)
            VALUES (?, ?, ?, ?)
        `).run(
            fullname,
            username,
            hashedPassword,
            role || "staff"
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