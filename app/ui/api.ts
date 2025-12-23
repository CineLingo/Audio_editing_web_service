// app/ui/api.ts
import { Selection, WhisperWord } from './ui.types';

/**
 * 편집된 Selection 리스트를 서버로 전송하고 새로운 오디오와 Whisper 결과를 받아옵니다.
 */
export async function requestAudioEdit(audioId: string, selections: Selection[]) {
  // 실제 API 엔드포인트로 변경하세요
  const API_ENDPOINT = '/api/edit-audio';

  const payload = {
    audioId,
    selections: selections.map(s => ({
      absStart: s.absStart,
      absEnd: s.absEnd,
      durationDelta: s.durationDelta
    }))
  };

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error('Audio editing failed');

  // 서버에서 { newAudioUrl: string, newWhisperWords: WhisperWord[] } 형태의 응답을 준다고 가정
  return await response.json();
}