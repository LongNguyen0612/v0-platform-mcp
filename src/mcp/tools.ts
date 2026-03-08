/**
 * MCP Tool definitions for v0 API integration
 */

import {
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { V0Service } from '../services/v0Service.js';
import { ContextPreparationService } from '../services/contextPreparationService.js';
import { PrototypeGenerationService } from '../services/prototypeGenerationService.js';
import { HandoffService } from '../services/handoffService.js';
import {
  GenerateUISchema,
  GenerateFromImageSchema,
  ChatCompleteSchema,
  GenerateUIInput,
  GenerateFromImageInput,
  ChatCompleteInput,
  PreparePrototypeContextSchema,
  PreparePrototypeContextInput,
  GeneratePrototypeSchema,
  GeneratePrototypeInput,
  HandoffToClaudeDevSchema,
  HandoffToClaudeDevInput,
} from '../types/index.js';
import { logger, logToolCall } from '../utils/logger.js';
import { ErrorHandler } from '../utils/errors.js';

export class V0Tools {
  private v0Service: V0Service;
  private contextService: ContextPreparationService;
  private prototypeService: PrototypeGenerationService;
  private handoffService: HandoffService;

  constructor() {
    this.v0Service = new V0Service();
    this.contextService = new ContextPreparationService();
    this.prototypeService = new PrototypeGenerationService();
    this.handoffService = new HandoffService();
  }

  /**
   * List all available tools
   */
  listTools(): Tool[] {
    return [
      {
        name: 'v0_generate_ui',
        description: 'Generate UI components using v0 AI. Creates React components with TypeScript and Tailwind CSS based on natural language descriptions.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Detailed description of the UI component to generate (e.g., "A modern login form with email, password fields and a blue submit button")',
            },
            model: {
              type: 'string',
              enum: ['v0-1.5-md', 'v0-1.5-lg', 'v0-1.0-md'],
              default: 'v0-1.5-md',
              description: 'v0 model to use for generation',
            },
            stream: {
              type: 'boolean',
              default: false,
              description: 'Whether to stream the response (shows generation progress)',
            },
            context: {
              type: 'string',
              description: 'Optional context or existing code to build upon',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'v0_generate_from_image',
        description: 'Generate UI components from an image reference. Analyzes the provided image and creates corresponding React components.',
        inputSchema: {
          type: 'object',
          properties: {
            imageUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL of the image to analyze and convert to UI components',
            },
            prompt: {
              type: 'string',
              description: 'Optional additional instructions for the generation',
            },
            model: {
              type: 'string',
              enum: ['v0-1.5-md', 'v0-1.5-lg', 'v0-1.0-md'],
              default: 'v0-1.5-md',
              description: 'v0 model to use for generation',
            },
          },
          required: ['imageUrl'],
        },
      },
      {
        name: 'v0_chat_complete',
        description: 'Have a conversation with v0 for iterative UI development. Allows back-and-forth refinement of UI components.',
        inputSchema: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: {
                    type: 'string',
                    enum: ['user', 'assistant', 'system'],
                  },
                  content: {
                    type: 'string',
                  },
                },
                required: ['role', 'content'],
              },
              description: 'Conversation history for context-aware generation',
            },
            model: {
              type: 'string',
              enum: ['v0-1.5-md', 'v0-1.5-lg', 'v0-1.0-md'],
              default: 'v0-1.5-md',
              description: 'v0 model to use for generation',
            },
            stream: {
              type: 'boolean',
              default: false,
              description: 'Whether to stream the response',
            },
          },
          required: ['messages'],
        },
      },
      {
        name: 'v0_setup_check',
        description: 'Check v0 API configuration and connectivity. Validates API key and endpoint accessibility.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'prepare_prototype_context',
        description: 'Parse natural language product description into structured prototype context. Extracts product name, goal, platform (web/mobile), and infers required screens. This is the first step in the prototype workflow before calling generate_prototype.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Natural language description of your product idea (e.g., "Building a booking system called ReserveIt for users to schedule appointments. Needs a dashboard, booking page, and admin panel")',
              minLength: 1,
              maxLength: 5000,
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
              },
              description: 'Optional array of image URLs for visual references (wireframes, screenshots)',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'generate_prototype',
        description: 'Generate multi-screen UI prototype using V0 AI based on structured prototype context. Creates React components with TypeScript and Tailwind CSS. Returns prototype with preview URL and component list. This is step 2 in the prototype workflow (after prepare_prototype_context).',
        inputSchema: {
          type: 'object',
          properties: {
            prototype_context: {
              type: 'object',
              description: 'Structured prototype context from prepare_prototype_context tool',
              properties: {
                product_name: {
                  type: 'string',
                  description: 'Name of the product',
                },
                goal: {
                  type: 'string',
                  description: 'Product goal or purpose',
                },
                platform: {
                  type: 'string',
                  enum: ['web', 'mobile'],
                  description: 'Target platform',
                },
                screens: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of screens to generate',
                },
                design_style: {
                  type: 'string',
                  description: 'Optional design style preferences',
                },
                ui_reference: {
                  type: 'array',
                  items: { type: 'string', format: 'uri' },
                  description: 'Optional visual reference URLs',
                },
              },
              required: ['product_name', 'platform', 'screens'],
            },
            model: {
              type: 'string',
              enum: ['v0-1.5-md', 'v0-1.5-lg', 'v0-1.0-md'],
              default: 'v0-1.5-md',
              description: 'V0 model to use for generation',
            },
            stream: {
              type: 'boolean',
              default: false,
              description: 'Whether to stream the response (shows generation progress)',
            },
          },
          required: ['prototype_context'],
        },
      },
      {
        name: 'handoff_to_claude_dev',
        description: 'Convert a V0 prototype into a structured implementation brief for Claude dev agents. Extracts screens, components, UX patterns, and defines implementation boundaries. This is step 3 in the prototype workflow (after generate_prototype).',
        inputSchema: {
          type: 'object',
          properties: {
            prototype_id: {
              type: 'string',
              description: 'Unique prototype ID from generate_prototype (e.g., proto_1234567890)',
            },
            prototype_result: {
              type: 'object',
              description: 'Prototype result object from generate_prototype',
              properties: {
                status: {
                  type: 'string',
                  enum: ['success', 'partial_success', 'generation_failed'],
                },
                prototype_id: { type: 'string' },
                screens_requested: { type: 'number' },
                screens_generated: { type: 'number' },
                generated_screens: {
                  type: 'array',
                  items: { type: 'string' },
                },
                components: {
                  type: 'array',
                  items: { type: 'string' },
                },
                preview_reference: { type: 'string' },
              },
              required: ['status', 'prototype_id', 'screens_requested', 'screens_generated'],
            },
            prototype_context: {
              type: 'object',
              description: 'Original prototype context from prepare_prototype_context',
              properties: {
                product_name: { type: 'string' },
                goal: { type: 'string' },
                platform: {
                  type: 'string',
                  enum: ['web', 'mobile'],
                },
                screens: {
                  type: 'array',
                  items: { type: 'string' },
                },
                design_style: { type: 'string' },
                ui_reference: {
                  type: 'array',
                  items: { type: 'string', format: 'uri' },
                },
              },
              required: ['product_name', 'platform', 'screens'],
            },
          },
          required: ['prototype_id', 'prototype_result', 'prototype_context'],
        },
      },
    ];
  }

  /**
   * Execute a tool call with enhanced logging and error handling
   */
  async callTool(name: string, arguments_: unknown): Promise<any> {
    const startTime = Date.now();
    
    try {
      logger.info('Tool call started', {
        tool: name,
        hasArguments: !!arguments_,
      });

      let result: any;
      
      switch (name) {
        case 'v0_generate_ui':
          result = await this.handleGenerateUI(arguments_);
          break;

        case 'v0_generate_from_image':
          result = await this.handleGenerateFromImage(arguments_);
          break;

        case 'v0_chat_complete':
          result = await this.handleChatComplete(arguments_);
          break;

        case 'v0_setup_check':
          result = await this.handleSetupCheck();
          break;

        case 'prepare_prototype_context':
          result = await this.handlePreparePrototypeContext(arguments_);
          break;

        case 'generate_prototype':
          result = await this.handleGeneratePrototype(arguments_);
          break;

        case 'handoff_to_claude_dev':
          result = await this.handleHandoffToClaudeDev(arguments_);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      // Log successful tool call
      const duration = Date.now() - startTime;
      logToolCall(name, true, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const mcpError = ErrorHandler.handleError(error, `tool:${name}`);
      
      logToolCall(name, false, duration, {
        errorType: mcpError.type,
        errorMessage: mcpError.message,
      });

      const userMessage = ErrorHandler.createUserMessage(mcpError);

      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${userMessage}`,
        }],
      };
    }
  }

  /**
   * Handle v0_generate_ui tool call
   */
  private async handleGenerateUI(arguments_: unknown) {
    const input = GenerateUISchema.parse(arguments_) as GenerateUIInput;
    const result = await this.v0Service.generateUI(
      input.prompt,
      input.model,
      input.stream,
      input.context
    );

    if (result.success) {
      return {
        content: [{
          type: 'text',
          text: `# Generated UI Component\n\n**Model**: ${result.metadata?.model}\n**Prompt**: ${input.prompt}\n\n${result.content}`,
        }],
      };
    } else {
      throw new Error(result.error || 'Failed to generate UI component');
    }
  }

  /**
   * Handle v0_generate_from_image tool call
   */
  private async handleGenerateFromImage(arguments_: unknown) {
    const input = GenerateFromImageSchema.parse(arguments_) as GenerateFromImageInput;
    const result = await this.v0Service.generateFromImage(
      input.imageUrl,
      input.model,
      input.prompt
    );

    if (result.success) {
      return {
        content: [{
          type: 'text',
          text: `# Generated UI from Image\n\n**Image**: ${input.imageUrl}\n**Model**: ${result.metadata?.model}\n${input.prompt ? `**Additional Prompt**: ${input.prompt}\n` : ''}\n${result.content}`,
        }],
      };
    } else {
      throw new Error(result.error || 'Failed to generate UI from image');
    }
  }

  /**
   * Handle v0_chat_complete tool call
   */
  private async handleChatComplete(arguments_: unknown) {
    const input = ChatCompleteSchema.parse(arguments_) as ChatCompleteInput;
    const result = await this.v0Service.chatComplete(
      input.messages,
      input.model,
      input.stream
    );

    if (result.success) {
      return {
        content: [{
          type: 'text',
          text: result.content,
        }],
      };
    } else {
      throw new Error(result.error || 'Failed to complete chat');
    }
  }

  /**
   * Handle v0_setup_check tool call
   */
  private async handleSetupCheck() {
    try {
      // Test v0 API connectivity with a simple prompt
      const testResult = await this.v0Service.generateUI(
        'Generate a simple hello world div',
        'v0-1.5-md',
        false
      );

      if (testResult.success) {
        return {
          content: [{
            type: 'text',
            text: `✅ v0 API Setup Check Passed\n\n**Status**: Connected\n**Model**: ${testResult.metadata?.model}\n**Usage**: ${testResult.metadata?.usage ? `${testResult.metadata.usage.totalTokens} tokens` : 'N/A'}\n\nv0 MCP server is ready for use!`,
          }],
        };
      } else {
        throw new Error(testResult.error || 'API test failed');
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ v0 API Setup Check Failed\n\n**Error**: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n1. V0_API_KEY environment variable is set\n2. API key is valid\n3. Network connectivity to v0 API`,
        }],
      };
    }
  }

  /**
   * Handle prepare_prototype_context tool call (US-001, US-002, US-003)
   */
  private async handlePreparePrototypeContext(arguments_: unknown) {
    const input = PreparePrototypeContextSchema.parse(arguments_) as PreparePrototypeContextInput;
    const result = await this.contextService.prepareContext(input.text, input.images);

    if (result.status === 'validation_error') {
      return {
        content: [{
          type: 'text',
          text: `❌ Validation Error\n\n**Missing Fields**: ${result.missing_fields?.join(', ')}\n\n**Suggestions**:\n${result.suggestions?.map(s => `- ${s}`).join('\n')}\n\nPlease provide more details and try again.`,
        }],
      };
    }

    if (result.status === 'weak_input') {
      return {
        content: [{
          type: 'text',
          text: `⚠️ Prototype Context Prepared (Weak Input)\n\n**Product Name**: ${result.context?.product_name}\n**Platform**: ${result.context?.platform}\n**Goal**: ${result.context?.goal || 'Not specified'}\n**Screens**: ${result.context?.screens.join(', ')}\n\n**Confidence**: ${result.confidence}\n\n**Suggestions for Better Results**:\n${result.suggestions?.map(s => `- ${s}`).join('\n') || 'N/A'}\n\nYou can proceed with generate_prototype or provide more details for better results.`,
        }],
      };
    }

    // Valid context
    return {
      content: [{
        type: 'text',
        text: `✅ Prototype Context Prepared\n\n**Product Name**: ${result.context?.product_name}\n**Platform**: ${result.context?.platform}\n**Goal**: ${result.context?.goal || 'Not specified'}\n**Screens** (${result.context?.screens.length}):\n${result.context?.screens.map(s => `  - ${s}`).join('\n')}\n\n**Confidence**: ${result.confidence}\n\nReady for generate_prototype! Use this context to generate your multi-screen prototype.`,
      }],
    };
  }

  /**
   * Handle generate_prototype tool call (US-006, US-007, US-009, US-010, US-011)
   */
  private async handleGeneratePrototype(arguments_: unknown) {
    const input = GeneratePrototypeSchema.parse(arguments_) as GeneratePrototypeInput;
    const result = await this.prototypeService.generatePrototype(
      input.prototype_context,
      input.model,
      input.stream
    );

    if (result.status === 'generation_failed') {
      const retryInfo = result.retryable
        ? result.retry_after_seconds
          ? `\n\n⏱️ Rate limited. Retry after ${result.retry_after_seconds} seconds.`
          : '\n\n🔄 This error is retryable. You can try again.'
        : '\n\n❌ This error is not retryable. Please check your input and configuration.';

      return {
        content: [{
          type: 'text',
          text: `❌ Prototype Generation Failed\n\n**Prototype ID**: ${result.prototype_id}\n**Error**: ${result.error}${retryInfo}`,
        }],
      };
    }

    if (result.status === 'partial_success') {
      return {
        content: [{
          type: 'text',
          text: `⚠️ Partial Prototype Generated\n\n**Prototype ID**: ${result.prototype_id}\n**Screens Requested**: ${result.screens_requested}\n**Screens Generated**: ${result.screens_generated}\n\n**Generated Screens**:\n${result.generated_screens?.map(s => `  - ${s}`).join('\n')}\n\n**Components** (${result.components?.length || 0}):\n${result.components?.slice(0, 10).join(', ')}${(result.components?.length || 0) > 10 ? '...' : ''}\n\n**Preview**: ${result.preview_reference || 'N/A'}\n\nSome screens could not be generated. You can regenerate missing screens or proceed with the partial prototype.`,
        }],
      };
    }

    // Success
    return {
      content: [{
        type: 'text',
        text: `✅ Prototype Generated Successfully\n\n**Prototype ID**: ${result.prototype_id}\n**Platform**: ${input.prototype_context.platform}\n**Screens Generated**: ${result.screens_generated}/${result.screens_requested}\n\n**Generated Screens**:\n${result.generated_screens?.map(s => `  - ${s}`).join('\n')}\n\n**Components** (${result.components?.length || 0}):\n${result.components?.slice(0, 10).join(', ')}${(result.components?.length || 0) > 10 ? '...' : ''}\n\n**Preview**: ${result.preview_reference || 'N/A'}\n**Model**: ${result.metadata?.model}\n**Duration**: ${result.metadata?.duration ? `${(result.metadata.duration / 1000).toFixed(2)}s` : 'N/A'}\n\nNext: Use handoff_to_claude_dev to convert this prototype into an implementation brief for development.`,
      }],
    };
  }

  /**
   * Handle handoff_to_claude_dev tool call (US-013, US-014, US-015)
   */
  private async handleHandoffToClaudeDev(arguments_: unknown) {
    const input = HandoffToClaudeDevSchema.parse(arguments_) as HandoffToClaudeDevInput;

    const brief = await this.handoffService.createImplementationBrief(
      input.prototype_id,
      input.prototype_result,
      input.prototype_context
    );

    // Format implementation brief for display
    const screensSection = brief.screens
      .map(screen => {
        const componentsText = screen.components.length > 0
          ? `\n    **Components**: ${screen.components.join(', ')}`
          : '';
        return `  **${screen.name}**\n    ${screen.description}${componentsText}`;
      })
      .join('\n\n');

    const navPatternsText = brief.ux_notes.navigation_patterns
      .map(p => `  - ${p}`)
      .join('\n');

    const screenFlowsText = brief.ux_notes.screen_flows.length > 0
      ? brief.ux_notes.screen_flows.map(f => `  - ${f}`).join('\n')
      : '  - No specific flows detected';

    const interactionPatternsText = brief.ux_notes.interaction_patterns
      .map(p => `  - ${p}`)
      .join('\n');

    const rulesText = brief.implementation_rules
      .map(r => `  ${r}`)
      .join('\n');

    return {
      content: [{
        type: 'text',
        text: `${brief.summary}\n\n## Screens\n\n${screensSection}\n\n## Components\n\n${brief.components.length > 0 ? brief.components.slice(0, 20).join(', ') : 'No components detected'}${brief.components.length > 20 ? '...' : ''}\n\n## UX Patterns\n\n### Navigation Patterns\n${navPatternsText}\n\n### Screen Flows\n${screenFlowsText}\n\n### Interaction Patterns\n${interactionPatternsText}\n\n## Implementation Rules\n\n${rulesText}\n\n${brief.preview_reference ? `## Preview Reference\n\n${brief.preview_reference}\n\n` : ''}---\n\n**Next Steps for Claude Dev Agent:**\n1. Review the implementation rules above\n2. Preserve the V0-generated UI components\n3. Implement backend logic, API integration, and data handling\n4. Add validation, loading states, and error handling\n5. Implement authentication and authorization if needed\n6. Add tests for business logic and critical flows`,
      }],
    };
  }
}