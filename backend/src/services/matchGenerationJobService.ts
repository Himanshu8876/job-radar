import { randomUUID } from "crypto";
import pool from "../config/db";
import { generateMatchesForUser } from "./matchingService";

export type MatchGenerationJobStatus =
    | "queued"
    | "running"
    | "completed"
    | "failed";

export interface MatchGenerationJob {
    id: string;
    user_profile_id: number;
    status: MatchGenerationJobStatus;
    error_message: string | null;
    created_at: Date;
    started_at: Date | null;
    completed_at: Date | null;
    updated_at: Date;
}

export type MissingMatchProfileField =
    | "Preferred roles"
    | "Preferred locations"
    | "Skills";

interface ClaimedMatchGenerationJob {
    id: string;
    user_profile_id: number;
}

const WORKER_POLL_INTERVAL_MS = 2_000;
const JOB_HEARTBEAT_INTERVAL_MS = 60_000;

async function findActiveJob(
    userProfileId: number
): Promise<MatchGenerationJob | null> {
    const result = await pool.query<MatchGenerationJob>(
        `SELECT id, user_profile_id, status, error_message,
                created_at, started_at, completed_at, updated_at
         FROM match_generation_jobs
         WHERE user_profile_id = $1
           AND status IN ('queued', 'running')
         ORDER BY created_at DESC
         LIMIT 1`,
        [userProfileId]
    );

    return result.rows[0] ?? null;
}

export async function getMissingMatchProfileFields(
    userProfileId: number
): Promise<MissingMatchProfileField[] | null> {
    const result = await pool.query(
        `SELECT
            up.preferred_roles,
            up.preferred_locations,
            EXISTS (
                SELECT 1
                FROM user_profile_skills ups
                WHERE ups.user_profile_id = up.id
            ) AS has_skills
         FROM user_profiles up
         WHERE up.id = $1`,
        [userProfileId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const profile = result.rows[0];
    const missingFields: MissingMatchProfileField[] = [];
    const hasNonEmptyValue = (value: string | null) =>
        Boolean(value?.split(",").some((item) => item.trim().length > 0));

    if (!hasNonEmptyValue(profile.preferred_roles)) {
        missingFields.push("Preferred roles");
    }

    if (!hasNonEmptyValue(profile.preferred_locations)) {
        missingFields.push("Preferred locations");
    }

    if (!profile.has_skills) {
        missingFields.push("Skills");
    }

    return missingFields;
}

export async function recoverStaleMatchGenerationJobs(): Promise<number> {
    const result = await pool.query(
        `UPDATE match_generation_jobs
         SET status = 'queued',
             started_at = NULL,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE status = 'running'
           AND updated_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'`
    );

    return result.rowCount ?? 0;
}

export async function createOrGetActiveMatchGenerationJob(
    userProfileId: number
): Promise<MatchGenerationJob | null> {
    const profileResult = await pool.query(
        `SELECT id FROM user_profiles WHERE id = $1`,
        [userProfileId]
    );

    if (profileResult.rows.length === 0) {
        return null;
    }

    await recoverStaleMatchGenerationJobs();

    for (let attempt = 0; attempt < 2; attempt++) {
        const activeJob = await findActiveJob(userProfileId);

        if (activeJob) {
            return activeJob;
        }

        try {
            const result = await pool.query<MatchGenerationJob>(
                `INSERT INTO match_generation_jobs (id, user_profile_id)
                 VALUES ($1, $2)
                 RETURNING id, user_profile_id, status, error_message,
                           created_at, started_at, completed_at, updated_at`,
                [randomUUID(), userProfileId]
            );

            return result.rows[0];
        } catch (error) {
            if ((error as { code?: string }).code !== "23505") {
                throw error;
            }
        }
    }

    return findActiveJob(userProfileId);
}

export async function getMatchGenerationJob(
    jobId: string,
    userProfileId: number
): Promise<MatchGenerationJob | null> {
    const result = await pool.query<MatchGenerationJob>(
        `SELECT id, user_profile_id, status, error_message,
                created_at, started_at, completed_at, updated_at
         FROM match_generation_jobs
         WHERE id = $1 AND user_profile_id = $2`,
        [jobId, userProfileId]
    );

    return result.rows[0] ?? null;
}

async function executeClaimedJob(
    job: ClaimedMatchGenerationJob
): Promise<void> {
    const heartbeat = setInterval(() => {
        void pool.query(
            `UPDATE match_generation_jobs
             SET updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'running'`,
            [job.id]
        ).catch((error) => {
            console.error(
                `Match-generation heartbeat failed for job ${job.id}:`,
                error
            );
        });
    }, JOB_HEARTBEAT_INTERVAL_MS);

    try {
        await generateMatchesForUser(Number(job.user_profile_id));

        await pool.query(
            `UPDATE match_generation_jobs
             SET status = 'completed',
                 error_message = NULL,
                 completed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'running'`,
            [job.id]
        );
    } catch (error) {
        console.error(`Match-generation job ${job.id} failed:`, error);

        try {
            await pool.query(
                `UPDATE match_generation_jobs
                 SET status = 'failed',
                     error_message = 'Match generation failed. Please try again.',
                     completed_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND status = 'running'`,
                [job.id]
            );
        } catch (statusError) {
            console.error(
                `Could not mark match-generation job ${job.id} as failed:`,
                statusError
            );
        }
    } finally {
        clearInterval(heartbeat);
    }
}

export async function processMatchGenerationJob(
    jobId: string
): Promise<boolean> {
    const result = await pool.query<ClaimedMatchGenerationJob>(
        `UPDATE match_generation_jobs
         SET status = 'running',
             started_at = CURRENT_TIMESTAMP,
             completed_at = NULL,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'queued'
         RETURNING id, user_profile_id`,
        [jobId]
    );

    const claimedJob = result.rows[0];

    if (!claimedJob) {
        return false;
    }

    await executeClaimedJob(claimedJob);
    return true;
}

async function claimNextQueuedJob(): Promise<ClaimedMatchGenerationJob | null> {
    const result = await pool.query<ClaimedMatchGenerationJob>(
        `WITH next_job AS (
            SELECT id
            FROM match_generation_jobs
            WHERE status = 'queued'
            ORDER BY created_at
            LIMIT 1
            FOR UPDATE SKIP LOCKED
         )
         UPDATE match_generation_jobs AS job
         SET status = 'running',
             started_at = CURRENT_TIMESTAMP,
             completed_at = NULL,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         FROM next_job
         WHERE job.id = next_job.id
           AND job.status = 'queued'
         RETURNING job.id, job.user_profile_id`
    );

    return result.rows[0] ?? null;
}

let workerStarted = false;

export function startMatchGenerationJobWorker(): void {
    if (workerStarted) {
        return;
    }

    workerStarted = true;

    const runWorkerCycle = async (): Promise<void> => {
        try {
            await recoverStaleMatchGenerationJobs();
            const job = await claimNextQueuedJob();

            if (job) {
                await executeClaimedJob(job);
                setImmediate(() => void runWorkerCycle());
                return;
            }
        } catch (error) {
            console.error("Match-generation worker cycle failed:", error);
        }

        setTimeout(
            () => void runWorkerCycle(),
            WORKER_POLL_INTERVAL_MS
        );
    };

    void runWorkerCycle();
}