import pool from "../config/db";
import { extractJobSkills } from "./skillService";

async function test() {
    const result = await pool.query(
        `SELECT id, title, description FROM jobs WHERE id = 15`
    );

    if (result.rows.length === 0) {
        console.log("Job not found");
        return;
    }

    const job = result.rows[0];

    const skills = await extractJobSkills(job.description);

    console.log("Job:", job.title);
    console.log("Required skills:", skills.required);
    console.log("Preferred skills:", skills.niceToHave);

    await pool.end();
}

test().catch((error) => {
    console.error("Error:", error);
});