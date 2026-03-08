# Ralph + BMAD Integration for v0-mcp

This document explains how Ralph autonomous agent loop and BMAD agile workflows are set up for the v0-mcp prototype workflow project.

## 📁 Directory Structure

```
v0-mcp/
├── prd.json                           # Ralph PRD (20 user stories)
├── progress.txt                       # Ralph progress log
├── scripts/
│   └── ralph/
│       ├── ralph.sh                   # Ralph autonomous loop script
│       └── CLAUDE.md                  # Claude agent instructions
├── _bmad-output/                      # BMAD artifacts
│   ├── product-brief.md               # Product vision & requirements
│   ├── sprint-status.yaml             # Sprint planning & tracking
│   ├── brainstorming/                 # Brainstorming session results
│   ├── epics/                         # Epic breakdowns (to be created)
│   ├── stories/                       # Individual story files (to be created)
│   └── planning-artifacts/            # Sprint planning docs
└── _bmad/                             # BMAD workflows (already exists)
    └── core/workflows/...
```

## 🚀 Quick Start

### 1. View Current Sprint Status

```bash
cat _bmad-output/sprint-status.yaml
```

### 2. View Product Brief

```bash
cat _bmad-output/product-brief.md
```

### 3. Check Which Stories Are Pending

```bash
cat prd.json | jq '.[] | select(.passes == false) | {id, title, priority}'
```

### 4. Run Ralph to Implement Stories

```bash
# Automatically implements stories one by one
./scripts/ralph/ralph.sh --tool claude 20

# Ralph will:
# 1. Create feature branch (feature/prototype-workflow)
# 2. Pick highest priority story where passes: false
# 3. Implement the story
# 4. Run tests (npm test)
# 5. Commit if tests pass
# 6. Mark story as passes: true in prd.json
# 7. Repeat until all stories done or max iterations
```

### 5. Check Progress

```bash
cat progress.txt
```

## 📋 PRD Overview

**Total:** 20 user stories, 89 story points

### Sprint 1 (28 pts committed)
- US-001: Parse user text into context (5 pts) - P0
- US-002: Infer screens (5 pts) - P0
- US-003: Infer platform (3 pts) - P0
- US-006: Call V0 API (8 pts) - P0
- US-007: Enforce no backend constraints (3 pts) - P0
- US-016: Register MCP tools (5 pts) - P0

**Stretch:** US-005: Validate context (3 pts)

### Sprint 2 (27 pts committed)
- US-009: Retry logic (5 pts)
- US-010: Prototype artifact (5 pts)
- US-013: Implementation brief (5 pts)
- US-015: Implementation boundaries (5 pts)
- US-017: Zod schemas (3 pts)
- US-018: Error handling (5 pts)

**Stretch:** US-008: Partial generation (5 pts)

### Sprint 3 (23 pts committed)
- US-004: Image analysis (8 pts)
- US-014: UX patterns (3 pts)
- US-019: E2E tests (5 pts)
- US-020: Documentation (3 pts)
- US-011: Model selection (3 pts)

**Stretch:** US-012: Streaming updates (5 pts)

## 🎯 Core Principle

**V0 answers:** "What should the UI look like?"
**Claude answers:** "How should the system work?"

## 📦 Three New MCP Tools

### 1. `prepare_prototype_context`
**Purpose:** Convert raw product ideas (text + images) into structured prototype contexts

**Input:**
- user_text: Natural language product description
- images (optional): Design references

**Output:**
```typescript
{
  product_name: string
  goal: string
  platform: 'web' | 'mobile'
  screens: string[]
  design_style?: string
  ui_reference?: {...}
  constraints: string[]
}
```

### 2. `generate_prototype`
**Purpose:** Generate UI prototypes from structured contexts using V0 API

**Input:**
- prototype_context (from tool 1)

**Output:**
```typescript
{
  prototype_id: string  // proto_<timestamp>
  screens_generated: string[]
  components: string[]
  preview_reference?: string
  status: 'draft_prototype' | 'partial_success'
}
```

### 3. `handoff_to_claude_dev`
**Purpose:** Convert prototypes into implementation briefs for Claude dev

**Input:**
- prototype_result (from tool 2)

**Output:**
```typescript
{
  summary: string
  screens: Array<{name, description}>
  components: string[]
  ux_notes: string
  implementation_rules: string[]
  prototype_id: string
  status: 'ready_for_dev'
}
```

## 📊 Definition of Done

Each story is complete when:
- ✅ Code complete and implements all acceptance criteria
- ✅ Unit tests written and passing
- ✅ TypeScript strict mode compliance
- ✅ Documentation updated
- ✅ No critical bugs
- ✅ `passes: true` in prd.json

## 🔍 Monitoring Ralph

### Check Current Story
```bash
cat prd.json | jq '.[] | select(.passes == false) | .id' | head -1
```

### Count Completed Stories
```bash
cat prd.json | jq '[.[] | select(.passes == true)] | length'
```

### Check If Done
```bash
cat prd.json | jq 'all(.passes == true)'
# Returns: true (all done) or false (work remaining)
```

## 📚 Key Documents

1. **Product Brief:** `_bmad-output/product-brief.md`
   - Vision, problem space, goals, requirements

2. **Sprint Status:** `_bmad-output/sprint-status.yaml`
   - Sprint planning, story breakdown, velocity tracking

3. **Brainstorming:** `_bmad-output/brainstorming/brainstorming-session-2026-03-08-154930.md`
   - Original brainstorming session (104 questions explored)

4. **PRD:** `prd.json`
   - Ralph-format user stories with acceptance criteria

5. **Progress:** `progress.txt`
   - Real-time implementation log from Ralph

## 🛠️ Manual Implementation (Without Ralph)

If you prefer manual implementation:

1. Pick a story from prd.json (highest priority where passes: false)
2. Implement according to acceptance criteria
3. Write tests
4. Run: `npm run build && npm test`
5. Commit: `git commit -m "feat: [Story ID] - [Title]"`
6. Update prd.json: Set `passes: true`
7. Document learnings in progress.txt
8. Repeat

## 🎓 Ralph Learning System

Ralph learns from each iteration:
- **progress.txt:** Appends learnings after each story
- **CLAUDE.md files:** Updates codebase patterns for future iterations
- **Git history:** Complete implementation history

This creates a knowledge base that helps Ralph (and human developers) work more effectively.

## 🔄 Iteration Workflow

```
Start
  ↓
Read prd.json
  ↓
Find highest priority story where passes: false
  ↓
Read progress.txt for context
  ↓
Implement story
  ↓
Run quality checks (build, test, lint)
  ↓
Checks pass? ──No──> Fix issues ──> Retry
  ↓ Yes
Commit changes
  ↓
Update prd.json (passes: true)
  ↓
Append to progress.txt
  ↓
All stories passes: true? ──No──> Next iteration
  ↓ Yes
<promise>COMPLETE</promise>
```

## ✨ Benefits

1. **Autonomous:** Ralph works independently, no manual orchestration
2. **Incremental:** One story at a time, commits frequently
3. **Quality:** Tests must pass before committing
4. **Learning:** Each iteration improves future iterations
5. **Transparent:** Full progress log and git history
6. **Resumable:** Can stop/start Ralph at any time

## 🎯 Expected Timeline

- **Sprint 1:** 7 stories, ~3-5 Ralph iterations
- **Sprint 2:** 6 stories, ~3-4 Ralph iterations
- **Sprint 3:** 6 stories, ~3-4 Ralph iterations
- **Total:** ~20 user stories, ~10-13 Ralph iterations

Assuming Ralph completes 1-2 stories per iteration.

## 🚨 Troubleshooting

### Ralph Stuck
- Check progress.txt for last error
- Review prd.json for current story status
- Check git log for recent commits

### Tests Failing
- Ralph won't commit if tests fail
- Check test output in Ralph logs
- Fix tests and Ralph will retry

### Story Too Large
- Split acceptance criteria into smaller stories
- Update prd.json with new stories
- Ralph will pick up new stories automatically

## 📞 Support

- **Ralph Issues:** https://github.com/snarktank/ralph/issues
- **BMAD Workflows:** Check `_bmad/core/workflows/`
- **v0-mcp Issues:** Your project issue tracker

---

**Ready to start?** Run `./scripts/ralph/ralph.sh --tool claude 20` and watch Ralph implement your prototype workflow! 🚀
