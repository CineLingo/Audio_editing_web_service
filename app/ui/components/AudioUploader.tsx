'use client';

import { useId, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { UI_CONSTANTS } from '../ui.constants';
import { formatBytes } from '../ui.utils';

export function AudioUploader({
  onFileSelect,
  disabled = false,
}: {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const toDisplayFileName = (name: string, maxLen = 26) => {
    if (name.length <= maxLen) return name;
    const lastDot = name.lastIndexOf('.');
    const hasExt = lastDot > 0 && lastDot < name.length - 1;
    const ext = hasExt ? name.slice(lastDot) : '';
    const base = hasExt ? name.slice(0, lastDot) : name;

    // 확장자는 유지하고, 본문은 ... 처리
    const roomForBase = Math.max(8, maxLen - ext.length - 1); // -1 for ellipsis
    const truncatedBase = base.slice(0, roomForBase);
    return `${truncatedBase}…${ext}`;
  };

  const validateAndSelect = (file: File, resetInput?: () => void) => {
    const isAllowedType = file.type.startsWith('audio/') || file.type === 'video/mp4';
    if (!isAllowedType) {
      alert('오디오 파일만 업로드할 수 있습니다.');
      setSelectedFileName(null);
      resetInput?.();
      return;
    }
    if (file.size > UI_CONSTANTS.MAX_AUDIO_UPLOAD_BYTES) {
      alert(
        `파일 용량이 너무 큽니다. 최대 ${formatBytes(UI_CONSTANTS.MAX_AUDIO_UPLOAD_BYTES)}까지 업로드할 수 있습니다.`
      );
      setSelectedFileName(null);
      resetInput?.();
      return;
    }
    setSelectedFileName(file.name);
    onFileSelect(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelect(file, () => {
        e.target.value = '';
      });
    }
  };

  const handleDragOver = (e: DragEvent) => {
    // 중요: 기본 동작을 막아야 브라우저가 파일을 열어버리지 않고 drop 이벤트가 발생합니다.
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragActive(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled) return;

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    validateAndSelect(file);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Audio File</label>
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'rounded-xl border border-slate-200 p-3 transition-colors',
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
          isDragActive ? 'border-blue-400 bg-blue-50/60' : 'bg-white',
        ].join(' ')}
        aria-disabled={disabled}
      >
        {/*
          NOTE:
          - Drag&drop으로는 보안상 input[file]의 "선택된 파일" UI를 채울 수 없습니다.
          - 그래서 기본 input UI는 숨기고, 선택된 파일명은 우리가 직접 표시합니다.
        */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="audio/*,video/mp4"
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="shrink-0 rounded-full border-0 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            파일 선택
          </button>

          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500">
              오디오 파일을 <b>드래그 앤 드롭</b>하거나 버튼으로 선택하세요.
            </div>
            <div className="truncate text-sm text-slate-700" title={selectedFileName ?? ''}>
              {selectedFileName ? (
                <span className="font-medium">{toDisplayFileName(selectedFileName)}</span>
              ) : (
                <span className="text-slate-400">선택된 파일 없음</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="text-[11px] text-slate-400">
        최대 {formatBytes(UI_CONSTANTS.MAX_AUDIO_UPLOAD_BYTES)}
      </div>
    </div>
  );
}