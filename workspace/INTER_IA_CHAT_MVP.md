# Fusion V1 - Chat inter-IA avec chef d'orchestre

## Intention

Construire une V1 simple de Fusion ou plusieurs IA collaborent dans une conversation partagee, sans faire porter toute la logique a une extension VS Code.

Le point cle:
- pas besoin que l'utilisateur soit toujours au centre
- pas besoin d'un systeme complet d'agents des le debut
- un chat inter-IA avec orchestration suffit pour une V1 utile

## Principe retenu

1. Un fichier de conversation partage contient les messages.
2. Un chef d'orchestre surveille ce fichier.
3. Des qu'un nouveau message apparait, le chef d'orchestre pousse l'information vers les IA concernees.
4. Les IA repondent via l'orchestrateur, pas en ecriture libre et concurrente.
5. Les reponses sont ajoutees au meme flux conversationnel.

## Pourquoi cette approche

- Plus simple qu'une extension VS Code "totale"
- Plus robuste qu'un systeme ou chaque IA lit et ecrit directement sans mediation
- Compatible avec l'architecture actuelle de Fusion
- Permet d'ajouter plus tard un dashboard, Telegram, Railway et une APK

## Architecture MVP

### 1. Fichier de conversation

Format recommande:
- `conversation.jsonl`

Pourquoi:
- append-only
- facile a parser
- facile a surveiller
- moins fragile qu'un `.md` si plusieurs acteurs ecrivent

Champs minimums proposes:
- `id`
- `timestamp`
- `author`
- `role`
- `threadId`
- `content`
- `replyTo`
- `status`
- `targets`

## 2. Chef d'orchestre

Responsabilites:
- surveiller les changements du fichier
- detecter les nouveaux messages
- router vers les bonnes IA
- eviter les doublons
- suivre l'etat des messages
- reinjecter les reponses dans le journal

Important:
- le fichier ne pousse pas directement vers les IA
- c'est l'orchestrateur qui observe puis pousse

## 3. Agents

Agents envisages:
- Codex
- Claude
- Qwen
- DeepSeek

Principe:
- chaque agent a un connecteur
- chaque agent recoit un contexte filtre
- chaque agent repond dans le flux via l'orchestrateur

## 4. Interface visuelle

La vue Fusion pourra afficher:
- le fil de conversation
- les messages en attente
- les messages dispatches
- qui a repondu
- qui n'a pas repondu
- l'etat global de la conversation

## Ce qu'il ne faut pas faire en V1

- laisser toutes les IA ecrire librement dans le meme fichier sans mediation
- essayer de construire un OS complet d'agents des la premiere iteration
- mettre toute l'intelligence dans une extension VS Code

## Reutilisation de l'existant Fusion

Cette idee peut reutiliser des briques deja presentes:
- `src/integrations/orchestrator/FileWatcher.ts`
- `src/integrations/orchestrator/ManagerLoop.ts`

Evolution envisagee:
- aujourd'hui: `KANBAN.md`
- ensuite: `conversation.jsonl`
- puis: dashboard de conversation

## Position produit

Formulation simple:

Fusion V1 = chat inter-IA orchestre

Pas encore:
- un OS complet d'agents
- une plateforme multi-tenant
- une orchestration autonome lourde

## Decision

Pour Fusion, la bonne V1 multi-IA est:
- une conversation partagee
- un chef d'orchestre
- des connecteurs IA
- une interface visuelle

Cette note doit servir de base si on reprend plus tard l'idee d'extension Fusion ou de salon inter-IA.
