import { randomUUID } from "crypto";
import { PoolClient } from "pg";
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
    | "Skills"
    | "Experience";

interface ClaimedMatchGenerationJob {
    id: string;
    user_profile_id: number;
    worker_token: string;
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
            up.experience_years IS NOT NULL AS has_experience,
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

    if (!profile.has_experience) {
        missingFields.push("Experience");
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
             worker_token = NULL,
             started_at = NULL,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE status = 'running'
           AND updated_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'`
    );

    const recoveredCount = result.rowCount ?? 0;
    if (recoveredCount > 0) {
        console.warn(
            `Requeued ${recoveredCount} stale match-generation job(s)`
        );
    }

    return recoveredCount;
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
    job: ClaimedMatchGenerationJob,
    onLeaseLost?: () => void
): Promise<void> {
    const startedAt = Date.now();
    console.info(
        `Match-generation job ${job.id} started for profile ${job.user_profile_id}`
    );
    let stopped = false;
    let heartbeatTimer: NodeJS.Timeout | undefined;
    let ownershipError: Error | null = null;
    let ownershipLossNotified = false;

    const recordLeaseLoss = (): void => {
        if (!ownershipError) {
            ownershipError = new Error(
                `Match-generation job ${job.id} lease was lost`
            );
            console.error(ownershipError.message);
        }

        if (!ownershipLossNotified) {
            ownershipLossNotified = true;
            onLeaseLost?.();
        }
    };

    const renewLease = async (client?: PoolClient): Promise<void> => {
        try {
            const queryable = client ?? pool;
            const result = await queryable.query(
                `UPDATE match_generation_jobs
                 SET updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                   AND status = 'running'
                   AND worker_token = $2
                 RETURNING id`,
                [job.id, job.worker_token]
            );

            if (result.rowCount === 0 && !stopped) {
                recordLeaseLoss();
            }
        } catch (error) {
            if (!stopped) {
                ownershipError = error instanceof Error
                    ? error
                    : new Error(String(error));
                console.error(
                    `Match-generation heartbeat failed for job ${job.id}:`,
                    error
                );
            }
        }
    };

    const scheduleHeartbeat = (): void => {
        heartbeatTimer = setTimeout(() => {
            void renewLease().finally(() => {
                if (!stopped) {
                    scheduleHeartbeat();
                }
            });
        }, JOB_HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = (): void => {
        stopped = true;
        if (heartbeatTimer) {
            clearTimeout(heartbeatTimer);
        }
    };

    const ensureOwnership = async (client?: PoolClient): Promise<void> => {
        if (ownershipError) {
            throw ownershipError;
        }

        await renewLease(client);
        if (ownershipError) {
            throw ownershipError;
        }
    };

    scheduleHeartbeat();

    try {
        await generateMatchesForUser(
            Number(job.user_profile_id),
            ensureOwnership
        );
        await ensureOwnership();
        stopHeartbeat();

        const result = await pool.query(
            `UPDATE match_generation_jobs
             SET status = 'completed',
                 worker_token = NULL,
                 error_message = NULL,
                 completed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
               AND status = 'running'
               AND worker_token = $2
             RETURNING id`,
            [job.id, job.worker_token]
        );
        if (result.rowCount === 0) {
            recordLeaseLoss();
            console.warn(
                `Match-generation job ${job.id} completion skipped because its lease was lost`
            );
        } else {
            console.info(
                `Match-generation job ${job.id} completed for profile ` +
                `${job.user_profile_id} in ${Date.now() - startedAt}ms`
            );
        }
    } catch (error) {
        stopHeartbeat();
        console.error(
            `Match-generation job ${job.id} for profile ${job.user_profile_id} ` +
            `failed after ${Date.now() - startedAt}ms:`,
            error
        );

        try {
            const result = await pool.query(
                `UPDATE match_generation_jobs
                 SET status = 'failed',
                     worker_token = NULL,
                     error_message = 'Match generation failed. Please try again.',
                     completed_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                   AND status = 'running'
                   AND worker_token = $2
                 RETURNING id`,
                [job.id, job.worker_token]
            );
            if (result.rowCount === 0) {
                console.warn(
                    `Match-generation job ${job.id} failure status skipped because its lease was lost`
                );
            }
        } catch (statusError) {
            console.error(
                `Could not mark match-generation job ${job.id} as failed:`,
                statusError
            );
        }
    } finally {
        stopHeartbeat();
    }
}

export async function processMatchGenerationJob(
    jobId: string
): Promise<boolean> {
    if (matchGenerationWorker?.stopping) {
        return false;
    }

    const processingTask = claimAndProcessMatchGenerationJob(jobId);
    activeProcessTasks.add(processingTask);
    void processingTask.then(
        () => activeProcessTasks.delete(processingTask),
        () => activeProcessTasks.delete(processingTask)
    );
    return processingTask;
}

async function claimAndProcessMatchGenerationJob(
    jobId: string
): Promise<boolean> {
    const result = await pool.query<ClaimedMatchGenerationJob>(
        `UPDATE match_generation_jobs
         SET status = 'running',
             worker_token = $2,
             started_at = CURRENT_TIMESTAMP,
             completed_at = NULL,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'queued'
         RETURNING id, user_profile_id, worker_token`,
        [jobId, randomUUID()]
    );

    const claimedJob = result.rows[0];

    if (!claimedJob) {
        return false;
    }

    await trackClaimedJob(claimedJob);
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
             worker_token = $1,
             started_at = CURRENT_TIMESTAMP,
             completed_at = NULL,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         FROM next_job
         WHERE job.id = next_job.id
           AND job.status = 'queued'
         RETURNING job.id, job.user_profile_id, job.worker_token`,
        [randomUUID()]
    );

    return result.rows[0] ?? null;
}

interface MatchGenerationWorker {
    stopping: boolean;
    timer: NodeJS.Timeout | null;
    cyclePromise: Promise<void> | null;
    activeJobPromise: Promise<void> | null;
    stopPromise: Promise<void> | null;
    stop: () => Promise<void>;
}

let matchGenerationWorker: MatchGenerationWorker | null = null;
let activeWorkerToken: string | null = null;
const activeJobRuns = new Set<Promise<void>>();
const activeProcessTasks = new Set<Promise<boolean>>();

function trackClaimedJob(
    job: ClaimedMatchGenerationJob,
    onLeaseLost?: () => void
): Promise<void> {
    const run = executeClaimedJob(job, onLeaseLost);
    activeJobRuns.add(run);
    void run.then(
        () => activeJobRuns.delete(run),
        () => activeJobRuns.delete(run)
    );
    return run;
}

async function waitForActiveMatchGenerationWork(): Promise<void> {
    while (activeProcessTasks.size > 0 || activeJobRuns.size > 0) {
        await Promise.allSettled([
            ...activeProcessTasks,
            ...activeJobRuns,
        ]);
    }
}

async function runMatchGenerationWorkerCycle(
    worker: MatchGenerationWorker
): Promise<void> {
    if (worker.stopping) {
        return;
    }

    const cycle = (async (): Promise<void> => {
        try {
            await recoverStaleMatchGenerationJobs();

            if (!worker.stopping && activeWorkerToken === null) {
                const job = await claimNextQueuedJob();
                if (job) {
                    activeWorkerToken = job.worker_token;
                    const jobRun = trackClaimedJob(job, () => {
                        if (activeWorkerToken === job.worker_token) {
                            activeWorkerToken = null;
                        }
                    });
                    worker.activeJobPromise = jobRun;
                    void jobRun.then(
                        () => {
                            if (worker.activeJobPromise === jobRun) {
                                worker.activeJobPromise = null;
                            }
                            if (activeWorkerToken === job.worker_token) {
                                activeWorkerToken = null;
                            }
                        },
                        (error) => {
                            console.error(
                                `Unexpected match-generation worker error for job ${job.id}:`,
                                error
                            );
                            if (worker.activeJobPromise === jobRun) {
                                worker.activeJobPromise = null;
                            }
                            if (activeWorkerToken === job.worker_token) {
                                activeWorkerToken = null;
                            }
                        }
                    );
                }
            }
        } catch (error) {
            console.error("Match-generation worker cycle failed:", error);
        } finally {
            if (!worker.stopping) {
                worker.timer = setTimeout(() => {
                    worker.timer = null;
                    void runMatchGenerationWorkerCycle(worker);
                }, WORKER_POLL_INTERVAL_MS);
            }
        }
    })();
    worker.cyclePromise = cycle;
    await cycle;
}

export function startMatchGenerationJobWorker(): () => Promise<void> {
    if (matchGenerationWorker) {
        if (matchGenerationWorker.stopping) {
            throw new Error(
                "Match-generation worker is stopping; wait for shutdown before restarting it"
            );
        }
        return matchGenerationWorker.stop;
    }

    let worker: MatchGenerationWorker;
    const stop = (): Promise<void> => {
        if (worker.stopPromise) {
            return worker.stopPromise;
        }

        worker.stopping = true;
        if (worker.timer) {
            clearTimeout(worker.timer);
            worker.timer = null;
        }

        worker.stopPromise = (async () => {
            if (worker.cyclePromise) {
                await worker.cyclePromise;
            }
            if (worker.activeJobPromise) {
                await worker.activeJobPromise;
            }
            await waitForActiveMatchGenerationWork();
            if (matchGenerationWorker === worker) {
                matchGenerationWorker = null;
            }
            console.info("Match-generation worker stopped cleanly");
        })();
        return worker.stopPromise;
    };

    worker = {
        stopping: false,
        timer: null,
        cyclePromise: null,
        activeJobPromise: null,
        stopPromise: null,
        stop,
    };
    matchGenerationWorker = worker;
    void runMatchGenerationWorkerCycle(worker);
    return stop;
}