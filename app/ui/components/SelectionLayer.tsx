'use client';

import { Selection } from '../ui.types';
import { SelectionItem } from './SelectionItem';
import { UI_CONSTANTS } from '../ui.constants';

interface Props {
  selections: Selection[];
  setSelections: React.Dispatch<React.SetStateAction<Selection[]>>;
}

export function SelectionLayer({ selections, setSelections }: Props) {
  const handleUpdate = (id: string, updates: Partial<Selection>) => {
    setSelections((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleDelete = (id: string) => {
    setSelections((prev) => prev.filter((s) => s.id !== id));
  };

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const startTime = clickX / UI_CONSTANTS.PIXELS_PER_SECOND;

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
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}