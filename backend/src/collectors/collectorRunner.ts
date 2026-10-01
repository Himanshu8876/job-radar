import { JobCollector } from "./jobCollector";
import {
    saveJob,
    markMissingJobsAsClosed
} from "../services/jobService";

export async function runCollector(
    companyId: number,
    collector: JobCollector
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

    let newJobs = 0;
    let updatedJobs = 0;

    for (const job of jobs) {
        const result = await saveJob(
            companyId,
            job
        );

        if (result.isNew) {
            newJobs++;
        } else {
            updatedJobs++;
        }
    }

    const closedJobs = snapshotComplete
        ? await markMissingJobsAsClosed(
            companyId,
            collectionStartedAt
        )
        : 0;

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
        totalJobs: jobs.length,
        newJobs,
        updatedJobs,
        closedJobs
    };
}