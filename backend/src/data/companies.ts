export interface CompanyRegistryEntry {
    name: string;
    website?: string;
    careersUrl?: string;
    atsType: string;
    atsIdentifier: string;
    isActive: boolean;
}

export const companies: CompanyRegistryEntry[] = [
    {
        name: "6sense",
        careersUrl: "https://boards.greenhouse.io/6sense",
        atsType: "greenhouse",
        atsIdentifier: "6sense",
        isActive: true,
    },
    {
        name: "Drivetrain",
        careersUrl: "https://jobs.lever.co/drivetrain",
        atsType: "lever",
        atsIdentifier: "drivetrain",
        isActive: true,
    },
    {
        name: "FirstWork",
        careersUrl: "https://jobs.ashbyhq.com/firstwork",
        atsType: "ashby",
        atsIdentifier: "firstwork",
        isActive: true,
    },
    {
        name: "100ms",
        careersUrl: "https://jobs.lever.co/100ms",
        atsType: "lever",
        atsIdentifier: "100ms",
        isActive: true,
    },
    {
        name: "Microsoft",
        atsType: "workday",
        atsIdentifier: "microsoft",
        isActive: true,
    },
];