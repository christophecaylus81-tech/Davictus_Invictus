# Google Workspace sur n8n

Workflows importés dans l'instance n8n :

- `Fusion - Google Gmail - Unread Inbox`
- `Fusion - Google Calendar - Agenda`
- `Fusion - Google Tasks - Open Tasks`
- `Fusion - Google Contacts - Directory`

Fichiers sources :

- `workspace/n8n/google-gmail-unread.json`
- `workspace/n8n/google-calendar-today.json`
- `workspace/n8n/google-tasks-open.json`
- `workspace/n8n/google-contacts-list.json`

## Accès à n8n

Depuis le PC local :

```powershell
ssh -L 5678:127.0.0.1:5678 -i C:\Users\User\.ssh\ovh_vps_n8n ubuntu@51.254.200.78
```

Puis ouvrir :

```text
http://localhost:5678
```

## Étape suivante

Créer les credentials Google dans n8n, un par service :

- Gmail
- Google Calendar
- Google Tasks
- Google Contacts

Pour chaque credential, copier l'URL de redirection OAuth affichée par n8n et la déclarer dans Google Cloud Console.

## Remarque importante

L'instance n8n est self-hosted. Le mode "Managed OAuth2" n'est pas disponible comme sur n8n Cloud. Il faut utiliser le mode Custom OAuth2 / OAuth2 standard côté Google Cloud.

## Après connexion

- `Gmail - Inbox` : vérifier la lecture de la boîte de réception
- `Google Calendar - Agenda` : vérifier l'accès au calendrier principal
- `Google Tasks - Open` : sélectionner la bonne task list si nécessaire
- `Google Contacts - Directory` : lister les contacts
