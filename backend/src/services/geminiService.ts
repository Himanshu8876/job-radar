import {
    GoogleGenAI,
    createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export async function extractResumeData(resumeUrl: string) {
    const prompt = `
You are a precise resume-parsing system. Extract structured data from the resume PDF provided. Do not use any outside knowledge about the person, company, or role — use ONLY what is written in the document.

CORE RULES
1. Never invent, infer, or guess information that isn't explicitly stated or directly derivable from the text.
2. If a field is missing or unclear, return null (not an empty string, not "N/A", not "Unknown").
3. Do not hallucinate company names, dates, or degrees that merely sound plausible.

SKILLS
4. Extract each skill as an individual string — split comma/slash/pipe separated lists (e.g. "React/Redux/Node" -> ["React.js", "Redux", "Node.js"]).
5. Normalize skill names to their standard/common industry form. Examples:
   - ReactJS, React JS -> React.js
   - Node, NodeJS -> Node.js
   - Postgres -> PostgreSQL
   - Js -> JavaScript
   - Ts -> TypeScript
   - Mongo -> MongoDB
   - K8s -> Kubernetes
   - Golang -> Go
   Apply the same normalization logic to any other common abbreviation/full-name skill pairs you recognize, not just this list.
6. Deduplicate skills after normalization (case-insensitive match).
7. Do not split multi-word proper nouns that are a single skill (e.g. "Machine Learning" stays as one entry).

DATES
8. All dates must be normalized to YYYY-MM format.
9. If only a year is given (e.g. "2021"), use YYYY-01 and do not fabricate a month.
10. If a role is current/ongoing (e.g. "Present", "Current", "Till date"), set end_date to null and do not guess an end date.
11. If a date is genuinely unparseable or absent, return null rather than guessing.

EXPERIENCE
12. Include internships, co-ops, and freelance/contract work as experience items.
13. total_years should be a numeric estimate (one decimal place) of total professional experience, calculated from the earliest start_date to the latest end_date (use today's date if the most recent role is ongoing).
    - If employment periods overlap, do not double-count the overlapping months.
    - If dates are missing or too ambiguous to calculate reliably, return your best conservative estimate based on stated years of experience in the resume text (e.g. a summary line saying "5+ years"); if neither is available, return 0.
14. List experience items in reverse chronological order (most recent first), matching the resume's own ordering when possible.

EDUCATION
15. graduation_year must be an integer (e.g. 2022) or null. Do not include expected/future graduation years as if they already occurred — extract them as stated.
16. If multiple degrees are listed, extract the highest/most recent one for the \`education\` object.

PREFERRED ROLES
17. preferred_roles should contain job titles reasonably supported by the resume — either explicitly stated (e.g. an "Objective" or "Career Goal" section) or clearly implied by the person's most recent role(s) and skill set. Do not include unrelated or aspirational roles with no supporting evidence.

OUTPUT
18. Return ONLY the JSON object matching the provided schema. No commentary, no markdown formatting, no explanations.
`;

    const response = await generateWithRetry({
        model: "gemini-3.6-flash",
       contents: [
    createPartFromUri(
        resumeUrl,
        "application/pdf"
    ),
    prompt,
],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "object",
                properties: {
                    personal: {
                        type: "object",
                        properties: {
                            name: { type: ["string", "null"] },
                            email: { type: ["string", "null"] },
                            phone: { type: ["string", "null"] },
                            location: { type: ["string", "null"] },
                        },
                        required: ["name", "email", "phone", "location"],
                    },
                    education: {
                        type: "object",
                        properties: {
                            degree: { type: ["string", "null"] },
                            field: { type: ["string", "null"] },
                            college: { type: ["string", "null"] },
                            graduation_year: { type: ["integer", "null"] },
                        },
                        required: [
                            "degree",
                            "field",
                            "college",
                            "graduation_year",
                        ],
                    },
                    experience: {
                        type: "object",
                        properties: {
                            total_years: { type: "number" },
                            items: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        company: { type: ["string", "null"] },
                                        role: { type: ["string", "null"] },
                                        start_date: {
                                            type: ["string", "null"],
                                        },
                                        end_date: { type: ["string", "null"] },
                                    },
                                    required: [
                                        "company",
                                        "role",
                                        "start_date",
                                        "end_date",
                                    ],
                                },
                            },
                        },
                        required: ["total_years", "items"],
                    },
                    skills: {
                        type: "array",
                        items: { type: "string" },
                    },
                    preferred_roles: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                required: [
                    "personal",
                    "education",
                    "experience",
                    "skills",
                    "preferred_roles",
                ],
            },
        },
    });

    if (!response.text) {
        throw new Error("Gemini returned an empty response");
    }

    try {
        return JSON.parse(response.text);
    } catch (err) {
        throw new Error(
            `Failed to parse Gemini response as JSON: ${
                err instanceof Error ? err.message : String(err)
            }\nRaw response: ${response.text}`
        );
    }
}

async function generateWithRetry(
    request: any,
    maxRetries = 3
) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await ai.models.generateContent(request);
        } catch (error: any) {
            const status = error?.status;

            if (status !== 503 || attempt === maxRetries) {
                throw error;
            }

            const delay = Math.pow(2, attempt) * 1000;

            console.log(
                `Gemini temporarily unavailable. Retrying in ${delay}ms...`
            );

            await new Promise((resolve) =>
                setTimeout(resolve, delay)
            );
        }
    }

    throw new Error("Gemini request failed");
}

export default ai;