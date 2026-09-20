import fs = require("fs");
import path = require("path");
import { parse } from "csv-parse/sync";

interface CompanyRegistryEntry {
    name: string;
    website?: string;
    careersUrl?: string;
    atsType: string;
    atsIdentifier: string;
    isActive: boolean;
}

interface ValidationResult {
    company: string;
    status: "valid" | "invalid" | "unsupported";
    jobs: number;
}

function loadCompanies(): CompanyRegistryEntry[] {
    const csvPath = path.join(
        __dirname,
        "../data/companies.csv"
    );

    const csvContent = fs.readFileSync(
        csvPath,
        "utf-8"
    );

    const rows =
        parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        }) as Record<string, string>[];

    return rows.map((company) => ({
        name: company.name,
        website: company.website || undefined,
        careersUrl:
            company.careers_url || undefined,
        atsType:
            company.ats_type.toLowerCase(),
        atsIdentifier:
            company.ats_identifier,
        isActive:
            company.is_active.toLowerCase() === "true",
    }));
}

async function validateCompany(
    company: CompanyRegistryEntry
): Promise<ValidationResult> {

    try {

        if (company.atsType === "greenhouse") {

            const url =
                `https://boards-api.greenhouse.io/v1/boards/` +
                `${company.atsIdentifier}/jobs`;

            const response = await fetch(url);

            if (!response.ok) {
                console.log(
                    `❌ ${company.name} → Greenhouse ${response.status}`
                );

                return {
                    company: company.name,
                    status: "invalid",
                    jobs: 0,
                };
            }

            const data = await response.json();

            console.log(
                `✅ ${company.name} → ${data.jobs.length} jobs`
            );

            return {
                company: company.name,
                status: "valid",
                jobs: data.jobs.length,
            };
        }

        if (company.atsType === "lever") {

            const url =
                `https://api.lever.co/v0/postings/` +
                `${company.atsIdentifier}?mode=json`;

            const response = await fetch(url);

            if (!response.ok) {
                console.log(
                    `❌ ${company.name} → Lever ${response.status}`
                );

                return {
                    company: company.name,
                    status: "invalid",
                    jobs: 0,
                };
            }

            const data = await response.json();

            console.log(
                `✅ ${company.name} → ${data.length} jobs`
            );

            return {
                company: company.name,
                status: "valid",
                jobs: data.length,
            };
        }

        if (company.atsType === "ashby") {

            const url =
                `https://api.ashbyhq.com/posting-api/job-board/` +
                `${company.atsIdentifier}`;

            const response = await fetch(url);

            if (!response.ok) {
                console.log(
                    `❌ ${company.name} → Ashby ${response.status}`
                );

                return {
                    company: company.name,
                    status: "invalid",
                    jobs: 0,
                };
            }

            const data = await response.json();

            console.log(
                `✅ ${company.name} → ${data.jobs.length} jobs`
            );

            return {
                company: company.name,
                status: "valid",
                jobs: data.jobs.length,
            };
        }

        if (company.atsType === "eightfold") {
            console.log(
                `⚠️ ${company.name} → Eightfold validation not implemented yet`
            );

            return {
                company: company.name,
                status: "unsupported",
                jobs: 0,
            };
        }

        console.log(
            `⚠️ ${company.name} → ATS not validated yet: ${company.atsType}`
        );

        return {
            company: company.name,
            status: "unsupported",
            jobs: 0,
        };

    } catch (error) {

        console.log(
            `❌ ${company.name} → validation failed`
        );

        return {
            company: company.name,
            status: "invalid",
            jobs: 0,
        };
    }
}

async function validateCompanies() {

    const companies = loadCompanies();

    console.log(
        `Validating ${companies.length} companies...`
    );

    const results: ValidationResult[] = [];

    const concurrency = 10;

    for (
        let i = 0;
        i < companies.length;
        i += concurrency
    ) {

        const batch =
            companies.slice(
                i,
                i + concurrency
            );

        const batchResults =
            await Promise.all(
                batch.map((company) =>
                    validateCompany(company)
                )
            );

        results.push(
            ...batchResults
        );
    }

    const validCompanies =
        results.filter(
            (result) =>
                result.status === "valid"
        ).length;

    const invalidCompanies =
        results.filter(
            (result) =>
                result.status === "invalid"
        ).length;

    const unsupportedAts =
        results.filter(
            (result) =>
                result.status === "unsupported"
        ).length;

    const totalJobs =
        results.reduce(
            (total, result) =>
                total + result.jobs,
            0
        );

    console.log("");

    console.log(
        "========== VALIDATION SUMMARY =========="
    );

    console.log(
        `Total companies: ${companies.length}`
    );

    console.log(
        `Valid: ${validCompanies}`
    );

    console.log(
        `Invalid: ${invalidCompanies}`
    );

    console.log(
        `Unsupported ATS: ${unsupportedAts}`
    );

    console.log(
        `Total jobs available: ${totalJobs}`
    );

    console.log(
        "========================================"
    );
}

validateCompanies();