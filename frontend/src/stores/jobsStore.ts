/**
 * Zustand store for managing video processing jobs.
 * Provides client-side state + API integration for job tracking.
 */

import { create } from "zustand";
import { jobs as jobsApi, JobInfo } from "@/lib/api";

interface JobsState {
  /** All jobs indexed by ID */
  jobs: Record<string, JobInfo>;

  /** Job IDs to suppress from toast notifications (shown in dialogs instead) */
  suppressedJobIds: Set<string>;

  /** Whether initial load has completed */
  initialized: boolean;

  /** Whether currently fetching jobs */
  loading: boolean;

  /** Fetch all active jobs from the backend */
  fetchActiveJobs: () => Promise<void>;

  /** Fetch all jobs from the backend */
  fetchAllJobs: () => Promise<void>;

  /** Update a job in the store (from WebSocket events) */
  updateJob: (id: string, updates: Partial<JobInfo>) => void;

  /** Add a new job to the store */
  addJob: (job: JobInfo) => void;

  /** Mark a job as seen */
  markSeen: (id: string) => Promise<void>;

  /** Suppress a job from toast notifications */
  suppressJob: (id: string) => void;

  /** Unsuppress a job (show in toast again) */
  unsuppressJob: (id: string) => void;

  /** Get unseen completed jobs (excluding suppressed) */
  getUnseenCompleted: () => JobInfo[];

  /** Get active (processing) jobs (excluding suppressed) */
  getActiveJobs: () => JobInfo[];
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: {},
  suppressedJobIds: new Set(),
  initialized: false,
  loading: false,

  fetchActiveJobs: async () => {
    set({ loading: true });
    try {
      const response = await jobsApi.listActive();
      const jobsMap: Record<string, JobInfo> = {};
      if (response.jobs) {
        for (const job of response.jobs) {
          jobsMap[job.id] = job;
        }
      }
      set((state) => ({
        jobs: { ...state.jobs, ...jobsMap },
        initialized: true,
        loading: false,
      }));
    } catch (error) {
      console.error("Failed to fetch active jobs:", error);
      set({ loading: false, initialized: true });
    }
  },

  fetchAllJobs: async () => {
    set({ loading: true });
    try {
      const response = await jobsApi.list();
      const jobsMap: Record<string, JobInfo> = {};
      if (response.jobs) {
        for (const job of response.jobs) {
          jobsMap[job.id] = job;
        }
      }
      set({
        jobs: jobsMap,
        initialized: true,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      set({ loading: false, initialized: true });
    }
  },

  updateJob: (id, updates) => {
    set((state) => {
      const existingJob = state.jobs[id];
      if (!existingJob) return state;

      return {
        jobs: {
          ...state.jobs,
          [id]: { ...existingJob, ...updates },
        },
      };
    });
  },

  addJob: (job) => {
    set((state) => ({
      jobs: {
        ...state.jobs,
        [job.id]: job,
      },
    }));
  },

  markSeen: async (id) => {
    try {
      await jobsApi.markSeen(id);
      set((state) => {
        const job = state.jobs[id];
        if (!job) return state;
        return {
          jobs: {
            ...state.jobs,
            [id]: { ...job, seen: true },
          },
        };
      });
    } catch (error) {
      console.error("Failed to mark job as seen:", error);
    }
  },

  suppressJob: (id) => {
    set((state) => {
      const newSuppressed = new Set(state.suppressedJobIds);
      newSuppressed.add(id);
      return { suppressedJobIds: newSuppressed };
    });
  },

  unsuppressJob: (id) => {
    set((state) => {
      const newSuppressed = new Set(state.suppressedJobIds);
      newSuppressed.delete(id);
      return { suppressedJobIds: newSuppressed };
    });
  },

  getUnseenCompleted: () => {
    const { jobs, suppressedJobIds } = get();
    return Object.values(jobs).filter(
      (job) => job.status === "complete" && !job.seen && !suppressedJobIds.has(job.id)
    );
  },

  getActiveJobs: () => {
    const { jobs, suppressedJobIds } = get();
    return Object.values(jobs).filter(
      (job) => (job.status === "pending" || job.status === "processing") && !suppressedJobIds.has(job.id)
    );
  },
}));
