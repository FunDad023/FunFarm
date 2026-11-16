import { useState } from 'react';
import type { FormEvent } from 'react';
import { BookHeart, Droplets, MessageCircle, Sparkles } from 'lucide-react';
import type { GuestbookEntry } from '../types/game';

interface Props { entries: GuestbookEntry[]; ownIsland: boolean; onMessage: (text: string) => void }

const actionIcon = (action: GuestbookEntry['action_type']) => action === 'water' ? <Droplets size={13} /> : action === 'steal' ? <Sparkles size={13} /> : <MessageCircle size={13} />;
const formatDate = (value: string) => new Date(value).toLocaleString('vi-VN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function Guestbook({ entries, ownIsland, onMessage }: Props) {
  const [message, setMessage] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (!message.trim()) return; onMessage(message.trim()); setMessage(''); }
  return (
    <section className="side-card guestbook-card">
      <div className="side-card-title"><span className="side-icon guestbook-icon"><BookHeart size={17} /></span><div><span className="eyebrow">DẤU CHÂN DỄ THƯƠNG</span><h3>Sổ lưu bút</h3></div><span className="guestbook-total">{entries.length}</span></div>
      {!ownIsland && <form className="guestbook-form" onSubmit={submit}><input maxLength={300} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Để lại một lời nhắn..." required /><button disabled={!message.trim()} aria-label="Gửi lời nhắn">→</button></form>}
      <div className="guestbook-list">{entries.length === 0 ? <div className="guestbook-empty">📮<span>Cuốn sổ còn thơm mùi giấy mới.</span></div> : entries.map((entry) => <article className={`guest-entry action-${entry.action_type}`} key={entry.id}>
        <div className="guest-entry-icon">{actionIcon(entry.action_type)}</div><div className="guest-entry-copy"><p><strong>{entry.visitor_username}</strong> {entry.content}</p><time>{formatDate(entry.created_at)}</time></div>
      </article>)}</div>
    </section>
  );
}
