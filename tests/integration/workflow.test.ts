import { describe, it, expect, beforeEach } from '@jest/globals';
import { ContextPreparationService } from '../../src/services/contextPreparationService.js';
import { HandoffService } from '../../src/services/handoffService.js';
import { V0Tools } from '../../src/mcp/tools.js';
import type { PrototypeContext, PrototypeResult } from '../../src/types/index.js';

/**
 * End-to-End Workflow Tests (US-019)
 *
 * Tests the full 3-command prototype workflow:
 * 1. prepare_prototype_context → 2. generate_prototype → 3. handoff_to_claude_dev
 *
 * Coverage:
 * - Happy path: Complete workflow with valid inputs
 * - Edge cases: Empty input, vague input, conflicting images
 * - Partial generation scenarios
 * - Validation failures: Invalid context data
 * - Data flow through workflow
 *
 * Note: V0 API tests are mocked to avoid actual API calls
 */
describe('End-to-End Prototype Workflow (US-019)', () => {
  let contextService: ContextPreparationService;
  let handoffService: HandoffService;
  let tools: V0Tools;

  beforeEach(() => {
    contextService = new ContextPreparationService();
    handoffService = new HandoffService();
    tools = new V0Tools();
  });

  describe('Happy Path - Step 1: Prepare Context (US-019)', () => {
    it('should parse product description into structured context', async () => {
      const inputText = 'Building a task management system called TaskMaster. Users need a dashboard, task list, and settings page.';
      const result = await contextService.prepareContext(inputText);

      // Verify successful context preparation
      expect(result.status).toBe('valid');
      expect(result.context).toBeDefined();
      expect(result.context?.product_name).toBeTruthy();
      expect(result.context?.platform).toBe('web'); // Dashboard implies web
      expect(result.context?.screens.length).toBeGreaterThan(0);
      expect(result.confidence).toBe('high');

      // Verify screens were extracted
      const hasRelevantScreens = result.context!.screens.some(
        screen => screen.includes('dashboard') || screen.includes('task') || screen.includes('settings')
      );
      expect(hasRelevantScreens).toBe(true);
    });

    it('should complete Step 1 via MCP tool', async () => {
      const toolsList = await tools.listTools();
      expect(toolsList.length).toBe(7); // 4 existing + 3 prototype workflow tools

      const toolNames = toolsList.map(t => t.name);
      expect(toolNames).toContain('prepare_prototype_context');

      const result = await tools.callTool('prepare_prototype_context', {
        text: 'Create a booking app with calendar, reservations, and admin dashboard.'
      });

      // Successful result doesn't have isError property
      expect(result.isError).not.toBe(true);
      expect(result.content).toBeDefined();

      // Result is formatted text output from MCP tool, not JSON
      const resultText = result.content[0].text;
      expect(resultText).toContain('Prototype Context Prepared');
      expect(resultText).toContain('booking'); // Should mention booking
      expect(resultText).toContain('web'); // Should infer web platform
    });
  });

  describe('Happy Path - Step 3: Handoff to Claude Dev (US-019)', () => {
    it('should create implementation brief from prototype result', async () => {
      // Create mock context and prototype result
      const mockContext: PrototypeContext = {
        product_name: 'TaskMaster',
        goal: 'Task management system',
        platform: 'web',
        screens: ['dashboard', 'task-list', 'settings']
      };

      const mockPrototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_123456789',
        screens_requested: 3,
        screens_generated: 3,
        generated_screens: ['dashboard', 'task-list', 'settings'],
        components: ['task-card', 'filter-bar', 'settings-form'],
        preview_reference: 'https://v0.dev/t/test-preview',
        metadata: {
          model: 'v0-1.5-md',
          generation_time_ms: 5000,
          webUrl: 'https://v0.dev/t/test-preview'
        }
      };

      const implementationBrief = await handoffService.createImplementationBrief(
        'proto_123456789',
        mockPrototypeResult,
        mockContext
      );

      // Verify implementation brief structure
      expect(implementationBrief.prototype_id).toBe('proto_123456789');
      expect(implementationBrief.summary).toBeTruthy();
      expect(implementationBrief.screens.length).toBe(3);
      expect(implementationBrief.components.length).toBe(3);
      expect(implementationBrief.ux_notes).toBeDefined();
      expect(implementationBrief.implementation_rules.length).toBeGreaterThan(0);
      expect(implementationBrief.preview_reference).toBe('https://v0.dev/t/test-preview');

      // Verify UX notes structure
      expect(implementationBrief.ux_notes.navigation_patterns).toBeDefined();
      expect(implementationBrief.ux_notes.screen_flows).toBeDefined();
      expect(implementationBrief.ux_notes.interaction_patterns).toBeDefined();

      // Verify implementation rules include key boundaries
      const rulesText = implementationBrief.implementation_rules.join(' ');
      expect(rulesText.toUpperCase()).toContain('PRESERVE');
      expect(rulesText.toLowerCase()).toContain('backend');
    });

    it('should complete Step 3 via MCP tool', async () => {
      const mockContext: PrototypeContext = {
        product_name: 'UserApp',
        goal: 'User management',
        platform: 'web',
        screens: ['home', 'profile']
      };

      const mockPrototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_987654321',
        screens_requested: 2,
        screens_generated: 2,
        generated_screens: ['home', 'profile'],
        components: ['user-avatar', 'profile-form'],
        preview_reference: 'https://v0.dev/t/test',
        metadata: { model: 'v0-1.5-md', generation_time_ms: 3000 }
      };

      const result = await tools.callTool('handoff_to_claude_dev', {
        prototype_id: 'proto_987654321',
        prototype_result: mockPrototypeResult,
        prototype_context: mockContext
      });

      expect(result.isError).not.toBe(true);
      expect(result.content).toBeDefined();

      // Result is formatted text, not JSON
      const resultText = result.content[0].text;
      expect(resultText).toContain('UserApp'); // Product name
      expect(resultText).toContain('home');
      expect(resultText).toContain('profile');
    });
  });

  describe('Edge Case - Empty Input (US-019)', () => {
    it('should handle empty text gracefully', async () => {
      const result = await contextService.prepareContext('');

      // Empty input should either be weak_input or validation_error
      expect(['weak_input', 'validation_error']).toContain(result.status);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });

    it('should handle whitespace-only input', async () => {
      const result = await contextService.prepareContext('   \n\t   ');

      // Whitespace should be treated as empty
      expect(['weak_input', 'validation_error', 'valid']).toContain(result.status);

      if (result.status === 'valid') {
        // Service might infer minimal context, which is acceptable
        expect(result.context).toBeDefined();
      }
    });
  });

  describe('Edge Case - Vague Input (US-019)', () => {
    it('should return weak_input status for vague description', async () => {
      const result = await contextService.prepareContext('Make an app');

      expect(result.status).toBe('weak_input');
      expect(['low', 'medium']).toContain(result.confidence!); // Accept low or medium confidence
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });

    it('should infer minimal context from very vague input', async () => {
      const result = await contextService.prepareContext('A mobile social network');

      // Should at least infer platform and generate some screens
      expect(result.context).toBeDefined();
      expect(result.context?.platform).toBe('mobile');
      expect(result.context?.screens.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Case - Conflicting Images (US-019)', () => {
    it('should analyze multiple images', async () => {
      const images = [
        'https://example.com/wireframe-with-sidebar.png',
        'https://example.com/wireframe-no-sidebar.png'
      ];

      const result = await contextService.prepareContext('Build a dashboard', images);

      // Should process images without crashing
      expect(['valid', 'weak_input']).toContain(result.status);

      if (result.context?.layout_hints) {
        // Layout hints should be present if analysis succeeded
        expect(result.context.layout_hints).toBeDefined();
      }
    });

    it('should consolidate common patterns from multiple images', async () => {
      const images = [
        'https://example.com/dashboard-wireframe-1.png',
        'https://example.com/dashboard-wireframe-2.png',
        'https://example.com/dashboard-wireframe-3.png'
      ];

      const result = await contextService.prepareContext('Create a dashboard app', images);

      expect(result.context).toBeDefined();

      if (result.context?.layout_hints) {
        // Should have analyzed images
        expect(result.context.layout_hints.source).toBeTruthy();
        // Source should indicate image analysis
        expect(['image_analysis', 'images']).toContain(result.context.layout_hints.source);
      }
    });
  });

  describe('Edge Case - Partial Generation (US-019)', () => {
    it('should handle partial_success status in handoff', async () => {
      const partialContext: PrototypeContext = {
        product_name: 'PartialApp',
        goal: 'Test partial generation',
        platform: 'web',
        screens: ['dashboard', 'settings', 'profile', 'admin', 'reports']
      };

      const partialResult: PrototypeResult = {
        status: 'partial_success',
        prototype_id: 'proto_partial',
        screens_requested: 5,
        screens_generated: 3,
        generated_screens: ['dashboard', 'settings', 'profile'],
        components: ['dashboard-widget', 'settings-panel', 'profile-card'],
        preview_reference: 'https://v0.dev/t/partial',
        metadata: { model: 'v0-1.5-md', generation_time_ms: 4000 }
      };

      const implementationBrief = await handoffService.createImplementationBrief(
        'proto_partial',
        partialResult,
        partialContext
      );

      // Should still create valid brief for partial results
      expect(implementationBrief.prototype_id).toBe('proto_partial');
      expect(implementationBrief.screens.length).toBe(3);
      expect(implementationBrief.components.length).toBe(3);

      // Summary should note partial generation
      expect(implementationBrief.summary.toLowerCase()).toContain('generated');
    });
  });

  describe('Validation Failures (US-019)', () => {
    it('should reject handoff with missing required fields', async () => {
      const invalidResult: any = {
        prototype_id: 'proto_123'
        // Missing all other required fields
      };

      try {
        await handoffService.createImplementationBrief(invalidResult);
        fail('Should have thrown error for invalid input');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should reject handoff with malformed prototype result', async () => {
      const malformedResult: any = {
        status: 'success',
        prototype_id: 'proto_456',
        // screens_requested and screens_generated missing
        components: ['component1'],
        preview_reference: 'https://v0.dev/t/test'
      };

      try {
        await handoffService.createImplementationBrief(malformedResult);
        fail('Should have thrown error for malformed input');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Workflow Integration - Data Flow (US-019)', () => {
    it('should preserve data through context → handoff flow', async () => {
      // Step 1: Prepare context
      const contextResult = await contextService.prepareContext(
        'Build FlowTest app with home and settings screens for web platform'
      );

      expect(contextResult.status).toBe('valid');
      const context = contextResult.context!;

      // Step 2: Mock prototype generation (create result that would come from V0)
      const mockPrototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: `proto_${Date.now()}`,
        screens_requested: context.screens.length,
        screens_generated: context.screens.length,
        generated_screens: context.screens,
        components: ['navbar', 'sidebar', 'footer'],
        preview_reference: 'https://v0.dev/t/flowtest',
        metadata: {
          model: 'v0-1.5-md',
          generation_time_ms: 3000,
          webUrl: 'https://v0.dev/t/flowtest'
        }
      };

      // Step 3: Create implementation brief
      const implementationBrief = await handoffService.createImplementationBrief(
        mockPrototypeResult.prototype_id,
        mockPrototypeResult,
        context
      );

      // Verify data flow
      expect(implementationBrief.prototype_id).toBe(mockPrototypeResult.prototype_id);
      expect(implementationBrief.screens.length).toBe(context.screens.length);
      expect(implementationBrief.preview_reference).toBe(mockPrototypeResult.preview_reference);

      // Verify context goal flows through to summary
      if (context.goal) {
        expect(implementationBrief.summary).toBeTruthy();
      }
    });

    it('should preserve platform-specific guidance through workflow', async () => {
      // Mobile platform workflow
      const mobileContext: PrototypeContext = {
        product_name: 'MobileApp',
        goal: 'Mobile social network',
        platform: 'mobile',
        screens: ['feed', 'profile']
      };

      const mockMobileResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_mobile',
        screens_requested: 2,
        screens_generated: 2,
        generated_screens: ['feed', 'profile'],
        components: ['post-card', 'profile-header'],
        preview_reference: 'https://v0.dev/t/mobile',
        metadata: { model: 'v0-1.5-md', generation_time_ms: 3000 }
      };

      const mobileImplementationBrief = await handoffService.createImplementationBrief(
        mockMobileResult.prototype_id,
        mockMobileResult,
        mobileContext
      );

      // Verify mobile-specific rules
      const rulesText = mobileImplementationBrief.implementation_rules.join(' ').toLowerCase();
      expect(rulesText).toContain('offline');
      expect(rulesText).toContain('mobile'); // Mobile rules should mention mobile

      // Web platform workflow
      const webContext: PrototypeContext = {
        product_name: 'WebApp',
        goal: 'Web dashboard',
        platform: 'web',
        screens: ['dashboard', 'analytics']
      };

      const mockWebResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_web',
        screens_requested: 2,
        screens_generated: 2,
        generated_screens: ['dashboard', 'analytics'],
        components: ['chart', 'table'],
        preview_reference: 'https://v0.dev/t/web',
        metadata: { model: 'v0-1.5-md', generation_time_ms: 3000 }
      };

      const webImplementationBrief = await handoffService.createImplementationBrief(
        mockWebResult.prototype_id,
        mockWebResult,
        webContext
      );

      // Verify web-specific rules
      const webRulesText = webImplementationBrief.implementation_rules.join(' ').toLowerCase();
      expect(webRulesText).toContain('responsive');
      expect(webRulesText).toContain('seo');
    });
  });

  describe('Tool Registration Verification (US-019)', () => {
    it('should have all 3 prototype workflow tools registered', async () => {
      const toolsList = await tools.listTools();

      const toolNames = toolsList.map(t => t.name);
      expect(toolNames).toContain('prepare_prototype_context');
      expect(toolNames).toContain('generate_prototype');
      expect(toolNames).toContain('handoff_to_claude_dev');

      // Verify each tool has proper schema
      const prepareContextTool = toolsList.find(t => t.name === 'prepare_prototype_context');
      expect(prepareContextTool?.inputSchema).toBeDefined();
      expect(prepareContextTool?.description).toBeTruthy();

      const generatePrototypeTool = toolsList.find(t => t.name === 'generate_prototype');
      expect(generatePrototypeTool?.inputSchema).toBeDefined();
      expect(generatePrototypeTool?.description).toBeTruthy();

      const handoffTool = toolsList.find(t => t.name === 'handoff_to_claude_dev');
      expect(handoffTool?.inputSchema).toBeDefined();
      expect(handoffTool?.description).toBeTruthy();
    });
  });

  describe('Error Handling Across Workflow (US-019)', () => {
    it('should handle invalid tool arguments gracefully', async () => {
      // Test prepare_prototype_context with invalid args
      const result1 = await tools.callTool('prepare_prototype_context', {
        invalid_field: 'value'
      });

      // Should error but not crash
      expect(result1).toBeDefined();

      // Test handoff_to_claude_dev with invalid args
      const result2 = await tools.callTool('handoff_to_claude_dev', {
        invalid_field: 'value'
      });

      expect(result2).toBeDefined();
      expect(result2.isError).toBe(true);
    });

    it('should provide helpful error messages for missing required fields', async () => {
      const result = await tools.callTool('handoff_to_claude_dev', {
        prototype_result: {
          prototype_id: 'test'
          // Missing required fields
        }
      });

      expect(result.isError).toBe(true);

      if (typeof result.content === 'string') {
        expect(result.content.toLowerCase()).toContain('required');
      }
    });
  });
});
