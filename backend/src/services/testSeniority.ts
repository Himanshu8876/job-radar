import {
    getJobSeniority,
    calculateSeniorityScore,
} from "./matchingService";

const titles = [
    "Software Engineer - Fresher",
    "Software Engineer Intern",
    "Junior Software Engineer",
    "Software Engineer",
    "Senior Software Engineer",
    "Staff Software Engineer",
    "Lead Software Engineer",
    "Principal Software Engineer",
    "Engineering Manager",
    "Associate Software Engineer",
"Associate Data Analyst",
"Associate Operations Specialist",
];

for (const title of titles) {
    const seniority =
        getJobSeniority(title);

    const score =
        calculateSeniorityScore(seniority);

    console.log(
        `${title} → ${seniority} → ${score}`
    );
}