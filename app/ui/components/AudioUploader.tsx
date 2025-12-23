'use client';

export function AudioUploader({ onFileSelect }: { onFileSelect: (url: string) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onFileSelect(url);
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
    </div>
  );
}