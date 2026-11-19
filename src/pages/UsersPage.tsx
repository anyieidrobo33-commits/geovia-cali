import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { listUsers, setUserRole, type AppUser } from '../lib/api';
import type { UserRole } from '../lib/domain';
import { fmtDate, ROLE_LABEL } from '../lib/format';
import { friendlyError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Spinner } from '../components/ui';

export default function UsersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => listUsers().then(setUsers).catch((e) => { setError(friendlyError(e)); setUsers([]); });
  useEffect(() => { load(); }, []);

  const change = async (u: AppUser, role: UserRole) => {
    try {
      await setUserRole(u.id, role);
      toast(`${u.email}: ahora es ${ROLE_LABEL[role]}`);
      load();
    } catch (e) { toast(friendlyError(e), 'error'); }
  };

  return (
    <div className="container page">
      <Link to="/panel" className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><ArrowLeft size={16} />Volver al panel</Link>
      <div className="page-head" style={{ marginTop: 6 }}>
        <div>
          <h1>Usuarios y roles</h1>
          <p>Asigne el rol de revisor a las personas que moderarán reportes. Cada cambio se valida en el servidor.</p>
        </div>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {users === null ? <Spinner label="Cargando usuarios…" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Correo</th><th>Nombre</th><th>Reportes</th><th>Desde</th><th>Rol</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.display_name || '—'}</td>
                  <td>{u.reports_count}</td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td>
                    <select className="select input" style={{ minHeight: 38, padding: '4px 8px' }} value={u.role}
                      disabled={u.id === user?.id} onChange={(e) => change(u, e.target.value as UserRole)} aria-label={`Rol de ${u.email}`}>
                      <option value="ciudadano">{ROLE_LABEL.ciudadano}</option>
                      <option value="revisor">{ROLE_LABEL.revisor}</option>
                      <option value="admin">{ROLE_LABEL.admin}</option>
                    </select>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>No hay cuentas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
