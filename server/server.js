require("dotenv").config();

const express = require("express");
const cors = require("cors");

require("./database/database");

const authRoutes = require("./routes/auth");
const clinicRoutes = require("./routes/clinic");
const userRoutes = require("./routes/users");
const { requireAuth } = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api", requireAuth, (req, res, next) => {
  if (req.user.role !== "staff") return next();
  const allowed = ["/dashboard", "/patients", "/appointments", "/billings", "/invoices", "/patient-charges", "/inventory", "/services", "/service-types"];
  if (!allowed.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    return res.status(403).json({ message: "Staff accounts cannot access this module." });
  }
  if ((req.path.startsWith("/services") || req.path.startsWith("/service-types")) && req.method !== "GET") {
    return res.status(403).json({ message: "Staff accounts cannot manage services or prices." });
  }
  if (req.method === "DELETE" || (req.path.startsWith("/patients/") && req.method === "DELETE")) {
    return res.status(403).json({ message: "Staff accounts cannot perform this action." });
  }
  next();
}, clinicRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "OB-GYN API is running 🚀"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
