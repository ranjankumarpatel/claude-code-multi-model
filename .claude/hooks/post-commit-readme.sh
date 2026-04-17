#!/usr/bin/env bash
# Hook: post-commit README update check
# Runs after `git commit` via PostToolUse hook
# Checks if code files changed; if so, reminds Claude to update README

set -euo pipefail

# Get list of files changed in the last commit (exclude README itself)
changed_files=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -v 'README.md' || true)

# Filter to code-relevant files only
code_changes=$(echo "$changed_files" | grep -E '\.(md|mjs|js|ts|json|sh|py|yaml|yml)$' || true)

if [ -z "$code_changes" ]; then
  # No code files changed — no README update needed
  exit 0
fi

# Count changed files for context
file_count=$(echo "$code_changes" | wc -l | tr -d ' ')

# Output system message to Claude via JSON stdout
cat <<EOF
{
  "systemMessage": "Post-commit hook: ${file_count} code file(s) changed. Run /update-readme to sync README with current project state."
}
EOF
