import { runDailyPipeline } from "../scheduler/jobScheduler";

async function main() {
    try {
        console.log("⏰ Starting scheduled Job Radar daily run...");

        await runDailyPipeline("scheduled");

        console.log("✅ Scheduled daily run completed successfully.");

        process.exit(0);
    } catch (error) {
        console.error("❌ Scheduled daily run failed:", error);

        process.exit(1);
    }
}

main();