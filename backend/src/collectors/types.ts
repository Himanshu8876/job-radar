export interface NormalizedJob {
    source: string;
    sourceJobId: string;

    title: string;
    description: string;

    location?: string;
    country?: string;

    employmentType?: string;

    experienceMin?: number;
    experienceMax?: number;

    postedAt?: Date;
    updatedAt?: Date;

    applicationUrl: string;

    workplaceType?: string;
}