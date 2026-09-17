import GreenhouseCollector from "./greenhouseCollector";
import { runCollector } from "../collectorRunner";

async function test() {
    const companyId = 2;

    const collector =
        new GreenhouseCollector("6sense");

    await runCollector(
        companyId,
        collector
    );
}

test().catch((error) => {
    console.error(error);
    process.exit(1);
});