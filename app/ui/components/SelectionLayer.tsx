'use client';

import { Selection } from '../ui.types';
import { SelectionItem } from './SelectionItem';
import { UI_CONSTANTS } from '../ui.constants';

interface Props {
  selections: Selection[];
  setSelections: React.Dispatch<React.SetStateAction<Selection[]>>;
  pxPerSec: number; // 현재 배율을 추가로 받음
}

export function SelectionLayer({ selections, setSelections, pxPerSec }: Props) {
  const handleUpdate = (id: string, updates: Partial<Selection>) => {
    setSelections((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    // 에러 수정: UI_CONSTANTS.PIXELS_PER_SECOND 대신 인자로 받은 pxPerSec 사용
    const startTime = clickX / pxPerSec;

    const newSelection: Selection = {
      id: `sel-${Date.now()}`,
      absStart: startTime,
      absEnd: startTime + 1.0, // 기본 1초
      durationDelta: 0,
      tokenIds: [],
      isActive: true,
    };
    setSelections((prev) => [...prev, newSelection]);
  };

  return (
    <div
      className="absolute inset-0 z-10 cursor-crosshair"
      onContextMenu={handleEmptyContextMenu}
    >
      {selections.map((sel) => (
        <SelectionItem
          key={sel.id}
          selection={sel}
          pxPerSec={pxPerSec}
          isSelected={false} // SelectionLayer 내부에서는 단순 나열용으로 처리하거나 필요시 관리
          onSelect={() => {}} 
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  );
}