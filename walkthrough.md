# CodeLens v2.0 — Premium AI Architecture Platform

CodeLens has evolved into a comprehensive **AI-powered software architecture platform**. Beyond static diagrams, v2.0 introduces 7 advanced features to reason about code quality, impact, and design decisions.

## 🚀 New Premium Features

| Feature | Description |
|---------|-------------|
| **🧠 Ask the Codebase** | Interactive chat with your codebase's structural model. Ask "Where is auth handled?" or "What happens if I delete this?" |
| **💥 Impact Blast Radius** | Select any component to visualize what breaks if you change it. See direct & indirect dependencies with risk scores. |
| **🌡️ Debt Heatmap** | Visual grid showing technical debt across your system. Color-coded by complexity, coupling, and lack of tests. |
| **🏗️ Drift Detection** | Compares your *intended* architecture (from README) vs *actual* code structure. Alerts on deviations. |
| **🧭 Onboarding Story** | Generates an interactive, step-by-step narrated walkthrough for new developers joining the team. |
| **📝 Auto-ADRs** | Reverse-engineers Architecture Decision Records (ADRs) from code patterns, inferring *why* decisions were made. |
| **🔗 Cross-Repo Map** | Analyze multiple repos together to see shared APIs, database models, and dependencies in a service mesh view. |

## 📸 Live UI

![CodeLens v2.0 Dashboard](/Users/animeshgaur/.gemini/antigravity/brain/5df33eea-657f-46e2-b0c8-786b092d72bb/codelens_landing_page_1771415914702.png)

## 🏗️ Architecture v2.0

```mermaid
graph TD
    User["👤 User"] --> UI["⚛️ React UI (Vite)"]
    UI -->|"/api/analyze"| API["🖥️ Express Server"]
    API --> Engine["🧠 Analysis Engine"]
    
    subgraph "Backend Services"
        Engine --> LLM["🤖 LLM Provider (Groq/OpenAI/Gemini)"]
        Engine --> Git["Git Clone Service"]
        Engine --> Parsers["Language Parsers"]
    end
    
    subgraph "Feature Modules"
        Engine --> Chat["💬 Chat Service"]
        Engine --> Blast["💥 Blast Radius Calc"]
        Engine --> Debt["🌡️ Debt Scorer"]
        Engine --> Drift["🏗️ Drift Detector"]
        Engine --> Story["🧭 Story Generator"]
        Engine --> ADR["📝 ADR Inference"]
        Engine --> Cross["🔗 Cross-Repo Mapper"]
    end
    
    Feature Modules -->|"JSON Results"| UI
```

## 🛠️ How to Run

1. **Install Dependencies**: `npm install && cd client && npm install && cd ..`
2. **Start App**: `npm run dev`
3. **Open**: `http://localhost:5173`
