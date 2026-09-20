import pool from "../config/db";
import { NormalizedJob } from "../collectors/types";
import { extractJobSkills, saveJobSkills } from "./skillService";

interface SaveJobResult {
    id: number;
    isNew: boolean;
}

export interface JobFilters {
    search?: string;
    location?: string;
    company?: string;
    workplace?: string;
    employmentType?: string;
    experienceMax?: number;
    country?: string;
    page?: number;
    limit?: number;
    sort?: string;
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
                workplace_type = $7,
                experience_min = $8,
                experience_max = $9,
                posted_at = $10,
                updated_at = $11,
                application_url = $12,
                last_seen_at = CURRENT_TIMESTAMP,
                closed_at = NULL
             WHERE id = $13`,
            [
                companyId,
                job.title,
                job.description,
                job.location,
                job.country,
                job.employmentType,
                job.workplaceType,
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
            workplace_type,
            experience_min,
            experience_max,
            posted_at,
            updated_at,
            application_url
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14
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
            job.workplaceType,
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

export async function markMissingJobsAsClosed(
    companyId: number,
    collectionStartedAt: Date
): Promise<number> {
    const result = await pool.query(
        `UPDATE jobs
         SET closed_at = CURRENT_TIMESTAMP
         WHERE company_id = $1
         AND last_seen_at < $2
         AND closed_at IS NULL`,
        [
            companyId,
            collectionStartedAt,
        ]
    );

    return result.rowCount ?? 0;
}

/**
 * Fetch jobs with filters, pagination and sorting.
 */
export async function getJobs(filters: JobFilters) {
    const {
        search,
        location,
        company,
        workplace,
        employmentType,
        experienceMax,
        country,
        page = 1,
        limit = 20,
        sort = "latest",
    } = filters;

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const offset = (safePage - 1) * safeLimit;

    const conditions: string[] = [
        "j.closed_at IS NULL",
    ];

    const values: unknown[] = [];
    let parameterIndex = 1;

    // Search title + description
    if (search) {
        conditions.push(
            `(j.title ILIKE $${parameterIndex}
              OR j.description ILIKE $${parameterIndex})`
        );

        values.push(`%${search}%`);
        parameterIndex++;
    }

    // Location
    if (location) {
        conditions.push(
            `j.location ILIKE $${parameterIndex}`
        );

        values.push(`%${location}%`);
        parameterIndex++;
    }

    // Company
    if (company) {
        conditions.push(
            `c.name ILIKE $${parameterIndex}`
        );

        values.push(`%${company}%`);
        parameterIndex++;
    }

    // Workplace
    if (workplace) {
        conditions.push(
            `j.workplace_type ILIKE $${parameterIndex}`
        );

        values.push(`%${workplace}%`);
        parameterIndex++;
    }

    // Employment type
    if (employmentType) {
        conditions.push(
            `j.employment_type ILIKE $${parameterIndex}`
        );

        values.push(`%${employmentType}%`);
        parameterIndex++;
    }

    // Country
    if (country) {
        conditions.push(
            `(j.country ILIKE $${parameterIndex}
              OR j.location ILIKE $${parameterIndex})`
        );

        values.push(`%${country}%`);
        parameterIndex++;
    }

    // Experience:
    // A job with no stated minimum is also allowed.
    // Otherwise minimum experience must be <= requested maximum.
    if (experienceMax !== undefined) {
        conditions.push(
            `(j.experience_min IS NULL
              OR j.experience_min <= $${parameterIndex})`
        );

        values.push(experienceMax);
        parameterIndex++;
    }

    const whereClause = conditions.join(" AND ");

    let orderBy = "j.first_seen_at DESC";

    switch (sort) {
        case "oldest":
            orderBy = "j.first_seen_at ASC";
            break;

        case "updated":
            orderBy = "j.last_seen_at DESC";
            break;

        case "title":
            orderBy = "j.title ASC";
            break;

        case "latest":
        default:
            orderBy = "j.first_seen_at DESC";
            break;
    }

    // Count total matching jobs
    const countResult = await pool.query(
        `SELECT COUNT(*) AS total
         FROM jobs j
         JOIN companies c ON j.company_id = c.id
         WHERE ${whereClause}`,
        values
    );

    const total = Number(countResult.rows[0].total);

    // Fetch current page
    const jobsResult = await pool.query(
        `SELECT
            j.id,
            j.company_id,
            c.name AS company_name,
            j.source,
            j.source_job_id,
            j.title,
            j.description,
            j.location,
            j.country,
            j.employment_type,
            j.workplace_type,
            j.experience_min,
            j.experience_max,
            j.posted_at,
            j.updated_at,
            j.first_seen_at,
            j.last_seen_at,
            j.application_url
         FROM jobs j
         JOIN companies c ON j.company_id = c.id
         WHERE ${whereClause}
         ORDER BY ${orderBy}
         LIMIT $${parameterIndex}
         OFFSET $${parameterIndex + 1}`,
        [...values, safeLimit, offset]
    );

    return {
        jobs: jobsResult.rows,
        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit),
            hasNextPage: safePage * safeLimit < total,
            hasPreviousPage: safePage > 1,
        },
    };
}

/**
 * Fetch one job by ID.
 */
export async function getJobById(jobId: number) {
    const result = await pool.query(
        `SELECT
            j.id,
            j.company_id,
            c.name AS company_name,
            c.website AS company_website,
            c.careers_url AS company_careers_url,
            j.source,
            j.source_job_id,
            j.title,
            j.description,
            j.location,
            j.country,
            j.employment_type,
            j.workplace_type,
            j.experience_min,
            j.experience_max,
            j.posted_at,
            j.updated_at,
            j.first_seen_at,
            j.last_seen_at,
            j.application_url
         FROM jobs j
         JOIN companies c ON j.company_id = c.id
         WHERE j.id = $1
         AND j.closed_at IS NULL`,
        [jobId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}