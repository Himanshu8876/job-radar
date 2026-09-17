import pool from "../config/db";
import { createCollector } from "./collectorFactory";
import { runCollector } from "./collectorRunner";

async function test() {
    const companyId = 2;

    const result = await pool.query(
        `SELECT
            id,
            name,
            ats_type,
            ats_identifier
         FROM companies
         WHERE id = $1
         AND is_active = TRUE`,
        [companyId]
    );

    if (result.rows.length === 0) {
        throw new Error(
            `Company ${companyId} not found`
        );
    }

    const company = result.rows[0];

    console.log(
        `Running collector for: ${company.name}`
    );

    const collector = createCollector(
        company.ats_type,
        company.ats_identifier
    );

    await runCollector(
        company.id,
        collector
    );

    await pool.end();
}

test().catch((error) => {
    console.error(error);
    process.exit(1);
});