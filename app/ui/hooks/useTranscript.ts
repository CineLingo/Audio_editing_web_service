'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Selection, TranscriptToken, WhisperWord } from '../ui.types';
import { 
  getAutoSelectionsFromDiff, 
  updateTokensWithLCS, // 이전 단계에서 제안한 LCS 매칭 함수 사용 권장
  tokensToText, 
  whisperToInitialTokens 
} from '../ui.utils';

type UseTranscriptReturn = {
  tokens: TranscriptToken[];
  textValue: string;
  isProcessing: boolean;
  onTranscriptChange: (newText: string) => void;
  processAudio: (fileUrl: string, initialWords?: WhisperWord[]) => Promise<void>;
  resetTranscript: () => void;
};

function makeMockWhisperWords(): WhisperWord[] {
  const raw: Array<[string, number, number]> = [
    ['안녕하세요', 0.0, 1.0],
    ['제', 1.0, 1.2],
    ['이름은', 1.2, 2.0],
    ['챗지피티', 2.0, 2.5],
    ['입니다', 2.5, 3.0],
  ];
  return raw.map(([word, start, end], i) => ({
    id: `w${i + 1}-${Date.now()}`,
    word,
    start,
    end,
  }));
}

export function useTranscript(
  setSelections: React.Dispatch<React.SetStateAction<Selection[]>>
): UseTranscriptReturn {
  const [tokens, setTokens] = useState<TranscriptToken[]>([]);
  const [whisperWords, setWhisperWords] = useState<WhisperWord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const textValue = useMemo(() => tokensToText(tokens), [tokens]);

  const processAudio = useCallback(async (fileUrl: string, initialWords?: WhisperWord[]) => {
    setIsProcessing(true);
    
    if (initialWords) {
      // API 결과로 새로운 단어 정보가 들어온 경우
      setWhisperWords(initialWords);
      setTokens(whisperToInitialTokens(initialWords));
    } else {
      // 초기 로드 시뮬레이션
      await new Promise((resolve) => setTimeout(resolve, 800));
      const mockWords = makeMockWhisperWords();
      setWhisperWords(mockWords);
      setTokens(whisperToInitialTokens(mockWords));
    }
    
    setIsProcessing(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTokens([]);
    setWhisperWords([]);
  }, []);

  const onTranscriptChange = useCallback(
    (newText: string) => {
      // 1. LCS를 통한 정밀 매칭 (인덱스 밀림 방지)
      const nextTokens = updateTokensWithLCS(newText, whisperWords);
      setTokens(nextTokens);
      
      // 2. 변경된 모든 구간 자동 추출
      const allAutoSelections = getAutoSelectionsFromDiff(nextTokens, whisperWords);
      
      setSelections((prev) => {
        const manualOnes = prev.filter(s => !s.id.startsWith('auto-'));
        return [...manualOnes, ...allAutoSelections];
      });
    },
    [tokens, whisperWords, setSelections]
  );

  return { tokens, textValue, isProcessing, onTranscriptChange, processAudio, resetTranscript };
}