'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Selection, TranscriptToken, WhisperWord } from '../ui.types';
import { 
  getAutoSelectionsFromDiff, 
  updateTokensWithLCS, 
  tokensToText, 
  whisperToInitialTokens 
} from '../ui.utils';

interface RawWhisperWord {
  text: string;
  timestamp: [number, number | null];
}

type UseTranscriptReturn = {
  tokens: TranscriptToken[];
  textValue: string;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  onTranscriptChange: (newText: string) => void;
  processAudio: (fileUrl: string, initialWords?: any[]) => Promise<void>;
  resetTranscript: () => void;
};

export function useTranscript(
  selections: Selection[],
  setSelections: React.Dispatch<React.SetStateAction<Selection[]>>
): UseTranscriptReturn {
  const [tokens, setTokens] = useState<TranscriptToken[]>([]);
  const [whisperWords, setWhisperWords] = useState<WhisperWord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const textValue = useMemo(() => tokensToText(tokens), [tokens]);

  // 오디오 파일로부터 길이를 얻는 유틸리티
  const getAudioDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => resolve(0); // 에러 시 기본값
    });
  };

  const mapRawWhisperToInternal = (rawWords: RawWhisperWord[], audioDuration: number): WhisperWord[] => {
    return rawWords.map((item, i) => {
      const [start, end] = item.timestamp;
      return {
        id: `w${i}-${Date.now()}`,
        word: item.text.trim(),
        start: start || 0,
        // null 또는 None일 경우 전달받은 audioDuration으로 처리
        end: end === null ? audioDuration : end,
      };
    });
  };

  const processAudio = useCallback(async (fileUrl: string, initialWords?: any[]) => {
    setIsProcessing(true);
    
    // 1. 오디오 실제 길이 가져오기
    const duration = await getAudioDuration(fileUrl);
    
    let formattedWords: WhisperWord[] = [];

    if (initialWords) {
      formattedWords = mapRawWhisperToInternal(initialWords, duration);
    } else {
      // 샘플 데이터 테스트 (높다 -> null 케이스 포함)
      await new Promise((resolve) => setTimeout(resolve, 800));
      const sampleRaw: RawWhisperWord[] = [
        { text: ' 수부타이,', timestamp: [0.04, 0.78] },
        { text: ' 미친놈', timestamp: [0.78, 1.44] },
        { text: ' 32개의', timestamp: [1.44, 2.7] },
        { text: ' 나라를', timestamp: [2.7, 3.0] },
        { text: ' 정복하거나', timestamp: [3.0, 3.52] },
        { text: ' 멸망시킴', timestamp: [3.52, 4.16] },
        { text: ' 서양', timestamp: [4.16, 4.64] },
        { text: ' 및', timestamp: [4.64, 4.82] },
        { text: ' 중동권은', timestamp: [4.82, 5.36] },
        { text: ' 칭기스강과', timestamp: [5.36, 5.94] },
        { text: ' 거의', timestamp: [5.94, 6.16] },
        { text: ' 동급으로', timestamp: [6.16, 6.68] },
        { text: ' 악명이', timestamp: [6.68, 7.12] },
        { text: ' 높다', timestamp: [7.12, null] },
      ];
      formattedWords = mapRawWhisperToInternal(sampleRaw, duration);
    }

    setWhisperWords(formattedWords);
    setTokens(whisperToInitialTokens(formattedWords));
    setIsProcessing(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTokens([]);
    setWhisperWords([]);
  }, []);

  const onTranscriptChange = useCallback(
    (newText: string) => {
      const nextTokens = updateTokensWithLCS(newText, whisperWords);
      setTokens(nextTokens);

      const allAutoSelections = getAutoSelectionsFromDiff(nextTokens, whisperWords, selections);
      
      setSelections((prev) => {
        const manualOnes = prev.filter(s => !s.id.startsWith('auto-'));
        return [...manualOnes, ...allAutoSelections];
      });
    },
    [whisperWords, setSelections, selections]
  );

  return { 
    tokens, textValue, isProcessing, setIsProcessing, 
    onTranscriptChange, processAudio, resetTranscript 
  };
}