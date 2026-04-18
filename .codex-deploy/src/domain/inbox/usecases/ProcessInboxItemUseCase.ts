import { AiRouter } from "../../../integrations/ai-router/AiRouter";
import type { LlmRequest, RoutingDecision } from "../../../integrations/ai-router/types";
import { GtdClassifier } from "../../gtd/GtdClassifier";
import type { GtdClassification } from "../../gtd/types";
import type { ProcessingLogRepository } from "../../logs/repositories";
import type {
  InboxProcessingGateway,
  InboxProcessingResult,
  InboxRepository
} from "../repositories";
import type { InboxItem } from "../types";

export interface ProcessInboxItemResult extends InboxProcessingResult {
  classification: GtdClassification;
}

export interface AiEnrichmentResult {
  classification: GtdClassification;
  routing: RoutingDecision;
}

export interface ProcessInboxItemDependencies {
  inboxRepository: InboxRepository;
  processingGateway: InboxProcessingGateway;
  processingLogRepository: ProcessingLogRepository;
  classifier?: GtdClassifier;
  aiRouter?: AiRouter;
}

const AI_ENRICHMENT_THRESHOLD = 0.7;

export class ProcessInboxItemUseCase {
  private readonly classifier: GtdClassifier;
  private readonly aiRouter?: AiRouter | undefined;

  constructor(private readonly deps: ProcessInboxItemDependencies) {
    this.classifier = deps.classifier ?? new GtdClassifier();
    this.aiRouter = deps.aiRouter;
  }

  async execute(inboxItemId: string): Promise<ProcessInboxItemResult> {
    const item = await this.loadItem(inboxItemId);
    let classification = this.classifier.classify(item.content);
    let aiEnrichmentResult: AiEnrichmentResult | null = null;

    // Enrichissement IA si confidence faible et aiRouter disponible
    if (
      classification.confidence < AI_ENRICHMENT_THRESHOLD &&
      this.aiRouter
    ) {
      try {
        aiEnrichmentResult = await this.enrichWithAi(item.content, classification);
        classification = aiEnrichmentResult.classification;
      } catch (error) {
        await this.deps.processingLogRepository.append({
          inboxItemId: item.id,
          stage: "ai_routing",
          message: `Enrichissement IA indisponible, fallback heuristique: ${error instanceof Error ? error.message : "erreur inconnue"}`
        });
      }
    }

    // Log de la classification finale
    await this.deps.processingLogRepository.append({
      inboxItemId: item.id,
      stage: "classification",
      message: `${classification.bucket} (${classification.confidence.toFixed(2)}) - ${classification.reason}${classification.aiEnriched ? " [IA]" : ""}`
    });

    // Log de la décision de routage IA si applicable
    if (aiEnrichmentResult) {
      const { routing } = aiEnrichmentResult;
      await this.deps.processingLogRepository.append({
        inboxItemId: item.id,
        stage: "ai_routing",
        message: `Routé vers ${routing.target} (complexité: ${routing.complexity.level}, score: ${routing.complexity.score.toFixed(2)})${routing.fallback ? ` | Fallback: ${routing.fallback}` : ""}`
      });
    }

    const result = await this.deps.processingGateway.processClassification({
      item,
      classification
    });

    await this.deps.processingLogRepository.append({
      inboxItemId: item.id,
      stage: "finalized",
      message: `Inbox traité en ${result.bucket}`
    });

    return {
      ...result,
      classification
    };
  }

  private async enrichWithAi(
    content: string,
    currentClassification: GtdClassification
  ): Promise<AiEnrichmentResult> {
    const request: LlmRequest = {
      messages: [
        {
          role: "system",
          content: `Tu es un assistant GTD expert. Ta mission est de classifier des messages entrants selon la méthodologie GTD.

Les buckets possibles sont :
- task : action unique et concrète à effectuer
- project : demande multi-étapes nécessitant la création d'un projet
- incubator : idée ou inspiration à explorer plus tard
- archive : information utile à conserver comme référence
- trash : message sans valeur opérationnelle (bruit, salutations, etc.)

Réponds UNIQUEMENT au format JSON avec cette structure exacte :
{"bucket": "<bucket>", "title": "<titre suggéré>", "reason": "<raison courte>", "confidence": <0.0-1.0>}`
        },
        {
          role: "user",
          content: `Classifie ce message. Classification heuristique actuelle : ${currentClassification.bucket} (confiance: ${currentClassification.confidence.toFixed(2)}, raison: ${currentClassification.reason}).

Message à classifier : "${content}"

Si tu confirmes le bucket actuel, retourne-le avec un titre amélioré si possible. Sinon, corrige le bucket et le titre.`
        }
      ],
      maxTokens: 256,
      temperature: 0.1
    };

    const response = await this.aiRouter!.complete(content, request, currentClassification);
    const aiContent = response.content.trim();

    try {
      // Extraire le JSON du contenu (l'IA peut ajouter du texte avant/après)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Réponse IA non JSON");
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        bucket: GtdClassification["bucket"];
        title: string;
        reason: string;
        confidence: number;
      };

      const validBuckets: GtdClassification["bucket"][] = [
        "task",
        "project",
        "incubator",
        "archive",
        "trash"
      ];

      if (!validBuckets.includes(parsed.bucket)) {
        throw new Error(`Bucket IA invalide : ${parsed.bucket}`);
      }

      const enrichedClassification: GtdClassification = {
        bucket: parsed.bucket,
        reason: parsed.reason || `Classification IA confirmée (modèle: ${response.model})`,
        confidence: parsed.confidence ?? Math.max(currentClassification.confidence, 0.75),
        suggestedTitle: parsed.title || currentClassification.suggestedTitle,
        suggestedTaskTitle: parsed.bucket === "project"
          ? "Définir la prochaine action concrète"
          : currentClassification.suggestedTaskTitle,
        aiEnriched: true
      };

      return {
        classification: enrichedClassification,
        routing: response.routing
      };
    } catch (err) {
      // En cas d'erreur d'analyse IA, on conserve la classification heuristique
      // On retourne quand même le routing decision pour le log
      return {
        classification: {
          ...currentClassification,
          aiEnriched: false
        },
        routing: response.routing
      };
    }
  }

  private async loadItem(inboxItemId: string): Promise<InboxItem> {
    const item = await this.deps.inboxRepository.findById(inboxItemId);
    if (!item) {
      throw new Error(`Inbox item ${inboxItemId} introuvable.`);
    }
    if (item.status !== "captured") {
      throw new Error(`Inbox item ${inboxItemId} déjà traité (${item.status}).`);
    }
    return item;
  }
}
