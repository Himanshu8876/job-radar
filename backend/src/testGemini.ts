import dotenv = require("dotenv");

dotenv.config();

console.log(
    "Gemini API key loaded:",
    process.env.GEMINI_API_KEY ? "YES" : "NO"
);

import { extractResumeData } from "./services/geminiService";

async function test() {
    const resumeUrl =
        "https://res.cloudinary.com/due03hup4/raw/upload/v1790067156/job-radar/resumes/user_1_1790067150541";

    try {
        const result = await extractResumeData(resumeUrl);

        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Gemini test failed:", error);
    }
}

test();