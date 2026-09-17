import { extractExperience } from "./greenhouseCollector";

const testCases = [
    "Software Engineer with 2-4 years of experience",
    "Backend Developer with 5+ years of experience",
    "Frontend Developer with 3–5 years of experience",
    "Developer with 2 to 4 years of experience",
    "Developer with 2 years of experience",
    "Developer with at least 2 years of experience",
    "Fresh graduate",
    "Entry level software engineer",
    "Software Engineer with 2 years of experience",
"Software Engineer with at least 2 years of experience",
"Fresh graduate",
"Fresh graduates",
"New graduate",
"Recent graduate",
"Software Engineer with 0-2 years of experience",
"Software Engineer with 0-1 years of experience",
"Software Engineer with 1 year of experience",
];

for (const text of testCases) {
    console.log("\nTEXT:", text);
    console.log("RESULT:", extractExperience(text));
}