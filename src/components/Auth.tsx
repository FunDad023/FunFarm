import { useState } from 'react';
import type { FormEvent } from 'react';
import { CloudSun, Leaf, LockKeyhole, Sprout } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthProps { onAuthenticated: () => void }

export function Auth({ onAuthenticated }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanUsername = username.replace(/\s+/g, '').toLowerCase();
    if (!/^[a-z0-9]{3,24}$/.test(cleanUsername)) {
      setMessage('Tên nông trại gồm 3–24 chữ cái thường hoặc chữ số nhé.');
      return;
    }
    if (password.length < 8) {
      setMessage('Mật khẩu cần ít nhất 8 ký tự.');
      return;
    }
    setBusy(true);
    setMessage('');
    const email = `${cleanUsername}@skyfarm.local`;
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: cleanUsername } },
        });
        if (error) throw error;
        if (!data.session) {
          const login = await supabase.auth.signInWithPassword({ email, password });
          if (login.error) throw new Error('Tài khoản đã tạo. Hãy chuyển sang Đăng nhập để vào đảo.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onAuthenticated();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Chưa thể kết nối dịch vụ đăng nhập.';
      setMessage(detail.toLowerCase().includes('already registered') || detail.toLowerCase().includes('user already registered')
        ? 'Tên này đã có người sử dụng. Hãy đăng nhập hoặc chọn tên khác.'
        : detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-sky" aria-hidden="true"><span>☁</span><span>☁</span><span>✦</span><span>☁</span></div>
      <section className="auth-card">
        <div className="auth-art">
          <div className="sun-disc"><CloudSun size={25} /></div>
          <div className="island-scene"><span className="island-house">🏡</span><span className="island-tree tree-a">🌳</span><span className="island-tree tree-b">🌲</span><span className="island-crop">🌾 🌷 🌾</span></div>
          <span className="floating-leaf leaf-one">✿</span><span className="floating-leaf leaf-two">✦</span>
          <div className="auth-art-copy"><span className="eyebrow">MỘT GÓC BÌNH YÊN TRÊN MÂY</span><h1>Chậm một chút,<br />vườn sẽ nở hoa.</h1><p>Gieo hạt, kết bạn, cùng khu vườn lớn lên mỗi ngày.</p></div>
        </div>
        <div className="auth-form-side">
          <div className="brand-lockup"><span className="brand-icon"><Sprout size={20} /></span><span>Sky-Island <b>Homestead</b></span></div>
          <div className="auth-welcome"><span className="eyebrow"><Leaf size={12} /> VƯỜN TRÊN MÂY</span><h2>{mode === 'signup' ? 'Chào người bạn mới!' : 'Mừng bạn trở lại!'}</h2><p>{mode === 'signup' ? 'Tạo nông trại nhỏ của riêng bạn nhé.' : 'Nhập tên và mật khẩu để về đảo.'}</p></div>
          <div className="auth-switch"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setMessage(''); }} type="button">Đăng nhập</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setMessage(''); }} type="button">Tạo tài khoản</button></div>
          <form className="auth-form" onSubmit={submit}>
            <label>Tên người dùng<div className="input-wrap"><Leaf size={16} /><input autoComplete="username" autoCapitalize="none" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="nongdan01" minLength={3} maxLength={24} required /></div><small>Chỉ dùng chữ cái và chữ số.</small></label>
            <label>Mật khẩu<div className="input-wrap"><LockKeyhole size={16} /><input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ít nhất 8 ký tự" minLength={8} maxLength={72} required /></div><small>Mật khẩu được Supabase Auth bảo vệ.</small></label>
            {message && <div className="auth-message" role="alert">{message}</div>}
            <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Đang mở cổng mây…' : mode === 'signup' ? 'Bắt đầu gieo trồng' : 'Về nông trại'}<span>→</span></button>
          </form>
          <p className="auth-footnote">🌱 Đảo mới bắt đầu với 100 vàng và 5 hạt lúa mì.</p>
        </div>
      </section>
      <footer className="auth-footer">SKY-ISLAND HOMESTEAD <span>·</span> MADE FOR SLOW DAYS</footer>
    </main>
  );
}
