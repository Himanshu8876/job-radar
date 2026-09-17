import pool from "../config/db";
import { createCollector } from "./collectorFactory";
import { runCollector } from "./collectorRunner";

export async function runAllCollectors(): Promise<void> {
    const result = await pool.query(
        `SELECT
            id,
            name,
            ats_type,
            ats_identifier
         FROM companies
         WHERE is_active = TRUE`
    );

    for (const company of result.rows) {
        console.log(
            `\nStarting collector for: ${company.name}`
        );

        try {
            const collector = createCollector(
                company.ats_type,
                company.ats_identifier
            );

            await runCollector(
                company.id,
                collector
            );

            console.log(
                `Completed collector for: ${company.name}`
            );
        } catch (error) {
            console.error(
                `Failed collector for: ${company.name}`,
                error
            );
        }
    }
}