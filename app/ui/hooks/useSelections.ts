// app/ui/hooks/useSelections.ts
'use client';

import { useState } from 'react';
import { Selection } from '../ui.types';

export function useSelections() {
  const [selections, setSelections] = useState<Selection[]>([]);

  return {
    selections,
    setSelections,
  };
}