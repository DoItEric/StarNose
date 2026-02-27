<p align="center">
  <img src="./image.jpg" alt="StarNose Logo" width="200" />
</p>

<p align="center">
  <a href="#english">English</a> 
</p>


### Overview

**StarNose** is a personal data sniffing tool built with a **Node.js (TypeScript) backend** and a **Vue 3 + Vite frontend**.  
It helps users save time by automatically collecting and filtering data from multiple platforms (RSS, crawlers, social media, etc.) and validating relevance using **LLM (OpenRouter)** according to user‑defined rules.

StarNose v1 focuses on:
- **Data sources (plugins)**: pluggable crawlers such as Twitter, RSS, Reddit.
- **Rules**: what the user cares about (keywords + LLM validation).
- **Data**: normalized, queryable, and analyzable records stored in PostgreSQL.

### Architecture

StarNose consists of four main parts:

- **UI (`ui/`)**
  - Vue 3 + Vite + TypeScript.
  - Ant Design Vue admin‑style UI.
  - Main menu: **Data Sources, Rules, Data, Analysis, Settings**.

- **Gateway (`gateway/`)**
  - Node.js + TypeScript.
  - Provides REST APIs for UI and plugins.
  - Responsibilities:
    - Plugin registration and scheduling (via `node-cron`).
    - Rule management and data storage (PostgreSQL).
    - LLM integration and validation (OpenRouter).
    - Basic data analysis (keywords, word cloud, hot data list).

- **Plugins (`plugins/`)**
  - Each plugin is an **independent project** with its own dependencies and a standard structure:
    - Entry `main` file with a `main` function.
    - Configuration (name, type, version, description, etc.).
  - Invoked by the gateway via command‑line.
  - Responsible for:
    - Fetching raw data from external platforms.
    - Local deduplication and keyword based pre‑filtering.
    - Calling gateway APIs for LLM validation and data storage.

- **LLM & Agents (`Agents/`, `prompts/`, `gateway/src/llm`)**
  - LLM provider: **OpenRouter** (key configured in `.env`).
  - Prompts defined in `prompts/*.md` (system prompts + user templates).
  - Unified LLM invocation and validation interfaces in the gateway.

### Project Structure (simplified)

```text
doc/                 # Product / requirement docs
prompts/             # LLM prompts (Markdown)
plugins/             # Independent data source plugins
  twitter-example/   # Example plugin
ui/                  # Vue 3 + Ant Design Vue frontend
gateway/             # Node.js + TS backend gateway
Agents/              # LLM wrapper / agents
image.jpg            # Project logo (used in this README)
```

### Tech Stack

- **Runtime**
  - Node.js **>= 20**
  - Package manager: **pnpm**

- **Frontend**
  - Vue 3 + Vite
  - TypeScript
  - Ant Design Vue
  - vue-router, vue-i18n

- **Backend / Gateway**
  - Node.js + TypeScript
  - Express
  - node-cron
  - PostgreSQL (`pg`)

- **LLM**
  - Provider: **OpenRouter**
  - Blocking (non‑streaming) requests, supports concurrent calls.

### Database

- Database: **PostgreSQL**
- IDs: **UUID** primary keys
- Time fields: **UTC**
- Main entities:
  - **Rule**: id, name, description, keywords, status, last schedule time, etc.
  - **Data**: id, ruleId, uniqueKey, source, title, content, url, keywords, tracking flag, capture time, publish time, summary, read state, score (0–100), etc.

### UI Features (v1)

- **Data Sources**
  - Display registered plugins as app icons.
  - Each plugin has **Settings** and **History**:
    - Settings: configure cron schedule; stored in DB.
    - History: latest executions, success/failure, total data, how many matched rules.

- **Rules**
  - List with: name, keywords, last schedule time, status, operations.
  - Create rule flow:
    1. User describes what data they care about in rich text.
    2. Backend + prompts + LLM generate candidate keywords.
    3. User edits keywords (tag‑style UI) and confirms.
    4. Rule is saved to DB.

- **Data**
  - Paginated list (max 100 per page) of matched data.
  - Filter by capture time, publish time, plugin, read status, keywords, etc.
  - Each row has a **Track** button to continue tracking.

- **Analysis**
  - Word cloud by keyword frequencies (with basic normalization).
  - Hot data list sorted by heat score.

- **Settings / Health**
  - Simple “self‑check” page: plugin count, scheduler queue length, recent error stats.

### Multi‑language

- UI supports **English and Chinese** switching.
- This README provides **English (default)** and **Chinese** sections—use the links at the top to switch.

### Getting Started

#### Prerequisites

- Node.js **>= 20**
- **pnpm**
- **PostgreSQL** database instance
- OpenRouter API key (configured in `.env`)

#### 1. Clone & install

```bash
# clone repository (path example)
git clone <your-repo-url> starnose
cd starnose

# UI
cd ui
pnpm install

# Gateway
cd ../gateway
pnpm install
```

#### 2. Configure environment

Create a `.env` file in the project root based on `.env.example` (if present), for example:

```bash
OPENROUTER_API_KEY=your-key-here
DATABASE_URL=postgres://user:password@localhost:5432/starnose
```

#### 3. Run services

```bash
# start gateway (backend)
cd gateway
pnpm dev

# start UI (frontend, in another terminal)
cd ui
pnpm dev
```

Then open the printed URL (typically `http://localhost:5173`) in your browser.

### Logging

- Text logs with `.log` extension, rotated by day.
- Logs are backend‑only; they are **not** exposed in the UI in v1.

---