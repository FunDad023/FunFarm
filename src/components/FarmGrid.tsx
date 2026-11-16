import { useEffect, useMemo, useState } from 'react';
import { Droplets, LockKeyhole, Sparkles, Sprout, Timer } from 'lucide-react';
import { CROPS, cropByKey, formatTimeLeft, type CropKey, type Plot } from '../types/game';

interface FarmGridProps {
  plots: Plot[];
  inventory: Record<string, number>;
  ownIsland: boolean;
  ownerName: string;
  onPlant: (plotId: string, crop: CropKey) => void;
  onWater: (plotId: string) => void;
  onHarvest: (plotId: string) => void;
  onSteal: (plotId: string) => void;
  onUnlock: () => void;
}

export function FarmGrid({ plots, inventory, ownIsland, ownerName, onPlant, onWater, onHarvest, onSteal, onUnlock }: FarmGridProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [, setClock] = useState(0);
  const ordered = useMemo(() => [...plots].sort((a, b) => a.plot_index - b.plot_index), [plots]);
  const unlocked = ordered.filter((plot) => plot.is_unlocked).length;
  const visiblePlots = unlocked <= 16 ? ordered.slice(0, 16) : ordered;
  const nextPrice = 50 + Math.max(unlocked - 16, 0) * 25;

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedPlot = ordered.find((plot) => plot.id === selected);
  const chooseSeed = (crop: CropKey) => {
    if (selectedPlot) onPlant(selectedPlot.id, crop);
    setSelected(null);
  };

  return (
    <section className="farm-panel">
      <header className="farm-panel-heading">
        <div><span className="eyebrow"><span className="tiny-sun">✦</span> ĐẢO TRÊN MÂY</span><h2>{ownIsland ? 'Khu vườn của mình' : `Đảo của ${ownerName}`}</h2><p>{ownIsland ? 'Một góc xanh đang đợi bạn chăm sóc.' : 'Một vị khách dễ thương ghé thăm đảo này.'}</p></div>
        <div className="plot-count"><Sprout size={15} /><b>{unlocked}</b><span>/ 36 ô</span></div>
      </header>
      <div className={`farm-ground ${ownIsland ? '' : 'guest-ground'}`}>
        <div className={`farm-grid ${unlocked > 16 ? 'expanded-grid' : ''}`}>
          {visiblePlots.map((plot) => {
            const crop = cropByKey(plot.crop_key);
            const growing = !!crop && !!plot.harvest_at && new Date(plot.harvest_at).getTime() > Date.now();
            const ripe = !!crop && !growing;
            const totalSeconds = crop?.growSeconds ?? 1;
            const remaining = plot.harvest_at ? Math.max(0, (new Date(plot.harvest_at).getTime() - Date.now()) / 1000) : 0;
            const progress = crop ? Math.min(100, Math.max(0, (1 - remaining / totalSeconds) * 100)) : 0;
            const canWater = !!crop && growing && !plot.is_watered;
            return (
              <button key={plot.id} type="button" className={`plot ${!plot.is_unlocked ? 'locked' : ''} ${growing ? 'growing' : ''} ${ripe ? 'ripe' : ''} ${selected === plot.id ? 'selected' : ''}`} onClick={() => {
                if (!plot.is_unlocked) return;
                if (!ownIsland && growing && canWater) { onWater(plot.id); return; }
                if (!ownIsland && ripe && !plot.is_stolen) { onSteal(plot.id); return; }
                if (ownIsland && ripe) { onHarvest(plot.id); return; }
                if (ownIsland && !crop) { setSelected(selected === plot.id ? null : plot.id); return; }
                if (ownIsland && canWater) { onWater(plot.id); return; }
                setSelected(null);
              }} aria-label={!plot.is_unlocked ? 'Ô đất khóa' : `${crop?.name ?? 'Ô đất trống'}, ô ${plot.plot_index + 1}`}>
                {!plot.is_unlocked ? <><LockKeyhole size={15} /><small>#{String(plot.plot_index + 1).padStart(2, '0')}</small></> : crop ? <>
                  <span className={`crop-emoji ${ripe ? 'crop-ripe' : ''}`}>{growing ? (progress < 45 ? '🌱' : crop.emoji) : crop.emoji}</span>
                  <span className="plot-state">{ripe ? <><Sparkles size={11} /> {ownIsland ? 'Thu hoạch' : plot.is_stolen ? 'Đã hái' : 'Hái trộm'}</> : <><Timer size={10} /> {formatTimeLeft(plot.harvest_at)}</>}</span>
                  {growing && <span className="growth-track"><i style={{ width: `${progress}%` }} /></span>}
                  {canWater && <span className="water-hint"><Droplets size={10} /> Tưới</span>}
                  {plot.is_watered && growing && <span className="watered-mark">💧</span>}
                  {plot.is_stolen && <span className="stolen-mark">−1</span>}
                </> : <><span className="empty-sprout">＋</span><small>#{String(plot.plot_index + 1).padStart(2, '0')}</small></>}
              </button>
            );
          })}
        </div>
        {ownIsland && unlocked < 36 && <button className="unlock-button" type="button" onClick={onUnlock}>🔓 Mở thêm ô đất <b>{nextPrice} G</b></button>}
        {selectedPlot && ownIsland && <div className="seed-picker" role="dialog" aria-label="Chọn hạt giống">
          <div className="seed-picker-heading"><strong>Gieo hạt nào nhỉ?</strong><button type="button" onClick={() => setSelected(null)} aria-label="Đóng">×</button></div>
          <div className="seed-choice-list">{CROPS.map((crop) => <button type="button" key={crop.key} disabled={(inventory[`seed:${crop.key}`] ?? 0) < 1} onClick={() => chooseSeed(crop.key)}><span>{crop.emoji}</span><span>{crop.name}<small>{inventory[`seed:${crop.key}`] ?? 0} hạt</small></span><b>Gieo</b></button>)}</div>
        </div>}
      </div>
      <div className="farm-legend"><span><i className="legend-empty" /> Đất nghỉ ngơi</span><span><i className="legend-growing" /> Đang lớn</span><span><i className="legend-ripe" /> Đã chín</span></div>
      {!ownIsland && <p className="guest-tip">💧 Bấm cây đang lớn để tưới giúp · ✨ Bấm cây chín để hái một phần.</p>}
    </section>
  );
}
