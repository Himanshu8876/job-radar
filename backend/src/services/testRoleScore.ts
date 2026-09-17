import { calculateRoleScore } from "./matchingService";

const preferredRole = "Data Analyst";

const testTitles = [
    "Data Analyst",
    "Senior Data Analyst",
    "Junior Data Analyst",
    "Data Analytics Analyst",
    "Business Data Analyst",
    "Data Scientist",
    "Business Analyst",
    "Software Engineer",
];

for (const title of testTitles) {
    const score = calculateRoleScore(
        preferredRole,
        title
    );

    console.log(
        `${title} -> ${score}`
    );
}