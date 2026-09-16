import { calculateRoleScore } from "./matchingService";

const preferredRoles =
    "Software Engineer, SDE, Full Stack Developer, Backend Developer, Data Analyst";

console.log(
    "Software Engineer:",
    calculateRoleScore(
        preferredRoles,
        "Software Engineer - Fresher"
    )
);

console.log(
    "Backend Engineer:",
    calculateRoleScore(
        preferredRoles,
        "Backend Software Engineer"
    )
);

console.log(
    "Data Analyst:",
    calculateRoleScore(
        preferredRoles,
        "Senior Data Analyst"
    )
);

console.log(
    "Marketing:",
    calculateRoleScore(
        preferredRoles,
        "Digital Marketing Specialist"
    )
);

console.log(
    "Counsel:",
    calculateRoleScore(
        preferredRoles,
        "Employment Counsel"
    )
);