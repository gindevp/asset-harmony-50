/** Ghi chú đính kèm: text nhiều dòng + dòng FILE:url sau upload. Kiểu chữ đồng bộ với dòng «Vấn đề». */
export function AttachmentNoteView({
  text,
  showCaption = true,
}: {
  text: string;
  /** false: chỉ nội dung + link file (dùng khi đã có nhãn «Ghi chú» ở ngoài) */
  showCaption?: boolean;
}) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const textLines: string[] = [];
  const files: string[] = [];
  for (const line of lines) {
    if (line.startsWith('FILE:')) files.push(line.slice(5).trim());
    else textLines.push(line);
  }
  const body = textLines.join('\n');
  const showTextBlock = body || files.length === 0;
  return (
    <div className="space-y-2">
      {showTextBlock && (
        <p className="text-sm font-medium whitespace-pre-wrap">
          {showCaption ? `Đính kèm / ghi chú: ${body || '—'}` : body || (files.length === 0 ? '—' : '')}
        </p>
      )}
      {files.map(u => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline block">
          Mở file đính kèm
        </a>
      ))}
    </div>
  );
}
