import pool from "../config/db";
import he = require("he");

export async function getAllSkills(): Promise<
    {
        id: number;
        name: string;
        skillType: string;
        aliases?: string;
    }[]
> {
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

export function cleanJobDescription(
    description: string
): string {
    let cleaned = description;

    // Decode HTML entities
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
     *
     * This allows us to distinguish a real heading from
     * normal sentences containing the word "qualifications".
     */
    cleaned = cleaned.replace(
    /<p>\s*(?:<strong>|<b>)?\s*qualifications\s*(?:<\/strong>|<\/b>)?\s*<\/p>/gi,
    " QUALIFICATIONS SECTION "
);
    // Remove remaining HTML tags
    cleaned = cleaned.replace(
        /<[^>]*>/g,
        " "
    );

    cleaned = cleaned
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    return cleaned;
}

export async function extractJobSkills(
    description: string
): Promise<{
    required: {
        id: number;
        name: string;
        skillType: string;
    }[];

    niceToHave: {
        id: number;
        name: string;
        skillType: string;
    }[];
}> {
    const skills = await getAllSkills();

    const normalizedDescription =
        cleanJobDescription(description);

    /*
     * Sections that contain required skills.
     *
     * IMPORTANT:
     * Do not add plain "qualifications" here.
     *
     * A sentence such as:
     * "This role requires qualifications..."
     *
     * is NOT necessarily a requirements heading.
     *
     * Standalone HTML Qualifications headings are converted
     * to "qualifications_section" by cleanJobDescription().
     */
    const requiredSectionPattern =
        /\b(?:key skills\s*(?:&|and)\s*experience|key skills and experience|required qualifications|basic qualifications|minimum qualifications|qualifications section|what you(?:'|’)ll need|what we(?:'|’)re looking for|what you(?:'|’)ll bring)\b/gi;

    const preferredSectionPattern =
    /\b(?:nice\s*[-]?\s*to\s*have|preferred\s+qualifications?|preferred\s+skills?|preferred\s+experience|bonus\s+(?:skills?|qualifications?)|good\s+to\s+have)\b/gi;

    /*
     * Sections that should stop skill extraction.
     */
   const endingSectionPattern =
    /\b(?:ideal\s+candidate|what\s+you(?:'|’)ll\s+do|campaign\s+operations\s*&\s*troubleshooting|go[\s-]?to[\s-]?market\s*&\s*customer\s+support|cross[\s-]?functional\s+collaboration|creative\s+operations|about\s+(?:the\s+)?(?:team|company|us)|why\s+you(?:'|’)ll\s+love\s+this\s+role|what\s+we\s+offer|our\s+benefits|benefits|equal\s+opportunity|equal\s+opportunity\s+employer|eeo)\b/gi;
    
    /*
     * Find all required section headings.
     */
    const requiredSections = [
        ...normalizedDescription.matchAll(
            requiredSectionPattern
        ),
    ];

    /*
     * Find all nice-to-have section headings.
     */
    const preferredSections = [
        ...normalizedDescription.matchAll(
            preferredSectionPattern
        ),
    ];

    /*
     * Find all ending section headings.
     */
    const endingSections = [
        ...normalizedDescription.matchAll(
            endingSectionPattern
        ),
    ];

    /*
     * Get the position of a section heading.
     */
    const getMatchIndex = (
        match: RegExpMatchArray
    ): number => {
        return match.index ?? -1;
    };

    /*
     * Extract text between a section heading
     * and the next section heading.
     */
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

    /*
     * ------------------------------------------------
     * REQUIRED SECTIONS
     * ------------------------------------------------
     *
     * Multiple required sections are allowed.
     *
     * Example:
     *
     * Key Skills & Experience
     *        ↓
     * What We're Looking For
     *
     * Both contribute to REQUIRED skills.
     */

    const requiredTexts: string[] = [];

    for (const match of requiredSections) {
        const sectionStart =
            getMatchIndex(match);

        if (sectionStart === -1) {
            continue;
        }

        const nextSectionIndexes = [
            ...preferredSections.map(
                getMatchIndex
            ),

            ...requiredSections
                .filter(
                    (otherMatch) =>
                        getMatchIndex(
                            otherMatch
                        ) > sectionStart
                )
                .map(getMatchIndex),

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

    /*
     * ------------------------------------------------
     * NICE-TO-HAVE SECTIONS
     * ------------------------------------------------
     */

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

    /*
     * If no explicit required section exists,
     * do NOT treat the complete description
     * as required skills.
     */

    const requiredText =
        requiredTexts.join(" ");

    const niceToHaveText =
        niceToHaveTexts.join(" ");


        console.log("\nREQUIRED TEXT:");
console.log(requiredText);

console.log("\nNICE TO HAVE TEXT:");
console.log(niceToHaveText);
    /*
     * ------------------------------------------------
     * FIND SKILLS
     * ------------------------------------------------
     */

    const findSkills = (
        text: string
    ): {
        id: number;
        name: string;
        skillType: string;
    }[] => {
        return skills.filter((skill) => {
            const skillNames = [
                skill.name,
                ...(skill.aliases
                    ? skill.aliases.split(",")
                    : []),
            ];

            return skillNames.some((skillName) => {
                const normalizedSkill =
                    skillName
                        .trim()
                        .toLowerCase();

                if (!normalizedSkill) {
                    return false;
                }

                const escapedSkill =
                    normalizedSkill.replace(
                        /[.*+?^${}()|[\]\\]/g,
                        "\\$&"
                    );

                /*
                 * Match the skill as a complete word/phrase.
                 *
                 * Also allow plural forms.
                 *
                 * API  -> APIs
                 * React.js -> React.js
                 * Node.js -> Node.js
                 */
                const skillPattern =
                    new RegExp(
                        `(?<![a-z0-9])${escapedSkill}(?:s)?(?![a-z0-9])`,
                        "i"
                    );

                return skillPattern.test(text);
            });
        });
    };

    const requiredSkills =
        findSkills(requiredText);

    const niceToHaveSkills =
        findSkills(niceToHaveText);

    /*
     * Required skills always have priority.
     */
    const requiredSkillIds =
        new Set(
            requiredSkills.map(
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

    return {
        required: requiredSkills,
        niceToHave:
            filteredNiceToHaveSkills,
    };
}

export async function saveJobSkills(
    jobId: number,
    skills: {
        required: {
            id: number;
            name: string;
            skillType: string;
        }[];

        niceToHave: {
            id: number;
            name: string;
            skillType: string;
        }[];
    }
): Promise<void> {
    await pool.query(
        `DELETE FROM job_skills
         WHERE job_id = $1`,
        [jobId]
    );

    /*
     * Store required skills first.
     */
    const requiredSkillIds =
        new Set<number>();

    for (const skill of skills.required) {
        requiredSkillIds.add(skill.id);

        await pool.query(
            `INSERT INTO job_skills (
                job_id,
                skill_id,
                skill_type
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (job_id, skill_id)
            DO UPDATE SET
                skill_type = EXCLUDED.skill_type`,
            [
                jobId,
                skill.id,
                "REQUIRED",
            ]
        );
    }

    /*
     * Store nice-to-have skills only if
     * they are not already required.
     */
    for (const skill of skills.niceToHave) {
        if (
            requiredSkillIds.has(skill.id)
        ) {
            continue;
        }

        await pool.query(
            `INSERT INTO job_skills (
                job_id,
                skill_id,
                skill_type
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (job_id, skill_id)
            DO UPDATE SET
                skill_type = EXCLUDED.skill_type`,
            [
                jobId,
                skill.id,
                "NICE_TO_HAVE",
            ]
        );
    }
}