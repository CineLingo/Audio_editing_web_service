// app/ui/api.ts
import { Selection, WhisperWord } from './ui.types';

// Edge Function이 즉시 결과를 주지 않고 작업 접수 정보만 주므로 인터페이스 수정
interface AudioEditRequestResponse {
  status: string;
  request_id: string;
  output_audio_id: string;
  runpod_raw: string;
}

/**
 * @param userId 현재 로그인한 사용자 UUID
 * @param audioId 원본 오디오 식별자 (input_audio_id)
 * @param fullText TranscriptEditor의 전체 텍스트 (target_text용)
 * @param selections 사용자가 정의한 편집 영역 리스트
 */
export async function requestAudioEdit(
  userId: string,
  audioId: string, 
  fullText: string, 
  selections: Selection[]
): Promise<AudioEditRequestResponse> {
  // Edge Function 경로 (일반적으로 /functions/v1/파일명)
  const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const API_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!BASE_URL || !API_KEY) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  const API_ENDPOINT = `${BASE_URL}/functions/v1/start_editing`;

  // Edge Function 규격에 맞춘 페이로드 생성
  const payload = {
    user_id: userId,
    input_audio_id: audioId,
    title: `Edited_${new Date().toISOString().slice(0, 10)}`, // 제목 예시
    target_text: fullText,
    edit_timestamps: selections.map(s => [s.absStart, s.absEnd]), // [[start, end], ...]
    expansions: selections.map(s => s.durationDelta) // [delta, ...]
  };

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}` // Edge Function 호출을 위한 인증 추가
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Audio editing request failed');
  }

  return await response.json();
}
/**
 * 오디오 생성 및 STT 프로세스 실행
 */
export async function requestSTT(userId: string, audioId: string, audioPathUrl: string) {
  const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const API_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!BASE_URL || !API_KEY) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  const commonHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
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