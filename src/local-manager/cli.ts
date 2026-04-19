import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { LocalManagerService, type LocalConversationTurn } from "./LocalManagerService";

function renderHelp(): string {
  return [
    "Commandes disponibles :",
    "- /help : afficher l'aide",
    "- /models : voir le manager et les exécuteurs disponibles",
    "- /clear : vider l'historique local de la session",
    "- /exit : quitter"
  ].join("\n");
}

async function main(): Promise<void> {
  const service = await LocalManagerService.create();
  const history: LocalConversationTurn[] = [];

  console.log("Daitivus Local Manager");
  console.log("----------------------");
  console.log(`Manager actif : ${service.getManagerModel()}`);
  console.log(`Exécuteurs : ${service.getAvailableExecutors().join(", ")}`);
  console.log(renderHelp());
  console.log("");

  const rl = createInterface({ input, output });

  try {
    while (true) {
      const raw = (await rl.question("Vous > ")).trim();
      if (!raw) {
        continue;
      }

      if (raw === "/exit" || raw === "/quit") {
        break;
      }

      if (raw === "/help") {
        console.log(renderHelp());
        console.log("");
        continue;
      }

      if (raw === "/models") {
        console.log(`Manager actif : ${service.getManagerModel()}`);
        console.log(`Exécuteurs : ${service.getAvailableExecutors().join(", ")}`);
        console.log("");
        continue;
      }

      if (raw === "/clear") {
        history.length = 0;
        console.log("Historique local effacé.");
        console.log("");
        continue;
      }

      const result = await service.handle(raw, history);
      history.push({ role: "user", content: raw });
      history.push({
        role: "assistant",
        content: `(${result.executor}) ${result.output}`
      });

      if (history.length > 12) {
        history.splice(0, history.length - 12);
      }

      console.log(`Manager > ${result.acknowledgment}`);
      console.log(`Routage > ${result.executor} | ${result.why}`);
      if (result.executorModel) {
        console.log(`Modèle > ${result.executorModel}`);
      }
      console.log("");
      console.log(result.output);

      if (result.handoffPath) {
        console.log("");
        console.log(`Handoff Codex : ${result.handoffPath}`);
      }

      console.log("");
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Daitivus Local Manager a échoué : ${message}`);
  process.exit(1);
});
