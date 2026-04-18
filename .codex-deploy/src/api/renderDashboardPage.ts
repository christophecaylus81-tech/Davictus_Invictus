export function renderDashboardPage(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fusion Control Room</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #08111f;
        --bg-soft: #101c31;
        --panel: rgba(11, 22, 38, 0.78);
        --panel-strong: rgba(16, 30, 52, 0.95);
        --line: rgba(150, 199, 255, 0.16);
        --text: #edf4ff;
        --muted: #94a9c6;
        --blue: #69b7ff;
        --teal: #58e6c1;
        --amber: #f2c14f;
        --red: #ff7b7b;
        --shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(88, 230, 193, 0.12), transparent 24%),
          radial-gradient(circle at top right, rgba(105, 183, 255, 0.15), transparent 30%),
          linear-gradient(180deg, #091120 0%, #08111f 45%, #060c17 100%);
      }

      .shell {
        width: min(1440px, calc(100vw - 32px));
        margin: 24px auto;
      }

      .hero {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 18px;
        margin-bottom: 18px;
      }

      .panel {
        border: 1px solid var(--line);
        background: var(--panel);
        backdrop-filter: blur(18px);
        border-radius: 24px;
        box-shadow: var(--shadow);
      }

      .hero-main {
        padding: 28px;
        position: relative;
        overflow: hidden;
      }

      .hero-main::after {
        content: "";
        position: absolute;
        inset: auto -8% -30% auto;
        width: 320px;
        height: 320px;
        background: radial-gradient(circle, rgba(105, 183, 255, 0.18), transparent 68%);
        pointer-events: none;
      }

      .eyebrow {
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--teal);
        font-size: 12px;
        margin-bottom: 14px;
      }

      h1 {
        margin: 0;
        font-family: "IBM Plex Mono", "Consolas", monospace;
        font-size: clamp(30px, 4vw, 48px);
        line-height: 1.04;
        max-width: 12ch;
      }

      .subtitle {
        margin: 16px 0 0;
        color: var(--muted);
        max-width: 58ch;
        line-height: 1.55;
      }

      .hero-meta {
        margin-top: 22px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .chip {
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.04);
        border-radius: 999px;
        padding: 10px 14px;
        color: var(--muted);
        font-size: 14px;
      }

      .hero-side {
        padding: 22px;
        display: grid;
        gap: 14px;
        align-content: start;
      }

      .status-card {
        background: var(--panel-strong);
        border-radius: 18px;
        padding: 16px;
        border: 1px solid var(--line);
      }

      .status-label {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .status-value {
        margin-top: 8px;
        font-size: 24px;
        font-weight: 700;
      }

      .status-hint {
        margin-top: 10px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.45;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 18px;
      }

      .kpi-strip {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }

      .kpi {
        padding: 20px;
        min-height: 126px;
      }

      .kpi-title {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--muted);
      }

      .kpi-value {
        margin-top: 12px;
        font-size: 42px;
        font-weight: 800;
        font-family: "IBM Plex Mono", "Consolas", monospace;
      }

      .kpi-note {
        margin-top: 10px;
        color: var(--muted);
        font-size: 14px;
      }

      .span-7 {
        grid-column: span 7;
      }

      .span-5 {
        grid-column: span 5;
      }

      .span-4 {
        grid-column: span 4;
      }

      .section {
        padding: 20px;
      }

      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .section-title {
        margin: 0;
        font-size: 18px;
      }

      .section-subtitle {
        color: var(--muted);
        font-size: 14px;
      }

      .button {
        appearance: none;
        border: 1px solid rgba(105, 183, 255, 0.34);
        background: rgba(105, 183, 255, 0.1);
        color: var(--text);
        padding: 10px 14px;
        border-radius: 999px;
        font: inherit;
        cursor: pointer;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        text-align: left;
        padding: 12px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        vertical-align: top;
      }

      th {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 600;
      }

      td {
        font-size: 14px;
      }

      .mono {
        font-family: "IBM Plex Mono", "Consolas", monospace;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        border: 1px solid var(--line);
      }

      .pill.ok {
        color: var(--teal);
        background: rgba(88, 230, 193, 0.08);
      }

      .pill.warn {
        color: var(--amber);
        background: rgba(242, 193, 79, 0.09);
      }

      .pill.off {
        color: var(--red);
        background: rgba(255, 123, 123, 0.08);
      }

      .stack {
        display: grid;
        gap: 12px;
      }

      .item-card {
        padding: 14px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .item-title {
        font-weight: 700;
        line-height: 1.45;
      }

      .item-meta {
        margin-top: 8px;
        color: var(--muted);
        font-size: 13px;
      }

      .module-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .module-card {
        padding: 14px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.03);
      }

      .muted {
        color: var(--muted);
      }

      .empty {
        color: var(--muted);
        padding: 14px 0;
      }

      .footer-note {
        margin-top: 18px;
        text-align: right;
        color: var(--muted);
        font-size: 13px;
      }

      @media (max-width: 1080px) {
        .hero {
          grid-template-columns: 1fr;
        }

        .kpi-strip {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .span-7,
        .span-5,
        .span-4 {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 720px) {
        .shell {
          width: min(100vw - 18px, 1440px);
          margin: 12px auto 20px;
        }

        .hero-main,
        .hero-side,
        .section,
        .kpi {
          padding: 16px;
        }

        .kpi-strip,
        .module-grid {
          grid-template-columns: 1fr;
        }

        h1 {
          max-width: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <article class="panel hero-main">
          <div class="eyebrow">Fusion control room</div>
          <h1>Telegram, inbox, projets, taches.</h1>
          <p class="subtitle">
            Cockpit desktop de Fusion pour suivre l'etat du backend, voir si Telegram
            est pret, et piloter les flux avant de brancher Railway ou une APK.
          </p>
          <div class="hero-meta">
            <span class="chip" id="hero-health">API: chargement...</span>
            <span class="chip" id="hero-telegram">Telegram: chargement...</span>
            <span class="chip" id="hero-refresh">Sync: en attente...</span>
          </div>
        </article>

        <aside class="panel hero-side">
          <div class="status-card">
            <div class="status-label">Etat Telegram</div>
            <div class="status-value" id="telegram-state">Inconnu</div>
            <div class="status-hint" id="telegram-hint">
              Verification de la configuration du bot en cours.
            </div>
          </div>
          <div class="status-card">
            <div class="status-label">Acces rapide</div>
            <div class="status-hint">
              Route dashboard: <span class="mono">/dashboard</span><br />
              API sante: <span class="mono">/health</span><br />
              Vue donnees: <span class="mono">/api/dashboard/overview</span>
            </div>
          </div>
        </aside>
      </section>

      <main class="grid">
        <section class="kpi-strip">
          <article class="panel kpi">
            <div class="kpi-title">Inbox totale</div>
            <div class="kpi-value" id="kpi-inbox">-</div>
            <div class="kpi-note" id="kpi-inbox-note">Chargement...</div>
          </article>
          <article class="panel kpi">
            <div class="kpi-title">Projets</div>
            <div class="kpi-value" id="kpi-projects">-</div>
            <div class="kpi-note" id="kpi-projects-note">Chargement...</div>
          </article>
          <article class="panel kpi">
            <div class="kpi-title">Taches</div>
            <div class="kpi-value" id="kpi-tasks">-</div>
            <div class="kpi-note" id="kpi-tasks-note">Chargement...</div>
          </article>
          <article class="panel kpi">
            <div class="kpi-title">Modules</div>
            <div class="kpi-value" id="kpi-modules">-</div>
            <div class="kpi-note" id="kpi-modules-note">Chargement...</div>
          </article>
        </section>

        <section class="panel section span-7">
          <div class="section-head">
            <div>
              <h2 class="section-title">Recent inbox</h2>
              <div class="section-subtitle">Derniers messages captures et leur classement.</div>
            </div>
            <button class="button" id="refresh-button" type="button">Rafraichir</button>
          </div>
          <div id="inbox-content"></div>
        </section>

        <section class="panel section span-5">
          <div class="section-head">
            <div>
              <h2 class="section-title">Telegram readiness</h2>
              <div class="section-subtitle">Ce qu'il manque pour rendre le bot operationnel.</div>
            </div>
          </div>
          <div class="stack" id="telegram-readiness"></div>
        </section>

        <section class="panel section span-4">
          <div class="section-head">
            <div>
              <h2 class="section-title">Projets</h2>
              <div class="section-subtitle">Vue rapide du portefeuille actif.</div>
            </div>
          </div>
          <div class="stack" id="projects-content"></div>
        </section>

        <section class="panel section span-4">
          <div class="section-head">
            <div>
              <h2 class="section-title">Taches</h2>
              <div class="section-subtitle">Les cartes qui demandent de l'attention.</div>
            </div>
          </div>
          <div class="stack" id="tasks-content"></div>
        </section>

        <section class="panel section span-4">
          <div class="section-head">
            <div>
              <h2 class="section-title">Modules Fusion</h2>
              <div class="section-subtitle">Ce qui est actif et ce qui attend la suite.</div>
            </div>
          </div>
          <div class="module-grid" id="modules-content"></div>
        </section>
      </main>

      <div class="footer-note" id="footer-note">Derniere synchro en attente...</div>
    </div>

    <script>
      const statusClass = {
        active: "ok",
        ok: "ok",
        todo: "warn",
        next: "warn",
        in_progress: "warn",
        completed: "ok",
        done: "ok",
        cancelled: "off",
        on_hold: "warn",
        captured: "warn",
        processed: "ok",
        archived: "off",
        deleted: "off",
        configured: "ok",
        missing: "off"
      };

      function escapeHtml(value) {
        return String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function formatDate(value) {
        if (!value) {
          return "-";
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return "-";
        }

        return new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "short",
          timeStyle: "short"
        }).format(date);
      }

      function renderPill(label, rawStatus) {
        const css = statusClass[rawStatus] || "warn";
        return '<span class="pill ' + css + '">' + escapeHtml(label) + "</span>";
      }

      function mountInbox(items) {
        const root = document.getElementById("inbox-content");
        if (!items.length) {
          root.innerHTML = '<div class="empty">Aucune inbox capturee pour le moment.</div>';
          return;
        }

        const rows = items.map((item) => {
          const bucket = item.gtdBucket || "en attente";
          const reason = item.classificationReason || "Pas encore classe";
          return "<tr>" +
            "<td><div class='mono'>" + escapeHtml(item.id.slice(0, 8)) + "</div></td>" +
            "<td>" + escapeHtml(item.source) + "</td>" +
            "<td>" + escapeHtml(item.content) + "</td>" +
            "<td>" + renderPill(bucket, item.status === "processed" ? "ok" : item.status) + "</td>" +
            "<td>" + escapeHtml(reason) + "</td>" +
            "<td>" + formatDate(item.createdAt) + "</td>" +
          "</tr>";
        }).join("");

        root.innerHTML =
          "<table>" +
            "<thead><tr><th>ID</th><th>Source</th><th>Contenu</th><th>Classement</th><th>Raison</th><th>Cree le</th></tr></thead>" +
            "<tbody>" + rows + "</tbody>" +
          "</table>";
      }

      function mountProjects(items) {
        const root = document.getElementById("projects-content");
        if (!items.length) {
          root.innerHTML = '<div class="empty">Aucun projet cree pour le moment.</div>';
          return;
        }

        root.innerHTML = items.map((item) => {
          return "<article class='item-card'>" +
            "<div class='item-title'>" + escapeHtml(item.title) + "</div>" +
            "<div class='item-meta'>" + renderPill(item.status, item.status) + " Mis a jour le " + formatDate(item.updatedAt) + "</div>" +
            (item.description ? "<div class='item-meta'>" + escapeHtml(item.description) + "</div>" : "") +
          "</article>";
        }).join("");
      }

      function mountTasks(items) {
        const root = document.getElementById("tasks-content");
        if (!items.length) {
          root.innerHTML = '<div class="empty">Aucune tache visible pour le moment.</div>';
          return;
        }

        root.innerHTML = items.map((item) => {
          const dueDate = item.dueDate ? " Echeance " + escapeHtml(item.dueDate) : "";
          return "<article class='item-card'>" +
            "<div class='item-title'>" + escapeHtml(item.title) + "</div>" +
            "<div class='item-meta'>" + renderPill(item.status, item.status) + " Priorite " + escapeHtml(item.priority) + dueDate + "</div>" +
            (item.notes ? "<div class='item-meta'>" + escapeHtml(item.notes) + "</div>" : "") +
          "</article>";
        }).join("");
      }

      function mountModules(items) {
        const root = document.getElementById("modules-content");
        if (!items.length) {
          root.innerHTML = '<div class="empty">Aucun module declare.</div>';
          return;
        }

        root.innerHTML = items.map((item) => {
          const state = item.status === "mvp" ? "ok" : "warn";
          return "<article class='module-card'>" +
            "<div class='item-title'>" + escapeHtml(item.label) + "</div>" +
            "<div class='item-meta'>" + renderPill(item.status, state) + "</div>" +
            "<div class='item-meta'>" + escapeHtml(item.description) + "</div>" +
          "</article>";
        }).join("");
      }

      function mountTelegramChecklist(telegram) {
        const root = document.getElementById("telegram-readiness");
        const items = [];

        items.push({
          label: "Token bot Telegram",
          state: telegram.configured ? "configured" : "missing",
          hint: telegram.configured
            ? "Le token est configure dans l'environnement."
            : "Il faut renseigner TELEGRAM_BOT_TOKEN dans .env."
        });

        items.push({
          label: "Chat autorise",
          state: telegram.allowedChatIdsCount > 0 ? "configured" : "warn",
          hint: telegram.allowedChatIdsCount > 0
            ? "Liste autorisee configuree (" + telegram.allowedChatIdsCount + ")."
            : "Aucune restriction de chat. C'est pratique en local, mais a cadrer avant ouverture."
        });

        items.push({
          label: "Traitement automatique",
          state: telegram.autoProcess ? "configured" : "warn",
          hint: telegram.autoProcess
            ? "Les messages sont captures puis traites automatiquement."
            : "Les messages seront seulement captures tant que TELEGRAM_AUTO_PROCESS=false."
        });

        items.push({
          label: "Webhook public n8n",
          state: "missing",
          hint: "Non necessaire aujourd'hui si on passe par le bot Fusion en polling. A prevoir seulement pour un flux Telegram direct vers n8n."
        });

        root.innerHTML = items.map((item) => {
          return "<article class='item-card'>" +
            "<div class='item-title'>" + escapeHtml(item.label) + " " + renderPill(item.state, item.state) + "</div>" +
            "<div class='item-meta'>" + escapeHtml(item.hint) + "</div>" +
          "</article>";
        }).join("");
      }

      function applyOverview(data) {
        document.getElementById("hero-health").textContent =
          "API: " + (data.health.status === "ok" ? "en ligne" : "alerte");
        document.getElementById("hero-telegram").textContent =
          "Telegram: " + (data.telegram.configured ? "pret a brancher" : "token manquant");
        document.getElementById("hero-refresh").textContent =
          "Sync: " + formatDate(data.generatedAt);

        document.getElementById("telegram-state").textContent =
          data.telegram.configured ? "Bot configurable aujourd'hui" : "Configuration a terminer";
        document.getElementById("telegram-hint").textContent =
          data.telegram.configured
            ? "Le backend sait deja ecouter Telegram. Il reste a brancher le token et tester le premier message."
            : "Le code Telegram existe deja. La prochaine etape pratique est de creer le bot via BotFather et de poser le token.";

        document.getElementById("kpi-inbox").textContent = String(data.counts.inbox.total);
        document.getElementById("kpi-projects").textContent = String(data.counts.projects.total);
        document.getElementById("kpi-tasks").textContent = String(data.counts.tasks.total);
        document.getElementById("kpi-modules").textContent = String(data.modules.length);

        document.getElementById("kpi-inbox-note").textContent =
          data.counts.inbox.processed + " traitees, " + data.counts.inbox.captured + " en attente";
        document.getElementById("kpi-projects-note").textContent =
          data.counts.projects.active + " actifs, " + data.counts.projects.completed + " termines";
        document.getElementById("kpi-tasks-note").textContent =
          data.counts.tasks.next + " next, " + data.counts.tasks.inProgress + " en cours";
        document.getElementById("kpi-modules-note").textContent =
          data.modules.filter((item) => item.status === "mvp").length + " modules MVP";

        mountInbox(data.recentInbox);
        mountProjects(data.recentProjects);
        mountTasks(data.recentTasks);
        mountModules(data.modules);
        mountTelegramChecklist(data.telegram);

        document.getElementById("footer-note").textContent =
          "Derniere synchro: " + formatDate(data.generatedAt) + " | Route: /api/dashboard/overview";
      }

      async function loadOverview() {
        const response = await fetch("/api/dashboard/overview", {
          headers: { "accept": "application/json" }
        });

        if (!response.ok) {
          throw new Error("Impossible de charger le dashboard");
        }

        const data = await response.json();
        applyOverview(data);
      }

      async function refresh() {
        const button = document.getElementById("refresh-button");
        button.disabled = true;
        button.textContent = "Sync...";
        try {
          await loadOverview();
        } catch (error) {
          document.getElementById("footer-note").textContent =
            "Erreur dashboard: " + (error instanceof Error ? error.message : "inconnue");
        } finally {
          button.disabled = false;
          button.textContent = "Rafraichir";
        }
      }

      document.getElementById("refresh-button").addEventListener("click", refresh);

      void refresh();
      window.setInterval(() => {
        void loadOverview().catch(() => {});
      }, 15000);
    </script>
  </body>
</html>`;
}
