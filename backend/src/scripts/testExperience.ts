import { extractExperience } from "../collectors/experienceUtils";

const tests = [
    "Fresh graduates are welcome to apply.",
    "This is an entry-level position.",
    "Candidates should have 0-2 years of experience.",
    "Candidates should have 1–3 years of experience.",
    "Requires 2 to 5 years of experience.",
    "Requires 3+ years of experience.",
    "Candidates must have at least 2 years of experience.",
    "Candidates should have 2 years of experience.",
    "No experience requirement mentioned here."
];

for (const text of tests) {
    console.log(text);
    console.log(extractExperience(text));
    console.log("--------------------");
}