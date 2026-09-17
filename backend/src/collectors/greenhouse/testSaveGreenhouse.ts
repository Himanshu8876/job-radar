import GreenhouseCollector from "./greenhouseCollector";
import {
    saveJob,
    markMissingJobsAsClosed
} from "../../services/jobService";
async function test() {
    const companyId = 2;

    const collector = new GreenhouseCollector("6sense");

    const collectionStartedAt = new Date();

    const jobs = await collector.collectJobs();

    let newJobs = 0;
    let updatedJobs = 0;

    for (const job of jobs) {
        const result = await saveJob(companyId, job);

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

    console.log(`Total jobs fetched: ${jobs.length}`);
    console.log(`New jobs saved: ${newJobs}`);
    console.log(`Existing jobs updated: ${updatedJobs}`);
    console.log(`Jobs marked as closed: ${closedJobs}`);
}

test();