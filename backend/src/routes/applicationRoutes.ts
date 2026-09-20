import express = require("express");
import pool from "../config/db";

const router = express.Router();

const VALID_STATUSES = [
    "NEW",
    "SAVED",
    "APPLIED",
    "INTERVIEW",
    "REJECTED",
    "OFFER"
];

/**
 * GET /applications?userId=1
 */
router.get("/", async (req, res) => {
    try {
        const userId = Number(req.query.userId) || 1;

        const result = await pool.query(
            `SELECT
                a.id,
                a.user_profile_id,
                a.job_id,
                a.status,
                a.notes,
                a.applied_at,
                a.created_at,
                a.updated_at,

                j.title,
                j.location,
                j.workplace_type,
                j.application_url,

                c.name AS company_name

             FROM applications a
             JOIN jobs j
                ON a.job_id = j.id
             JOIN companies c
                ON j.company_id = c.id

             WHERE a.user_profile_id = $1

             ORDER BY a.updated_at DESC`,
            [userId]
        );

        res.json({
            applications: result.rows
        });

    } catch (error) {
        console.error("Error fetching applications:", error);

        res.status(500).json({
            message: "Failed to fetch applications"
        });
    }
});


/**
 * POST /applications
 */
router.post("/", async (req, res) => {
    try {
        const {
            user_profile_id,
            job_id,
            status = "NEW",
            notes
        } = req.body;

        if (!user_profile_id || !job_id) {
            return res.status(400).json({
                message: "user_profile_id and job_id are required"
            });
        }

        const normalizedStatus = String(status).toUpperCase();

        if (!VALID_STATUSES.includes(normalizedStatus)) {
            return res.status(400).json({
                message: `Invalid status. Valid statuses: ${VALID_STATUSES.join(", ")}`
            });
        }

        const jobResult = await pool.query(
            `SELECT id
             FROM jobs
             WHERE id = $1`,
            [job_id]
        );

        if (jobResult.rows.length === 0) {
            return res.status(404).json({
                message: "Job not found"
            });
        }

        const result = await pool.query(
    `INSERT INTO applications (
        user_profile_id,
        job_id,
        status,
        notes,
        applied_at
    )
    VALUES (
        $1,
        $2,
        $3::VARCHAR(50),
        $4,
        CASE
            WHEN $3::VARCHAR(50) = 'APPLIED'
            THEN CURRENT_TIMESTAMP
            ELSE NULL
        END
    )
    RETURNING *`,
            [
                user_profile_id,
                job_id,
                normalizedStatus,
                notes || null
            ]
        );

        res.status(201).json({
            message: "Application created successfully",
            application: result.rows[0]
        });

    } catch (error: any) {
        console.error("Error creating application:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "Application already exists for this job"
            });
        }

        res.status(500).json({
            message: "Failed to create application"
        });
    }
});


/**
 * PUT /applications/:id
 */
router.put("/:id", async (req, res) => {
    try {
        const applicationId = Number(req.params.id);

        if (Number.isNaN(applicationId)) {
            return res.status(400).json({
                message: "Invalid application ID"
            });
        }

        const { status, notes } = req.body;

        const normalizedStatus =
            status !== undefined
                ? String(status).toUpperCase()
                : undefined;

        if (
            normalizedStatus !== undefined &&
            !VALID_STATUSES.includes(normalizedStatus)
        ) {
            return res.status(400).json({
                message: `Invalid status. Valid statuses: ${VALID_STATUSES.join(", ")}`
            });
        }

        const result = await pool.query(
            `UPDATE applications
             SET
                status = COALESCE($1::VARCHAR(50), status),
                notes = COALESCE($2, notes),
                applied_at = CASE
                    WHEN $1::VARCHAR(50) = 'APPLIED'
                         AND applied_at IS NULL
                    THEN CURRENT_TIMESTAMP
                    ELSE applied_at
                END,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [
                normalizedStatus || null,
                notes !== undefined ? notes : null,
                applicationId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Application not found"
            });
        }

        res.json({
            message: "Application updated successfully",
            application: result.rows[0]
        });

    } catch (error) {
        console.error("Error updating application:", error);

        res.status(500).json({
            message: "Failed to update application"
        });
    }
});


/**
 * DELETE /applications/:id
 */
router.delete("/:id", async (req, res) => {
    try {
        const applicationId = Number(req.params.id);

        if (Number.isNaN(applicationId)) {
            return res.status(400).json({
                message: "Invalid application ID"
            });
        }

        const result = await pool.query(
            `DELETE FROM applications
             WHERE id = $1
             RETURNING id`,
            [applicationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Application not found"
            });
        }

        res.json({
            message: "Application deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting application:", error);

        res.status(500).json({
            message: "Failed to delete application"
        });
    }
});


export = router;