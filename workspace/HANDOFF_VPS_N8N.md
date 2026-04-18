# HANDOFF VPS + N8N

## Etat au 2026-04-18 15:46

- VPS OVH actif: `51.254.200.78`
- OS: `Ubuntu 22.04.5 LTS`
- Docker installe et actif
- Docker Compose installe et actif
- Stack `n8n + PostgreSQL` deployee et fonctionnelle
- `n8n` est volontairement prive, expose seulement sur `127.0.0.1:5678` sur le VPS

## Acces SSH

- Utilisateur distant: `ubuntu`
- Cle privee locale utilisee: `C:\Users\User\.ssh\ovh_vps_n8n`
- Exemple de connexion:

```powershell
ssh -i C:\Users\User\.ssh\ovh_vps_n8n ubuntu@51.254.200.78
```

## Acces interface n8n

- Tunnel SSH a ouvrir depuis le PC local:

```powershell
ssh -L 5678:127.0.0.1:5678 -i C:\Users\User\.ssh\ovh_vps_n8n ubuntu@51.254.200.78
```

- Puis ouvrir dans le navigateur local:

```text
http://localhost:5678
```

## Fichiers importants sur le VPS

- Compose: `/opt/n8n/compose.yaml`
- Variables sensibles: `/opt/n8n/.env`

Attention:
- Le fichier `.env` contient les secrets `POSTGRES_PASSWORD` et `N8N_ENCRYPTION_KEY`
- Ne pas les afficher ni les ecraser sans raison

## Services en place

- Conteneur base: `postgres:16-alpine`
- Conteneur app: `docker.n8n.io/n8nio/n8n:stable`
- Port publie: `127.0.0.1:5678->5678/tcp`

## Commandes utiles

- Etat des conteneurs:

```powershell
ssh -i C:\Users\User\.ssh\ovh_vps_n8n ubuntu@51.254.200.78 "cd /opt/n8n && sudo docker compose ps"
```

- Logs n8n:

```powershell
ssh -i C:\Users\User\.ssh\ovh_vps_n8n ubuntu@51.254.200.78 "cd /opt/n8n && sudo docker compose logs -f n8n"
```

- Redemarrer la stack:

```powershell
ssh -i C:\Users\User\.ssh\ovh_vps_n8n ubuntu@51.254.200.78 "cd /opt/n8n && sudo docker compose restart"
```

## Decisions prises

- Pas d'exposition publique pour le moment
- Pas de domaine ni HTTPS pour l'instant
- Usage actuel: projet prive / prototype interne
- `n8n` est garde comme outil de prototypage et d'orchestration interne

## Points de vigilance

- Si Fusion devient multi-utilisateur avec credentials tiers utilisateur (`Google`, `Notion`, etc.), la licence `n8n` devra etre re-evaluee avant commercialisation
- Pour Telegram via `n8n`, un webhook public serait necessaire si on veut que Telegram appelle directement `n8n`
- En revanche, le backend Fusion dispose deja d'une integration Telegram via `Telegraf`, plus simple a rendre operationnelle aujourd'hui

## Prochain objectif recommande

- Rendre Telegram operationnel via le backend Fusion
- Ajouter un dashboard visuel desktop dans l'application Fusion
- Garder `n8n` comme brique de support/prototypage tant que le produit reste prive
