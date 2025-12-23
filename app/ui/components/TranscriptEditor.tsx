// app/ui/components/TranscriptEditor.tsx
'use client';

export function TranscriptEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <textarea
      className="h-40 w-full rounded border p-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}