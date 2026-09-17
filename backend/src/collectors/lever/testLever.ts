import LeverCollector from "./leverCollector";

async function test() {
    const collector =
        new LeverCollector("drivetrain");

    const jobs =
        await collector.collectJobs();

    console.log(
        "\nFirst 3 jobs:"
    );

    console.log(
        jobs.slice(0, 3)
    );
}

test().catch((error) => {
    console.error(error);
    process.exit(1);
});