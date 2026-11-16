import { useState } from 'react';
import { ArrowDownToLine, Coins, ShoppingBasket, Store } from 'lucide-react';
import { CROPS, type CropKey, type InventoryItem } from '../types/game';

interface Props { inventory: InventoryItem[]; gold: number; onBuy: (key: CropKey, quantity: number) => void; onSell: (key: CropKey, quantity: number) => void }

export function ShopInventory({ inventory, gold, onBuy, onSell }: Props) {
  const [tab, setTab] = useState<'shop' | 'inventory'>('shop');
  const count = (type: 'seed' | 'crop', key: CropKey) => inventory.find((item) => item.item_type === type && item.item_key === key)?.quantity ?? 0;
  return (
    <section className="side-card shop-card">
      <div className="side-card-title"><span className="side-icon shop-icon"><Store size={17} /></span><div><span className="eyebrow">GÓC NHỎ CỦA BẠN</span><h3>Chợ trên mây</h3></div></div>
      <div className="shop-tabs"><button className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}><ShoppingBasket size={13} /> Cửa hàng</button><button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}><ArrowDownToLine size={13} /> Kho đồ</button></div>
      <div className="shop-list">{CROPS.map((crop) => <article className="shop-item" key={crop.key}>
        <div className="shop-crop-icon" style={{ background: `${crop.color}22` }}>{crop.emoji}</div>
        <div className="shop-item-copy"><strong>{crop.name}</strong>{tab === 'shop' ? <small>Hạt giống · {crop.growSeconds < 60 ? `${crop.growSeconds}s` : `${crop.growSeconds / 60} phút`}</small> : <small>{count('seed', crop.key)} hạt · {count('crop', crop.key)} nông sản</small>}</div>
        {tab === 'shop' ? <button className="mini-trade-button" disabled={gold < crop.seedPrice} onClick={() => onBuy(crop.key, 1)}><Coins size={12} />{crop.seedPrice} G</button> : <button className="mini-trade-button sell-button" disabled={count('crop', crop.key) < 1} onClick={() => onSell(crop.key, count('crop', crop.key))}>Bán ×{count('crop', crop.key)} · {crop.sellPrice * count('crop', crop.key)} G</button>}
      </article>)}</div>
      {tab === 'shop' ? <p className="side-card-note">Chọn hạt giống rồi bấm vào đất trống để gieo.</p> : <p className="side-card-note">Bán toàn bộ nông sản cùng loại đang có trong kho.</p>}
    </section>
  );
}
