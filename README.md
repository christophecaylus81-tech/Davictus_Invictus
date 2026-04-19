# Fusion MVP (v1)

Fusion MVP implémente le noyau validé:

- Interface Telegram (cockpit principal v1)
- Inbox universelle
- Traitement GTD simple et évolutif
- Base projets / tâches sur PostgreSQL
- Backend TypeScript modulaire, prêt pour extension n8n / Ollama

## 1) Stack

- Node.js + TypeScript (strict)
- API REST (Express)
- PostgreSQL (SQL explicite)
- Telegram Bot API (Telegraf)

## 2) Architecture

```text
src/
  api/                     # Routes REST
  config/                  # Chargement/validation config
  domain/                  # Domaine métier + use cases + ports
    gtd/
    inbox/
    projects/
    tasks/
    logs/
  infra/
    db/                    # Pool Postgres + migration + schema SQL
    repositories/          # Implémentations Postgres
  integrations/
    telegram/              # Bot Telegram v1
    n8n/                   # Notifier webhook (future-proof)
    ollama/                # Client de disponibilité (future-proof)
  modules/                 # Registre modules (MVP + stubs v2+)
  main.ts                  # Bootstrap applicatif
tests/
```

## 3) Modules

- `interface.telegram` -> MVP
- `inbox` -> MVP
- `gtd` -> MVP
- `projects.tasks` -> MVP
- `planning` -> stub
- `emails` -> stub
- `veille` -> stub
- `long-reports` -> stub
- `code-assistant` -> stub
- `computer-use` -> stub

## 4) Démarrage rapide

### Prérequis

- Node.js >= 20
- npm (ou pnpm/yarn)
- Docker (recommandé pour PostgreSQL) ou PostgreSQL local

### Installer

```bash
npm install
```

### Configurer

```bash
cp .env.example .env
```

Variables clés dans `.env`:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_CHAT_IDS` (liste CSV optionnelle)
- `TELEGRAM_AUTO_PROCESS` (`true`/`false`)

### Lancer PostgreSQL (Docker)

```bash
docker compose up -d postgres
```

### Migrer la base

```bash
npm run migrate
```

### Lancer l'application

```bash
npm run dev
```

API: `http://localhost:3001`

## 4 bis) Mode local "Manager d'IA"

Si tu veux une version locale très simple de Daitivus dans le terminal de VS Code, sans Railway ni base obligatoire :

```bash
npm run local:manager
```

Ce mode :

- ne dépend pas du backend HTTP
- ne dépend pas de PostgreSQL
- route une demande vers `direct`, `codex`, `deepseek`, `qwen`, `gemini`, `claude` ou `ollama`
- crée un fichier de handoff pour Codex quand la demande implique de vraies modifs de code

Variables utiles dans `.env` :

- `DAITIVUS_MANAGER_PROVIDER` pour forcer le manager (`ollama`, `deepseek`, `qwen`, `openai`, `gemini`, `claude`)
- `DEEPSEEK_API_KEY`, `QWEN_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`
- `OLLAMA_BASE_URL` si tu veux un mode local sans token cloud
- `DAITIVUS_CODEX_OUTPUT_DIR` pour choisir où écrire les handoffs Codex

## 5) Flux MVP

### Telegram

1. Un message texte arrive.
2. Fusion crée un `inbox_item`.
3. Fusion applique GTD v1:
   - actionnable simple -> `task`
   - multi-étapes -> `project` + première `task`
   - non actionnable utile -> `incubator` / `archive`
   - bruit -> `trash` (suppression logique)
4. Fusion répond dans Telegram avec le résultat.

### API

- `GET /health`
- `GET /api/modules`
- `POST /api/inbox`
- `POST /api/inbox/:id/process`
- `GET /api/inbox`
- `GET /api/inbox/:id/logs`
- `GET /api/projects`
- `GET /api/tasks`

Exemple d'insertion + traitement immédiat:

```bash
curl -X POST http://localhost:3001/api/inbox \
  -H "content-type: application/json" \
  -d '{"source":"api","content":"Appeler le fournisseur demain","processNow":true}'
```

## 6) Tests

```bash
npm test
```

Tests fournis:

- `GtdClassifier` (règles de décision)
- `ProcessInboxItemUseCase` (chemin critique de transformation)

## 7) Compatibilité future n8n / Ollama

- `integrations/n8n/N8nAdapter.ts`: notifier webhook prêt à brancher vers un workflow n8n.
- `integrations/ollama/OllamaAdapter.ts`: client de disponibilité local Ollama.

Le MVP n'implémente pas encore la logique métier de ces modules, mais les ports sont déjà présents pour branchement progressif.
