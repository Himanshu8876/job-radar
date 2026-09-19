import dotenv = require("dotenv");

dotenv.config();

import express = require("express");
import pool from "./config/db";

import companyRoutes = require("./routes/companyRoutes");
import jobRoutes = require("./routes/jobRoutes");
import profileRoutes = require("./routes/profileRoutes");
import { runAllCollectors } from "./collectors/collectorService";
import { generateMatchesForUser,getMatchesForUser } from "./services/matchingService";
import { startJobScheduler } from "./scheduler/jobScheduler";
import { sendEmail } from "./services/emailService";

const app = express();
app.use(express.json());

const PORT = 8000;

startJobScheduler();

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

app.post("/collect", async (req, res) => {
    try {
        const summary = await runAllCollectors();

        await generateMatchesForUser(1);

res.json({
    message: "Collectors completed successfully",
    summary
});
    } catch (error) {
        console.error("Collector error:", error);

        res.status(500).json({
            message: "Collector failed",
        });
    }
});

app.post("/profiles/:userId/generate-matches", async (req, res) => {
    try {
        const userId = Number(req.params.userId);

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

app.get("/profiles/:userId/matches", async (req, res) => {
    try {
        const userId = Number(req.params.userId);

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

        const matchResult =
            await generateMatchesForUser(1);

        const matches =
            await getMatchesForUser(1);

        await sendEmail(
    "garghimanshu778@gmail.com",
    `Job Radar - ${matches.jobs.length} matching jobs`,
    `
        <h1>Daily Job Radar</h1>

        <p>
            You have
            <strong>${matches.jobs.length}</strong>
            matching jobs today.
        </p>

        ${matches.jobs.map((job) => `
            <div style="
                border: 1px solid #ddd;
                padding: 16px;
                margin: 16px 0;
                border-radius: 8px;
            ">
                <h2>${job.title}</h2>

                <p>
                    <strong>Company:</strong>
                    ${job.company_name}
                </p>

                <p>
                    <strong>Location:</strong>
                    ${job.location || "Not specified"}
                </p>

                <p>
                    <strong>Workplace:</strong>
                    ${job.workplace_type || "Not specified"}
                </p>

                <p>
                    <strong>Match Score:</strong>
                    ${job.score}
                </p>

                <a
                    href="${job.application_url}"
                    target="_blank"
                    style="
                        display: inline-block;
                        padding: 10px 16px;
                        background: #000;
                        color: #fff;
                        text-decoration: none;
                        border-radius: 6px;
                    "
                >
                    Apply Now
                </a>
            </div>
        `).join("")}
    `
);

        res.json({
            message: "Daily run completed",
            matchResult,
            newJobs: matches.newJobs,
            totalMatches: matches.jobs.length
        });
    } catch (error) {
        console.error("Daily run error:", error);

        res.status(500).json({
            message: "Daily run failed"
        });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});