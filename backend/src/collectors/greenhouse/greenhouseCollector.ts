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

    const lastPart = parts[parts.length - 1];

    if (lastPart.toLowerCase() === "remote") {
        return parts.length > 1
            ? parts[parts.length - 2]
            : undefined;
    }

    return lastPart;
}

function extractExperience(
    description?: string
): {
    min?: number;
    max?: number;
} {
    if (!description) {
        return {};
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

        const data = (await response.json()) as GreenhouseResponse;

        const normalizedJobs: NormalizedJob[] = data.jobs.map((job) => {
            const experience = extractExperience(job.content);

            return {
                source: "greenhouse",

                sourceJobId: String(job.id),

                title: job.title,

                description: job.content || "",

                location: job.location?.name,

                country: extractCountry(job.location?.name),

                employmentType: undefined,

                experienceMin: experience.min,

                experienceMax: experience.max,

                postedAt: undefined,

                updatedAt: job.updated_at
                    ? new Date(job.updated_at)
                    : undefined,

                applicationUrl: job.absolute_url,
            };
        });

        return normalizedJobs;
    }
}

export = GreenhouseCollector;