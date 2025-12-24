// app/ui/components/TranscriptEditor.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

export function TranscriptEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState(value);
  const cursorRef = useRef<number | null>(null);

  // 부모로부터 오는 value(외부 변경)와 로컬 값을 동기화
  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value);
    }
  }, [value]);

  // 커서 위치 복구 로직
  useEffect(() => {
    if (textareaRef.current && cursorRef.current !== null) {
      textareaRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const start = e.target.selectionStart;

    // 현재 커서 위치 저장
    cursorRef.current = start;
    
    // 로컬 상태 즉시 업데이트 (입력 지연 방지)
    setLocalValue(newValue);
    
    // 부모에게 변경 알림 (여기서 LCS 알고리즘 실행됨)
    onChange(newValue);
  };

  return (
    <textarea
      ref={textareaRef}
      className="h-40 w-full rounded-xl border border-slate-200 p-4 font-sans leading-relaxed text-slate-700 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-none"
      value={localValue}
      onChange={handleChange}
      placeholder="분석된 텍스트가 여기에 표시됩니다. 자유롭게 수정하여 음성을 편집하세요."
    />
  );
}