import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
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
  resume_url: string | null;
  skills: string[];
}

interface ResumeExperienceItem {
  company?: string | null;
  role?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

interface ExtractedResume {
  personal?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
  };
  education?: {
    degree?: string | null;
    field?: string | null;
    college?: string | null;
    graduation_year?: number | null;
  };
  experience?: {
    total_years?: number;
    items?: ResumeExperienceItem[];
  };
  skills?: string[];
  preferred_roles?: string[];
}

interface ResumeReview {
  name: string;
  email: string;
  degree: string;
  graduationYear: string;
  experienceYears: string;
  preferredLocations: string;
  preferredRoles: string;
  phone: string;
  location: string;
  field: string;
  college: string;
  skills: string[];
  experienceItems: ResumeExperienceItem[];
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

    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [resumeUploading, setResumeUploading] = useState(false);
    const [resumeExtracting, setResumeExtracting] = useState(false);
    const [extractedResume, setExtractedResume] =
      useState<ExtractedResume | null>(null);
  const [resumeReview, setResumeReview] =
    useState<ResumeReview | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [addingExtractedSkills, setAddingExtractedSkills] =
    useState(false);

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

  async function handleResumeUpload() {
    if (!user) return;

    if (!resumeFile) {
      showToast("Please select a PDF resume.", "error");
      return;
    }

    try {
      setResumeUploading(true);

      const formData = new FormData();
      formData.append("resume", resumeFile);

      const response = await api.post("/resumes/resume", formData);

      setProfile((current) =>
        current
          ? { ...current, resume_url: response.data.resumeUrl }
          : current
      );

      setExtractedResume(null);
      showToast("Resume uploaded successfully.", "success");

      setResumeFile(null);
    } catch (error: any) {
      console.error("Resume upload failed:", error);

      showToast(
        error.response?.data?.message ||
          "Failed to upload resume. Please try again.",
        "error"
      );
    } finally {
      setResumeUploading(false);
    }
  }

  async function handleResumeExtract() {
    if (!user) return;

    try {
      setResumeExtracting(true);

      const response = await api.get("/resumes/extract");

      const data: ExtractedResume = response.data.data;

      setExtractedResume(data);
      setResumeReview({
        name: data.personal?.name ?? name,
        email: data.personal?.email ?? email,
        degree: data.education?.degree ?? degree,
        graduationYear:
          data.education?.graduation_year !== null &&
          data.education?.graduation_year !== undefined
            ? String(data.education.graduation_year)
            : graduationYear,
        experienceYears:
          data.experience?.total_years !== undefined
            ? String(data.experience.total_years)
            : experienceYears,
        preferredLocations: data.personal?.location ?? preferredLocations,
        preferredRoles:
          data.preferred_roles?.join(", ") ?? preferredRoles,
        phone: data.personal?.phone ?? "",
        location: data.personal?.location ?? "",
        field: data.education?.field ?? "",
        college: data.education?.college ?? "",
        skills: data.skills ?? [],
        experienceItems: data.experience?.items ?? [],
      });

      showToast(
        "Resume information extracted successfully.",
        "success"
      );
    } catch (error: any) {
      console.error("Resume extraction failed:", error);

      showToast(
        error.response?.data?.message ||
          "Failed to extract resume information.",
        "error"
      );
    } finally {
      setResumeExtracting(false);
    }
  }

  function handleResumeFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      setResumeFile(null);
      return;
    }

    if (file.type !== "application/pdf") {
      showToast("Only PDF resumes are allowed.", "error");
      event.target.value = "";
      setResumeFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Resume must be smaller than 5 MB.", "error");
      event.target.value = "";
      setResumeFile(null);
      return;
    }

    setResumeFile(file);
  }

  async function handleConfirmResumeReview() {
    if (!user || !resumeReview) return;

    try {
      setReviewSaving(true);

      const reviewedProfile = {
        name: resumeReview.name,
        email: resumeReview.email,
        degree: resumeReview.degree,
        graduation_year: resumeReview.graduationYear
          ? Number(resumeReview.graduationYear)
          : null,
        experience_years: resumeReview.experienceYears
          ? Number(resumeReview.experienceYears)
          : 0,
        preferred_locations: resumeReview.preferredLocations,
        preferred_roles: resumeReview.preferredRoles,
      };

      let response;

      try {
        response = await api.put(
          `/profiles/${user.id}`,
          reviewedProfile
        );
      } catch (error: any) {
        if (error.response?.status !== 409 || !profile?.email) {
          throw error;
        }

        // Keep the existing email if the extracted one belongs to another profile.
        response = await api.put(`/profiles/${user.id}`, {
          ...reviewedProfile,
          email: profile.email,
        });

        showToast(
          "Profile saved. The existing email was kept because the extracted email is already registered.",
          "info"
        );
      }

      setName(resumeReview.name);
      setEmail(resumeReview.email);
      setDegree(resumeReview.degree);
      setGraduationYear(resumeReview.graduationYear);
      setExperienceYears(resumeReview.experienceYears);
      setPreferredLocations(resumeReview.preferredLocations);
      setPreferredRoles(resumeReview.preferredRoles);
      setProfile((current) =>
        current
          ? { ...current, ...response.data.profile }
          : current
      );

      const existingSkillNames = new Set(
        (profile?.skills || []).map((skill) => skill.toLowerCase())
      );
      const matchingExtractedSkills = (resumeReview.skills || [])
        .map((skillName) =>
          allSkills.find(
            (skill) =>
              skill.name.toLowerCase() === skillName.toLowerCase()
          )
        )
        .filter(
          (skill): skill is Skill =>
            skill !== undefined &&
            !existingSkillNames.has(skill.name.toLowerCase())
        );

      if (matchingExtractedSkills.length > 0) {
        await Promise.all(
          matchingExtractedSkills.map((skill) =>
            api.post(`/profiles/${user.id}/skills`, {
              skill_id: skill.id,
            })
          )
        );

        setProfile((current) =>
          current
            ? {
                ...current,
                skills: [
                  ...current.skills,
                  ...matchingExtractedSkills.map((skill) => skill.name),
                ],
              }
            : current
        );
      }

      setExtractedResume(null);
      setResumeReview(null);

      showToast("Reviewed resume information saved.", "success");
    } catch (error: any) {
      console.error("Failed to save reviewed resume information:", error);
      showToast(
        error.response?.data?.message ||
          "Failed to save reviewed resume information.",
        "error"
      );
    } finally {
      setReviewSaving(false);
    }
  }

  async function handleAddExtractedSkills() {
    if (!user || !resumeReview) return;

    const existingSkills = new Set(
      profile?.skills.map((skill) => skill.toLowerCase())
    );
    const skillsToAdd = resumeReview.skills
      .map((skillName) =>
        allSkills.find(
          (skill) =>
            skill.name.toLowerCase() === skillName.toLowerCase()
        )
      )
      .filter(
        (skill): skill is Skill =>
          skill !== undefined &&
          !existingSkills.has(skill.name.toLowerCase())
      );

    if (skillsToAdd.length === 0) {
      showToast("No new extracted skills match the skills list.", "info");
      return;
    }

    try {
      setAddingExtractedSkills(true);

      await Promise.all(
        skillsToAdd.map((skill) =>
          api.post(`/profiles/${user.id}/skills`, {
            skill_id: skill.id,
          })
        )
      );

      setProfile((current) =>
        current
          ? {
              ...current,
              skills: [
                ...current.skills,
                ...skillsToAdd.map((skill) => skill.name),
              ],
            }
          : current
      );
      showToast("Matching extracted skills added.", "success");
    } catch (error) {
      console.error("Failed to add extracted skills:", error);
      showToast("Some extracted skills could not be added.", "error");
    } finally {
      setAddingExtractedSkills(false);
    }
  }

  function updateResumeReview<K extends keyof ResumeReview>(
    field: K,
    value: ResumeReview[K]
  ) {
    setResumeReview((current) =>
      current ? { ...current, [field]: value } : current
    );
  }

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
    <div className="flex flex-col">
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

      <div className="order-2 mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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

      {/* RESUME */}

      <div className="order-1 mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl ring-1 ring-white/15">
              PDF
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Resume workspace
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Upload your latest PDF, then review the information extracted from it.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <label
            htmlFor="resume-upload"
            className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-9 text-center shadow-sm transition hover:border-slate-400 hover:shadow-md"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-2xl font-bold text-white transition group-hover:-translate-y-0.5 group-hover:bg-blue-700">
              ↑
            </span>
            <span className="mt-4 text-base font-bold text-slate-950">
              Choose your PDF resume
            </span>
            <span className="mt-1 text-sm text-slate-500">
              PDF only · maximum 5 MB
            </span>
            <input
              id="resume-upload"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleResumeFileChange}
              disabled={resumeUploading || resumeExtracting}
              className="sr-only"
            />
          </label>

          {resumeFile && (
            <div className="mt-4 flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">
                  {resumeFile.name}
                </p>
                <p className="mt-1 text-xs font-medium text-blue-700">
                  {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB PDF
                </p>
              </div>

              <button
                type="button"
                onClick={handleResumeUpload}
                disabled={resumeUploading}
                className="shrink-0 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resumeUploading ? "Uploading..." : "Upload resume"}
              </button>
            </div>
          )}

          {profile.resume_url && (
            <button
              type="button"
              onClick={handleResumeExtract}
              disabled={resumeExtracting || resumeUploading}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl bg-blue-700 px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-blue-700/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-sm">
                ✦
              </span>
              {resumeExtracting
                ? "Extracting information..."
                : "Extract information from uploaded resume"}
            </button>
          )}
          </div>

          {!profile.resume_url && !resumeFile && (
            <p className="mt-4 text-center text-xs font-medium text-slate-500">
              Upload a resume to unlock AI extraction.
            </p>
          )}
        </div>

        {extractedResume && (
          <>
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
              <h3 className="font-semibold text-gray-900">
                Extracted information
              </h3>

              <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Personal information
                  </p>
                  <p className="mt-1 text-gray-800">
                    Name: {extractedResume.personal?.name || "Not found"}
                  </p>
                  <p className="mt-1 wrap-break-word text-gray-600">
                    Email: {extractedResume.personal?.email || "Not found"}
                  </p>
                  <p className="mt-1 text-gray-600">
                    Phone: {extractedResume.personal?.phone || "Not found"}
                  </p>
                  <p className="mt-1 text-gray-600">
                    Location: {extractedResume.personal?.location || "Not found"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Education
                  </p>
                  <p className="mt-1 text-gray-800">
                    Degree: {extractedResume.education?.degree || "Not found"}
                  </p>
                  <p className="mt-1 text-gray-600">
                    Field: {extractedResume.education?.field || "Not found"}
                  </p>
                  <p className="mt-1 text-gray-600">
                    College: {extractedResume.education?.college || "Not found"}
                  </p>
                  <p className="mt-1 text-gray-600">
                    Graduation year: {extractedResume.education?.graduation_year ?? "Not found"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Experience
                </p>
                <p className="mt-1 text-gray-800">
                  Total: {extractedResume.experience?.total_years ?? "Not found"} years
                </p>
                <div className="mt-2 space-y-2">
                  {extractedResume.experience?.items?.length ? (
                    extractedResume.experience.items.map((item, index) => (
                      <div key={`${item.company || "experience"}-${index}`} className="rounded-xl border border-emerald-200 bg-white p-3 text-sm">
                        <p className="font-medium text-gray-900">
                          {item.role || "Role not found"} at {item.company || "Company not found"}
                        </p>
                        <p className="mt-1 text-gray-600">
                          {item.start_date || "Start date not found"} - {item.end_date || "Present"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-600">Not found</p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Skills
                  </p>
                  <p className="mt-1 text-gray-700">
                    {extractedResume.skills?.length
                      ? extractedResume.skills.join(", ")
                      : "Not found"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Preferred roles
                  </p>
                  <p className="mt-1 text-gray-700">
                    {extractedResume.preferred_roles?.length
                      ? extractedResume.preferred_roles.join(", ")
                      : "Not found"}
                  </p>
                </div>
              </div>
            </div>

            {resumeReview && (
              <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-semibold text-gray-900">
                    Review extracted information
                  </h3>
                  <button
                    type="button"
                    onClick={handleConfirmResumeReview}
                    disabled={reviewSaving}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {reviewSaving ? "Saving..." : "Confirm & Save"}
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {[
                    ["Name", "name", resumeReview.name],
                    ["Email", "email", resumeReview.email],
                    ["Degree", "degree", resumeReview.degree],
                    ["Graduation year", "graduationYear", resumeReview.graduationYear],
                    ["Experience years", "experienceYears", resumeReview.experienceYears],
                    ["Preferred locations", "preferredLocations", resumeReview.preferredLocations],
                    ["Preferred roles", "preferredRoles", resumeReview.preferredRoles],
                  ].map(([label, field, value]) => (
                    <label key={field} className="text-sm font-medium text-gray-700">
                      {label}
                      <input
                        type={field === "graduationYear" || field === "experienceYears" ? "number" : "text"}
                        value={value}
                        onChange={(event) =>
                          updateResumeReview(
                            field as keyof ResumeReview,
                            event.target.value as never
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-normal outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                  <div>
                    <p className="font-semibold text-gray-700">Phone</p>
                    <p className="mt-1 text-gray-600">{resumeReview.phone || "Not found"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Location</p>
                    <p className="mt-1 text-gray-600">{resumeReview.location || "Not found"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Field</p>
                    <p className="mt-1 text-gray-600">{resumeReview.field || "Not found"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">College</p>
                    <p className="mt-1 text-gray-600">{resumeReview.college || "Not found"}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-700">Extracted skills</p>
                    <button
                      type="button"
                      onClick={handleAddExtractedSkills}
                      disabled={addingExtractedSkills || skillLoading}
                      className="text-sm font-semibold text-gray-700 underline decoration-gray-300 underline-offset-4 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {addingExtractedSkills ? "Adding..." : "Add matching skills"}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {resumeReview.skills.length ? resumeReview.skills.map((skill) => (
                      <span key={skill} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">
                        {skill}
                      </span>
                    )) : <span className="text-sm text-gray-500">Not found</span>}
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-gray-700">Experience items</p>
                  <div className="mt-2 space-y-2">
                    {resumeReview.experienceItems.length ? resumeReview.experienceItems.map((item, index) => (
                      <div key={`${item.company || "experience"}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{item.role || "Role not found"} at {item.company || "Company not found"}</p>
                          <p className="mt-1 text-gray-600">{item.start_date || "Start date not found"} - {item.end_date || "Present"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateResumeReview("experienceItems", resumeReview.experienceItems.filter((_, itemIndex) => itemIndex !== index))}
                          className="text-sm font-semibold text-gray-400 hover:text-red-500"
                          aria-label="Remove experience item"
                        >
                          x
                        </button>
                      </div>
                    )) : <span className="text-sm text-gray-500">Not found</span>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* JOB PREFERENCES */}

      <div className="order-3 mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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

      <div className="order-4 mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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

      <div className="order-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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