# CodeLens v2.0 — Web App & Premium Features

Transform CodeLens from a CLI tool into a full-stack web application with advanced AI reasoning capabilities.

## User Review Required

> [!IMPORTANT]
> This is a **major rewrite** — we've created a new project structure with a React frontend and Node.js backend.
> v2.0 adds 7 premium features including **interactive chat**, **impact analysis**, and **architecture drift detection**.

## Architecture

```mermaid
graph TD
    User["👤 Browser"] --> UI["⚛️ React Frontend"]
    UI -->|"SSE /api/analyze"| API["🖥️ Express API"]
    API --> Engine["🧠 Analysis Engine"]
    
    subgraph "Core Pipeline"
        Engine --> Clone["📥 Git Clone"]
        Engine --> Discovery["🔍 File Discovery"]
        Engine --> LLM["🤖 LLM Analysis"]
        Engine --> Diagrams["📊 Diagram Generation"]
    end
    
    subgraph "Premium Features"
        Engine --> Chat["💬 Chat Service"]
        Engine --> Blast["💥 Blast Radius"]
        Engine --> Heatmap["🌡️ Debt Heatmap"]
        Engine --> Drift["🏗️ Drift Detector"]
        Engine --> Story["🧭 Onboarding Story"]
        Engine --> ADR["📝 Auto-ADRs"]
        Engine --> Cross["🔗 Cross-Repo Map"]
    end
    
    Diagrams --> Results["📄 Technical Doc"]
    Premium Features --> Results
    Results -->|"JSON"| UI
```

## Implemented Features

### Core Web App
- **React Frontend**: Modern dark theme, glassmorphism UI.
- **Express Backend**: SSE-based streaming analysis.
- **Multi-Repo**: Support for multiple GitHub URLs or local paths.

### Premium Features (v2.0)
1. **Ask the Codebase (Chat)**: Interactive Q&A with the code model.
2. **Impact Blast Radius**: Visual dependency graph showing what breaks on change.
3. **Technical Debt Heatmap**: Color-coded grid of complexity and code smells.
4. **Architecture Drift Detection**: Compares README intent vs actual code.
5. **Onboarding Story Generator**: Narrated step-by-step walkthrough for new devs.
6. **Auto-Generated ADRs**: Reverse-engineered design decisions.
7. **Cross-Repo Microservices Map**: Service mesh visualization across repos.

## Verification
- ✅ **Server**: Validation via `node --check`.
- ✅ **Frontend**: Verified UI loading and feature rendering.
- ✅ **Integration**: Full end-to-end pipeline tested.
