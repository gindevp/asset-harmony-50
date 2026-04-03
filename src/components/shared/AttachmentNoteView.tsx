/** Ghi chú đính kèm: text nhiều dòng + dòng FILE:url sau upload. */
export function AttachmentNoteView({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const textLines: string[] = [];
  const files: string[] = [];
  for (const line of lines) {
    if (line.startsWith('FILE:')) files.push(line.slice(5).trim());
    else textLines.push(line);
  }
  return (
    <div className="space-y-2">
      <span className="text-muted-foreground">Đính kèm / ghi chú:</span>
      {textLines.length > 0 ? (
        <p className="text-sm whitespace-pre-wrap">{textLines.join('\n')}</p>
      ) : null}
      {files.map(u => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline block">
          Mở file đính kèm
        </a>
      ))}
    </div>
  );
}
