import express = require("express");
import pool from "../config/db";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM jobs ORDER BY id"
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching jobs:", error);

        res.status(500).json({
            message: "Failed to fetch jobs",
        });
    }
});

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
            experience_min,
            experience_max,
            posted_at,
            updated_at,
            application_url
        } = req.body;

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
                experience_min,
                experience_max,
                posted_at,
                updated_at,
                application_url
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13
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
                experience_min,
                experience_max,
                posted_at,
                updated_at,
                application_url
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