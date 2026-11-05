import { useState, type FormEvent } from 'react';
import { LockKeyhole, MessageCircle, ShieldCheck } from 'lucide-react';
import { ApiError, apiRequest, type ApiUser } from './services/api';

export interface Session { accessToken: string; user: ApiUser }

export default function AuthScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { email, password, username, displayName };
      const session = await apiRequest<Session>(path, undefined, { method: 'POST', body: JSON.stringify(body) });
      onLogin(session);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not sign in. Please try again.');
    } finally { setBusy(false); }
  }

  return <div className="auth-screen"><div className="auth-art"><div className="auth-orb orb-one"/><div className="auth-orb orb-two"/><div className="auth-brand"><span className="brand-mark"><LockKeyhole size={19}/></span><strong>Chaty</strong></div><div className="auth-message-art"><div className="art-chat art-chat-one"><span className="art-avatar peach">MC</span><div><b>Good morning ☀️</b><small>Shall we go over the files?</small></div></div><div className="art-chat art-chat-two"><span className="art-avatar green">JD</span><div><b>Just sent them over!</b><small><ShieldCheck size={12}/> Shared privately</small></div></div><div className="art-file"><span className="art-pdf">PDF</span><div><b>Project notes.pdf</b><small>2.4 MB · ready to view</small></div><span className="art-download">↓</span></div></div><div className="auth-art-caption"><span className="auth-caption-icon"><MessageCircle size={16}/></span><div><strong>A little closer, wherever you are.</strong><p>Messages and files, shared with care.</p></div></div><div className="auth-art-bottom">PRIVATE BY DESIGN <span/> MADE FOR EVERYDAY</div></div><div className="auth-form-side"><form className="auth-form" onSubmit={submit}><div className="auth-mobile-brand"><span className="brand-mark"><LockKeyhole size={18}/></span><strong>Chaty</strong></div><p className="auth-eyebrow">YOUR SPACE, YOUR PEOPLE</p><h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1><p className="auth-subtitle">{mode === 'login' ? 'Sign in to pick up where you left off.' : 'A more personal way to stay in touch.'}</p>{error && <div className="auth-error">{error}</div>}{mode === 'register' && <><label>Display name<input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How people will know you" maxLength={80}/></label><label>Username<input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username" minLength={3} maxLength={40} pattern="[A-Za-z0-9_]+"/><small>Letters, numbers, and underscores</small></label></>}<label>Email address<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label><label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 10 characters' : 'Enter your password'} minLength={mode === 'register' ? 10 : 1} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'}/></label><button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}<span>→</span></button><p className="auth-toggle">{mode === 'login' ? 'New to Chaty?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p><div className="auth-security"><ShieldCheck size={15}/><span>Your password is encrypted before it is stored.</span></div></form><div className="auth-server-note">Connects to your configured Chaty server</div></div></div>;
}
