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
 * 오디오 생성 및 STT 프로세스 실행
 */
export async function requestSTT(userId: string, audioId: string, audioPathUrl: string) {
  const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const commonHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANON_KEY}`
  };

  try {
    // --- STEP 1: create_audio 호출 (제공해주신 Edge Function) ---
    console.log("1. create_audio 호출 중...");
    const createAudioResponse = await fetch(`${BASE_URL}/functions/v1/create_audio`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({
        user_id: userId,
        storage_path: audioPathUrl, // Edge Function 내부 로직에 맞춰 전달
        title: "Uploaded Audio",      // 선택 사항
        duration: 0                   // 선택 사항 (0 또는 실제 길이)
      }),
    });

    if (!createAudioResponse.ok) {
      const errorData = await createAudioResponse.json();
      throw new Error(`create_audio 실패: ${errorData.error || JSON.stringify(errorData)}`);
    }

    const createResult = await createAudioResponse.json();
    // Edge Function에서 반환된 실제 DB의 audio_id를 사용합니다.
    const dbAudioId = createResult.audio_id;

    // --- STEP 2: STT (clever-processor) 호출 ---
    console.log("2. clever-processor 호출 중...");
    const sttResponse = await fetch(`${BASE_URL}/functions/v1/clever-processor`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({
        user_id: userId,
        input_audio_id: dbAudioId // 생성된 실제 DB ID 전달
      }),
    });

    if (!sttResponse.ok) {
      const errorData = await sttResponse.json();
      throw new Error(`STT 분석 요청 실패: ${errorData.error || JSON.stringify(errorData)}`);
    }

    return await sttResponse.json();

  } catch (error: any) {
    console.error("STT flow error:", error);
    throw error;
  }
}