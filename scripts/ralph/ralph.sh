#!/bin/bash
set -e

TOOL="claude"
MAX_ITERATIONS=10

# --- Git author ---
GIT_AUTHOR_NAME="Fred"
GIT_AUTHOR_EMAIL="fred@v0-mcp.dev"
GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

if [[ "$TOOL" != "amp" && "$TOOL" != "claude" ]]; then
  echo "Invalid tool: $TOOL"
  exit 1
fi

# --- Paths ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PRD_FILE="$REPO_ROOT/prd.json"
PROGRESS_FILE="$REPO_ROOT/progress.txt"
PROMPT_FILE="$SCRIPT_DIR/CLAUDE.md"

# 🔥 CRITICAL: Move to project root
cd "$REPO_ROOT"

echo "Starting Ralph"
echo "Repo root: $REPO_ROOT"
echo "Using PRD: $PRD_FILE"
echo "Git author: $GIT_AUTHOR_NAME <$GIT_AUTHOR_EMAIL>"
echo "Tool: $TOOL"

# --- Helper: slugify a title for branch names ---
slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g' | sed 's/__*/_/g' | sed 's/^_//;s/_$//'
}

# --- Helper: get current story being worked on ---
get_current_story() {
  local story_json
  story_json=$(jq -r '[.[] | select(.passes == false)] | sort_by(.priority // .id) | .[0] // empty' "$PRD_FILE" 2>/dev/null)

  if [ -z "$story_json" ]; then
    # All stories pass — get the last one (just completed)
    story_json=$(jq -r '.[-1]' "$PRD_FILE" 2>/dev/null)
  fi

  echo "$story_json"
}

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  # Capture which story is being worked on BEFORE the agent runs
  STORY_BEFORE=$(jq -r '[.[] | select(.passes == false)] | sort_by(.priority // .id) | .[0].id // empty' "$PRD_FILE" 2>/dev/null)

  if [ -z "$STORY_BEFORE" ]; then
    echo ""
    echo "🎉 All stories complete! No more work to do."
    echo "<promise>COMPLETE</promise>"
    exit 0
  fi

  echo ""
  echo "Working on story: $STORY_BEFORE"
  echo ""

  if [[ "$TOOL" == "amp" ]]; then
    OUTPUT=$(cat "$PROMPT_FILE" | amp --dangerously-allow-all 2>&1 | tee /dev/stderr) || true
  else
    OUTPUT=$(claude --dangerously-skip-permissions --print < "$PROMPT_FILE" 2>&1 | tee /dev/stderr) || true
  fi

  # --- Auto-commit safety net ---
  # If the agent left uncommitted changes, commit them with proper format
  if git rev-parse --git-dir >/dev/null 2>&1; then
    if [ -n "$(git status --porcelain)" ]; then
      # Determine which story was just completed
      STORY_ID="$STORY_BEFORE"
      STORY_TITLE=""

      if [ -n "$STORY_ID" ]; then
        STORY_TITLE=$(jq -r --arg sid "$STORY_ID" '.[] | select(.id == $sid) | .title' "$PRD_FILE" 2>/dev/null)
      fi

      # Fallback if we couldn't determine the story
      if [ -z "$STORY_ID" ]; then
        STORY_ID="iteration-$i"
        STORY_TITLE="auto-commit"
      fi

      TITLE_SLUG=$(slugify "$STORY_TITLE")

      # Create/switch to feature branch: feature/{US-001}:{title_slug}
      BRANCH_NAME="feature/${STORY_ID}:${TITLE_SLUG}"
      CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

      if [[ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]]; then
        echo ""
        echo "---------------------------------------------------------------"
        echo "  Auto-branch: creating $BRANCH_NAME"
        echo "---------------------------------------------------------------"
        git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME" 2>/dev/null || true
      fi

      echo ""
      echo "---------------------------------------------------------------"
      echo "  Auto-commit: $STORY_ID - $STORY_TITLE"
      echo "---------------------------------------------------------------"
      git add -A
      git commit -m "feat: ${STORY_ID} - ${STORY_TITLE}" || true

      echo ""
      echo "📝 Changes committed successfully"
    else
      echo ""
      echo "⚠️  No changes to commit (agent may have failed or made no changes)"
    fi
  fi

  # Check if complete
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "🎉 Ralph completed all tasks!"
    exit 0
  fi

  # Check how many stories are left
  STORIES_LEFT=$(jq -r '[.[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null)
  STORIES_DONE=$(jq -r '[.[] | select(.passes == true)] | length' "$PRD_FILE" 2>/dev/null)

  echo ""
  echo "---------------------------------------------------------------"
  echo "  Progress: $STORIES_DONE completed, $STORIES_LEFT remaining"
  echo "---------------------------------------------------------------"
  echo "Iteration $i complete."
  sleep 2
done

echo ""
echo "⚠️  Max iterations reached. Some stories may remain incomplete."
echo ""
STORIES_LEFT=$(jq -r '[.[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null)
echo "Stories remaining: $STORIES_LEFT"
exit 1
