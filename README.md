# 🤖 Open Gravity

> **Autonomous AI Agent with "Architect" Personality**
> Handcrafted for Pablo by Stark Industries (v1.2-ARCHITECT).

Open Gravity is an advanced AI agent built with a focus on **Software Architecture**, **Strategic Memory**, and **Observability**. It acts as a senior partner, not just a chatbot, capable of auditing code, managing infrastructure (Google Workspace), and proactively searching for information.

## 🏗️ Architecture

- **Core Loop**: `src/core/agent.ts` handles the iterative "Think-Act-Observe" cycle.
- **LLM Orchestration**: Supports multiple providers (Groq, OpenRouter) with automatic fallback and loop protection.
- **Dynamic Tooling**: `src/tools/registry.ts` discovers and validates tools on the fly using Zod.
- **Strategic Memory**: Integrates Firestore for long-term semantic search ("Omni-Brain") and bootstrapping context.
- **Observability**: Real-time event tracing persistent in Firestore and visualized in a built-in HUD.

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.0.0
- A Telegram Bot Token
- Groq API Key
- (Optional) Firebase Service Account for Firestore Memory
- (Optional) `gog` CLI for Google Workspace tools

### Installation
```bash
npm install
cp .env.example .env # Configure your keys
```

### Running the Agent
```bash
npm run dev
```
The agent starts a dashboard at `http://localhost:7860/` (or your configured port).

## 🛠️ Tool System

Open Gravity uses a sophisticated tool registry:
- **Project Analyst**: Audits local code structure and content.
- **Developer Tool**: Modifies files and runs verification commands (`npm run typecheck`).
- **Google Workspace**: Full integration with Calendar, Gmail, Drive via `gogcli`.
- **Knowledge Management**: Semantic search for personal notes and project lore.
- **Brave Search**: Real-time web research.

## 🧠 Personality: "The Architect"
The agent speaks with a **Senior Architect** persona, direct and technically rigorous, using Rioplatense/Chilean Spanish idioms (e.g., *laburo*, *boludo*, *crack*). It prioritizes **SOLID** principles and **Clean Architecture** in every proposal.

---
*Built with ❤️ for those who value Architecture over "Tutorial Programming".*
