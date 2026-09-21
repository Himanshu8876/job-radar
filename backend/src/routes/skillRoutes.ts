import express = require("express");
import pool from "../config/db";
import {
    authenticateToken,
    AuthRequest,
} from "../middleware/authMiddleware";

const router = express.Router();

/**
 * GET /skills
 *
 * Get all available skills.
 *
 * Public endpoint.
 */
router.get("/skills", async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT id, name, skill_type, aliases
            FROM skills
            ORDER BY name ASC
            `
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching skills:", error);

        res.status(500).json({
            error: "Failed to fetch skills",
        });
    }
});


/**
 * POST /profiles/:id/skills
 *
 * Add a skill to the authenticated user's profile.
 *
 * Body:
 * {
 *   "skill_id": 5
 * }
 */
router.post(
    "/profiles/:id/skills",
    authenticateToken,
    async (req: AuthRequest, res) => {
        try {
            const userProfileId = Number(req.params.id);
            const authenticatedUserId = req.user?.userId;
            const { skill_id } = req.body;

            if (!Number.isInteger(userProfileId)) {
                return res.status(400).json({
                    error: "Invalid profile id",
                });
            }

            if (!authenticatedUserId) {
                return res.status(401).json({
                    error: "Unauthorized",
                });
            }

            // User can only modify their own profile
            if (userProfileId !== authenticatedUserId) {
                return res.status(403).json({
                    error: "You are not allowed to modify this profile",
                });
            }

            if (!Number.isInteger(Number(skill_id))) {
                return res.status(400).json({
                    error: "skill_id must be a valid integer",
                });
            }

            const skillId = Number(skill_id);

            // Check profile exists
            const profileResult = await pool.query(
                `SELECT id FROM user_profiles WHERE id = $1`,
                [userProfileId]
            );

            if (profileResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Profile not found",
                });
            }

            // Check skill exists
            const skillResult = await pool.query(
                `SELECT id, name, skill_type, aliases
                 FROM skills
                 WHERE id = $1`,
                [skillId]
            );

            if (skillResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Skill not found",
                });
            }

            // Add skill
            await pool.query(
                `
                INSERT INTO user_profile_skills (
                    user_profile_id,
                    skill_id
                )
                VALUES ($1, $2)
                `,
                [userProfileId, skillId]
            );

            res.status(201).json({
                message: "Skill added successfully",
                skill: skillResult.rows[0],
            });

        } catch (error: any) {
            if (error.code === "23505") {
                return res.status(409).json({
                    error: "Skill already added to this profile",
                });
            }

            console.error("Error adding profile skill:", error);

            res.status(500).json({
                error: "Failed to add skill",
            });
        }
    }
);


/**
 * DELETE /profiles/:id/skills/:skillId
 *
 * Remove a skill from the authenticated user's profile.
 */
router.delete(
    "/profiles/:id/skills/:skillId",
    authenticateToken,
    async (req: AuthRequest, res) => {
        try {
            const userProfileId = Number(req.params.id);
            const skillId = Number(req.params.skillId);
            const authenticatedUserId = req.user?.userId;

            if (
                !Number.isInteger(userProfileId) ||
                !Number.isInteger(skillId)
            ) {
                return res.status(400).json({
                    error: "Invalid profile id or skill id",
                });
            }

            if (!authenticatedUserId) {
                return res.status(401).json({
                    error: "Unauthorized",
                });
            }

            // User can only modify their own profile
            if (userProfileId !== authenticatedUserId) {
                return res.status(403).json({
                    error: "You are not allowed to modify this profile",
                });
            }

            const result = await pool.query(
                `
                DELETE FROM user_profile_skills
                WHERE user_profile_id = $1
                AND skill_id = $2
                RETURNING skill_id
                `,
                [userProfileId, skillId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Skill not found in profile",
                });
            }

            res.json({
                message: "Skill removed successfully",
            });

        } catch (error) {
            console.error("Error removing profile skill:", error);

            res.status(500).json({
                error: "Failed to remove skill",
            });
        }
    }
);


export default router;