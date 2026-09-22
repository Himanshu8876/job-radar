import express = require("express");
const multer: any = require("multer");

import cloudinary from "../config/cloudinary";
import pool from "../config/db";
import { extractResumeData } from "../services/geminiService";

import {
    authenticateToken,
    AuthRequest,
} from "../middleware/authMiddleware";

const router = express.Router();

interface UploadedResume {
    buffer: Buffer;
    path: string;
    mimetype: string;
    originalname: string;
}

interface ResumeRequest extends AuthRequest {
    file?: UploadedResume;
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (
        _req: AuthRequest,
        file: UploadedResume,
        cb: (
            error: Error | null,
            acceptFile?: boolean
        ) => void
    ) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF resumes are allowed"));
        }
    },
});

function uploadResume(
    req: AuthRequest,
    res: express.Response,
    next: express.NextFunction
) {
    upload.single("resume")(req, res, (error: any) => {
        if (error) {
            console.error(
                "Resume upload middleware failed:",
                error
            );

            return res.status(400).json({
                message:
                    error instanceof Error
                        ? error.message
                        : "Resume upload failed",
            });
        }

        next();
    });
}

router.post(
    "/resume",
    authenticateToken,
    uploadResume,
    async (req: ResumeRequest, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    message: "Authentication required",
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    message: "Resume file is required",
                });
            }

            // Upload resume to Cloudinary
            const result = await new Promise<{
                secure_url: string;
            }>((resolve, reject) => {
                const uploadStream =
                    cloudinary.uploader.upload_stream(
                        {
                            folder: "job-radar/resumes",
                            resource_type: "raw",
                            public_id: `user_${req.user!.userId}_${Date.now()}`,
                        },
                        (error, uploadResult) => {
                            if (error) {
                                reject(error);
                            } else if (uploadResult) {
                                resolve(uploadResult);
                            } else {
                                reject(
                                    new Error(
                                        "Cloudinary returned no upload result"
                                    )
                                );
                            }
                        }
                    );

                uploadStream.end(req.file!.buffer);
            });

            // Save Cloudinary URL to user's profile
            const updateResult = await pool.query(
                `
                UPDATE user_profiles
                SET
                    resume_url = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING id, resume_url
                `,
                [
                    result.secure_url,
                    req.user.userId,
                ]
            );

            if (updateResult.rowCount === 0) {
                return res.status(404).json({
                    message: "User profile not found",
                });
            }

            return res.status(200).json({
                message: "Resume uploaded successfully",
                resumeUrl: result.secure_url,
            });
        } catch (error: any) {
            const errorMessage =
                error?.message ||
                "Cloudinary rejected the upload";

            const cloudinaryStatus =
                error?.http_code;

            console.error(
                "Resume upload failed:",
                {
                    message: errorMessage,
                    http_code: cloudinaryStatus,
                    name: error?.name,
                }
            );

            return res.status(
                cloudinaryStatus === 403
                    ? 502
                    : 500
            ).json({
                message:
                    cloudinaryStatus === 403
                        ? "Cloudinary rejected this upload. Check the Cloudinary account and API key permissions."
                        : "Failed to upload resume",
                error: errorMessage,
                cloudinaryStatus,
            });
        }
    }
);

router.get(
    "/extract",
    authenticateToken,
    async (req: AuthRequest, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    message: "Authentication required",
                });
            }

            const result = await pool.query(
                `
                SELECT resume_url
                FROM user_profiles
                WHERE id = $1
                `,
                [req.user.userId]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    message: "User profile not found",
                });
            }

            const resumeUrl = result.rows[0].resume_url;

            if (!resumeUrl) {
                return res.status(404).json({
                    message: "No resume uploaded",
                });
            }

            const extractedData =
                await extractResumeData(resumeUrl);

            return res.status(200).json({
                message: "Resume extracted successfully",
                data: extractedData,
            });
        } catch (error) {
            console.error(
                "Resume extraction failed:",
                error
            );

            return res.status(500).json({
                message: "Failed to extract resume",
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            });
        }
    }
);

export default router;