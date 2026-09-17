import { JobCollector } from "./jobCollector";
import GreenhouseCollector from "./greenhouse/greenhouseCollector";
import LeverCollector from "./lever/leverCollector";

export function createCollector(
    atsType: string,
    atsIdentifier: string
): JobCollector {
    switch (atsType.toLowerCase()) {
        case "greenhouse":
            return new GreenhouseCollector(
                atsIdentifier
            );

            case "lever":
            return new LeverCollector(
                atsIdentifier
            );

        default:
            throw new Error(
                `Unsupported ATS type: ${atsType}`
            );
    }
}