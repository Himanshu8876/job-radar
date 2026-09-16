import pool from "../config/db";
import { NormalizedJob } from "../collectors/types";
import { extractJobSkills, saveJobSkills } from "./skillService";

interface SaveJobResult {
    id: number;
    isNew: boolean;
}

export async function saveJob(
    companyId: number,
    job: NormalizedJob
): Promise<SaveJobResult> {
    const existingJob = await pool.query(
        `SELECT id
         FROM jobs
         WHERE source = $1
         AND source_job_id = $2`,
        [job.source, job.sourceJobId]
    );

    // Job already exists
    if (existingJob.rows.length > 0) {
        const jobId = existingJob.rows[0].id;

        await pool.query(
            `UPDATE jobs
             SET
                company_id = $1,
                title = $2,
                description = $3,
                location = $4,
                country = $5,
                employment_type = $6,
                experience_min = $7,
                experience_max = $8,
                posted_at = $9,
                updated_at = $10,
                application_url = $11,
                last_seen_at = CURRENT_TIMESTAMP,
                closed_at = NULL
             WHERE id = $12`,
            [
                companyId,
                job.title,
                job.description,
                job.location,
                job.country,
                job.employmentType,
                job.experienceMin,
                job.experienceMax,
                job.postedAt,
                job.updatedAt,
                job.applicationUrl,
                jobId,
            ]
        );

        const skills = await extractJobSkills(job.description);

        await saveJobSkills(jobId, skills);

        return {
            id: jobId,
            isNew: false,
        };
    }

    // New job
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
        RETURNING id`,
        [
            companyId,
            job.source,
            job.sourceJobId,
            job.title,
            job.description,
            job.location,
            job.country,
            job.employmentType,
            job.experienceMin,
            job.experienceMax,
            job.postedAt,
            job.updatedAt,
            job.applicationUrl,
        ]
    );

    const jobId = result.rows[0].id;

    const skills = await extractJobSkills(job.description);

    await saveJobSkills(jobId, skills);

    return {
        id: jobId,
        isNew: true,
    };
}