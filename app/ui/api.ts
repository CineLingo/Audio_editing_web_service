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
 * @param userId 사용자 식별자
 * @param audioId DB 레코드 식별자 (audio_id)
 * @param audioPathUrl 스토리지에 저장된 경로 (storage_path)
 */
export async function requestSTT(userId: string, audioId: string, audioPathUrl: string) {
  const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const commonHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANON_KEY}`
  };

  // 백엔드 에러 메시지에 따라 storage_path 키를 포함하여 구성합니다.
  const payload = {
    user_id: userId,
    input_audio_id: audioId,
    storage_path: audioPathUrl // 에러 메시지 규격에 맞춤
  };

  try {
    // --- STEP 1: create_audio 호출 ---
    console.log("1. create_audio 호출 중 (storage_path 포함)...");
    const createAudioResponse = await fetch(`${BASE_URL}/functions/v1/create_audio`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify(payload),
    });

    if (!createAudioResponse.ok) {
      const errorData = await createAudioResponse.json();
      throw new Error(`create_audio 실패: ${JSON.stringify(errorData)}`);
    }

    // --- STEP 2: STT (clever-processor) 호출 ---
    console.log("2. clever-processor 호출 중...");
    const sttResponse = await fetch(`${BASE_URL}/functions/v1/clever-processor`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({
        user_id: userId,
        input_audio_id: audioId
      }),
    });

    if (!sttResponse.ok) {
      const errorData = await sttResponse.json();
      throw new Error(`STT 분석 요청 실패: ${JSON.stringify(errorData)}`);
    }

    return await sttResponse.json();

  } catch (error: any) {
    console.error("STT 요청 흐름 중 에러 발생:", error);
    throw error;
  }
}