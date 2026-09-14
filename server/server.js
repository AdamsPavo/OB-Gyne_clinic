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
app.use("/api", require("./services/maintenance").middleware);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api", requireAuth, clinicRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "OB-GYN API is running 🚀"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
