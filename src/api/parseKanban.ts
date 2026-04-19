export interface KanbanCard {
  id?: string;
  title: string;
  assignee?: string;
  status?: string;
  note?: string;
}

export interface KanbanBoard {
  todo: KanbanCard[];
  inProgress: KanbanCard[];
  review: KanbanCard[];
  validated: KanbanCard[];
  rejected: KanbanCard[];
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function normalizeHeader(raw: string): keyof KanbanBoard | null {
  const value = normalizeText(raw);

  if (value.includes("a faire")) return "todo";
  if (value.includes("en cours")) return "inProgress";
  if (value.includes("review")) return "review";
  if (value.includes("valid")) return "validated";
  if (value.includes("rejet")) return "rejected";
  return null;
}

function parseTableRow(line: string): KanbanCard | null {
  const cells = line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell, index, array) => !(index === 0 && cell === "") && !(index === array.length - 1 && cell === ""));

  if (cells.length < 2) return null;
  if (cells.every((cell) => /^-+$/.test(cell.replace(/\s/g, "")))) return null;
  if (normalizeText(cells[0] ?? "") === "id") return null;

  const card: KanbanCard = {
    title: cells[1] || "Sans titre"
  };

  if (cells[0]) {
    card.id = cells[0];
  }

  if (cells[2]) {
    card.assignee = cells[2];
  }

  if (cells[3]) {
    card.note = cells[3];
  }

  return card;
}

function parseBulletLine(line: string): KanbanCard | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("-")) return null;

  const content = trimmed.replace(/^-+\s*/, "").trim();
  if (!content) return null;

  return { title: content };
}

export function parseKanban(markdown: string): KanbanBoard {
  const board: KanbanBoard = {
    todo: [],
    inProgress: [],
    review: [],
    validated: [],
    rejected: []
  };

  let section: keyof KanbanBoard | null = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (line.startsWith("##")) {
      section = normalizeHeader(line.replace(/^#+\s*/, ""));
      continue;
    }

    if (!section) continue;
    if (!line.trim()) continue;
    if (normalizeText(line).includes("_aucune tache")) continue;

    const tableCard = parseTableRow(line);
    if (tableCard) {
      board[section].push(tableCard);
      continue;
    }

    const bulletCard = parseBulletLine(line);
    if (bulletCard) {
      board[section].push(bulletCard);
    }
  }

  return board;
}
