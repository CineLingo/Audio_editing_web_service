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

  const handleFileSelect = async (file: File) => {
    if (!userId) return alert('로그인이 필요합니다.');
    setIsProcessing(true);
    try {
      const ext = file.name.split(".").pop() ?? "wav";
      const storage_path = `user_${userId}/uploads/${crypto.randomUUID()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("Audio_editing_bucket")
        .upload(storage_path, file);
      
      if (uploadError) throw uploadError;

      const { data: dbData, error: dbError } = await supabase
        .from("audios")
        .insert({
          user_id: userId,
          audio_path_url: storage_path,
          title: file.name
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setAudioUrl(URL.createObjectURL(file));
      setCurrentAudioId(dbData.audio_id);
      setCurrentStoragePath(storage_path);
      alert('파일이 업로드되었습니다.');
    } catch (err: any) {
      alert('업로드 실패: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Whisper 분석 버튼 클릭 핸들러
   * 서버(Edge Function)로부터 분석 결과를 받아와서 에디터에 반영합니다.
   */
  const handleStartSTT = async () => {
    if (!userId || !currentAudioId || !currentStoragePath) return alert('업로드 정보가 부족합니다.');
    
    setIsProcessing(true);
    try {
      // 1. API 호출 (create_audio -> clever-processor 순차 실행)
      const result = await requestSTT(userId, currentAudioId, currentStoragePath);
      
      // 2. 결과 처리
      // Edge Function이 분석 결과(whisper_words)를 반환한다고 가정합니다.
      // 만약 결과 데이터 키값이 다르다면(예: whisperWords 등) 그에 맞춰 수정해야 합니다.
      if (result && (result.whisper_words || result.words)) {
        const words = result.whisper_words || result.words;
        
        // 3. 받은 단어 데이터를 Transcript Editor와 Waveform에 주입
        await processAudio(audioUrl!, words);
        alert('분석이 완료되어 텍스트가 로드되었습니다.');
      } else {
        alert('분석 요청은 성공했으나, 결과 데이터를 받지 못했습니다. 서버 로그를 확인해주세요.');
      }
    } catch (err: any) {
      console.error("STT Error:", err);
      alert('STT 요청 중 오류 발생: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = async () => {
    if (selections.length === 0) return alert('편집할 영역을 선택하거나 텍스트를 수정하세요.');
    setIsProcessing(true);
    try {
      const result = await requestAudioEdit(
        currentAudioId || 'placeholder', 
        textValue,
        selections
      );
      const freshAudioUrl = `${result.newAudioUrl}?t=${Date.now()}`;
      setAudioUrl(freshAudioUrl);
      await processAudio(freshAudioUrl, result.newWhisperWords);
      setSelections([]);
      alert('편집이 적용되었습니다.');
    } catch (err) {
      alert('편집 적용 실패');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (confirm('모든 작업 내용을 초기화하시겠습니까?')) {
      setAudioUrl(null);
      setCurrentAudioId(null);
      setSelections([]);
      resetTranscript();
    }
  };

  return (
    <main className="flex flex-col gap-6 p-8 max-w-5xl mx-auto min-h-screen">
      <LogoutButton label="로그아웃" variant="outline" size="sm" className="fixed top-4 right-4 z-50" />

      <div className="flex items-center justify-between bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
          <AudioUploader onFileSelect={handleFileSelect} />
          
          <button 
            onClick={handleStartSTT}
            disabled={!currentAudioId || isProcessing || !userId}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-30 transition-all shadow-md active:scale-95"
          >
            분석 시작 (Whisper)
          </button>

          {isProcessing && (
            <div className="flex items-center gap-3 text-blue-600 font-bold animate-pulse">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>처리 중...</span>
            </div>
          )}
          
          {isAuthChecking ? (
            <span className="text-xs text-slate-400">인증 확인 중...</span>
          ) : !userId ? (
            <span className="text-xs text-red-500 font-bold">인증 세션 없음</span>
          ) : (
            <span className="text-xs text-green-600 font-bold">인증됨 (ID: {userId.slice(0, 5)})</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleReset} className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-800 transition-colors">
            초기화
          </button>
          <button 
            onClick={handleEdit} 
            disabled={isProcessing || selections.length === 0} 
            className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg active:scale-95 transition-all disabled:opacity-40"
          >
            Edit (적용)
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white p-1">
        <AudioWaveform selections={selections} setSelections={setSelections} audioUrl={audioUrl} />
      </section>

      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Transcript Editor</h3>
        {isProcessing ? (
          <div className="h-48 w-full rounded-xl border-2 border-dashed border-slate-100 flex items-center justify-center text-slate-400 bg-slate-50/50">
            데이터를 처리하고 있습니다...
          </div>
        ) : (
          <TranscriptEditor value={textValue} onChange={onTranscriptChange} />
        )}
      </section>
    </main>
  );
}