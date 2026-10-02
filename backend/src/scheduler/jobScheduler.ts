import cron = require("node-cron");
import { randomUUID } from "crypto";
import { runAllCollectors } from "../collectors/collectorService";
import {
    generateMatchesForUser,
    getMatchesForUser,
    getUsersForMatching,
    markJobsAsEmailed,
} from "../services/matchingService";
import { sendEmail } from "../services/emailService";

const SCHEDULER_TIME_ZONE = "Asia/Kolkata";

function formatTime(date: Date): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: SCHEDULER_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value])
    );

    return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function createRunId(startedAt: Date): string {
    return `daily-${formatTime(startedAt).replace(/[- :]/g, "")}-${randomUUID().slice(0, 8)}`;
}

function emailErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(
        /(password|api[_ -]?key|token|secret)\s*([:=])\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
        "$1$2[REDACTED]"
    );
}

export async function runDailyMatching(runId?: string): Promise<number> {
    let emailDurationMs = 0;

    if (runId) {
        console.log(`📧 EMAIL PROCESSING STARTED\nRun ID: ${runId}`);
    }

    try {
        const users = await getUsersForMatching();

        for (const user of users) {
            const matchResult = await generateMatchesForUser(user.id);
            const matches = await getMatchesForUser(user.id);
            const newMatches = matches.jobs.filter((job) => job.is_new);

            if (newMatches.length > 0) {
                let emailSent = false;
                const emailStartedAt = Date.now();

                try {
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
                    emailSent = true;
                } catch (error) {
                    if (runId) {
                        console.error(
                            `⚠️ EMAIL FAILED\nRun ID: ${runId}\nUser/Profile: ${user.id}\nError: ${emailErrorMessage(error)}`
                        );
                    }
                    console.error(
                        `Daily match email failed for user ${user.id}: ${emailErrorMessage(error)}`
                    );
                } finally {
                    emailDurationMs += Date.now() - emailStartedAt;
                }

                if (emailSent) {
                    await markJobsAsEmailed(
                        newMatches.map((job) => Number(job.job_id)),
                        user.id
                    );
                }
            }

            console.log(`Daily matches generated for user ${user.id}:`, matchResult);
        }
    } finally {
        if (runId) {
            console.log(
                `📧 EMAIL PROCESSING COMPLETED\nRun ID: ${runId}\n📧 Email duration: ${(emailDurationMs / 1000).toFixed(1)} seconds`
            );
        }
    }

    return emailDurationMs;
}

export async function runDailyPipeline(
    source: "scheduled" | "manual"
): Promise<void> {
    const startedAt = new Date();
    const runId = createRunId(startedAt);
    const startedTime = formatTime(startedAt);
    const runStartedAt = Date.now();

    if (source === "scheduled") {
        console.log("============================================================");
        console.log("⏰ DAILY CRON TRIGGERED");
        console.log(`Run ID: ${runId}`);
        console.log(`Time: ${startedTime}`);
        console.log(`Timezone: ${SCHEDULER_TIME_ZONE}`);
        console.log("============================================================");
        console.log(`⏰ SCHEDULED DAILY RUN TRIGGERED\nRun ID: ${runId}`);
    } else {
        console.log(`🖐️ MANUAL DAILY RUN TRIGGERED\nRun ID: ${runId}`);
    }

    console.log(`============================================================\n🚀 DAILY RUN STARTED\nRun ID: ${runId}\n============================================================`);

    try {
        const collectionStartedAt = Date.now();
        console.log(`📦 COLLECTION STARTED\nRun ID: ${runId}`);
        let summary;

        try {
            summary = await runAllCollectors();
        } catch (error) {
            console.error(`📦 COLLECTION FAILED\nRun ID: ${runId}\nError:`, error);
            throw error;
        }

        console.log(
            `📦 COLLECTION COMPLETED\nRun ID: ${runId}\nCompanies processed: ${summary.companiesProcessed}\nCompanies skipped: ${summary.companiesSkipped}\nCompanies failed: ${summary.companiesFailed}\nTotal jobs fetched: ${summary.totalJobs}\nNew jobs: ${summary.newJobs}\nUpdated jobs: ${summary.updatedJobs}\nClosed jobs: ${summary.closedJobs}`
        );
        console.log(
            `📦 Collection duration: ${((Date.now() - collectionStartedAt) / 1000).toFixed(1)} seconds`
        );

        const matchingStartedAt = Date.now();
        console.log(`🎯 MATCHING STARTED\nRun ID: ${runId}`);
        let emailDurationMs: number;

        try {
            emailDurationMs = await runDailyMatching(runId);
        } catch (error) {
            console.error(`❌ MATCHING FAILED\nRun ID: ${runId}\nError:`, error);
            throw error;
        }

        const matchingDurationMs = Math.max(
            0,
            Date.now() - matchingStartedAt - emailDurationMs
        );
        console.log(
            `🎯 MATCHING COMPLETED\nRun ID: ${runId}\nDuration: ${(matchingDurationMs / 1000).toFixed(1)} seconds`
        );
        console.log(
            `🎯 Matching duration: ${(matchingDurationMs / 1000).toFixed(1)} seconds`
        );

        const finishedAt = new Date();
        const totalDuration = (Date.now() - runStartedAt) / 1000;
        console.log(
            `============================================================\n✅ DAILY RUN COMPLETED\nRun ID: ${runId}\nDuration: ${totalDuration.toFixed(1)} seconds\nStarted: ${startedTime}\nFinished: ${formatTime(finishedAt)}\n⏱️ Total daily run duration: ${totalDuration.toFixed(1)} seconds\n============================================================`
        );
    } catch (error) {
        const totalDuration = (Date.now() - runStartedAt) / 1000;
        console.error(
            `============================================================\n❌ DAILY RUN FAILED\nRun ID: ${runId}\nDuration: ${totalDuration.toFixed(1)} seconds\nError:`,
            error,
            "\n============================================================"
        );
        throw error;
    }
}

export function startJobScheduler() {
    const task = cron.schedule("0 9 * * *", async () => {
        await runDailyPipeline("scheduled").catch(() => undefined);
    }, {
        timezone: SCHEDULER_TIME_ZONE,
    });

    const currentTime = new Date();
    console.log("============================================================");
    console.log("⏰ JOB SCHEDULER STARTED");
    console.log(`Timezone: ${SCHEDULER_TIME_ZONE}`);
    console.log("Daily schedule: 09:00");
    console.log(`Current server time: ${currentTime.toString()}`);
    console.log(
        `Current timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
    );
    const nextRun = task.getNextRun();
    if (nextRun) {
        console.log(`Next expected run: ${formatTime(nextRun)} ${SCHEDULER_TIME_ZONE}`);
    }
    console.log("============================================================");
}