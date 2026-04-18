# PROMPT MAÎTRE — FUSION

> Colle ce prompt au début de chaque nouvelle conversation pour donner le contexte complet au modèle.

_Dernière mise à jour : 2026-04-14_

---

## Ce qu'est Fusion

Fusion est un **OS personnel assisté par IA** pour entrepreneurs et builders.

Il résout un problème précis : trop de flux d'information, trop de projets simultanés, trop d'outils IA fragmentés, une charge mentale opérationnelle qui empêche le pilotage stratégique.

Fusion centralise tout dans une seule interface (Telegram d'abord, puis web) et orchestre automatiquement plusieurs IA selon la complexité et le coût de chaque tâche.

**Ce n'est pas un simple assistant. C'est un système de structuration universelle de la pensée et de l'action.**

---

## Noyau du système

Le noyau central comprend :
- L'interface Telegram (cockpit v1)
- L'Inbox universelle (capture de tout flux entrant)
- Le moteur GTD (classification et transformation automatique)
- La base Projets / Tâches (PostgreSQL)

Flux fondamental :
```
Input (idée, message, email, lien)
  → Inbox
    → GTD (classification automatique)
      → Tâche / Projet / Incubateur / Archive
        → Planning + Exécution
```

---

## Modules (constellations)

Chaque module est une constellation indépendante mais reliée au noyau.

| Module | Statut | Rôle |
|---|---|---|
| Inbox | ✅ MVP | Capture universelle |
| GTD | ✅ MVP | Transformation automatique |
| Projets & Tâches | ✅ MVP | Structuration et suivi |
| Agenda & Contraintes | Stub | Temporalité et planning |
| Emails | Stub | Gestion flux email |
| Veille & Journal | Stub | Perception du monde extérieur |
| Recherche & Rapports longs | Stub | Profondeur analytique |
| Assistant Code | Stub | Production technique |
| Computer Use | Stub | Contrôle visuel automatisé |

---

## Orchestration multi-IA (brique différenciante)

C'est le cœur stratégique de Fusion.

### Principe
Chaque tâche est routée automatiquement vers le modèle optimal selon deux axes : complexité et criticité.

### Matrice de routage

| Type de tâche | Modèle cible | Logique |
|---|---|---|
| Classification, tri, synthèses courtes, reformulation | DeepSeek / Qwen (modèles chinois) | Bon marché, suffisant |
| Code intermédiaire, génération structurée | DeepSeek V3 / Qwen Coder | Excellent rapport coût/qualité |
| Raisonnement complexe, arbitrage | Claude Sonnet / GPT-4o | Nécessaire sur tâches à enjeu |
| Décisions critiques, architecture, validation | Claude Opus / o3 | Utilisé avec parcimonie |

### Règle fondamentale
Ne jamais envoyer une tâche simple à un modèle premium. Le coût IA d'un utilisateur discipliné est 60-80% inférieur à celui qui envoie tout sur Claude/GPT.

---

## Stack technique actuelle

| Couche | Technologie |
|---|---|
| Backend | Node.js + TypeScript (strict) |
| API | Express |
| Base de données | PostgreSQL |
| Interface v1 | Telegram Bot (Telegraf) |
| Orchestration future | n8n |
| IA locale future | Ollama |
| Tests | Vitest |

### Machine de développement
- OS : Windows 11 Pro
- GPU : NVIDIA GTX 1660 (4 GB VRAM) — pas de LLM locaux lourds pour l'instant
- Node.js ≥ 20, Docker disponible
- Projet à `E:\PROJETS\Fusion`

### Autres projets sur la machine
| Dossier | Projet |
|---|---|
| `C:\business-manager` | Amazing Seller — SaaS e-commerce / Amazon FBA |
| `C:\My Free Devis - Application` | MFD — SaaS BTP artisans |

---

## Règles de conception

### Ce qu'il faut toujours respecter

1. **Le flux Inbox → GTD → Action est sacré.** Aucune fonctionnalité ne doit le contourner ou le complexifier.
2. **L'interface doit rester simple.** La puissance est dans le moteur, pas dans l'UI. L'utilisateur tape un message, le système fait le reste.
3. **Chaque module est indépendant mais branché sur le noyau.** Un module doit pouvoir être ajouté, désactivé ou remplacé sans casser les autres.
4. **Le routage IA est automatique.** L'utilisateur ne choisit jamais quel modèle utiliser — Fusion décide.
5. **Architecture hybride.** Les données sensibles restent en local. Le cloud est utilisé pour le raisonnement, pas pour le stockage.

### Ce qu'il ne faut jamais faire

- Ne pas complexifier l'interface utilisateur pour exposer des options techniques
- Ne pas coupler deux modules au point qu'on ne peut plus les modifier indépendamment
- Ne pas envoyer toutes les tâches au même modèle IA sans considération de coût
- Ne pas construire des features sans vérifier qu'elles s'inscrivent dans le flux fondamental
- Ne pas négliger la résilience : si un modèle IA est indisponible, le système doit avoir un fallback

---

## Priorités actuelles

```
1. Stabiliser le noyau MVP (Telegram + Inbox + GTD + Projets)
2. Implémenter le routage multi-IA (DeepSeek + Claude)
3. Brancher le module Agenda
4. Brancher le module Emails
5. Construire le module Veille
6. Interface web (v2)
```

---

## Quand tu proposes une solution

Tu dois :
- vérifier que la solution s'intègre dans le flux fondamental (Inbox → GTD → Action)
- proposer le bon modèle IA pour chaque tâche selon la matrice de routage
- préserver l'indépendance des modules
- garder l'interface utilisateur simple — la complexité appartient au moteur
- expliciter les dépendances et les choix structurants
