import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import api from "../api/client";
import { Link } from "react-router-dom";
import { useToast } from "../components/ToastProvider";

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
  application_url: string;
}

function Jobs() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");

  const [workplace, setWorkplace] = useState("");
  const [workplaceQuery, setWorkplaceQuery] = useState("");

  const [scope, setScope] = useState("");
  const [scopeQuery, setScopeQuery] = useState("");

  const [experience, setExperience] = useState(0);
  const [experienceQuery, setExperienceQuery] = useState(0);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);

  useEffect(() => {
    async function fetchJobs() {
      try {
        setLoading(true);

        const params = new URLSearchParams();

        params.set("page", String(page));
        params.set("limit", "20");

        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }

        if (locationQuery) {
          params.set("location", locationQuery);
        }

        if (workplaceQuery) {
          params.set("workplace", workplaceQuery);
        }

        if (scopeQuery) {
          params.set("scope", scopeQuery);
        }

        params.set("experienceMax", String(experienceQuery));

        const response = await api.get(
          `/jobs?${params.toString()}`
        );

        setJobs(response.data.jobs);

        setTotalPages(
          Math.max(
            1,
            response.data.pagination.totalPages
          )
        );

        setTotalJobs(
          response.data.pagination.total
        );
      } catch (error) {
        console.error(
          "Failed to fetch jobs:",
          error
        );
        showToast("Unable to load jobs. Please try again.", "error");
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, [
    searchQuery,
    locationQuery,
    workplaceQuery,
    scopeQuery,
    experienceQuery,
    page,
    showToast,
  ]);

  function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSearchQuery(search);
    setLocationQuery(location);
    setWorkplaceQuery(workplace);
    setScopeQuery(scope);
    setExperienceQuery(experience);

    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setLocation("");
    setWorkplace("");
    setScope("");
    setExperience(0);

    setSearchQuery("");
    setLocationQuery("");
    setWorkplaceQuery("");
    setScopeQuery("");
    setExperienceQuery(0);

    setPage(1);
  }

  return (
    <div className="min-h-full">

      {/* ================================
          HEADER
      ================================= */}

      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Job Radar
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Find your next opportunity
            </h1>

            <p className="mt-2 max-w-2xl text-gray-500">
              Discover fresh job openings from companies
              across India and around the world.
            </p>
          </div>

          {!loading && (
            <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-gray-500">
                Jobs available
              </p>

              <p className="mt-1 text-xl font-bold text-gray-900">
                {totalJobs.toLocaleString()}
              </p>
            </div>
          )}

        </div>
      </div>


      {/* ================================
          FILTERS
      ================================= */}

      <form
        onSubmit={handleSearch}
        className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >

        {/* Filter Header */}

        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Search & filters
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Narrow down jobs based on your preferences.
            </p>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            Clear filters
          </button>
        </div>


        {/* Search */}

        <div className="mb-4">
          <label
            htmlFor="job-search"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Search
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>

            <input
              id="job-search"
              type="text"
              placeholder="Search by title, skill, company, or keyword..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
            />
          </div>
        </div>


        {/* Dropdown Filters */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* Scope */}

          <div>
            <label
              htmlFor="scope"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Job scope
            </label>

            <select
              id="scope"
              value={scope}
              onChange={(event) =>
                setScope(event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
            >
              <option value="">
                🌐 All Jobs
              </option>

              <option value="india">
                🇮🇳 India
              </option>

              <option value="international">
                🌎 International
              </option>
            </select>
          </div>


          {/* Location */}

          <div>
            <label
              htmlFor="location"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Location
            </label>

            <select
              id="location"
              value={location}
              onChange={(event) =>
                setLocation(event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
            >
              <option value="">
                All Locations
              </option>

              <option value="Bangalore">
                Bangalore
              </option>

              <option value="Hyderabad">
                Hyderabad
              </option>

              <option value="Pune">
                Pune
              </option>

              <option value="Mumbai">
                Mumbai
              </option>

              <option value="Delhi NCR">
                Delhi NCR
              </option>
            </select>
          </div>


          {/* Workplace */}

          <div>
            <label
              htmlFor="workplace"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Workplace
            </label>

            <select
              id="workplace"
              value={workplace}
              onChange={(event) =>
                setWorkplace(event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
            >
              <option value="">
                All Workplaces
              </option>

              <option value="remote">
                Remote
              </option>

              <option value="hybrid">
                Hybrid
              </option>

              <option value="on-site">
                On-site
              </option>
            </select>
          </div>


          {/* Experience */}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="experience"
                className="text-sm font-medium text-gray-700"
              >
                Experience
              </label>

              <span className="text-xs font-semibold text-gray-700">
                {experience === 0
                  ? "Freshers"
                  : `≤ ${experience} years`}
              </span>
            </div>

            <input
              id="experience"
              type="range"
              min="0"
              max="15"
              step="1"
              value={experience}
              onChange={(event) =>
                setExperience(
                  Number(event.target.value)
                )
              }
              className="mt-2 w-full cursor-pointer"
            />

            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>0</span>
              <span>5</span>
              <span>10</span>
              <span>15+</span>
            </div>
          </div>

        </div>


        {/* Search Button */}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-gray-900 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 active:scale-[0.98]"
          >
            Search Jobs
          </button>
        </div>

      </form>


      {/* ================================
          RESULTS HEADER
      ================================= */}

      {!loading && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Job opportunities
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Showing{" "}
              <span className="font-medium text-gray-700">
                {jobs.length}
              </span>{" "}
              jobs on this page
            </p>
          </div>
        </div>
      )}


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

      ) : (

        <div className="space-y-4">

          {/* ================================
              EMPTY STATE
          ================================= */}

          {jobs.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">

              <div className="text-4xl">
                🔎
              </div>

              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                No jobs found
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                Try changing your search terms or
                removing some filters.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                Clear filters
              </button>

            </div>

          ) : (

            /* ================================
               JOB CARDS
            ================================= */

            jobs.map((job) => (

              <div
                key={job.id}
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-px hover:border-gray-300 hover:shadow-md"
              >

                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

                  {/* Job Info */}

                  <div className="min-w-0 flex-1">

                    <Link
                      to={`/jobs/${job.id}`}
                      className="line-clamp-2 text-lg font-semibold leading-7 text-gray-900 transition group-hover:text-gray-700 hover:underline"
                    >
                      {job.title}
                    </Link>

                    <p className="mt-1 text-sm font-medium text-gray-600">
                      {job.company_name}
                    </p>


                    {/* Metadata */}

                    <div className="mt-4 flex flex-wrap gap-2">

                      {job.location && (
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                          📍 {job.location}
                        </span>
                      )}

                      {job.workplace_type && (
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                          💼 {job.workplace_type}
                        </span>
                      )}

                      {job.employment_type && (
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                          🕐 {job.employment_type}
                        </span>
                      )}

                      {(job.experience_min !== null ||
                        job.experience_max !== null) && (
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                          🎯{" "}
                          {job.experience_min ?? 0}
                          {job.experience_max !== null
                            ? `-${job.experience_max}`
                            : "+"}{" "}
                          years
                        </span>
                      )}

                    </div>

                  </div>


                  {/* Apply */}

                  <a
                    href={job.application_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-xl bg-gray-900 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[0.98]"
                  >
                    Apply →
                  </a>

                </div>

              </div>

            ))

          )}

        </div>
      )}


      {/* ================================
          PAGINATION
      ================================= */}

      {!loading && jobs.length > 0 && (

        <nav
          aria-label="Job results pagination"
          className="mt-8 flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >

          <button
            type="button"
            onClick={() =>
              setPage(
                (currentPage) =>
                  currentPage - 1
              )
            }
            disabled={page === 1}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>


          <span className="text-sm text-gray-500">
            Page{" "}
            <span className="font-semibold text-gray-900">
              {page}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-900">
              {totalPages}
            </span>
          </span>


          <button
            type="button"
            onClick={() =>
              setPage(
                (currentPage) =>
                  currentPage + 1
              )
            }
            disabled={page >= totalPages}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>

        </nav>

      )}

    </div>
  );
}

export default Jobs;