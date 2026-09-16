import { calculateExperienceScore } from "./matchingService";

console.log(
    "No requirement:",
    calculateExperienceScore(0)
);

console.log(
    "0 years, requires 2:",
    calculateExperienceScore(0, 2)
);

console.log(
    "1 year, requires 2:",
    calculateExperienceScore(1, 2)
);

console.log(
    "2 years, requires 2:",
    calculateExperienceScore(2, 2)
);

console.log(
    "3 years, requires 2:",
    calculateExperienceScore(3, 2)
);

console.log(
    "0 years, requires 2-6:",
    calculateExperienceScore(0, 2, 6)
);

console.log(
    "2 years, requires 2-6:",
    calculateExperienceScore(2, 2, 6)
);