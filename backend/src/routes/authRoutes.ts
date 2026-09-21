import { Router, Request, Response } from "express";
import bcrypt = require("bcrypt");
import pool from "../config/db";
import jwt = require("jsonwebtoken");
import { authenticateToken, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

router.post("/auth/signup", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters",
            });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email already registered",
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (email, password_hash)
             VALUES ($1, $2)
             RETURNING id, email, created_at`,
            [normalizedEmail, passwordHash]
        );

        return res.status(201).json({
            message: "User registered successfully",
            user: result.rows[0],
        });
    } catch (error) {
        console.error("Signup error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
});

router.post("/auth/login", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        const result = await pool.query(
            `SELECT id, email, password_hash
             FROM users
             WHERE email = $1`,
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const user = result.rows[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const jwtSecret = process.env.JWT_SECRET;

        if (!jwtSecret) {
            console.error("JWT_SECRET is not configured");

            return res.status(500).json({
                message: "Authentication configuration error",
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
            },
            jwtSecret,
            {
                expiresIn: "7d",
            }
        );

        return res.status(200).json({
            message: "Login successful",
            user: {
                id: user.id,
                email: user.email,
            },
            token,
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
});

router.get(
    "/auth/me",
    authenticateToken,
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({
                    message: "Unauthorized",
                });
            }

            const result = await pool.query(
                `SELECT id, email, created_at
                 FROM users
                 WHERE id = $1`,
                [userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "User not found",
                });
            }

            return res.status(200).json({
                user: result.rows[0],
            });
        } catch (error) {
            console.error("Auth me error:", error);

            return res.status(500).json({
                message: "Internal server error",
            });
        }
    }
);

export default router;