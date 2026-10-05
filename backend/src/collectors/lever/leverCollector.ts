import { NormalizedJob } from "../types";
import { JobCollectionResult, JobCollector } from "../jobCollector";
import { extractExperience } from "../experienceUtils";

const LEVER_PAGE_SIZE = 100;
const DEFAULT_LEVER_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_LEVER_COMPANY_TIMEOUT_MS = 120_000;
const DEFAULT_LEVER_MAX_PAGES = 50;

function getPositiveIntegerEnv(
    name: string,
    fallback: number
): number {
    const rawValue = process.env[name];

    if (rawValue === undefined || rawValue.trim() === "") {
        return fallback;
    }

    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return fallback;
    }

    return parsedValue;
}

const LEVER_REQUEST_TIMEOUT_MS = getPositiveIntegerEnv(
    "LEVER_REQUEST_TIMEOUT_MS",
    DEFAULT_LEVER_REQUEST_TIMEOUT_MS
);
const LEVER_COMPANY_TIMEOUT_MS = getPositiveIntegerEnv(
    "LEVER_COMPANY_TIMEOUT_MS",
    DEFAULT_LEVER_COMPANY_TIMEOUT_MS
);
const LEVER_MAX_PAGES = getPositiveIntegerEnv(
    "LEVER_MAX_PAGES",
    DEFAULT_LEVER_MAX_PAGES
);

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
        const companyName =
            this.companySlug.charAt(0).toUpperCase() +
            this.companySlug.slice(1);

        console.log(
            `Fetching jobs from: ${url}`
        );

        const jobs: NormalizedJob[] = [];
        const seenIds = new Set<string>();
        const seenPageKeys = new Set<string>();
        let skip = 0;
        let consecutiveEmptyPages = 0;
        let pageNumber = 0;
        const companyController = new AbortController();
        const companyTimeoutId = setTimeout(
            () => companyController.abort(),
            LEVER_COMPANY_TIMEOUT_MS
        );

        try {
        while (consecutiveEmptyPages < 2) {
            if (pageNumber >= LEVER_MAX_PAGES) {
                console.error(
                    `Lever pagination limit reached for ${this.companySlug}. Snapshot incomplete; skipping job closure.`
                );
                return { jobs, isComplete: false };
            }

            if (companyController.signal.aborted) {
                console.error(
                    `⚠️ Lever company timeout\nCompany: ${companyName}\nSnapshot complete: false\nJob closure: SKIPPED`
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

            const pageKey = `${pageNumber}:${skip}`;
            if (seenPageKeys.has(pageKey)) {
                console.error(
                    `Lever pagination loop detected for ${this.companySlug} at page ${pageNumber} skip=${skip}. Snapshot incomplete; skipping job closure.`
                );
                return { jobs, isComplete: false };
            }
            seenPageKeys.add(pageKey);

            console.log(
                `Fetching Lever page ${pageNumber} for ${this.companySlug} (skip=${skip}, limit=${LEVER_PAGE_SIZE})`
            );

            let data: unknown;
            const requestController = new AbortController();
            let rejectTimeout!: (error: Error) => void;
            const timeoutPromise = new Promise<never>((_, reject) => {
                rejectTimeout = reject;
            });
            const timeoutId = setTimeout(() => {
                requestController.abort();
                const timeoutError = new Error(
                    `Lever request timed out after ${LEVER_REQUEST_TIMEOUT_MS}ms`
                );
                timeoutError.name = "LeverRequestTimeoutError";
                rejectTimeout(timeoutError);
            }, LEVER_REQUEST_TIMEOUT_MS);
            const abortRequest = () => {
                requestController.abort();
                const timeoutError = new Error(
                    `Lever company timed out after ${LEVER_COMPANY_TIMEOUT_MS}ms`
                );
                timeoutError.name = "LeverCompanyTimeoutError";
                rejectTimeout(timeoutError);
            };
            companyController.signal.addEventListener(
                "abort",
                abortRequest,
                { once: true }
            );
            if (companyController.signal.aborted) {
                abortRequest();
            }

            try {
                const requestPromise = (async () => {
                    const response = await fetch(pageUrl, {
                        signal: requestController.signal,
                    });
                    if (!response.ok) {
                        return {
                            status: response.status,
                            statusText: response.statusText,
                            data: undefined,
                        };
                    }
                    return {
                        status: response.status,
                        statusText: response.statusText,
                        data: await response.json(),
                    };
                })();
                const response = await Promise.race([
                    requestPromise,
                    timeoutPromise,
                ]);

                if (response.status === 404) {
                    console.error(
                        `Lever board not found for ${this.companySlug}. Skipping company safely.`
                    );
                    return { jobs, isComplete: false };
                }

                if (response.status < 200 || response.status >= 300) {
                    const errorMessage =
                        `Lever API request failed: ` +
                        `${response.status} ${response.statusText}`;

                    if (
                        response.status === 429 ||
                        response.status >= 500 ||
                        response.status === 408 ||
                        response.status === 425
                    ) {
                        console.warn(
                            `${errorMessage}. Retrying transient Lever error for ${this.companySlug}.`
                        );
                        return { jobs, isComplete: false };
                    }

                    throw new Error(errorMessage);
                }

                data = response.data;
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.name === "LeverCompanyTimeoutError"
                ) {
                    console.error(
                        `⚠️ Lever company timeout\nCompany: ${companyName}\nSnapshot complete: false\nJob closure: SKIPPED`
                    );
                    return { jobs: [], isComplete: false };
                }

                if (
                    error instanceof Error &&
                    error.name === "LeverRequestTimeoutError"
                ) {
                    console.error(
                        `⚠️ Lever request timeout\nCompany: ${companyName}\nRequest timeout: ${LEVER_REQUEST_TIMEOUT_MS}ms\nSnapshot complete: false\nJob closure: SKIPPED`
                    );
                    return { jobs: [], isComplete: false };
                }

                const message = error instanceof Error ? error.message : String(error);
                const isTransientError =
                    message.includes("ECONNRESET") ||
                    message.includes("ETIMEDOUT") ||
                    message.includes("ENOTFOUND") ||
                    message.includes("429") ||
                    message.includes("5") ||
                    message.includes("network") ||
                    message.includes("fetch") ||
                    message.includes("Failed to fetch");

                if (isTransientError) {
                    console.error(
                        `Lever collection stopped before the snapshot was complete due to a transient error: ${message}`
                    );
                    return { jobs, isComplete: false };
                }

                console.error(
                    "Lever collection stopped before the snapshot was complete:",
                    error
                );
                return { jobs, isComplete: false };
            } finally {
                clearTimeout(timeoutId);
                companyController.signal.removeEventListener(
                    "abort",
                    abortRequest
                );
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
                console.log(
                    `Lever page ${pageNumber} for ${this.companySlug} returned no jobs; continuing.`
                );
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

            const nextSkip = skip + page.length;
            if (nextSkip <= skip) {
                console.error(
                    `Lever pagination made no forward progress for ${this.companySlug} after page ${pageNumber}. Snapshot incomplete; skipping job closure.`
                );
                return { jobs, isComplete: false };
            }

            skip = nextSkip;
        }

        console.log(
            `Total jobs fetched: ${jobs.length}`
        );

        return {
            jobs,
            isComplete: true,
        };
        } finally {
            clearTimeout(companyTimeoutId);
        }
    }
}