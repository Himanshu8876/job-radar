import pool from "../config/db";
import { PoolClient } from "pg";

export interface MatchingUser {
    id: number;
    email: string;
}

export async function getUsersForMatching(): Promise<MatchingUser[]> {
    const result = await pool.query(
        `SELECT u.id, u.email
         FROM users u
         INNER JOIN user_profiles up
            ON up.id = u.id
         ORDER BY u.id`
    );

    return result.rows.map((user) => ({
        id: Number(user.id),
        email: user.email,
    }));
}

export async function calculateSkillScore(
    jobId: number,
    userProfileId: number
): Promise<number> {
    const result = await pool.query(
        `SELECT
            COUNT(
                CASE
                    WHEN js.skill_type = 'REQUIRED'
                    THEN 1
                END
            ) AS total_required_skills,

            COUNT(
                CASE
                    WHEN js.skill_type = 'REQUIRED'
                    AND ups.skill_id IS NOT NULL
                    THEN 1
                END
            ) AS matched_required_skills,

            COUNT(
                CASE
                    WHEN js.skill_type = 'NICE_TO_HAVE'
                    THEN 1
                END
            ) AS total_nice_to_have_skills,

            COUNT(
                CASE
                    WHEN js.skill_type = 'NICE_TO_HAVE'
                    AND ups.skill_id IS NOT NULL
                    THEN 1
                END
            ) AS matched_nice_to_have_skills

         FROM job_skills js

         LEFT JOIN user_profile_skills ups
            ON js.skill_id = ups.skill_id
            AND ups.user_profile_id = $2

         WHERE js.job_id = $1`,
        [jobId, userProfileId]
    );

    const totalRequiredSkills = Number(
        result.rows[0].total_required_skills
    );

    const matchedRequiredSkills = Number(
        result.rows[0].matched_required_skills
    );

    const totalNiceToHaveSkills = Number(
        result.rows[0].total_nice_to_have_skills
    );

    const matchedNiceToHaveSkills = Number(
        result.rows[0].matched_nice_to_have_skills
    );

    if (
    totalRequiredSkills === 0 &&
    totalNiceToHaveSkills === 0
) {
    return 0;
}

const requiredScore =
    totalRequiredSkills === 0
        ? 100
        : (matchedRequiredSkills / totalRequiredSkills) * 100;

    const niceToHaveScore =
        totalNiceToHaveSkills === 0
            ? 0
            : (matchedNiceToHaveSkills / totalNiceToHaveSkills) * 100;

    const skillScore =
        requiredScore * 0.80 +
        niceToHaveScore * 0.20;

    return Number(skillScore.toFixed(2));
}

export function calculateExperienceScore(
    userExperience: number,
    experienceMin?: number,
    experienceMax?: number
): number {
    // No experience requirement found
    if (
        experienceMin === undefined &&
        experienceMax === undefined
    ) {
        return 100;
    }

    // Minimum experience is not defined
    // but maximum is defined
    if (experienceMin === undefined) {
        return 100;
    }

    // User meets the minimum requirement
    if (userExperience >= experienceMin) {
        return 100;
    }

    // User has no experience
    if (userExperience <= 0) {
        return 0;
    }

    // User is below the minimum requirement
    const score =
        (userExperience / experienceMin) * 100;

    return Number(
        Math.max(0, Math.min(100, score)).toFixed(2)
    );
}

export function calculateLocationScore(
    preferredLocations: string,
    jobLocation?: string,
    country?: string,
    workplaceType?: string
): number {
    if (!jobLocation) {
        return 50;
    }

    const normalizedJobLocation =
        jobLocation.toLowerCase().trim();

    const normalizedCountry =
        country?.toLowerCase().trim();

    const normalizedWorkplaceType =
    workplaceType?.toLowerCase().trim();

    const locations = preferredLocations
        .split(",")
        .map((location) => normalizeCity(location))
        .filter(Boolean);

    // International remote jobs
    if (
    normalizedWorkplaceType === "remote" &&
    normalizedCountry !== "in" &&
    !normalizedJobLocation.includes("india")
) {
    return 0;
}

    // India remote jobs
    if (
    normalizedWorkplaceType === "remote" &&
    (
        normalizedCountry === "in" ||
        normalizedJobLocation.includes("india")
    )
) {
    return 100;
}

if (
    normalizedWorkplaceType === "hybrid" &&
    (
    normalizedCountry === "in" ||
    normalizedJobLocation.includes("india")
)
) {
    const hybridCityMatch = locations.some(
        (location) =>
            normalizedJobLocation.includes(location)
    );

    if (hybridCityMatch) {
        return 100;
    }
}
    // Bangalore / Bengaluru
    if (
        locations.includes("bangalore") &&
        (
            normalizedJobLocation.includes("bangalore") ||
            normalizedJobLocation.includes("bengaluru")
        )
    ) {
        return 100;
    }

    // Delhi NCR
    if (
        locations.includes("delhi ncr") &&
        (
            normalizedJobLocation.includes("delhi") ||
            normalizedJobLocation.includes("gurgaon") ||
            normalizedJobLocation.includes("gurugram") ||
            normalizedJobLocation.includes("noida")
        )
    ) {
        return 100;
    }

    // Other preferred cities
    const hasMatch = locations.some(
        (location) =>
            normalizedJobLocation.includes(location)
    );

    if (hasMatch) {
        return 100;
    }

    // India but different city / unspecified city
    if (
        normalizedCountry === "in" ||
        normalizedJobLocation.includes("india")
    ) {
        return 50;
    }

    // International non-remote
    return 0;
}


function normalizeCity(
    location: string
): string {
    const normalized =
        location
            .toLowerCase()
            .trim();

    const cityAliases: Record<string, string> = {
        bengaluru: "bangalore",
        bangalore: "bangalore",

        gurgaon: "delhi ncr",
        gurugram: "delhi ncr",
        noida: "delhi ncr",
        "new delhi": "delhi ncr",
        delhi: "delhi ncr",

        mumbai: "mumbai",
        bombay: "mumbai",

        hyderabad: "hyderabad",

        pune: "pune",
    };
    

    return cityAliases[normalized] || normalized;
}

export function calculateRoleScore(
    preferredRoles: string,
    jobTitle: string
): number {
    if (!preferredRoles || !jobTitle) {
        return 0;
    }

    const roles = preferredRoles
        .split(",")
        .map((role) =>
            role.trim().toLowerCase()
        )
        .filter(Boolean);

    const normalizedJobTitle =
        jobTitle
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const roleAliases: Record<string, string[]> = {
        sde: [
            "software engineer",
            "software development engineer",
            "sde",
        ],
        "software engineer": [
            "software engineer",
            "software development engineer",
            "sde",
            "software developer",
        ],
        "software developer": [
            "software engineer",
            "software development engineer",
            "software developer",
            "sde",
        ],
        "full stack developer": [
            "full stack developer",
            "full stack engineer",
            "fullstack developer",
            "fullstack engineer",
        ],
        "frontend developer": [
            "frontend developer",
            "frontend engineer",
            "front end developer",
            "front end engineer",
        ],
        "backend developer": [
            "backend developer",
            "backend engineer",
            "back end developer",
            "back end engineer",
        ],
        "data analyst": [
            "data analyst",
        ],
    };

    const relatedRoles: Record<string, string[]> = {
        "software engineer": [
            "web developer",
            "machine learning engineer",
        ],
        sde: [
            "web developer",
            "machine learning engineer",
        ],
        "data analyst": [
            "data engineer",
        ],
    };

    for (const role of roles) {
        const possibleTitles = roleAliases[role] || [role];

        for (const title of possibleTitles) {
            if (normalizedJobTitle.includes(title)) {
                return 100;
            }
        }

        const relatedTitles = relatedRoles[role] || [];

        for (const title of relatedTitles) {
            if (normalizedJobTitle.includes(title)) {
                return 50;
            }
        }
    }

return 0;
}

export type JobSeniority =
    | "INTERN"
    | "FRESHER"
    | "JUNIOR"
    | "STANDARD"
    | "SENIOR"
    | "STAFF"
    | "LEAD"
    | "PRINCIPAL"
    | "EXECUTIVE"
    | "MANAGER";

export function getJobSeniority(
    jobTitle: string
): JobSeniority {
    const title = jobTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // Most specific seniority levels first

    // Internship
    if (
        /\bintern(ship)?\b/.test(title)
    ) {
        return "INTERN";
    }

    // Fresher / Graduate / Entry Level
    if (
        /\bfresher\b/.test(title) ||
        /\bgraduate\b/.test(title) ||
        /\bentry[\s-]?level\b/.test(title)
    ) {
        return "FRESHER";
    }

    // Executive level
    if (
        /\bvp\b/.test(title) ||
        /\bvice president\b/.test(title)
    ) {
        return "EXECUTIVE";
    }

    // Principal
    if (
        /\bprincipal\b/.test(title)
    ) {
        return "PRINCIPAL";
    }

    // Staff
    if (
        /\bstaff\b/.test(title)
    ) {
        return "STAFF";
    }

    // Lead
    if (
        /\blead\b/.test(title)
    ) {
        return "LEAD";
    }

    if (
    /\barchitect\b/.test(title)
) {
    return "SENIOR";
}

    // Manager
    if (
        /\bmanager\b/.test(title) ||
        /\bmanagement\b/.test(title)
    ) {
        return "MANAGER";
    }

    // Director
    if (
        /\bdirector\b/.test(title)
    ) {
        return "SENIOR";
    }

    // Engineering levels such as:
    // SDE II, SDE III, SDE IV, SDE V
    // Software Development Engineer II/III/IV/V
    // SDET II/III/IV/V
   if (
    /\bsde\s*(ii|iii|iv|v)\b/.test(title) ||
    /\bsoftware development engineer\s*(ii|iii|iv|v)\b/.test(title) ||
    /\bsdet\s*(ii|iii|iv|v)\b/.test(title) ||
    /\bengineer\s+in\s+test\s+(ii|iii|iv|v)\b/.test(title)
) {
    return "SENIOR";
}

    // Senior
    if (
        /\bsenior\b/.test(title) ||
        /\bsr\b/.test(title)
    ) {
        return "SENIOR";
    }

    // Junior
    if (
        /\bjunior\b/.test(title) ||
        /\bjr\b/.test(title)
    ) {
        return "JUNIOR";
    }

    // Associate
    if (
        /\bassociate\b/.test(title)
    ) {
        const technicalKeywords = [
            "software",
            "developer",
            "engineer",
            "sde",
            "frontend",
            "front end",
            "backend",
            "back end",
            "full stack",
            "data analyst",
            "data engineer",
            "qa engineer",
            "test engineer",
        ];

        const isTechnicalAssociate =
            technicalKeywords.some((keyword) =>
                title.includes(keyword)
            );

        return isTechnicalAssociate
            ? "JUNIOR"
            : "STANDARD";
    }

    return "STANDARD";
}

export function calculateSeniorityScore(
    seniority: JobSeniority
): number {
    switch (seniority) {
        case "INTERN":
            return 100;

        case "FRESHER":
            return 100;

        case "JUNIOR":
            return 90;

        case "STANDARD":
            return 80;

        case "SENIOR":
            return 30;

        case "STAFF":
            return 10;

        case "LEAD":
            return 10;

        case "PRINCIPAL":
            return 5;

        case "MANAGER":
            return 5;

        case "EXECUTIVE":
            return 0;

        default:
            return 0;
    }
}

export function calculateEducationScore(
    userDegree: string,
    jobDescription?: string
): number {
    // No job description
    if (!jobDescription) {
        return 100;
    }

    const normalizedDegree =
        userDegree.toLowerCase();

    const normalizedDescription =
        jobDescription.toLowerCase();

    // Bachelor's degree keywords
    const bachelorKeywords = [
        "b.tech",
        "btech",
        "b.e.",
        "be degree",
        "bachelor",
        "b.s.",
        "bs degree",
    ];

    const jobRequiresBachelor =
        bachelorKeywords.some((keyword) =>
            normalizedDescription.includes(keyword)
        );

    // No clear education requirement
    if (!jobRequiresBachelor) {
        return 100;
    }

    // Check user's degree
    const userHasBachelor =
        normalizedDegree.includes("b.tech") ||
        normalizedDegree.includes("btech") ||
        normalizedDegree.includes("b.e") ||
        normalizedDegree.includes("bachelor") ||
        normalizedDegree.includes("b.s") ||
        normalizedDegree.includes("bs");

    return userHasBachelor ? 100 : 0;
}

export function generateMatchReason(
    skillScore: number,
    roleScore: number,
    experienceScore: number,
    seniorityScore: number,
    locationScore: number,
    educationScore: number
): string {
    const reasons: string[] = [];

    // Skills
    if (skillScore >= 80) {
        reasons.push("Strong skill match");
    } else if (skillScore >= 50) {
        reasons.push("Moderate skill match");
    } else if (skillScore > 0) {
        reasons.push("Limited skill match");
    } else {
        reasons.push("No matching skills");
    }

    // Role
    if (roleScore === 100) {
        reasons.push("Preferred role matches");
    } else if (roleScore === 50) {
        reasons.push("Role is partially related to preferences");
    }

    // Experience
    if (experienceScore === 100) {
        reasons.push("Experience requirement satisfied");
    } else if (experienceScore > 0) {
        reasons.push("Partially meets experience requirement");
    } else {
        reasons.push("Does not meet minimum experience");
    }

    // Seniority
    if (seniorityScore >= 90) {
        reasons.push("Entry-level position");
    } else if (seniorityScore >= 70) {
        reasons.push("Standard-level position");
    } else if (seniorityScore >= 30) {
        reasons.push("Senior-level position");
    } else {
        reasons.push("Highly senior position");
    }

    // Location
    // Location
if (locationScore === 100) {
    reasons.push("Preferred location matches");
} else if (locationScore === 50) {
    reasons.push("India location matches, but preferred city is not specified");
} else {
    reasons.push("Location does not match preferences");
}

    // Education
    if (educationScore === 100) {
        reasons.push("Education requirement satisfied");
    } else {
        reasons.push("Education requirement not satisfied");
    }

    return reasons.join(". ") + ".";
}

export function calculateOverallScore(
    skillScore: number,
    roleScore: number,
    experienceScore: number,
    seniorityScore: number,
    locationScore: number,
    educationScore: number
): number {
    const overallScore =
        skillScore * 0.35 +
        roleScore * 0.20 +
        experienceScore * 0.20 +
        seniorityScore * 0.15 +
        locationScore * 0.05 +
        educationScore * 0.05;

    return Number(
        overallScore.toFixed(2)
    );
}

export async function getUserProfileForMatching(
    userProfileId: number
) {
    const result = await pool.query(
        `SELECT
            id,
            degree,
            experience_years,
            preferred_locations,
            preferred_roles
         FROM user_profiles
         WHERE id = $1`,
        [userProfileId]
    );

    if (result.rows.length === 0) {
        throw new Error(
            `User profile ${userProfileId} not found`
        );
    }

    return result.rows[0];
}

export async function calculateJobMatch(
    jobId: number,
    userProfileId: number
) {
    const profile =
        await getUserProfileForMatching(userProfileId);

   const jobResult = await pool.query(
    `SELECT
        id,
        title,
        description,
        location,
        country,
        workplace_type,
        experience_min,
        experience_max
     FROM jobs
     WHERE id = $1`,
    [jobId]
);

    if (jobResult.rows.length === 0) {
        throw new Error(
            `Job ${jobId} not found`
        );
    }

    const job = jobResult.rows[0];

    const skillScore =
        await calculateSkillScore(
            jobId,
            userProfileId
        );

    const experienceScore =
        calculateExperienceScore(
            Number(profile.experience_years),
            job.experience_min !== null
                ? Number(job.experience_min)
                : undefined,
            job.experience_max !== null
                ? Number(job.experience_max)
                : undefined
        );

    const seniorityScore =
        calculateSeniorityScore(
            getJobSeniority(job.title)
        );

    const locationScore =
    calculateLocationScore(
        profile.preferred_locations,
        job.location,
        job.country,
        job.workplace_type
    );
    
        const roleScore =
        calculateRoleScore(
            profile.preferred_roles,
            job.title
        );
    const educationScore =
        calculateEducationScore(
            profile.degree,
            job.description
        );

        const reason =
    generateMatchReason(
        skillScore,
        roleScore,
        experienceScore,
        seniorityScore,
        locationScore,
        educationScore
    );

    const overallScore =
    calculateOverallScore(
        skillScore,
        roleScore,
        experienceScore,
        seniorityScore,
        locationScore,
        educationScore
    );

    return {
    jobId: job.id,
    jobTitle: job.title,
    skillScore,
    roleScore,
    experienceScore,
    locationScore,
    educationScore,
    seniorityScore,
    overallScore,
    reason,
};
}

export async function saveJobMatch(
    jobId: number,
    userProfileId: number,
    skillScore: number,
    roleScore: number,
    experienceScore: number,
    locationScore: number,
    educationScore: number,
    seniorityScore: number,
    overallScore: number,
    reason?: string
): Promise<void> {
   await pool.query(
    `INSERT INTO job_matches (
        job_id,
        user_profile_id,
        score,
        skill_score,
        role_score,
        experience_score,
        location_score,
        education_score,
        seniority_score,
        reason
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (job_id, user_profile_id)
    DO UPDATE SET
        score = EXCLUDED.score,
        skill_score = EXCLUDED.skill_score,
        role_score = EXCLUDED.role_score,
        experience_score = EXCLUDED.experience_score,
        location_score = EXCLUDED.location_score,
        education_score = EXCLUDED.education_score,
        seniority_score = EXCLUDED.seniority_score,
        reason = EXCLUDED.reason`,
    [
        jobId,
        userProfileId,
        overallScore,
        skillScore,
        roleScore,
        experienceScore,
        locationScore,
        educationScore,
        seniorityScore,
        reason,
    ]
);
}

export async function markJobsAsEmailed(
    jobIds: number[],
    userProfileId: number
): Promise<void> {
    await pool.query(
        `UPDATE job_matches
         SET email_sent_at = CURRENT_TIMESTAMP
         WHERE job_id = ANY($1)
           AND user_profile_id = $2`,
        [jobIds, userProfileId]
    );
}

export async function getMatchesForUser(
    userProfileId: number
) {
    const result = await pool.query(
        `SELECT
            jm.*,
            j.title,
            j.location,
            j.country,
            j.application_url,
            j.workplace_type,
            j.experience_min,
            j.experience_max,
            j.first_seen_at,
            jm.email_sent_at,
           CASE
    WHEN jm.email_sent_at IS NULL
    THEN TRUE
    ELSE FALSE
END AS is_new,
            c.name AS company_name
         FROM job_matches jm
         JOIN jobs j
            ON jm.job_id = j.id
         JOIN companies c
            ON j.company_id = c.id
         JOIN user_profiles up
            ON up.id = $1
        WHERE jm.user_profile_id = $1
AND jm.role_score > 0
AND jm.seniority_score >= 80
AND j.closed_at IS NULL
AND jm.location_score > 0
AND (
    j.experience_min IS NULL
    OR j.experience_min <= up.experience_years
)
AND NOT EXISTS (
    SELECT 1
    FROM applications a
    WHERE a.job_id = j.id
      AND a.user_profile_id = $1
)
ORDER BY jm.score DESC`,
        [userProfileId]
    );
    const newJobs = result.rows.filter(
    (job) => job.is_new
).length;
    

    return {
    jobs: result.rows,
    newJobs
};
    
}

interface MatchingJob {
    id: number;
    title: string;
    description: string;
    location?: string;
    country?: string;
    workplace_type?: string;
    experience_min?: number;
    experience_max?: number;
}

interface SkillScoreCounts {
    totalRequiredSkills: number;
    matchedRequiredSkills: number;
    totalNiceToHaveSkills: number;
    matchedNiceToHaveSkills: number;
}

interface MatchToSave {
    jobId: number;
    skillScore: number;
    roleScore: number;
    experienceScore: number;
    locationScore: number;
    educationScore: number;
    seniorityScore: number;
    overallScore: number;
    reason: string;
}

const MATCHING_JOB_BATCH_SIZE = 250;

function calculateSkillScoreFromCounts(
    counts: SkillScoreCounts
): number {
    if (
        counts.totalRequiredSkills === 0 &&
        counts.totalNiceToHaveSkills === 0
    ) {
        return 0;
    }

    const requiredScore =
        counts.totalRequiredSkills === 0
            ? 100
            : (counts.matchedRequiredSkills / counts.totalRequiredSkills) * 100;

    const niceToHaveScore =
        counts.totalNiceToHaveSkills === 0
            ? 0
            : (counts.matchedNiceToHaveSkills / counts.totalNiceToHaveSkills) * 100;

    return Number(
        (requiredScore * 0.80 + niceToHaveScore * 0.20).toFixed(2)
    );
}

async function saveJobMatchesInBatches(
    matches: MatchToSave[],
    userProfileId: number,
    ensureOwnership?: (client?: PoolClient) => Promise<void>
): Promise<void> {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        await ensureOwnership?.(client);
        const values: unknown[] = [];
        const rows = matches.map((match, index) => {
            const offset = index * 10;
            values.push(
                match.jobId,
                userProfileId,
                match.overallScore,
                match.skillScore,
                match.roleScore,
                match.experienceScore,
                match.locationScore,
                match.educationScore,
                match.seniorityScore,
                match.reason
            );

            return `(${Array.from(
                { length: 10 },
                (_, valueIndex) => `$${offset + valueIndex + 1}`
            ).join(", ")})`;
        });

        await client.query(
            `INSERT INTO job_matches (
                job_id,
                user_profile_id,
                score,
                skill_score,
                role_score,
                experience_score,
                location_score,
                education_score,
                seniority_score,
                reason
            )
            VALUES ${rows.join(", ")}
            ON CONFLICT (job_id, user_profile_id)
            DO UPDATE SET
                score = EXCLUDED.score,
                skill_score = EXCLUDED.skill_score,
                role_score = EXCLUDED.role_score,
                experience_score = EXCLUDED.experience_score,
                location_score = EXCLUDED.location_score,
                education_score = EXCLUDED.education_score,
                seniority_score = EXCLUDED.seniority_score,
                reason = EXCLUDED.reason
            WHERE (
                job_matches.score,
                job_matches.skill_score,
                job_matches.role_score,
                job_matches.experience_score,
                job_matches.location_score,
                job_matches.education_score,
                job_matches.seniority_score,
                job_matches.reason
            ) IS DISTINCT FROM (
                EXCLUDED.score,
                EXCLUDED.skill_score,
                EXCLUDED.role_score,
                EXCLUDED.experience_score,
                EXCLUDED.location_score,
                EXCLUDED.education_score,
                EXCLUDED.seniority_score,
                EXCLUDED.reason
            )`,
            values
        );

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

function logMatchingMemory(
    userProfileId: number,
    batchNumber: number,
    processedJobs: number
): void {
    const { rss, heapUsed, heapTotal } = process.memoryUsage();
    const toMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
    console.info(
        `Match generation batch ${batchNumber} for profile ${userProfileId}: ` +
        `${processedJobs} jobs processed; memory rss=${toMb(rss)}MB, ` +
        `heap=${toMb(heapUsed)}/${toMb(heapTotal)}MB`
    );
}

async function generateAndSaveMatchBatch(
    userProfileId: number,
    profile: Awaited<ReturnType<typeof getUserProfileForMatching>>,
    afterJobId: number | null,
    maxJobId: number,
    ensureOwnership?: (client?: PoolClient) => Promise<void>
): Promise<{
    processedJobs: number;
    lastJobId: number;
    timings: { jobsMs: number; skillsMs: number; scoringMs: number; writeMs: number };
} | null> {
    const jobsStartedAt = Date.now();
    const jobsResult = await pool.query(
        `SELECT
            id,
            title,
            description,
            location,
            country,
            workplace_type,
            experience_min,
            experience_max
         FROM jobs
         WHERE closed_at IS NULL
           AND ($1 IS NULL OR id > $1)
           AND id <= $2
         ORDER BY id
         LIMIT $3`,
        [afterJobId, maxJobId, MATCHING_JOB_BATCH_SIZE]
    );
    const jobs = jobsResult.rows as MatchingJob[];
    const jobsMs = Date.now() - jobsStartedAt;

    if (jobs.length === 0) {
        return null;
    }

    await ensureOwnership?.();
    const jobIds = jobs.map((job) => Number(job.id));
    const skillsStartedAt = Date.now();
    const skillResult = await pool.query(
        `SELECT
            js.job_id,
            js.skill_type,
            COUNT(*) AS total_skills,
            COUNT(ups.skill_id) AS matched_skills
         FROM jobs j
         INNER JOIN job_skills js
            ON js.job_id = j.id
         LEFT JOIN user_profile_skills ups
            ON ups.skill_id = js.skill_id
            AND ups.user_profile_id = $1
         WHERE j.closed_at IS NULL
           AND js.job_id = ANY($2::int[])
         GROUP BY js.job_id, js.skill_type`,
        [userProfileId, jobIds]
    );
    const skillsMs = Date.now() - skillsStartedAt;

    const skillCounts = new Map<number, SkillScoreCounts>();
    for (const row of skillResult.rows) {
        const jobId = Number(row.job_id);
        const counts = skillCounts.get(jobId) || {
            totalRequiredSkills: 0,
            matchedRequiredSkills: 0,
            totalNiceToHaveSkills: 0,
            matchedNiceToHaveSkills: 0,
        };

        if (row.skill_type === "REQUIRED") {
            counts.totalRequiredSkills = Number(row.total_skills);
            counts.matchedRequiredSkills = Number(row.matched_skills);
        } else if (row.skill_type === "NICE_TO_HAVE") {
            counts.totalNiceToHaveSkills = Number(row.total_skills);
            counts.matchedNiceToHaveSkills = Number(row.matched_skills);
        }

        skillCounts.set(jobId, counts);
    }

    const scoringStartedAt = Date.now();
    const matches: MatchToSave[] = [];

    for (const job of jobs) {
        const skillScore = calculateSkillScoreFromCounts(
            skillCounts.get(Number(job.id)) || {
                totalRequiredSkills: 0,
                matchedRequiredSkills: 0,
                totalNiceToHaveSkills: 0,
                matchedNiceToHaveSkills: 0,
            }
        );
        const experienceScore = calculateExperienceScore(
            Number(profile.experience_years),
            job.experience_min !== null && job.experience_min !== undefined
                ? Number(job.experience_min)
                : undefined,
            job.experience_max !== null && job.experience_max !== undefined
                ? Number(job.experience_max)
                : undefined
        );
        const seniorityScore = calculateSeniorityScore(
            getJobSeniority(job.title)
        );
        const locationScore = calculateLocationScore(
            profile.preferred_locations,
            job.location,
            job.country,
            job.workplace_type
        );
        const roleScore = calculateRoleScore(
            profile.preferred_roles,
            job.title
        );
        const educationScore = calculateEducationScore(
            profile.degree,
            job.description
        );
        const reason = generateMatchReason(
            skillScore,
            roleScore,
            experienceScore,
            seniorityScore,
            locationScore,
            educationScore
        );

        matches.push({
            jobId: Number(job.id),
            skillScore,
            roleScore,
            experienceScore,
            locationScore,
            educationScore,
            seniorityScore,
            overallScore: calculateOverallScore(
                skillScore,
                roleScore,
                experienceScore,
                seniorityScore,
                locationScore,
                educationScore
            ),
            reason,
        });
    }
    const scoringMs = Date.now() - scoringStartedAt;

    const writeStartedAt = Date.now();
    await saveJobMatchesInBatches(matches, userProfileId, ensureOwnership);
    const writeMs = Date.now() - writeStartedAt;

    return {
        processedJobs: matches.length,
        lastJobId: jobIds[jobIds.length - 1],
        timings: { jobsMs, skillsMs, scoringMs, writeMs },
    };
}

export async function generateMatchesForUser(
    userProfileId: number,
    ensureOwnership?: (client?: PoolClient) => Promise<void>
): Promise<{
    processedJobs: number;
}> {
    const startedAt = Date.now();
    let stage = "profile";

    try {
        await ensureOwnership?.();
        const profileStartedAt = Date.now();
        const profile = await getUserProfileForMatching(userProfileId);
        const profileDurationMs = Date.now() - profileStartedAt;

        stage = "job range";
        const jobRangeStartedAt = Date.now();
        const maxJobResult = await pool.query<{ max_job_id: number | null }>(
            `SELECT MAX(id) AS max_job_id
             FROM jobs
             WHERE closed_at IS NULL`
        );
        const maxJobId = maxJobResult.rows[0].max_job_id === null
            ? null
            : Number(maxJobResult.rows[0].max_job_id);
        const jobRangeMs = Date.now() - jobRangeStartedAt;

        if (maxJobId === null) {
            console.info(
                `Match generation completed for profile ${userProfileId}: 0 jobs; ` +
                `profile=${profileDurationMs}ms, jobRange=${jobRangeMs}ms, ` +
                `total=${Date.now() - startedAt}ms`
            );
            return { processedJobs: 0 };
        }

        let processedJobs = 0;
        let lastJobId: number | null = null;
        let batchNumber = 0;

        while (lastJobId === null || lastJobId < maxJobId) {
            stage = `batch ${batchNumber + 1}`;
            await ensureOwnership?.();
            const batch = await generateAndSaveMatchBatch(
                userProfileId,
                profile,
                lastJobId,
                maxJobId,
                ensureOwnership
            );

            if (!batch) {
                break;
            }

            batchNumber += 1;
            processedJobs += batch.processedJobs;
            lastJobId = batch.lastJobId;
            console.info(
                `Match generation batch ${batchNumber} completed for profile ${userProfileId}: ` +
                `${batch.processedJobs} jobs; total=${processedJobs}; ` +
                `jobs=${batch.timings.jobsMs}ms, skills=${batch.timings.skillsMs}ms, ` +
                `scoring=${batch.timings.scoringMs}ms, write=${batch.timings.writeMs}ms`
            );
            logMatchingMemory(userProfileId, batchNumber, processedJobs);
        }

        const totalDurationMs = Date.now() - startedAt;

        console.info(
            `Match generation completed for profile ${userProfileId}: ` +
            `${processedJobs} jobs in ${batchNumber} batches; ` +
            `profile=${profileDurationMs}ms, jobRange=${jobRangeMs}ms, ` +
            `total=${totalDurationMs}ms`
        );

        return { processedJobs };
    } catch (error) {
        console.error(
            `Match generation failed for profile ${userProfileId} during ${stage} ` +
            `after ${Date.now() - startedAt}ms:`,
            error
        );
        throw error;
    }
}