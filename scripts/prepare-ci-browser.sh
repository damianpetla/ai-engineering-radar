#!/usr/bin/env bash
set -euo pipefail
# GitHub-hosted images normally include Chrome; verify it before selecting it.
if command -v google-chrome >/dev/null 2>&1; then
  google-chrome --version
  echo 'PLAYWRIGHT_CHANNEL=chrome' >> "$GITHUB_ENV"
else
  pnpm exec playwright install --with-deps --only-shell chromium
fi
