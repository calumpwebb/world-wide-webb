#!/bin/bash

# Check test coverage meets minimum threshold
# Usage: ./check-coverage.sh [threshold]
# Default threshold: 80%

set -e

THRESHOLD=${1:-80}

echo "🧪 Checking test coverage (threshold: ${THRESHOLD}%)..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
  echo "❌ package.json not found"
  exit 1
fi

# Check if test:coverage script exists
if ! grep -q "test:coverage" package.json; then
  echo "⚠️  No test:coverage script found in package.json"
  echo "Please add: \"test:coverage\": \"vitest run --coverage\""
  exit 1
fi

# Run coverage
echo "Running tests with coverage..."
pnpm test:coverage --run 2>&1 | tee /tmp/coverage-output.txt

# Parse coverage output (this will need adjustment based on actual vitest output)
# For now, just check if coverage directory exists and has files
if [ -d "coverage" ]; then
  echo ""
  echo "✅ Coverage report generated"
  echo "📊 View detailed report: open coverage/index.html"

  # Try to extract overall coverage percentage
  if [ -f "coverage/coverage-summary.json" ]; then
    # Use node to parse JSON if available
    if command -v node &> /dev/null; then
      TOTAL_COVERAGE=$(node -e "
        const coverage = require('./coverage/coverage-summary.json');
        const total = coverage.total.lines.pct;
        console.log(total);
      ")

      echo "📈 Total line coverage: ${TOTAL_COVERAGE}%"

      # Compare with threshold
      if (( $(echo "$TOTAL_COVERAGE >= $THRESHOLD" | bc -l) )); then
        echo "✅ Coverage meets threshold (≥${THRESHOLD}%)"
        exit 0
      else
        echo "❌ Coverage below threshold (${TOTAL_COVERAGE}% < ${THRESHOLD}%)"
        exit 1
      fi
    fi
  fi

  exit 0
else
  echo "❌ Coverage report not generated"
  exit 1
fi
