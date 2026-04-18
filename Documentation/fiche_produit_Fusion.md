# FICHE PRODUIT — FUSION

_Dernière mise à jour : 2026-04-14_

---

## 1. Identité produit

| | |
|---|---|
| **Nom** | Fusion |
| **Tagline** | Un cerveau central. Les meilleures IA au bon prix, au bon moment. |
| **Catégorie** | OS personnel assisté par IA — productivité, projets, code |
| **Interface principale** | Telegram (v1) → Web (v2) → Mobile (v3) |
| **Stade** | MVP fonctionnel (Telegram + Inbox + GTD + Projets/Tâches) |

---

## 2. Problème résolu

Un entrepreneur ou builder actif jongle chaque jour avec :

- Des dizaines de flux d'information non traités (idées, messages, emails, veille)
- Des projets multiples sans système central de pilotage
- Des outils IA fragmentés : Claude pour coder, ChatGPT pour rédiger, DeepSeek pour le reste — sans cohérence
- Des coûts IA qui explosent dès qu'on automatise, parce qu'on utilise des modèles premium pour des tâches qui ne le nécessitent pas
- Une charge mentale opérationnelle qui empêche le pilotage stratégique

**Le résultat : on est dans l'exécution permanente, jamais dans la stratégie.**

---

## 3. Proposition de valeur

> **Fusion est le cockpit personnel qui centralise organisation, projets et production — en orchestrant automatiquement les IA chinoises bon marché et les IA américaines puissantes selon la complexité réelle de chaque tâche.**

### Ce qui différencie Fusion

| Axe | Fusion | Alternatives |
|---|---|---|
| **Orchestration multi-IA** | Route chaque tâche vers le modèle optimal (coût × performance) | Les autres outils sont mono-modèle ou laissent le choix à l'utilisateur |
| **Coût IA réduit** | Tâches répétitives → modèles chinois (DeepSeek, Qwen) à 10-20x moins cher | Tout sur Claude/GPT = facture qui explose |
| **Interface unifiée** | Un seul point d'entrée Telegram pour tout : tâches, projets, code, veille | Notion + Linear + ChatGPT + terminal = fragmentation |
| **GTD automatique** | Chaque input est classifié et transformé en action sans effort | Classification manuelle partout ailleurs |
| **Coding intégré** | Production de code dans le flux, sans sortir de l'interface | Allers-retours entre outils |
| **Souveraineté** | Architecture hybride local + cloud, données sensibles en local | Tout dans le cloud des GAFA |

---

## 4. Cible

### Cible primaire
**Entrepreneurs et builders indépendants** qui :
- gèrent plusieurs projets simultanément (SaaS, side-projects, mandats)
- utilisent déjà des IA quotidiennement mais de façon fragmentée
- cherchent à réduire leur charge cognitive sans réduire leur output
- ont une sensibilité aux coûts IA et à la souveraineté des données

### Cible secondaire
- Développeurs solo / freelances techniques
- Dirigeants de PME multi-projets
- Agences IA qui veulent un framework d'orchestration

---

## 5. Modules fonctionnels

### Ordre de déploiement

| Priorité | Module | Statut |
|---|---|---|
| 1 | Interface Telegram | ✅ MVP |
| 2 | Inbox universelle | ✅ MVP |
| 3 | GTD & structuration automatique | ✅ MVP |
| 4 | Projets & tâches | ✅ MVP |
| 5 | Agenda & contraintes | Stub |
| 6 | Emails | Stub |
| 7 | Veille & journal quotidien | Stub |
| 8 | Recherche & rapports longs | Stub |
| 9 | Assistant code | Stub |
| 10 | Computer use | Stub |

---

### Module 1 — Interface (Telegram → Web → Mobile)
Point d'entrée unique. Dialogue avec l'assistant, accès aux tâches/projets/rapports, déclenchement d'actions, arbitrages et validations.

### Module 2 — Inbox universelle
Capture tout : message Telegram, email, lien, idée dictée. Stockage brut sans friction.

### Module 3 — GTD automatique
Classification automatique de chaque item :
- Tâche actionnable simple → `task`
- Projet multi-étapes → `project` + première tâche
- Idée à maturer → `incubator`
- Information utile → `archive`
- Bruit → `trash`

### Module 4 — Projets & tâches
Kanban, listes, sous-tâches générées automatiquement, dépendances, échéances, priorisation.

### Module 5 — Agenda & contraintes
Synchronisation calendrier, contraintes personnelles/professionnelles, planning optimisé quotidien.

### Module 6 — Emails
Résumé automatique, extraction des actions, suggestions de réponses, liaison avec projets.

### Module 7 — Veille & journal quotidien
Collecte : Telegram channels, RSS, X. Déduplication, classification thématique, synthèse quotidienne structurée. Mode court / détaillé.

### Module 8 — Recherche & rapports longs
Architecture multi-agents : agent manager → agents chercheurs → agents analystes → agent rédacteur → agent QC. Production de rapports de 50 à 1000+ pages.

### Module 9 — Assistant code
Génération, refactoring, review, tests. Intégré au flux de projets.

### Module 10 — Computer use
Screenshots, vérification UI, navigation automatisée, tests parcours utilisateur.

---

## 6. Orchestration multi-IA (le cœur du système)

C'est la brique différenciante de Fusion.

### Principe
Chaque tâche est évaluée selon deux axes : **complexité** et **criticité**. Le système route automatiquement vers le modèle le plus adapté.

### Matrice de routage

| Type de tâche | Modèle cible | Raison |
|---|---|---|
| Classification GTD, tri inbox, synthèses courtes | DeepSeek / Qwen (modèles chinois) | 10-20x moins cher, suffisant pour ces tâches |
| Génération de code intermédiaire, reformulation | DeepSeek V3 / Qwen Coder | Excellent rapport qualité/prix sur le code |
| Raisonnement complexe, arbitrage stratégique | Claude / GPT-4o | Nécessaire pour les décisions à enjeu |
| Architecture, décisions critiques, validation finale | Claude Opus / o3 | Utilisé avec parcimonie, sur demande explicite |

### Impact économique
Un utilisateur qui route intelligemment réduit sa facture IA de **60 à 80%** par rapport à tout envoyer sur Claude/GPT — sans perte de qualité perceptible sur les tâches routinières.

---

## 7. Architecture technique

| Couche | Technologie |
|---|---|
| Backend | Node.js + TypeScript (strict) |
| API | Express |
| Base de données | PostgreSQL |
| Interface v1 | Telegram Bot (Telegraf) |
| Orchestration future | n8n |
| IA locale future | Ollama |
| Interface v2 | Web app (roadmap) |
| Interface v3 | APK / wrapper mobile (roadmap) |

### Architecture hybride local/cloud

**Local :** production répétitive, données sensibles, automatisation à faible coût
**Cloud :** raisonnement avancé, arbitrage stratégique, cas complexes

---

## 8. Roadmap

### Phase 1 — Noyau ✅ (fait)
Telegram + Inbox + GTD + Projets/Tâches

### Phase 2 — Orchestration multi-IA
Routage automatique selon complexité, intégration DeepSeek/Qwen + Claude/GPT, tableau de bord des coûts IA

### Phase 3 — Pilotage personnel
Agenda, contraintes, planning optimisé, emails

### Phase 4 — Veille
Collecte flux, journal quotidien, approfondissement à la demande

### Phase 5 — Production
Rapports longs multi-agents, assistant code intégré

### Phase 6 — Interface avancée
Web app, mobile, cockpit unifié

---

## 9. Monétisation

### Option A — SaaS abonnement (cible grand public)
| Plan | Prix/mois | Contenu |
|---|---|---|
| **Solo** | 29€ | Telegram + GTD + Projets + 3 modèles IA inclus |
| **Builder** | 69€ | Tout Solo + Veille + Code + rapports + modèles custom |
| **Team** | 149€ | Multi-utilisateurs + orchestration avancée + API |

### Option B — Offre B2B sur mesure
Configuration d'un assistant interne sur-mesure pour une entreprise : intégration outils existants, modèles dédiés, données en local. Ticket : 500-2000€/mois.

### Option C — Framework white-label
Vente de l'infrastructure d'orchestration à des agences IA ou intégrateurs. Licence annuelle.

---

## 10. Risques

| Risque | Niveau | Mitigation |
|---|---|---|
| Complexité d'onboarding | Élevé | Interface Telegram réduit la friction au minimum |
| Fiabilité des modèles chinois | Moyen | Fallback automatique vers modèle premium si échec |
| Marché très concurrentiel (Notion, Linear, ChatGPT) | Élevé | Le différenciateur est l'orchestration multi-IA, pas la gestion de tâches seule |
| Discipline d'utilisation requise | Moyen | GTD automatique réduit la friction d'adoption |
