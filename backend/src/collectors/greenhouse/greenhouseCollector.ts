import { JobCollector } from "../jobCollector";
import { NormalizedJob } from "../types";
import { extractExperience } from "../experienceUtils";

interface GreenhouseJob {
    id: number;
    title: string;
    updated_at: string;

    location?: {
        name?: string;
    };

    absolute_url: string;
    content?: string;

    departments?: {
        id: number;
        name: string;
    }[];

    offices?: {
        id: number;
        name: string;
        location?: string;
    }[];
}

interface GreenhouseResponse {
    jobs: GreenhouseJob[];
    meta: {
        total: number;
    };
}

function extractCountry(location?: string): string | undefined {
    if (!location) {
        return undefined;
    }

    const parts = location
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length === 0) {
        return undefined;
    }

    let country = parts[parts.length - 1];

    if (country.toLowerCase() === "remote") {
        country =
            parts.length > 1
                ? parts[parts.length - 2]
                : "";
    }

    const normalizedCountry =
        country.toLowerCase().trim();

    if (normalizedCountry === "india") {
        return "IN";
    }

    if (
        normalizedCountry === "united states" ||
        normalizedCountry === "usa" ||
        normalizedCountry === "us"
    ) {
        return "US";
    }

    if (normalizedCountry === "canada") {
        return "CA";
    }

    if (
        normalizedCountry === "united kingdom" ||
        normalizedCountry === "uk"
    ) {
        return "GB";
    }

    return country;
}

function normalizeEmploymentType(
    title?: string,
    description?: string
): string | undefined {
    const normalizedTitle =
        (title || "").toLowerCase();

    // Title is the strongest signal
    if (
        normalizedTitle.includes("intern") ||
        normalizedTitle.includes("internship")
    ) {
        return "Internship";
    }

    if (
        normalizedTitle.includes("part-time") ||
        normalizedTitle.includes("part time")
    ) {
        return "Part-time";
    }

    if (
        normalizedTitle.includes("full-time") ||
        normalizedTitle.includes("full time")
    ) {
        return "Full-time";
    }

    // Use description only when title does not specify it
    const normalizedDescription =
        (description || "").toLowerCase();

    if (
        normalizedDescription.includes("part-time") ||
        normalizedDescription.includes("part time")
    ) {
        return "Part-time";
    }

    if (
        normalizedDescription.includes("full-time") ||
        normalizedDescription.includes("full time")
    ) {
        return "Full-time";
    }

    return undefined;
}

function normalizeWorkplaceType(
    location?: string,
    description?: string
): string | undefined {
    const text =
        `${location || ""} ${description || ""}`.toLowerCase();

    if (text.includes("hybrid")) {
        return "Hybrid";
    }

    if (text.includes("remote")) {
        return "Remote";
    }

    if (
        text.includes("on-site") ||
        text.includes("onsite") ||
        text.includes("on site")
    ) {
        return "On-site";
    }

    return undefined;
}


class GreenhouseCollector implements JobCollector {
    private boardToken: string;

    constructor(boardToken: string) {
        this.boardToken = boardToken;
    }

    async collectJobs(): Promise<NormalizedJob[]> {
        const url =
            `https://boards-api.greenhouse.io/v1/boards/` +
            `${this.boardToken}/jobs?content=true`;

        console.log(`Fetching jobs from: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Greenhouse API failed: ${response.status} ${response.statusText}`
            );
        }

        const data =
            (await response.json()) as GreenhouseResponse;

        const normalizedJobs: NormalizedJob[] =
            data.jobs.map((job) => {
                const experience =
                    extractExperience(job.content);

                return {
                    source: "greenhouse",

                    sourceJobId: String(job.id),

                    title: job.title,

                    description: job.content || "",

                    location: job.location?.name,

                    country:
                        extractCountry(
                            job.location?.name
                        ),

                    employmentType:
                        normalizeEmploymentType(
                            job.title,
                            job.content
                        ),

                    workplaceType:
                        normalizeWorkplaceType(
                            job.location?.name,
                            job.content
                        ),

                    experienceMin:
                        experience.min,

                    experienceMax:
                        experience.max,

                    postedAt: undefined,

                    updatedAt:
                        job.updated_at
                            ? new Date(job.updated_at)
                            : undefined,

                    applicationUrl:
                        job.absolute_url,
                };
            });

        return normalizedJobs;
    }
}

export default GreenhouseCollector;