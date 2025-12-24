'use client';

import { useState, useEffect } from 'react';
import { createClient } from "@supabase/supabase-js";
import { AudioUploader } from './components/AudioUploader';
import { AudioWaveform } from './components/AudioWaveform';
import { TranscriptEditor } from './components/TranscriptEditor';
import { useSelections } from './hooks/useSelections';
import { useTranscript } from './hooks/useTranscript';
import { requestAudioEdit, requestSTT } from './api';
import { LogoutButton } from '@/components/logout-button';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function UIPage() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
    };
    fetchUser();
  }, []);

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

      const localUrl = URL.createObjectURL(file);
      setAudioUrl(localUrl);
      setCurrentAudioId(dbData.audio_id);
      alert('파일이 성공적으로 업로드되었습니다.');
      
    } catch (err: any) {
      console.error(err);
      alert('업로드 실패: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartSTT = async () => {
    if (!userId || !currentAudioId) return alert('업로드된 오디오 정보가 없습니다.');
    
    setIsProcessing(true);
    try {
      const result = await requestSTT(userId, currentAudioId);
      if (result.whisper_words) {
        await processAudio(audioUrl!, result.whisper_words);
      } else {
        alert('STT 작업이 생성되었습니다. 분석 완료까지 잠시만 기다려주세요.');
      }
    } catch (err: any) {
      alert('STT 요청 실패: ' + err.message);
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

  // 에러 발생했던 부분: handleReset 함수 정의 추가
  const handleReset = () => {
    if (confirm('모든 작업 내용을 초기화하시겠습니까?')) {
      setAudioUrl(null);
      setCurrentAudioId(null);
      setSelections([]);
      resetTranscript(); // useTranscript 훅에서 제공하는 초기화 함수 호출
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
            disabled={!currentAudioId || isProcessing}
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