import { useEffect, useState } from "react";
import api from "../api/client";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "../context/AuthContext";

interface Skill {
  id: number;
  name: string;
  skill_type: string;
  aliases: string | null;
}

interface Profile {
  user_profile_id: number;
  name: string;
  email: string;
  degree: string | null;
  graduation_year: number | null;
  experience_years: number;
  preferred_locations: string | null;
  preferred_roles: string | null;
  skills: string[];
}

function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skillLoading, setSkillLoading] = useState(false);

  const [skillSearch, setSkillSearch] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [degree, setDegree] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [preferredLocations, setPreferredLocations] = useState("");
  const [preferredRoles, setPreferredRoles] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchProfile() {
      try {
        setLoading(true);

        const [profileResponse, skillsResponse] = await Promise.all([
          api.get(`/profiles/${user!.id}`),
          api.get("/skills"),
        ]);

        const data: Profile = profileResponse.data;

        setProfile(data);
        setAllSkills(skillsResponse.data);

        setName(data.name || "");
        setEmail(data.email || "");
        setDegree(data.degree || "");

        setGraduationYear(
          data.graduation_year
            ? String(data.graduation_year)
            : ""
        );

        setExperienceYears(
          String(data.experience_years ?? 0)
        );

        setPreferredLocations(
          data.preferred_locations || ""
        );

        setPreferredRoles(
          data.preferred_roles || ""
        );
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        showToast("We couldn't load your profile.", "error");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user, authLoading, showToast]);

  async function handleSave() {
    if (!user) return;

    try {
      setSaving(true);

      const response = await api.put(`/profiles/${user.id}`, {
        name,
        email,
        degree,
        graduation_year: graduationYear
          ? Number(graduationYear)
          : null,
        experience_years: experienceYears
          ? Number(experienceYears)
          : 0,
        preferred_locations: preferredLocations,
        preferred_roles: preferredRoles,
      });

      const updatedProfile = response.data.profile;

      setProfile((current) =>
        current
          ? {
              ...current,
              ...updatedProfile,
            }
          : current
      );

      showToast("Profile updated successfully.", "success");
    } catch (error) {
      console.error("Failed to update profile:", error);

      showToast(
        "Failed to update profile. Please try again.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSkill(skill: Skill) {
    if (!user) return;

    try {
      setSkillLoading(true);

      await api.post(`/profiles/${user.id}/skills`, {
        skill_id: skill.id,
      });

      setProfile((current) =>
        current
          ? {
              ...current,
              skills: [...current.skills, skill.name],
            }
          : current
      );

      setSkillSearch("");

      showToast(`${skill.name} added to your skills.`, "success");
    } catch (error: any) {
      console.error("Failed to add skill:", error);

      if (error.response?.status === 409) {
        showToast("This skill is already added.", "error");
      } else {
        showToast(
          "Failed to add skill. Please try again.",
          "error"
        );
      }
    } finally {
      setSkillLoading(false);
    }
  }

  async function handleRemoveSkill(skillName: string) {
    if (!user) return;

    try {
      const skill = allSkills.find(
        (item) => item.name === skillName
      );

      if (!skill) {
        return;
      }

      setSkillLoading(true);

      await api.delete(
        `/profiles/${user.id}/skills/${skill.id}`
      );

      setProfile((current) =>
        current
          ? {
              ...current,
              skills: current.skills.filter(
                (item) => item !== skillName
              ),
            }
          : current
      );

      showToast(
        `${skillName} removed from your skills.`,
        "success"
      );
    } catch (error) {
      console.error("Failed to remove skill:", error);

      showToast(
        "Failed to remove skill. Please try again.",
        "error"
      );
    } finally {
      setSkillLoading(false);
    }
  }

  const filteredSkills = allSkills.filter((skill) => {
    const alreadyAdded =
      profile?.skills.includes(skill.name);

    const matchesSearch =
      skill.name
        .toLowerCase()
        .includes(skillSearch.toLowerCase());

    return !alreadyAdded && matchesSearch;
  });

  if (authLoading || loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-40 animate-pulse rounded bg-gray-200" />

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="space-y-4 animate-pulse">
            <div className="h-10 rounded bg-gray-200" />
            <div className="h-10 rounded bg-gray-200" />
            <div className="h-10 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
        <div className="text-4xl">👤</div>

        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          Profile not found
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          We couldn't load your profile.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* HEADER */}

      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Job Radar
        </p>

        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Profile
        </h1>

        <p className="mt-2 max-w-2xl text-gray-500">
          Keep your profile and job preferences updated
          so Job Radar can find relevant opportunities.
        </p>
      </div>

      {/* PERSONAL INFORMATION */}

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Personal information
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Basic information used for your job profile.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Name */}

          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Full name
            </label>

            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
            />
          </div>

          {/* Email */}

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
            />
          </div>

          {/* Degree */}

          <div>
            <label
              htmlFor="degree"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Degree
            </label>

            <input
              id="degree"
              type="text"
              value={degree}
              onChange={(event) =>
                setDegree(event.target.value)
              }
              placeholder="e.g. B.Tech Information Technology"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
            />
          </div>

          {/* Graduation Year */}

          <div>
            <label
              htmlFor="graduation-year"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Graduation year
            </label>

            <input
              id="graduation-year"
              type="number"
              value={graduationYear}
              onChange={(event) =>
                setGraduationYear(event.target.value)
              }
              placeholder="2026"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
            />
          </div>

          {/* Experience */}

          <div>
            <label
              htmlFor="experience-years"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Experience
            </label>

            <input
              id="experience-years"
              type="number"
              min="0"
              step="0.5"
              value={experienceYears}
              onChange={(event) =>
                setExperienceYears(event.target.value)
              }
              placeholder="0"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
            />

            <p className="mt-1.5 text-xs text-gray-400">
              Enter 0 for a fresher profile.
            </p>
          </div>
        </div>
      </div>

      {/* JOB PREFERENCES */}

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Job preferences
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Tell Job Radar what kind of opportunities
            you're looking for.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {/* Locations */}

          <div>
            <label
              htmlFor="preferred-locations"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Preferred locations
            </label>

            <textarea
              id="preferred-locations"
              value={preferredLocations}
              onChange={(event) =>
                setPreferredLocations(event.target.value)
              }
              rows={3}
              placeholder="Bangalore, Hyderabad, Pune, Mumbai, Delhi NCR"
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
            />

            <p className="mt-1.5 text-xs text-gray-400">
              Separate multiple locations with commas.
            </p>
          </div>

          {/* Roles */}

          <div>
            <label
              htmlFor="preferred-roles"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Preferred roles
            </label>

            <textarea
              id="preferred-roles"
              value={preferredRoles}
              onChange={(event) =>
                setPreferredRoles(event.target.value)
              }
              rows={3}
              placeholder="Software Engineer, SDE, Full Stack Developer"
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
            />

            <p className="mt-1.5 text-xs text-gray-400">
              Separate multiple roles with commas.
            </p>
          </div>
        </div>
      </div>

      {/* SKILLS */}

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Skills
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Add the technologies and skills you have.
          </p>
        </div>

        {/* Current Skills */}

        <div className="flex flex-wrap gap-2">
          {profile.skills.length === 0 ? (
            <p className="text-sm text-gray-500">
              No skills added yet.
            </p>
          ) : (
            profile.skills.map((skill) => (
              <div
                key={skill}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5"
              >
                <span className="text-xs font-medium text-gray-700">
                  {skill}
                </span>

                <button
                  type="button"
                  disabled={skillLoading}
                  onClick={() =>
                    handleRemoveSkill(skill)
                  }
                  className="text-gray-400 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  title={`Remove ${skill}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Skill */}

        <div className="mt-6">
          <label
            htmlFor="skill-search"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Add a skill
          </label>

          <input
            id="skill-search"
            type="text"
            value={skillSearch}
            onChange={(event) =>
              setSkillSearch(event.target.value)
            }
            placeholder="Search skills..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
          />

          {/* Search Results */}

          {skillSearch.trim() && (
            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              {filteredSkills.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  No skills found.
                </div>
              ) : (
                filteredSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    disabled={skillLoading}
                    onClick={() =>
                      handleAddSkill(skill)
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="font-medium text-gray-800">
                      {skill.name}
                    </span>

                    <span className="text-xs text-gray-400">
                      + Add
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* SAVE */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-gray-900 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export default Profile;