import pool from "../config/db";
import { runAllCollectors } from "./collectorService";

async function test() {
    await runAllCollectors();

    await pool.end();
}

test().catch((error) => {
    console.error(error);
    process.exit(1);
});