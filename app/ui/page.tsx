'use client';

import { useState } from 'react';
import { AudioUploader } from './components/AudioUploader';
import { AudioWaveform } from './components/AudioWaveform';
import { TranscriptEditor } from './components/TranscriptEditor';
import { useSelections } from './hooks/useSelections';
import { useTranscript } from './hooks/useTranscript';
import type { Selection, WhisperWord } from './ui.types';

export default function UIPage() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { selections, setSelections } = useSelections();
  const { textValue, onTranscriptChange, isProcessing, processAudio, resetTranscript } = useTranscript(setSelections);

  // --- 가상의 가공 API 호출 함수 ---
  const callEditAPI = async (currentSelections: Selection[]) => {
    console.log('[API Call] Sending Selections for Editing:', currentSelections);
    
    // 시뮬레이션: 서버에서 오디오 가공 및 새로운 분석 결과 생성
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 실제 환경에서는 여기서 새로운 wav URL과 새로운 whisper JSON을 받아옵니다.
    const newAudioUrl = audioUrl; // 예시를 위해 동일 URL 사용
    const newWhisperResult: WhisperWord[] = [
        { id: 'nw1', word: '수정된', start: 0.0, end: 0.8 },
        { id: 'nw2', word: '결과입니다', start: 0.8, end: 2.0 },
    ];

    return { newAudioUrl, newWhisperResult };
  };

  const handleEdit = async () => {
    if (selections.length === 0) return alert('편집할 영역을 선택하거나 텍스트를 수정하세요.');
    
    try {
      const { newAudioUrl, newWhisperResult } = await callEditAPI(selections);
      
      // 1. 새로운 오디오와 Whisper 결과로 UI 갱신
      if (newAudioUrl) setAudioUrl(newAudioUrl + "?t=" + Date.now()); // 캐시 방지
      await processAudio(newAudioUrl!, newWhisperResult);
      
      // 2. 편집 완료된 영역들(Selections) 초기화
      setSelections([]);
      alert('편집이 완료되었습니다. 새로운 상태에서 다시 편집할 수 있습니다.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = () => {
    if (confirm('모든 작업 내용을 초기화하고 처음부터 다시 시작하시겠습니까?')) {
      setAudioUrl(null);
      setSelections([]);
      resetTranscript();
    }
  };

  // 1. 오디오 다운로드 기능 구현
  const handleDownload = async () => {
    if (!audioUrl) return;

    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited_audio_${Date.now()}.wav`; // 파일명 지정
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  return (
    <main className="flex flex-col gap-6 p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
          <AudioUploader onFileSelect={(url) => {
            setSelections([]);
            processAudio(url);
            setAudioUrl(url);
          }} />
          
          {isProcessing && (
            <div className="flex items-center gap-2 text-blue-600 font-semibold animate-pulse">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Processing...
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 다운로드 버튼 추가 */}
          <button
            onClick={handleDownload}
            disabled={!audioUrl || isProcessing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
            </svg>
            Download
          </button>

          <button 
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            초기화
          </button>

          <button 
            onClick={handleEdit}
            disabled={isProcessing || selections.length === 0}
            className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Edit (적용)
          </button>
        </div>
      </div>

      <section>
        <AudioWaveform selections={selections} setSelections={setSelections} audioUrl={audioUrl} />
      </section>

      <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Transcript Editor</h3>
        </div>
        
        {isProcessing ? (
          <div className="h-40 w-full rounded border border-dashed border-gray-200 flex items-center justify-center text-gray-400">
            분석 중입니다...
          </div>
        ) : (
          <TranscriptEditor value={textValue} onChange={onTranscriptChange} />
        )}
      </section>
    </main>
  );
}