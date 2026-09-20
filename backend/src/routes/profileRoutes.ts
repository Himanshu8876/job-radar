import express = require("express");
import pool from "../config/db";

const router = express.Router();

/**
 * GET /profiles
 *
 * Get all profiles.
 */
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

        if (result.rows.length === 0) {
            return res.json([]);
        }

        const profilesMap = new Map<number, any>();

        for (const row of result.rows) {
            if (!profilesMap.has(row.user_profile_id)) {
                profilesMap.set(row.user_profile_id, {
                    user_profile_id: row.user_profile_id,
                    name: row.name,
                    email: row.email,
                    degree: row.degree,
                    graduation_year: row.graduation_year,
                    experience_years: row.experience_years,
                    preferred_locations: row.preferred_locations,
                    preferred_roles: row.preferred_roles,
                    skills: [],
                });
            }

            if (row.skill_name !== null) {
                profilesMap
                    .get(row.user_profile_id)
                    .skills.push(row.skill_name);
            }
        }

        res.json(Array.from(profilesMap.values()));

    } catch (error) {
        console.error("Error fetching profiles:", error);

        res.status(500).json({
            message: "Failed to fetch profiles",
        });
    }
});


/**
 * GET /profiles/:id
 *
 * Get one profile with skills.
 */
router.get("/:id", async (req, res) => {
    try {
        const userId = Number(req.params.id);

        if (Number.isNaN(userId)) {
            return res.status(400).json({
                message: "Invalid profile ID",
            });
        }

        const result = await pool.query(
            `
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
            WHERE up.id = $1
            ORDER BY s.id
            `,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Profile not found",
            });
        }

        const firstRow = result.rows[0];

        const profile = {
            user_profile_id: firstRow.user_profile_id,
            name: firstRow.name,
            email: firstRow.email,
            degree: firstRow.degree,
            graduation_year: firstRow.graduation_year,
            experience_years: firstRow.experience_years,
            preferred_locations: firstRow.preferred_locations,
            preferred_roles: firstRow.preferred_roles,
            skills: result.rows
                .map((row) => row.skill_name)
                .filter((skill) => skill !== null),
        };

        res.json(profile);

    } catch (error) {
        console.error("Error fetching profile:", error);

        res.status(500).json({
            message: "Failed to fetch profile",
        });
    }
});


/**
 * POST /profiles
 *
 * Create a new profile.
 */
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

        if (!name || !email) {
            return res.status(400).json({
                message: "name and email are required",
            });
        }

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
                experience_years ?? 0,
                preferred_locations,
                preferred_roles
            ]
        );

        res.status(201).json({
            message: "Profile created successfully",
            profile: result.rows[0],
        });

    } catch (error: any) {
        console.error("Error creating profile:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "A profile with this email already exists",
            });
        }

        res.status(500).json({
            message: "Failed to create profile",
        });
    }
});


/**
 * PUT /profiles/:id
 *
 * Update profile preferences/details.
 */
router.put("/:id", async (req, res) => {
    try {
        const userId = Number(req.params.id);

        if (Number.isNaN(userId)) {
            return res.status(400).json({
                message: "Invalid profile ID",
            });
        }

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
            `UPDATE user_profiles
             SET
                name = COALESCE($1::VARCHAR(255), name),
                email = COALESCE($2::VARCHAR(255), email),
                degree = COALESCE($3::VARCHAR(255), degree),
                graduation_year = COALESCE($4::INTEGER, graduation_year),
                experience_years = COALESCE($5::NUMERIC(3,1), experience_years),
                preferred_locations = COALESCE($6::TEXT, preferred_locations),
                preferred_roles = COALESCE($7::TEXT, preferred_roles),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $8
             RETURNING *`,
            [
                name ?? null,
                email ?? null,
                degree ?? null,
                graduation_year ?? null,
                experience_years ?? null,
                preferred_locations ?? null,
                preferred_roles ?? null,
                userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Profile not found",
            });
        }

        res.json({
            message: "Profile updated successfully",
            profile: result.rows[0],
        });

    } catch (error: any) {
        console.error("Error updating profile:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "A profile with this email already exists",
            });
        }

        res.status(500).json({
            message: "Failed to update profile",
        });
    }
});


export = router;