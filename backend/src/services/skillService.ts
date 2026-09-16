import pool from "../config/db";

export async function getAllSkills(): Promise<
    { id: number; name: string }[]
> {
    const result = await pool.query(
        `SELECT id, name
         FROM skills
         ORDER BY id`
    );

    return result.rows;
}

export async function extractJobSkills(
    description: string
): Promise<{
    required: { id: number; name: string }[];
    niceToHave: { id: number; name: string }[];
}> {
    const skills = await getAllSkills();

    const normalizedDescription =
    cleanJobDescription(description);

    const niceToHaveIndex =
    normalizedDescription.search(
        /\bnice\s*[-]?\s*to\s*have\b/i
    );

    const requiredText =
        niceToHaveIndex === -1
            ? normalizedDescription
            : normalizedDescription.substring(
                  0,
                  niceToHaveIndex
              );

    const niceToHaveText =
        niceToHaveIndex === -1
            ? ""
            : normalizedDescription.substring(
                  niceToHaveIndex
              );

    const findSkills = (
        text: string
    ): { id: number; name: string }[] => {
        return skills.filter((skill) => {
            const normalizedSkill =
                skill.name.toLowerCase();

            const skillPattern = new RegExp(
                `\\b${normalizedSkill.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                )}\\b`,
                "i"
            );

            return skillPattern.test(text);
        });
    };

    return {
        required: findSkills(requiredText),
        niceToHave: findSkills(niceToHaveText),
    };
}

function cleanJobDescription(
    description: string
): string {
    return description
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

export async function saveJobSkills(
    jobId: number,
    skills: {
        required: { id: number; name: string }[];
        niceToHave: { id: number; name: string }[];
    }
): Promise<void> {
    await pool.query(
        `DELETE FROM job_skills
         WHERE job_id = $1`,
        [jobId]
    );

    // Store required skills first
    const requiredSkillIds = new Set<number>();

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

    // Store nice-to-have skills only if
    // they are not already required
    for (const skill of skills.niceToHave) {
        if (requiredSkillIds.has(skill.id)) {
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