import pool from "../config/db";
import { createCollector } from "./collectorFactory";
import { runCollector } from "./collectorRunner";

export async function runAllCollectors() {
    const summary = {
        companiesProcessed: 0,
        companiesSkipped: 0,
        companiesFailed: 0,
        totalJobs: 0,
        newJobs: 0,
        updatedJobs: 0,
        closedJobs: 0
    };

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

            const stats = await runCollector(
                company.id,
                collector
            );

            summary.companiesProcessed++;

            summary.totalJobs += stats.totalJobs;
            summary.newJobs += stats.newJobs;
            summary.updatedJobs += stats.updatedJobs;
            summary.closedJobs += stats.closedJobs;

            console.log(
                `Completed collector for: ${company.name}`
            );

        } catch (error) {

            if (
                error instanceof Error &&
                error.message.startsWith(
                    "Unsupported ATS type:"
                )
            ) {
                console.log(
                    `Skipping ${company.name}: ` +
                    `unsupported ATS type ${company.ats_type}`
                );

                summary.companiesSkipped++;

                continue;
            }

            summary.companiesFailed++;

            console.error(
                `Failed collector for: ${company.name}`,
                error
            );
        }
    }

    return summary;
}