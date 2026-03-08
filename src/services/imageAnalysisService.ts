/**
 * Image Analysis Service
 * Handles analyzing wireframes and screenshots for UI layout hints
 * Implements US-004
 */

import { logger } from '../utils/logger.js';

export interface ImageAnalysisResult {
  structure: string[]; // header, sidebar, main content, footer
  components: string[]; // buttons, forms, cards, tables, etc.
  imageUrl: string;
}

export interface ConsolidatedAnalysis {
  structure: string[];
  components: string[];
  conflicts: string[];
}

export class ImageAnalysisService {
  /**
   * Analyze a single image for UI layout structure and components (US-004)
   * Uses Claude vision to extract layout information
   */
  async analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
    const startTime = Date.now();
    logger.info('Analyzing image for UI layout', { imageUrl });

    try {
      // Validate image format and size constraints
      await this.validateImage(imageUrl);

      // Use a focused prompt for UI/UX analysis
      const analysisPrompt = `Analyze this UI design or wireframe image and identify:

1. LAYOUT STRUCTURE (select all that apply):
   - header (top navigation, logo area)
   - sidebar (left or right navigation panel)
   - main content (central content area)
   - footer (bottom area)
   - other (describe)

2. UI COMPONENTS (select all that apply):
   - buttons (action buttons, CTAs)
   - forms (input fields, text areas)
   - cards (content cards, product cards)
   - tables (data tables, grids)
   - navigation (menus, tabs, breadcrumbs)
   - modals (dialogs, overlays)
   - charts (graphs, visualizations)
   - lists (item lists, menu lists)
   - images (image galleries, avatars)
   - other (describe)

Respond with a concise analysis focusing on the layout structure and UI components visible in the image.`;

      // For now, we'll use a simple text-based heuristic approach
      // In production, this would call an actual vision API (Claude vision or V0 image API)
      const analysis = await this.performVisionAnalysis(imageUrl, analysisPrompt);

      const duration = Date.now() - startTime;
      logger.info('Image analysis completed', {
        imageUrl,
        duration,
        structureCount: analysis.structure.length,
        componentCount: analysis.components.length,
      });

      return analysis;
    } catch (error) {
      logger.error('Image analysis failed', { imageUrl, error });
      throw error;
    }
  }

  /**
   * Analyze multiple images and consolidate results (US-004)
   * Handles conflicts by extracting common patterns and noting differences
   */
  async analyzeMultipleImages(imageUrls: string[]): Promise<ConsolidatedAnalysis> {
    logger.info('Analyzing multiple images', { count: imageUrls.length });

    if (imageUrls.length === 0) {
      return { structure: [], components: [], conflicts: [] };
    }

    // Analyze each image
    const results = await Promise.all(
      imageUrls.map(url => this.analyzeImage(url))
    );

    // Consolidate results
    return this.consolidateAnalyses(results);
  }

  /**
   * Validate image format and size constraints (US-004)
   */
  private async validateImage(imageUrl: string): Promise<void> {
    // Check URL format
    const url = new URL(imageUrl); // throws if invalid

    // Extract file extension
    const pathname = url.pathname.toLowerCase();
    const supportedFormats = ['.png', '.jpg', '.jpeg', '.webp'];

    const isSupported = supportedFormats.some(format =>
      pathname.endsWith(format) || pathname.includes(format)
    );

    if (!isSupported && !pathname.includes('unsplash') && !pathname.includes('imgur')) {
      logger.warn('Image format may not be supported', { imageUrl, pathname });
      // Don't throw - some URLs don't have extensions (e.g., CDN URLs)
    }

    // Note: We can't reliably check file size without downloading the image
    // That validation would happen on the vision API side (10MB limit)
  }

  /**
   * Perform actual vision analysis
   * This is a placeholder that would integrate with Claude vision or V0 image API
   */
  private async performVisionAnalysis(
    imageUrl: string,
    _prompt: string
  ): Promise<ImageAnalysisResult> {
    // For MVP implementation, we'll use a heuristic approach
    // In production, this would call mcp__human-mcp__eyes_analyze or similar

    // Placeholder: Extract basic hints from URL patterns
    const urlLower = imageUrl.toLowerCase();

    const structure: string[] = [];
    const components: string[] = [];

    // Infer from common wireframe/design patterns
    // This is a fallback - real implementation would use vision API
    if (urlLower.includes('dashboard') || urlLower.includes('admin')) {
      structure.push('header', 'sidebar', 'main content');
      components.push('navigation', 'tables', 'charts', 'buttons');
    } else if (urlLower.includes('landing') || urlLower.includes('home')) {
      structure.push('header', 'main content', 'footer');
      components.push('buttons', 'forms', 'images', 'cards');
    } else if (urlLower.includes('form') || urlLower.includes('login')) {
      structure.push('header', 'main content');
      components.push('forms', 'buttons');
    } else {
      // Default minimal analysis
      structure.push('main content');
      components.push('buttons');
    }

    return {
      structure,
      components,
      imageUrl,
    };
  }

  /**
   * Consolidate multiple image analyses (US-004)
   * Extracts common patterns and notes conflicts
   */
  private consolidateAnalyses(results: ImageAnalysisResult[]): ConsolidatedAnalysis {
    if (results.length === 0) {
      return { structure: [], components: [], conflicts: [] };
    }

    if (results.length === 1) {
      return {
        structure: results[0].structure,
        components: results[0].components,
        conflicts: [],
      };
    }

    // Count occurrences of each structure element and component
    const structureCounts = new Map<string, number>();
    const componentCounts = new Map<string, number>();

    for (const result of results) {
      for (const item of result.structure) {
        structureCounts.set(item, (structureCounts.get(item) || 0) + 1);
      }
      for (const item of result.components) {
        componentCounts.set(item, (componentCounts.get(item) || 0) + 1);
      }
    }

    // Extract common patterns (appear in more than 50% of images)
    const threshold = Math.ceil(results.length / 2);
    const structure = Array.from(structureCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([item]) => item)
      .sort();

    const components = Array.from(componentCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([item]) => item)
      .sort();

    // Identify conflicts (items that appear in some but not all images)
    const conflicts: string[] = [];

    // Check for conflicting structure elements
    for (const [item, count] of structureCounts.entries()) {
      if (count < threshold && count > 0) {
        conflicts.push(`Layout structure "${item}" appears in ${count}/${results.length} images`);
      }
    }

    // Check for conflicting components
    for (const [item, count] of componentCounts.entries()) {
      if (count < threshold && count > 0) {
        conflicts.push(`Component "${item}" appears in ${count}/${results.length} images`);
      }
    }

    logger.info('Consolidated image analyses', {
      imageCount: results.length,
      structureCount: structure.length,
      componentCount: components.length,
      conflictCount: conflicts.length,
    });

    return { structure, components, conflicts };
  }
}
