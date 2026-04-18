import type { GtdBucket, GtdClassification } from "../../domain/gtd/types";
import type { ComplexityLevel, ComplexityScore } from "./types";

const CODE_SIGNALS = [
  "code", "script", "fonction", "bug", "refactor", "api", "typescript",
  "javascript", "python", "sql", "docker", "deploy", "git", "npm", "test",
  "module", "classe", "interface", "endpoint", "base de données"
];

const STRATEGIC_SIGNALS = [
  "stratégie", "strategie", "analyse", "décision", "decision", "architecture",
  "roadmap", "business model", "positionnement", "marché", "marche",
  "investissement", "priorité", "priorite", "arbitrage"
];

const COMPLEXITY_BY_BUCKET: Record<GtdBucket, number> = {
  trash: 0.0,
  archive: 0.1,
  incubator: 0.3,
  task: 0.4,
  project: 0.7
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function countSignals(normalized: string, signals: string[]): number {
  return signals.filter((s) => normalized.includes(s)).length;
}

function scoreLength(content: string): number {
  const words = content.trim().split(/\s+/).length;
  if (words < 10) return 0.0;
  if (words < 30) return 0.2;
  if (words < 80) return 0.4;
  if (words < 200) return 0.6;
  return 0.8;
}

function levelFromScore(score: number): ComplexityLevel {
  if (score < 0.2) return "trivial";
  if (score < 0.4) return "simple";
  if (score < 0.6) return "moderate";
  if (score < 0.8) return "complex";
  return "critical";
}

export class ComplexityEvaluator {
  evaluate(content: string, classification?: GtdClassification): ComplexityScore {
    const normalized = normalize(content);
    const reasons: string[] = [];
    let score = 0.0;

    // Base score from GTD bucket
    const bucketScore = classification ? COMPLEXITY_BY_BUCKET[classification.bucket] : 0.4;
    score += bucketScore * 0.4;
    if (classification) {
      reasons.push(`bucket=${classification.bucket} (×0.4)`);
    }

    // Length contribution
    const lengthScore = scoreLength(content);
    score += lengthScore * 0.2;
    if (lengthScore > 0) {
      reasons.push(`longueur=${content.split(/\s+/).length} mots (×0.2)`);
    }

    // Code signals
    const codeHits = countSignals(normalized, CODE_SIGNALS);
    if (codeHits > 0) {
      score += Math.min(codeHits * 0.08, 0.2);
      reasons.push(`code signals=${codeHits}`);
    }

    // Strategic signals
    const strategicHits = countSignals(normalized, STRATEGIC_SIGNALS);
    if (strategicHits > 0) {
      score += Math.min(strategicHits * 0.1, 0.3);
      reasons.push(`strategic signals=${strategicHits}`);
    }

    // Low confidence → more complex than heuristics could determine
    if (classification && classification.confidence < 0.7) {
      score += 0.15;
      reasons.push(`confidence faible=${classification.confidence.toFixed(2)}`);
    }

    const finalScore = Math.min(score, 1.0);

    return {
      level: levelFromScore(finalScore),
      score: parseFloat(finalScore.toFixed(3)),
      reasons
    };
  }

  isCodeTask(content: string): boolean {
    const normalized = normalize(content);
    return countSignals(normalized, CODE_SIGNALS) >= 2;
  }
}
