// app/ui/ui.state.ts
import { Selection, TranscriptWord } from './ui.types';

export type UIState = {
  transcript: TranscriptWord[];
  selections: Selection[];
};

export const initialUIState: UIState = {
  transcript: [],
  selections: [],
};