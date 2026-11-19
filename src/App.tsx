import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MapPinOff, ShieldAlert } from 'lucide-react';
import Layout from './components/Layout';
import { CenterState, Spinner } from './components/ui';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { isConfigured } from './lib/supabase';
import HomePage from './pages/HomePage';

const MapPage = lazy(() => import('./pages/MapPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const ConfirmationPage = lazy(() => import('./pages/ConfirmationPage'));
const TrackPage = lazy(() => import('./pages/TrackPage'));
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'));
const MyReportsPage = lazy(() => import('./pages/MyReportsPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const PanelPage = lazy(() => import('./pages/PanelPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

/** Protección de rutas en la interfaz. La protección real la aplica el servidor (RLS + RPC). */
function RequireStaff({ admin = false, children }: { admin?: boolean; children: ReactNode }) {
  const { ready, isStaff, isAdmin, user, isAnonymous } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="container page"><Spinner label="Verificando permisos…" /></div>;
  if (!user || isAnonymous) return <Navigate to="/cuenta" replace state={{ from: location.pathname }} />;
  if (admin ? !isAdmin : !isStaff) {
    return (
      <div className="container page">
        <CenterState icon={<ShieldAlert size={30} />} title="Acceso restringido">
          <p>Esta sección es solo para {admin ? 'el administrador técnico' : 'revisores autorizados'}.</p>
          <Link to="/" className="btn">Ir al inicio</Link>
        </CenterState>
      </div>
    );
  }
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="container page">
      <CenterState icon={<MapPinOff size={30} />} title="Página no encontrada">
        <p>La dirección no existe o fue movida.</p>
        <Link to="/" className="btn btn-navy">Volver al inicio</Link>
      </CenterState>
    </div>
  );
}

function ConfigMissing() {
  return (
    <div className="container container-narrow page prose">
      <h1>Falta configurar el servidor</h1>
      <p>Defina las variables de entorno <span className="kbd">VITE_SUPABASE_URL</span> y <span className="kbd">VITE_SUPABASE_ANON_KEY</span> (archivo <span className="kbd">.env.local</span> o
        configuración del proyecto en Vercel) y vuelva a compilar. Consulte el README del repositorio.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<div className="container page"><Spinner label="Cargando…" /></div>}>
            <Routes>
              <Route element={<Layout />}>
                {!isConfigured ? <Route path="*" element={<ConfigMissing />} /> : (
                  <>
                    <Route index element={<HomePage />} />
                    <Route path="mapa" element={<MapPage />} />
                    <Route path="reportar" element={<ReportPage />} />
                    <Route path="confirmacion/:code" element={<ConfirmationPage />} />
                    <Route path="seguimiento" element={<TrackPage />} />
                    <Route path="r/:code" element={<ReportDetailPage />} />
                    <Route path="mis-reportes" element={<MyReportsPage />} />
                    <Route path="cuenta" element={<AccountPage />} />
                    <Route path="ingresar" element={<Navigate to="/cuenta" replace />} />
                    <Route path="acerca" element={<AboutPage />} />
                    <Route path="panel" element={<RequireStaff><PanelPage /></RequireStaff>} />
                    <Route path="panel/usuarios" element={<RequireStaff admin><UsersPage /></RequireStaff>} />
                    <Route path="*" element={<NotFound />} />
                  </>
                )}
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
