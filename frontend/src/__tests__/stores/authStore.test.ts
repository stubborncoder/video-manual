/**
 * Tests for authStore - Zustand store for authentication state management.
 */

import { useAuthStore } from '@/stores/authStore';
import { auth as authApi } from '@/lib/api';
import { clearGuideSession } from '@/lib/guide-api';
import { useGuideStore } from '@/stores/guideStore';

// Mock dependencies
jest.mock('@/lib/api', () => ({
  auth: {
    login: jest.fn(),
    logout: jest.fn(),
    me: jest.fn(),
  },
}));

jest.mock('@/lib/guide-api', () => ({
  clearGuideSession: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: jest.fn(() => false),
  getAccessToken: jest.fn(() => Promise.resolve(null)),
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockClearGuideSession = clearGuideSession as jest.MockedFunction<typeof clearGuideSession>;

describe('authStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useAuthStore.setState({
      user: null,
      session: null,
      legacyUserId: null,
      role: 'user',
      loading: false,
      initialized: false,
      error: null,
    });

    // Clear mocks
    jest.clearAllMocks();

    // Reset guideStore
    useGuideStore.setState({
      messages: [],
      threadId: null,
    });
  });

  describe('test_initial_state', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.legacyUserId).toBeNull();
      expect(state.role).toBe('user');
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should have all required methods', () => {
      const state = useAuthStore.getState();

      expect(typeof state.initialize).toBe('function');
      expect(typeof state.signInWithEmail).toBe('function');
      expect(typeof state.signUpWithEmail).toBe('function');
      expect(typeof state.signInWithGoogle).toBe('function');
      expect(typeof state.signInLegacy).toBe('function');
      expect(typeof state.signOut).toBe('function');
      expect(typeof state.isAuthenticated).toBe('function');
      expect(typeof state.getUserId).toBe('function');
      expect(typeof state.getToken).toBe('function');
    });
  });

  describe('test_initialize', () => {
    it('should initialize with legacy auth when authenticated', async () => {
      mockAuthApi.me.mockResolvedValue({
        authenticated: true,
        user_id: 'legacy-user-123',
        role: 'admin',
      });

      const { initialize } = useAuthStore.getState();
      await initialize();

      const state = useAuthStore.getState();
      expect(state.legacyUserId).toBe('legacy-user-123');
      expect(state.role).toBe('admin');
      expect(state.initialized).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('should initialize with no user when not authenticated', async () => {
      mockAuthApi.me.mockResolvedValue({
        authenticated: false,
      });

      const { initialize } = useAuthStore.getState();
      await initialize();

      const state = useAuthStore.getState();
      expect(state.legacyUserId).toBeNull();
      expect(state.initialized).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('should handle initialization error gracefully', async () => {
      mockAuthApi.me.mockRejectedValue(new Error('Network error'));

      const { initialize } = useAuthStore.getState();
      await initialize();

      const state = useAuthStore.getState();
      expect(state.legacyUserId).toBeNull();
      expect(state.initialized).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('should set loading to true during initialization', async () => {
      let loadingDuringInit = false;
      mockAuthApi.me.mockImplementation(async () => {
        loadingDuringInit = useAuthStore.getState().loading;
        return { authenticated: false };
      });

      const { initialize } = useAuthStore.getState();
      await initialize();

      expect(loadingDuringInit).toBe(true);
    });
  });

  describe('test_signInLegacy', () => {
    it('should sign in with legacy user ID successfully', async () => {
      mockAuthApi.login.mockResolvedValue({
        user_id: 'test-user',
        created_at: '2024-01-01T00:00:00Z',
      });
      mockAuthApi.me.mockResolvedValue({
        authenticated: true,
        user_id: 'test-user',
        role: 'user',
      });

      const { signInLegacy } = useAuthStore.getState();
      await signInLegacy('test-user');

      const state = useAuthStore.getState();
      expect(state.legacyUserId).toBe('test-user');
      expect(state.role).toBe('user');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(mockAuthApi.login).toHaveBeenCalledWith('test-user');
    });

    it('should set admin role when returned from backend', async () => {
      mockAuthApi.login.mockResolvedValue({
        user_id: 'admin-user',
        created_at: '2024-01-01T00:00:00Z',
      });
      mockAuthApi.me.mockResolvedValue({
        authenticated: true,
        user_id: 'admin-user',
        role: 'admin',
      });

      const { signInLegacy } = useAuthStore.getState();
      await signInLegacy('admin-user');

      const state = useAuthStore.getState();
      expect(state.role).toBe('admin');
    });

    it('should handle sign in error', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('Login failed'));

      const { signInLegacy } = useAuthStore.getState();
      await signInLegacy('test-user');

      const state = useAuthStore.getState();
      expect(state.legacyUserId).toBeNull();
      expect(state.error).toBe('Login failed');
      expect(state.loading).toBe(false);
    });

    it('should set loading during sign in process', async () => {
      let loadingDuringLogin = false;
      mockAuthApi.login.mockImplementation(async () => {
        loadingDuringLogin = useAuthStore.getState().loading;
        return { user_id: 'test', created_at: '2024-01-01' };
      });
      mockAuthApi.me.mockResolvedValue({
        authenticated: true,
        user_id: 'test',
        role: 'user',
      });

      const { signInLegacy } = useAuthStore.getState();
      await signInLegacy('test');

      expect(loadingDuringLogin).toBe(true);
    });
  });

  describe('test_signOut', () => {
    it('should sign out and clear all auth state', async () => {
      // Set up authenticated state
      useAuthStore.setState({
        legacyUserId: 'test-user',
        role: 'admin',
      });

      mockClearGuideSession.mockResolvedValue(undefined);
      mockAuthApi.logout.mockResolvedValue({ status: 'ok' });

      const { signOut } = useAuthStore.getState();
      await signOut();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.legacyUserId).toBeNull();
      expect(state.role).toBe('user');
      expect(state.loading).toBe(false);
    });

    it('should call clearGuideSession before logout', async () => {
      useAuthStore.setState({ legacyUserId: 'test-user' });
      mockClearGuideSession.mockResolvedValue(undefined);
      mockAuthApi.logout.mockResolvedValue({ status: 'ok' });

      const { signOut } = useAuthStore.getState();
      await signOut();

      expect(mockClearGuideSession).toHaveBeenCalled();
    });

    it('should clear guide store messages on sign out', async () => {
      useAuthStore.setState({ legacyUserId: 'test-user' });
      useGuideStore.setState({
        messages: [
          { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
        ],
      });
      mockClearGuideSession.mockResolvedValue(undefined);
      mockAuthApi.logout.mockResolvedValue({ status: 'ok' });

      const { signOut } = useAuthStore.getState();
      await signOut();

      expect(useGuideStore.getState().messages).toEqual([]);
    });

    it('should handle sign out error', async () => {
      useAuthStore.setState({ legacyUserId: 'test-user' });
      mockClearGuideSession.mockResolvedValue(undefined);
      mockAuthApi.logout.mockRejectedValue(new Error('Logout failed'));

      const { signOut } = useAuthStore.getState();
      await signOut();

      const state = useAuthStore.getState();
      expect(state.error).toBe('Logout failed');
      expect(state.loading).toBe(false);
    });

    it('should continue sign out even if clearGuideSession fails', async () => {
      useAuthStore.setState({ legacyUserId: 'test-user' });
      mockClearGuideSession.mockRejectedValue(new Error('Session clear failed'));
      mockAuthApi.logout.mockResolvedValue({ status: 'ok' });

      const { signOut } = useAuthStore.getState();
      await signOut();

      const state = useAuthStore.getState();
      expect(state.legacyUserId).toBeNull();
      expect(mockAuthApi.logout).toHaveBeenCalled();
    });
  });

  describe('test_isAuthenticated', () => {
    it('should return false when not authenticated', () => {
      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated()).toBe(false);
    });

    it('should return true when legacyUserId is set', () => {
      useAuthStore.setState({ legacyUserId: 'test-user' });

      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated()).toBe(true);
    });

    it('should return true when user object is set', () => {
      useAuthStore.setState({
        user: { id: 'supabase-user-123' } as any,
      });

      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated()).toBe(true);
    });
  });

  describe('test_getUserId', () => {
    it('should return null when not authenticated', () => {
      const { getUserId } = useAuthStore.getState();
      expect(getUserId()).toBeNull();
    });

    it('should return legacy user ID when set', () => {
      useAuthStore.setState({ legacyUserId: 'legacy-123' });

      const { getUserId } = useAuthStore.getState();
      expect(getUserId()).toBe('legacy-123');
    });

    it('should return supabase user ID when user is set', () => {
      useAuthStore.setState({
        user: { id: 'supabase-456' } as any,
      });

      const { getUserId } = useAuthStore.getState();
      expect(getUserId()).toBe('supabase-456');
    });

    it('should prefer supabase user ID over legacy user ID', () => {
      useAuthStore.setState({
        user: { id: 'supabase-456' } as any,
        legacyUserId: 'legacy-123',
      });

      const { getUserId } = useAuthStore.getState();
      expect(getUserId()).toBe('supabase-456');
    });
  });

  describe('test_getToken', () => {
    it('should return null when not configured', async () => {
      const { getToken } = useAuthStore.getState();
      const token = await getToken();
      expect(token).toBeNull();
    });
  });

  describe('test_error_handling', () => {
    it('should clear error on new sign in attempt', async () => {
      useAuthStore.setState({ error: 'Previous error' });

      mockAuthApi.login.mockResolvedValue({
        user_id: 'test',
        created_at: '2024-01-01',
      });
      mockAuthApi.me.mockResolvedValue({
        authenticated: true,
        user_id: 'test',
        role: 'user',
      });

      const { signInLegacy } = useAuthStore.getState();

      // Check error is cleared at start
      const promise = signInLegacy('test');
      expect(useAuthStore.getState().error).toBeNull();
      await promise;
    });

    it('should set error message from Error object', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('Custom error message'));

      const { signInLegacy } = useAuthStore.getState();
      await signInLegacy('test');

      expect(useAuthStore.getState().error).toBe('Custom error message');
    });

    it('should set default error message for non-Error thrown values', async () => {
      mockAuthApi.login.mockRejectedValue('string error');

      const { signInLegacy } = useAuthStore.getState();
      await signInLegacy('test');

      expect(useAuthStore.getState().error).toBe('Login failed');
    });

    it('should clear error on initialization', async () => {
      useAuthStore.setState({ error: 'Previous error' });

      mockAuthApi.me.mockResolvedValue({ authenticated: false });

      const { initialize } = useAuthStore.getState();
      const promise = initialize();

      // Error should be cleared immediately
      expect(useAuthStore.getState().error).toBeNull();
      await promise;
    });
  });
});
