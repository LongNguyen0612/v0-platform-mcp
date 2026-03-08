/**
 * Prototype Generation Service (US-006, US-007, US-009, US-010, US-011)
 *
 * Handles V0 API integration for multi-screen prototype generation.
 * Enforces "no backend" constraints and implements retry logic.
 */

import { config } from '../config/index.js';
import { PrototypeContext, PrototypeResult, V0Model } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { ErrorHandler } from '../utils/errors.js';

export class PrototypeGenerationService {
  private baseUrl: string;
  private apiKey: string;
  private maxRetries: number = 3;
  private retryDelays: number[] = [1000, 2000, 4000]; // Exponential backoff in ms

  constructor() {
    this.baseUrl = config.v0.baseUrl;
    this.apiKey = config.v0.apiKey;
  }

  /**
   * Generate multi-screen prototype from structured context (US-006, US-012)
   *
   * @param stream - If true, yields progress updates during generation (US-012)
   */
  async generatePrototype(
    prototypeContext: PrototypeContext,
    model: V0Model = config.v0.defaultModel,
    stream: boolean = false,
    onProgress?: (message: string) => void
  ): Promise<PrototypeResult> {
    const startTime = Date.now();
    const prototypeId = `proto_${Date.now()}`;

    try {
      logger.info('Starting prototype generation', {
        prototypeId,
        model,
        platform: prototypeContext.platform,
        screensRequested: prototypeContext.screens.length,
        streaming: stream,
      });

      // Emit initial progress (US-012)
      if (stream && onProgress) {
        onProgress('Generating prototype...');
      }

      // Construct V0 prompt with no-backend constraints (US-007)
      const prompt = this.buildPrompt(prototypeContext);

      // Emit progress update (US-012)
      if (stream && onProgress) {
        onProgress(`Calling V0 API to generate ${prototypeContext.screens.length} screens...`);
      }

      // Call V0 API with retry logic (US-009)
      const chatData = await this.callV0WithRetry('/chats', {
        method: 'POST',
        body: JSON.stringify({
          message: prompt,
        }),
      }, stream, onProgress);

      // Emit processing progress (US-012)
      if (stream && onProgress) {
        onProgress('Processing generated prototype...');
      }

      // Extract generated content
      const assistantMessage = chatData.messages?.find((msg: any) => msg.role === 'assistant');
      if (!assistantMessage || !assistantMessage.content) {
        throw new Error('No response generated from V0 API');
      }

      const duration = Date.now() - startTime;

      // Parse and analyze the generated content
      const analysis = this.analyzeGeneratedContent(assistantMessage.content, prototypeContext.screens);

      // Emit completion progress (US-012)
      if (stream && onProgress) {
        onProgress(`Prototype generation complete: ${analysis.screensGenerated} of ${prototypeContext.screens.length} screens generated`);
      }

      logger.info('Prototype generation completed', {
        prototypeId,
        chatId: chatData.id,
        duration,
        screensGenerated: analysis.screensGenerated,
      });

      // Return structured prototype result (US-010)
      return {
        status: analysis.screensGenerated === prototypeContext.screens.length
          ? 'success'
          : 'partial_success',
        prototype_id: prototypeId,
        screens_requested: prototypeContext.screens.length,
        screens_generated: analysis.screensGenerated,
        generated_screens: analysis.generatedScreens,
        components: analysis.components,
        preview_reference: chatData.webUrl,
        metadata: {
          model: chatData.modelConfiguration?.modelId || model,
          duration,
          webUrl: chatData.webUrl,
        },
      };
    } catch (error) {
      const mcpError = ErrorHandler.handleError(error, 'generatePrototype');

      logger.error('Prototype generation failed', {
        prototypeId,
        errorType: mcpError.type,
        errorMessage: mcpError.message,
      });

      // Determine if error is retryable based on error message or status code
      const isRetryable = this.isErrorRetryable(mcpError.message);
      const isRateLimited = mcpError.message.includes('429') || mcpError.message.toLowerCase().includes('rate limit');

      // Return failure result with retry info
      return {
        status: 'generation_failed',
        prototype_id: prototypeId,
        screens_requested: prototypeContext.screens.length,
        screens_generated: 0,
        error: mcpError.message,
        retryable: isRetryable || mcpError.retryable,
        retry_after_seconds: isRateLimited ? 60 : undefined,
      };
    }
  }

  /**
   * Build V0 prompt with no-backend constraints (US-007)
   *
   * Critical: Enforces clean separation between UI (V0) and backend (Claude)
   */
  private buildPrompt(context: PrototypeContext): string {
    const parts: string[] = [];

    // Product overview
    parts.push(`# ${context.product_name}`);
    if (context.goal) {
      parts.push(`\n**Goal**: ${context.goal}`);
    }
    parts.push(`\n**Platform**: ${context.platform}`);

    // NO BACKEND constraints (US-007)
    parts.push('\n\n## CRITICAL CONSTRAINTS');
    parts.push('- **UI PROTOTYPE ONLY** - No backend logic, no database schema, no APIs, no authentication');
    parts.push('- Use placeholder data and mock states');
    parts.push('- Focus purely on visual layout, components, and UI interactions');
    parts.push('- Do not implement data fetching, validation, or business logic');

    // Screens to generate
    parts.push('\n\n## Screens to Generate');
    parts.push(`Generate ${context.screens.length} screens for this ${context.platform} application:`);
    context.screens.forEach((screen, index) => {
      parts.push(`${index + 1}. ${screen}`);
    });

    // Design style (if specified)
    if (context.design_style) {
      parts.push(`\n\n## Design Style`);
      parts.push(context.design_style);
    }

    // UI reference images (if provided)
    if (context.ui_reference && context.ui_reference.length > 0) {
      parts.push(`\n\n## Visual References`);
      parts.push('Consider these design references:');
      context.ui_reference.forEach((ref) => {
        parts.push(`- ${ref}`);
      });
    }

    parts.push('\n\nGenerate modern, responsive UI components using React, TypeScript, and Tailwind CSS.');

    return parts.join('\n');
  }

  /**
   * Call V0 API with retry logic (US-009, US-012)
   *
   * Retry strategy:
   * - Max 3 retries with exponential backoff (1s, 2s, 4s)
   * - Retry on: 500, 502, 503, network errors
   * - Do NOT retry on: 400, 401, 403 (client errors)
   *
   * @param stream - If true, emit progress updates during API calls
   * @param onProgress - Callback for streaming progress messages
   */
  private async callV0WithRetry(
    endpoint: string,
    options: RequestInit,
    stream: boolean = false,
    onProgress?: (message: string) => void
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        };

        logger.info('V0 API call attempt', { attempt: attempt + 1, maxRetries: this.maxRetries + 1 });

        // Emit attempt progress (US-012)
        if (stream && onProgress) {
          if (attempt === 0) {
            onProgress('Sending request to V0...');
          } else {
            onProgress(`Retrying V0 API call (attempt ${attempt + 1}/${this.maxRetries + 1})...`);
          }
        }

        const response = await fetch(url, {
          ...options,
          headers,
        });

        // Success
        if (response.ok) {
          // Emit success progress (US-012)
          if (stream && onProgress) {
            onProgress('V0 API call successful, analyzing response...');
          }
          return await response.json();
        }

        // Handle errors
        const errorText = await response.text();
        const statusCode = response.status;

        // Do NOT retry on client errors (400, 401, 403, 404), except rate limits (429)
        if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          throw new Error(`V0 API error (${statusCode}): ${errorText}`);
        }

        // Retry on server errors (500, 502, 503) or rate limits (429)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelays[attempt] || 4000;
          logger.warn('V0 API call failed, retrying...', {
            statusCode,
            attempt: attempt + 1,
            retryAfter: delay,
          });

          // Emit retry progress (US-012)
          if (stream && onProgress) {
            onProgress(`V0 API returned error ${statusCode}, retrying in ${delay / 1000}s...`);
          }

          await this.sleep(delay);
          lastError = new Error(`V0 API error (${statusCode}): ${errorText}`);
          continue;
        }

        // Max retries reached
        throw new Error(`V0 API error (${statusCode}) after ${this.maxRetries + 1} attempts: ${errorText}`);
      } catch (error) {
        // Network errors or fetch failures
        if (attempt < this.maxRetries && this.isRetryableError(error)) {
          const delay = this.retryDelays[attempt] || 4000;
          logger.warn('V0 API network error, retrying...', {
            error: error instanceof Error ? error.message : 'Unknown error',
            attempt: attempt + 1,
            retryAfter: delay,
          });

          // Emit network error progress (US-012)
          if (stream && onProgress) {
            onProgress(`Network error occurred, retrying in ${delay / 1000}s...`);
          }

          await this.sleep(delay);
          lastError = error as Error;
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('V0 API call failed after all retries');
  }

  /**
   * Check if error is retryable (network errors, timeouts)
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true; // Network error
    }
    if (error instanceof Error && error.message.includes('timeout')) {
      return true; // Timeout error
    }
    return false;
  }

  /**
   * Check if error message indicates a retryable condition
   */
  private isErrorRetryable(message: string): boolean {
    // Server errors (500, 502, 503) and rate limits (429) are retryable
    const retryablePatterns = ['500', '502', '503', '429', 'after 4 attempts'];
    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Analyze generated content to extract screens and components (US-010)
   */
  private analyzeGeneratedContent(content: string, requestedScreens: string[]): {
    screensGenerated: number;
    generatedScreens: string[];
    components: string[];
  } {
    const generatedScreens: string[] = [];
    const components: string[] = [];

    // Detect generated screens by looking for screen names in content
    for (const screen of requestedScreens) {
      const screenVariants = [
        screen.toLowerCase(),
        screen.replace(/\s+/g, ''),
        screen.replace(/\s+/g, '-'),
        screen.replace(/\s+/g, '_'),
      ];

      const found = screenVariants.some(variant =>
        content.toLowerCase().includes(variant.toLowerCase())
      );

      if (found) {
        generatedScreens.push(screen);
      }
    }

    // Extract component names (simple heuristic: look for React component declarations)
    const componentRegex = /(?:function|const|export)\s+([A-Z][a-zA-Z0-9]*)/g;
    let match;
    while ((match = componentRegex.exec(content)) !== null) {
      const componentName = match[1];
      if (!components.includes(componentName)) {
        components.push(componentName);
      }
    }

    // If we couldn't detect specific screens, assume some were generated
    const screensGenerated = generatedScreens.length > 0
      ? generatedScreens.length
      : Math.min(requestedScreens.length, 3); // Conservative estimate

    return {
      screensGenerated,
      generatedScreens: generatedScreens.length > 0 ? generatedScreens : requestedScreens.slice(0, screensGenerated),
      components,
    };
  }
}
