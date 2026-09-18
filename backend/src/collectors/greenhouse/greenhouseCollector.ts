import { JobCollector } from "../jobCollector";
import { NormalizedJob } from "../types";

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

export function extractExperience(
    description?: string
): {
    min?: number;
    max?: number;
} {
    if (!description) {
        return {};
    }

    const fresherMatch = description.match(
        /\b(?:fresh\s+graduates?|new\s+graduates?|recent\s+graduates?)\b/i
    );

    if (fresherMatch) {
        return {
            min: 0,
            max: 0,
        };
    }

    const rangeMatch = description.match(
        /(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*years?/i
    );

    if (rangeMatch) {
        return {
            min: Number(rangeMatch[1]),
            max: Number(rangeMatch[2]),
        };
    }

    const plusMatch = description.match(
        /(\d+(?:\.\d+)?)\s*\+\s*years?/i
    );

    if (plusMatch) {
        return {
            min: Number(plusMatch[1]),
        };
    }

    const atLeastMatch = description.match(
        /at\s+least\s+(\d+(?:\.\d+)?)\s*years?/i
    );

    if (atLeastMatch) {
        return {
            min: Number(atLeastMatch[1]),
        };
    }

    const singleMatch = description.match(
        /(?<!at least\s)(\d+(?:\.\d+)?)\s*years?(?:\s+of)?\s+experience/i
    );

    if (singleMatch) {
        return {
            min: Number(singleMatch[1]),
            max: Number(singleMatch[1]),
        };
    }

    return {};
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