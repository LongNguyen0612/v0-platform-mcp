/**
 * Unit tests for PrototypeGenerationService (US-006, US-007, US-009, US-010)
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PrototypeGenerationService } from '../../../src/services/prototypeGenerationService.js';
import { PrototypeContext } from '../../../src/types/index.js';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('PrototypeGenerationService', () => {
  let service: PrototypeGenerationService;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.V0_API_KEY = mockApiKey;
    service = new PrototypeGenerationService();
  });

  const validContext: PrototypeContext = {
    product_name: 'TaskMaster',
    goal: 'Project management tool',
    platform: 'web',
    screens: ['Dashboard', 'Task List', 'Settings'],
    design_style: 'Modern and minimal',
  };

  describe('generatePrototype - Success Cases (US-006)', () => {
    it('should generate prototype successfully with all screens', async () => {
      const mockResponse = {
        id: 'chat_123',
        messages: [
          {
            role: 'assistant',
            content: 'Generated Dashboard, Task List, and Settings screens with modern React components',
          },
        ],
        modelConfiguration: {
          modelId: 'v0-1.5-md',
        },
        webUrl: 'https://v0.dev/chat/chat_123',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.status).toBe('success');
      expect(result.prototype_id).toMatch(/^proto_\d+$/);
      expect(result.screens_requested).toBe(3);
      expect(result.screens_generated).toBeGreaterThan(0);
      expect(result.preview_reference).toBe('https://v0.dev/chat/chat_123');
      expect(result.metadata?.model).toBe('v0-1.5-md');
    });

    it('should detect generated screens from content', async () => {
      const mockResponse = {
        id: 'chat_456',
        messages: [
          {
            role: 'assistant',
            content: 'Created Dashboard component with TaskList and Settings page',
          },
        ],
        webUrl: 'https://v0.dev/chat/chat_456',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.generated_screens).toBeDefined();
      expect(result.generated_screens!.length).toBeGreaterThan(0);
    });

    it('should extract component names from generated content', async () => {
      const mockResponse = {
        id: 'chat_789',
        messages: [
          {
            role: 'assistant',
            content: 'export function Dashboard() {} const TaskList = () => {} function Settings() {}',
          },
        ],
        webUrl: 'https://v0.dev/chat/chat_789',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.components).toBeDefined();
      expect(result.components!.length).toBeGreaterThan(0);
      expect(result.components).toContain('Dashboard');
    });

    it('should return partial_success when not all screens are detected', async () => {
      const mockResponse = {
        id: 'chat_partial',
        messages: [
          {
            role: 'assistant',
            content: 'Created Dashboard component only', // Only mentions 1 of 3 screens
          },
        ],
        webUrl: 'https://v0.dev/chat/chat_partial',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.status).toBe('partial_success');
      expect(result.screens_generated).toBeLessThan(result.screens_requested);
    });
  });

  describe('No Backend Constraints (US-007)', () => {
    it('should include "no backend" constraints in V0 prompt', async () => {
      const mockResponse = {
        id: 'chat_nobackend',
        messages: [{ role: 'assistant', content: 'UI generated' }],
        webUrl: 'https://v0.dev/chat/chat_nobackend',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.generatePrototype(validContext);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);

      expect(requestBody.message).toContain('UI PROTOTYPE ONLY');
      expect(requestBody.message).toContain('No backend logic');
      expect(requestBody.message).toContain('no database schema');
      expect(requestBody.message).toContain('no APIs');
      expect(requestBody.message).toContain('no authentication');
    });

    it('should include placeholder data instruction', async () => {
      const mockResponse = {
        id: 'chat_placeholder',
        messages: [{ role: 'assistant', content: 'UI generated' }],
        webUrl: 'https://v0.dev/chat/chat_placeholder',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.generatePrototype(validContext);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);

      expect(requestBody.message).toContain('placeholder data');
      expect(requestBody.message).toContain('mock states');
    });
  });

  describe('Retry Logic (US-009)', () => {
    it('should retry on 500 server error', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'chat_retry',
            messages: [{ role: 'assistant', content: 'Success after retry' }],
            webUrl: 'https://v0.dev/chat/chat_retry',
          }),
        } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.status).toBe('success');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 service unavailable', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'Service Unavailable',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'chat_503',
            messages: [{ role: 'assistant', content: 'Recovered' }],
            webUrl: 'https://v0.dev/chat/chat_503',
          }),
        } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.status).toBe('success');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 400 client error', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.status).toBe('generation_failed');
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retry
      expect(result.error).toContain('400');
    });

    it('should NOT retry on 401 unauthorized', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.status).toBe('generation_failed');
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retry
    });

    it('should NOT retry on 403 forbidden', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.status).toBe('generation_failed');
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retry
    });

    it('should fail after max retries (3 attempts)', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => 'Server Error',
        } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.status).toBe('generation_failed');
      expect(global.fetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(result.retryable).toBe(true);
    }, 10000);

    it('should include retry_after_seconds for rate limit (429)', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate Limited',
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.status).toBe('generation_failed');
      expect(result.retry_after_seconds).toBe(60);
      expect(result.retryable).toBe(true);
    }, 10000);
  });

  describe('Prototype Artifact Generation (US-010)', () => {
    it('should generate unique prototype_id with proto_ prefix', async () => {
      const mockResponse = {
        id: 'chat_artifact',
        messages: [{ role: 'assistant', content: 'Generated UI' }],
        webUrl: 'https://v0.dev/chat/chat_artifact',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.prototype_id).toMatch(/^proto_\d+$/);
    });

    it('should include metadata with model, duration, and webUrl', async () => {
      const mockResponse = {
        id: 'chat_metadata',
        messages: [{ role: 'assistant', content: 'UI' }],
        modelConfiguration: { modelId: 'v0-1.5-lg' },
        webUrl: 'https://v0.dev/chat/chat_metadata',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.generatePrototype(validContext, 'v0-1.5-lg');

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.model).toBe('v0-1.5-lg');
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.webUrl).toBe('https://v0.dev/chat/chat_metadata');
    });

    it('should include screens_requested and screens_generated counts', async () => {
      const mockResponse = {
        id: 'chat_counts',
        messages: [{ role: 'assistant', content: 'Dashboard and Settings' }],
        webUrl: 'https://v0.dev/chat/chat_counts',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.screens_requested).toBe(3);
      expect(result.screens_generated).toBeGreaterThan(0);
      expect(result.screens_generated).toBeLessThanOrEqual(result.screens_requested);
    });
  });

  describe('Model Selection (US-011)', () => {
    it('should use default model when not specified', async () => {
      const mockResponse = {
        id: 'chat_default',
        messages: [{ role: 'assistant', content: 'UI' }],
        modelConfiguration: { modelId: 'v0-1.5-md' },
        webUrl: 'https://v0.dev/chat/chat_default',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.metadata?.model).toBe('v0-1.5-md');
    });

    it('should log model used in metadata', async () => {
      const mockResponse = {
        id: 'chat_model',
        messages: [{ role: 'assistant', content: 'UI' }],
        modelConfiguration: { modelId: 'v0-1.5-lg' },
        webUrl: 'https://v0.dev/chat/chat_model',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.generatePrototype(validContext, 'v0-1.5-lg');

      expect(result.metadata?.model).toBe('v0-1.5-lg');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing assistant message', async () => {
      const mockResponse = {
        id: 'chat_no_message',
        messages: [],
        webUrl: 'https://v0.dev/chat/chat_no_message',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.status).toBe('generation_failed');
      expect(result.error).toContain('No response generated');
    });

    it('should mark errors as retryable when appropriate', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server Error',
      } as Response);

      const result = await service.generatePrototype(validContext);

      expect(result.status).toBe('generation_failed');
      expect(result.retryable).toBe(true);
    }, 10000);
  });

  describe('Prompt Construction', () => {
    it('should include product name in prompt', async () => {
      const mockResponse = {
        id: 'chat_prompt',
        messages: [{ role: 'assistant', content: 'UI' }],
        webUrl: 'https://v0.dev/chat/chat_prompt',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.generatePrototype(validContext);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);

      expect(requestBody.message).toContain('TaskMaster');
    });

    it('should include platform in prompt', async () => {
      const mockResponse = {
        id: 'chat_platform',
        messages: [{ role: 'assistant', content: 'UI' }],
        webUrl: 'https://v0.dev/chat/chat_platform',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.generatePrototype(validContext);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);

      expect(requestBody.message).toContain('web');
    });

    it('should list all screens in prompt', async () => {
      const mockResponse = {
        id: 'chat_screens',
        messages: [{ role: 'assistant', content: 'UI' }],
        webUrl: 'https://v0.dev/chat/chat_screens',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.generatePrototype(validContext);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);

      expect(requestBody.message).toContain('Dashboard');
      expect(requestBody.message).toContain('Task List');
      expect(requestBody.message).toContain('Settings');
    });

    it('should include design_style when provided', async () => {
      const mockResponse = {
        id: 'chat_style',
        messages: [{ role: 'assistant', content: 'UI' }],
        webUrl: 'https://v0.dev/chat/chat_style',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.generatePrototype(validContext);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);

      expect(requestBody.message).toContain('Modern and minimal');
    });

    it('should include ui_reference when provided', async () => {
      const contextWithRef: PrototypeContext = {
        ...validContext,
        ui_reference: ['https://example.com/design.png'],
      };

      const mockResponse = {
        id: 'chat_ref',
        messages: [{ role: 'assistant', content: 'UI' }],
        webUrl: 'https://v0.dev/chat/chat_ref',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.generatePrototype(contextWithRef);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);

      expect(requestBody.message).toContain('https://example.com/design.png');
    });
  });

  describe('Streaming Progress Updates (US-012)', () => {
    it('should NOT emit progress messages when streaming is disabled', async () => {
      const mockResponse = {
        id: 'chat_no_stream',
        messages: [
          {
            role: 'assistant',
            content: 'Generated Dashboard and Task List screens',
          },
        ],
        webUrl: 'https://v0.dev/chat/chat_no_stream',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const onProgress = jest.fn();
      await service.generatePrototype(validContext, 'v0-1.5-md', false, onProgress);

      // Should NOT call onProgress when streaming is disabled
      expect(onProgress).not.toHaveBeenCalled();
    });

    it('should emit progress messages when streaming is enabled', async () => {
      const mockResponse = {
        id: 'chat_stream',
        messages: [
          {
            role: 'assistant',
            content: 'Generated Dashboard, Task List, and Settings screens',
          },
        ],
        webUrl: 'https://v0.dev/chat/chat_stream',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const progressMessages: string[] = [];
      const onProgress = (message: string) => {
        progressMessages.push(message);
      };

      await service.generatePrototype(validContext, 'v0-1.5-md', true, onProgress);

      // Should emit progress messages
      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages.some(msg => msg.includes('Generating prototype'))).toBe(true);
      expect(progressMessages.some(msg => msg.includes('Calling V0 API'))).toBe(true);
      expect(progressMessages.some(msg => msg.includes('V0 API call successful'))).toBe(true);
      expect(progressMessages.some(msg => msg.includes('Prototype generation complete'))).toBe(true);
    });

    it('should include retry progress messages when V0 API fails temporarily', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      };

      const mockSuccessResponse = {
        id: 'chat_retry',
        messages: [
          {
            role: 'assistant',
            content: 'Generated screens after retry',
          },
        ],
        webUrl: 'https://v0.dev/chat/chat_retry',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce(mockErrorResponse as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSuccessResponse,
        } as Response);

      const progressMessages: string[] = [];
      const onProgress = (message: string) => {
        progressMessages.push(message);
      };

      await service.generatePrototype(validContext, 'v0-1.5-md', true, onProgress);

      // Should include retry messages
      expect(progressMessages.some(msg => msg.includes('Retrying V0 API call'))).toBe(true);
      expect(progressMessages.some(msg => msg.includes('attempt 2'))).toBe(true);
    });

    it('should include screen count in progress messages', async () => {
      const mockResponse = {
        id: 'chat_screens_count',
        messages: [
          {
            role: 'assistant',
            content: 'Generated all screens',
          },
        ],
        webUrl: 'https://v0.dev/chat/chat_screens_count',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const progressMessages: string[] = [];
      const onProgress = (message: string) => {
        progressMessages.push(message);
      };

      await service.generatePrototype(validContext, 'v0-1.5-md', true, onProgress);

      // Should include screen count in V0 API call message
      expect(progressMessages.some(msg => msg.includes('3 screens'))).toBe(true);
    });

    it('should include completion message with generated screen count', async () => {
      const mockResponse = {
        id: 'chat_completion',
        messages: [
          {
            role: 'assistant',
            content: 'Generated Dashboard and Task List screens',
          },
        ],
        webUrl: 'https://v0.dev/chat/chat_completion',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const progressMessages: string[] = [];
      const onProgress = (message: string) => {
        progressMessages.push(message);
      };

      await service.generatePrototype(validContext, 'v0-1.5-md', true, onProgress);

      // Should include completion message with screen counts
      const completionMessages = progressMessages.filter(msg => msg.includes('Prototype generation complete'));
      expect(completionMessages.length).toBeGreaterThan(0);
      expect(completionMessages[0]).toContain('of');
      expect(completionMessages[0]).toContain('screens generated');
    });

    it('should gracefully handle when onProgress callback is not provided', async () => {
      const mockResponse = {
        id: 'chat_no_callback',
        messages: [
          {
            role: 'assistant',
            content: 'Generated Dashboard, Task List, and Settings screens',
          },
        ],
        webUrl: 'https://v0.dev/chat/chat_no_callback',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Should not throw when streaming=true but onProgress is undefined
      const result = await service.generatePrototype(validContext, 'v0-1.5-md', true, undefined);

      // Should succeed without errors
      expect(result.status).toBe('success');
      expect(result.screens_generated).toBe(3);
    });
  });
});
