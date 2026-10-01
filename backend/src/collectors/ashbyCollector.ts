import { NormalizedJob } from "../collectors/types";
import { JobCollectionResult, JobCollector } from "../collectors/jobCollector";
import { extractExperience } from "../collectors/experienceUtils";

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
    apiVersion?: string;
    jobs: AshbyJob[];
}

export default class AshbyCollector
    implements JobCollector
{
    private boardName: string;

    constructor(boardName: string) {
        this.boardName = boardName;
    }

    async collectJobs(): Promise<JobCollectionResult> {
        const url =
            `https://api.ashbyhq.com/posting-api/job-board/` +
            `${this.boardName}`;

        console.log(
            `Fetching jobs from: ${url}`
        );

        const response =
            await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Ashby API request failed: ` +
                `${response.status} ${response.statusText}`
            );
        }

        const data =
            (await response.json()) as AshbyResponse;

        if (!Array.isArray(data.jobs)) {
            throw new Error(
                "Ashby API returned an invalid jobs list"
            );
        }

        const isComplete = data.apiVersion === "1";

        if (!isComplete) {
            console.error(
                "Ashby snapshot is incomplete: missing or unsupported API version"
            );
        }

        console.log(
            `Total jobs fetched: ${data.jobs.length}`
        );

        const jobs = data.jobs.map((job) => {
            const description =
                job.descriptionHtml || "";

            const experience =
                extractExperience(description);

            return {
                source: "ashby",

                sourceJobId: job.id,

                title: job.title,

                description,

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

                experienceMin:
                    experience.min,

                experienceMax:
                    experience.max,

                postedAt:
                    job.publishedAt
                        ? new Date(job.publishedAt)
                        : undefined,

                applicationUrl:
                    job.applyUrl ||
                    job.jobUrl,
            };
        });

        return {
            jobs,
            isComplete,
        };
    }
}