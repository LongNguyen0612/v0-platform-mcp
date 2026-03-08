/**
 * Type definitions for v0-mcp
 */

import { z } from 'zod';

// v0 API Models
export const V0ModelSchema = z.enum(['v0-1.5-md', 'v0-1.5-lg', 'v0-1.0-md']);
export type V0Model = z.infer<typeof V0ModelSchema>;

// Tool Input Schemas
export const GenerateUISchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  model: V0ModelSchema.default('v0-1.5-md'),
  stream: z.boolean().default(false),
  context: z.string().optional(),
});

export const GenerateFromImageSchema = z.object({
  imageUrl: z.string().url('Valid image URL is required'),
  prompt: z.string().optional(),
  model: V0ModelSchema.default('v0-1.5-md'),
});

export const ChatCompleteSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
  model: V0ModelSchema.default('v0-1.5-md'),
  stream: z.boolean().default(false),
});

// Tool Input Types
export type GenerateUIInput = z.infer<typeof GenerateUISchema>;
export type GenerateFromImageInput = z.infer<typeof GenerateFromImageSchema>;
export type ChatCompleteInput = z.infer<typeof ChatCompleteSchema>;

// Tool Output Types
export interface ToolResult {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: {
    model?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    } | undefined;
    chatId?: string | undefined;
    webUrl?: string | undefined;
    duration?: number | undefined;
    errorType?: string | undefined;
    statusCode?: number | undefined;
    retryable?: boolean | undefined;
    context?: string | undefined;
  };
}

// Configuration Types
export interface V0Config {
  apiKey: string;
  baseUrl: string;
  defaultModel: V0Model;
  timeout: number;
}

export interface AppConfig {
  v0: V0Config;
  mcp: {
    serverName: string;
    version: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

// Prototype Workflow Types (US-001+)
export const PlatformSchema = z.enum(['web', 'mobile']);
export type Platform = z.infer<typeof PlatformSchema>;

export const PrototypeContextSchema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  goal: z.string().optional(),
  platform: PlatformSchema,
  screens: z.array(z.string()).min(1, 'At least one screen is required'),
  design_style: z.string().optional(),
  ui_reference: z.array(z.string().url()).optional(),
  raw_input: z.string().optional(),
});

export const PreparePrototypeContextSchema = z.object({
  text: z.string().min(1, 'Text input is required').max(5000, 'Text input must be less than 5000 characters'),
  images: z.array(z.string().url()).optional(),
});

export const PrototypeContextResultSchema = z.object({
  status: z.enum(['valid', 'weak_input', 'validation_error']),
  context: PrototypeContextSchema.optional(),
  suggestions: z.array(z.string()).optional(),
  missing_fields: z.array(z.string()).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
});

export type PrototypeContext = z.infer<typeof PrototypeContextSchema>;
export type PreparePrototypeContextInput = z.infer<typeof PreparePrototypeContextSchema>;
export type PrototypeContextResult = z.infer<typeof PrototypeContextResultSchema>;