import pool from "../config/db";
import { NormalizedJob } from "../collectors/types";
import {
    bulkSaveJobSkills,
    extractJobSkills,
    getAllSkills,
    saveJobSkills,
} from "./skillService";

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
    scope?: "india" | "international";
    page?: number;
    limit?: number;
    sort?: string;
    userProfileId?: number;
}

/**
 * Save or update a job.
 */
export async function saveJob(
    companyId: number,
    job: NormalizedJob
): Promise<SaveJobResult> {

    const existingJob = await pool.query(
        `SELECT id
         FROM jobs
         WHERE source = $1
         AND source_job_id = $2`,
        [
            job.source,
            job.sourceJobId,
        ]
    );

    // ==========================================
    // EXISTING JOB
    // ==========================================

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

        const skills = await extractJobSkills(
            job.description
        );

        await saveJobSkills(
            jobId,
            skills
        );

        return {
            id: jobId,
            isNew: false,
        };
    }

    // ==========================================
    // NEW JOB
    // ==========================================

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

    const skills = await extractJobSkills(
        job.description
    );

    await saveJobSkills(
        jobId,
        skills
    );

    return {
        id: jobId,
        isNew: true,
    };
}

interface BulkSaveJobsResult {
    totalJobs: number;
    newJobs: number;
    updatedJobs: number;
}

const BULK_JOB_CHUNK_SIZE = 100;

function getJobKey(source: string, sourceJobId: string): string {
    return JSON.stringify([source, sourceJobId]);
}

export async function bulkSaveJobs(
    companyId: number,
    jobs: NormalizedJob[]
): Promise<BulkSaveJobsResult> {
    const deduplicatedJobs = new Map<string, NormalizedJob>();
    for (const job of jobs) {
        deduplicatedJobs.set(
            getJobKey(job.source, job.sourceJobId),
            job
        );
    }

    const uniqueJobs = [...deduplicatedJobs.values()];
    if (uniqueJobs.length === 0) {
        return {
            totalJobs: 0,
            newJobs: 0,
            updatedJobs: 0,
        };
    }

    const allSkills = await getAllSkills();
    const extractedSkills = await Promise.all(
        uniqueJobs.map(async (job) => ({
            job,
            skills: await extractJobSkills(
                job.description,
                allSkills
            ),
        }))
    );

    const existingResult = await pool.query<{
        source: string;
        source_job_id: string;
    }>(
        `SELECT source, source_job_id
         FROM jobs
         WHERE (source, source_job_id) IN (
            SELECT incoming.source, incoming.source_job_id
            FROM UNNEST($1::text[], $2::text[])
                AS incoming(source, source_job_id)
         )`,
        [
            uniqueJobs.map((job) => job.source),
            uniqueJobs.map((job) => job.sourceJobId),
        ]
    );
    const existingKeys = new Set(
        existingResult.rows.map((row) =>
            getJobKey(row.source, row.source_job_id)
        )
    );

    let newJobs = 0;
    let updatedJobs = 0;

    for (
        let offset = 0;
        offset < extractedSkills.length;
        offset += BULK_JOB_CHUNK_SIZE
    ) {
        const chunk = extractedSkills.slice(
            offset,
            offset + BULK_JOB_CHUNK_SIZE
        );
        const client = await pool.connect();
        let releaseError: Error | undefined;

        try {
            await client.query("BEGIN");

            const values: unknown[] = [];
            const valueRows = chunk.map(({ job }, index) => {
                const parameterIndex = index * 14;
                values.push(
                    companyId,
                    job.source,
                    job.sourceJobId,
                    job.title,
                    job.description,
                    job.location ?? null,
                    job.country ?? null,
                    job.employmentType ?? null,
                    job.workplaceType ?? null,
                    job.experienceMin ?? null,
                    job.experienceMax ?? null,
                    job.postedAt ?? null,
                    job.updatedAt ?? null,
                    job.applicationUrl
                );
                return `(${Array.from(
                    { length: 14 },
                    (_, valueIndex) =>
                        `$${parameterIndex + valueIndex + 1}`
                ).join(", ")}, CURRENT_TIMESTAMP, NULL)`;
            });

            const upsertResult = await client.query(
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
                    application_url,
                    last_seen_at,
                    closed_at
                )
                VALUES ${valueRows.join(", ")}
                ON CONFLICT (source, source_job_id)
                DO UPDATE SET
                    company_id = EXCLUDED.company_id,
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    location = EXCLUDED.location,
                    country = EXCLUDED.country,
                    employment_type = EXCLUDED.employment_type,
                    workplace_type = EXCLUDED.workplace_type,
                    experience_min = EXCLUDED.experience_min,
                    experience_max = EXCLUDED.experience_max,
                    posted_at = EXCLUDED.posted_at,
                    updated_at = EXCLUDED.updated_at,
                    application_url = EXCLUDED.application_url,
                    last_seen_at = CURRENT_TIMESTAMP,
                    closed_at = NULL
                RETURNING id, source, source_job_id`,
                values
            );

            const chunkNewJobs = chunk.filter(
                ({ job }) =>
                    !existingKeys.has(
                        getJobKey(job.source, job.sourceJobId)
                    )
            ).length;
            const chunkUpdatedJobs =
                chunk.length - chunkNewJobs;

            const skillsByJobKey = new Map(
                chunk.map(({ job, skills }) => [
                    getJobKey(job.source, job.sourceJobId),
                    skills,
                ])
            );
            await bulkSaveJobSkills(
                client,
                upsertResult.rows.map((row) => ({
                    jobId: row.id,
                    skills: skillsByJobKey.get(
                        getJobKey(row.source, row.source_job_id)
                    )!,
                }))
            );

            await client.query("COMMIT");
            newJobs += chunkNewJobs;
            updatedJobs += chunkUpdatedJobs;
        } catch (error) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Failed to roll back bulk job save transaction.",
                    rollbackError
                );
                releaseError = rollbackError instanceof Error
                    ? rollbackError
                    : new Error(String(rollbackError));
            }
            throw error;
        } finally {
            client.release(releaseError);
        }
    }

    return {
        totalJobs: uniqueJobs.length,
        newJobs,
        updatedJobs,
    };
}


/**
 * Mark jobs as closed if they were not
 * returned during the latest collection.
 */
export async function markMissingJobsAsClosed(
    companyId: number,
    collectionStartedAt: Date
): Promise<number> {

    const closureCandidates = await pool.query(
        `SELECT
            COUNT(*) AS candidate_count,
            ($2::timestamptz AT TIME ZONE 'UTC') AS cutoff
         FROM jobs
         WHERE company_id = $1
         AND last_seen_at < ($2::timestamptz AT TIME ZONE 'UTC')
         AND closed_at IS NULL`,
        [
            companyId,
            collectionStartedAt,
        ]
    );

    console.log(
        `[JOB CLOSURE DEBUG]\ncompanyId: ${companyId}\ncollectionStartedAt received: ${collectionStartedAt.toISOString()}\ncandidate jobs for closure: ${closureCandidates.rows[0].candidate_count}\ncutoff selected: ${new Date(closureCandidates.rows[0].cutoff).toISOString()}`
    );

    const jobTimestampStats = await pool.query(
        `SELECT
            COUNT(*) AS total,
            MIN(last_seen_at) AS min_last_seen,
            MAX(last_seen_at) AS max_last_seen,
            MIN(closed_at) AS min_closed_at,
            MAX(closed_at) AS max_closed_at
         FROM jobs
         WHERE company_id = $1`,
        [companyId]
    );

    const preUpdateCandidateCount = await pool.query(
        `SELECT COUNT(*) AS candidate_count
         FROM jobs
         WHERE company_id = $1
         AND last_seen_at < ($2::timestamptz AT TIME ZONE 'UTC')
         AND closed_at IS NULL`,
        [
            companyId,
            collectionStartedAt,
        ]
    );

    const databaseClocks = await pool.query(
        `SELECT
            CURRENT_TIMESTAMP AS current_timestamp,
            clock_timestamp() AS clock_timestamp`
    );

    console.log(
        `[JOB CLOSURE DEBUG]\nUPDATE cutoff: ${collectionStartedAt.toISOString()}\ncompanyId: ${companyId}\ncollectionStartedAt: ${collectionStartedAt.toISOString()}\ncurrent timestamp: ${new Date(databaseClocks.rows[0].current_timestamp).toISOString()}\nclock timestamp: ${new Date(databaseClocks.rows[0].clock_timestamp).toISOString()}`
    );

    console.log(
        `[JOB CLOSURE DEBUG]\ncompanyId: ${companyId}\nlast_seen_at stats: ${JSON.stringify(jobTimestampStats.rows[0])}\npre-UPDATE candidate count: ${preUpdateCandidateCount.rows[0].candidate_count}`
    );

    const result = await pool.query(
        `UPDATE jobs
         SET closed_at = CURRENT_TIMESTAMP
         WHERE company_id = $1
         AND last_seen_at < ($2::timestamptz AT TIME ZONE 'UTC')
         AND closed_at IS NULL`,
        [
            companyId,
            collectionStartedAt,
        ]
    );

    console.log(
        `[JOB CLOSURE DEBUG]\nUPDATE rowCount: ${result.rowCount}\nUPDATE command: ${result.command}`
    );

    const postUpdateCounts = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE closed_at IS NULL) AS active_jobs,
            COUNT(*) FILTER (WHERE closed_at IS NOT NULL) AS closed_jobs,
            COUNT(*) FILTER (
                WHERE last_seen_at < ($2::timestamptz AT TIME ZONE 'UTC')
                AND closed_at IS NULL
            ) AS remaining_candidates
         FROM jobs
         WHERE company_id = $1`,
        [
            companyId,
            collectionStartedAt,
        ]
    );

    console.log(
        `[JOB CLOSURE DEBUG]\nPost-UPDATE counts: ${JSON.stringify(postUpdateCounts.rows[0])}`
    );

    return result.rowCount ?? 0;
}


/**
 * Fetch jobs with:
 * - Search
 * - Location
 * - Company
 * - Workplace
 * - Employment type
 * - Country
 * - Experience
 * - Pagination
 * - Sorting
 */
export async function getJobs(
    filters: JobFilters
) {
    const {
        search,
        location,
        company,
        workplace,
        employmentType,
        experienceMax,
        country,
        scope,
        page = 1,
        limit = 20,
        sort = "latest",
        userProfileId,
    } = filters;

    // ==========================================
    // PAGINATION SAFETY
    // ==========================================

    const safePage = Math.max(1, page);

    const safeLimit = Math.min(
        Math.max(1, limit),
        100
    );

    const offset =
        (safePage - 1) * safeLimit;


    // ==========================================
    // CONDITIONS
    // ==========================================

    const conditions: string[] = [
        "j.closed_at IS NULL",
    ];

    const values: unknown[] = [];

    let parameterIndex = 1;

    if (userProfileId !== undefined) {
    conditions.push(
        `NOT EXISTS (
            SELECT 1
            FROM applications a
            WHERE a.job_id = j.id
              AND a.user_profile_id = $${parameterIndex}
        )`
    );

    values.push(userProfileId);
    parameterIndex++;
}
    // ==========================================
    // SEARCH
    // ==========================================

    if (search?.trim()) {

        conditions.push(
            `(j.title ILIKE $${parameterIndex}
              OR j.description ILIKE $${parameterIndex}
              OR c.name ILIKE $${parameterIndex})`
        );

        values.push(
            `%${search.trim()}%`
        );

        parameterIndex++;
    }


    // ==========================================
    // LOCATION
    // ==========================================

    if (location?.trim()) {

        conditions.push(
            `j.location ILIKE $${parameterIndex}`
        );

        values.push(
            `%${location.trim()}%`
        );

        parameterIndex++;
    }


    // ==========================================
    // COMPANY
    // ==========================================

    if (company?.trim()) {

        conditions.push(
            `c.name ILIKE $${parameterIndex}`
        );

        values.push(
            `%${company.trim()}%`
        );

        parameterIndex++;
    }


    // ==========================================
    // WORKPLACE
    // ==========================================

    if (workplace?.trim()) {

        conditions.push(
            `j.workplace_type ILIKE $${parameterIndex}`
        );

        values.push(
            `%${workplace.trim()}%`
        );

        parameterIndex++;
    }


    // ==========================================
    // EMPLOYMENT TYPE
    // ==========================================

    if (employmentType?.trim()) {

        conditions.push(
            `j.employment_type ILIKE $${parameterIndex}`
        );

        values.push(
            `%${employmentType.trim()}%`
        );

        parameterIndex++;
    }


    // ==========================================
    // COUNTRY
    // ==========================================

    if (country?.trim()) {

        conditions.push(
            `(j.country ILIKE $${parameterIndex}
              OR j.location ILIKE $${parameterIndex})`
        );

        values.push(
            `%${country.trim()}%`
        );

        parameterIndex++;
    }


    // ==========================================
    // JOB SCOPE
    // ==========================================

    if (scope === "india") {

        conditions.push(
            `(
                LOWER(COALESCE(j.country, '')) IN ('in', 'india')
                OR LOWER(COALESCE(j.location, '')) LIKE '%india%'
            )`
        );

    } else if (scope === "international") {

        conditions.push(
            `(
                LOWER(COALESCE(j.country, '')) NOT IN ('in', 'india')
                AND LOWER(COALESCE(j.location, '')) NOT LIKE '%india%'
            )`
        );

    }


    // ==========================================
    // EXPERIENCE
    // ==========================================

    if (
        experienceMax !== undefined &&
        !Number.isNaN(experienceMax)
    ) {

        conditions.push(
            `(j.experience_min IS NOT NULL
              AND j.experience_min <= $${parameterIndex}
              AND (
                  j.experience_max IS NULL
                  OR j.experience_max <= $${parameterIndex}
              ))`
        );

        values.push(
            experienceMax
        );

        parameterIndex++;
    }


    // ==========================================
    // WHERE CLAUSE
    // ==========================================

    const whereClause =
        conditions.join(" AND ");


    // ==========================================
    // SORTING
    // ==========================================

    let orderBy =
        "j.first_seen_at DESC";

    switch (sort) {

        case "oldest":

            orderBy =
                "j.first_seen_at ASC";

            break;

        case "updated":

            orderBy =
                "j.last_seen_at DESC";

            break;

        case "title":

            orderBy =
                "j.title ASC";

            break;

        case "latest":

        default:

            orderBy =
                "j.first_seen_at DESC";

            break;
    }


    // ==========================================
    // COUNT
    // ==========================================

    const countResult =
        await pool.query(
            `SELECT COUNT(*) AS total
             FROM jobs j
             JOIN companies c
               ON j.company_id = c.id
             WHERE ${whereClause}`,
            values
        );

    const total =
        Number(
            countResult.rows[0].total
        );


    // ==========================================
    // FETCH JOBS
    // ==========================================

    const jobsResult =
        await pool.query(
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
             JOIN companies c
               ON j.company_id = c.id
             WHERE ${whereClause}
             ORDER BY ${orderBy}
             LIMIT $${parameterIndex}
             OFFSET $${parameterIndex + 1}`,
            [
                ...values,
                safeLimit,
                offset,
            ]
        );


    // ==========================================
    // RESPONSE
    // ==========================================

    return {

        jobs:
            jobsResult.rows,

        pagination: {

            page:
                safePage,

            limit:
                safeLimit,

            total,

            totalPages:
                Math.ceil(
                    total / safeLimit
                ),

            hasNextPage:
                safePage * safeLimit < total,

            hasPreviousPage:
                safePage > 1,
        },
    };
}


/**
 * Fetch one job by ID.
 */
export async function getJobById(
    jobId: number
) {

    const result =
        await pool.query(
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
             JOIN companies c
               ON j.company_id = c.id
             WHERE j.id = $1
             AND j.closed_at IS NULL`,
            [
                jobId,
            ]
        );


    if (
        result.rows.length === 0
    ) {
        return null;
    }


    return result.rows[0];
}