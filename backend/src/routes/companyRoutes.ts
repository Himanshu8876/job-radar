import express = require("express");
import pool from "../config/db";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM companies ORDER BY id"
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching companies:", error);

        res.status(500).json({
            message: "Failed to fetch companies",
        });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, website, careers_url, ats_type, ats_identifier } = req.body;

        const result = await pool.query(
            `INSERT INTO companies
                (name, website, careers_url, ats_type, ats_identifier)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, website, careers_url, ats_type, ats_identifier]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating company:", error);

        res.status(500).json({
            message: "Failed to create company",
        });
    }
});

export = router;