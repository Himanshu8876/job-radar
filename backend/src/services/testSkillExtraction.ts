import pool from "../config/db";
import {
    extractJobSkills,
    cleanJobDescription
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

    const cleaned = cleanJobDescription(
    job.description
);

console.log("\nCLEANED DESCRIPTION:");
console.log(cleaned);

    const skills = await extractJobSkills(
        job.description
    );

    console.log("\nJOB:");
    console.log(job.title);

    console.log("\nREQUIRED SKILLS:");
    console.log(skills.required);

    console.log("\nNICE TO HAVE SKILLS:");
    console.log(skills.niceToHave);

    await pool.end();
}

test().catch((error) => {
    console.error(error);
    process.exit(1);
});