'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Selection } from '../ui.types';
import { UI_CONSTANTS } from '../ui.constants';
import { useAudio } from '../hooks/useAudio';
import { SelectionLayer } from './SelectionLayer';
import { getWaveformData } from '../ui.utils'; // utils에 아래 함수를 추가해야 합니다.

export function AudioWaveform({
  selections,
  setSelections,
  audioUrl,
}: {
  selections: Selection[];
  setSelections: React.Dispatch<React.SetStateAction<Selection[]>>;
  audioUrl?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pxPerSec, setPxPerSec] = useState(UI_CONSTANTS.DEFAULT_PIXELS_PER_SECOND);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { isPlaying, playAll, playSegment, pause, loadAudio, currentTime, duration, seek } = useAudio();

  // 오디오 로드 및 파형 데이터 추출
  useEffect(() => {
    if (audioUrl) {
      loadAudio(audioUrl);
      // 오디오에서 약 2000개의 샘플 포인트를 추출 (해상도 조절 가능)
      getWaveformData(audioUrl, 2000)
        .then(data => setWaveformData(data))
        .catch(err => console.error("Waveform error:", err));
    }
  }, [audioUrl, loadAudio]);

  const selectedSelection = useMemo(() => selections.find(s => s.id === selectedId), [selections, selectedId]);
  const totalWidth = Math.max(1000, duration * pxPerSec);

  const activeSelection = useMemo(() => 
    selections.find(s => currentTime >= s.absStart && currentTime <= s.absEnd),
    [selections, currentTime]
  );

  // 파형 캔버스 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalWidth * dpr;
    canvas.height = UI_CONSTANTS.WAVEFORM_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, totalWidth, UI_CONSTANTS.WAVEFORM_HEIGHT);
    
    // 파형 스타일 설정
    ctx.fillStyle = '#cbd5e1'; // slate-300
    const barWidth = totalWidth / waveformData.length;
    const middle = UI_CONSTANTS.WAVEFORM_HEIGHT / 2;

    waveformData.forEach((val, i) => {
      const x = i * barWidth;
      const barHeight = val * UI_CONSTANTS.WAVEFORM_HEIGHT * 1.5; // 증폭률 조정
      ctx.fillRect(x, middle - barHeight / 2, barWidth * 0.8, barHeight);
    });
  }, [waveformData, totalWidth]);

  const getPlayheadX = () => {
    if (!activeSelection) return currentTime * pxPerSec;
    const progress = (currentTime - activeSelection.absStart) / (activeSelection.absEnd - activeSelection.absStart);
    const visualStart = activeSelection.absStart * pxPerSec;
    const visualWidth = (activeSelection.absEnd - activeSelection.absStart + activeSelection.durationDelta) * pxPerSec;
    return visualStart + (progress * visualWidth);
  };

  useEffect(() => {
    if (!selectedId || !selectedSelection || !scrollContainerRef.current || isDraggingPlayhead) return;
    const container = scrollContainerRef.current;
    const centerTime = (selectedSelection.absStart + selectedSelection.absEnd) / 2;
    container.scrollTo({ left: (centerTime * pxPerSec) - container.clientWidth / 2, behavior: 'auto' });
  }, [pxPerSec, selectedId, selections, isDraggingPlayhead, selectedSelection]);

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    const move = (me: MouseEvent) => {
      if (!scrollContainerRef.current) return;
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const x = me.clientX - rect.left + scrollContainerRef.current.scrollLeft;
      seek(Math.max(0, Math.min(duration, x / pxPerSec)));
    };
    const up = () => {
      setIsDraggingPlayhead(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const renderRulers = () => {
    const ticks = [];
    const step = pxPerSec < 40 ? 5 : 1;
    for (let i = 0; i <= duration; i += step) {
      ticks.push(
        <div key={i} className="absolute h-full border-l border-slate-300 text-[10px] text-slate-500 pl-1 pt-1" style={{ left: i * pxPerSec }}>{i}s</div>
      );
    }
    return ticks;
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex gap-2">
          <button onClick={isPlaying ? pause : playAll} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold w-24 tracking-tighter hover:bg-slate-700 active:scale-95 transition-all">{isPlaying ? '일시정지' : '전체 재생'}</button>
          <button onClick={() => selectedSelection && playSegment(selectedSelection.absStart, selectedSelection.absEnd, selectedSelection.durationDelta)} disabled={!selectedId} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-30 tracking-tighter hover:bg-indigo-700 active:scale-95 transition-all">구간 재생 (Preview)</button>
          <div className="w-[1px] h-8 bg-gray-200 mx-1" />
          <button onClick={() => {
            const id = `sel-${Date.now()}`;
            setSelections(prev => [...prev, { id, absStart: currentTime, absEnd: currentTime + 2, durationDelta: 0, tokenIds: [], isActive: true }]);
            setSelectedId(id);
          }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold tracking-tighter hover:bg-blue-700 active:scale-95 transition-all">+ 추가</button>
          <button onClick={() => { setSelections(prev => prev.filter(s => s.id !== selectedId)); setSelectedId(null); }} disabled={!selectedId} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-30 tracking-tighter hover:bg-red-600 active:scale-95 transition-all">삭제</button>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded border shadow-inner text-slate-700 font-bold">{currentTime.toFixed(2)}s</div>
          <input type="range" min={UI_CONSTANTS.MIN_PIXELS_PER_SECOND} max={UI_CONSTANTS.MAX_PIXELS_PER_SECOND} value={pxPerSec} onChange={(e) => setPxPerSec(Number(e.target.value))} className="w-32 accent-blue-600 cursor-pointer" />
        </div>
      </div>
      
      <div 
        ref={scrollContainerRef} 
        className="relative w-full overflow-x-auto rounded-lg bg-slate-50 border border-slate-200 select-none custom-scrollbar" 
      >
        <div className="relative" style={{ height: UI_CONSTANTS.WAVEFORM_HEIGHT, width: totalWidth }}>
          {/* 파형 캔버스 레이어 */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width: totalWidth, height: UI_CONSTANTS.WAVEFORM_HEIGHT }}
          />

          {/* 재생 헤드 */}
          <div 
            className="absolute top-0 bottom-0 w-[2px] bg-red-600 z-50 cursor-grab active:cursor-grabbing will-change-[left]" 
            style={{ left: getPlayheadX() }} 
            onMouseDown={handlePlayheadMouseDown}
          >
            <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-600 rounded-full shadow-md" />
          </div>

          <div className="absolute inset-0 pointer-events-none">
            {renderRulers()}
          </div>

          <SelectionLayer 
            selections={selections} 
            setSelections={setSelections} 
            pxPerSec={pxPerSec} 
            selectedId={selectedId} 
            onSelect={setSelectedId} 
          />
        </div>
      </div>
    </div>
  );
}