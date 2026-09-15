export interface JobCollector {
    collectJobs(): Promise<unknown[]>;
}