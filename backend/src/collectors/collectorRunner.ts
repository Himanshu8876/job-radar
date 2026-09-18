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

    const jobs = await collector.collectJobs();

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

    const closedJobs =
        await markMissingJobsAsClosed(
            companyId,
            collectionStartedAt
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
        `Jobs marked as closed: ${closedJobs}`
    );

    return {
        totalJobs: jobs.length,
        newJobs,
        updatedJobs,
        closedJobs
    };
}