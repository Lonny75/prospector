/**
 * Garde-fou anti-hallucination principal du débrief : vérifie qu'un verbatim cité par Claude
 * correspond réellement à un tour du transcript (voir docs/plan.md, section "Moteur de débrief").
 */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) {
    set.add(text.slice(i, i + 2));
  }
  return set;
}

/** Coefficient de Dice sur les bigrammes — mesure de similarité simple, sans dépendance externe. */
function diceSimilarity(a: string, b: string): number {
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.size === 0 || bigramsB.size === 0) return a === b ? 1 : 0;

  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

const SIMILARITY_THRESHOLD = 0.9;

export interface VerbatimCheckInput {
  transcriptTurnIndex: number;
  quoteText: string;
}

export interface TranscriptTurnLookup {
  turnIndex: number;
  text: string;
}

export interface VerbatimCheckResult {
  valid: boolean;
  reason?: string;
}

export function verifyVerbatim(
  verbatim: VerbatimCheckInput,
  turns: TranscriptTurnLookup[],
): VerbatimCheckResult {
  const turn = turns.find((t) => t.turnIndex === verbatim.transcriptTurnIndex);
  if (!turn) {
    return { valid: false, reason: `Aucun tour avec turnIndex=${verbatim.transcriptTurnIndex}` };
  }

  const similarity = diceSimilarity(normalize(verbatim.quoteText), normalize(turn.text));
  if (similarity < SIMILARITY_THRESHOLD) {
    return {
      valid: false,
      reason: `Citation "${verbatim.quoteText}" ne correspond pas au tour réel (similarité ${similarity.toFixed(2)})`,
    };
  }

  return { valid: true };
}

export function verifyAllVerbatims(
  verbatims: VerbatimCheckInput[],
  turns: TranscriptTurnLookup[],
): { allValid: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const verbatim of verbatims) {
    const result = verifyVerbatim(verbatim, turns);
    if (!result.valid && result.reason) failures.push(result.reason);
  }
  return { allValid: failures.length === 0, failures };
}
