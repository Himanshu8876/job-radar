import { NormalizedJob } from "../types";
import { JobCollector } from "../jobCollector";
import { extractExperience } from "../experienceUtils";

interface LeverJob {
    id: string;
    text: string;

    description?: string;
    descriptionPlain?: string;

    lists?: {
        text: string;
        content: string;
    }[];

    categories?: {
        commitment?: string;
        location?: string;
        team?: string;
    };

    createdAt?: number;

    hostedUrl: string;
    applyUrl?: string;

    country?: string;
    workplaceType?: string;
}

interface LeverResponse extends Array<LeverJob> {}

export default class LeverCollector
    implements JobCollector
{
    private companySlug: string;

    constructor(companySlug: string) {
        this.companySlug = companySlug;
    }

    async collectJobs(): Promise<NormalizedJob[]> {
        const url =
            `https://api.lever.co/v0/postings/` +
            `${this.companySlug}?mode=json`;

        console.log(
            `Fetching jobs from: ${url}`
        );

        const response =
            await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Lever API request failed: ` +
                `${response.status} ${response.statusText}`
            );
        }

        const data =
            (await response.json()) as LeverResponse;

        console.log(
            `Total jobs fetched: ${data.length}`
        );

        return data.map((job) => {
            const description = [
                job.descriptionPlain ||
                job.description ||
                "",

                ...(job.lists || []).map((list) => {
                    return `${list.text}\n${list.content}`;
                })
            ].join("\n\n");

            const experience =
                extractExperience(description);

            return {
                source: "lever",

                sourceJobId: job.id,

                title: job.text,

                description,

                location:
                    job.categories?.location,

                country:
                    job.country,

                employmentType:
                    job.categories?.commitment,

                workplaceType:
                    job.workplaceType ||
                    (
                        `${job.categories?.location || ""} ${job.descriptionPlain || ""}`
                            .toLowerCase()
                            .includes("remote")
                            ? "Remote"
                            : undefined
                    ),

                experienceMin:
                    experience.min,

                experienceMax:
                    experience.max,

                postedAt:
                    job.createdAt
                        ? new Date(job.createdAt)
                        : undefined,

                applicationUrl:
                    job.applyUrl ||
                    job.hostedUrl,
            };
        });
    }
}