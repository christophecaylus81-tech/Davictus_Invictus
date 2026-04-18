import type { GtdClassification } from "./types";

const ACTION_VERBS = [
  "appeler",
  "envoyer",
  "ecrire",
  "écrire",
  "lire",
  "planifier",
  "organiser",
  "reserver",
  "réserver",
  "acheter",
  "payer",
  "corriger",
  "publier",
  "rédiger",
  "rediger",
  "valider",
  "fixer",
  "preparer",
  "préparer",
  "mettre",
  "finir",
  "mettre a jour",
  "mettre à jour"
] as const;

const PROJECT_HINTS = [
  "projet",
  "roadmap",
  "plan d action",
  "plan d'action",
  "multi-etape",
  "multi étape",
  "plusieurs etapes",
  "plusieurs étapes",
  "phase 1",
  "phase 2",
  "milestone",
  "lancer"
] as const;

const INCUBATOR_HINTS = [
  "idee",
  "idée",
  "inspiration",
  "plus tard",
  "a creuser",
  "à creuser",
  "someday",
  "incubateur"
] as const;

const ARCHIVE_HINTS = [
  "reference",
  "référence",
  "documentation",
  "article",
  "note utile",
  "a conserver",
  "à conserver",
  "archive"
] as const;

const TRASH_EXACT = new Set(["ok", "merci", "test", "lol", "mdr", "yes", "nope", "ras"]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max = 80): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) {
    return cleaned;
  }
  return `${cleaned.slice(0, max - 1)}...`;
}

function countMatches(normalized: string, words: readonly string[]): number {
  return words.filter((word) => normalized.includes(word)).length;
}

function countNumberedSteps(content: string): number {
  const matches = content.match(/\b\d+\s*[\.\)]\s+/g);
  return matches ? matches.length : 0;
}

function countBulletSteps(content: string): number {
  const lines = content.split("\n");
  return lines.filter((line) => /^\s*[-*]\s+/.test(line)).length;
}

function inferTaskTitle(content: string): string {
  const firstLine = content.split("\n")[0] ?? content;
  return truncate(firstLine);
}

export class GtdClassifier {
  classify(rawContent: string): GtdClassification {
    const content = rawContent.trim();
    const normalized = normalize(content);

    if (normalized.length < 3 || TRASH_EXACT.has(normalized)) {
      return {
        bucket: "trash",
        reason: "Message trop court ou sans valeur opérationnelle.",
        confidence: 0.95,
        suggestedTitle: "Bruit à ignorer"
      };
    }

    const numberedSteps = countNumberedSteps(content);
    const bulletSteps = countBulletSteps(content);
    const actionVerbMatches = countMatches(normalized, ACTION_VERBS);
    const projectHintMatches = countMatches(normalized, PROJECT_HINTS);
    const incubatorHintMatches = countMatches(normalized, INCUBATOR_HINTS);
    const archiveHintMatches = countMatches(normalized, ARCHIVE_HINTS);
    const hasSequencingHints =
      normalized.includes(" puis ") ||
      normalized.includes(" ensuite ") ||
      normalized.includes(" apres ") ||
      normalized.includes("après") ||
      normalized.includes(" et ");

    if (
      incubatorHintMatches > 0 &&
      numberedSteps === 0 &&
      bulletSteps === 0 &&
      actionVerbMatches <= 1
    ) {
      return {
        bucket: "incubator",
        reason: "Idée utile non actionnable immédiatement.",
        confidence: 0.8,
        suggestedTitle: truncate(inferTaskTitle(content))
      };
    }

    if (
      projectHintMatches > 0 ||
      numberedSteps >= 2 ||
      bulletSteps >= 2 ||
      (actionVerbMatches >= 2 && hasSequencingHints)
    ) {
      const projectTitle = inferTaskTitle(content).replace(/^projet\s*[:\-]?\s*/i, "").trim();
      return {
        bucket: "project",
        reason: "Demande multi-étapes détectée, convertie en projet.",
        confidence: 0.82,
        suggestedTitle: truncate(projectTitle || "Nouveau projet Fusion"),
        suggestedTaskTitle: "Définir la prochaine action concrète"
      };
    }

    if (archiveHintMatches > 0) {
      return {
        bucket: "archive",
        reason: "Information utile à conserver sans action immédiate.",
        confidence: 0.8,
        suggestedTitle: truncate(inferTaskTitle(content))
      };
    }

    return {
      bucket: "task",
      reason: "Action unique détectée, conversion en tâche.",
      confidence: actionVerbMatches > 0 ? 0.85 : 0.65,
      suggestedTitle: inferTaskTitle(content)
    };
  }
}
