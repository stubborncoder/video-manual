/**
 * Tests for jobsStore - Zustand store for managing video processing jobs.
 */

import { useJobsStore } from '@/stores/jobsStore';
import { jobs as jobsApi, JobInfo } from '@/lib/api';

// Mock the API
jest.mock('@/lib/api', () => ({
  jobs: {
    list: jest.fn(),
    listActive: jest.fn(),
    markSeen: jest.fn(),
  },
}));

const mockJobsApi = jobsApi as jest.Mocked<typeof jobsApi>;

// Helper to create test jobs
const createTestJob = (overrides: Partial<JobInfo> = {}): JobInfo => ({
  id: 'job-1',
  user_id: 'user-1',
  video_name: 'test-video.mp4',
  doc_id: null,
  status: 'pending',
  current_node: null,
  node_index: null,
  total_nodes: null,
  error: null,
  started_at: null,
  completed_at: null,
  seen: false,
  ...overrides,
});

describe('jobsStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useJobsStore.setState({
      jobs: {},
      suppressedJobIds: new Set(),
      initialized: false,
      loading: false,
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('test_initial_state', () => {
    it('should have correct initial state', () => {
      const state = useJobsStore.getState();

      expect(state.jobs).toEqual({});
      expect(state.suppressedJobIds).toEqual(new Set());
      expect(state.initialized).toBe(false);
      expect(state.loading).toBe(false);
    });

    it('should have all required methods', () => {
      const state = useJobsStore.getState();

      expect(typeof state.fetchActiveJobs).toBe('function');
      expect(typeof state.fetchAllJobs).toBe('function');
      expect(typeof state.updateJob).toBe('function');
      expect(typeof state.addJob).toBe('function');
      expect(typeof state.markSeen).toBe('function');
      expect(typeof state.suppressJob).toBe('function');
      expect(typeof state.unsuppressJob).toBe('function');
      expect(typeof state.getUnseenCompleted).toBe('function');
      expect(typeof state.getActiveJobs).toBe('function');
    });
  });

  describe('test_addJob', () => {
    it('should add a job to the store', () => {
      const job = createTestJob({ id: 'new-job' });

      const { addJob } = useJobsStore.getState();
      addJob(job);

      const state = useJobsStore.getState();
      expect(state.jobs['new-job']).toEqual(job);
    });

    it('should add multiple jobs', () => {
      const job1 = createTestJob({ id: 'job-1' });
      const job2 = createTestJob({ id: 'job-2', video_name: 'video2.mp4' });

      const { addJob } = useJobsStore.getState();
      addJob(job1);
      addJob(job2);

      const state = useJobsStore.getState();
      expect(Object.keys(state.jobs)).toHaveLength(2);
      expect(state.jobs['job-1']).toEqual(job1);
      expect(state.jobs['job-2']).toEqual(job2);
    });

    it('should overwrite existing job with same ID', () => {
      const job1 = createTestJob({ id: 'job-1', status: 'pending' });
      const job2 = createTestJob({ id: 'job-1', status: 'processing' });

      const { addJob } = useJobsStore.getState();
      addJob(job1);
      addJob(job2);

      const state = useJobsStore.getState();
      expect(state.jobs['job-1'].status).toBe('processing');
    });
  });

  describe('test_updateJob', () => {
    it('should update an existing job', () => {
      const job = createTestJob({ id: 'job-1', status: 'pending' });
      useJobsStore.setState({ jobs: { 'job-1': job } });

      const { updateJob } = useJobsStore.getState();
      updateJob('job-1', { status: 'processing', current_node: 'analyzing' });

      const state = useJobsStore.getState();
      expect(state.jobs['job-1'].status).toBe('processing');
      expect(state.jobs['job-1'].current_node).toBe('analyzing');
      expect(state.jobs['job-1'].video_name).toBe('test-video.mp4');
    });

    it('should not add job if it does not exist', () => {
      const { updateJob } = useJobsStore.getState();
      updateJob('non-existent', { status: 'processing' });

      const state = useJobsStore.getState();
      expect(state.jobs['non-existent']).toBeUndefined();
    });

    it('should preserve other jobs when updating one', () => {
      const job1 = createTestJob({ id: 'job-1' });
      const job2 = createTestJob({ id: 'job-2' });
      useJobsStore.setState({ jobs: { 'job-1': job1, 'job-2': job2 } });

      const { updateJob } = useJobsStore.getState();
      updateJob('job-1', { status: 'complete' });

      const state = useJobsStore.getState();
      expect(state.jobs['job-2']).toEqual(job2);
    });
  });

  describe('test_removeJob', () => {
    // Note: The store doesn't have an explicit removeJob method,
    // but jobs can be removed by fetchAllJobs which replaces all jobs
    it('should replace all jobs when fetchAllJobs is called', async () => {
      const existingJob = createTestJob({ id: 'existing' });
      useJobsStore.setState({ jobs: { existing: existingJob } });

      const newJob = createTestJob({ id: 'new-job' });
      mockJobsApi.list.mockResolvedValue({ jobs: [newJob] });

      const { fetchAllJobs } = useJobsStore.getState();
      await fetchAllJobs();

      const state = useJobsStore.getState();
      expect(state.jobs['existing']).toBeUndefined();
      expect(state.jobs['new-job']).toBeDefined();
    });
  });

  describe('test_fetchJobs', () => {
    it('should fetch and store active jobs', async () => {
      const jobs = [
        createTestJob({ id: 'job-1', status: 'pending' }),
        createTestJob({ id: 'job-2', status: 'processing' }),
      ];
      mockJobsApi.listActive.mockResolvedValue({ jobs });

      const { fetchActiveJobs } = useJobsStore.getState();
      await fetchActiveJobs();

      const state = useJobsStore.getState();
      expect(state.jobs['job-1']).toBeDefined();
      expect(state.jobs['job-2']).toBeDefined();
      expect(state.initialized).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('should fetch and replace all jobs', async () => {
      const jobs = [
        createTestJob({ id: 'job-1' }),
        createTestJob({ id: 'job-2' }),
      ];
      mockJobsApi.list.mockResolvedValue({ jobs });

      const { fetchAllJobs } = useJobsStore.getState();
      await fetchAllJobs();

      const state = useJobsStore.getState();
      expect(Object.keys(state.jobs)).toHaveLength(2);
      expect(state.initialized).toBe(true);
    });

    it('should merge active jobs with existing jobs', async () => {
      const existingJob = createTestJob({ id: 'existing', status: 'complete' });
      useJobsStore.setState({ jobs: { existing: existingJob } });

      const activeJob = createTestJob({ id: 'active', status: 'processing' });
      mockJobsApi.listActive.mockResolvedValue({ jobs: [activeJob] });

      const { fetchActiveJobs } = useJobsStore.getState();
      await fetchActiveJobs();

      const state = useJobsStore.getState();
      expect(state.jobs['existing']).toBeDefined();
      expect(state.jobs['active']).toBeDefined();
    });

    it('should set loading true during fetch', async () => {
      let loadingDuringFetch = false;
      mockJobsApi.list.mockImplementation(async () => {
        loadingDuringFetch = useJobsStore.getState().loading;
        return { jobs: [] };
      });

      const { fetchAllJobs } = useJobsStore.getState();
      await fetchAllJobs();

      expect(loadingDuringFetch).toBe(true);
    });

    it('should handle fetch error gracefully', async () => {
      mockJobsApi.list.mockRejectedValue(new Error('Network error'));

      const { fetchAllJobs } = useJobsStore.getState();
      await fetchAllJobs();

      const state = useJobsStore.getState();
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(true);
    });

    it('should handle empty jobs response', async () => {
      mockJobsApi.list.mockResolvedValue({ jobs: [] });

      const { fetchAllJobs } = useJobsStore.getState();
      await fetchAllJobs();

      const state = useJobsStore.getState();
      expect(state.jobs).toEqual({});
      expect(state.initialized).toBe(true);
    });

    it('should handle undefined jobs in response', async () => {
      mockJobsApi.listActive.mockResolvedValue({ jobs: undefined as any });

      const { fetchActiveJobs } = useJobsStore.getState();
      await fetchActiveJobs();

      const state = useJobsStore.getState();
      expect(state.initialized).toBe(true);
    });
  });

  describe('test_markJobSeen', () => {
    it('should mark a job as seen', async () => {
      const job = createTestJob({ id: 'job-1', status: 'complete', seen: false });
      useJobsStore.setState({ jobs: { 'job-1': job } });
      mockJobsApi.markSeen.mockResolvedValue({ status: 'ok' });

      const { markSeen } = useJobsStore.getState();
      await markSeen('job-1');

      const state = useJobsStore.getState();
      expect(state.jobs['job-1'].seen).toBe(true);
      expect(mockJobsApi.markSeen).toHaveBeenCalledWith('job-1');
    });

    it('should not fail if job does not exist', async () => {
      mockJobsApi.markSeen.mockResolvedValue({ status: 'ok' });

      const { markSeen } = useJobsStore.getState();
      await markSeen('non-existent');

      // Should not throw
      expect(mockJobsApi.markSeen).toHaveBeenCalledWith('non-existent');
    });

    it('should handle API error gracefully', async () => {
      const job = createTestJob({ id: 'job-1', seen: false });
      useJobsStore.setState({ jobs: { 'job-1': job } });
      mockJobsApi.markSeen.mockRejectedValue(new Error('API error'));

      const { markSeen } = useJobsStore.getState();
      await markSeen('job-1');

      // Job should remain unseen on error
      const state = useJobsStore.getState();
      expect(state.jobs['job-1'].seen).toBe(false);
    });
  });

  describe('test_clearJobs', () => {
    it('should replace all jobs when fetchAllJobs returns empty array', async () => {
      const job = createTestJob({ id: 'job-1' });
      useJobsStore.setState({ jobs: { 'job-1': job } });
      mockJobsApi.list.mockResolvedValue({ jobs: [] });

      const { fetchAllJobs } = useJobsStore.getState();
      await fetchAllJobs();

      const state = useJobsStore.getState();
      expect(state.jobs).toEqual({});
    });
  });

  describe('suppressJob and unsuppressJob', () => {
    it('should add job ID to suppressed set', () => {
      const { suppressJob } = useJobsStore.getState();
      suppressJob('job-1');

      const state = useJobsStore.getState();
      expect(state.suppressedJobIds.has('job-1')).toBe(true);
    });

    it('should remove job ID from suppressed set', () => {
      useJobsStore.setState({ suppressedJobIds: new Set(['job-1', 'job-2']) });

      const { unsuppressJob } = useJobsStore.getState();
      unsuppressJob('job-1');

      const state = useJobsStore.getState();
      expect(state.suppressedJobIds.has('job-1')).toBe(false);
      expect(state.suppressedJobIds.has('job-2')).toBe(true);
    });
  });

  describe('getUnseenCompleted', () => {
    it('should return completed unseen jobs', () => {
      const jobs = {
        'job-1': createTestJob({ id: 'job-1', status: 'complete', seen: false }),
        'job-2': createTestJob({ id: 'job-2', status: 'complete', seen: true }),
        'job-3': createTestJob({ id: 'job-3', status: 'processing', seen: false }),
      };
      useJobsStore.setState({ jobs });

      const { getUnseenCompleted } = useJobsStore.getState();
      const unseen = getUnseenCompleted();

      expect(unseen).toHaveLength(1);
      expect(unseen[0].id).toBe('job-1');
    });

    it('should exclude suppressed jobs', () => {
      const jobs = {
        'job-1': createTestJob({ id: 'job-1', status: 'complete', seen: false }),
        'job-2': createTestJob({ id: 'job-2', status: 'complete', seen: false }),
      };
      useJobsStore.setState({
        jobs,
        suppressedJobIds: new Set(['job-1']),
      });

      const { getUnseenCompleted } = useJobsStore.getState();
      const unseen = getUnseenCompleted();

      expect(unseen).toHaveLength(1);
      expect(unseen[0].id).toBe('job-2');
    });
  });

  describe('getActiveJobs', () => {
    it('should return pending and processing jobs', () => {
      const jobs = {
        'job-1': createTestJob({ id: 'job-1', status: 'pending' }),
        'job-2': createTestJob({ id: 'job-2', status: 'processing' }),
        'job-3': createTestJob({ id: 'job-3', status: 'complete' }),
        'job-4': createTestJob({ id: 'job-4', status: 'error' }),
      };
      useJobsStore.setState({ jobs });

      const { getActiveJobs } = useJobsStore.getState();
      const active = getActiveJobs();

      expect(active).toHaveLength(2);
      expect(active.map((j) => j.id).sort()).toEqual(['job-1', 'job-2']);
    });

    it('should exclude suppressed jobs', () => {
      const jobs = {
        'job-1': createTestJob({ id: 'job-1', status: 'processing' }),
        'job-2': createTestJob({ id: 'job-2', status: 'processing' }),
      };
      useJobsStore.setState({
        jobs,
        suppressedJobIds: new Set(['job-1']),
      });

      const { getActiveJobs } = useJobsStore.getState();
      const active = getActiveJobs();

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('job-2');
    });

    it('should return empty array when no active jobs', () => {
      const jobs = {
        'job-1': createTestJob({ id: 'job-1', status: 'complete' }),
        'job-2': createTestJob({ id: 'job-2', status: 'error' }),
      };
      useJobsStore.setState({ jobs });

      const { getActiveJobs } = useJobsStore.getState();
      const active = getActiveJobs();

      expect(active).toHaveLength(0);
    });
  });
});
