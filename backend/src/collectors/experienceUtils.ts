export function extractExperience(
    description?: string
): {
    min?: number;
    max?: number;
} {
    if (!description) {
        return {};
    }

    const text = description
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

    /*
     * Explicit fresher / entry-level wording
     */
    if (
        /\b(?:fresh\s+graduates?|new\s+graduates?|recent\s+graduates?|entry[\s-]?level)\b/i.test(
            text
        )
    ) {
        return {
            min: 0,
            max: 0,
        };
    }

    /*
     * Experience range:
     * 0-2 years
     * 1–3 years
     * 2 to 5 years
     */
    const rangeMatch = text.match(
        /(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*years?(?:\s+of\s+experience)?/i
    );

    if (rangeMatch) {
        return {
            min: Number(rangeMatch[1]),
            max: Number(rangeMatch[2]),
        };
    }

    /*
     * X+ years
     * 3+ years of experience
     */
    const plusMatch = text.match(
        /(\d+(?:\.\d+)?)\s*\+\s*years?(?:\s+of\s+experience)?/i
    );

    if (plusMatch) {
        return {
            min: Number(plusMatch[1]),
        };
    }

    /*
     * At least X years
     */
    const atLeastMatch = text.match(
        /at\s+least\s+(\d+(?:\.\d+)?)\s*years?(?:\s+of\s+experience)?/i
    );

    if (atLeastMatch) {
        return {
            min: Number(atLeastMatch[1]),
        };
    }

    /*
     * X years of experience
     */
    const singleMatch = text.match(
        /(\d+(?:\.\d+)?)\s*years?(?:\s+of)?\s+experience/i
    );

    if (singleMatch) {
        return {
            min: Number(singleMatch[1]),
            max: Number(singleMatch[1]),
        };
    }

    return {};
}