/**
 * v0 API Service using Platform API
 */

import { config } from '../config/index.js';
import { ToolResult, V0Model } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { ErrorHandler, V0McpError } from '../utils/errors.js';

export class V0Service {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.v0.baseUrl;
    this.apiKey = config.v0.apiKey;
  }

  /**
   * Make HTTP request to v0 Platform API
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Generate UI component from text prompt using Platform API
   */
  async generateUI(
    prompt: string,
    model: V0Model = config.v0.defaultModel,
    _stream: boolean = false,
    context?: string
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting UI generation via Platform API', {
        model,
        hasContext: !!context,
        promptLength: prompt.length,
      });

      const userPrompt = context
        ? `Context: ${context}\n\nRequest: ${prompt}`
        : prompt;

      // Create a new chat with the Platform API
      const chatData = await this.request('/chats', {
        method: 'POST',
        body: JSON.stringify({
          message: userPrompt,
        }),
      });

      // Extract the assistant's response from the chat
      const assistantMessage = chatData.messages?.find((msg: any) => msg.role === 'assistant');

      if (!assistantMessage || !assistantMessage.content) {
        throw new Error('No response generated from v0 API');
      }

      const duration = Date.now() - startTime;
      logger.info('UI generation completed', {
        chatId: chatData.id,
        duration,
      });

      return {
        success: true,
        content: assistantMessage.content,
        metadata: {
          model: chatData.modelConfiguration?.modelId || model,
          chatId: chatData.id,
          webUrl: chatData.webUrl,
          duration,
        },
      };
    } catch (error) {
      const mcpError = ErrorHandler.handleError(error, 'generateUI');
      return this.handleError(mcpError);
    }
  }

  /**
   * Generate UI from image using Platform API
   */
  async generateFromImage(
    imageUrl: string,
    model: V0Model = config.v0.defaultModel,
    prompt?: string
  ): Promise<ToolResult> {
    try {
      const userPrompt = prompt
        ? `Based on this image: ${imageUrl}\nAdditional requirements: ${prompt}`
        : `Generate UI components based on this image: ${imageUrl}`;

      // Create a new chat with the Platform API
      const chatData = await this.request('/chats', {
        method: 'POST',
        body: JSON.stringify({
          message: userPrompt,
        }),
      });

      const assistantMessage = chatData.messages?.find((msg: any) => msg.role === 'assistant');

      if (!assistantMessage || !assistantMessage.content) {
        throw new Error('No content generated from v0 API');
      }

      return {
        success: true,
        content: assistantMessage.content,
        metadata: {
          model: chatData.modelConfiguration?.modelId || model,
          chatId: chatData.id,
          webUrl: chatData.webUrl,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Chat completion with conversation context using Platform API
   */
  async chatComplete(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    model: V0Model = config.v0.defaultModel,
    _stream: boolean = false
  ): Promise<ToolResult> {
    try {
      // Get the last user message
      const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();

      if (!lastUserMessage) {
        throw new Error('No user message found in conversation');
      }

      // Create a new chat with the Platform API
      const chatData = await this.request('/chats', {
        method: 'POST',
        body: JSON.stringify({
          message: lastUserMessage.content,
        }),
      });

      const assistantMessage = chatData.messages?.find((msg: any) => msg.role === 'assistant');

      if (!assistantMessage || !assistantMessage.content) {
        throw new Error('No response generated from v0 API');
      }

      return {
        success: true,
        content: assistantMessage.content,
        metadata: {
          model: chatData.modelConfiguration?.modelId || model,
          chatId: chatData.id,
          webUrl: chatData.webUrl,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Handle API errors with enhanced error information
   */
  private handleError(error: V0McpError | unknown): ToolResult {
    let mcpError: V0McpError;
    
    if (error instanceof V0McpError) {
      mcpError = error;
    } else {
      mcpError = ErrorHandler.handleError(error, 'v0Service');
    }

    const userMessage = ErrorHandler.createUserMessage(mcpError);

    return {
      success: false,
      error: userMessage,
      metadata: {
        errorType: mcpError.type,
        statusCode: mcpError.statusCode,
        retryable: mcpError.retryable,
        context: mcpError.context,
      },
    };
  }
}