import type { EmailData } from '../utils/EmailProcessor';

interface Props {
  emails: { data: EmailData; name: string }[];
  activeIndex: number;
  onSelect: (i: number) => void;
}

export function MailTabs({ emails, activeIndex, onSelect }: Props) {
  if (emails.length <= 1) return null;
  return (
    <div className="mail-tabs" role="tablist" aria-label="Geladene Mails">
      {emails.map((m, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === activeIndex}
          className={`mail-tab${i === activeIndex ? ' active' : ''}`}
          onClick={() => onSelect(i)}
          title={`${m.data.subject} – ${m.data.from}`}
        >
          <span className="mail-tab-num">{i + 1}</span>
          <span className="mail-tab-subject">{m.data.subject || '(Kein Betreff)'}</span>
        </button>
      ))}
    </div>
  );
}
