import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, Coins, House, LogOut, Map, RefreshCw, Sparkles, Star, Sun, Volume2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { Auth } from './components/Auth';
import { FarmGrid } from './components/FarmGrid';
import { Guestbook } from './components/Guestbook';
import { NeighborList } from './components/NeighborList';
import { ShopInventory } from './components/ShopInventory';
import { supabase } from './lib/supabase';
import { expForNextLevel, type FarmAction, type GuestbookEntry, type InventoryItem, type Neighbor, type Plot, type Profile } from './types/game';
import './styles.css';

type View = 'home' | 'world';

function playGardenSound(kind: 'plant' | 'water' | 'harvest' | 'gold') {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const notes = kind === 'plant' ? [392, 587] : kind === 'water' ? [523, 659] : kind === 'harvest' ? [523, 659, 784] : [660, 880];
    const now = context.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === 'water' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.09);
      gain.gain.setValueAtTime(0.0001, now + index * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.065, now + index * 0.09 + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + index * 0.09);
      oscillator.stop(now + index * 0.09 + 0.17);
    });
    window.setTimeout(() => void context.close(), 650);
  } catch { /* Audio is a small enhancement; the game still works when unavailable. */ }
}

function actionText(action: FarmAction, data: Record<string, unknown> | null) {
  if (action === 'plant_seed') return 'Hạt giống đã gieo. Chúc cây lớn thật ngoan!';
  if (action === 'water_plot') return data?.visitor_reward ? 'Tưới hộ thành công · +10 vàng và +5 EXP!' : 'Tưới mát cho cây rồi! Cây sẽ chín sớm hơn 20%.';
  if (action === 'harvest_crop') return `Thu hoạch vui quá · +${String(data?.quantity ?? 2)} nông sản và +${String(data?.exp ?? 0)} EXP!`;
  if (action === 'steal_crop') return 'Đã hái một nông sản. Chủ đảo sẽ thấy lời nhắn trong sổ lưu bút.';
  if (action === 'buy_seed') return 'Hạt giống đã được thêm vào kho.';
  if (action === 'sell_crop') return `Đã bán nông sản · +${String(data?.gold_earned ?? 0)} vàng.`;
  if (action === 'unlock_plot') return 'Ô đất mới đã mở. Thêm một góc xanh cho khu vườn!';
  return 'Lời nhắn đã được gửi lên mây.';
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [guestbook, setGuestbook] = useState<GuestbookEntry[]>([]);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>('home');
  const [visiting, setVisiting] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [dataError, setDataError] = useState('');
  const soundRef = useRef(true);
  const islandId = visiting?.id ?? profile?.id ?? null;
  const ownIsland = !visiting || visiting.id === profile?.id;

  const loadOwnData = useCallback(async (userId: string) => {
    const [profileResult, inventoryResult, plotResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('inventories').select('*').eq('user_id', userId).order('item_type').order('item_key'),
      supabase.from('plots').select('*').eq('user_id', userId).order('plot_index'),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (inventoryResult.error) throw inventoryResult.error;
    if (plotResult.error) throw plotResult.error;
    setProfile(profileResult.data as Profile);
    setInventory(inventoryResult.data as InventoryItem[]);
    if (!visiting || visiting.id === userId) setPlots(plotResult.data as Plot[]);
  }, [visiting]);

  const loadIsland = useCallback(async (ownerId: string) => {
    const [plotResult, guestResult] = await Promise.all([
      supabase.from('plots').select('*').eq('user_id', ownerId).order('plot_index'),
      supabase.from('guestbook').select('*').eq('island_owner_id', ownerId).order('created_at', { ascending: false }).limit(40),
    ]);
    if (plotResult.error) throw plotResult.error;
    if (guestResult.error) throw guestResult.error;
    setPlots(plotResult.data as Plot[]);
    setGuestbook(guestResult.data as GuestbookEntry[]);
  }, []);

  const loadNeighbors = useCallback(async (presence = onlineIds) => {
    const { data, error } = await supabase.from('profiles').select('id, username, gold, exp, level, created_at').order('level', { ascending: false }).limit(100);
    if (error) throw error;
    setNeighbors((data as Profile[]).map((player) => ({ ...player, online: presence.has(player.id) })));
  }, [onlineIds]);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => { if (alive) { setSession(data.session); if (!data.session) setLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null); setInventory([]); setPlots([]); setGuestbook([]); setNeighbors([]); setVisiting(null); setView('home'); setLoading(false);
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    let cancelled = false;
    setLoading(true);
    setDataError('');
    void Promise.all([loadOwnData(session.user.id), loadIsland(session.user.id), loadNeighbors()])
      .catch((error: unknown) => { if (!cancelled) setDataError(error instanceof Error ? error.message : 'Chưa tải được nông trại.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session?.user.id]); // load each authenticated player's initial farm once.

  useEffect(() => {
    if (!session?.user.id) return;
    const channel = supabase.channel('sky-farm-world', { config: { presence: { key: session.user.id } } });
    const refreshPresence = () => {
      const state = channel.presenceState<{ user_id: string }>();
      const ids = new Set(Object.keys(state));
      setOnlineIds(ids);
      void loadNeighbors(ids).catch(() => {});
    };
    channel.on('presence', { event: 'sync' }, refreshPresence)
      .on('presence', { event: 'join' }, refreshPresence)
      .on('presence', { event: 'leave' }, refreshPresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: session.user.id, online_at: new Date().toISOString() });
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id || !islandId) return;
    const subscription = supabase.channel(`island-${islandId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plots', filter: `user_id=eq.${islandId}` }, () => {
        void loadIsland(islandId).catch((error: unknown) => setDataError(error instanceof Error ? error.message : 'Không đồng bộ được các ô đất.'));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guestbook', filter: `island_owner_id=eq.${islandId}` }, () => {
        void loadIsland(islandId).catch(() => {});
      })
      .subscribe();
    return () => { void supabase.removeChannel(subscription); };
  }, [session?.user.id, islandId, loadIsland]);

  useEffect(() => {
    if (!profile) return;
    setNeighbors((current) => current.map((neighbor) => ({ ...neighbor, online: onlineIds.has(neighbor.id) })));
  }, [onlineIds, profile]);

  const inventoryMap = useMemo(() => Object.fromEntries(inventory.map((item) => [`${item.item_type}:${item.item_key}`, item.quantity])), [inventory]);
  const expGoal = profile ? expForNextLevel(profile.level) : 100;
  const levelProgress = profile ? (profile.exp % expGoal) : 0;
  const wheatSeedCount = inventoryMap['seed:wheat'] ?? 0;

  async function refreshEverything() {
    if (!session?.user.id) return;
    setDataError('');
    try {
      await Promise.all([loadOwnData(session.user.id), islandId ? loadIsland(islandId) : Promise.resolve(), loadNeighbors()]);
    } catch (error) { setDataError(error instanceof Error ? error.message : 'Không tải được dữ liệu mới.'); }
  }

  async function farmAction(action: FarmAction, args: Record<string, unknown> = {}, sound?: 'plant' | 'water' | 'harvest' | 'gold') {
    if (!session) return;
    setBusy(true); setNotice(''); setDataError('');
    try {
      const { data, error } = await supabase.rpc(action, args as never);
      if (error) throw error;
      const result = (data ?? {}) as Record<string, unknown>;
      setNotice(actionText(action, result));
      if (sound && soundRef.current) playGardenSound(sound);
      if (profile) await loadOwnData(profile.id);
      if (islandId) await loadIsland(islandId);
      if (action === 'water_plot' && result.visitor_reward && soundRef.current) playGardenSound('gold');
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Chưa thực hiện được thao tác này.');
    } finally { setBusy(false); }
  }

  function visitIsland(neighbor: Neighbor) {
    setVisiting(neighbor);
    setView('home');
    setNotice(`Bạn đang ghé thăm đảo của ${neighbor.username}.`);
    setDataError('');
    void loadIsland(neighbor.id).catch((error: unknown) => setDataError(error instanceof Error ? error.message : 'Không vào được đảo này.'));
  }

  function returnHome() {
    if (!profile) return;
    setVisiting(null);
    setView('home');
    setNotice('Đã về lại hòn đảo của bạn.');
    void loadIsland(profile.id).catch(() => {});
  }

  async function signOut() { await supabase.auth.signOut(); }

  if (!session) return <Auth onAuthenticated={() => { setLoading(true); }} />;
  if (loading && !profile) return <main className="loading-screen"><span className="loading-island">🌱</span><p>Đang đón bạn về hòn đảo…</p></main>;

  const ownProfile = profile;
  const activeIslandName = ownIsland ? ownProfile?.username ?? 'Nông trại' : visiting?.username ?? 'Hàng xóm';

  return (
    <div className="game-shell">
      <div className="sky-decor sky-decor-one" /><div className="sky-decor sky-decor-two" />
      <header className="topbar">
        <a className="game-brand" href="#home" onClick={(event) => { event.preventDefault(); setView('home'); returnHome(); }}><span className="brand-icon"><span>✿</span></span><span>sky-island <b>homestead</b><small>VƯỜN TRÊN MÂY</small></span></a>
        <nav className="main-tabs" aria-label="Khu vực trò chơi"><button className={view === 'home' && ownIsland ? 'active' : ''} onClick={returnHome}><House size={16} /> Đảo của mình</button><button className={view === 'world' ? 'active' : ''} onClick={() => { setView('world'); setVisiting(null); void loadNeighbors().catch(() => {}); }}><Map size={16} /> Bản đồ mây <span className="tab-count">{neighbors.length}</span></button></nav>
        <div className="topbar-right"><div className="weather-pill"><Sun size={15} /><span>Nắng dịu</span><i>·</i><Cloud size={16} /></div><div className="topbar-player"><span className="player-avatar">{ownProfile?.username.slice(0, 1).toUpperCase() ?? '🌿'}</span><span>{ownProfile?.username}</span><span className="level-mini">Lv.{ownProfile?.level ?? 1}</span></div><button className="icon-button" onClick={() => { soundRef.current = !soundRef.current; setNotice(soundRef.current ? 'Âm thanh khu vườn đã bật.' : 'Âm thanh khu vườn đã tắt.'); }} title="Bật/tắt âm thanh"><Volume2 size={16} /></button><button className="icon-button logout-button" onClick={() => void signOut()} title="Đăng xuất"><LogOut size={16} /></button></div>
      </header>

      <main className="game-main">
        <section className="welcome-strip"><div className="welcome-copy"><span className="eyebrow"><Sparkles size={12} /> MỘT NGÀY THẬT DỊU DÀNG</span><h1>Chào buổi sáng, <em>{ownProfile?.username}!</em></h1><p>Những mầm cây nhỏ đang chờ bàn tay chăm sóc của bạn.</p></div><div className="welcome-cloud"><span>☁</span><span>🌤️</span><span>☁</span></div><div className="currency-card"><span className="coin-art">🪙</span><div><small>VÀNG CỦA BẠN</small><strong>{(ownProfile?.gold ?? 0).toLocaleString('vi-VN')} <i>G</i></strong></div><span className="coin-spark">✦</span></div></section>
        <section className="progress-strip"><div className="level-badge"><Star size={16} fill="currentColor" /><b>{ownProfile?.level ?? 1}</b></div><div className="level-copy"><div><strong>Cấp độ {ownProfile?.level ?? 1}</strong><span>{(ownProfile?.exp ?? 0) % expGoal} / {expGoal} EXP</span></div><div className="level-track"><i style={{ width: `${levelProgress}%` }} /></div></div><span className="level-next">Cấp tiếp theo đang đợi 🌼</span><div className="seed-count">🌾 <b>{wheatSeedCount}</b><small>hạt lúa mì</small></div></section>

        {dataError && <div className="notice-banner error-banner" role="alert"><span>🌧️</span><p>{dataError.includes('schema cache') || dataError.includes('Could not find the function') ? 'Database chưa cài xong hoặc schema đang được tải lại. Hãy chạy toàn bộ supabase_setup.sql trong Supabase SQL Editor.' : dataError}</p><button onClick={() => void refreshEverything()}><RefreshCw size={14} /> Thử lại</button></div>}
        {notice && <div className="notice-banner success-banner" role="status"><span>🕊️</span><p>{notice}</p><button onClick={() => setNotice('')} aria-label="Đóng">×</button></div>}

        {view === 'world' ? <section className="world-page"><div className="world-heading"><div><span className="eyebrow"><Map size={12} /> QUẦN ĐẢO BỒNG BỀNH</span><h2>Mỗi hòn đảo một câu chuyện.</h2><p>Ghé thăm bạn bè, tưới hộ một mầm cây và để lại lời chào nhé.</p></div><div className="world-online"><i /> {neighbors.filter((neighbor) => neighbor.online).length} nông trại đang mở cửa</div></div><div className="world-grid">{neighbors.filter((neighbor) => neighbor.id !== session.user.id).map((neighbor, index) => <article className="world-island-card" key={neighbor.id}><div className={`world-island-art world-art-${index % 4}`}><span className="world-cloud">☁</span><span className="world-home">🏡</span><span className="world-crop">🌷 🌾 🌻</span><span className="world-island-base" /></div><div className="world-island-info"><div className="world-name-row"><strong>{neighbor.username}</strong><span className={neighbor.online ? 'world-online-tag' : 'world-offline-tag'}><i />{neighbor.online ? 'Đang online' : 'Ngoại tuyến'}</span></div><div className="world-stats"><span>⭐ Cấp {neighbor.level}</span><span>🪙 {neighbor.gold} vàng</span></div><button className="button button-visit" onClick={() => visitIsland(neighbor)}>Ghé thăm đảo <span>→</span></button></div></article>)}</div>{neighbors.filter((neighbor) => neighbor.id !== session.user.id).length === 0 && <div className="world-empty"><span>🪂</span><h3>Những hòn đảo khác sắp xuất hiện!</h3><p>Khi có người bạn đầu tiên, đảo của họ sẽ hiện trên bản đồ này.</p></div>}</section> : <>
          {!ownIsland && <div className="visiting-banner"><span>🧺</span><p>Đang thăm đảo của <strong>{visiting?.username}</strong></p><button onClick={returnHome}><House size={14} /> Về nhà của tôi</button></div>}
          <div className="island-landscape"><span className="landscape-cloud cloud-left">☁</span><span className="landscape-cloud cloud-right">☁</span><div className="landscape-sun">☀</div><span className="landscape-bird bird-one">⌁</span><span className="landscape-bird bird-two">⌁</span><div className="island-ground-label"><span>✦</span> HÒN ĐẢO {ownIsland ? 'SỐ 01' : `CỦA ${activeIslandName.toUpperCase()}`} <span>✦</span></div></div>
          <div className="island-layout"><div className="main-column"><FarmGrid plots={plots} inventory={inventoryMap} ownIsland={ownIsland} ownerName={activeIslandName} onPlant={(plotId, crop) => void farmAction('plant_seed', { p_plot_id: plotId, p_crop_key: crop }, 'plant')} onWater={(plotId) => void farmAction('water_plot', { p_plot_id: plotId }, 'water')} onHarvest={(plotId) => void farmAction('harvest_crop', { p_plot_id: plotId }, 'harvest')} onSteal={(plotId) => void farmAction('steal_crop', { p_plot_id: plotId })} onUnlock={() => void farmAction('unlock_plot', {}, 'gold')} />
            <div className="landscape-bottom-note"><span>🌼</span> {ownIsland ? 'Chăm một mầm cây hôm nay, ngày mai có thể cả cánh đồng.' : 'Một lần ghé thăm cũng đủ làm ngày của ai đó vui hơn.'}</div>
          </div><aside className="side-column">{ownIsland ? <ShopInventory inventory={inventory} gold={ownProfile?.gold ?? 0} onBuy={(key, quantity) => void farmAction('buy_seed', { p_crop_key: key, p_quantity: quantity }, 'gold')} onSell={(key, quantity) => void farmAction('sell_crop', { p_crop_key: key, p_quantity: quantity }, 'gold')} /> : <NeighborList neighbors={neighbors} currentUserId={session.user.id} visitingId={visiting?.id ?? null} onVisit={visitIsland} />}<Guestbook entries={guestbook} ownIsland={ownIsland} onMessage={(text) => void farmAction('leave_message', { p_island_owner_id: islandId, p_content: text })} />{ownIsland && <NeighborList neighbors={neighbors} currentUserId={session.user.id} visitingId={null} onVisit={visitIsland} />}</aside></div>
        </>}
      </main>
      <footer className="game-footer"><span>🌱 SKY-ISLAND HOMESTEAD</span><span>Trồng cây · Kết bạn · Cùng nhau lớn lên</span><span>MADE WITH <b>♥</b> IN THE CLOUDS</span></footer>
      {busy && <div className="action-loading" role="status"><span>✨</span> Đang gửi lời nhắn lên mây…</div>}
    </div>
  );
}
