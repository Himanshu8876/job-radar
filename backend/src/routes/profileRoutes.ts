import express = require("express");
import pool from "../config/db";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
    SELECT
        up.id AS user_profile_id,
        up.name,
        up.email,
        up.degree,
        up.graduation_year,
        up.experience_years,
        up.preferred_locations,
        up.preferred_roles,
        s.name AS skill_name
    FROM user_profiles up
    LEFT JOIN user_profile_skills ups
        ON up.id = ups.user_profile_id
    LEFT JOIN skills s
        ON ups.skill_id = s.id
    ORDER BY up.id, s.id
`);

        const { skill_name, ...profileData } = result.rows[0];

const profile = {
    ...profileData,
    skills: result.rows
        .map((row) => row.skill_name)
        .filter((skill) => skill !== null),
};

res.json(profile);
    } catch (error) {
        console.error("Error fetching profiles:", error);

        res.status(500).json({
            message: "Failed to fetch profiles",
        });
    }
});


router.post("/", async (req, res) => {
    try {
        const {
            name,
            email,
            degree,
            graduation_year,
            experience_years,
            preferred_locations,
            preferred_roles
        } = req.body;

        const result = await pool.query(
            `INSERT INTO user_profiles (
                name,
                email,
                degree,
                graduation_year,
                experience_years,
                preferred_locations,
                preferred_roles
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                name,
                email,
                degree,
                graduation_year,
                experience_years,
                preferred_locations,
                preferred_roles
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating profile:", error);

        res.status(500).json({
            message: "Failed to create profile",
        });
    }
});

export = router;