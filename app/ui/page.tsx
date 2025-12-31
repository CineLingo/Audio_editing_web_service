'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { createClient } from "@/lib/supabase/client"; 
import { AudioUploader } from './components/AudioUploader';
import { AudioWaveform } from './components/AudioWaveform';
import { TranscriptEditor } from './components/TranscriptEditor';
import { useSelections } from './hooks/useSelections';
import { useTranscript } from './hooks/useTranscript';
import { getSupabaseFunctionAuthHeaders, requestAudioEdit, requestSTT } from './api';
import { LogoutButton } from '@/components/logout-button';
import { UI_CONSTANTS } from './ui.constants';
import { formatBytes } from './ui.utils';

type AudioHistoryItem = {
  audio_id: string;
  title: string | null;
  created_at: string;
  audio_path_url: string | null;
  transcript_chunks: any;
};

export default function UIPage() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [currentStoragePath, setCurrentStoragePath] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [historyItems, setHistoryItems] = useState<AudioHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  const supabase = createClient();
  const { selections, setSelections } = useSelections();

  const { 
    textValue, 
    onTranscriptChange, 
    isProcessing, 
    setIsProcessing, 
    processAudio, 
    resetTranscript 
  } = useTranscript(selections, setSelections);

  const dtf = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  }, []);

  const formatCreatedAt = useCallback(
    (iso: string) => {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return iso;
      return dtf ? dtf.format(d) : d.toLocaleString();
    },
    [dtf]
  );

  const indexToLabel = useCallback((idx: number) => {
    // 0 -> A, 25 -> Z, 26 -> AA ...
    let n = idx;
    let s = '';
    while (n >= 0) {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      setIsAuthChecking(false);
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUserId(session.user.id);
      else setUserId(null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const fetchHistory = useCallback(
    async (audioId: string) => {
      setIsHistoryLoading(true);
      setHistoryError(null);

      try {
        // 1) current audio -> root id
        const { data: cur, error: curErr } = await supabase
          .from('audios')
          .select('audio_id, root_audio_id')
          .eq('audio_id', audioId)
          .single();

        if (curErr || !cur) throw new Error(curErr?.message ?? '현재 오디오 조회 실패');

        const rootId: string = cur.root_audio_id ?? cur.audio_id;

        // 2) fetch all versions under same root (A1: created_at asc)
        const { data: rows, error: listErr } = await supabase
          .from('audios')
          .select('audio_id, title, created_at, audio_path_url, transcript_chunks')
          .eq('root_audio_id', rootId)
          .order('created_at', { ascending: true });

        if (listErr) throw new Error(listErr.message);

        setHistoryItems((rows ?? []) as AudioHistoryItem[]);
      } catch (e: any) {
        setHistoryItems([]);
        setHistoryError(e?.message ?? String(e));
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [supabase]
  );

  const refreshHistory = useCallback(() => {
    if (!currentAudioId) return;
    fetchHistory(currentAudioId);
  }, [currentAudioId, fetchHistory]);

  useEffect(() => {
    if (!currentAudioId) {
      setHistoryItems([]);
      setHistoryError(null);
      setIsHistoryLoading(false);
      return;
    }
    fetchHistory(currentAudioId);
  }, [currentAudioId, fetchHistory]);

  const getFullAudioUrl = (path: string) => {
    if (!path || path.startsWith('http') || path.startsWith('blob:')) return path;
    const { data } = supabase.storage
      .from("Audio_editing_bucket")
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSelectHistory = useCallback(
    async (audioId: string) => {
      if (!audioId) return;
      if (audioId === currentAudioId) return;
      setIsProcessing(true);
      try {
        const { data, error } = await supabase
          .from('audios')
          .select('audio_id, audio_path_url, transcript_chunks')
          .eq('audio_id', audioId)
          .single();

        if (error || !data) throw new Error(error?.message ?? '오디오 조회 실패');
        if (!data.audio_path_url) throw new Error('audio_path_url이 없습니다.');

        setCurrentAudioId(data.audio_id);
        setAudioUrl(data.audio_path_url);
        setSelections([]);

        let words: any = data.transcript_chunks;
        if (typeof words === 'string') {
          try {
            words = JSON.parse(words);
          } catch {
            // keep as-is
          }
        }

        if (words && Array.isArray(words)) {
          await processAudio(data.audio_path_url, words);
        } else {
          resetTranscript();
        }
      } catch (e: any) {
        alert(`히스토리 로드 실패: ${e?.message ?? String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [currentAudioId, processAudio, resetTranscript, setSelections, setIsProcessing, supabase]
  );

  const pollForFinalAudio = async (audioId: string): Promise<any> => {
    const startTime = Date.now();
    const timeout = 3 * 60 * 1000;

    while (Date.now() - startTime < timeout) {
      const { data, error } = await supabase
        .from('audios')
        .select('*')
        .eq('audio_id', audioId)
        .single();

      if (data && !error) {
        if (data.audio_path_url && !data.audio_path_url.startsWith('placeholder')) {
          return data;
        }
      }
      console.log("오디오 파일 업로드 대기 중...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error("오디오 생성 대기 시간이 초과되었습니다.");
  };

  const loadNewAudioData = async (audioId: string, audioPath: string, transcriptChunks: any) => {
    const fullUrl = getFullAudioUrl(audioPath);
    setCurrentAudioId(audioId);
    setCurrentStoragePath(audioPath);
    setAudioUrl(fullUrl);
    
    let words = transcriptChunks;
    if (typeof words === 'string') {
      try { words = JSON.parse(words); } catch (e) { console.error(e); }
    }

    if (words && Array.isArray(words)) {
      await processAudio(fullUrl, words);
      setSelections([]); 
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!userId) return alert('로그인이 필요합니다.');
    const isAllowedType = file.type.startsWith('audio/') || file.type === 'video/mp4';
    if (!isAllowedType) return alert('오디오 파일만 업로드할 수 있습니다.');
    if (file.size > UI_CONSTANTS.MAX_AUDIO_UPLOAD_BYTES) {
      return alert(`파일 용량이 너무 큽니다. 최대 ${formatBytes(UI_CONSTANTS.MAX_AUDIO_UPLOAD_BYTES)}까지 업로드할 수 있습니다.`);
    }
    setIsProcessing(true);
    try {
      const ext = file.name.split(".").pop() ?? "wav";
      const storage_path = `user_${userId}/uploads/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("Audio_editing_bucket").upload(storage_path, file);
      if (uploadError) throw uploadError;

      // 업로드된 파일을 DB(audios)에 등록은 Edge Function(create_audio_new)에서 단 한 번만 수행
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("세션 토큰이 없습니다. 다시 로그인해 주세요.");

      const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!BASE_URL) throw new Error("Missing Supabase env var: NEXT_PUBLIC_SUPABASE_URL.");

      const createRes = await fetch(`${BASE_URL}/functions/v1/create_audio_new`, {
        method: "POST",
        headers: getSupabaseFunctionAuthHeaders(accessToken),
        body: JSON.stringify({
          user_id: userId,
          storage_path,
          title: file.name,
          duration: 0,
        }),
      });

      if (!createRes.ok) {
        const errorData = await createRes.json().catch(() => ({}));
        throw new Error(errorData.error || "create_audio_new 실패");
      }

      const created = await createRes.json();
      setCurrentAudioId(created.audio_id);
      setCurrentStoragePath(storage_path);
      setAudioUrl(created.audio_path_url ?? getFullAudioUrl(storage_path));
      alert('파일이 업로드되었습니다.');
    } catch (err: any) {
      alert('업로드 실패: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartSTT = async () => {
    if (!userId || !currentAudioId) return alert('업로드 정보가 부족합니다.');
    if (!audioUrl) return alert('오디오 URL이 없습니다. 다시 업로드해 주세요.');
    setIsProcessing(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("세션 토큰이 없습니다. 다시 로그인해 주세요.");

      const result = await requestSTT(userId, currentAudioId, accessToken);
      let words = result?.transcript_chunks;
      if (typeof words === 'string') {
        try { words = JSON.parse(words); } catch (e) { console.error(e); }
      }
      if (words && Array.isArray(words)) {
        await processAudio(audioUrl!, words);
        // STT 완료 시 audios.transcript_chunks가 업데이트되므로, 히스토리 배지(분석 전/완료) 반영을 위해 재조회
        await fetchHistory(currentAudioId);
        alert('분석 완료');
      } else {
        alert('STT 데이터 로드 실패');
      }
    } catch (err: any) {
      alert('STT 요청 오류: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = async () => {
    if (!userId || !currentAudioId) return alert('로그인 정보 또는 오디오 정보가 없습니다.');
    if (selections.length === 0) return alert('편집할 영역을 선택하거나 텍스트를 수정하세요.');
    setIsProcessing(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("세션 토큰이 없습니다. 다시 로그인해 주세요.");

      const result = await requestAudioEdit(userId, currentAudioId, textValue, selections, accessToken);
      const requestId = result.request_id;
      alert('편집 요청이 접수되었습니다. 생성이 완료될 때까지 기다려주세요.');

      const channel = supabase
        .channel(`job-${requestId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'audio_jobs',
            filter: `request_id=eq.${requestId}`
          },
          async (payload) => {
            const updatedJob = payload.new;
            if (updatedJob.status === 'succeeded') {
              try {
                const finalAudio = await pollForFinalAudio(updatedJob.output_audio_id);
                await loadNewAudioData(finalAudio.audio_id, finalAudio.audio_path_url, finalAudio.transcript_chunks);
                alert('편집이 완료되어 새로운 오디오로 교체되었습니다.');
                setIsProcessing(false);
                channel.unsubscribe();
              } catch (pollErr: any) {
                alert(pollErr.message);
                setIsProcessing(false);
                channel.unsubscribe();
              }
            } else if (updatedJob.status === 'failed') {
              alert(`편집 실패: ${updatedJob.error_log}`);
              setIsProcessing(false);
              channel.unsubscribe();
            }
          }
        )
        .subscribe();
    } catch (err: any) {
      alert('편집 요청 오류: ' + err.message);
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (confirm('모든 작업 내용을 초기화하시겠습니까?')) {
      // "새로고침"처럼 완전히 초기 상태로 되돌리기
      window.location.reload();
    }
  };

  const handleDownload = async () => {
    if (!audioUrl) return;
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio_${currentAudioId || Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('다운로드 중 오류가 발생했습니다.');
      console.error(error);
    }
  };

  return (
    <main className="min-h-screen">
      <LogoutButton label="로그아웃" variant="outline" size="sm" className="fixed top-4 right-4 z-50" />

      <div className="mx-auto max-w-7xl p-8">
        <div className="flex gap-6 items-start">
          {/* LEFT: editor */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">
            {/* 가이드 설명서 섹션 */}
            <section className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 bg-slate-900 text-white text-xs rounded-full">?</span>
                이용 가이드
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex flex-col gap-2">
                  <div className="text-blue-600 font-black text-xl">01</div>
                  <div className="font-bold text-slate-800">오디오 업로드</div>
                  <p className="text-xs text-slate-500 leading-relaxed">편집할 오디오 파일을 선택하여 서버에 업로드합니다.</p>
                </div>
                <div className="flex flex-col gap-2 border-l border-slate-200 pl-6">
                  <div className="text-purple-600 font-black text-xl">02</div>
                  <div className="font-bold text-slate-800">분석 시작</div>
                  <p className="text-xs text-slate-500 leading-relaxed"><b>[분석]</b> 버튼을 눌러 음성을 텍스트로 변환합니다.</p>
                </div>
                <div className="flex flex-col gap-2 border-l border-slate-200 pl-6">
                  <div className="text-indigo-600 font-black text-xl">03</div>
                  <div className="font-bold text-slate-800">텍스트 및 영역 편집</div>
                  <p className="text-xs text-slate-500 leading-relaxed">텍스트를 수정하면 자동으로 영역이 잡힙니다. 빨강 핸들로 <b>범위</b>를, 파랑 핸들로 <b>시간</b>을 조절하세요.</p>
                </div>
                <div className="flex flex-col gap-2 border-l border-slate-200 pl-6">
                  <div className="text-emerald-600 font-black text-xl">04</div>
                  <div className="font-bold text-slate-800">편집 적용</div>
                  <p className="text-xs text-slate-500 leading-relaxed"><b>[편집]</b> 버튼을 누르면 새로운 오디오가 생성됩니다.</p>
                </div>
              </div>

              {/* 중요 팁 및 제약 사항 */}
              <div className="mt-6">
                <div className="h-px w-full bg-slate-200" />
                <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        지원 언어 및 작성 방식
                      </h4>
                      <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                        <li>• 현재 <span className="text-blue-600 font-bold">한글</span>만 지원됩니다.</li>
                        <li>• 모든 숫자, 단위, 영어 등은 <b>한국어 발음</b> 그대로 작성해 주세요.</li>
                        <li className="text-slate-400 italic">(예: 100% → 백퍼센트 / Apple → 애플)</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex h-full flex-col gap-3">
                    <div className="flex-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                        권장 오디오 분량
                      </h4>
                      <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                        <li>• <span className="text-indigo-600 font-bold">10~15초</span> 사이의 오디오가 가장 결과가 좋습니다.</li>
                        <li>• 5초 미만은 목소리가 변할 수 있고, 30초 이상은 생성이 실패할 수 있습니다.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 추가 서비스 링크 */}
              <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-end gap-4 flex-wrap">
                <p className="text-sm text-slate-500 whitespace-nowrap">편집이 아닌 <b>음성 생성</b>을 원하시나요?</p>
                <a 
                  href="https://myvoice.cinelingo-labs.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                >
                  Cinelingo MyVoice 바로가기
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </a>
              </div>
            </section>

            {/* 상단 컨트롤 바 */}
            <div className="flex items-center justify-between bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-6 min-w-0">
                <AudioUploader onFileSelect={handleFileSelect} disabled={isProcessing} />
                <button 
                  onClick={handleStartSTT} 
                  disabled={!currentAudioId || isProcessing || !userId} 
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-600 disabled:opacity-30 transition-all shadow-md active:scale-95"
                >
                  분석
                </button>
                {!isProcessing && (
                   <div className="text-xs">
                     {isAuthChecking ? <span className="text-slate-400">확인 중...</span> : !userId ? <span className="text-red-500 font-bold">인증 필요</span> : <span className="text-green-600 font-bold">인증됨</span>}
                   </div>
                )}
                {isProcessing && (
                  <div className="flex items-center gap-3 text-blue-600 font-bold animate-pulse">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>처리 중...</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <button
                  onClick={handleReset}
                  className="px-2 py-2 text-sm font-semibold text-slate-400 hover:text-slate-800 transition-colors"
                >
                  초기화
                </button>
              </div>
            </div>

            {/* 파형 섹션 */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white p-1">
              <AudioWaveform selections={selections} setSelections={setSelections} audioUrl={audioUrl} />
            </section>

            {/* 텍스트 에디터 섹션 */}
            <section className="relative bg-white p-6 pb-16 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Transcript Editor</h3>
              {isProcessing ? (
                <div className="h-48 w-full rounded-xl border-2 border-dashed border-slate-100 flex items-center justify-center text-slate-400 bg-slate-50/50 text-sm">
                  데이터를 처리하고 있습니다...
                </div>
              ) : (
                <TranscriptEditor value={textValue} onChange={onTranscriptChange} />
              )}
              <button
                onClick={handleEdit}
                disabled={isProcessing || selections.length === 0}
                className="absolute bottom-4 right-4 bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-md active:scale-95 transition-all disabled:opacity-40"
              >
                편집
              </button>
            </section>

            {/* 다운로드 버튼 (Transcript Editor 바로 아래, 우측) */}
            <div className="flex justify-end">
              <button 
                onClick={handleDownload} 
                disabled={!audioUrl || isProcessing}
                className="px-6 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"
              >
                다운로드
              </button>
            </div>
          </div>

          {/* RIGHT: history sidebar */}
          <aside className="w-[340px] shrink-0">
            <div className="sticky top-8">
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">History</div>
                    <div className="text-sm font-bold text-slate-900 mt-1">작업 기록</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={refreshHistory}
                      disabled={!currentAudioId || isHistoryLoading || isProcessing}
                      className={[
                        'text-xs font-bold px-2 py-1 rounded-lg border',
                        !currentAudioId || isHistoryLoading || isProcessing
                          ? 'text-slate-300 border-slate-200 cursor-not-allowed'
                          : 'text-slate-600 border-slate-200 hover:bg-slate-50',
                      ].join(' ')}
                      title="히스토리 새로고침"
                    >
                      새로고침
                    </button>
                    <div className="text-xs text-slate-400">
                      {isHistoryLoading ? '불러오는 중…' : `${historyItems.length}개`}
                    </div>
                  </div>
                </div>

                <div className="max-h-[70vh] overflow-auto">
                  {!currentAudioId ? (
                    <div className="p-5 text-sm text-slate-500">오디오를 업로드하면 기록이 표시됩니다.</div>
                  ) : historyError ? (
                    <div className="p-5 text-sm text-red-600">
                      히스토리 불러오기 실패: {historyError}
                    </div>
                  ) : isHistoryLoading && historyItems.length === 0 ? (
                    <div className="p-3 space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-slate-200 p-3 bg-white"
                        >
                          <div className="h-4 w-2/3 bg-slate-100 rounded" />
                          <div className="mt-2 h-3 w-1/2 bg-slate-100 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : historyItems.length === 0 ? (
                    <div className="p-5 text-sm text-slate-500">기록이 없습니다.</div>
                  ) : (
                    <div className="p-2">
                      {historyItems.map((item, idx) => {
                        const isActive = item.audio_id === currentAudioId;
                        const hasTranscript = !!item.transcript_chunks;
                        const label = indexToLabel(idx);
                        return (
                          <button
                            key={item.audio_id}
                            type="button"
                            onClick={() => handleSelectHistory(item.audio_id)}
                            disabled={isProcessing}
                            className={[
                              'w-full text-left rounded-xl p-3 transition-colors border',
                              isActive
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white hover:bg-slate-50 border-slate-200',
                              isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                            ].join(' ')}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className={['text-sm font-bold truncate', isActive ? 'text-white' : 'text-slate-900'].join(' ')}>
                                  {item.title ?? `Audio ${idx + 1}`}
                                </div>
                                <div className={['text-xs mt-1', isActive ? 'text-slate-200' : 'text-slate-500'].join(' ')}>
                                  {formatCreatedAt(item.created_at)}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <span
                                    className={[
                                      'text-[11px] font-bold px-2 py-0.5 rounded-full border',
                                      isActive
                                        ? 'border-slate-700 text-slate-200'
                                        : hasTranscript
                                          ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                                          : 'border-slate-200 text-slate-500 bg-slate-50',
                                    ].join(' ')}
                                  >
                                    {hasTranscript ? '분석 완료' : '분석 전'}
                                  </span>
                                  {isActive && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white">
                                      현재
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className={['text-xs font-black', isActive ? 'text-slate-200' : 'text-slate-400'].join(' ')}>
                                {label}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}