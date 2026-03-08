/**
 * Handoff Service (US-013, US-014, US-015)
 *
 * Converts V0 prototypes into structured implementation briefs for Claude dev agents.
 * Maintains clear boundaries: V0 answers "What should UI look like?", Claude answers "How should system work?"
 */

import { PrototypeContext, PrototypeResult, ImplementationBrief } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class HandoffService {
  /**
   * Convert prototype to implementation brief (US-013)
   *
   * Creates a structured brief that clearly separates UI layout (preserve)
   * from business logic (implement).
   */
  async createImplementationBrief(
    prototypeId: string,
    prototypeResult: PrototypeResult,
    prototypeContext: PrototypeContext
  ): Promise<ImplementationBrief> {
    logger.info('Creating implementation brief', {
      prototypeId,
      screensGenerated: prototypeResult.screens_generated,
    });

    // Generate summary
    const summary = this.generateSummary(prototypeContext, prototypeResult);

    // Extract screen information
    const screens = this.extractScreens(prototypeContext, prototypeResult);

    // Extract UX patterns (US-014)
    const uxNotes = this.extractUxPatterns(prototypeContext, screens);

    // Define implementation rules (US-015)
    const implementationRules = this.defineImplementationRules(prototypeContext);

    const brief: ImplementationBrief = {
      prototype_id: prototypeId,
      summary,
      screens,
      components: prototypeResult.components || [],
      ux_notes: uxNotes,
      implementation_rules: implementationRules,
      preview_reference: prototypeResult.preview_reference,
    };

    logger.info('Implementation brief created', {
      prototypeId,
      screensCount: screens.length,
      componentsCount: brief.components.length,
    });

    return brief;
  }

  /**
   * Generate high-level summary of the product and prototype
   */
  private generateSummary(
    context: PrototypeContext,
    result: PrototypeResult
  ): string {
    const parts: string[] = [];

    parts.push(`# ${context.product_name} - Implementation Brief`);
    parts.push('');

    if (context.goal) {
      parts.push(`**Product Goal**: ${context.goal}`);
    }

    parts.push(`**Platform**: ${context.platform}`);
    parts.push(`**Prototype Status**: ${result.status === 'success' ? 'Complete' : 'Partial'}`);
    parts.push(`**Screens**: ${result.screens_generated}/${result.screens_requested} generated`);
    parts.push('');

    parts.push('## Overview');
    parts.push(`This is an implementation brief for ${context.product_name}, a ${context.platform} application.`);
    parts.push(`The UI prototype has been generated with V0 and contains ${result.screens_generated} screens.`);
    parts.push('Your task is to implement the backend logic, data handling, and business rules while preserving the prototyped UI layout.');

    return parts.join('\n');
  }

  /**
   * Extract screen information with component details
   */
  private extractScreens(
    context: PrototypeContext,
    result: PrototypeResult
  ): Array<{ name: string; description: string; components: string[] }> {
    const generatedScreenNames = result.generated_screens || context.screens;

    return generatedScreenNames.map((screenName) => {
      // Generate description based on screen name and platform
      const description = this.generateScreenDescription(screenName, context.platform);

      // Extract components that might be related to this screen
      const screenComponents = this.extractScreenComponents(
        screenName,
        result.components || []
      );

      return {
        name: screenName,
        description,
        components: screenComponents,
      };
    });
  }

  /**
   * Generate description for a screen based on its name and platform
   */
  private generateScreenDescription(screenName: string, platform: string): string {
    const normalized = screenName.toLowerCase();

    // Common screen patterns
    if (normalized.includes('dashboard') || normalized.includes('home')) {
      return `Main ${platform} dashboard screen. Shows key metrics, navigation, and primary actions.`;
    }
    if (normalized.includes('login') || normalized.includes('signin') || normalized.includes('auth')) {
      return `Authentication screen for user login. Includes form validation and error handling.`;
    }
    if (normalized.includes('signup') || normalized.includes('register')) {
      return `User registration screen. Captures user information and creates new accounts.`;
    }
    if (normalized.includes('profile') || normalized.includes('account')) {
      return `User profile screen. Displays and allows editing of user information.`;
    }
    if (normalized.includes('settings') || normalized.includes('preferences')) {
      return `Settings screen for user preferences and application configuration.`;
    }
    if (normalized.includes('admin')) {
      return `Admin panel screen with elevated permissions. Manages system configuration and user administration.`;
    }
    if (normalized.includes('list') || normalized.includes('browse') || normalized.includes('search')) {
      return `List/browse screen. Displays filterable and searchable data with pagination.`;
    }
    if (normalized.includes('detail') || normalized.includes('view')) {
      return `Detail view screen. Shows comprehensive information about a single item.`;
    }
    if (normalized.includes('create') || normalized.includes('add') || normalized.includes('new')) {
      return `Creation screen. Form for adding new items with validation.`;
    }
    if (normalized.includes('edit') || normalized.includes('update')) {
      return `Edit screen. Form for updating existing items with validation and conflict handling.`;
    }
    if (normalized.includes('checkout') || normalized.includes('cart')) {
      return `Checkout/cart screen. Handles transaction flow and payment processing.`;
    }

    // Default
    return `${screenName} screen for ${platform} application.`;
  }

  /**
   * Extract components that are likely related to a specific screen
   */
  private extractScreenComponents(screenName: string, allComponents: string[]): string[] {
    const normalized = screenName.toLowerCase().replace(/[^a-z]/g, '');

    // Filter components that match the screen name
    return allComponents.filter((component) => {
      const componentNormalized = component.toLowerCase().replace(/[^a-z]/g, '');

      // Check if component name contains screen name or vice versa
      return (
        componentNormalized.includes(normalized) ||
        normalized.includes(componentNormalized)
      );
    }).slice(0, 10); // Limit to 10 components per screen
  }

  /**
   * Extract UX patterns from the prototype (US-014)
   *
   * Identifies navigation, flows, and interaction patterns.
   */
  private extractUxPatterns(
    context: PrototypeContext,
    screens: Array<{ name: string; description: string; components: string[] }>
  ): {
    navigation_patterns: string[];
    screen_flows: string[];
    interaction_patterns: string[];
  } {
    const navigationPatterns: string[] = [];
    const screenFlows: string[] = [];
    const interactionPatterns: string[] = [];

    // Infer navigation patterns based on screen types
    const screenNames = screens.map(s => s.name.toLowerCase());

    if (screenNames.some(name => name.includes('dashboard') || name.includes('home'))) {
      navigationPatterns.push('Primary navigation centered around dashboard/home screen');
    }

    if (screenNames.some(name => name.includes('admin'))) {
      navigationPatterns.push('Separate admin navigation section with elevated permissions');
    }

    if (screenNames.length > 5) {
      navigationPatterns.push('Multi-level navigation recommended (sidebar + top nav or tab navigation)');
    } else {
      navigationPatterns.push('Simple navigation structure (top nav or bottom tabs for mobile)');
    }

    if (context.platform === 'mobile') {
      navigationPatterns.push('Mobile-optimized navigation (bottom tabs, swipe gestures, hamburger menu)');
    } else {
      navigationPatterns.push('Web navigation (sidebar, top navigation bar, breadcrumbs)');
    }

    // Infer screen flows based on common patterns
    if (
      screenNames.some(name => name.includes('login')) &&
      screenNames.some(name => name.includes('dashboard'))
    ) {
      screenFlows.push('Login → Dashboard (authentication flow)');
    }

    if (
      screenNames.some(name => name.includes('list') || name.includes('browse')) &&
      screenNames.some(name => name.includes('detail'))
    ) {
      screenFlows.push('List/Browse → Detail View (master-detail pattern)');
    }

    if (
      screenNames.some(name => name.includes('create') || name.includes('add')) &&
      screenNames.some(name => name.includes('list'))
    ) {
      screenFlows.push('List → Create → List (CRUD flow)');
    }

    if (
      screenNames.some(name => name.includes('cart') || name.includes('checkout'))
    ) {
      screenFlows.push('Browse → Cart → Checkout → Confirmation (e-commerce flow)');
    }

    if (
      screenNames.some(name => name.includes('profile') || name.includes('settings'))
    ) {
      screenFlows.push('Dashboard → Settings/Profile → Save → Dashboard (settings flow)');
    }

    // Infer interaction patterns based on platform and screen types
    if (context.platform === 'mobile') {
      interactionPatterns.push('Touch-optimized interactions (tap, swipe, pinch-to-zoom)');
      interactionPatterns.push('Modal dialogs for focused actions');
      interactionPatterns.push('Pull-to-refresh for data updates');
    } else {
      interactionPatterns.push('Mouse/keyboard interactions (click, hover states, keyboard shortcuts)');
      interactionPatterns.push('Inline editing where appropriate');
      interactionPatterns.push('Tooltips and hover previews for additional context');
    }

    if (screenNames.some(name => name.includes('list') || name.includes('browse'))) {
      interactionPatterns.push('Filterable and searchable lists with pagination or infinite scroll');
    }

    if (screenNames.some(name => name.includes('form') || name.includes('create') || name.includes('edit'))) {
      interactionPatterns.push('Form validation with inline error messages');
      interactionPatterns.push('Auto-save or draft functionality for long forms');
    }

    interactionPatterns.push('Loading states for async operations');
    interactionPatterns.push('Empty states with helpful guidance');
    interactionPatterns.push('Error states with recovery actions');

    return {
      navigation_patterns: navigationPatterns,
      screen_flows: screenFlows,
      interaction_patterns: interactionPatterns,
    };
  }

  /**
   * Define implementation boundaries and rules (US-015)
   *
   * Critical for maintaining V0/Claude separation principle.
   */
  private defineImplementationRules(context: PrototypeContext): string[] {
    const rules: string[] = [];

    // Core separation principle
    rules.push('**PRESERVE VISUAL LAYOUT**: Use the V0-generated components as-is. Do not redesign unless absolutely necessary.');
    rules.push('**IMPLEMENT BACKEND LOGIC**: Add API integration, data fetching, state management, and business rules.');
    rules.push('**ADD VALIDATION**: Implement form validation, input sanitization, and error handling.');
    rules.push('**IMPLEMENT AUTH**: Add authentication, authorization, and session management if applicable.');
    rules.push('**ADD LOADING STATES**: Implement loading indicators, skeleton screens, and optimistic updates.');
    rules.push('**HANDLE ERRORS**: Add comprehensive error handling with user-friendly messages and recovery actions.');
    rules.push('**IMPLEMENT DATA FETCHING**: Connect UI to real data sources (APIs, databases) with proper error handling and caching.');
    rules.push('**ADD PERSISTENCE**: Implement data storage, offline support if needed, and sync mechanisms.');

    // Platform-specific rules
    if (context.platform === 'web') {
      rules.push('**SEO & ACCESSIBILITY**: Ensure proper semantic HTML, ARIA labels, and meta tags for web accessibility.');
      rules.push('**RESPONSIVE DESIGN**: Verify responsive behavior across desktop, tablet, and mobile viewports.');
      rules.push('**PERFORMANCE**: Optimize bundle size, implement code splitting, and lazy loading.');
    } else {
      rules.push('**MOBILE PERFORMANCE**: Optimize for mobile devices (minimize re-renders, efficient state updates).');
      rules.push('**OFFLINE SUPPORT**: Consider offline-first architecture with local storage and sync.');
      rules.push('**NATIVE FEATURES**: Integrate mobile-specific features (push notifications, camera, geolocation) as needed.');
    }

    // General implementation guidelines
    rules.push('**TESTING**: Add unit tests for business logic, integration tests for API calls, and E2E tests for critical flows.');
    rules.push('**SECURITY**: Implement input sanitization, XSS prevention, CSRF protection, and secure API communication.');
    rules.push('**MONITORING**: Add error tracking, analytics, and performance monitoring.');
    rules.push('**DOCUMENTATION**: Document API contracts, data models, and complex business logic.');

    return rules;
  }
}
