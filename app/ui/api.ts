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
 * Supabase Edge Function 호출: start_stt
 * 이미지의 audio_jobs 테이블 구조를 고려하여 payload 구성
 */
/**
 * 오디오 생성 및 STT 프로세스 실행
 * 1. create_audio 함수 호출 (DB 레코드 생성 및 초기화)
 * 2. clever-processor 함수 호출 (STT 및 분석 시작)
 */
export async function requestSTT(userId: string, audioId: string) {
  const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const commonHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANON_KEY}`
  };

  const payload = {
    user_id: userId,
    input_audio_id: audioId
  };

  try {
    // --- STEP 1: create_audio 함수 호출 ---
    console.log("1. create_audio 호출 중...");
    const createAudioResponse = await fetch(`${BASE_URL}/functions/v1/create_audio`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify(payload),
    });

    if (!createAudioResponse.ok) {
      const errorText = await createAudioResponse.text();
      throw new Error(`create_audio 실패: ${errorText}`);
    }
    
    // 필요하다면 결과값 확인 가능
    // const createResult = await createAudioResponse.json();

    // --- STEP 2: STT (clever-processor) 함수 호출 ---
    console.log("2. clever-processor(STT) 호출 중...");
    const sttResponse = await fetch(`${BASE_URL}/functions/v1/clever-processor`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify(payload),
    });

    if (!sttResponse.ok) {
      const errorText = await sttResponse.text();
      throw new Error(`STT 분석 요청 실패: ${errorText}`);
    }

    const finalResult = await sttResponse.json();
    console.log("모든 프로세스 요청 완료");
    
    return finalResult;

  } catch (error: any) {
    console.error("STT 요청 흐름 중 에러 발생:", error);
    throw error;
  }
}