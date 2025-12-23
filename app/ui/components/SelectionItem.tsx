'use client';

import React from 'react';
import { Selection } from '../ui.types';

interface Props {
  selection: Selection;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Selection>) => void;
  pxPerSec: number;
}

export function SelectionItem({ selection, isSelected, onSelect, onUpdate, pxPerSec }: Props) {
  const left = selection.absStart * pxPerSec;
  const originalDuration = selection.absEnd - selection.absStart;
  const targetDuration = originalDuration + selection.durationDelta;
  const currentWidth = targetDuration * pxPerSec;

  // Selection 내부의 "변형된 시간축" 격자 생성
  const renderInternalGrid = () => {
    const lines = [];
    const numLines = Math.floor(originalDuration);
    // 원래 1초 간격이었던 선들이 delta에 의해 얼마나 벌어져야 하는지 계산
    const intervalRatio = targetDuration / originalDuration;
    
    for (let i = 1; i <= numLines; i++) {
      lines.push(
        <div 
          key={i} 
          className="absolute h-full border-l border-white/20" 
          style={{ left: (i * pxPerSec) * intervalRatio }} 
        />
      );
    }
    return lines;
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'start' | 'end' | 'duration') => {
    e.stopPropagation();
    onSelect(selection.id);
    
    const startX = e.clientX;
    const initialStart = selection.absStart;
    const initialEnd = selection.absEnd;
    const initialDelta = selection.durationDelta;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diffSec = (moveEvent.clientX - startX) / pxPerSec;

      if (type === 'move') {
        const duration = initialEnd - initialStart;
        const nextStart = Math.max(0, initialStart + diffSec);
        onUpdate(selection.id, { absStart: nextStart, absEnd: nextStart + duration });
      } else if (type === 'start') {
        const nextStart = Math.min(initialStart + diffSec, selection.absEnd - 0.1);
        onUpdate(selection.id, { absStart: Math.max(0, nextStart) });
      } else if (type === 'end') {
        const nextEnd = Math.max(initialEnd + diffSec, selection.absStart + 0.1);
        onUpdate(selection.id, { absEnd: nextEnd });
      } else if (type === 'duration') {
        let nextDelta = initialDelta + diffSec;
        if (nextDelta < -originalDuration + 0.1) nextDelta = -originalDuration + 0.1;
        onUpdate(selection.id, { durationDelta: nextDelta });
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(selection.id); }}
      className={`absolute top-0 h-full border-2 overflow-hidden transition-all ${
        isSelected ? 'border-red-600 bg-blue-500/40 z-30 shadow-lg' : 'border-blue-500 bg-blue-400/20 z-10'
      }`}
      style={{ left, width: Math.max(20, currentWidth) }}
    >
      {/* 내부 변형 격자 */}
      <div className="absolute inset-0 pointer-events-none">
        {renderInternalGrid()}
      </div>

      {/* Delta 값 중앙 표시 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className={`text-[11px] font-bold px-1 bg-white/20 rounded ${selection.durationDelta < 0 ? 'text-red-700' : 'text-blue-900'}`}>
          {selection.durationDelta !== 0 && `${selection.durationDelta > 0 ? '+' : ''}${selection.durationDelta.toFixed(2)}s`}
        </span>
      </div>

      <div className="absolute inset-x-4 top-0 bottom-0 cursor-grab active:cursor-grabbing" onMouseDown={(e) => handleMouseDown(e, 'move')} />
      <div className="absolute left-0 top-0 h-full w-2.5 bg-red-500 cursor-col-resize z-40" onMouseDown={(e) => handleMouseDown(e, 'start')} />
      <div className="absolute right-0 top-0 h-full w-2.5 bg-red-500 cursor-col-resize z-40" onMouseDown={(e) => handleMouseDown(e, 'end')} />
      <div className="absolute right-5 top-1/4 h-1/2 w-1.5 bg-blue-900/60 cursor-ew-resize z-40 rounded-full shadow-sm" onMouseDown={(e) => handleMouseDown(e, 'duration')} />

      <div className={`absolute -top-7 left-0 whitespace-nowrap px-1 py-0.5 rounded text-[10px] font-bold pointer-events-none ${
        isSelected ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
      }`}>
        {targetDuration.toFixed(2)}s (Orig: {originalDuration.toFixed(2)}s)
      </div>
    </div>
  );
}