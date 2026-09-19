import cron = require("node-cron");
import { runAllCollectors } from "../collectors/collectorService";
import { generateMatchesForUser, getMatchesForUser } from "../services/matchingService";
import { sendEmail } from "../services/emailService";

export function startJobScheduler() {
    cron.schedule("0 9 * * *", async () => {
        console.log("Starting daily job collection...");

        try {
            const summary = await runAllCollectors();

            const matchResult = await generateMatchesForUser(1);

            const matches = await getMatchesForUser(1);

            await sendEmail(
    "garghimanshu778@gmail.com",
    `Job Radar - ${matches.jobs.length} matching jobs`,
    `
        <h1>Daily Job Radar</h1>

        <p>
            You have
            <strong>${matches.jobs.length}</strong>
            matching jobs today.
        </p>

        ${matches.jobs.map((job) => `
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

            console.log(
                "Daily matches generated:",
                matchResult
            );

            console.log(
                "New matching jobs:",
                matches.newJobs
            );

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