import express = require("express");
import {
    getJobs,
    getJobById,
} from "../services/jobService";
import { getMatchesForUser } from "../services/matchingService";
import { authenticateToken, AuthRequest } from "../middleware/authMiddleware";

const router = express.Router();

/**
 * GET /jobs
 *
 * Supported query parameters:
 *
 * search
 * location
 * company
 * workplace
 * employmentType
 * experienceMax
 * country
 * page
 * limit
 * sort
 *
 * Example:
 * /jobs?search=react&location=Bangalore&experienceMax=2&page=1&limit=20
 */
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const experienceMax =
            req.query.experienceMax !== undefined
                ? Number(req.query.experienceMax)
                : undefined;

        if (
            experienceMax !== undefined &&
            Number.isNaN(experienceMax)
        ) {
            return res.status(400).json({
                message: "experienceMax must be a number",
            });
        }

        if (!req.user) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }

        const result = await getJobs({
            search: req.query.search as string | undefined,
            location: req.query.location as string | undefined,
            company: req.query.company as string | undefined,
            workplace: req.query.workplace as string | undefined,
            employmentType:
                req.query.employmentType as string | undefined,
            experienceMax,
            country: req.query.country as string | undefined,
            scope: req.query.scope as
                | "india"
                | "international"
                | undefined,
            page,
            limit,
            sort: req.query.sort as string | undefined,

            // Logged-in user's ID
            userProfileId: req.user.userId,
        });

        res.json(result);
    } catch (error) {
        console.error("Error fetching jobs:", error);

        res.status(500).json({
            message: "Failed to fetch jobs",
            error:
                error instanceof Error
                    ? error.message
                    : String(error),
        });
    }
});


/**
 * GET /jobs/matches/:userId
 *
 * Get matching jobs for a user.
 *
 * IMPORTANT:
 * This route must come before /:id
 * so "matches" is not treated as a job ID.
 */
router.get(
    "/matches/:userId",
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
        console.error("Error fetching matches:", error);

        res.status(500).json({
            message: "Failed to fetch matches",
            error:
                error instanceof Error
                    ? error.message
                    : String(error),
        });
    }
});


/**
 * GET /jobs/:id
 *
 * Get a single active job.
 */
router.get("/:id", async (req, res) => {
    try {
        const jobId = Number(req.params.id);

        if (Number.isNaN(jobId)) {
            return res.status(400).json({
                message: "Invalid job ID",
            });
        }

        const job = await getJobById(jobId);

        if (!job) {
            return res.status(404).json({
                message: "Job not found",
            });
        }

        res.json(job);
    } catch (error) {
        console.error("Error fetching job:", error);

        res.status(500).json({
            message: "Failed to fetch job",
            error:
                error instanceof Error
                    ? error.message
                    : String(error),
        });
    }
});


/**
 * POST /jobs
 *
 * Kept for manual/testing purposes.
 */
router.post("/", async (req, res) => {
    try {
        const {
            company_id,
            source,
            source_job_id,
            title,
            description,
            location,
            country,
            employment_type,
            workplace_type,
            experience_min,
            experience_max,
            posted_at,
            updated_at,
            application_url,
        } = req.body;

        const pool = require("../config/db").default;

        const result = await pool.query(
            `INSERT INTO jobs (
                company_id,
                source,
                source_job_id,
                title,
                description,
                location,
                country,
                employment_type,
                workplace_type,
                experience_min,
                experience_max,
                posted_at,
                updated_at,
                application_url
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, $14
            )
            RETURNING *`,
            [
                company_id,
                source,
                source_job_id,
                title,
                description,
                location,
                country,
                employment_type,
                workplace_type,
                experience_min,
                experience_max,
                posted_at,
                updated_at,
                application_url,
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating job:", error);

        res.status(500).json({
            message: "Failed to create job",
        });
    }
});


export = router;