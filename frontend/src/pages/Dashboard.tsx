import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "../context/AuthContext";

interface MatchJob {
  job_id: number;
  title: string;
  company_name: string;
  location: string | null;
  workplace_type: string | null;
  score: number;
  application_url: string;
}

interface DashboardStats {
  jobs: number;
  matches: number;
  applications: number;
}

function Dashboard() {
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats>({
    jobs: 0,
    matches: 0,
    applications: 0,
  });

  const [recentMatches, setRecentMatches] = useState<MatchJob[]>([]);
  const [pendingApplicationJob, setPendingApplicationJob] =
    useState<MatchJob | null>(null);

  useEffect(() => {
  if (authLoading || !user) {
    return;
  }

  const userId = user.id;

  async function fetchDashboardData() {
    try {
      const [jobsResponse, matchesResponse, applicationsResponse] =
        await Promise.all([
          api.get("/jobs?limit=1"),
          api.get(`/jobs/matches/${userId}`),
          api.get("/applications"),
        ]);

      setStats({
        jobs: jobsResponse.data.pagination.total,
        matches: matchesResponse.data.jobs.length,
        applications: applicationsResponse.data.applications.length,
      });

      setRecentMatches(matchesResponse.data.jobs.slice(0, 5));
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      showToast("Unable to load dashboard data.", "error");
    }
  }

  fetchDashboardData();
}, [user, authLoading, showToast]);

  async function handleMarkAsApplied() {
    if (!pendingApplicationJob || !user) {
      return;
    }

    const selectedJob = pendingApplicationJob;
    setPendingApplicationJob(null);

    try {
      await api.post("/applications", {
        job_id: selectedJob.job_id,
        user_profile_id: user.id,
        status: "APPLIED",
        applied_at: new Date().toISOString(),
        notes: "Applied through company website",
      });

      setRecentMatches((current) =>
        current.filter((job) => job.job_id !== selectedJob.job_id)
      );
      setStats((current) => ({
        ...current,
        applications: current.applications + 1,
      }));
      showToast("Application marked as applied.", "success");
    } catch (error: any) {
      console.error("Failed to save application:", error);

      if (error.response?.status === 409) {
        setRecentMatches((current) =>
          current.filter((job) => job.job_id !== selectedJob.job_id)
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
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Dashboard
        </h1>

        <p className="mt-2 text-gray-600">
          Welcome back! Here's what's happening with your job search.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-gray-500">Jobs</p>
          <p className="mt-2 text-3xl font-bold">{stats.jobs}</p>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-gray-500">Matches</p>
          <p className="mt-2 text-3xl font-bold">{stats.matches}</p>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-gray-500">Applications</p>
          <p className="mt-2 text-3xl font-bold">
            {stats.applications}
          </p>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Recent Matches
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Your latest matching job opportunities.
          </p>
        </div>

        <div className="space-y-4">
          {recentMatches.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-gray-500">
              No matching jobs found.
            </div>
          ) : (
            recentMatches.map((job) => (
              <div
                key={job.job_id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/jobs/${job.job_id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/jobs/${job.job_id}`);
                  }
                }}
                className="cursor-pointer rounded-xl border bg-white p-5 transition hover:border-gray-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {job.title}
                    </h3>

                    <p className="mt-1 text-sm text-gray-600">
                      {job.company_name}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {job.location && (
                        <span className="rounded-full bg-gray-100 px-3 py-1">
                          {job.location}
                        </span>
                      )}

                      {job.workplace_type && (
                        <span className="rounded-full bg-gray-100 px-3 py-1">
                          {job.workplace_type}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500">Match</p>
                    <p className="text-xl font-bold">
                      {Number(job.score).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div
                  className="mt-4 flex flex-wrap gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <a
                    href={job.application_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                  >
                    Apply
                  </a>

                  <button
                    type="button"
                    onClick={() => setPendingApplicationJob(job)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    ✓ I Applied
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {pendingApplicationJob && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/45 px-4 py-6 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPendingApplicationJob(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-application-confirmation-title"
            aria-describedby="dashboard-application-confirmation-description"
          >
            <h2
              id="dashboard-application-confirmation-title"
              className="text-lg font-bold text-gray-900"
            >
              Confirm application
            </h2>
            <p
              id="dashboard-application-confirmation-description"
              className="mt-2 text-sm leading-6 text-gray-600"
            >
              Have you applied for {" "}
              <span className="font-semibold text-gray-900">
                {pendingApplicationJob.title}
              </span>
              ?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingApplicationJob(null)}
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

export default Dashboard;