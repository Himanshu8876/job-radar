import pool from "../config/db";
import {
    generateMatchesForUser,
} from "./matchingService";

async function test() {
    const userProfileId = 1;

    const processedJobs =
        await generateMatchesForUser(
            userProfileId
        );

    console.log(
        `Jobs processed: ${processedJobs}`
    );

    const result = await pool.query(
        `SELECT
            jm.job_id,
            j.title,
            jm.score,
            jm.skill_score,
            jm.role_score,
            jm.experience_score,
            jm.seniority_score,
            jm.location_score,
            jm.education_score,
            jm.reason
         FROM job_matches jm
         JOIN jobs j
            ON jm.job_id = j.id
         WHERE jm.user_profile_id = $1
         ORDER BY jm.score DESC`,
        [userProfileId]
    );

    console.table(result.rows);

    await pool.end();
}

test().catch((error) => {
    console.error(error);
    process.exit(1);
});