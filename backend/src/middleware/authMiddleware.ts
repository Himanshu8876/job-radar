import { Request, Response, NextFunction } from "express";
import jwt = require("jsonwebtoken");

export interface AuthRequest extends Request {
    user?: {
        userId: number;
        email: string;
    };
}

export function authenticateToken(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication token required",
            });
        }

        const token = authHeader.split(" ")[1];

        const jwtSecret = process.env.JWT_SECRET;

        if (!jwtSecret) {
            console.error("JWT_SECRET is not configured");

            return res.status(500).json({
                message: "Authentication configuration error",
            });
        }

        const decoded = jwt.verify(token, jwtSecret) as {
            userId: number | string;
            email: string;
        };

        req.user = {
            userId: Number(decoded.userId),
            email: decoded.email,
        };

        next();
    } catch (error) {
        console.error("Token verification failed:", error);

        return res.status(401).json({
            message: "Invalid or expired token",
        });
    }
}