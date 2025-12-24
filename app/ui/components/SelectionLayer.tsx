'use client';

import React from 'react';
import { Selection } from '../ui.types';
import { SelectionItem } from './SelectionItem';

interface Props {
  selections: Selection[];
  setSelections: React.Dispatch<React.SetStateAction<Selection[]>>;
  pxPerSec: number; 
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function SelectionLayer({ selections, setSelections, pxPerSec, selectedId, onSelect }: Props) {
  const handleUpdate = (id: string, updates: Partial<Selection>) => {
    setSelections((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const startTime = clickX / pxPerSec; // 동적 배율 사용

    const newSelection: Selection = {
      id: `sel-${Date.now()}`,
      absStart: startTime,
      absEnd: startTime + 1.0,
      durationDelta: 0,
      tokenIds: [],
      isActive: true,
    };
    
    setSelections((prev) => [...prev, newSelection]);
    onSelect(newSelection.id);
  };

  return (
    <div
      className="absolute inset-0 z-10 cursor-crosshair"
      onClick={() => onSelect(null)}
      onContextMenu={handleEmptyContextMenu}
    >
      {selections.map((sel) => (
        <SelectionItem
          key={sel.id}
          selection={sel}
          pxPerSec={pxPerSec}
          isSelected={selectedId === sel.id}
          onSelect={onSelect}
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  );
}