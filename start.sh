#!/usr/bin/env bash
# ─────────────────────────────────────────────
# CodeLens — Quick Start
# Installs dependencies (if needed) and starts
# both the API server and the React dev server.
# ─────────────────────────────────────────────

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# ── 1. Install dependencies if needed ────────
if [ ! -d "node_modules/express" ]; then
  echo "📦  Installing dependencies…"
  npm install
fi

# ── 2. Load .env if present ──────────────────
if [ -f .env ]; then
  echo "🔑  Loading .env…"
  set -a; source .env; set +a
fi

# ── 3. Start ─────────────────────────────────
echo ""
echo "🚀  Starting CodeLens…"
echo "   Backend  → http://localhost:3001"
echo "   Frontend → http://localhost:5173"
echo ""

npm run dev
