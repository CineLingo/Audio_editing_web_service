// app/ui/ui.types.ts

export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
};

export type TranscriptWord = WordTimestamp & {
  original: boolean;
};

export type AudioFileInfo = {
  file: File;
  url: string;
  duration: number;
};

export type WhisperWord = {
  id: string;
  word: string;
  start: number;
  end: number; // 가공 후에는 항상 숫자
};

export type WhisperResult = {
  words: WhisperWord[];
  language?: string;
};

export type TranscriptToken = {
  id: string;
  text: string;
  sourceWordIds: string[];
  isEdited: boolean;
};

export type Selection = {
  id: string;
  absStart: number;
  absEnd: number;
  durationDelta: number;
  tokenIds: string[];
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