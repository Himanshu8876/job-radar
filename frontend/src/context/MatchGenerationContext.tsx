import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import api from "../api/client";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "./AuthContext";

export type MatchGenerationStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export interface MatchGenerationJob {
  jobId: string;
  status: MatchGenerationStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

interface MatchGenerationContextValue {
  job: MatchGenerationJob | null;
  isGenerating: boolean;
  isRestoring: boolean;
  startMatchGeneration: () => Promise<MatchGenerationJob>;
}

const MatchGenerationContext =
  createContext<MatchGenerationContextValue | null>(null);
const POLL_INTERVAL_MS = 2500;
const RETRY_INTERVAL_MS = 5000;

export function MatchGenerationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [job, setJob] = useState<MatchGenerationJob | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const notifiedTerminalJobs = useRef(new Set<string>());

  const storageKey = user
    ? `job-radar:match-generation:${user.id}`
    : null;

  function updateJob(nextJob: MatchGenerationJob, notify = false) {
    setJob(nextJob);

    if (
      notify &&
      (nextJob.status === "completed" || nextJob.status === "failed") &&
      !notifiedTerminalJobs.current.has(nextJob.jobId)
    ) {
      notifiedTerminalJobs.current.add(nextJob.jobId);
      showToast(
        nextJob.status === "completed"
          ? "Match generation completed."
          : nextJob.error || "Match generation failed. Please try again.",
        nextJob.status === "completed" ? "success" : "error"
      );
    }
  }

  useEffect(() => {
    if (!user || !storageKey) {
      setJob(null);
      setIsRestoring(false);
      return;
    }

    const userId = user.id;
    const currentStorageKey = storageKey;
    let stopped = false;
    let retryTimer: number | undefined;
    const savedJobId = localStorage.getItem(currentStorageKey);

    if (!savedJobId) {
      setJob(null);
      setIsRestoring(false);
      return;
    }

    setIsRestoring(true);

    async function restoreJob() {
      try {
        const response = await api.get(
          `/profiles/${userId}/generate-matches/${savedJobId}`
        );

        if (!stopped) {
          updateJob(response.data as MatchGenerationJob);
          setIsRestoring(false);
        }
      } catch (error: any) {
        if (stopped) return;

        if (error.response?.status === 404) {
          localStorage.removeItem(currentStorageKey);
          setJob(null);
          setIsRestoring(false);
          return;
        }

        retryTimer = window.setTimeout(restoreJob, RETRY_INTERVAL_MS);
      }
    }

    void restoreJob();

    return () => {
      stopped = true;
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [user?.id, storageKey]);

  useEffect(() => {
    if (
      !user ||
      !job ||
      (job.status !== "queued" && job.status !== "running")
    ) {
      return;
    }

    const userId = user.id;
    const currentJobId = job.jobId;
    let stopped = false;
    let pollTimer: number | undefined;

    async function pollStatus() {
      try {
        const response = await api.get(
          `/profiles/${userId}/generate-matches/${currentJobId}`
        );

        if (stopped) return;

        const nextJob = response.data as MatchGenerationJob;
        updateJob(nextJob, true);

        if (nextJob.status === "queued" || nextJob.status === "running") {
          pollTimer = window.setTimeout(pollStatus, POLL_INTERVAL_MS);
        }
      } catch (error: any) {
        if (stopped) return;

        if (error.response?.status === 404) {
          const failedJob: MatchGenerationJob = {
            ...job!,
            status: "failed",
            error: "Match-generation job was not found.",
          };
          updateJob(failedJob, true);
          return;
        }

        pollTimer = window.setTimeout(pollStatus, RETRY_INTERVAL_MS);
      }
    }

    pollTimer = window.setTimeout(pollStatus, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      if (pollTimer !== undefined) {
        window.clearTimeout(pollTimer);
      }
    };
  }, [user?.id, job?.jobId, job?.status]);

  async function startMatchGeneration(): Promise<MatchGenerationJob> {
    if (!user || !storageKey) {
      throw new Error("You must be signed in to generate matches.");
    }

    const response = await api.post(
      `/profiles/${user.id}/generate-matches`
    );
    const nextJob = response.data as MatchGenerationJob;

    localStorage.setItem(storageKey, nextJob.jobId);
    updateJob(nextJob);

    return nextJob;
  }

  const isGenerating =
    job?.status === "queued" || job?.status === "running";

  return (
    <MatchGenerationContext.Provider
      value={{ job, isGenerating, isRestoring, startMatchGeneration }}
    >
      {children}
    </MatchGenerationContext.Provider>
  );
}

export function useMatchGeneration() {
  const context = useContext(MatchGenerationContext);

  if (!context) {
    throw new Error(
      "useMatchGeneration must be used inside MatchGenerationProvider"
    );
  }

  return context;
}