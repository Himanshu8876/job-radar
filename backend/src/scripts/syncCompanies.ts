import fs = require("fs");
import path = require("path");
import { parse } from "csv-parse/sync";

import pool from "../config/db";

interface CompanyRegistryEntry {
    name: string;
    website?: string;
    careersUrl?: string;
    atsType: string;
    atsIdentifier: string;
    isActive: boolean;
}

const supportedAtsTypes = [
    "greenhouse",
    "lever",
    "ashby",
    "workday",
];

async function syncCompanies() {
    try {
        const csvPath = path.join(
            __dirname,
            "../data/companies.csv"
        );

        const csvContent = fs.readFileSync(
            csvPath,
            "utf-8"
        );

        const companies =
            parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            }) as Record<string, string>[];

        for (const company of companies) {
            const normalizedCompany: CompanyRegistryEntry = {
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
            };

            if (
                !normalizedCompany.name ||
                !normalizedCompany.atsType ||
                !normalizedCompany.atsIdentifier
            ) {
                console.error(
                    `Skipping invalid company: ${
                        normalizedCompany.name || "Unknown"
                    }`
                );
                continue;
            }

            if (
                !supportedAtsTypes.includes(
                    normalizedCompany.atsType
                )
            ) {
                console.error(
                    `Skipping ${
                        normalizedCompany.name
                    }: unsupported ATS ${
                        normalizedCompany.atsType
                    }`
                );
                continue;
            }

            await pool.query(
                `INSERT INTO companies (
                    name,
                    website,
                    careers_url,
                    ats_type,
                    ats_identifier,
                    is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (name)
                DO UPDATE SET
                    website = EXCLUDED.website,
                    careers_url = EXCLUDED.careers_url,
                    ats_type = EXCLUDED.ats_type,
                    ats_identifier = EXCLUDED.ats_identifier,
                    is_active = EXCLUDED.is_active,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    normalizedCompany.name,
                    normalizedCompany.website || null,
                    normalizedCompany.careersUrl || null,
                    normalizedCompany.atsType,
                    normalizedCompany.atsIdentifier,
                    normalizedCompany.isActive,
                ]
            );

            console.log(
                `Synced: ${normalizedCompany.name}`
            );
        }

        console.log("Company sync completed.");
    } catch (error) {
        console.error(
            "Company sync failed:",
            error
        );
    } finally {
        await pool.end();
    }
}

syncCompanies();