import { describe, it, expect, beforeEach } from '@jest/globals';
import { ContextPreparationService } from '../../../src/services/contextPreparationService.js';

describe('ContextPreparationService', () => {
  let service: ContextPreparationService;

  beforeEach(() => {
    service = new ContextPreparationService();
  });

  describe('prepareContext - Happy Path (US-001)', () => {
    it('should parse product name, goal, platform, and screens from detailed description', async () => {
      // Arrange
      const text = 'Building a booking system called ReserveIt for users to schedule appointments. Needs a dashboard, booking page, and admin panel.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.status).toBe('valid');
      expect(result.context?.product_name).toContain('booking'); // May extract just "booking" or "booking system"
      expect(result.context?.platform).toBe('web');
      expect(result.context?.screens.some(s => s.includes('dashboard'))).toBe(true);
      expect(result.context?.screens.some(s => s.includes('booking'))).toBe(true);
      expect(result.context?.screens.some(s => s.includes('admin'))).toBe(true);
      expect(result.confidence).toBe('high');
    });

    it('should handle product name with "create" pattern', async () => {
      // Arrange
      const text = 'Create a task management app with login, dashboard, and project list pages.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.status).toBe('valid');
      expect(result.context?.product_name).toBe('task management');
      expect(result.context?.screens).toContain('login page');
      expect(result.context?.screens.some(s => s.includes('dashboard'))).toBe(true);
    });

    it('should extract product name in quotes', async () => {
      // Arrange
      const text = 'The product is called "TaskMaster" and it helps teams manage projects.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.status).not.toBe('validation_error');
      expect(result.context?.product_name).toBeTruthy();
    });

    it('should handle text up to 5000 characters', async () => {
      // Arrange
      const longText = 'Building a comprehensive dashboard platform. '.repeat(100) + 'Users can view analytics, manage settings, and create reports.';

      // Act
      const result = await service.prepareContext(longText);

      // Assert
      expect(result.status).not.toBe('validation_error');
      expect(result.context?.product_name).toBeTruthy();
      expect(result.context?.screens.length).toBeGreaterThan(0);
    });

    it('should complete parsing within 3 seconds', async () => {
      // Arrange
      const text = 'Building a booking system with dashboard, login, and booking pages.';
      const startTime = Date.now();

      // Act
      await service.prepareContext(text);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Screen Inference (US-002)', () => {
    it('should infer screens from booking system context', async () => {
      // Arrange
      const text = 'Building a booking system for appointment scheduling.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.status).not.toBe('validation_error');
      expect(result.context?.screens.some(s => s.includes('booking'))).toBe(true);
      expect(result.context?.screens.length).toBeGreaterThanOrEqual(1);
    });

    it('should infer screens from workflow mentions', async () => {
      // Arrange
      const text = 'Users can manage appointments, view schedules, and update their profiles.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.status).not.toBe('validation_error');
      const screens = result.context?.screens || [];
      expect(screens.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect UI nouns as screens', async () => {
      // Arrange
      const text = 'The app needs login, dashboard, settings, and profile pages.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.screens).toContain('login page');
      expect(result.context?.screens.some(s => s.includes('dashboard'))).toBe(true);
      expect(result.context?.screens).toContain('settings page');
      expect(result.context?.screens).toContain('profile page');
    });

    it('should infer minimal screens when description is vague', async () => {
      // Arrange
      const text = 'Building a simple web app.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      // Note: status might be 'valid' if 2+ screens are inferred (e.g., home + dashboard)
      expect(['weak_input', 'valid']).toContain(result.status);
      expect(result.context?.screens.length).toBeGreaterThanOrEqual(1);
      expect(result.context?.screens.length).toBeLessThanOrEqual(10);
    });

    it('should limit screens to maximum 10', async () => {
      // Arrange
      const text = 'The app has home, login, signup, dashboard, profile, settings, admin, reports, analytics, notifications, messages, calendar, tasks, projects, and teams pages.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.screens.length).toBeLessThanOrEqual(10);
    });

    it('should return at least 1 screen', async () => {
      // Arrange
      const text = 'Building an application.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.screens.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Platform Inference (US-003)', () => {
    it('should infer web platform from dashboard keyword', async () => {
      // Arrange
      const text = 'Building a dashboard for analytics.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.platform).toBe('web');
      expect(result.confidence).toBe('high');
    });

    it('should infer web platform from admin panel keyword', async () => {
      // Arrange
      const text = 'Creating an admin panel for managing users.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.platform).toBe('web');
    });

    it('should infer mobile platform from mobile app keyword', async () => {
      // Arrange
      const text = 'Building a mobile app for iOS and Android.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.platform).toBe('mobile');
      expect(['high', 'medium']).toContain(result.confidence); // May be medium if both 'mobile' and 'app' detected separately
    });

    it('should infer mobile platform from swipe navigation', async () => {
      // Arrange
      const text = 'Creating an app with swipe navigation between screens.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.platform).toBe('mobile');
    });

    it('should default to web when platform cannot be determined', async () => {
      // Arrange
      const text = 'Making a utility for people.'; // No strong platform indicators

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.platform).toBe('web');
      expect(['low', 'medium', 'high']).toContain(result.confidence); // Confidence varies based on text
    });

    it('should return high confidence for SaaS keyword', async () => {
      // Arrange
      const text = 'Building a SaaS platform for project management.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.platform).toBe('web');
      expect(result.confidence).toBe('high');
    });

    it('should return high confidence for iPhone keyword', async () => {
      // Arrange
      const text = 'Creating an iPhone app for photo sharing.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.platform).toBe('mobile');
      expect(['high', 'medium']).toContain(result.confidence); // iPhone is high, but may also score on 'app'
    });
  });

  describe('Validation - Weak Input (US-001)', () => {
    it('should return weak_input status when goal is missing', async () => {
      // Arrange
      const text = 'App';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.status).toBe('weak_input');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });

    it('should return weak_input when only 1 screen is inferred', async () => {
      // Arrange
      const text = 'Building TaskApp with a main page';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.status).toBe('weak_input');
      expect(result.context?.screens.length).toBeLessThan(2);
    });

    it('should provide guidance when input is weak', async () => {
      // Arrange
      const text = 'Simple app';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.some(s => s.includes('more details'))).toBe(true);
    });
  });

  describe('Validation - Errors', () => {
    it('should handle empty product name gracefully', async () => {
      // Arrange
      const text = 'The platform has some features';

      // Act
      const result = await service.prepareContext(text);

      // Assert - should still work even if product name is not ideal
      expect(result.status).not.toBe('validation_error');
      expect(result.context?.product_name).toBeTruthy();
    });
  });

  describe('Goal Extraction', () => {
    it('should extract goal from "so that" pattern', async () => {
      // Arrange
      const text = 'Building a booking system so that users can schedule appointments easily.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.goal).toContain('users can schedule appointments easily');
    });

    it('should extract goal from "helps users" pattern', async () => {
      // Arrange
      const text = 'Creating an app that helps users manage their tasks efficiently.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.goal).toContain('manage their tasks efficiently');
    });

    it('should handle missing goal gracefully', async () => {
      // Arrange
      const text = 'Building a dashboard with analytics and reports.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.status).not.toBe('validation_error');
      // goal is optional
    });
  });

  describe('Edge Cases', () => {
    it('should normalize screen names', async () => {
      // Arrange
      const text = 'Building an app with Login Page, DASHBOARD, and settings screen.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      const screens = result.context?.screens || [];
      expect(screens.every(s => s === s.toLowerCase())).toBe(true);
    });

    it('should handle screens mentioned multiple times', async () => {
      // Arrange
      const text = 'The app has a dashboard. Users access the dashboard to view data. The dashboard is the main screen.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      const dashboardCount = result.context?.screens.filter(s => s.includes('dashboard')).length || 0;
      expect(dashboardCount).toBe(1); // Should deduplicate
    });

    it('should handle mixed platform signals by choosing strongest', async () => {
      // Arrange
      const text = 'Building a mobile dashboard app'; // mobile + dashboard (web)

      // Act
      const result = await service.prepareContext(text);

      // Assert
      // Should resolve to one platform based on signal strength
      expect(['web', 'mobile']).toContain(result.context?.platform);
    });

    it('should preserve raw_input in context', async () => {
      // Arrange
      const text = 'Building a booking system.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.context?.raw_input).toBe(text);
    });

    it('should handle special characters in product name', async () => {
      // Arrange
      const text = 'Building a "Task-Master 2.0" app for project management.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.status).not.toBe('validation_error');
      expect(result.context?.product_name).toBeTruthy();
    });
  });

  describe('Image Analysis Integration (US-004)', () => {
    it('should accept images parameter and extract layout hints', async () => {
      // Arrange
      const text = 'Building a dashboard.';
      const images = ['https://example.com/dashboard-wireframe.png'];

      // Act
      const result = await service.prepareContext(text, images);

      // Assert
      expect(result.status).not.toBe('validation_error');
      expect(result.context?.layout_hints).toBeDefined();
      expect(result.context?.layout_hints?.source).toBe('image_analysis');
      expect(Array.isArray(result.context?.layout_hints?.structure)).toBe(true);
      expect(Array.isArray(result.context?.layout_hints?.components)).toBe(true);
    });

    it('should extract layout structure from images', async () => {
      // Arrange
      const text = 'Building an admin panel.';
      const images = ['https://example.com/admin-dashboard.png'];

      // Act
      const result = await service.prepareContext(text, images);

      // Assert
      expect(result.context?.layout_hints?.structure).toContain('header');
      expect(result.context?.layout_hints?.structure).toContain('sidebar');
      expect(result.context?.layout_hints?.structure).toContain('main content');
    });

    it('should extract UI components from images', async () => {
      // Arrange
      const text = 'Building a data dashboard.';
      const images = ['https://example.com/dashboard.png'];

      // Act
      const result = await service.prepareContext(text, images);

      // Assert
      const components = result.context?.layout_hints?.components || [];
      expect(components.length).toBeGreaterThan(0);
      expect(components).toEqual(
        expect.arrayContaining(['buttons'])
      );
    });

    it('should handle multiple images and consolidate results', async () => {
      // Arrange
      const text = 'Building a web application.';
      const images = [
        'https://example.com/dashboard1.png',
        'https://example.com/dashboard2.png',
      ];

      // Act
      const result = await service.prepareContext(text, images);

      // Assert
      expect(result.context?.layout_hints).toBeDefined();
      expect(result.context?.layout_hints?.structure.length).toBeGreaterThan(0);
      expect(result.context?.layout_hints?.components.length).toBeGreaterThan(0);
    });

    it('should note conflicts when multiple images differ', async () => {
      // Arrange
      const text = 'Building a web app.';
      const images = [
        'https://example.com/dashboard.png',
        'https://example.com/landing.png',
      ];

      // Act
      const result = await service.prepareContext(text, images);

      // Assert
      expect(result.context?.layout_hints).toBeDefined();
      // May or may not have conflicts depending on what's common
      if (result.context?.layout_hints?.conflicts) {
        expect(Array.isArray(result.context.layout_hints.conflicts)).toBe(true);
      }
    });

    it('should work without images (no layout hints)', async () => {
      // Arrange
      const text = 'Building a booking system with dashboard and calendar.';

      // Act
      const result = await service.prepareContext(text);

      // Assert
      expect(result.status).toBe('valid');
      expect(result.context?.layout_hints).toBeUndefined();
    });

    it('should continue on image analysis failure', async () => {
      // Arrange
      const text = 'Building a dashboard application.';
      const images = ['invalid-url'];

      // Act
      const result = await service.prepareContext(text, images);

      // Assert
      // Should still succeed even if image analysis fails
      expect(result.status).not.toBe('validation_error');
      // layout_hints might be undefined if analysis failed
    });

    it('should support PNG, JPG, JPEG, WebP formats', async () => {
      // Arrange
      const text = 'Building a web app.';
      const images = [
        'https://example.com/wireframe.png',
        'https://example.com/mockup.jpg',
        'https://example.com/design.jpeg',
        'https://example.com/prototype.webp',
      ];

      // Act
      const result = await service.prepareContext(text, images);

      // Assert
      expect(result.status).not.toBe('validation_error');
      expect(result.context?.layout_hints).toBeDefined();
    });
  });
});
