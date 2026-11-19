import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CircleAlert, LayoutDashboard, LogIn, LogOut, ShieldCheck, UserPlus } from 'lucide-react';
import { supabase, friendlyError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABEL } from '../lib/format';
import { Spinner } from '../components/ui';

export default function AccountPage() {
  const { user, profile, isAnonymous, isStaff, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const redirect = (location.state as { from?: string } | null)?.from;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Escriba un correo válido.'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') {
        if (isAnonymous) await supabase.auth.signOut();
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        await refreshProfile();
        toast('Sesión iniciada');
        navigate(redirect ?? '/', { replace: true });
      } else {
        // Si hay una sesión anónima, se convierte en cuenta para conservar sus reportes
        if (isAnonymous) {
          const { error: err } = await supabase.auth.updateUser({ email, password, data: { display_name: name || null } });
          if (err) throw err;
          setInfo('Revise su correo para confirmar la cuenta. Sus reportes anteriores quedarán asociados a ella.');
        } else {
          const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name || null } } });
          if (err) throw err;
          if (data.session) { toast('Cuenta creada'); navigate('/', { replace: true }); }
          else setInfo('Cuenta creada. Revise su correo para confirmarla y luego ingrese.');
        }
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (user && !isAnonymous) {
    return (
      <div className="container container-narrow page">
        <h1>Mi cuenta</h1>
        <div className="card card-pad stack">
          <dl className="summary" style={{ margin: 0 }}>
            <div><dt>Nombre</dt><dd>{profile?.display_name || '—'}</dd></div>
            <div><dt>Correo</dt><dd>{user.email}</dd></div>
            <div><dt>Rol</dt><dd className="row" style={{ gap: 6 }}><ShieldCheck size={16} color="var(--green)" />{ROLE_LABEL[profile?.role ?? 'ciudadano']}</dd></div>
          </dl>
          <div className="row">
            {isStaff && <Link to="/panel" className="btn btn-navy"><LayoutDashboard size={18} />Ir al panel</Link>}
            <Link to="/mis-reportes" className="btn">Mis reportes</Link>
            <button className="btn" onClick={async () => { await signOut(); toast('Sesión cerrada'); navigate('/'); }}><LogOut size={18} />Cerrar sesión</button>
          </div>
        </div>
        {!isStaff && (
          <p className="small muted" style={{ marginTop: 12 }}>
            Los permisos de revisor los asigna el administrador técnico del prototipo.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="container page" style={{ maxWidth: 480 }}>
      <h1>{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</h1>
      <p className="muted">
        {mode === 'login'
          ? 'Para revisores y ciudadanos con cuenta. Para reportar no necesita cuenta.'
          : 'Opcional: le permite ver sus reportes desde cualquier dispositivo.'}
      </p>
      <div className="segmented" role="tablist" style={{ marginBottom: 14 }}>
        <button role="tab" aria-selected={mode === 'login'} aria-pressed={mode === 'login'} onClick={() => setMode('login')}><LogIn size={16} />Ingresar</button>
        <button role="tab" aria-selected={mode === 'signup'} aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}><UserPlus size={16} />Crear cuenta</button>
      </div>
      <form className="card card-pad stack" onSubmit={onSubmit} noValidate>
        {mode === 'signup' && (
          <div className="field">
            <label className="label" htmlFor="name">Nombre o alias <span className="opt">(opcional)</span></label>
            <input id="name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div className="field">
          <label className="label" htmlFor="pw">Contraseña</label>
          <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required />
          {mode === 'signup' && <span className="help">Mínimo 8 caracteres. Se almacena cifrada (nunca en texto plano).</span>}
        </div>
        {error && <p className="error-text" role="alert"><CircleAlert size={16} />{error}</p>}
        {info && <div className="alert alert-success" role="status">{info}</div>}
        <button className="btn btn-navy btn-lg" type="submit" disabled={busy}>
          {busy ? <Spinner label="Procesando…" /> : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  );
}
