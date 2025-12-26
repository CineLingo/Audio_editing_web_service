// app/ui/ui.constants.ts
export const UI_CONSTANTS = {
  MIN_PIXELS_PER_SECOND: 20,
  MAX_PIXELS_PER_SECOND: 500,
  DEFAULT_PIXELS_PER_SECOND: 100,
  WAVEFORM_HEIGHT: 150,
  HANDLE_WIDTH: 8,
  /**
   * 업로드 가능한 최대 파일 크기 (bytes)
   * - Supabase Storage 정책에 맞게 조정하세요.
   * - 현재 프로젝트 정책: 5MB 고정
   */
  MAX_AUDIO_UPLOAD_BYTES: 5 * 1024 * 1024,
};