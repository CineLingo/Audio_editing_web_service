import type { WhisperWord, TranscriptToken, Selection } from './ui.types';

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

export async function getWaveformData(audioUrl: string, samples: number = 1000): Promise<number[]> {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const rawData = audioBuffer.getChannelData(0); // 첫 번째 채널 사용
  const blockSize = Math.floor(rawData.length / samples);
  const filteredData = [];

  for (let i = 0; i < samples; i++) {
    let blockStart = blockSize * i;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum = sum + Math.abs(rawData[blockStart + j]);
    }
    filteredData.push(sum / blockSize); // 평균 진폭
  }
  return filteredData;
}