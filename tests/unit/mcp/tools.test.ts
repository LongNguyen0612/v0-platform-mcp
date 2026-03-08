import { describe, it, expect, beforeEach } from '@jest/globals';
import { V0Tools } from '../../../src/mcp/tools.js';

describe('V0Tools', () => {
  let v0Tools: V0Tools;

  beforeEach(() => {
    v0Tools = new V0Tools();
  });

  describe('listTools - US-016: Register 3 Tools with MCP Server', () => {
    it('should return all 7 available tools including 3 new prototype workflow tools', () => {
      // Act
      const tools = v0Tools.listTools();

      // Assert
      expect(tools).toHaveLength(7);
      expect(tools.map(tool => tool.name)).toEqual([
        'v0_generate_ui',
        'v0_generate_from_image',
        'v0_chat_complete',
        'v0_setup_check',
        'prepare_prototype_context',
        'generate_prototype',
        'handoff_to_claude_dev',
      ]);
    });

    it('should have correct schema for v0_generate_ui', () => {
      const tools = v0Tools.listTools();
      const tool = tools.find(t => t.name === 'v0_generate_ui');

      expect(tool?.inputSchema.properties?.prompt).toBeDefined();
      expect(tool?.inputSchema.required).toContain('prompt');
      expect(tool?.description).toContain('Generate UI components');
    });

    it('should have correct schema for v0_generate_from_image', () => {
      const tools = v0Tools.listTools();
      const tool = tools.find(t => t.name === 'v0_generate_from_image');

      expect(tool?.inputSchema.properties?.imageUrl).toBeDefined();
      expect(tool?.inputSchema.required).toContain('imageUrl');
      expect(tool?.description).toContain('Generate UI components from an image');
    });

    it('should have correct schema for v0_chat_complete', () => {
      const tools = v0Tools.listTools();
      const tool = tools.find(t => t.name === 'v0_chat_complete');

      expect(tool?.inputSchema.properties?.messages).toBeDefined();
      expect(tool?.inputSchema.required).toContain('messages');
      expect(tool?.description).toContain('conversation');
    });

    it('should have correct schema for prepare_prototype_context', () => {
      const tools = v0Tools.listTools();
      const tool = tools.find(t => t.name === 'prepare_prototype_context');

      // Check inputSchema exists and has correct properties
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.properties?.text).toBeDefined();
      expect(tool?.inputSchema.properties?.images).toBeDefined();
      expect(tool?.inputSchema.required).toContain('text');

      // Check text field constraints
      expect(tool?.inputSchema.properties?.text).toMatchObject({
        type: 'string',
        minLength: 1,
        maxLength: 5000,
      });

      // Check images is optional array of URIs
      expect(tool?.inputSchema.properties?.images).toMatchObject({
        type: 'array',
        items: {
          type: 'string',
          format: 'uri',
        },
      });

      // Check description
      expect(tool?.description).toContain('Parse natural language');
      expect(tool?.description).toContain('first step');
    });

    it('should have correct schema for generate_prototype', () => {
      const tools = v0Tools.listTools();
      const tool = tools.find(t => t.name === 'generate_prototype');

      // Check inputSchema exists and has correct properties
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.properties?.prototype_context).toBeDefined();
      expect(tool?.inputSchema.properties?.model).toBeDefined();
      expect(tool?.inputSchema.properties?.stream).toBeDefined();
      expect(tool?.inputSchema.required).toContain('prototype_context');

      // Check prototype_context structure
      const prototypeContext = tool?.inputSchema.properties?.prototype_context as any;
      expect(prototypeContext.properties?.product_name).toBeDefined();
      expect(prototypeContext.properties?.goal).toBeDefined();
      expect(prototypeContext.properties?.platform).toBeDefined();
      expect(prototypeContext.properties?.screens).toBeDefined();
      expect(prototypeContext.required).toEqual(['product_name', 'platform', 'screens']);

      // Check platform enum
      expect(prototypeContext.properties?.platform.enum).toEqual(['web', 'mobile']);

      // Check description
      expect(tool?.description).toContain('multi-screen UI prototype');
      expect(tool?.description).toContain('step 2');
    });

    it('should have correct schema for handoff_to_claude_dev', () => {
      const tools = v0Tools.listTools();
      const tool = tools.find(t => t.name === 'handoff_to_claude_dev');

      // Check inputSchema exists and has correct properties
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.properties?.prototype_id).toBeDefined();
      expect(tool?.inputSchema.properties?.prototype_result).toBeDefined();
      expect(tool?.inputSchema.properties?.prototype_context).toBeDefined();
      expect(tool?.inputSchema.required).toEqual([
        'prototype_id',
        'prototype_result',
        'prototype_context',
      ]);

      // Check prototype_result structure
      const prototypeResult = tool?.inputSchema.properties?.prototype_result as any;
      expect(prototypeResult.properties?.status).toBeDefined();
      expect(prototypeResult.properties?.prototype_id).toBeDefined();
      expect(prototypeResult.properties?.screens_requested).toBeDefined();
      expect(prototypeResult.properties?.screens_generated).toBeDefined();
      expect(prototypeResult.properties?.status.enum).toEqual([
        'success',
        'partial_success',
        'generation_failed',
      ]);

      // Check description
      expect(tool?.description).toContain('implementation brief');
      expect(tool?.description).toContain('step 3');
    });
  });

  describe('callTool - Tool Execution', () => {
    describe('error handling', () => {
      it('should handle unknown tool name', async () => {
        // Act
        const result = await v0Tools.callTool('unknown_tool', {});

        // Assert
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error:');
        // Error handler may genericize the message, so just check it's an error
      });

      it('should handle invalid input for prepare_prototype_context', async () => {
        // Act - empty text should trigger validation error
        const result = await v0Tools.callTool('prepare_prototype_context', {});

        // Assert - should return error
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error:');
      });

      it('should handle invalid input for generate_prototype', async () => {
        // Act - missing prototype_context should trigger validation error
        const result = await v0Tools.callTool('generate_prototype', {});

        // Assert - should return error
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error:');
      });

      it('should handle invalid input for handoff_to_claude_dev', async () => {
        // Act - missing required fields should trigger validation error
        const result = await v0Tools.callTool('handoff_to_claude_dev', {});

        // Assert - should return error
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error:');
      });
    });

    describe('Streaming Support - US-012', () => {
      it('should accept stream parameter in generate_prototype schema', () => {
        const tools = v0Tools.listTools();
        const tool = tools.find(t => t.name === 'generate_prototype');

        expect(tool?.inputSchema.properties?.stream).toBeDefined();
        expect(tool?.inputSchema.properties?.stream).toEqual({
          type: 'boolean',
          default: false,
          description: 'Whether to stream the response (shows generation progress)',
        });
      });

      it('should have stream parameter with default value false', () => {
        const tools = v0Tools.listTools();
        const tool = tools.find(t => t.name === 'generate_prototype');

        expect(tool?.inputSchema.properties?.stream?.default).toBe(false);
      });

      it('should not require stream parameter', () => {
        const tools = v0Tools.listTools();
        const tool = tools.find(t => t.name === 'generate_prototype');

        expect(tool?.inputSchema.required).not.toContain('stream');
      });
    });
  });
});
