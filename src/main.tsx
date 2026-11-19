import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/inter';
import 'leaflet/dist/leaflet.css';
import './styles/global.css';
import App from './App';

// Service worker: caché de la aplicación para apertura rápida e instalación como app
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
