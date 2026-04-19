import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ClaudeAdapter } from "../integrations/ai-router/adapters/ClaudeAdapter";
import { DeepSeekAdapter } from "../integrations/ai-router/adapters/DeepSeekAdapter";
import { GeminiAdapter } from "../integrations/ai-router/adapters/GeminiAdapter";
import { OllamaLlmAdapter } from "../integrations/ai-router/adapters/OllamaLlmAdapter";
import { OpenAiAdapter } from "../integrations/ai-router/adapters/OpenAiAdapter";
import { QwenAdapter } from "../integrations/ai-router/adapters/QwenAdapter";
import type { LlmAdapter } from "../integrations/ai-router/types";
import { localManagerConfig, type LocalManagerConfig } from "./config";

type ManagerProvider = "ollama" | "deepseek" | "qwen" | "openai" | "gemini" | "claude";
type Executor = "direct" | "codex" | "ollama" | "deepseek" | "qwen" | "gemini" | "claude";
type AdapterExecutor = Exclude<Executor, "direct" | "codex">;

export interface LocalConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LocalManagerResult {
  acknowledgment: string;
  executor: Executor;
  why: string;
  output: string;
  managerModel: string;
  executorModel?: string | undefined;
  handoffPath?: string | undefined;
}

interface ManagerDecision {
  acknowledgment: string;
  executor: Executor;
  task: string;
  why: string;
}

function normalizeExecutor(value: string | undefined): Executor {
  switch (value) {
    case "codex":
    case "ollama":
    case "deepseek":
    case "qwen":
    case "gemini":
    case "claude":
    case "direct":
      return value;
    default:
      return "direct";
  }
}

function parseDecision(raw: string): ManagerDecision {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      acknowledgment: raw.trim() || "Je te réponds directement.",
      executor: "direct",
      task: "",
      why: "Le manager n'a pas produit de JSON valide."
    };
  }

  try {
    const parsed = JSON.parse(match[0]) as Partial<ManagerDecision>;
    return {
      acknowledgment: parsed.acknowledgment?.trim() || "Je prends la main.",
      executor: normalizeExecutor(parsed.executor),
      task: parsed.task?.trim() ?? "",
      why: parsed.why?.trim() || "Aucune justification fournie."
    };
  } catch {
    return {
      acknowledgment: raw.trim() || "Je te réponds directement.",
      executor: "direct",
      task: "",
      why: "Le manager n'a pas produit de JSON exploitable."
    };
  }
}

function clip(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function timestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
}

export class LocalManagerService {
  private constructor(
    private readonly config: LocalManagerConfig,
    private readonly managerAdapter: LlmAdapter,
    private readonly executorAdapters: Partial<Record<AdapterExecutor, LlmAdapter>>
  ) {}

  static async create(config: LocalManagerConfig = localManagerConfig): Promise<LocalManagerService> {
    const managerCandidates = LocalManagerService.buildManagerCandidates(config);
    const availableManagers = await LocalManagerService.filterAvailable(managerCandidates);

    if (availableManagers.length === 0) {
      throw new Error(
        "Aucun manager IA disponible. Configure une clé DeepSeek, Qwen, OpenAI, Gemini, Claude ou lance Ollama localement."
      );
    }

    const preferredProvider = config.managerProvider;
    const selectedManager =
      (preferredProvider
        ? availableManagers.find((candidate) => candidate.provider === preferredProvider)
        : undefined) ?? availableManagers[0];

    if (!selectedManager) {
      throw new Error("Impossible de sélectionner un manager IA.");
    }

    const executorCandidates = LocalManagerService.buildExecutorCandidates(config);
    const availableExecutors = await LocalManagerService.filterAvailable(executorCandidates);

    const executorMap = availableExecutors.reduce<Partial<Record<AdapterExecutor, LlmAdapter>>>(
      (acc, candidate) => {
        acc[candidate.executor] = candidate.adapter;
        return acc;
      },
      {}
    );

    return new LocalManagerService(config, selectedManager.adapter, executorMap);
  }

  getManagerModel(): string {
    return this.managerAdapter.name;
  }

  getAvailableExecutors(): Executor[] {
    const dynamicExecutors = (Object.keys(this.executorAdapters) as AdapterExecutor[]).sort();
    return ["direct", "codex", ...dynamicExecutors];
  }

  async handle(input: string, history: LocalConversationTurn[]): Promise<LocalManagerResult> {
    const decision = await this.decide(input, history);

    if (decision.executor === "direct" || decision.task.length === 0) {
      return {
        acknowledgment: decision.acknowledgment,
        executor: "direct",
        why: decision.why,
        output: decision.acknowledgment,
        managerModel: this.managerAdapter.name
      };
    }

    if (decision.executor === "codex") {
      const handoffPath = await this.writeCodexHandoff(input, history, decision);
      return {
        acknowledgment: decision.acknowledgment,
        executor: "codex",
        why: decision.why,
        output: "Tâche préparée pour Codex. Ouvre le fichier de handoff dans VS Code et donne-le à Codex.",
        managerModel: this.managerAdapter.name,
        handoffPath
      };
    }

    const adapter = this.executorAdapters[decision.executor];
    if (!adapter) {
      const fallback = await this.managerAdapter.complete({
        messages: [
          {
            role: "system",
            content: "Tu es Daitivus Local. Réponds directement de façon concise, claire et utile."
          },
          {
            role: "user",
            content: decision.task
          }
        ],
        maxTokens: 1200,
        temperature: 0.3
      });

      return {
        acknowledgment: decision.acknowledgment,
        executor: "direct",
        why: `${decision.why} L'exécuteur demandé n'était pas disponible, fallback direct.`,
        output: fallback.content,
        managerModel: this.managerAdapter.name,
        executorModel: fallback.model
      };
    }

    const response = await adapter.complete({
      messages: [
        {
          role: "system",
          content: this.buildExecutorSystemPrompt(decision.executor)
        },
        {
          role: "user",
          content: decision.task
        }
      ],
      maxTokens: 2200,
      temperature: 0.3
    });

    return {
      acknowledgment: decision.acknowledgment,
      executor: decision.executor,
      why: decision.why,
      output: response.content,
      managerModel: this.managerAdapter.name,
      executorModel: response.model
    };
  }

  private async decide(input: string, history: LocalConversationTurn[]): Promise<ManagerDecision> {
    const allowedExecutors = this.getAvailableExecutors();
    const dynamicExecutorSection = allowedExecutors
      .map((executor) => `- ${executor}: ${this.describeExecutor(executor)}`)
      .join("\n");

    const historySection =
      history.length === 0
        ? "Aucun historique utile."
        : history
            .slice(-6)
            .map((turn) => `${turn.role === "user" ? "Utilisateur" : "Assistant"}: ${clip(turn.content, 500)}`)
            .join("\n");

    const managerPrompt = [
      "Tu es Daitivus Local, un manager d'IA frugal et orienté résultat.",
      "Tu dois choisir l'exécuteur le moins coûteux capable de bien faire le travail.",
      "Ne choisis jamais un exécuteur qui n'est pas listé comme disponible.",
      "Si la demande est simple, réponds en 'direct'.",
      "Si la demande implique de modifier le repo, des fichiers, des tests ou du code réel dans VS Code, choisis 'codex'.",
      "",
      "EXÉCUTEURS DISPONIBLES :",
      dynamicExecutorSection,
      "",
      "RÉPONDS EN JSON STRICT :",
      `{`,
      `  "acknowledgment": "message très bref pour l'utilisateur",`,
      `  "executor": "${allowedExecutors.join("|")}",`,
      `  "task": "instruction complète pour l'exécuteur, vide si direct",`,
      `  "why": "raison courte du choix"` ,
      `}`
    ].join("\n");

    const response = await this.managerAdapter.complete({
      messages: [
        { role: "system", content: managerPrompt },
        {
          role: "user",
          content: `Historique récent:\n${historySection}\n\nDemande actuelle:\n${input}`
        }
      ],
      maxTokens: 700,
      temperature: 0.2
    });

    const decision = parseDecision(response.content);
    if (!allowedExecutors.includes(decision.executor)) {
      return {
        acknowledgment: decision.acknowledgment,
        executor: "direct",
        task: "",
        why: `Exécuteur non autorisé (${decision.executor}), fallback direct.`
      };
    }

    return decision;
  }

  private buildExecutorSystemPrompt(executor: AdapterExecutor): string {
    switch (executor) {
      case "deepseek":
        return "Tu es DeepSeek. Analyse avec rigueur, reste concret et priorise l'efficacité.";
      case "qwen":
        return "Tu es Qwen. Réponds vite, clairement et avec une structure simple à exploiter.";
      case "gemini":
        return "Tu es Gemini. Fais des synthèses nettes, utiles et orientées action.";
      case "claude":
        return "Tu es Claude. Produit une analyse haut de gamme, structurée et fiable.";
      case "ollama":
        return "Tu es un assistant local. Reste pragmatique, sobre et orienté solution.";
      default:
        return "Tu es un assistant utile et concis.";
    }
  }

  private describeExecutor(executor: Executor): string {
    switch (executor) {
      case "direct":
        return "le manager répond lui-même";
      case "codex":
        return "prépare un handoff de code pour Codex dans VS Code";
      case "deepseek":
        return "analyse technique et stratégie à bas coût";
      case "qwen":
        return "production rapide, reformulation, structuration";
      case "gemini":
        return "synthèse, recherche, cadrage";
      case "claude":
        return "analyse haut de gamme, cas délicats";
      case "ollama":
        return "traitement local sans token cloud";
      default:
        return "exécuteur spécialisé";
    }
  }

  private async writeCodexHandoff(
    input: string,
    history: LocalConversationTurn[],
    decision: ManagerDecision
  ): Promise<string> {
    const outputDir = join(process.cwd(), this.config.codexOutputDir);
    await mkdir(outputDir, { recursive: true });

    const fileName = `${timestamp()}-${slugify(input)}.md`;
    const filePath = join(outputDir, fileName);
    const historySection =
      history.length === 0
        ? "_Aucun historique fourni._"
        : history
            .slice(-6)
            .map((turn) => `- **${turn.role === "user" ? "Utilisateur" : "Assistant"}**: ${clip(turn.content, 700)}`)
            .join("\n");

    const content = [
      "# Handoff Codex",
      "",
      "## Vision",
      "Daitivus agit comme manager d'IA local dans VS Code. Cette tâche est routée vers Codex car elle implique du vrai travail sur le repo.",
      "",
      "## Demande utilisateur",
      input,
      "",
      "## Pourquoi Codex",
      decision.why,
      "",
      "## Instruction pour Codex",
      decision.task,
      "",
      "## Historique récent",
      historySection,
      "",
      "## Attendu",
      "- Travailler directement dans le repo courant.",
      "- Rester sobre en changements.",
      "- Expliquer clairement ce qui a été modifié et ce qui reste à faire."
    ].join("\n");

    await writeFile(filePath, content, "utf8");
    return filePath;
  }

  private static buildManagerCandidates(
    config: LocalManagerConfig
  ): Array<{ provider: ManagerProvider; adapter: LlmAdapter }> {
    const candidates: Array<{ provider: ManagerProvider; adapter: LlmAdapter }> = [];

    candidates.push({
      provider: "ollama",
      adapter: new OllamaLlmAdapter(config.ollama.baseUrl, config.ollama.managerModel)
    });

    if (config.deepseek.apiKey) {
      candidates.push({
        provider: "deepseek",
        adapter: new DeepSeekAdapter(config.deepseek.apiKey, config.deepseek.baseUrl)
      });
    }

    if (config.qwen.apiKey) {
      candidates.push({
        provider: "qwen",
        adapter: new QwenAdapter(config.qwen.apiKey, config.qwen.baseUrl, config.qwen.model)
      });
    }

    if (config.openai.apiKey) {
      candidates.push({
        provider: "openai",
        adapter: new OpenAiAdapter(
          config.openai.apiKey,
          config.openai.managerModel,
          config.openai.baseUrl
        )
      });
    }

    if (config.gemini.apiKey) {
      candidates.push({
        provider: "gemini",
        adapter: new GeminiAdapter(config.gemini.apiKey, config.gemini.flashModel)
      });
    }

    if (config.claude.apiKey) {
      candidates.push({
        provider: "claude",
        adapter: new ClaudeAdapter(config.claude.apiKey)
      });
    }

    const priorityOrder: ManagerProvider[] = config.managerProvider
      ? [config.managerProvider, "ollama", "deepseek", "qwen", "openai", "gemini", "claude"]
      : ["ollama", "deepseek", "qwen", "openai", "gemini", "claude"];

    return priorityOrder
      .map((provider) => candidates.find((candidate) => candidate.provider === provider))
      .filter((candidate): candidate is { provider: ManagerProvider; adapter: LlmAdapter } => Boolean(candidate));
  }

  private static buildExecutorCandidates(
    config: LocalManagerConfig
  ): Array<{ executor: AdapterExecutor; adapter: LlmAdapter }> {
    const candidates: Array<{ executor: AdapterExecutor; adapter: LlmAdapter }> = [
      {
        executor: "ollama",
        adapter: new OllamaLlmAdapter(config.ollama.baseUrl, config.ollama.executorModel)
      }
    ];

    if (config.deepseek.apiKey) {
      candidates.push({
        executor: "deepseek",
        adapter: new DeepSeekAdapter(config.deepseek.apiKey, config.deepseek.baseUrl)
      });
    }

    if (config.qwen.apiKey) {
      candidates.push({
        executor: "qwen",
        adapter: new QwenAdapter(config.qwen.apiKey, config.qwen.baseUrl, config.qwen.model)
      });
    }

    if (config.gemini.apiKey) {
      candidates.push({
        executor: "gemini",
        adapter: new GeminiAdapter(config.gemini.apiKey, config.gemini.flashModel)
      });
    }

    if (config.claude.apiKey) {
      candidates.push({
        executor: "claude",
        adapter: new ClaudeAdapter(config.claude.apiKey)
      });
    }

    return candidates;
  }

  private static async filterAvailable<T extends { adapter: LlmAdapter }>(candidates: T[]): Promise<T[]> {
    const availability = await Promise.all(
      candidates.map(async (candidate) => ({
        candidate,
        available: await candidate.adapter.isAvailable().catch(() => false)
      }))
    );

    return availability
      .filter((entry) => entry.available)
      .map((entry) => entry.candidate);
  }
}
