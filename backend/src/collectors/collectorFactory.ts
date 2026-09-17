import { JobCollector } from "./jobCollector";
import GreenhouseCollector from "./greenhouse/greenhouseCollector";

export function createCollector(
    atsType: string,
    atsIdentifier: string
): JobCollector {
    switch (atsType.toLowerCase()) {
        case "greenhouse":
            return new GreenhouseCollector(
                atsIdentifier
            );

        default:
            throw new Error(
                `Unsupported ATS type: ${atsType}`
            );
    }
}