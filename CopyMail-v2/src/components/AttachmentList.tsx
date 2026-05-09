import { Paperclip } from 'lucide-react';
import type { EmailAttachment } from '../utils/EmailProcessor';

interface Props {
  attachments: EmailAttachment[];
}

export function AttachmentList({ attachments }: Props) {
  const visible = attachments.filter((a) => !a.inline || !a.dataUrl);
  if (visible.length === 0) return null;
  return (
    <div className="attachment-list" aria-label="Anhänge">
      <div className="attachment-list-head">
        <Paperclip size={14} />
        <span>{visible.length === 1 ? '1 Anhang' : `${visible.length} Anhänge`}</span>
      </div>
      <ul>
        {visible.map((a, i) => (
          <li key={`${a.name}-${i}`}>
            <span className="att-name">{a.name}</span>
            <span className="att-size">{formatSize(a.size)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
