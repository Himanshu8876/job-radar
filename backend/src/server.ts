import dotenv = require("dotenv");

dotenv.config();

import express = require("express");
import pool from "./config/db";

import companyRoutes = require("./routes/companyRoutes");
import jobRoutes = require("./routes/jobRoutes");
import profileRoutes = require("./routes/profileRoutes");

const app = express();
app.use(express.json());

const PORT = 8000;

app.get("/", (req, res) => {
    res.send("Job Radar Backend is running!");
});

app.use("/companies", companyRoutes);
app.use("/jobs", jobRoutes);
app.use("/profiles", profileRoutes);    

app.get("/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            message: "Database connected successfully!",
            time: result.rows[0].now,
        });
    } catch (error) {
        console.error("Database connection error:", error);

        res.status(500).json({
            message: "Database connection failed",
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});