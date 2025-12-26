import type { WhisperWord, TranscriptToken, Selection } from './ui.types';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  const decimals = i === 0 ? 0 : value < 10 ? 2 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

export function whisperToInitialTokens(words: WhisperWord[]): TranscriptToken[] {
  return words.map((w) => ({
    id: crypto.randomUUID(),
    text: w.word,
    sourceWordIds: [w.id],
    isEdited: false,
  }));
}

export function tokensToText(tokens: TranscriptToken[]): string {
  return tokens.map((t) => t.text).join(' ');
}

export function updateTokensWithLCS(
  newText: string,
  whisperWords: WhisperWord[]
): TranscriptToken[] {
  const newWords = newText.split(/\s+/).filter(w => w.length > 0);
  const n = newWords.length;
  const m = whisperWords.length;

  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (newWords[i - 1] === whisperWords[j - 1].word) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: TranscriptToken[] = [];
  let i = n, j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && newWords[i - 1] === whisperWords[j - 1].word) {
      result.unshift({
        id: crypto.randomUUID(),
        text: newWords[i - 1],
        sourceWordIds: [whisperWords[j - 1].id],
        isEdited: false,
      });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      j--;
    } else {
      result.unshift({
        id: crypto.randomUUID(),
        text: newWords[i - 1],
        sourceWordIds: [], 
        isEdited: true,
      });
      i--;
    }
  }

  return result;
}

export function getAutoSelectionsFromDiff(
  currentTokens: TranscriptToken[],
  whisperWords: WhisperWord[],
  existingSelections: Selection[]
): Selection[] {
  const autoSelections: Selection[] = [];
  const usedWhisperIds = new Set(currentTokens.flatMap(t => t.sourceWordIds));
  let currentGroup: WhisperWord[] = [];

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    const startTime = currentGroup[0].start;
    const endTime = currentGroup[currentGroup.length - 1].end;
    const generatedId = `auto-${startTime.toFixed(3)}-${endTime.toFixed(3)}`;

    const prevMatch = existingSelections.find(s => s.id === generatedId);

    if (prevMatch) {
      autoSelections.push(prevMatch);
    } else {
      autoSelections.push({
        id: generatedId,
        absStart: startTime,
        absEnd: endTime,
        durationDelta: 0,
        tokenIds: [],
        isActive: true,
      });
    }
    currentGroup = [];
  };

  whisperWords.forEach((word) => {
    if (!usedWhisperIds.has(word.id)) {
      currentGroup.push(word);
    } else {
      flushGroup();
    }
  });
  flushGroup();

  return autoSelections;
}