import pool from "../config/db";
import { extractJobSkills } from "./skillService";

async function test() {
    const result = await pool.query(
        `SELECT id, title, description
         FROM jobs
         WHERE source = 'greenhouse'
         ORDER BY id
         LIMIT 1`
    );

    if (result.rows.length === 0) {
        console.log("No Greenhouse jobs found.");
        return;
    }

    const job = result.rows[0];

    const skills =
        await extractJobSkills(job.description);

    console.log(`Job: ${job.title}`);

    console.log(
        "Required skills:",
        skills.required.map(
            (skill) =>
                `${skill.name} (${skill.skillType})`
        )
    );

    console.log(
        "Nice-to-have skills:",
        skills.niceToHave.map(
            (skill) =>
                `${skill.name} (${skill.skillType})`
        )
    );

    await pool.end();
}

test();