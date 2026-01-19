#!/bin/bash

# Verify git working tree is clean before starting a new task
# Exit code 0 = clean, 1 = dirty

set -e

echo "🔍 Verifying git working tree..."

# Check if we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Not a git repository"
  exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Working tree is not clean"
  echo ""
  echo "Uncommitted changes:"
  git status --short
  echo ""
  echo "Please commit or stash changes before continuing."
  exit 1
fi

echo "✅ Working tree is clean"
exit 0
