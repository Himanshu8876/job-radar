import GreenhouseCollector from "./greenhouseCollector";

async function test() {
    const collector = new GreenhouseCollector("6sense");

    const jobs = await collector.collectJobs();

    console.log(`Total jobs fetched: ${jobs.length}`);

    console.log(jobs.slice(0, 3));
}

test();