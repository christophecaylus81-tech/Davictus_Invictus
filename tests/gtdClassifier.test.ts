import { describe, expect, it } from "vitest";
import { GtdClassifier } from "../src/domain/gtd/GtdClassifier";

describe("GtdClassifier", () => {
  const classifier = new GtdClassifier();

  it("classe une action simple en tâche", () => {
    const result = classifier.classify("Appeler le notaire demain matin");
    expect(result.bucket).toBe("task");
  });

  it("classe une demande multi-étapes en projet", () => {
    const result = classifier.classify(
      "Projet lancement offre: 1. analyser le marché 2. rédiger la proposition 3. préparer le pricing"
    );
    expect(result.bucket).toBe("project");
    expect(result.suggestedTaskTitle).toBeTruthy();
  });

  it("classe une idée non actionnable en incubateur", () => {
    const result = classifier.classify("Idée: creuser une offre premium plus tard");
    expect(result.bucket).toBe("incubator");
  });

  it("classe un bruit évident en suppression logique", () => {
    const result = classifier.classify("ok");
    expect(result.bucket).toBe("trash");
  });
});
