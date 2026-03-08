/**
 * Tests for HandoffService (US-013, US-014, US-015)
 */

import { HandoffService } from '../../../src/services/handoffService.js';
import { PrototypeContext, PrototypeResult } from '../../../src/types/index.js';

describe('HandoffService', () => {
  let service: HandoffService;

  beforeEach(() => {
    service = new HandoffService();
  });

  describe('createImplementationBrief', () => {
    it('should create implementation brief with summary', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'TaskFlow',
        goal: 'Task management system',
        platform: 'web',
        screens: ['dashboard', 'task list', 'task detail'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_123',
        screens_requested: 3,
        screens_generated: 3,
        generated_screens: ['dashboard', 'task list', 'task detail'],
        components: ['Dashboard', 'TaskList', 'TaskCard'],
        preview_reference: 'https://v0.dev/chat/123',
      };

      const brief = await service.createImplementationBrief(
        'proto_123',
        prototypeResult,
        prototypeContext
      );

      expect(brief.prototype_id).toBe('proto_123');
      expect(brief.summary).toContain('TaskFlow');
      expect(brief.summary).toContain('Implementation Brief');
      expect(brief.summary).toContain('web');
    });

    it('should extract all screens with descriptions', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'MyApp',
        platform: 'web',
        screens: ['dashboard', 'login', 'profile'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_456',
        screens_requested: 3,
        screens_generated: 3,
        generated_screens: ['dashboard', 'login', 'profile'],
        components: ['Dashboard', 'LoginForm', 'ProfileCard'],
      };

      const brief = await service.createImplementationBrief(
        'proto_456',
        prototypeResult,
        prototypeContext
      );

      expect(brief.screens).toHaveLength(3);
      expect(brief.screens[0].name).toBe('dashboard');
      expect(brief.screens[0].description).toContain('dashboard');
      expect(brief.screens[1].name).toBe('login');
      expect(brief.screens[1].description).toContain('login');
      expect(brief.screens[2].name).toBe('profile');
      expect(brief.screens[2].description).toContain('profile');
    });

    it('should extract components list', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'MyApp',
        platform: 'mobile',
        screens: ['home'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_789',
        screens_requested: 1,
        screens_generated: 1,
        components: ['HomeScreen', 'Header', 'Footer', 'Button'],
      };

      const brief = await service.createImplementationBrief(
        'proto_789',
        prototypeResult,
        prototypeContext
      );

      expect(brief.components).toEqual(['HomeScreen', 'Header', 'Footer', 'Button']);
    });

    it('should extract UX navigation patterns for web', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'AdminPanel',
        platform: 'web',
        screens: ['dashboard', 'users', 'settings', 'reports', 'analytics', 'billing'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_nav',
        screens_requested: 6,
        screens_generated: 6,
        generated_screens: ['dashboard', 'users', 'settings', 'reports', 'analytics', 'billing'],
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_nav',
        prototypeResult,
        prototypeContext
      );

      expect(brief.ux_notes.navigation_patterns).toContain(
        'Primary navigation centered around dashboard/home screen'
      );
      expect(brief.ux_notes.navigation_patterns).toContain(
        'Multi-level navigation recommended (sidebar + top nav or tab navigation)'
      );
      expect(brief.ux_notes.navigation_patterns).toContain(
        'Web navigation (sidebar, top navigation bar, breadcrumbs)'
      );
    });

    it('should extract UX navigation patterns for mobile', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'MobileApp',
        platform: 'mobile',
        screens: ['home', 'search', 'profile'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_mobile',
        screens_requested: 3,
        screens_generated: 3,
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_mobile',
        prototypeResult,
        prototypeContext
      );

      expect(brief.ux_notes.navigation_patterns).toContain(
        'Mobile-optimized navigation (bottom tabs, swipe gestures, hamburger menu)'
      );
      expect(brief.ux_notes.navigation_patterns).toContain(
        'Simple navigation structure (top nav or bottom tabs for mobile)'
      );
    });

    it('should extract screen flows for authentication', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'SecureApp',
        platform: 'web',
        screens: ['login', 'dashboard', 'profile'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_flow',
        screens_requested: 3,
        screens_generated: 3,
        generated_screens: ['login', 'dashboard', 'profile'],
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_flow',
        prototypeResult,
        prototypeContext
      );

      expect(brief.ux_notes.screen_flows).toContain('Login → Dashboard (authentication flow)');
      expect(brief.ux_notes.screen_flows).toContain(
        'Dashboard → Settings/Profile → Save → Dashboard (settings flow)'
      );
    });

    it('should extract screen flows for CRUD operations', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'CRUD App',
        platform: 'web',
        screens: ['list', 'create', 'detail'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_crud',
        screens_requested: 3,
        screens_generated: 3,
        generated_screens: ['list', 'create', 'detail'],
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_crud',
        prototypeResult,
        prototypeContext
      );

      expect(brief.ux_notes.screen_flows).toContain(
        'List/Browse → Detail View (master-detail pattern)'
      );
      expect(brief.ux_notes.screen_flows).toContain('List → Create → List (CRUD flow)');
    });

    it('should extract screen flows for e-commerce', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'ShopApp',
        platform: 'web',
        screens: ['browse', 'cart', 'checkout'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_shop',
        screens_requested: 3,
        screens_generated: 3,
        generated_screens: ['browse', 'cart', 'checkout'],
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_shop',
        prototypeResult,
        prototypeContext
      );

      expect(brief.ux_notes.screen_flows).toContain(
        'Browse → Cart → Checkout → Confirmation (e-commerce flow)'
      );
    });

    it('should extract interaction patterns for mobile', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'MobileApp',
        platform: 'mobile',
        screens: ['home'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_mobile_int',
        screens_requested: 1,
        screens_generated: 1,
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_mobile_int',
        prototypeResult,
        prototypeContext
      );

      expect(brief.ux_notes.interaction_patterns).toContain(
        'Touch-optimized interactions (tap, swipe, pinch-to-zoom)'
      );
      expect(brief.ux_notes.interaction_patterns).toContain('Modal dialogs for focused actions');
      expect(brief.ux_notes.interaction_patterns).toContain('Pull-to-refresh for data updates');
    });

    it('should extract interaction patterns for web', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'WebApp',
        platform: 'web',
        screens: ['dashboard'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_web_int',
        screens_requested: 1,
        screens_generated: 1,
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_web_int',
        prototypeResult,
        prototypeContext
      );

      expect(brief.ux_notes.interaction_patterns).toContain(
        'Mouse/keyboard interactions (click, hover states, keyboard shortcuts)'
      );
      expect(brief.ux_notes.interaction_patterns).toContain('Inline editing where appropriate');
      expect(brief.ux_notes.interaction_patterns).toContain(
        'Tooltips and hover previews for additional context'
      );
    });

    it('should include implementation rules', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'MyApp',
        platform: 'web',
        screens: ['home'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_rules',
        screens_requested: 1,
        screens_generated: 1,
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_rules',
        prototypeResult,
        prototypeContext
      );

      expect(brief.implementation_rules.length).toBeGreaterThan(0);
      expect(brief.implementation_rules).toContain(
        '**PRESERVE VISUAL LAYOUT**: Use the V0-generated components as-is. Do not redesign unless absolutely necessary.'
      );
      expect(brief.implementation_rules).toContain(
        '**IMPLEMENT BACKEND LOGIC**: Add API integration, data fetching, state management, and business rules.'
      );
      expect(brief.implementation_rules).toContain(
        '**ADD VALIDATION**: Implement form validation, input sanitization, and error handling.'
      );
    });

    it('should include web-specific implementation rules', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'WebApp',
        platform: 'web',
        screens: ['dashboard'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_web_rules',
        screens_requested: 1,
        screens_generated: 1,
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_web_rules',
        prototypeResult,
        prototypeContext
      );

      expect(brief.implementation_rules).toContain(
        '**SEO & ACCESSIBILITY**: Ensure proper semantic HTML, ARIA labels, and meta tags for web accessibility.'
      );
      expect(brief.implementation_rules).toContain(
        '**RESPONSIVE DESIGN**: Verify responsive behavior across desktop, tablet, and mobile viewports.'
      );
      expect(brief.implementation_rules).toContain(
        '**PERFORMANCE**: Optimize bundle size, implement code splitting, and lazy loading.'
      );
    });

    it('should include mobile-specific implementation rules', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'MobileApp',
        platform: 'mobile',
        screens: ['home'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_mobile_rules',
        screens_requested: 1,
        screens_generated: 1,
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_mobile_rules',
        prototypeResult,
        prototypeContext
      );

      expect(brief.implementation_rules).toContain(
        '**MOBILE PERFORMANCE**: Optimize for mobile devices (minimize re-renders, efficient state updates).'
      );
      expect(brief.implementation_rules).toContain(
        '**OFFLINE SUPPORT**: Consider offline-first architecture with local storage and sync.'
      );
      expect(brief.implementation_rules).toContain(
        '**NATIVE FEATURES**: Integrate mobile-specific features (push notifications, camera, geolocation) as needed.'
      );
    });

    it('should include preview reference if available', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'MyApp',
        platform: 'web',
        screens: ['home'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_preview',
        screens_requested: 1,
        screens_generated: 1,
        preview_reference: 'https://v0.dev/chat/abc123',
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_preview',
        prototypeResult,
        prototypeContext
      );

      expect(brief.preview_reference).toBe('https://v0.dev/chat/abc123');
    });

    it('should handle partial success status', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'PartialApp',
        platform: 'web',
        screens: ['screen1', 'screen2', 'screen3'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'partial_success',
        prototype_id: 'proto_partial',
        screens_requested: 3,
        screens_generated: 2,
        generated_screens: ['screen1', 'screen2'],
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_partial',
        prototypeResult,
        prototypeContext
      );

      expect(brief.summary).toContain('Partial');
      expect(brief.screens).toHaveLength(2);
    });

    it('should handle admin screen patterns', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'AdminPanel',
        platform: 'web',
        screens: ['admin panel', 'dashboard'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_admin',
        screens_requested: 2,
        screens_generated: 2,
        generated_screens: ['admin panel', 'dashboard'],
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_admin',
        prototypeResult,
        prototypeContext
      );

      expect(brief.ux_notes.navigation_patterns).toContain(
        'Separate admin navigation section with elevated permissions'
      );
      const adminScreen = brief.screens.find(s => s.name === 'admin panel');
      expect(adminScreen?.description).toContain('Admin panel');
    });

    it('should handle settings/profile patterns', async () => {
      const prototypeContext: PrototypeContext = {
        product_name: 'MyApp',
        platform: 'web',
        screens: ['settings', 'profile'],
      };

      const prototypeResult: PrototypeResult = {
        status: 'success',
        prototype_id: 'proto_settings',
        screens_requested: 2,
        screens_generated: 2,
        generated_screens: ['settings', 'profile'],
        components: [],
      };

      const brief = await service.createImplementationBrief(
        'proto_settings',
        prototypeResult,
        prototypeContext
      );

      const settingsScreen = brief.screens.find(s => s.name === 'settings');
      expect(settingsScreen?.description).toContain('Settings');

      const profileScreen = brief.screens.find(s => s.name === 'profile');
      expect(profileScreen?.description).toContain('profile');
    });
  });
});
