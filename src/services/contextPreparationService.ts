/**
 * Context Preparation Service
 * Handles parsing user text into structured prototype context
 * Implements US-001, US-002, US-003
 */

import {
  PrototypeContext,
  PrototypeContextResult,
  Platform,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { ImageAnalysisService } from './imageAnalysisService.js';

export class ContextPreparationService {
  private imageAnalysisService: ImageAnalysisService;

  constructor() {
    this.imageAnalysisService = new ImageAnalysisService();
  }

  /**
   * Parse user text into structured prototype context
   * US-001: Extract product_name, goal, platform, screens
   * US-004: Analyze images for layout hints
   */
  async prepareContext(text: string, images?: string[]): Promise<PrototypeContextResult> {
    const startTime = Date.now();
    logger.info('Preparing prototype context', { textLength: text.length, imageCount: images?.length || 0 });

    try {
      // Extract product name (US-001)
      const product_name = this.extractProductName(text);

      // Extract goal (US-001)
      const goal = this.extractGoal(text);

      // Infer platform (US-003)
      const platformResult = this.inferPlatform(text);

      // Infer screens (US-002)
      const screens = this.inferScreens(text, platformResult.platform);

      // Analyze images for layout hints (US-004)
      let layout_hints: PrototypeContext['layout_hints'];
      if (images && images.length > 0) {
        try {
          const imageAnalysis = await this.imageAnalysisService.analyzeMultipleImages(images);
          layout_hints = {
            structure: imageAnalysis.structure,
            components: imageAnalysis.components,
            source: 'image_analysis',
            conflicts: imageAnalysis.conflicts.length > 0 ? imageAnalysis.conflicts : undefined,
          };
          logger.info('Image analysis completed', {
            imageCount: images.length,
            structureCount: imageAnalysis.structure.length,
            componentCount: imageAnalysis.components.length,
          });
        } catch (error) {
          logger.warn('Image analysis failed, continuing without layout hints', { error });
          // Don't fail the entire context preparation if image analysis fails
        }
      }

      // Validate completeness
      const validation = this.validateContext({
        product_name,
        goal,
        platform: platformResult.platform,
        screens,
        layout_hints,
        raw_input: text,
      });

      const duration = Date.now() - startTime;
      logger.info('Context preparation completed', {
        duration,
        status: validation.status,
        screenCount: screens.length,
        platform: platformResult.platform,
      });

      return validation;
    } catch (error) {
      logger.error('Context preparation failed', { error });
      throw error;
    }
  }

  /**
   * Extract product name from text
   * Looks for patterns like "building X", "create X", "X app", product name in quotes
   */
  private extractProductName(text: string): string {
    const patterns = [
      /(?:building|create|creating|build|make|making)\s+(?:a|an|the)?\s*([a-zA-Z0-9\s-]+?)(?:\s+(?:app|system|platform|tool|website|dashboard|application))/i,
      /(?:product|app|system|platform|tool|website|dashboard|application)(?:\s+is)?\s+called\s+"([^"]+)"/i,
      /(?:product|app|system|platform|tool|website|dashboard|application)(?:\s+is)?\s+called\s+([a-zA-Z0-9\s-]+)/i,
      /"([^"]+?)"\s+(?:app|system|platform|tool|website|dashboard|application)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 0 && name.length < 50) {
          return name;
        }
      }
    }

    // Fallback: use first 3-5 words if no pattern matches
    const words = text.split(/\s+/).slice(0, 5).join(' ');
    const truncated = words.length > 50 ? words.substring(0, 50) : words;
    return truncated || 'Untitled Product';
  }

  /**
   * Extract goal/description from text
   */
  private extractGoal(text: string): string | undefined {
    // Remove potential product name prefixes and use the rest as goal
    const goalPatterns = [
      /(?:so that|in order to|to help|helps users|allows users to)\s+(.+?)(?:\.|$)/i,
      /(?:goal is to|purpose is to|aim is to)\s+(.+?)(?:\.|$)/i,
    ];

    for (const pattern of goalPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: return the full text if it's reasonably short
    if (text.length <= 200) {
      return text;
    }

    return undefined;
  }

  /**
   * Infer platform from text (US-003)
   * Uses heuristics: dashboard/SaaS → web, mobile app → mobile
   */
  private inferPlatform(text: string): { platform: Platform; confidence: 'high' | 'medium' | 'low'; note?: string } {
    const lowerText = text.toLowerCase();

    // High confidence web indicators
    const webHighConfidence = [
      'dashboard', 'admin panel', 'saas', 'web app', 'website',
      'browser', 'cms', 'crm', 'erp', 'backoffice',
    ];

    // High confidence mobile indicators
    const mobileHighConfidence = [
      'mobile app', 'iphone', 'android', 'ios app',
      'swipe', 'tap', 'gesture', 'smartphone',
    ];

    // Medium confidence web indicators
    const webMediumConfidence = [
      'table', 'sidebar', 'navigation bar', 'admin',
      'analytics', 'report', 'chart', 'graph',
    ];

    // Medium confidence mobile indicators
    const mobileMediumConfidence = [
      'mobile', 'app', 'notification', 'camera',
      'location', 'offline',
    ];

    // Check high confidence patterns first
    for (const keyword of webHighConfidence) {
      if (lowerText.includes(keyword)) {
        return { platform: 'web', confidence: 'high' };
      }
    }

    for (const keyword of mobileHighConfidence) {
      if (lowerText.includes(keyword)) {
        return { platform: 'mobile', confidence: 'high' };
      }
    }

    // Check medium confidence patterns
    let webScore = 0;
    let mobileScore = 0;

    for (const keyword of webMediumConfidence) {
      if (lowerText.includes(keyword)) webScore++;
    }

    for (const keyword of mobileMediumConfidence) {
      if (lowerText.includes(keyword)) mobileScore++;
    }

    if (webScore > mobileScore && webScore > 0) {
      return { platform: 'web', confidence: 'medium' };
    }

    if (mobileScore > webScore && mobileScore > 0) {
      return { platform: 'mobile', confidence: 'medium' };
    }

    // Default to web with note
    return {
      platform: 'web',
      confidence: 'low',
      note: 'Platform defaulted to web (no clear platform indicators found)',
    };
  }

  /**
   * Infer screens from text (US-002)
   * Detects explicit screen mentions and workflow-based inference
   */
  private inferScreens(text: string, platform: Platform): string[] {
    const lowerText = text.toLowerCase();
    const screens = new Set<string>();

    // UI noun detection (explicit mentions)
    const uiNouns = [
      'dashboard', 'login', 'signup', 'sign up', 'register', 'registration',
      'profile', 'settings', 'admin', 'admin panel', 'checkout',
      'cart', 'product', 'search', 'home', 'landing',
      'booking', 'calendar', 'schedule', 'payment', 'invoice',
      'report', 'analytics', 'user management', 'notifications',
    ];

    for (const noun of uiNouns) {
      if (lowerText.includes(noun)) {
        // Normalize the screen name
        let screenName = noun;
        if (!screenName.includes('page') && !screenName.includes('screen')) {
          screenName = platform === 'mobile' ? `${noun} screen` : `${noun} page`;
        }
        screens.add(this.normalizeScreenName(screenName));
      }
    }

    // Workflow inference (actions/verbs that imply screens)
    const workflowPatterns = [
      { pattern: /(?:users?\s+)?(?:can\s+)?(?:view|see|browse|search)\s+([a-z\s]+)/gi, suffix: 'page' },
      { pattern: /(?:users?\s+)?(?:can\s+)?(?:manage|edit|update|create)\s+([a-z\s]+)/gi, suffix: 'management' },
      { pattern: /(?:users?\s+)?(?:can\s+)?(?:book|schedule|reserve)\s+([a-z\s]+)/gi, suffix: 'booking' },
    ];

    for (const { pattern, suffix } of workflowPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const subject = match[1].trim();
          if (subject.length > 2 && subject.length < 30) {
            const screenName = `${subject} ${suffix}`;
            screens.add(this.normalizeScreenName(screenName));
          }
        }
      }
    }

    // If no screens found, infer minimal screens based on product type
    if (screens.size === 0) {
      screens.add(platform === 'mobile' ? 'home screen' : 'home page');

      // Add auth screens for most apps
      if (lowerText.includes('user') || lowerText.includes('account') || lowerText.includes('login')) {
        screens.add(platform === 'mobile' ? 'login screen' : 'login page');
      }

      // Add dashboard for web apps
      if (platform === 'web') {
        screens.add('dashboard');
      }
    }

    // Limit to 10 screens max
    const screenArray = Array.from(screens).slice(0, 10);

    // Ensure at least 1 screen
    if (screenArray.length === 0) {
      screenArray.push(platform === 'mobile' ? 'main screen' : 'main page');
    }

    return screenArray;
  }

  /**
   * Normalize screen name to consistent format
   */
  private normalizeScreenName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/\b(page|screen)\b/gi, (match) => {
        // Keep 'page' or 'screen' but normalize case
        return match.toLowerCase();
      });
  }

  /**
   * Validate prototype context completeness (US-005 partial)
   */
  private validateContext(context: Partial<PrototypeContext>): PrototypeContextResult {
    const missing_fields: string[] = [];
    const suggestions: string[] = [];

    // Check required fields
    if (!context.product_name || context.product_name.length === 0) {
      missing_fields.push('product_name');
      suggestions.push('Provide a clear product name (e.g., "Building a booking system called ReserveIt")');
    }

    if (!context.platform) {
      missing_fields.push('platform');
      suggestions.push('Specify if this is a web or mobile application');
    }

    if (!context.screens || context.screens.length === 0) {
      missing_fields.push('screens');
      suggestions.push('Mention specific screens or workflows (e.g., "users can book appointments on a booking page")');
    }

    // Determine status
    let status: 'valid' | 'weak_input' | 'validation_error';
    let confidence: 'high' | 'medium' | 'low' = 'high';

    if (missing_fields.length > 0) {
      status = 'validation_error';
      confidence = 'low';
    } else if (!context.goal || (context.screens && context.screens.length < 2)) {
      status = 'weak_input';
      confidence = 'medium';
      suggestions.push('Consider providing more details about the product goal and specific screens');
    } else {
      status = 'valid';
    }

    // Build result
    const result: PrototypeContextResult = {
      status,
      confidence,
    };

    if (status !== 'validation_error') {
      result.context = context as PrototypeContext;
    }

    if (suggestions.length > 0) {
      result.suggestions = suggestions;
    }

    if (missing_fields.length > 0) {
      result.missing_fields = missing_fields;
    }

    return result;
  }
}
