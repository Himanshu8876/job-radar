
import { JobCollector, JobCollectionResult } from "./jobCollector";
import { NormalizedJob } from "./types";
import { extractExperience } from "./experienceUtils";

interface WorkdayJobPosting {
    externalPath: string;
    title?: string;
    locationsText?: string;
}

interface WorkdayJobsResponse {
    total?: number;
    jobPostings?: WorkdayJobPosting[];
}

interface WorkdayJobDetail {
    jobPostingInfo?: {
        id?: string;
        title?: string;
        jobDescription?: string;
        location?: string;
        additionalLocations?: string[];
        country?: {
            alpha2Code?: string;
        };
        timeType?: string;
        remoteType?: string;
        externalUrl?: string;
    };
}

export default class WorkdayCollector implements JobCollector {
    private tenant: string;
    private site: string;
    private pod: string;

    constructor(atsIdentifier: string) {
        const parts = atsIdentifier.split("/");

        this.tenant = parts[0];

        if (parts[1]?.startsWith("wd")) {
            this.pod = parts[1];
            this.site = parts.slice(2).join("/");
        } else {
            // Preserve the existing identifier format.
            this.pod = "wd12";
            this.site = parts.slice(1).join("/");
        }

        if (!this.tenant || !this.site) {
            throw new Error(
                `[Workday] Invalid ATS identifier: ${atsIdentifier}`
            );
        }
    }

    async collectJobs(): Promise<JobCollectionResult> {
        console.log("[Workday] India collector started");
        console.log(
            `[Workday] Tenant=${this.tenant}, pod=${this.pod}, site=${this.site}`
        );

        const limit = 20;
        let offset = 0;
        let expectedTotal: number | undefined;
        let isComplete = true;

        const postings: WorkdayJobPosting[] = [];
        const seenPaths = new Set<string>();

        const baseUrl =
            `https://${this.tenant}.${this.pod}.myworkdayjobs.com` +
            `/wday/cxs/${this.tenant}/${this.site}`;

        // Fetch all listing pages and retain India-based job paths.
        while (true) {
           

            let response: Response;

            try {
                response = await fetch(`${baseUrl}/jobs`, {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        appliedFacets: {},
                        limit,
                        offset,
                        searchText: "",
                    }),
                    signal: AbortSignal.timeout(15000),
                });
            } catch (error) {
                isComplete = false;
                console.warn(
                    `[Workday] Listing request failed at offset ${offset}:`,
                    error
                );
                break;
            }

            if (!response.ok) {
                isComplete = false;

                const errorBody = await response.text().catch(
                    () => "Unable to read error response"
                );

                console.warn("[Workday] Listing request failed:", {
                    status: response.status,
                    tenant: this.tenant,
                    pod: this.pod,
                    site: this.site,
                    body: errorBody,
                });

                break;
            }

            let data: WorkdayJobsResponse;

            try {
                data = (await response.json()) as WorkdayJobsResponse;
            } catch (error) {
                isComplete = false;
                console.warn("[Workday] Invalid listing response:", error);
                break;
            }

            if (!Array.isArray(data.jobPostings)) {
                isComplete = false;
                console.warn(
                    "[Workday] Missing jobPostings in response"
                );
                break;
            }

            if (expectedTotal === undefined) {
                if (
                    typeof data.total === "number" &&
                    Number.isFinite(data.total) &&
                    data.total >= 0
                ) {
                    expectedTotal = data.total;
                } else {
                    isComplete = false;
                    console.warn("[Workday] Invalid listing total");
                }
            }

            const newItems = data.jobPostings.filter((posting) => {
                if (!posting.externalPath) {
                    return false;
                }

                if (seenPaths.has(posting.externalPath)) {
                    return false;
                }

                seenPaths.add(posting.externalPath);
                return true;
            });

            if (offset === 0) {
    console.log(
        "[Workday DEBUG] Total jobs:",
        data.total
    );

    console.log(
        "[Workday DEBUG] Sample postings:",
        data.jobPostings.slice(0, 10).map((job) => ({
            title: job.title,
            externalPath: job.externalPath,
            locationsText: job.locationsText,
        }))
    );
}
    const indiaJobs = newItems.filter((posting) =>
    /\/job\/[^/]*india(?:\/|$)/i.test(
        posting.externalPath
    ) ||
    /\bindia\b/i.test(
        posting.locationsText ?? ""
    )
);

            postings.push(...indiaJobs);

            if (
                newItems.length === 0 &&
                data.jobPostings.length > 0
            ) {
                if (
                    expectedTotal === undefined ||
                    seenPaths.size < expectedTotal
                ) {
                    isComplete = false;
                    console.warn(
                        "[Workday] Pagination stopped before all listings were collected"
                    );
                }
                break;
            }

            if (
                expectedTotal !== undefined &&
                offset + data.jobPostings.length >= expectedTotal
            ) {
                if (seenPaths.size < expectedTotal) {
                    isComplete = false;
                    console.warn(
                        `[Workday] Listing count mismatch: collected ` +
                            `${seenPaths.size}, expected ${expectedTotal}`
                    );
                }
                break;
            }

            if (data.jobPostings.length < limit) {
                isComplete = false;
                console.warn(
                    "[Workday] Pagination ended before the expected total"
                );
                break;
            }

            offset += limit;
        }

        console.log(
            `[Workday India] Listing complete: ${postings.length} India postings found`
        );

        const jobs: NormalizedJob[] = [];

        // Fetch details for each unique India posting.
        for (const posting of postings) {

            let detailResponse: Response;

            try {
                detailResponse = await fetch(
                    `${baseUrl}${posting.externalPath}`,
                    {
                        headers: {
                            Accept: "application/json",
                        },
                        signal: AbortSignal.timeout(15000),
                    }
                );
            } catch (error) {
                isComplete = false;
                console.warn(
                    `[Workday] Detail request failed for ${posting.externalPath}:`,
                    error
                );
                continue;
            }

            if (!detailResponse.ok) {
                isComplete = false;
                console.warn(
                    `[Workday] Detail failed for ${posting.externalPath}: ` +
                        `${detailResponse.status}`
                );
                continue;
            }

            let detail: WorkdayJobDetail;

            try {
                detail =
                    (await detailResponse.json()) as WorkdayJobDetail;
            } catch (error) {
                isComplete = false;
                console.warn(
                    `[Workday] Invalid detail response for ${posting.externalPath}:`,
                    error
                );
                continue;
            }

            const info = detail.jobPostingInfo;

            if (!info?.id || !info.title) {
                isComplete = false;
                console.warn(
                    `[Workday] Missing ID or title for ${posting.externalPath}`
                );
                continue;
            }

            const description = info.jobDescription ?? "";
            const experience = extractExperience(description);

            const locationParts = [
                info.location,
                ...(info.additionalLocations ?? []),
            ].filter(
                (location): location is string => Boolean(location)
            );

            jobs.push({
                source: "workday",
                sourceJobId: info.id,
                title: info.title,
                description,
                location:
                    [...new Set(locationParts)].join(", ") ||
                    posting.locationsText,
                country: info.country?.alpha2Code,
                employmentType: info.timeType,
                workplaceType: info.remoteType,
                experienceMin: experience.min,
                experienceMax: experience.max,
                applicationUrl:
                    info.externalUrl ??
                    `https://${this.tenant}.${this.pod}.myworkdayjobs.com${posting.externalPath}`,
            });
        }

        console.log(
            `[Workday India] Finished: ${jobs.length}/${postings.length} ` +
                `job details processed; isComplete=${isComplete}`
        );

        return {
            jobs,
            isComplete,
        };
    }
}
