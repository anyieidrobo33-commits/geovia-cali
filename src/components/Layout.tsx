import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { House, LayoutDashboard, ListChecks, LogIn, Map as MapIcon, Plus, Search, Smartphone, User, WifiOff } from 'lucide-react';
import logoPin from '../assets/logo-pin.png';
import { useAuth } from '../context/AuthContext';
import { useInstallPrompt, useOnline } from '../hooks/useInstallPrompt';
import { InstallDialog } from './InstallCard';

export default function Layout() {
  const { isStaff, user, isAnonymous } = useAuth();
  const online = useOnline();
  const install = useInstallPrompt();
  const [showInstall, setShowInstall] = useState(false);
  const { pathname } = useLocation();
  const fullBleed = pathname === '/mapa';
  // Cada pantalla nueva empieza arriba
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const signedIn = Boolean(user && !isAnonymous);

  const onInstall = async () => {
    if (install.canPrompt) await install.install();
    else setShowInstall(true);
  };

  return (
    <div className="app">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="GeoVía Cali, inicio">
            <img src={logoPin} alt="" width={33} height={40} />
            <span className="brand-text">GeoVía <span>Cali</span></span>
          </Link>
          <nav className="nav-desktop" aria-label="Principal">
            <NavLink to="/mapa"><MapIcon size={18} />Mapa</NavLink>
            <NavLink to="/reportar"><Plus size={18} />Reportar</NavLink>
            <NavLink to="/seguimiento"><Search size={18} />Seguimiento</NavLink>
            <NavLink to="/mis-reportes"><ListChecks size={18} />Mis reportes</NavLink>
            {isStaff && <NavLink to="/panel"><LayoutDashboard size={18} />Panel</NavLink>}
          </nav>
          <div className="header-actions">
            {!install.installed && (
              <button className="btn btn-sm btn-ghost" onClick={onInstall} title="Instalar GeoVía en este dispositivo">
                <Smartphone size={18} /> <span className="hide-sm">Instalar app</span>
              </button>
            )}
            <NavLink to="/cuenta" className="btn btn-sm" aria-label={signedIn ? 'Mi cuenta' : 'Ingresar'}>
              {signedIn ? <User size={18} /> : <LogIn size={18} />}
              <span className="hide-sm">{signedIn ? 'Cuenta' : 'Ingresar'}</span>
            </NavLink>
          </div>
        </div>
      </header>
      {!online && (
        <div className="offline-bar" role="status">
          <WifiOff size={16} /> Sin conexión. Puede seguir preparando su reporte; se enviará cuando vuelva la señal.
        </div>
      )}

      <main id="contenido" className={fullBleed ? 'main main-map' : 'main'}>
        <Outlet />
      </main>

      {!fullBleed && <footer className="footer">
        <div className="container footer-inner">
          <span>© {new Date().getFullYear()} GeoVía Cali · Cristian Camilo Alvarado Cardona y Anyie Tatiana Idrobo García · Ingeniería de Sistemas, UNAD</span>
          <span className="row" style={{ gap: 16 }}>
            <Link to="/ayuda">Ayuda</Link>
            <Link to="/acerca">Acerca y privacidad</Link>
            <a href="https://www.cali.gov.co/infraestructura/" target="_blank" rel="noreferrer">Canales oficiales</a>
          </span>
        </div>
      </footer>}

      <nav className="tabbar" aria-label="Navegación móvil">
        <NavLink to="/" end><House size={22} />Inicio</NavLink>
        <NavLink to="/mapa"><MapIcon size={22} />Mapa</NavLink>
        <NavLink to="/reportar" className="tab-cta"><span className="cta-bubble"><Plus size={26} strokeWidth={2.6} /></span>Reportar</NavLink>
        <NavLink to="/seguimiento"><Search size={22} />Seguimiento</NavLink>
        {isStaff
          ? <NavLink to="/panel"><LayoutDashboard size={22} />Panel</NavLink>
          : <NavLink to="/mis-reportes"><ListChecks size={22} />Mis reportes</NavLink>}
      </nav>

      {showInstall && <InstallDialog onClose={() => setShowInstall(false)} />}
    </div>
  );
}
