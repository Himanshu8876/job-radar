import pool from "../config/db";
import { generateMatchesForUser } from "./matchingService";

async function test() {
    const userProfileId = 1;

    const processedJobs =
        await generateMatchesForUser(userProfileId);

    console.log(
        "Jobs processed:",
        processedJobs
    );

    const result = await pool.query(
        `SELECT
            COUNT(*) AS total_matches
         FROM job_matches
         WHERE user_profile_id = $1`,
        [userProfileId]
    );

    console.log(
        "Total saved matches:",
        result.rows[0].total_matches
    );

    await pool.end();
}

test();