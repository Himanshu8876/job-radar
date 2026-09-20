import pool from "../config/db";
import { createCollector } from "./collectorFactory";
import { runCollector } from "./collectorRunner";

interface Company {
    id: number;
    name: string;
    ats_type: string;
    ats_identifier: string;
}

interface CollectorStats {
    totalJobs: number;
    newJobs: number;
    updatedJobs: number;
    closedJobs: number;
}

interface ProcessCompanyResult {
    status: "processed" | "skipped" | "failed";
    stats?: CollectorStats;
}

async function processCompany(
    company: Company
): Promise<ProcessCompanyResult> {

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

        console.log(
            `Completed collector for: ${company.name}`
        );

        return {
            status: "processed",
            stats
        };

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

            return {
                status: "skipped"
            };
        }

        console.error(
            `Failed collector for: ${company.name}`,
            error
        );

        return {
            status: "failed"
        };
    }
}


/**
 * Run collector for all active companies.
 */
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

    const result = await pool.query<Company>(
        `SELECT
            id,
            name,
            ats_type,
            ats_identifier
         FROM companies
         WHERE is_active = TRUE`
    );

    const companies = result.rows;

    console.log(
        `Starting collection for ${companies.length} companies...`
    );

    // Maximum number of companies processed simultaneously
    const concurrency = 10;

    for (
        let i = 0;
        i < companies.length;
        i += concurrency
    ) {

        const batch = companies.slice(
            i,
            i + concurrency
        );

        console.log(
            `\nProcessing companies ${
                i + 1
            }-${Math.min(
                i + concurrency,
                companies.length
            )} of ${companies.length}`
        );

        const batchResults =
            await Promise.all(
                batch.map((company) =>
                    processCompany(company)
                )
            );

        for (
            const companyResult of batchResults
        ) {

            if (
                companyResult.status ===
                "processed"
            ) {
                summary.companiesProcessed++;

                if (companyResult.stats) {
                    summary.totalJobs +=
                        companyResult.stats.totalJobs;

                    summary.newJobs +=
                        companyResult.stats.newJobs;

                    summary.updatedJobs +=
                        companyResult.stats.updatedJobs;

                    summary.closedJobs +=
                        companyResult.stats.closedJobs;
                }

                continue;
            }

            if (
                companyResult.status ===
                "skipped"
            ) {
                summary.companiesSkipped++;
                continue;
            }

            if (
                companyResult.status ===
                "failed"
            ) {
                summary.companiesFailed++;
            }
        }
    }

    console.log(
        "\n========== COLLECTION SUMMARY =========="
    );

    console.log(
        `Companies processed: ${summary.companiesProcessed}`
    );

    console.log(
        `Companies skipped: ${summary.companiesSkipped}`
    );

    console.log(
        `Companies failed: ${summary.companiesFailed}`
    );

    console.log(
        `Total jobs fetched: ${summary.totalJobs}`
    );

    console.log(
        `New jobs: ${summary.newJobs}`
    );

    console.log(
        `Updated jobs: ${summary.updatedJobs}`
    );

    console.log(
        `Closed jobs: ${summary.closedJobs}`
    );

    console.log(
        "========================================"
    );

    return summary;
}


/**
 * Run collector for one company.
 *
 * Example:
 * runCompanyCollector(72)
 */
export async function runCompanyCollector(
    companyId: number
) {

    const result = await pool.query<Company>(
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
            `Active company not found: ${companyId}`
        );
    }

    const company = result.rows[0];

    const resultStats =
        await processCompany(company);

    return {
        company: {
            id: company.id,
            name: company.name
        },
        status: resultStats.status,
        stats: resultStats.stats ?? null
    };
}