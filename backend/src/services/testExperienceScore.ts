import { calculateExperienceScore } from "./matchingService";

const userExperience = 2;

const testCases = [
    {
        name: "No requirement",
        min: undefined,
        max: undefined,
    },
    {
        name: "0-1 years",
        min: 0,
        max: 1,
    },
    {
        name: "0-2 years",
        min: 0,
        max: 2,
    },
    {
        name: "1+ years",
        min: 1,
        max: undefined,
    },
    {
        name: "2-4 years",
        min: 2,
        max: 4,
    },
    {
        name: "5+ years",
        min: 5,
        max: undefined,
    },
];

for (const testCase of testCases) {
    const score = calculateExperienceScore(
        userExperience,
        testCase.min,
        testCase.max
    );

    console.log(
        `${testCase.name} -> ${score}`
    );
}