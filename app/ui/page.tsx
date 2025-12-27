'use client';

import { useState, useEffect } from 'react';
import { createClient } from "@/lib/supabase/client"; 
import { AudioUploader } from './components/AudioUploader';
import { AudioWaveform } from './components/AudioWaveform';
import { TranscriptEditor } from './components/TranscriptEditor';
import { useSelections } from './hooks/useSelections';
import { useTranscript } from './hooks/useTranscript';
import { requestAudioEdit, requestSTT } from './api';
import { LogoutButton } from '@/components/logout-button';
import { UI_CONSTANTS } from './ui.constants';
import { formatBytes } from './ui.utils';

export default function UIPage() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [currentStoragePath, setCurrentStoragePath] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  
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

  const getFullAudioUrl = (path: string) => {
    if (!path || path.startsWith('http') || path.startsWith('blob:')) return path;
    const { data } = supabase.storage
      .from("Audio_editing_bucket")
      .getPublicUrl(path);
    return data.publicUrl;
  };

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

      const { data: dbData, error: dbError } = await supabase.from("audios").insert({
        user_id: userId,
        audio_path_url: storage_path,
        title: file.name
      }).select().single();

      if (dbError) throw dbError;

      const fullUrl = getFullAudioUrl(storage_path);
      setAudioUrl(fullUrl);
      setCurrentAudioId(dbData.audio_id);
      setCurrentStoragePath(storage_path);
      alert('파일이 업로드되었습니다.');
    } catch (err: any) {
      alert('업로드 실패: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartSTT = async () => {
    if (!userId || !currentAudioId || !currentStoragePath) return alert('업로드 정보가 부족합니다.');
    setIsProcessing(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("세션 토큰이 없습니다. 다시 로그인해 주세요.");

      const result = await requestSTT(userId, currentAudioId, currentStoragePath, accessToken);
      let words = result?.transcript_chunks;
      if (typeof words === 'string') {
        try { words = JSON.parse(words); } catch (e) { console.error(e); }
      }
      if (words && Array.isArray(words)) {
        await processAudio(audioUrl!, words);
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
      setAudioUrl(null);
      setCurrentAudioId(null);
      setCurrentStoragePath(null);
      setSelections([]);
      resetTranscript();
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
    <main className="flex flex-col gap-6 p-8 max-w-5xl mx-auto min-h-screen">
      <LogoutButton label="로그아웃" variant="outline" size="sm" className="fixed top-4 right-4 z-50" />

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
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

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
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

        {/* 추가 서비스 링크 */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 italic">편집이 아닌 <b>음성 생성</b>을 원하시나요?</p>
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
            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-30 transition-all shadow-md active:scale-95"
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
            onClick={handleEdit} 
            disabled={isProcessing || selections.length === 0} 
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-md active:scale-95 transition-all disabled:opacity-40"
          >
            편집
          </button>
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
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Transcript Editor</h3>
        {isProcessing ? (
          <div className="h-48 w-full rounded-xl border-2 border-dashed border-slate-100 flex items-center justify-center text-slate-400 bg-slate-50/50 text-sm">
            데이터를 처리하고 있습니다...
          </div>
        ) : (
          <TranscriptEditor value={textValue} onChange={onTranscriptChange} />
        )}
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
    </main>
  );
}