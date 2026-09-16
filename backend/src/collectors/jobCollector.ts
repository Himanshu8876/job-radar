import { NormalizedJob } from "./types";

export interface JobCollector {
    collectJobs(): Promise<NormalizedJob[]>;
}