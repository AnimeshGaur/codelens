# 🔍 CodeLens

**AI-Powered Codebase Analyzer** — Paste any GitHub URL or local path and get instant, professional technical documentation with interactive architecture diagrams.

CodeLens uses LLMs to analyze your code and generates **7 interactive Mermaid diagrams** including component architecture, class hierarchies, database schemas, API endpoints, dependency flows, and more.

---

## ✨ Features

- **Multi-repo analysis** — Analyze multiple repositories in one go
- **5 LLM providers** — Groq, Google Gemini, OpenAI, Anthropic, or Ollama (local)
- **7 interactive diagrams** — Component, Class, Database, Endpoint, External API, Flow, Architecture
- **Smart caching** — Avoid re-analyzing unchanged files
- **GitHub + Local** — Analyze repos via URL or local folder path
- **Real-time progress** — Server-Sent Events for live analysis updates
- **Inline API keys** — Enter your API key right in the UI, no `.env` setup required
- **Local LLM support** — Full Ollama integration with configurable Base URL and Model

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **npm** 9+
- **Git** (for cloning GitHub repositories)

### 1. Clone and Install

```bash
git clone https://github.com/your-username/codelens.git
cd codelens
npm install
```

> That's it! `npm install` automatically installs both server and client dependencies.

### 2. Run

```bash
npm run dev
```

This starts:
- **Backend API** → `http://localhost:3001`
- **Frontend UI** → `http://localhost:5173`

Open `http://localhost:5173` in your browser and start analyzing.

### Alternative: One-Command Start

```bash
bash start.sh
```

This auto-installs dependencies (if needed), loads your `.env`, and starts both servers.

---

## 🔑 LLM Provider Setup

API keys can be entered **directly in the UI** when you analyze a project — no `.env` file needed.

| Provider | How to Get a Key |
|----------|-----------------|
| **Groq** | [console.groq.com](https://console.groq.com) — Free tier available |
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com) |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com) |
| **Ollama** | [ollama.ai](https://ollama.ai) — Free, runs locally |

### Using Ollama (Local LLM)

1. Install Ollama: `curl -fsSL https://ollama.ai/install.sh | sh`
2. Pull a model: `ollama pull qwen2.5-coder`
3. Select "Ollama (Local LLM)" in the CodeLens UI
4. Configure Base URL and Model Name in the UI

### Optional: `.env` File

If you prefer environment variables, copy the example and fill in your keys:

```bash
cp .env.example .env
```

---

## 📁 Project Structure

```
codelens/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   └── utils/           # Frontend logger
│   └── vite.config.js
├── server/                  # Express backend
│   ├── core/                # Core modules
│   │   ├── llm/             # LLM provider factory + analyzer
│   │   ├── generators/      # Mermaid diagram generators
│   │   ├── cache.js          # Async analysis cache
│   │   ├── logger.js         # Structured JSON logger
│   │   └── discovery.js      # File discovery engine
│   ├── routes/              # API route handlers
│   └── services/            # Business logic
├── package.json
├── Dockerfile               # Production container
├── docker-compose.yml        # Container orchestration
├── DEPLOYMENT.md            # Cloud deployment guide
└── start.sh                 # Quick start script
```

---

## 🐳 Docker

Build and run in production:

```bash
docker compose up -d --build
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for full cloud deployment instructions (Render, Railway, AWS).

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies (server + client) |
| `npm run dev` | Start dev servers (backend + frontend) |
| `npm run build` | Build React frontend for production |
| `npm run server` | Start only the backend API |
| `npm start` | Build frontend + start production server |
| `bash start.sh` | Auto-install + start (one command) |

---

## 📄 License

MIT
