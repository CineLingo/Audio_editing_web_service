'use client';

import { UI_CONSTANTS } from '../ui.constants';
import { formatBytes } from '../ui.utils';

export function AudioUploader({ onFileSelect }: { onFileSelect: (file: File) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isAllowedType = file.type.startsWith('audio/') || file.type === 'video/mp4';
      if (!isAllowedType) {
        alert('오디오 파일만 업로드할 수 있습니다.');
        e.target.value = '';
        return;
      }
      if (file.size > UI_CONSTANTS.MAX_AUDIO_UPLOAD_BYTES) {
        alert(
          `파일 용량이 너무 큽니다. 최대 ${formatBytes(UI_CONSTANTS.MAX_AUDIO_UPLOAD_BYTES)}까지 업로드할 수 있습니다.`
        );
        e.target.value = '';
        return;
      }
      onFileSelect(file);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Audio File</label>
      <input 
        type="file" 
        accept="audio/*,video/mp4" 
        onChange={handleChange}
        className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      <div className="text-[11px] text-slate-400">
        최대 {formatBytes(UI_CONSTANTS.MAX_AUDIO_UPLOAD_BYTES)}
      </div>
    </div>
  );
}