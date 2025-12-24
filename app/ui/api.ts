// app/ui/api.ts
import { Selection, WhisperWord } from './ui.types';

interface AudioEditResponse {
  newAudioUrl: string;
  newWhisperWords: WhisperWord[];
}

export async function requestAudioEdit(
  audioId: string, 
  fullText: string, 
  selections: Selection[]
): Promise<AudioEditResponse> {
  const API_ENDPOINT = '/api/edit-audio';

  const payload = {
    audioId,
    target_text: fullText,
    edit_timestamps: selections.map(s => [s.absStart, s.absEnd]),
    expansions: selections.map(s => s.durationDelta)
  };

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Audio editing failed');
  }

  return await response.json();
}

/**
 * Supabase Edge Function 호출: STT 시작
 */
export async function requestSTT(userId: string, audioId: string) {
  // Supabase URL/functions/v1/start_stt 형태이나, 
  // 보통 클라이언트에서 직접 부르거나 프록시를 통합니다.
  const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/start_stt`;
  
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      user_id: userId,
      input_audio_id: audioId
    }),
  });

  if (!response.ok) {
    throw new Error('STT 요청에 실패했습니다.');
  }

  return await response.json();
}