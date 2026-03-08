# Product Brief: v0-mcp Prototype Workflow

**Project:** v0-mcp
**Author:** BMAD + Ralph Integration
**Date:** 2026-03-08
**Phase:** Implementation (Phase 2)
**Status:** Active

---

## 1. Vision Statement

Enable developers to rapidly generate UI prototypes from natural language descriptions and design references, with clear separation between V0's UI generation capabilities and Claude's development responsibilities. This creates a predictable, modular workflow for prototype-to-production development.

---

## 2. Problem Space

### Current State
- v0-mcp has 4 basic tools: `v0_generate_ui`, `v0_generate_from_image`, `v0_chat_complete`, `v0_setup_check`
- Tools generate single components, not multi-screen prototypes
- No structured workflow for going from idea → prototype → development
- Developers must manually orchestrate multiple tool calls
- No clear handoff between prototyping and engineering phases

### Pain Points
- **Workflow Complexity:** Developers repeat the same sequence of tool calls for each prototype
- **Context Loss:** No structured way to pass prototype intent to development phase
- **Role Confusion:** V0 sometimes generates backend code that should be Claude's responsibility
- **Iteration Overhead:** No standardized way to refine prototypes through iterations
- **Documentation Gap:** Prototype decisions not captured for development team

### Target Users
- **Developers:** Software engineers building web/mobile applications
- **Product Designers:** UX professionals who want to see ideas come to life quickly
- **Founders/Product Managers:** Non-technical users who want to validate product concepts
- **Claude Dev Agent:** Autonomous agent that implements production code from prototypes

---

## 3. Goals & Objectives

### Primary Goals
1. **3-Command Workflow:** Implement clean, predictable pipeline: context → prototype → handoff
2. **V0/Claude Separation:** Maintain strict boundaries - V0 handles UI, Claude handles engineering
3. **Rapid Prototyping:** Enable developers to go from idea to viewable prototype in <5 minutes
4. **Development Handoff:** Structured briefs that Claude dev can implement without redesigning UI

### Success Criteria
- Users can generate multi-screen prototypes with single command
- Platform (web/mobile) inferred automatically from description
- Screens inferred from product intent (no manual listing required)
- Image references extracted and incorporated into prototypes
- V0 never generates backend/API/database code
- Implementation briefs clearly separate UI (preserve) from logic (build)
- End-to-end workflow completes in <10 minutes
- 80%+ test coverage on all 3 tools

### Out of Scope (Initial Release)
- Figma URL support (images only for MVP)
- Design system templates
- A/B testing between prototype variants
- Prototype analytics or usage tracking
- Export to other design tools
- Voice input for prototype context

---

## 4. Core Requirements

### Functional Requirements

#### FR1: Context Preparation (`prepare_prototype_context`)
- Accept unstructured text describing product idea
- Extract product name, goal, platform (web/mobile)
- Infer screens from text (explicit mentions + workflow analysis)
- Analyze optional image references for layout hints
- Validate context structure before returning
- Handle vague input with helpful error messages

#### FR2: Prototype Generation (`generate_prototype`)
- Accept structured `prototype_context`
- Construct V0 prompt with "no backend" constraints
- Call V0 API with retry logic (3 attempts, exponential backoff)
- Generate multi-screen prototypes (not just single components)
- Handle partial generation gracefully (e.g., 3 of 5 screens)
- Return prototype artifact with unique ID (proto_<timestamp>)
- Include preview reference/URL if available

#### FR3: Development Handoff (`handoff_to_claude_dev`)
- Accept `prototype_result` artifact
- Extract screens, components, and UX patterns
- Document navigation style and flow relationships
- Define implementation boundaries (preserve UI vs build logic)
- Generate structured `implementation_brief`
- Reference original prototype_id for traceability

#### FR4: MCP Integration
- Register all 3 tools with v0-mcp server
- Define Zod schemas for all parameters
- Consistent error handling across tools
- Follow existing v0-mcp patterns (TypeScript, Winston logging)
- Tools discoverable in Claude Code tool list

### Non-Functional Requirements

#### NFR1: Performance
- Context preparation: <3 seconds
- V0 prototype generation: <60 seconds (or timeout)
- Handoff brief generation: <2 seconds
- Total workflow: <10 minutes end-to-end

#### NFR2: Reliability
- Retry logic for transient V0 failures
- Graceful degradation for partial generation
- Clear error messages with actionable guidance
- 80%+ test coverage on all tools

#### NFR3: Usability
- Intuitive tool names and descriptions
- Minimal required parameters (smart defaults)
- Helpful validation messages
- Clear separation of concerns (V0 vs Claude)

#### NFR4: Maintainability
- Follow existing v0-mcp code patterns
- TypeScript strict mode compliance
- Comprehensive test suite (Jest)
- Documentation with examples

---

## 5. Technical Architecture

### Core Principle
**V0 answers:** "What should the UI look like?"
**Claude answers:** "How should the system work?"

### Tool Flow
```
User Request
    ↓
prepare_prototype_context
    ├─ Parse text → extract intent
    ├─ Infer screens from description
    ├─ Infer platform (web/mobile)
    ├─ Analyze images (optional)
    └─ Return: prototype_context
    ↓
generate_prototype
    ├─ Construct V0 prompt + constraints
    ├─ Call V0 API (with retries)
    ├─ Handle partial generation
    └─ Return: prototype_result
    ↓
handoff_to_claude_dev
    ├─ Extract screens + components
    ├─ Document UX patterns
    ├─ Define implementation boundaries
    └─ Return: implementation_brief
```

### Data Structures

**prototype_context:**
```typescript
{
  product_name: string
  goal: string
  platform: 'web' | 'mobile'
  screens: string[]
  design_style?: string
  ui_reference?: {
    layout: string[]
    components: string[]
    ui_notes: string
  }
  constraints: string[]
}
```

**prototype_result:**
```typescript
{
  prototype_id: string  // proto_<timestamp>
  screens_generated: string[]
  components: string[]
  preview_reference?: string
  prototype_notes: string
  status: 'draft_prototype' | 'partial_success' | 'generation_failed'
}
```

**implementation_brief:**
```typescript
{
  summary: string
  screens: Array<{name: string, description: string}>
  components: string[]
  ux_notes: string
  implementation_rules: string[]
  prototype_id: string
  status: 'ready_for_dev'
}
```

### Integration Points
- **V0 API:** Primary UI generation engine
- **MCP Protocol:** Tool registration and invocation
- **Claude Code:** User-facing AI assistant
- **Existing v0-mcp:** Reuse error handling, logging, config patterns

---

## 6. Implementation Strategy

### Phase 1: Foundation (Sprint 1)
- Core context preparation (US-001, US-002, US-003)
- V0 API integration (US-006, US-007)
- MCP tool registration (US-016)
- Basic error handling

**Goal:** Minimal viable workflow - text → V0 → prototype

### Phase 2: Reliability (Sprint 2)
- Retry logic and error handling (US-009, US-018)
- Prototype artifact generation (US-010)
- Development handoff tool (US-013, US-015)
- Zod schemas (US-017)

**Goal:** Production-ready workflow with handoff

### Phase 3: Polish (Sprint 3)
- Image analysis (US-004)
- UX pattern extraction (US-014)
- End-to-end tests (US-019)
- Documentation (US-020)

**Goal:** Complete, well-documented, tested workflow

---

## 7. Success Metrics

### Development Metrics
- All 20 user stories complete (passes: true in prd.json)
- 80%+ code coverage
- Zero failing tests in CI
- All tools registered and discoverable

### User Metrics
- Time to first prototype: <5 minutes
- Workflow completion rate: >90%
- Error rate: <5%
- User satisfaction: "Clear separation between V0 and Claude"

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| V0 API changes | High | Use stable V0 models, monitor API versions |
| Screen inference accuracy | Medium | Provide override mechanism, clear error messages |
| Image analysis complexity | Medium | Phase 1 uses simple patterns, defer advanced features |
| Context window limits | Medium | Keep prototypes small (1-5 screens recommended) |
| Backend code leakage | High | Strict "no backend" prompting, post-generation validation |

---

## 9. Dependencies

### External
- V0 API (stable connection, API key)
- Existing v0-mcp infrastructure
- TypeScript 5.4+, Zod, Winston
- Jest testing framework

### Internal
- Existing 4 v0-mcp tools (patterns to follow)
- Error handling utilities
- Configuration management
- MCP server registration

---

## 10. Acceptance Criteria

### Workflow Acceptance
- ✅ User can describe product in natural language
- ✅ System infers platform and screens automatically
- ✅ V0 generates multi-screen prototype
- ✅ Implementation brief clearly separates UI from logic
- ✅ All 3 tools work end-to-end without manual intervention

### Quality Acceptance
- ✅ All tests passing (>80% coverage)
- ✅ TypeScript strict mode compliance
- ✅ No backend code in V0 prototypes
- ✅ Error messages are clear and actionable
- ✅ Documentation complete with examples

---

## 11. Related Documents

- **Brainstorming Session:** `_bmad-output/brainstorming/brainstorming-session-2026-03-08-154930.md`
- **Sprint Status:** `_bmad-output/sprint-status.yaml`
- **PRD (Ralph format):** `prd.json`
- **Project Overview:** `PROJECT_OVERVIEW.md`
- **Existing Tools:** `src/mcp/tools.ts`

---

## 12. Approval

**Product Owner:** Fred
**Date:** 2026-03-08
**Status:** Approved for Implementation

**Next Steps:**
1. Review PRD (prd.json) with team
2. Run Ralph autonomous implementation loop
3. Monitor progress via progress.txt
4. Verify each story passes before moving to next
5. Deploy when all stories have passes: true
