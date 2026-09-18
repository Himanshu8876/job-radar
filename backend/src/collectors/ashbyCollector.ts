import { NormalizedJob } from "../collectors/types";
import { JobCollector } from "../collectors/jobCollector";

interface AshbyJob {
    id: string;
    title: string;
    location?: string;
    department?: string;
    employmentType?: string;
    jobUrl: string;
    applyUrl: string;
    publishedAt?: string;
    workplaceType?: string;
    descriptionHtml?: string;
}

interface AshbyResponse {
    jobs: AshbyJob[];
}

export default class AshbyCollector
    implements JobCollector
{
    private boardName: string;

    constructor(boardName: string) {
        this.boardName = boardName;
    }

    async collectJobs(): Promise<NormalizedJob[]> {
        const url =
            `https://api.ashbyhq.com/posting-api/job-board/` +
            `${this.boardName}`;

        console.log(
            `Fetching jobs from: ${url}`
        );

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Ashby API request failed: ` +
                `${response.status} ${response.statusText}`
            );
        }

        const data =
            (await response.json()) as AshbyResponse;

        console.log(
            `Total jobs fetched: ${data.jobs.length}`
        );

        return data.jobs.map((job) => ({
            source: "ashby",

            sourceJobId: job.id,

            title: job.title,

            description:
                job.descriptionHtml || "",

            location:
                job.location,

            country:
                job.location
                    ?.toLowerCase()
                    .includes("india")
                    ? "IN"
                    : undefined,

            employmentType:
                job.employmentType,

            workplaceType:
                job.workplaceType,

            postedAt:
                job.publishedAt
                    ? new Date(job.publishedAt)
                    : undefined,

            applicationUrl:
                job.applyUrl ||
                job.jobUrl,
        }));
    }
}