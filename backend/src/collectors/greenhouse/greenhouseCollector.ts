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
            return {
                source: "greenhouse",

                sourceJobId: String(job.id),

                title: job.title,

                description: job.content || "",

                location: job.location?.name,

                country: undefined,

                employmentType: undefined,

                experienceMin: undefined,

                experienceMax: undefined,

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