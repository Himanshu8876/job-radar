import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "../context/AuthContext";

interface Match {
  job_id: number;
  title: string;
  company_name: string;
  location: string | null;
  workplace_type: string | null;
  experience_min: number | null;
  experience_max: number | null;
  application_url: string;
  score: number;
  skill_score: number;
  role_score: number;
  location_score: number;
  education_score: number;
  seniority_score: number;
  experience_score: number;
}

function Matches() {
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pendingApplicationMatch, setPendingApplicationMatch] =
    useState<Match | null>(null);

  async function fetchMatches() {
    if (!user) {
      return;
    }

    try {
      setLoading(true);

      const response = await api.get(`/jobs/matches/${user.id}`);

      setMatches(response.data.jobs || []);
    } catch (error) {
      console.error("Failed to fetch matches:", error);
      showToast("Unable to load your matches.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    fetchMatches();
  }, [user, authLoading]);

  async function handleGenerateMatches() {
    if (!user) {
      return;
    }

    try {
      setGenerating(true);

      await api.post(`/profiles/${user.id}/generate-matches`);

      showToast("Matches generated successfully.", "success");

      await fetchMatches();
    } catch (error) {
      console.error("Failed to generate matches:", error);
      showToast("Unable to generate matches.", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkAsApplied() {
    if (!pendingApplicationMatch || !user) {
      return;
    }

    const selectedMatch = pendingApplicationMatch;
    setPendingApplicationMatch(null);

    try {
      await api.post("/applications", {
        job_id: selectedMatch.job_id,
        user_profile_id: user.id,
        status: "APPLIED",
        applied_at: new Date().toISOString(),
        notes: "Applied through company website",
      });

      setMatches((current) =>
        current.filter((match) => match.job_id !== selectedMatch.job_id)
      );
      showToast("Application marked as applied.", "success");
    } catch (error: any) {
      console.error("Failed to save application:", error);

      if (error.response?.status === 409) {
        setMatches((current) =>
          current.filter((match) => match.job_id !== selectedMatch.job_id)
        );
        showToast(
          "You have already marked this job as applied.",
          "error"
        );
      } else {
        showToast("Unable to save application.", "error");
      }
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div>
      {/* ================================
          HEADER
      ================================= */}

      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Job Radar
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Your Matches
            </h1>

            <p className="mt-2 max-w-2xl text-gray-500">
              Jobs matched against your skills, experience, role preferences,
              and location.
            </p>
          </div>

          {/* Generate Matches Button */}
          <button
            type="button"
            onClick={handleGenerateMatches}
            disabled={generating}
            className="shrink-0 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "Generating..." : "Generate Matches"}
          </button>
        </div>
      </div>

      {/* ================================
          LOADING
      ================================= */}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6"
            >
              <div className="h-5 w-2/3 rounded bg-gray-200" />

              <div className="mt-3 h-4 w-1/4 rounded bg-gray-200" />

              <div className="mt-5 flex gap-2">
                <div className="h-6 w-24 rounded-full bg-gray-200" />
                <div className="h-6 w-20 rounded-full bg-gray-200" />
                <div className="h-6 w-28 rounded-full bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : matches.length === 0 ? (
        /* ================================
           EMPTY STATE
        ================================= */

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <div className="text-4xl">🎯</div>

          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            No matching jobs found
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            We couldn't find any active jobs matching your current profile.
          </p>

          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleGenerateMatches}
              disabled={generating}
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating ? "Generating..." : "Generate Matches"}
            </button>

            <Link
              to="/profile"
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              View Profile
            </Link>
          </div>
        </div>
      ) : (
        /* ================================
           MATCHES
        ================================= */

        <div className="space-y-4">
          {matches.map((match) => (
            <div
              key={match.job_id}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-px hover:border-gray-300 hover:shadow-md"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                {/* Job Information */}

                <div className="min-w-0 flex-1">
                  <Link
                    to={`/jobs/${match.job_id}`}
                    className="line-clamp-2 text-lg font-semibold leading-7 text-gray-900 transition hover:underline"
                  >
                    {match.title}
                  </Link>

                  <p className="mt-1 text-sm font-medium text-gray-600">
                    {match.company_name}
                  </p>

                  {/* Metadata */}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {match.location && (
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                        📍 {match.location}
                      </span>
                    )}

                    {match.workplace_type && (
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                        💼 {match.workplace_type}
                      </span>
                    )}

                    {(match.experience_min !== null ||
                      match.experience_max !== null) && (
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                        🎯 {match.experience_min ?? 0}
                        {match.experience_max !== null
                          ? `-${match.experience_max}`
                          : "+"}{" "}
                        years
                      </span>
                    )}
                  </div>

                  {/* Match Breakdown */}

                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Match breakdown
                    </p>

                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">
                      <span>
                        Skills{" "}
                        <strong className="text-gray-800">
                          {Number(match.skill_score ?? 0).toFixed(0)}%
                        </strong>
                      </span>

                      <span>
                        Role{" "}
                        <strong className="text-gray-800">
                          {Number(match.role_score ?? 0).toFixed(0)}%
                        </strong>
                      </span>

                      <span>
                        Location{" "}
                        <strong className="text-gray-800">
                          {Number(match.location_score ?? 0).toFixed(0)}%
                        </strong>
                      </span>

                      <span>
                        Experience{" "}
                        <strong className="text-gray-800">
                          {Number(match.experience_score ?? 0).toFixed(0)}%
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Match Score + Actions */}

                <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center">
                    <p className="text-xs font-medium text-gray-500">
                      Match
                    </p>

                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {Number(match.score ?? 0).toFixed(0)}%
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <a
                      href={match.application_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-gray-900 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[0.98]"
                    >
                      Apply →
                    </a>

                    <button
                      type="button"
                      onClick={() => setPendingApplicationMatch(match)}
                      className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]"
                    >
                      ✓ I Applied
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}


      {pendingApplicationMatch && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/45 px-4 py-6 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPendingApplicationMatch(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-application-confirmation-title"
            aria-describedby="match-application-confirmation-description"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-700">
                !
              </div>

              <div>
                <h2
                  id="match-application-confirmation-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Confirm application
                </h2>
                <p
                  id="match-application-confirmation-description"
                  className="mt-2 text-sm leading-6 text-gray-600"
                >
                  Have you applied for {" "}
                  <span className="font-semibold text-gray-900">
                    {pendingApplicationMatch.title}
                  </span>
                  ?
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingApplicationMatch(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkAsApplied}
                className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Yes, I applied
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Matches;