import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import api from "../api/client";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "../context/AuthContext";

interface Job {
  id: number;
  title: string;
  company_name: string;
  location: string | null;
  country: string | null;
  workplace_type: string | null;
  employment_type: string | null;
  experience_min: number | null;
  experience_max: number | null;
  description: string | null;
  application_url: string;
}

interface Application {
  job_id: number;
}

function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applicationLoading, setApplicationLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    async function fetchJob() {
      try {
        setLoading(true);

        const response = await api.get(`/jobs/${id}`);

        setJob(response.data);
      } catch (error) {
        console.error("Failed to fetch job:", error);
        showToast("Unable to load this job.", "error");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchJob();
    }
  }, [id, showToast]);

  useEffect(() => {
    async function fetchApplicationStatus() {
      try {
        setApplicationLoading(true);

        const response = await api.get("/applications");
        const applications: Application[] =
          response.data.applications || [];

        setHasApplied(
          applications.some(
            (application) => String(application.job_id) === id
          )
        );
      } catch (error) {
        console.error(
          "Failed to fetch application status:",
          error
        );
      } finally {
        setApplicationLoading(false);
      }
    }

    if (id && user) {
      fetchApplicationStatus();
    }
  }, [id, user]);

  if (loading) {
    return <p className="text-gray-500">Loading job...</p>;
  }

  if (!job) {
    return (
      <div>
        <p className="text-gray-600">Job not found.</p>

        <Link
          to="/jobs"
          className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Back to Jobs
        </Link>
      </div>
    );
  }

  function decodeHtml(html: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");

  return document.documentElement.textContent || "";
}

const decodedDescription = decodeHtml(job.description || "");

const sanitizedDescription = DOMPurify.sanitize(
  decodedDescription
);

  return (
    <div>
      {/* Job Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 border-b border-gray-100 pb-4">
          <Link
            to="/jobs"
            className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            <span aria-hidden="true" className="mr-2 text-base">
              ←
            </span>
            Back to Jobs
          </Link>
        </div>

        <h1 className="text-3xl font-bold leading-tight text-gray-900">
          {job.title}
        </h1>

        <p className="mt-2 text-lg text-gray-600">
          {job.company_name}
        </p>

        {/* Job Metadata */}
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {job.location && (
            <span className="rounded-full bg-gray-100 px-3 py-1">
              📍 {job.location}
            </span>
          )}

          {job.workplace_type && (
            <span className="rounded-full bg-gray-100 px-3 py-1">
              🏢 {job.workplace_type}
            </span>
          )}

          {job.employment_type && (
            <span className="rounded-full bg-gray-100 px-3 py-1">
              💼 {job.employment_type}
            </span>
          )}

          {(job.experience_min !== null ||
            job.experience_max !== null) && (
            <span className="rounded-full bg-gray-100 px-3 py-1">
              🎓{" "}
              {job.experience_min ?? 0}
              {job.experience_max !== null
                ? `-${job.experience_max}`
                : "+"}{" "}
              years
            </span>
          )}
        </div>

        {/* Application action */}
        {!applicationLoading && hasApplied ? (
          <span className="mt-6 inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-3 font-medium text-emerald-700">
            <span aria-hidden="true" className="mr-2">
              ✓
            </span>
            Applied
          </span>
        ) : !applicationLoading ? (
          <a
            href={job.application_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-lg bg-gray-900 px-6 py-3 font-medium text-white hover:bg-gray-800"
          >
            Apply for this job
          </a>
        ) : null}
      </div>

      {/* Description */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">
          Job Description
        </h2>

        <div
          className="prose mt-6 max-w-none text-gray-700"
          dangerouslySetInnerHTML={{
            __html: sanitizedDescription,
          }}
        />
      </div>
    </div>
  );
}

export default JobDetails;