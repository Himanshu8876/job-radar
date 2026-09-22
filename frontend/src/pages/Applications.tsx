import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "../context/AuthContext";

interface Application {
  id: number;
  job_id: number;
  user_profile_id: number;
  status: string;
  applied_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  title: string;
  company_name: string;
  location: string | null;
  workplace_type: string | null;
  application_url: string;
}

function Applications() {
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchApplications() {
      try {
        setLoading(true);

        // Backend gets the authenticated user from JWT.
        // No userId is required in the query.
        const response = await api.get("/applications");

        setApplications(response.data.applications || []);
      } catch (error) {
        console.error("Failed to fetch applications:", error);
        showToast("Unable to load your applications.", "error");
      } finally {
        setLoading(false);
      }
    }

    fetchApplications();
  }, [user, authLoading, showToast]);

  function formatDate(date: string | null) {
    if (!date) {
      return "Not applied yet";
    }

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function getStatusClasses(status: string) {
    switch (status.toUpperCase()) {
      case "APPLIED":
        return "border-blue-200 bg-blue-50 text-blue-700";

      case "INTERVIEW":
        return "border-purple-200 bg-purple-50 text-purple-700";

      case "OFFER":
        return "border-green-200 bg-green-50 text-green-700";

      case "REJECTED":
        return "border-red-200 bg-red-50 text-red-700";

      case "NEW":
      default:
        return "border-gray-200 bg-gray-50 text-gray-700";
    }
  }

  // Wait for authentication to finish.
  if (authLoading) {
    return (
      <div>
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Job Radar
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Applications
          </h1>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">
            Loading your account...
          </p>
        </div>
      </div>
    );
  }

  // ProtectedRoute normally prevents this,
  // but keeping this check makes the component safe.
  if (!user) {
    return null;
  }

  return (
    <div>
      {/* ================================
          HEADER
      ================================= */}

      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Job Radar
        </p>

        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Applications
        </h1>

        <p className="mt-2 max-w-2xl text-gray-500">
          Keep track of the jobs you've applied to and follow your
          application progress.
        </p>
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
                <div className="h-6 w-20 rounded-full bg-gray-200" />
                <div className="h-6 w-28 rounded-full bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : applications.length === 0 ? (
        /* ================================
           EMPTY STATE
        ================================= */

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <div className="text-4xl">📋</div>

          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            No applications yet
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Jobs that you apply to can be tracked here so you never
            lose sight of your applications.
          </p>

          <Link
            to="/jobs"
            className="mt-5 inline-block rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Browse Jobs
          </Link>
        </div>
      ) : (
        /* ================================
           APPLICATIONS
        ================================= */

        <div className="space-y-4">
          {applications.map((application) => (
            <div
              key={application.id}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-px hover:border-gray-300 hover:shadow-md"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                {/* Application Information */}

                <div className="min-w-0 flex-1">
                  <Link
                    to={`/jobs/${application.job_id}`}
                    className="line-clamp-2 text-lg font-semibold leading-7 text-gray-900 hover:underline"
                  >
                    {application.title}
                  </Link>

                  <p className="mt-1 text-sm font-medium text-gray-600">
                    {application.company_name}
                  </p>

                  {/* Metadata */}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {application.location && (
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                        📍 {application.location}
                      </span>
                    )}

                    {application.workplace_type && (
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                        💼 {application.workplace_type}
                      </span>
                    )}

                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                      📅 Applied {formatDate(application.applied_at)}
                    </span>
                  </div>

                  {/* Notes */}

                  {application.notes && (
                    <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Notes
                      </p>

                      <p className="mt-1 text-sm text-gray-600">
                        {application.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Status + Actions */}

                <div className="flex shrink-0 flex-row items-center gap-3 lg:flex-col lg:items-end">
                  <span
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                      application.status
                    )}`}
                  >
                    {application.status}
                  </span>

                  <Link
                    to={`/jobs/${application.job_id}`}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    View Job
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Applications;