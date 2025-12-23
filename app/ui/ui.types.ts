// app/ui/ui.types.ts

export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
};

export type TranscriptWord = WordTimestamp & {
  original: boolean; // whisper 결과인지 여부
};

export type AudioFileInfo = {
  file: File;
  url: string;
  duration: number;
};

// 원본 단어 단위 timestamp (절대 불변)
export type WhisperWord = {
  id: string;           // stable id
  word: string;
  start: number;        // abs time
  end: number;
};

export type WhisperResult = {
  words: WhisperWord[];
  language?: string;
};

// 사용자가 보고/수정하는 단위
export type TranscriptToken = {
  id: string;                 // stable across edits
  text: string;

  // 원본과의 연결
  sourceWordIds: string[];    // whisper word ids

  // 상태
  isEdited: boolean;
};

export type Selection = {
  id: string;

  // 원본 기준 절대 시간
  absStart: number;
  absEnd: number;

  // duration 조절 (초 단위)
  durationDelta: number; // - / + / 0

  // 연결된 transcript
  tokenIds: string[];

  // UI 상태
  isActive: boolean;
};


export type SelectionEditPayload = {
  absStart: number;
  absEnd: number;
  durationDelta: number;
};


export type AudioEditRequest = {
  audioId: string;
  selections: SelectionEditPayload[];
};


export type UIState = {
  whisper: WhisperResult | null;

  transcript: TranscriptToken[];
  selections: Selection[];

  audioUrl: string | null;
  audioDuration: number;
};