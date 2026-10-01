import { NormalizedJob } from "../types";
import { JobCollectionResult, JobCollector } from "../jobCollector";
import { extractExperience } from "../experienceUtils";

const LEVER_PAGE_SIZE = 100;
const LEVER_REQUEST_TIMEOUT_MS = 30_000;
const LEVER_MAX_PAGES = 102;

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

function isLeverJob(value: unknown): value is LeverJob {
    if (!value || typeof value !== "object") {
        return false;
    }

    const job = value as Partial<LeverJob>;

    return typeof job.id === "string" &&
        job.id.length > 0 &&
        typeof job.text === "string" &&
        (typeof job.hostedUrl === "string" ||
            typeof job.applyUrl === "string");
}

export default class LeverCollector
    implements JobCollector
{
    private companySlug: string;

    constructor(companySlug: string) {
        this.companySlug = companySlug;
    }

    async collectJobs(): Promise<JobCollectionResult> {
        const url =
            `https://api.lever.co/v0/postings/` +
            `${this.companySlug}`;

        console.log(
            `Fetching jobs from: ${url}`
        );

        const jobs: NormalizedJob[] = [];
        const seenIds = new Set<string>();
        let skip = 0;
        let consecutiveEmptyPages = 0;
        let pageNumber = 0;

        while (consecutiveEmptyPages < 2) {
            if (pageNumber >= LEVER_MAX_PAGES) {
                console.error(
                    `Lever pagination safety limit reached for ${this.companySlug} after ${pageNumber} pages; snapshot is incomplete`
                );
                return { jobs, isComplete: false };
            }

            pageNumber++;
            const pageUrl = new URL(url);
            pageUrl.searchParams.set("mode", "json");
            pageUrl.searchParams.set("skip", String(skip));
            pageUrl.searchParams.set(
                "limit",
                String(LEVER_PAGE_SIZE)
            );

            console.log(
                `Fetching Lever page ${pageNumber} for ${this.companySlug} (skip=${skip}, limit=${LEVER_PAGE_SIZE})`
            );

            let data: unknown;
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                LEVER_REQUEST_TIMEOUT_MS
            );

            try {
                const response = await fetch(pageUrl, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(
                        `Lever API request failed: ` +
                        `${response.status} ${response.statusText}`
                    );
                }

                data = await response.json();
            } catch (error) {
                if (controller.signal.aborted) {
                    const timeoutError = new Error(
                        `Lever request timed out after ${LEVER_REQUEST_TIMEOUT_MS}ms for ${this.companySlug} page ${pageNumber}`
                    );
                    console.error(timeoutError.message);
                    throw timeoutError;
                }

                console.error(
                    "Lever collection stopped before the snapshot was complete:",
                    error
                );
                return { jobs, isComplete: false };
            } finally {
                clearTimeout(timeoutId);
            }

            if (!Array.isArray(data)) {
                console.error(
                    "Lever API returned an invalid postings page"
                );
                return { jobs, isComplete: false };
            }

            const page = data as LeverResponse;

            if (!page.every(isLeverJob)) {
                console.error(
                    "Lever API returned a malformed posting; snapshot is incomplete"
                );
                return { jobs, isComplete: false };
            }

            if (page.length === 0) {
                consecutiveEmptyPages++;
                continue;
            }

            consecutiveEmptyPages = 0;
            const normalizedPage: NormalizedJob[] = [];
            let hasDuplicate = false;

            for (const job of page) {
                if (seenIds.has(job.id)) {
                    hasDuplicate = true;
                    continue;
                }

                seenIds.add(job.id);

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

                normalizedPage.push({
                    source: "lever",
                    sourceJobId: job.id,
                    title: job.text,
                    description,
                    location: job.categories?.location,
                    country: job.country,
                    employmentType: job.categories?.commitment,
                    workplaceType:
                        job.workplaceType ||
                        (
                            `${job.categories?.location || ""} ${job.descriptionPlain || ""}`
                                .toLowerCase()
                                .includes("remote")
                                ? "Remote"
                                : undefined
                        ),
                    experienceMin: experience.min,
                    experienceMax: experience.max,
                    postedAt: job.createdAt
                        ? new Date(job.createdAt)
                        : undefined,
                    applicationUrl:
                        job.applyUrl || job.hostedUrl,
                });
            }

            jobs.push(...normalizedPage);

            if (hasDuplicate) {
                console.error(
                    "Lever returned duplicate postings across pages; snapshot is incomplete"
                );
                return { jobs, isComplete: false };
            }

            skip += page.length;
        }

        console.log(
            `Total jobs fetched: ${jobs.length}`
        );

        return {
            jobs,
            isComplete: true,
        };
    }
}