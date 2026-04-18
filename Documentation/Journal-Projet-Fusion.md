# Journal du Projet Fusion
*Dernière mise à jour : 11 avril 2026*

---

## Contexte

Le projet **Fusion** vise à combiner deux outils d'IA agentique — **DeerFlow** et **OpenClaw** — pour créer un environnement de développement local entièrement orchestré par l'IA.

---

## Session 1 — 11 avril 2026

### 1. Analyse et nettoyage du disque C:

**Problème :** Seulement ~105 GB libres sur C: malgré peu de jeux installés.

**Analyse :**

| Dossier | Taille |
|---------|--------|
| `Program Files (x86)\Steam` | 105 GB (Vein 66 GB + Sims 4 36 GB) |
| `AppData\Local` | 90 GB |
| `Windows` | 31.8 GB |
| `Users\User` (hors AppData) | 38 GB |
| `Program Files` | 19.3 GB |

**Caches nettoyables identifiés (~67 GB) :**

| Cache | Taille | Commande |
|-------|--------|---------|
| `.codex` (Amazon Q) | 21.7 GB | Supprimer `C:\Users\User\.codex` |
| `pip` | 19.4 GB | `pip cache purge` |
| `rclone` | 17 GB | Supprimer `AppData\Local\rclone` |
| `uv` | 7.3 GB | `uv cache clean` |
| `npm` | 2 GB | `npm cache clean --force` |

**Config machine :**
- GPU : NVIDIA GTX 1660 — **4 GB VRAM** (insuffisant pour modèles locaux lourds)
- Python 3.14.3 / Node.js 24.14.0 / Docker 29.3.1 / Git 2.53.0

---

### 2. Décision d'architecture du projet Fusion

**DeerFlow** = "usine de production" — orchestration multi-agents, sandbox Docker, LangGraph
**OpenClaw** = "concierge numérique" — gateway messageries, toujours actif

**Décision :** Commencer par DeerFlow seul (usage depuis PC uniquement, pas besoin de messageries mobiles). OpenClaw mis en réserve pour plus tard.

---

### 3. Stack de modèles retenue

| Rôle | Modèle | Raison |
|------|--------|--------|
| **Chef d'orchestre (Lead Agent)** | GPT-5.4 | Meilleur raisonnement, computer use 75%, -47% tokens sur workflows multi-outils, 1M contexte |
| **Code & tâches courantes** | DeepSeek V3 (`deepseek-chat`) | Quasi gratuit, excellent sur le code |
| **Résumés / tâches légères** | GPT-5.4 Mini | Économique pour les opérations internes |

**Modèles envisagés pour l'avenir :**
- Kimi K2.5 — Visual Coding (génère du code depuis un screenshot)
- Qwen3.5 397B — contexte 1M tokens, raisonnement
- GLM-5 — leader du leaderboard chinois (BenchLM)
- IQuest-Coder — 40B params, bat Claude Sonnet 4.5 sur SWE-Bench (81.4%)

---

### 4. Installation de DeerFlow

**Repo :** `https://github.com/bytedance/deer-flow`
**Emplacement :** `E:\PROJETS\DeerFlow`

**Fichiers créés / configurés :**

- `config.yaml` — modèles GPT-5.4 + DeepSeek V3 + GPT-5.4-mini, sandbox local, Codex CLI en ACP agent
- `.env` — clés API OpenAI + DeepSeek, chemins Docker, secret auth
- `extensions_config.json` — copié depuis l'exemple
- `backend/.deer-flow/` — dossier de données runtime créé

**État au 11/04/2026 :** Build Docker en cours (`docker compose -f docker/docker-compose.yaml build`)

**Commande pour démarrer une fois le build terminé :**
```bash
cd E:/PROJETS/DeerFlow
docker compose -f docker/docker-compose.yaml --env-file .env up -d
```

**Interface web :** http://localhost:2026

---

## Prochaines étapes

- [ ] Finaliser le build Docker
- [ ] Premier démarrage et test de l'interface
- [ ] Tester un premier workflow de développement (ex: analyse d'un projet existant)
- [ ] Configurer les mounts sandbox pour accéder aux projets existants (`E:\PROJETS\*`)
- [ ] Évaluer l'ajout d'OpenClaw comme gateway si besoin mobile
