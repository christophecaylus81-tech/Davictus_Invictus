# CADRAGE — PROJET FUSION

_Version 1.0 — 2026-04-14_

---

## 1. Vision

Fusion est un **OS personnel assisté par IA** pour entrepreneurs et builders actifs.

Il transforme le chaos informationnel quotidien (idées, emails, flux, projets multiples) en système organisé et pilotable — via une interface unique (Telegram d'abord) qui orchestre automatiquement plusieurs IA selon la complexité et le coût de chaque tâche.

**Objectif final pour l'utilisateur :**
> Sortir de l'exécution dispersée. Passer en pilotage stratégique.

---

## 2. Périmètre

### Ce qui est IN

| Domaine | Contenu |
|---|---|
| **Productivité personnelle** | Inbox, GTD, projets, tâches, planning |
| **Orchestration multi-IA** | Routage automatique IA chinoises / américaines selon complexité |
| **Production** | Assistance au code, rapports longs, veille |
| **Interface** | Telegram (v1), Web (v2), Mobile (v3) |
| **Architecture** | Hybride local + cloud, modules indépendants |

### Ce qui est OUT (hors scope)

| Hors scope | Raison |
|---|---|
| Gestion comptable ou financière | Hors périmètre métier |
| CRM ou outil commercial | Pas la cible |
| Collaboration multi-utilisateurs (v1) | Complexité trop élevée pour le MVP |
| Modèles IA locaux lourds | Contrainte matérielle (GTX 1660, 4 GB VRAM) |
| Intégration Amazing Seller ou MFD | Projets séparés, pas de couplage |

---

## 3. Utilisateur cible

**Profil primaire :** Entrepreneur / builder indépendant qui :
- gère plusieurs projets simultanément
- utilise des IA quotidiennement mais de façon fragmentée
- veut réduire sa charge mentale opérationnelle
- est sensible au coût des IA et à la souveraineté des données

**Utilisateur de référence pendant le développement :** Christophe (fondateur, usage quotidien réel).

---

## 4. Architecture décisionnelle

### Noyau central (immuable)
```
Inbox → GTD → Projets/Tâches → Planning → Exécution
```
Ce flux est le squelette du produit. Aucune décision de conception ne doit le contourner.

### Modules (constellations)
Chaque module est **indépendant**, branché sur le noyau via des interfaces définies.
Un module peut être ajouté, remplacé ou désactivé sans impact sur les autres.

### Orchestration multi-IA
Chaque tâche est routée automatiquement selon cette matrice :

| Complexité | Criticité | Modèle |
|---|---|---|
| Faible | Faible | DeepSeek / Qwen |
| Moyenne | Faible | DeepSeek V3 / Qwen Coder |
| Élevée | Moyenne | Claude Sonnet / GPT-4o |
| Élevée | Critique | Claude Opus / o3 |

**Règle :** l'utilisateur ne choisit jamais le modèle. Fusion décide.

---

## 5. Phases et jalons

### Phase 1 — Noyau stabilisé ✅ (fait)
- Interface Telegram fonctionnelle
- Inbox universelle
- Moteur GTD (classification automatique)
- Projets et tâches sur PostgreSQL
- Tests unitaires sur le chemin critique

**Jalon :** MVP fonctionnel, usage quotidien possible

---

### Phase 2 — Orchestration multi-IA (priorité immédiate)
- Intégration DeepSeek V3 (tâches courantes, code)
- Intégration Claude / GPT-4o (raisonnement complexe)
- Moteur de routage automatique selon complexité
- Tableau de bord des coûts IA (suivi usage / dépenses)
- Fallback automatique si modèle indisponible

**Jalon :** 1 tâche → routage automatique → bon modèle → réponse cohérente

---

### Phase 3 — Pilotage personnel
- Module Agenda (sync Google Calendar via MCP)
- Module Emails (Gmail via MCP — déjà disponible dans l'environnement)
- Priorisation quotidienne automatique
- Planning généré à partir des tâches + contraintes

**Jalon :** briefing quotidien automatique le matin via Telegram

---

### Phase 4 — Veille & Journal
- Collecte : Telegram channels, RSS, X
- Déduplication et classification thématique
- Journal quotidien structuré (IA / Business / Alertes)
- Approfondissement à la demande

**Jalon :** journal quotidien généré et envoyé automatiquement

---

### Phase 5 — Production
- Module Recherche & Rapports longs (architecture multi-agents)
- Assistant code intégré au flux de projets
- Computer use (vérification UI, navigation automatisée)

**Jalon :** production d'un rapport de 20+ pages à partir d'une demande simple

---

### Phase 6 — Interface avancée & commercialisation
- Interface web (v2)
- Onboarding utilisateur
- Plans d'abonnement + Stripe
- APK / wrapper mobile (v3)

**Jalon :** premier utilisateur payant externe

---

## 6. Contraintes

| Contrainte | Détail |
|---|---|
| **Matérielle** | GTX 1660 (4 GB VRAM) — pas de LLM locaux lourds possibles |
| **Stockage** | Installer les dépendances sur E: pour préserver C: |
| **Temps** | Projet parallèle à Amazing Seller (priorité commerciale court terme) |
| **Budget IA** | Limiter l'usage des modèles premium aux tâches qui le justifient |
| **Complexité** | Chaque phase doit être utilisable avant de lancer la suivante |

---

## 7. Critères de succès

### Court terme (Phase 2)
- Routage automatique opérationnel sur 3 types de tâches
- Coût IA divisé par 3 vs. tout envoyer sur Claude
- Usage quotidien réel par Christophe sans friction

### Moyen terme (Phase 4)
- Journal quotidien automatique envoyé chaque matin
- Zéro tâche perdue dans l'inbox depuis 30 jours
- Temps de traitement inbox < 2 minutes par jour

### Long terme (Phase 6)
- 20 premiers utilisateurs payants externes
- MRR : 500€+ sur Fusion seul
- NPS > 8 sur les utilisateurs actifs

---

## 8. Gouvernance et mode de travail

| Rôle | Responsabilité |
|---|---|
| **Christophe** | Vision, arbitrages produit, validation des phases, usage quotidien réel |
| **Claude Code** | Implémentation, architecture, refactoring, documentation |
| **Codex** | Orchestration technique, revue de code, tâches de production |

### Règles de travail
1. Chaque phase est validée par un jalon concret avant de passer à la suivante
2. Le noyau (Inbox → GTD → Projets) ne peut pas être refondu sans arbitrage explicite
3. Toute décision d'architecture est documentée dans le Journal du projet
4. Un module stub ne devient actif qu'une fois la phase précédente stabilisée

---

## 9. Prochaine action

**Démarrer Phase 2 : Orchestration multi-IA**

Première tâche concrète :
> Créer le module de routage — une fonction qui reçoit un `inbox_item` traité par GTD, évalue sa complexité, et sélectionne le modèle IA approprié pour le traitement.

Fichiers concernés :
- `src/integrations/` → nouveau dossier `ai-router/`
- `src/domain/gtd/` → enrichir le classifier avec un score de complexité
- `.env` → ajouter `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`
