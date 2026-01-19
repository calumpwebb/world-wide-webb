#!/bin/bash

# Comprehensive cycle validation script
# Usage: ./check-cycle.sh [cycle-number] [options]
# Options:
#   --json          Output JSON format
#   --complete      Mark cycle as complete in TASKS.md
#   --all           Check all cycles
#   --fix           Show suggestions for fixes

set -e

CYCLE_NUM=$1
JSON_OUTPUT=false
MARK_COMPLETE=false
CHECK_ALL=false
SHOW_FIXES=false

# Parse options
shift || true
while [[ $# -gt 0 ]]; do
  case $1 in
    --json) JSON_OUTPUT=true ;;
    --complete) MARK_COMPLETE=true ;;
    --all) CHECK_ALL=true ;;
    --fix) SHOW_FIXES=true ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# If no cycle number and not --all, find active cycle from TASKS.md
if [ -z "$CYCLE_NUM" ] && [ "$CHECK_ALL" = false ]; then
  if [ -f ".ralph/TASKS.md" ]; then
    # Extract active cycle number from TASKS.md
    CYCLE_NUM=$(grep "🔄 In Progress" .ralph/TASKS.md | head -1 | grep -o "Cycle [0-9]*" | grep -o "[0-9]*" || echo "")
    if [ -z "$CYCLE_NUM" ]; then
      echo "❌ No active cycle found in TASKS.md"
      echo "Usage: ./check-cycle.sh [cycle-number]"
      exit 1
    fi
    echo "📍 Found active cycle: $CYCLE_NUM"
  else
    echo "❌ TASKS.md not found"
    exit 1
  fi
fi

# Pad cycle number
CYCLE_NUM=$(printf "%02d" $CYCLE_NUM)
CYCLE_FILE=".ralph/cycles/cycle-${CYCLE_NUM}.md"

# Check if cycle file exists
if [ ! -f "$CYCLE_FILE" ]; then
  echo "❌ Cycle file not found: $CYCLE_FILE"
  exit 1
fi

# Extract cycle name
CYCLE_NAME=$(grep "^# Cycle" "$CYCLE_FILE" | head -1 | sed "s/# Cycle ${CYCLE_NUM}: //")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Cycle $CYCLE_NUM: $CYCLE_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Count checkboxes
TOTAL_TASKS=$(grep -c "\- \[ \]" "$CYCLE_FILE" || echo 0)
COMPLETED_TASKS=$(grep -c "\- \[x\]" "$CYCLE_FILE" || echo 0)
TOTAL_CHECKBOXES=$((TOTAL_TASKS + COMPLETED_TASKS))

# Count prerequisites
PREREQ_TOTAL=$(grep -A 10 "Prerequisites" "$CYCLE_FILE" | grep -c "\- \[ \]\|\- \[x\]" || echo 0)
PREREQ_COMPLETE=$(grep -A 10 "Prerequisites" "$CYCLE_FILE" | grep -c "\- \[x\]" || echo 0)

# Count completion criteria
CRITERIA_TOTAL=$(grep -A 30 "Completion Criteria" "$CYCLE_FILE" | grep -c "\- \[ \]\|\- \[x\]" || echo 0)
CRITERIA_COMPLETE=$(grep -A 30 "Completion Criteria" "$CYCLE_FILE" | grep -c "\- \[x\]" || echo 0)

echo "📋 Task Status:"
if [ $PREREQ_TOTAL -gt 0 ]; then
  if [ $PREREQ_COMPLETE -eq $PREREQ_TOTAL ]; then
    echo -e "  ${GREEN}✅${NC} Prerequisites: $PREREQ_COMPLETE/$PREREQ_TOTAL complete"
  else
    echo -e "  ${YELLOW}⚠️${NC}  Prerequisites: $PREREQ_COMPLETE/$PREREQ_TOTAL complete"
  fi
fi

if [ $TOTAL_CHECKBOXES -gt 0 ]; then
  if [ $COMPLETED_TASKS -eq $TOTAL_TASKS ]; then
    echo -e "  ${GREEN}✅${NC} Tasks: $COMPLETED_TASKS/$TOTAL_CHECKBOXES complete"
  else
    echo -e "  ${YELLOW}⚠️${NC}  Tasks: $COMPLETED_TASKS/$TOTAL_CHECKBOXES complete"
  fi
fi

if [ $CRITERIA_TOTAL -gt 0 ]; then
  if [ $CRITERIA_COMPLETE -eq $CRITERIA_TOTAL ]; then
    echo -e "  ${GREEN}✅${NC} Completion Criteria: $CRITERIA_COMPLETE/$CRITERIA_TOTAL complete"
  else
    echo -e "  ${RED}❌${NC} Completion Criteria: $CRITERIA_COMPLETE/$CRITERIA_TOTAL complete"
  fi
fi

echo ""
echo "🧪 Automated Checks:"

# Initialize check results
TESTS_PASS=false
COVERAGE_OK=false
LINT_OK=false
TYPES_OK=false
GIT_CLEAN=false

# Check if package.json exists (project initialized)
if [ -f "package.json" ]; then
  # Run tests
  if grep -q "\"test\":" package.json; then
    if pnpm test --run > /dev/null 2>&1; then
      echo -e "  ${GREEN}✅${NC} Tests passing"
      TESTS_PASS=true
    else
      echo -e "  ${RED}❌${NC} Tests failing"
    fi
  else
    echo -e "  ${YELLOW}⚠️${NC}  No test script configured"
  fi

  # Check coverage
  if grep -q "\"test:coverage\":" package.json; then
    if [ -d "coverage" ]; then
      if [ -f "coverage/coverage-summary.json" ] && command -v node &> /dev/null; then
        COVERAGE=$(node -e "console.log(require('./coverage/coverage-summary.json').total.lines.pct)")
        if (( $(echo "$COVERAGE >= 80" | bc -l) )); then
          echo -e "  ${GREEN}✅${NC} Coverage: ${COVERAGE}% (≥80% required)"
          COVERAGE_OK=true
        else
          echo -e "  ${RED}❌${NC} Coverage: ${COVERAGE}% (≥80% required)"
        fi
      else
        echo -e "  ${YELLOW}⚠️${NC}  Coverage report not found (run: pnpm test:coverage)"
      fi
    else
      echo -e "  ${YELLOW}⚠️${NC}  Coverage not generated"
    fi
  fi

  # Check linting
  if grep -q "\"lint\":" package.json; then
    if pnpm lint > /dev/null 2>&1; then
      echo -e "  ${GREEN}✅${NC} Linting passed"
      LINT_OK=true
    else
      LINT_ERRORS=$(pnpm lint 2>&1 | grep -c "error" || echo 0)
      echo -e "  ${RED}❌${NC} Linting: $LINT_ERRORS errors found"
    fi
  fi

  # Check types
  if grep -q "\"type-check\":" package.json; then
    if pnpm type-check > /dev/null 2>&1; then
      echo -e "  ${GREEN}✅${NC} Type check passed"
      TYPES_OK=true
    else
      echo -e "  ${RED}❌${NC} Type check failed"
    fi
  fi
else
  echo -e "  ${YELLOW}⚠️${NC}  Package.json not found (project not initialized)"
fi

# Check git status
if .ralph/scripts/verify-clean.sh > /dev/null 2>&1; then
  echo -e "  ${GREEN}✅${NC} Git: working tree clean"
  GIT_CLEAN=true
else
  UNCOMMITTED=$(git status --short | wc -l | tr -d ' ')
  echo -e "  ${RED}❌${NC} Git: $UNCOMMITTED uncommitted files"
fi

echo ""

# Determine if cycle is ready
CYCLE_READY=true

ISSUES=()

if [ $PREREQ_COMPLETE -lt $PREREQ_TOTAL ]; then
  CYCLE_READY=false
  ISSUES+=("$((PREREQ_TOTAL - PREREQ_COMPLETE)) unchecked prerequisites")
fi

if [ $COMPLETED_TASKS -lt $TOTAL_CHECKBOXES ]; then
  CYCLE_READY=false
  ISSUES+=("$((TOTAL_CHECKBOXES - COMPLETED_TASKS)) unchecked tasks")
fi

if [ $CRITERIA_COMPLETE -lt $CRITERIA_TOTAL ]; then
  CYCLE_READY=false
  ISSUES+=("$((CRITERIA_TOTAL - CRITERIA_COMPLETE)) unchecked completion criteria")
fi

if [ "$TESTS_PASS" = false ] && [ -f "package.json" ]; then
  CYCLE_READY=false
  ISSUES+=("Tests failing")
fi

if [ "$COVERAGE_OK" = false ] && [ -f "coverage/coverage-summary.json" ]; then
  CYCLE_READY=false
  ISSUES+=("Coverage below 80%")
fi

if [ "$LINT_OK" = false ] && grep -q "\"lint\":" package.json 2>/dev/null; then
  CYCLE_READY=false
  ISSUES+=("Linting errors")
fi

if [ "$GIT_CLEAN" = false ]; then
  CYCLE_READY=false
  ISSUES+=("Uncommitted changes")
fi

# Print result
if [ "$CYCLE_READY" = true ]; then
  echo -e "${GREEN}✅ CYCLE READY${NC}"
  echo ""
  echo "This cycle meets all completion criteria!"

  if [ "$MARK_COMPLETE" = true ]; then
    echo ""
    echo "Updating TASKS.md..."
    # TODO: Implement auto-update of TASKS.md
    echo "⚠️  Auto-update not implemented yet - please update TASKS.md manually"
  fi
else
  echo -e "${RED}❌ CYCLE NOT READY${NC}"
  echo ""
  echo "Issues to resolve:"
  for issue in "${ISSUES[@]}"; do
    echo "  • $issue"
  done

  if [ "$SHOW_FIXES" = true ]; then
    echo ""
    echo "💡 Suggested fixes:"
    echo "  1. Check cycle doc and complete unchecked items"
    echo "  2. Run: pnpm test (fix failing tests)"
    echo "  3. Run: pnpm test:coverage (ensure ≥80%)"
    echo "  4. Run: pnpm lint --fix (fix linting)"
    echo "  5. Run: git add . && git commit -m 'feat(cycle-$CYCLE_NUM): ...'"
    echo "  6. Run: .ralph/scripts/check-cycle.sh $CYCLE_NUM"
  fi
fi

echo ""

# Exit with appropriate code
if [ "$CYCLE_READY" = true ]; then
  exit 0
else
  exit 1
fi
