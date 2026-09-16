import { generateMatchReason } from "./matchingService";

console.log(
    "Strong match:"
);

console.log(
    generateMatchReason(
        80,
        100,
        100,
        100,
        100,
        100
    )
);

console.log("\nWeak match:");

console.log(
    generateMatchReason(
        20,
        0,
        0,
        5,
        0,
        100
    )
);

console.log("\nPartial match:");

console.log(
    generateMatchReason(
        60,
        50,
        50,
        80,
        50,
        100
    )
);