import { NormalizedJob } from "./types";

export interface JobCollectionResult {
    jobs: NormalizedJob[];
    isComplete: boolean;
}

export interface JobCollector {
    collectJobs(): Promise<JobCollectionResult>;
}