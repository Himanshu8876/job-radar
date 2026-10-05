import { JobCollector } from "./jobCollector";
import {
    bulkSaveJobs,
    markMissingJobsAsClosed
} from "../services/jobService";

export async function runCollector(
    companyId: number,
    collector: JobCollector,
    companyName = String(companyId)
): Promise<{
    totalJobs: number;
    newJobs: number;
    updatedJobs: number;
    closedJobs: number;
}> {
    const collectionStartedAt = new Date();

    let collectionResult;

    try {
        collectionResult = await collector.collectJobs();
    } catch (error) {
        console.error(
            "Collection failed. Skipping job closure.",
            error
        );
        throw error;
    }

    const jobs = collectionResult.jobs;
    const snapshotComplete =
        collectionResult.isComplete === true;

    if (!snapshotComplete) {
        console.log(
            `Collector returned for company ${companyName}.\nSnapshot complete: false\nJob closure: SKIPPED`
        );

        if (jobs.length === 0) {
            console.log(
                `✅ runCollector RESOLVING for company: ${companyName}`
            );
            return {
                totalJobs: 0,
                newJobs: 0,
                updatedJobs: 0,
                closedJobs: 0
            };
        }
    }

    const saveStartedAt = Date.now();
    console.log(
        `[PERF DEBUG] Starting bulk save of ${jobs.length} jobs`
    );

    const saveResult = await bulkSaveJobs(companyId, jobs);
    const newJobs = saveResult.newJobs;
    const updatedJobs = saveResult.updatedJobs;
    const elapsedSeconds =
        ((Date.now() - saveStartedAt) / 1000).toFixed(1);
    console.log(
        `[PERF DEBUG] Bulk save completed in ${elapsedSeconds} seconds`
    );

    let closedJobs = 0;
    if (snapshotComplete) {
        console.log(
            `[JOB CLOSURE DEBUG]\nCompany: ${companyName}\nCompany ID: ${companyId}\ncollectionStartedAt: ${collectionStartedAt.toISOString()}\njobs fetched: ${jobs.length}\nsnapshotComplete: ${snapshotComplete}`
        );
        console.log(
            `[PERF DEBUG] Before markMissingJobsAsClosed for ${companyName}`
        );
        closedJobs = await markMissingJobsAsClosed(
            companyId,
            collectionStartedAt
        );
        console.log(
            `[PERF DEBUG] After markMissingJobsAsClosed for ${companyName}`
        );
    }

    console.log(
        snapshotComplete
            ? "Collection completed successfully."
            : "Collection incomplete."
    );

    console.log(
        `Total jobs fetched: ${jobs.length}`
    );

    console.log(
        `New jobs saved: ${newJobs}`
    );

    console.log(
        `Existing jobs updated: ${updatedJobs}`
    );

    console.log(
        `Snapshot complete: ${snapshotComplete}`
    );

    if (!snapshotComplete) {
        console.log(
            "Skipping job closure to protect existing jobs."
        );
    }

    console.log(
        `Jobs marked as closed: ${closedJobs}`
    );

    return {
        totalJobs: saveResult.totalJobs,
        newJobs,
        updatedJobs,
        closedJobs
    };
}