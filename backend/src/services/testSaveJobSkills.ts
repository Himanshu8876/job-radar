import pool from "../config/db";
import {
    extractJobSkills,
    saveJobSkills
} from "./skillService";

async function test() {
    const result = await pool.query(
        `SELECT id, title, description
         FROM jobs
         WHERE id = 15`
    );

    if (result.rows.length === 0) {
        console.log("Job 15 not found");
        return;
    }

    const job = result.rows[0];

    console.log("\nJOB:");
    console.log(job.title);

    // Extract skills
    const skills = await extractJobSkills(
        job.description
    );

    console.log("\nEXTRACTED SKILLS:");
    console.log(skills);

    // Save skills into job_skills
    await saveJobSkills(
        job.id,
        skills
    );

    console.log("\nSkills saved successfully.");

    // Verify from database
    const saved = await pool.query(
        `SELECT
            js.job_id,
            s.name,
            js.skill_type
         FROM job_skills js
         JOIN skills s
           ON s.id = js.skill_id
         WHERE js.job_id = $1
         ORDER BY js.skill_type, s.name`,
        [job.id]
    );

    console.log("\nSAVED IN DATABASE:");
    console.log(saved.rows);

    await pool.end();
}

test().catch((error) => {
    console.error(error);
    process.exit(1);
});