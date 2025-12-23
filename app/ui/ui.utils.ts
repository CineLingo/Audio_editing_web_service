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

/**
 * 최장 공통 부분 수열(LCS) 알고리즘을 응용하여 
 * 새로운 텍스트 배열과 원본 Whisper 단어 배열 사이의 최적 매칭을 찾습니다.
 */
export function updateTokensWithLCS(
  newText: string,
  whisperWords: WhisperWord[]
): TranscriptToken[] {
  const newWords = newText === '' ? [] : newText.split(' ');
  const n = newWords.length;
  const m = whisperWords.length;

  // DP 테이블 생성
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

  // 역추적을 통한 토큰 생성
  const result: TranscriptToken[] = [];
  let i = n, j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && newWords[i - 1] === whisperWords[j - 1].word) {
      // 1. 원본과 정확히 일치하는 단어 (Keep)
      result.unshift({
        id: crypto.randomUUID(),
        text: newWords[i - 1],
        sourceWordIds: [whisperWords[j - 1].id],
        isEdited: false,
      });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // 2. 원본 단어가 삭제됨 (Skip)
      j--;
    } else {
      // 3. 새로운 단어가 삽입되거나 수정됨 (Insert/Edit)
      // 이 경우 가장 가까운 원본 단어의 ID를 추측하여 연결할 수도 있으나, 
      // 안전하게 sourceWordIds를 빈 상태로 두어 '수정 영역'으로 판단하게 합니다.
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

/**
 * 수정된 토큰 배열을 분석하여 원본 WhisperWord 리스트에서 '비어있는 시간 구간'을 찾아
 * 자동으로 Selection 영역을 생성합니다.
 */
export function getAutoSelectionsFromDiff(
  currentTokens: TranscriptToken[],
  whisperWords: WhisperWord[]
): Selection[] {
  const autoSelections: Selection[] = [];
  
  // 원본 단어 중 현재 어떤 단어들이 사용(Keep)되고 있는지 확인
  const usedWhisperIds = new Set(currentTokens.flatMap(t => t.sourceWordIds));
  
  // 사용되지 않은 원본 단어들을 연속된 그룹으로 묶음
  let currentGroup: WhisperWord[] = [];

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    const startTime = currentGroup[0].start;
    const endTime = currentGroup[currentGroup.length - 1].end;
    
    autoSelections.push({
      id: `auto-${startTime.toFixed(3)}-${endTime.toFixed(3)}`,
      absStart: startTime,
      absEnd: endTime,
      durationDelta: 0,
      tokenIds: [], // 자동 생성 영역은 특정 토큰에 귀속되지 않고 시간 영역에 귀속
      isActive: true,
    });
    currentGroup = [];
  };

  whisperWords.forEach((word) => {
    if (!usedWhisperIds.has(word.id)) {
      // 이 단어는 삭제되거나 수정되어 현재 텍스트에 없음 -> 편집 영역에 포함
      currentGroup.push(word);
    } else {
      // 이 단어는 그대로 유지됨 -> 이전까지의 그룹을 끊고 Selection 생성
      flushGroup();
    }
  });
  flushGroup();

  return autoSelections;
}