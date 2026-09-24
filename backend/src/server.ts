import dotenv = require("dotenv");

dotenv.config();

import express = require("express");
import pool from "./config/db";

import companyRoutes = require("./routes/companyRoutes");
import jobRoutes = require("./routes/jobRoutes");
import profileRoutes = require("./routes/profileRoutes");
import {
    runAllCollectors,
    runCompanyCollector
} from "./collectors/collectorService";
import {
    generateMatchesForUser,
    getMatchesForUser,
    getUsersForMatching,
} from "./services/matchingService";
import {
    runDailyMatching,
    startJobScheduler,
} from "./scheduler/jobScheduler";
import applicationRoutes = require("./routes/applicationRoutes");
import skillRoutes from "./routes/skillRoutes";
import authRoutes from "./routes/authRoutes";
import { authenticateToken, AuthRequest } from "./middleware/authMiddleware";
import resumeRoutes from "./routes/resumeRoutes";

import cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 8000;

startJobScheduler();

app.get("/", (req, res) => {
    res.send("Job Radar Backend is running!");
});

app.use("/companies", companyRoutes);
app.use("/jobs", jobRoutes);
app.use("/profiles", profileRoutes);    
app.use("/applications", applicationRoutes);
app.use("/resumes", resumeRoutes);
app.use("/", skillRoutes);
app.use("/", authRoutes);

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

app.post("/collect", async (req, res) => {
    try {
        const summary = await runAllCollectors();
        const users = await getUsersForMatching();
        const matchResults = [];

        for (const user of users) {
            matchResults.push({
                userId: user.id,
                result: await generateMatchesForUser(user.id),
            });
        }

res.json({
    message: "Collectors completed successfully",
    summary,
    matchResults,
});
    } catch (error) {
        console.error("Collector error:", error);

        res.status(500).json({
            message: "Collector failed",
        });
    }
});

app.post(
    "/profiles/:userId/generate-matches",
    authenticateToken,
    async (req: AuthRequest, res) => {
    try {
        const userId = Number(req.params.userId);

        if (userId !== req.user!.userId) {
    return res.status(403).json({
        message: "You are not allowed to access another user's matches",
    });
}

        const result = await generateMatchesForUser(userId);

        res.json({
            message: "Matches generated successfully",
            result
        });
    } catch (error) {
        console.error("Match generation error:", error);

        res.status(500).json({
            message: "Failed to generate matches"
        });
    }
});

app.get(
    "/profiles/:userId/matches",
    authenticateToken,
    async (req: AuthRequest, res) => {
    try {
        const userId = Number(req.params.userId);
        if (userId !== req.user!.userId) {
    return res.status(403).json({
        message: "You are not allowed to access another user's matches",
    });
}

        const matches = await getMatchesForUser(userId);

        res.json(matches);
    } catch (error) {
        console.error("Fetch matches error:", error);

        res.status(500).json({
            message: "Failed to fetch matches"
        });
    }
});

app.post("/daily-run", async (req, res) => {
    try {
        await runAllCollectors();
        await runDailyMatching();

        res.json({
            message: "Daily run completed",
        });
    } catch (error) {
        console.error("Daily run error:", error);

        res.status(500).json({
            message: "Daily run failed"
        });
    }
});

app.post("/collect/:companyId", async (req, res) => {
    try {
        const companyId = Number(req.params.companyId);

        if (Number.isNaN(companyId)) {
            return res.status(400).json({
                message: "Invalid company ID"
            });
        }

        const result = await runCompanyCollector(companyId);

        res.json({
            message: "Company collector completed successfully",
            result
        });

    } catch (error) {
        console.error("Company collector error:", error);

        res.status(500).json({
            message: "Company collector failed",
            error: error instanceof Error
                ? error.message
                : String(error)
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});