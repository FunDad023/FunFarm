import { Compass, Search, Signal, UserRound, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Neighbor } from '../types/game';

interface Props { neighbors: Neighbor[]; currentUserId: string; visitingId: string | null; onVisit: (neighbor: Neighbor) => void }

export function NeighborList({ neighbors, currentUserId, visitingId, onVisit }: Props) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => neighbors.filter((neighbor) => neighbor.id !== currentUserId && neighbor.username.includes(query.trim().toLowerCase())), [neighbors, currentUserId, query]);
  return (
    <section className="side-card neighbors-card">
      <div className="side-card-title"><span className="side-icon neighbor-icon"><Compass size={17} /></span><div><span className="eyebrow">BẢN ĐỒ BẦU TRỜI</span><h3>Hàng xóm</h3></div><span className="neighbor-total"><Users size={12} /> {filtered.length}</span></div>
      <label className="neighbor-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm một người bạn..." /></label>
      <div className="neighbor-list">{filtered.length === 0 ? <div className="neighbor-empty"><span>🪁</span><p>Chưa thấy hòn đảo nào ở đây.<br />Hãy quay lại sau nhé!</p></div> : filtered.map((neighbor) => <article className={`neighbor-row ${visitingId === neighbor.id ? 'is-visiting' : ''}`} key={neighbor.id}>
        <div className="neighbor-avatar"><UserRound size={18} /><i className={neighbor.online ? 'online' : ''} /></div>
        <div className="neighbor-copy"><strong>{neighbor.username}</strong><small><span>Lv.{neighbor.level}</span><span className="neighbor-dot">·</span><span>{neighbor.gold} G</span></small></div>
        <span className={`online-state ${neighbor.online ? 'online' : ''}`} title={neighbor.online ? 'Đang online' : 'Ngoại tuyến'}><Signal size={12} /></span>
        <button type="button" className="visit-button" onClick={() => onVisit(neighbor)}>{visitingId === neighbor.id ? 'Đang ở đây' : 'Ghé thăm'}</button>
      </article>)}</div>
      <div className="presence-footnote"><i /> Trạng thái bạn bè được cập nhật trực tiếp</div>
    </section>
  );
}
