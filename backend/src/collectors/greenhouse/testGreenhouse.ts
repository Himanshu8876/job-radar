import GreenhouseCollector from "./greenhouseCollector";

async function test() {
    const collector = new GreenhouseCollector("6sense");

    const result = await collector.collectJobs();

    console.log(`Total jobs fetched: ${result.jobs.length}`);
    console.log(`Snapshot complete: ${result.isComplete}`);

    console.log(result.jobs.slice(0, 3));
}

test();