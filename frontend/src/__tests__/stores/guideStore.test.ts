/**
 * Tests for guideStore - Zustand store for Guide Agent state management.
 */

import { useGuideStore, GuideMessage, PageContext, PanelSize } from '@/stores/guideStore';

describe('guideStore', () => {
  beforeEach(() => {
    // Reset store between tests (clear persisted state)
    useGuideStore.setState({
      isOpen: false,
      hasUnread: false,
      forceLeftPosition: false,
      panelSize: 'full',
      messages: [],
      threadId: null,
      currentPage: '',
      pageContext: null,
      isGenerating: false,
      activeHighlights: [],
      pendingHighlight: null,
    });
  });

  describe('test_initial_state', () => {
    it('should have correct initial state', () => {
      const state = useGuideStore.getState();

      expect(state.isOpen).toBe(false);
      expect(state.hasUnread).toBe(false);
      expect(state.forceLeftPosition).toBe(false);
      expect(state.panelSize).toBe('full');
      expect(state.messages).toEqual([]);
      expect(state.threadId).toBeNull();
      expect(state.currentPage).toBe('');
      expect(state.pageContext).toBeNull();
      expect(state.isGenerating).toBe(false);
      expect(state.activeHighlights).toEqual([]);
      expect(state.pendingHighlight).toBeNull();
    });

    it('should have all required methods', () => {
      const state = useGuideStore.getState();

      expect(typeof state.toggle).toBe('function');
      expect(typeof state.open).toBe('function');
      expect(typeof state.close).toBe('function');
      expect(typeof state.addMessage).toBe('function');
      expect(typeof state.clearMessages).toBe('function');
      expect(typeof state.setPageContext).toBe('function');
      expect(typeof state.setGenerating).toBe('function');
      expect(typeof state.markAsRead).toBe('function');
      expect(typeof state.setForceLeftPosition).toBe('function');
      expect(typeof state.setFull).toBe('function');
      expect(typeof state.setMedium).toBe('function');
      expect(typeof state.setCompact).toBe('function');
      expect(typeof state.showHighlight).toBe('function');
      expect(typeof state.clearHighlight).toBe('function');
      expect(typeof state.clearAllHighlights).toBe('function');
      expect(typeof state.setPendingHighlight).toBe('function');
      expect(typeof state.applyPendingHighlight).toBe('function');
    });
  });

  describe('test_addMessage', () => {
    it('should add a message to the store', () => {
      const message: GuideMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date('2024-01-01'),
      };

      const { addMessage } = useGuideStore.getState();
      addMessage(message);

      const state = useGuideStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0]).toEqual(message);
    });

    it('should add multiple messages in order', () => {
      const msg1: GuideMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date('2024-01-01T10:00:00'),
      };
      const msg2: GuideMessage = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date('2024-01-01T10:00:01'),
      };

      const { addMessage } = useGuideStore.getState();
      addMessage(msg1);
      addMessage(msg2);

      const state = useGuideStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].id).toBe('msg-1');
      expect(state.messages[1].id).toBe('msg-2');
    });

    it('should set hasUnread when panel is closed and message is from assistant', () => {
      useGuideStore.setState({ isOpen: false });

      const message: GuideMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'New response',
        timestamp: new Date(),
      };

      const { addMessage } = useGuideStore.getState();
      addMessage(message);

      expect(useGuideStore.getState().hasUnread).toBe(true);
    });

    it('should not set hasUnread when panel is open', () => {
      useGuideStore.setState({ isOpen: true });

      const message: GuideMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'New response',
        timestamp: new Date(),
      };

      const { addMessage } = useGuideStore.getState();
      addMessage(message);

      expect(useGuideStore.getState().hasUnread).toBe(false);
    });

    it('should not set hasUnread for user messages', () => {
      useGuideStore.setState({ isOpen: false });

      const message: GuideMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'User message',
        timestamp: new Date(),
      };

      const { addMessage } = useGuideStore.getState();
      addMessage(message);

      expect(useGuideStore.getState().hasUnread).toBe(false);
    });

    it('should handle message with suggestions', () => {
      const message: GuideMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Here are some options:',
        timestamp: new Date(),
        suggestions: ['Option 1', 'Option 2'],
      };

      const { addMessage } = useGuideStore.getState();
      addMessage(message);

      const state = useGuideStore.getState();
      expect(state.messages[0].suggestions).toEqual(['Option 1', 'Option 2']);
    });
  });

  describe('test_clearMessages', () => {
    it('should clear all messages', () => {
      useGuideStore.setState({
        messages: [
          { id: '1', role: 'user', content: 'Hi', timestamp: new Date() },
          { id: '2', role: 'assistant', content: 'Hello', timestamp: new Date() },
        ],
        threadId: 'thread-123',
      });

      const { clearMessages } = useGuideStore.getState();
      clearMessages();

      const state = useGuideStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.threadId).toBeNull();
    });

    it('should work when messages is already empty', () => {
      const { clearMessages } = useGuideStore.getState();
      clearMessages();

      expect(useGuideStore.getState().messages).toEqual([]);
    });
  });

  describe('test_setOpen', () => {
    it('should open the panel', () => {
      const { open } = useGuideStore.getState();
      open();

      const state = useGuideStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.hasUnread).toBe(false);
      expect(state.panelSize).toBe('full');
    });

    it('should clear hasUnread when opening', () => {
      useGuideStore.setState({ hasUnread: true });

      const { open } = useGuideStore.getState();
      open();

      expect(useGuideStore.getState().hasUnread).toBe(false);
    });

    it('should close the panel', () => {
      useGuideStore.setState({ isOpen: true });

      const { close } = useGuideStore.getState();
      close();

      const state = useGuideStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.panelSize).toBe('full');
    });

    it('should toggle the panel state', () => {
      // Initial state is closed
      const { toggle } = useGuideStore.getState();

      toggle();
      expect(useGuideStore.getState().isOpen).toBe(true);

      toggle();
      expect(useGuideStore.getState().isOpen).toBe(false);
    });

    it('should clear hasUnread when toggling open', () => {
      useGuideStore.setState({ isOpen: false, hasUnread: true });

      const { toggle } = useGuideStore.getState();
      toggle();

      expect(useGuideStore.getState().hasUnread).toBe(false);
    });

    it('should reset panel size to full when toggling', () => {
      useGuideStore.setState({ isOpen: false, panelSize: 'compact' });

      const { toggle } = useGuideStore.getState();
      toggle();

      expect(useGuideStore.getState().panelSize).toBe('full');
    });
  });

  describe('test_setLoading', () => {
    it('should set isGenerating to true', () => {
      const { setGenerating } = useGuideStore.getState();
      setGenerating(true);

      expect(useGuideStore.getState().isGenerating).toBe(true);
    });

    it('should set isGenerating to false', () => {
      useGuideStore.setState({ isGenerating: true });

      const { setGenerating } = useGuideStore.getState();
      setGenerating(false);

      expect(useGuideStore.getState().isGenerating).toBe(false);
    });
  });

  describe('setPageContext', () => {
    it('should set page context', () => {
      const context: PageContext = {
        currentPage: '/dashboard',
        pageTitle: 'Dashboard',
        availableActions: ['create', 'delete'],
        pageState: { count: 5 },
      };

      const { setPageContext } = useGuideStore.getState();
      setPageContext(context);

      const state = useGuideStore.getState();
      expect(state.currentPage).toBe('/dashboard');
      expect(state.pageContext).toEqual(context);
    });

    it('should update page context', () => {
      const initialContext: PageContext = {
        currentPage: '/dashboard',
        pageTitle: 'Dashboard',
        availableActions: [],
        pageState: {},
      };

      const updatedContext: PageContext = {
        currentPage: '/projects',
        pageTitle: 'Projects',
        availableActions: ['create'],
        pageState: { projectCount: 10 },
      };

      const { setPageContext } = useGuideStore.getState();
      setPageContext(initialContext);
      setPageContext(updatedContext);

      const state = useGuideStore.getState();
      expect(state.currentPage).toBe('/projects');
      expect(state.pageContext).toEqual(updatedContext);
    });
  });

  describe('markAsRead', () => {
    it('should set hasUnread to false', () => {
      useGuideStore.setState({ hasUnread: true });

      const { markAsRead } = useGuideStore.getState();
      markAsRead();

      expect(useGuideStore.getState().hasUnread).toBe(false);
    });
  });

  describe('setForceLeftPosition', () => {
    it('should set forceLeftPosition', () => {
      const { setForceLeftPosition } = useGuideStore.getState();

      setForceLeftPosition(true);
      expect(useGuideStore.getState().forceLeftPosition).toBe(true);

      setForceLeftPosition(false);
      expect(useGuideStore.getState().forceLeftPosition).toBe(false);
    });
  });

  describe('panel size actions', () => {
    it('should set panel size to full', () => {
      useGuideStore.setState({ panelSize: 'compact' });

      const { setFull } = useGuideStore.getState();
      setFull();

      expect(useGuideStore.getState().panelSize).toBe('full');
    });

    it('should set panel size to medium', () => {
      const { setMedium } = useGuideStore.getState();
      setMedium();

      expect(useGuideStore.getState().panelSize).toBe('medium');
    });

    it('should set panel size to compact', () => {
      const { setCompact } = useGuideStore.getState();
      setCompact();

      expect(useGuideStore.getState().panelSize).toBe('compact');
    });
  });

  describe('highlight actions', () => {
    it('should show a highlight', () => {
      const { showHighlight } = useGuideStore.getState();
      showHighlight('element-1', 5000, 'Click here');

      const state = useGuideStore.getState();
      expect(state.activeHighlights).toHaveLength(1);
      expect(state.activeHighlights[0]).toEqual({
        targetId: 'element-1',
        duration: 5000,
        label: 'Click here',
      });
    });

    it('should use default duration of 3000ms', () => {
      const { showHighlight } = useGuideStore.getState();
      showHighlight('element-1');

      const state = useGuideStore.getState();
      expect(state.activeHighlights[0].duration).toBe(3000);
    });

    it('should replace existing highlight with same targetId', () => {
      useGuideStore.setState({
        activeHighlights: [{ targetId: 'element-1', duration: 1000 }],
      });

      const { showHighlight } = useGuideStore.getState();
      showHighlight('element-1', 5000, 'Updated');

      const state = useGuideStore.getState();
      expect(state.activeHighlights).toHaveLength(1);
      expect(state.activeHighlights[0].duration).toBe(5000);
      expect(state.activeHighlights[0].label).toBe('Updated');
    });

    it('should add multiple highlights for different targets', () => {
      const { showHighlight } = useGuideStore.getState();
      showHighlight('element-1', 3000);
      showHighlight('element-2', 5000);

      const state = useGuideStore.getState();
      expect(state.activeHighlights).toHaveLength(2);
    });

    it('should clear a specific highlight', () => {
      useGuideStore.setState({
        activeHighlights: [
          { targetId: 'element-1', duration: 3000 },
          { targetId: 'element-2', duration: 5000 },
        ],
      });

      const { clearHighlight } = useGuideStore.getState();
      clearHighlight('element-1');

      const state = useGuideStore.getState();
      expect(state.activeHighlights).toHaveLength(1);
      expect(state.activeHighlights[0].targetId).toBe('element-2');
    });

    it('should clear all highlights', () => {
      useGuideStore.setState({
        activeHighlights: [
          { targetId: 'element-1', duration: 3000 },
          { targetId: 'element-2', duration: 5000 },
        ],
      });

      const { clearAllHighlights } = useGuideStore.getState();
      clearAllHighlights();

      expect(useGuideStore.getState().activeHighlights).toEqual([]);
    });
  });

  describe('pending highlight actions', () => {
    it('should set pending highlight', () => {
      const { setPendingHighlight } = useGuideStore.getState();
      setPendingHighlight({ target: 'element-1', duration: 3000 });

      const state = useGuideStore.getState();
      expect(state.pendingHighlight).toEqual({ target: 'element-1', duration: 3000 });
    });

    it('should clear pending highlight', () => {
      useGuideStore.setState({
        pendingHighlight: { target: 'element-1', duration: 3000 },
      });

      const { setPendingHighlight } = useGuideStore.getState();
      setPendingHighlight(null);

      expect(useGuideStore.getState().pendingHighlight).toBeNull();
    });

    it('should apply pending highlight to active highlights', () => {
      useGuideStore.setState({
        pendingHighlight: { target: 'element-1', duration: 5000 },
        activeHighlights: [],
      });

      const { applyPendingHighlight } = useGuideStore.getState();
      applyPendingHighlight();

      const state = useGuideStore.getState();
      expect(state.activeHighlights).toHaveLength(1);
      expect(state.activeHighlights[0].targetId).toBe('element-1');
      expect(state.activeHighlights[0].duration).toBe(5000);
      expect(state.pendingHighlight).toBeNull();
    });

    it('should not apply if no pending highlight', () => {
      const { applyPendingHighlight } = useGuideStore.getState();
      applyPendingHighlight();

      expect(useGuideStore.getState().activeHighlights).toEqual([]);
    });

    it('should replace existing highlight when applying pending', () => {
      useGuideStore.setState({
        activeHighlights: [{ targetId: 'element-1', duration: 1000 }],
        pendingHighlight: { target: 'element-1', duration: 5000 },
      });

      const { applyPendingHighlight } = useGuideStore.getState();
      applyPendingHighlight();

      const state = useGuideStore.getState();
      expect(state.activeHighlights).toHaveLength(1);
      expect(state.activeHighlights[0].duration).toBe(5000);
    });
  });
});
