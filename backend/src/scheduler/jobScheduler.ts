import cron = require("node-cron");
import { runAllCollectors } from "../collectors/collectorService";
import {
    generateMatchesForUser,
    getMatchesForUser,
    getUsersForMatching,
    markJobsAsEmailed,
} from "../services/matchingService";
import { sendEmail } from "../services/emailService";

export async function runDailyMatching(): Promise<void> {
    const users = await getUsersForMatching();

    for (const user of users) {
        const matchResult = await generateMatchesForUser(user.id);
        const matches = await getMatchesForUser(user.id);
        const newMatches = matches.jobs.filter((job) => job.is_new);

        if (newMatches.length > 0) {
            await sendEmail(
                user.email,
                `Job Radar - ${newMatches.length} new matching jobs`,
                `
                    <h1>Daily Job Radar</h1>

                    <p>
                        You have
                        <strong>${newMatches.length}</strong>
                        new matching jobs today.
                    </p>

                    ${newMatches.map((job) => `
                        <div style="
                            border: 1px solid #ddd;
                            padding: 16px;
                            margin: 16px 0;
                            border-radius: 8px;
                        ">
                            <h2>${job.title}</h2>

                            <p>
                                <strong>Company:</strong>
                                ${job.company_name}
                            </p>

                            <p>
                                <strong>Location:</strong>
                                ${job.location || "Not specified"}
                            </p>

                            <p>
                                <strong>Workplace:</strong>
                                ${job.workplace_type || "Not specified"}
                            </p>

                            <p>
                                <strong>Match Score:</strong>
                                ${job.score}
                            </p>

                            <a
                                href="${job.application_url}"
                                target="_blank"
                                style="
                                    display: inline-block;
                                    padding: 10px 16px;
                                    background: #000;
                                    color: #fff;
                                    text-decoration: none;
                                    border-radius: 6px;
                                "
                            >
                                Apply Now
                            </a>
                        </div>
                    `).join("")}
                `
            );

            await markJobsAsEmailed(
                newMatches.map((job) => Number(job.job_id)),
                user.id
            );
        }

        console.log(`Daily matches generated for user ${user.id}:`, matchResult);
    }
}

export function startJobScheduler() {
    cron.schedule("0 9 * * *", async () => {
        console.log("Starting daily job collection...");

        try {
            const summary = await runAllCollectors();
            await runDailyMatching();

            console.log(
                "Daily job collection completed:",
                summary
            );
        } catch (error) {
            console.error(
                "Daily job collection failed:",
                error
            );
        }
    });

    console.log("Job scheduler started.");
}