import pool from "../config/db";
import he = require("he");


// ============================================================
// TYPES
// ============================================================

export interface Skill {
    id: number;
    name: string;
    skillType: string;
    aliases?: string;
}

export interface ExtractedSkill {
    id: number;
    name: string;
    skillType: string;
    requirementGroup?: number;
}

export interface ExtractedJobSkills {
    required: ExtractedSkill[];
    niceToHave: ExtractedSkill[];
}


// ============================================================
// GET ALL SKILLS
// ============================================================

export async function getAllSkills(): Promise<Skill[]> {
    const result = await pool.query(
        `SELECT
            id,
            name,
            skill_type AS "skillType",
            aliases
         FROM skills
         ORDER BY id`
    );

    return result.rows;
}


// ============================================================
// CLEAN JOB DESCRIPTION
// ============================================================

export function cleanJobDescription(
    description: string
): string {
    let cleaned = description;

    /*
     * Decode HTML entities multiple times.
     *
     * Some job descriptions contain things like:
     * &amp;nbsp;
     */
    for (let i = 0; i < 3; i++) {
        const decoded = he.decode(cleaned);

        if (decoded === cleaned) {
            break;
        }

        cleaned = decoded;
    }

    /*
     * Preserve standalone "Qualifications" HTML headings.
     *
     * Example:
     * <p><strong>Qualifications</strong></p>
     *
     * becomes:
     * QUALIFICATIONS_SECTION
     */
    cleaned = cleaned.replace(
        /<p>\s*(?:<strong>|<b>)?\s*qualifications\s*(?:<\/strong>|<\/b>)?\s*<\/p>/gi,
        " QUALIFICATIONS_SECTION "
    );

    /*
     * Preserve standalone Qualifications headings
     * in plain-text descriptions.
     */
    cleaned = cleaned.replace(
        /(?:^|\n)\s*qualifications\s*(?=\n|$)/gi,
        " QUALIFICATIONS_SECTION "
    );

    /*
     * Remove remaining HTML tags.
     */
    cleaned = cleaned.replace(
        /<[^>]*>/g,
        " "
    );

    /*
     * Normalize whitespace and lowercase everything.
     */
    cleaned = cleaned
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    return cleaned;
}


// ============================================================
// FIND SKILLS
// ============================================================

/*
 * Finds skills from a piece of text.
 *
 * IMPORTANT:
 * This function is outside extractJobSkills() so it can also
 * be used by findSkillGroups() and tests.
 */
export const findSkills = (
    text: string,
    skills: Skill[]
): ExtractedSkill[] => {
    return skills.filter((skill) => {
        const skillNames = [
            skill.name,
            ...(skill.aliases
                ? skill.aliases.split(",")
                : []),
        ];

        return skillNames.some((skillName) => {
            const normalizedSkill =
                skillName.trim().toLowerCase();

            if (!normalizedSkill) {
                return false;
            }

            /*
             * Special handling for SQL.
             *
             * Avoid matching SQL in phrases such as:
             * "cloud SQL"
             */
            if (normalizedSkill === "sql") {
                const sqlPattern =
                    /(?<!cloud\s)\bsql\b/i;

                return sqlPattern.test(text);
            }

            /*
             * Escape regex special characters.
             *
             * Example:
             * React.js -> React\.js
             */
            const escapedSkill =
                normalizedSkill.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );

            /*
             * Match complete words/phrases.
             *
             * Also allow plural forms:
             *
             * API -> APIs
             * React.js -> React.js
             * Node.js -> Node.js
             */
            const skillPattern = new RegExp(
                `(?<![a-z0-9])${escapedSkill}(?:s)?(?![a-z0-9])`,
                "i"
            );

            return skillPattern.test(text);
        });
    });
};


// ============================================================
// FIND REQUIREMENT GROUPS
// ============================================================

/*
 * Detects OR-based skill requirements.
 *
 * Example:
 *
 * "Proficiency in Python, Java, C#, Ruby, or Go."
 *
 * becomes:
 *
 * Group 1:
 *   Python
 *   Java
 *   C#
 *   Ruby
 *   Go
 *
 * Meaning:
 *
 * Python OR Java OR C# OR Ruby OR Go
 *
 * Only one skill from this group should be enough to
 * satisfy the requirement.
 */
export const findSkillGroups = (
    text: string,
    skills: Skill[]
): {
    skills: ExtractedSkill[];
    group: number;
}[] => {
    const results: {
        skills: ExtractedSkill[];
        group: number;
    }[] = [];

    let groupCounter = 0;

    /*
     * Split the text into reasonably independent chunks.
     *
     * We use:
     *  - sentence boundaries
     *  - semicolons
     *  - new lines
     *
     * This is more reliable for ATS/job-description text
     * than relying only on "."
     */
    const chunks = text
        .split(
            /(?<=[.!?;])\s+|\n+/
        )
        .map((chunk) => chunk.trim())
        .filter(Boolean);

    for (const chunk of chunks) {

        /*
         * We only consider a chunk if it contains
         * an explicit "or".
         */
        if (!/\bor\b/i.test(chunk)) {
            continue;
        }

        /*
         * Find skills inside this chunk.
         */
        const chunkSkills =
            findSkills(
                chunk,
                skills
            );

        /*
         * At least two skills are needed
         * to create an OR group.
         */
        if (chunkSkills.length < 2) {
            continue;
        }

        groupCounter++;

        results.push({
            skills: chunkSkills,
            group: groupCounter,
        });
    }

    return results;
};


// ============================================================
// EXTRACT JOB SKILLS
// ============================================================

export async function extractJobSkills(
    description: string
): Promise<ExtractedJobSkills> {

    const skills = await getAllSkills();

    const normalizedDescription =
        cleanJobDescription(description);


    // ========================================================
    // SECTION PATTERNS
    // ========================================================

    /*
     * Sections that contain required skills.
     *
     * IMPORTANT:
     * Do not add plain "qualifications" here.
     */
    const requiredSectionPattern =
        /\b(?:requirements|key skills\s*(?:&|and)\s*experience|key skills and experience|required qualifications|basic qualifications|minimum qualifications|required proficiency\s*(?:&|and)\s*qualifications|qualifications[_\s]+section|what do you(?:'|’)ll need|what we(?:'|’)re looking for|what you(?:'|’)ll bring|what you(?:'|’)ll bring to the role)\b/gi;


    /*
     * Sections containing preferred/nice-to-have skills.
     */
    const preferredSectionPattern =
        /\b(?:nice\s*[-]?\s*to\s*have|preferred\s+qualifications?|preferred\s+skills?|preferred\s+experience|bonus\s+(?:skills?|qualifications?)|good\s+to\s+have)\b/gi;


    /*
     * Sections where skill extraction should stop.
     */
    const endingSectionPattern =
        /\b(?:ideal\s+candidate|what\s+you(?:'|’)ll\s+do|campaign\s+operations\s*&\s*troubleshooting|go[\s-]?to[\s-]?market\s*&\s*customer\s+support|cross[\s-]?functional\s+collaboration|creative\s+operations|about\s+(?:the\s+)?(?:team|company|us)|why\s+you(?:'|’)ll\s+love\s+this\s+role|what\s+we\s+offer|our\s+benefits|benefits|equal\s+opportunity|equal\s+opportunity\s+employer|eeo)\b/gi;


    // ========================================================
    // FIND SECTION HEADINGS
    // ========================================================

    const requiredSections = [
        ...normalizedDescription.matchAll(
            requiredSectionPattern
        ),
    ];

    const preferredSections = [
        ...normalizedDescription.matchAll(
            preferredSectionPattern
        ),
    ];

    const endingSections = [
        ...normalizedDescription.matchAll(
            endingSectionPattern
        ),
    ];


    // ========================================================
    // HELPER: GET MATCH INDEX
    // ========================================================

    const getMatchIndex = (
        match: RegExpMatchArray
    ): number => {
        return match.index ?? -1;
    };


    // ========================================================
    // HELPER: EXTRACT SECTION TEXT
    // ========================================================

    const extractSectionText = (
        sectionStart: number,
        sectionLength: number,
        nextSectionIndexes: number[]
    ): string => {

        const contentStart =
            sectionStart + sectionLength;

        const validNextIndexes =
            nextSectionIndexes.filter(
                (index) =>
                    index > contentStart
            );

        const sectionEnd =
            validNextIndexes.length > 0
                ? Math.min(...validNextIndexes)
                : normalizedDescription.length;

        return normalizedDescription.substring(
            contentStart,
            sectionEnd
        );
    };


    // ========================================================
    // REQUIRED SECTIONS
    // ========================================================

    const requiredTexts: string[] = [];

    for (const match of requiredSections) {

        const sectionStart =
            getMatchIndex(match);

        if (sectionStart === -1) {
            continue;
        }

        const nextSectionIndexes = [

            /*
             * Preferred sections.
             */
            ...preferredSections.map(
                getMatchIndex
            ),

            /*
             * Later required sections.
             */
            ...requiredSections
                .filter(
                    (otherMatch) =>
                        getMatchIndex(
                            otherMatch
                        ) > sectionStart
                )
                .map(getMatchIndex),

            /*
             * Ending sections.
             */
            ...endingSections
                .filter(
                    (otherMatch) =>
                        getMatchIndex(
                            otherMatch
                        ) > sectionStart
                )
                .map(getMatchIndex),
        ];

        const sectionText =
            extractSectionText(
                sectionStart,
                match[0].length,
                nextSectionIndexes
            );

        requiredTexts.push(
            sectionText
        );
    }


    // ========================================================
    // NICE-TO-HAVE SECTIONS
    // ========================================================

    const niceToHaveTexts: string[] = [];

    for (const match of preferredSections) {

        const sectionStart =
            getMatchIndex(match);

        if (sectionStart === -1) {
            continue;
        }

        const nextSectionIndexes =
            endingSections.map(
                getMatchIndex
            );

        const sectionText =
            extractSectionText(
                sectionStart,
                match[0].length,
                nextSectionIndexes
            );

        niceToHaveTexts.push(
            sectionText
        );
    }


    // ========================================================
    // COMBINE SECTION TEXT
    // ========================================================

    const requiredText =
        requiredTexts.join(" ");

    const niceToHaveText =
        niceToHaveTexts.join(" ");


    // ========================================================
    // REMOVE OPTIONAL SKILL TEXT
    // ========================================================

    /*
     * Example:
     *
     * "Python is required. AWS is a plus, but not mandatory."
     *
     * The AWS sentence should not become a required skill.
     */
    const removeOptionalSkillText = (
        text: string
    ): string => {

        return text
            .split(/(?<=[.!?])\s+/)
            .filter((sentence) => {

                const lowerSentence =
                    sentence.toLowerCase();

                return !(
                    lowerSentence.includes("plus") &&
                    (
                        lowerSentence.includes(
                            "not mandatory"
                        ) ||
                        lowerSentence.includes(
                            "not required"
                        ) ||
                        lowerSentence.includes(
                            "optional"
                        )
                    )
                );
            })
            .join(" ");
    };


    // ========================================================
    // FIND REQUIRED SKILLS
    // ========================================================

    const cleanedRequiredText =
        removeOptionalSkillText(
            requiredText
        );

    const requiredSkills =
        findSkills(
            cleanedRequiredText,
            skills
        );


    // ========================================================
    // FIND REQUIREMENT GROUPS
    // ========================================================

    /*
     * Detect OR relationships inside required skills.
     *
     * Example:
     *
     * Python, Java, C#, Ruby, or Go
     *
     * All of these skills receive:
     *
     * requirementGroup = 1
     */
    const skillGroups =
        findSkillGroups(
            cleanedRequiredText,
            skills
        );


    /*
     * Map:
     *
     * skill ID -> requirement group
     */
    const groupedSkillIds =
        new Map<number, number>();

    for (const group of skillGroups) {

        for (const skill of group.skills) {

            groupedSkillIds.set(
                skill.id,
                group.group
            );
        }
    }


    /*
     * Attach requirementGroup to required skills.
     */
    const requiredSkillsWithGroups =
        requiredSkills.map(
            (skill) => {

                const requirementGroup =
                    groupedSkillIds.get(
                        skill.id
                    );

                return {
                    ...skill,
                    ...(requirementGroup !== undefined
                        ? {
                            requirementGroup
                        }
                        : {}),
                };
            }
        );


    // ========================================================
    // FIND NICE-TO-HAVE SKILLS
    // ========================================================

    let niceToHaveSkills =
        findSkills(
            niceToHaveText,
            skills
        );


    // ========================================================
    // ABOVE-MENTIONED STACK LOGIC
    // ========================================================

    const requirementsIndex =
        normalizedDescription.search(
            requiredSectionPattern
        );

    if (requirementsIndex !== -1) {

        const beforeRequirements =
            normalizedDescription.substring(
                0,
                requirementsIndex
            );

        const stackMatches = [
            ...beforeRequirements.matchAll(
                /[^.]*\b(?:stack|tech stack|technology stack)\b[^.]*/gi
            ),
        ];

        const stackSentence =
            stackMatches.length > 0
                ? stackMatches[
                    stackMatches.length - 1
                ][0]
                : "";

        const aboveMentionedStack =
            /above-mentioned stack[^.]*\b(?:helpful|preferred|plus)\b[^.]*\b(?:not necessary|not mandatory|not required)\b/i
                .test(
                    normalizedDescription
                );

        if (
            aboveMentionedStack &&
            stackSentence
        ) {

            const stackSkills =
                findSkills(
                    stackSentence,
                    skills
                );

            niceToHaveSkills = [
                ...niceToHaveSkills,
                ...stackSkills,
            ];
        }
    }


    // ========================================================
    // SECOND ABOVE-MENTIONED STACK CHECK
    // ========================================================

    const aboveMentionedStackMatch =
        normalizedDescription.match(
            /above-mentioned stack[^.]*\b(?:helpful|preferred|plus)\b[^.]*\b(?:not necessary|not mandatory|not required)\b[^.]*/i
        );

    if (aboveMentionedStackMatch) {

        const stackPosition =
            aboveMentionedStackMatch.index ??
            -1;

        if (stackPosition !== -1) {

            const textBeforeStack =
                normalizedDescription.substring(
                    0,
                    stackPosition
                );

            const sentences =
                textBeforeStack.split(
                    /[.!?]/
                );

            const previousSentence =
                sentences[
                    sentences.length - 1
                ];

            const stackSkills =
                findSkills(
                    previousSentence,
                    skills
                );

            niceToHaveSkills = [
                ...niceToHaveSkills,
                ...stackSkills,
            ];
        }
    }


    // ========================================================
    // REMOVE REQUIRED SKILLS FROM NICE-TO-HAVE
    // ========================================================

    /*
     * Required skills always have priority.
     */
    const requiredSkillIds =
        new Set(
            requiredSkillsWithGroups.map(
                (skill) => skill.id
            )
        );

    const filteredNiceToHaveSkills =
        niceToHaveSkills.filter(
            (skill) =>
                !requiredSkillIds.has(
                    skill.id
                )
        );


    // ========================================================
    // RETURN
    // ========================================================

    return {
        required:
            requiredSkillsWithGroups,

        niceToHave:
            filteredNiceToHaveSkills,
    };
}


// ============================================================
// SAVE JOB SKILLS
// ============================================================

export async function saveJobSkills(
    jobId: number,
    skills: {
        required: {
            id: number;
            name: string;
            skillType: string;
            requirementGroup?: number;
        }[];

        niceToHave: {
            id: number;
            name: string;
            skillType: string;
            requirementGroup?: number;
        }[];
    }
): Promise<void> {

    /*
     * Delete the old skill relationships first.
     *
     * This ensures that if the job description changes,
     * old skills/groups don't remain in the database.
     */
    await pool.query(
        `DELETE FROM job_skills
         WHERE job_id = $1`,
        [jobId]
    );


    // ========================================================
    // REQUIRED SKILLS
    // ========================================================

    /*
     * requirement_group meaning:
     *
     * Same group:
     *     Python OR Java OR C#
     *
     * Different groups:
     *     Python AND REST API AND PostgreSQL
     */
    const requiredSkillIds =
        new Set<number>();

    for (const skill of skills.required) {

        requiredSkillIds.add(
            skill.id
        );

        await pool.query(
            `INSERT INTO job_skills (
                job_id,
                skill_id,
                skill_type,
                requirement_group
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (job_id, skill_id)
            DO UPDATE SET
                skill_type = EXCLUDED.skill_type,
                requirement_group = EXCLUDED.requirement_group`,
            [
                jobId,
                skill.id,
                "REQUIRED",
                skill.requirementGroup ??
                    null,
            ]
        );
    }


    // ========================================================
    // NICE-TO-HAVE SKILLS
    // ========================================================

    for (const skill of skills.niceToHave) {

        /*
         * Required skills always have priority.
         */
        if (
            requiredSkillIds.has(
                skill.id
            )
        ) {
            continue;
        }

        await pool.query(
            `INSERT INTO job_skills (
                job_id,
                skill_id,
                skill_type,
                requirement_group
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (job_id, skill_id)
            DO UPDATE SET
                skill_type = EXCLUDED.skill_type,
                requirement_group = EXCLUDED.requirement_group`,
            [
                jobId,
                skill.id,
                "NICE_TO_HAVE",
                skill.requirementGroup ??
                    null,
            ]
        );
    }
}