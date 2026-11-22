// Informes PDF generados en el navegador (jsPDF + QR). Se cargan bajo demanda.
import logoPinUrl from '../assets/logo-pin.png';
import type { HistoryEntry, PublicStats, Report, ReportUpdate } from './api';
import { CATEGORIES, SEVERITIES, categoryMeta, conditionMeta, statusMeta } from './domain';
import { fmtCoord, fmtDateTime, ROLE_LABEL } from './format';

type JsPDF = import('jspdf').jsPDF;
const NAVY: [number, number, number] = [0, 49, 99];
const GREEN: [number, number, number] = [47, 122, 18];
const INK: [number, number, number] = [27, 42, 58];
const MUTED: [number, number, number] = [107, 122, 140];
const LINE: [number, number, number] = [219, 227, 236];
const BAR: [number, number, number] = [29, 79, 134];
const M = 16; // margen en mm
const shortDate = (iso: string) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }).format(new Date(iso));

/** Las fuentes estándar de PDF usan WinAnsi: se reemplazan símbolos fuera de ese juego. */
const clean = (s: string | null | undefined) =>
  (s ?? '').replace(/→/g, '->').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF—–“”‘’…•€]/g, '');

async function toDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const data: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob); });
    const dims: { w: number; h: number } = await new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 4, h: 3 }); i.src = data; });
    return { data, ...dims };
  } catch { return null; }
}

async function setup(title: string, qrTarget: string) {
  const [{ jsPDF }, QR] = await Promise.all([import('jspdf'), import('qrcode')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  // Encabezado
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 26, 'F');
  const logo = await toDataUrl(logoPinUrl);
  if (logo) { doc.setFillColor(255, 255, 255); doc.roundedRect(M - 2, 4, 15, 18, 2, 2, 'F'); doc.addImage(logo.data, 'PNG', M - 0.5, 5, 12, 12 * logo.h / logo.w); }
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('GeoVía Cali', M + 17, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  doc.text(clean(title), M + 17, 18);
  doc.setFontSize(8);
  doc.text(clean(`Generado: ${fmtDateTime(new Date().toISOString())}`), W - M, 12, { align: 'right' });
  doc.text('geovia-cali.vercel.app', W - M, 18, { align: 'right' });
  const qr = await QR.toDataURL(qrTarget, { margin: 1, width: 240, color: { dark: '#003163', light: '#ffffff' } });
  return { doc, W, qr };
}

function footer(doc: JsPDF) {
  const n = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE); doc.line(M, H - 14, W - M, H - 14);
    doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(clean('Prototipo académico (UNAD). No es un canal oficial de la Alcaldía de Santiago de Cali. «Validado» indica registro consistente, no inspección oficial.'), W - 2 * M - 26), M, H - 9.5);
    doc.text(`Página ${p} de ${n}`, W - M, H - 9.5, { align: 'right' });
  }
}

function sectionTitle(doc: JsPDF, y: number, text: string) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...NAVY);
  doc.text(clean(text), M, y);
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.6); doc.line(M, y + 1.8, M + 14, y + 1.8); doc.setLineWidth(0.2);
  return y + 8;
}

function ensure(doc: JsPDF, y: number, need: number) {
  const H = doc.internal.pageSize.getHeight();
  if (y + need > H - 20) { doc.addPage(); return 20; }
  return y;
}

/** Ficha completa de un reporte. */
export async function reportPdf(r: Report, history: HistoryEntry[], updates: ReportUpdate[], photoUrls: string[], updatePhotoUrls: Record<string, string>) {
  const url = `${window.location.origin}/r/${r.code}`;
  const { doc, W, qr } = await setup('Ficha de reporte ciudadano', url);
  let y = 38;
  doc.addImage(qr, 'PNG', W - M - 30, 30, 30, 30);
  doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text('Escanee para ver en línea', W - M - 15, 63, { align: 'center' });

  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...NAVY);
  doc.text(clean(categoryMeta(r.category_code).name), M, y);
  doc.setFont('courier', 'bold'); doc.setFontSize(13); doc.setTextColor(...INK);
  doc.text(r.code, M, y + 8);
  const st = statusMeta(r.status);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  const tw = doc.getTextWidth(clean(st.label)) + 8;
  doc.setFillColor(238, 247, 230); doc.setDrawColor(201, 228, 179); doc.roundedRect(M, y + 12, tw, 7, 3.5, 3.5, 'FD');
  doc.setTextColor(...GREEN); doc.text(clean(st.label), M + 4, y + 16.8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize(clean(st.description), W - M - 36 - (M + tw + 4)).slice(0, 2), M + tw + 4, y + 15.5);
  y += 30;

  // Datos
  const facts: [string, string][] = [
    ['Severidad percibida', SEVERITIES.find((s) => s.code === r.severity)?.label ?? r.severity],
    ['Barrio o sector', r.sector ?? '—'],
    ['Dirección aproximada', r.address ?? '—'],
    ['Coordenadas (WGS84)', fmtCoord(r.lat, r.lng)],
    ['Origen de la ubicación', r.location_source === 'gps' ? `GPS${r.location_accuracy_m ? ` (± ${Math.round(r.location_accuracy_m)} m)` : ''}` : 'Marcada en el mapa'],
    ['Registrado', fmtDateTime(r.created_at)],
    ['Última actualización', fmtDateTime(r.updated_at)],
    ['Apoyos ciudadanos', String(r.supports_count ?? 0)],
  ];
  const colW = (W - 2 * M) / 2;
  facts.forEach(([k, v], i) => {
    const x = M + (i % 2) * colW, yy = y + Math.floor(i / 2) * 12;
    doc.setFillColor(244, 247, 250); doc.roundedRect(x, yy - 4.5, colW - 3, 10.5, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(...MUTED); doc.text(clean(k.toUpperCase()), x + 3, yy - 0.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK); doc.text(clean(doc.splitTextToSize(v, colW - 8)[0]), x + 3, yy + 4.2);
  });
  y += Math.ceil(facts.length / 2) * 12 + 6;

  y = sectionTitle(doc, y, 'Descripción');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK);
  const desc = doc.splitTextToSize(clean(r.description), W - 2 * M);
  doc.text(desc, M, y); y += desc.length * 5 + 2;
  if (r.reference) { doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(clean(`Referencia: ${r.reference}`), M, y); y += 6; }

  // Fotos
  const photos = (await Promise.all(photoUrls.slice(0, 2).map(toDataUrl))).filter(Boolean) as { data: string; w: number; h: number }[];
  if (photos.length) {
    y = ensure(doc, y + 4, 80);
    y = sectionTitle(doc, y, 'Evidencia fotográfica');
    const boxW = (W - 2 * M - 6) / 2, boxH = 70;
    photos.forEach((p, i) => {
      const s = Math.min(boxW / p.w, boxH / p.h), w = p.w * s, h = p.h * s;
      const x = M + i * (boxW + 6) + (boxW - w) / 2;
      doc.setFillColor(234, 240, 245); doc.roundedRect(M + i * (boxW + 6), y, boxW, boxH, 2, 2, 'F');
      doc.addImage(p.data, 'JPEG', x, y + (boxH - h) / 2, w, h);
    });
    y += boxH + 8;
  }

  // Historial
  y = ensure(doc, y, 30);
  y = sectionTitle(doc, y, 'Historial de estados (bitácora)');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...MUTED);
  const cols = [M, M + 32, M + 72, M + 106];
  ['FECHA', 'ESTADO', 'RESPONSABLE', 'MOTIVO'].forEach((h, i) => doc.text(h, cols[i], y));
  y += 2; doc.setDrawColor(...LINE); doc.line(M, y, W - M, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK);
  for (const h of history) {
    const reason = doc.splitTextToSize(clean(h.reason), W - M - cols[3]);
    y = ensure(doc, y, reason.length * 4 + 4);
    doc.setFontSize(8.5);
    doc.text(clean(shortDate(h.created_at)), cols[0], y);
    doc.text(clean(statusMeta(h.to_status).label), cols[1], y);
    doc.text(clean(h.actor_role ? ROLE_LABEL[h.actor_role] : 'Sistema'), cols[2], y);
    doc.text(reason, cols[3], y);
    y += Math.max(1, reason.length) * 4 + 3;
  }

  // Actualizaciones ciudadanas
  if (updates.length) {
    y = ensure(doc, y + 2, 30);
    y = sectionTitle(doc, y, `Actualizaciones ciudadanas en el sitio (${updates.length})`);
    for (const u of updates.slice(0, 8)) {
      y = ensure(doc, y, 26);
      const img = updatePhotoUrls[u.photo_path] ? await toDataUrl(updatePhotoUrls[u.photo_path]) : null;
      if (img) { const s = Math.min(28 / img.w, 21 / img.h); doc.addImage(img.data, 'JPEG', M, y - 3, img.w * s, img.h * s); }
      const x = M + 32;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...NAVY); doc.text(clean(conditionMeta(u.condition).label), x, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text(clean(`${shortDate(u.created_at)} · foto tomada a ${Math.round(u.distance_m)} m del daño`), x, y + 4.5);
      if (u.comment) { doc.setTextColor(...INK); doc.setFontSize(8.5); doc.text(doc.splitTextToSize(clean(u.comment), W - M - x).slice(0, 3), x, y + 9.5); }
      y += 25;
    }
  }

  footer(doc);
  doc.save(`GeoVia-Cali_${r.code}.pdf`);
}

/** Informe de la ciudad con indicadores agregados. */
export async function cityPdf(s: PublicStats) {
  const { doc, W, qr } = await setup('Informe de la malla vial según reportes ciudadanos', `${window.location.origin}/estadisticas`);
  let y = 38;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...NAVY);
  doc.text('Estado de la malla vial de Santiago de Cali', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize(clean('Indicadores agregados a partir de los reportes ciudadanos visibles en GeoVía Cali. Sin datos personales.'), W - 2 * M - 30), M, y + 6);
  doc.addImage(qr, 'PNG', W - M - 22, 30, 22, 22);
  y += 16;

  const pct = s.total ? Math.round((s.verificados / s.total) * 100) : 0;
  const kpis: [string, string][] = [
    [String(s.total), 'Reportes visibles'], [`${pct}%`, 'Verificados por revisores'], [String(s.sin_verificar), 'Pendientes de verificación'],
    [String(s.apoyos), 'Apoyos ciudadanos'], [String(s.actualizaciones), 'Actualizaciones en el sitio'],
    [s.horas_validacion_mediana != null ? `${String(s.horas_validacion_mediana).replace('.', ',')} h` : '—', 'Mediana hasta verificar'],
    [String(s.por_severidad.alta ?? 0), 'Daños de severidad alta'], [String(s.reparados_segun_ciudadanos), 'Reparados según ciudadanos'],
  ];
  const kw = (W - 2 * M - 9) / 4;
  kpis.forEach(([v, k], i) => {
    const x = M + (i % 4) * (kw + 3), yy = y + Math.floor(i / 4) * 22;
    doc.setDrawColor(...LINE); doc.setFillColor(255, 255, 255); doc.roundedRect(x, yy, kw, 19, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...NAVY); doc.text(clean(v), x + 4, yy + 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(clean(k), x + 4, yy + 15);
  });
  y += 50;

  // Tendencia semanal
  y = sectionTitle(doc, y, 'Reportes registrados por semana (últimas 12 semanas)');
  const chH = 38, chW = W - 2 * M, max = Math.max(1, ...s.por_semana.map((d) => d.n));
  const bw = chW / s.por_semana.length;
  doc.setDrawColor(...LINE); doc.line(M, y + chH, M + chW, y + chH);
  s.por_semana.forEach((d, i) => {
    const h = (d.n / max) * (chH - 6);
    if (d.n > 0) { doc.setFillColor(...BAR); doc.rect(M + i * bw + 1.5, y + chH - h, bw - 3, h, 'F');
      doc.setFontSize(7); doc.setTextColor(...INK); doc.text(String(d.n), M + i * bw + bw / 2, y + chH - h - 1.5, { align: 'center' }); }
    if (i % 2 === 1) { doc.setFontSize(6.5); doc.setTextColor(...MUTED);
      doc.text(new Date(d.semana).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }), M + i * bw + bw / 2, y + chH + 4, { align: 'center' }); }
  });
  y += chH + 12;

  const bars = (title: string, rows: { label: string; n: number }[]) => {
    y = ensure(doc, y, 14 + rows.length * 7);
    y = sectionTitle(doc, y, title);
    const mx = Math.max(1, ...rows.map((r) => r.n)), lw = 62, bwid = W - 2 * M - lw - 12;
    if (!rows.length) { doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text('Sin datos.', M, y); y += 8; return; }
    rows.forEach((r) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INK);
      doc.text(clean(doc.splitTextToSize(r.label, lw - 2)[0]), M, y + 3);
      doc.setFillColor(234, 240, 245); doc.rect(M + lw, y, bwid, 4, 'F');
      doc.setFillColor(...BAR); doc.rect(M + lw, y, Math.max(1, (r.n / mx) * bwid), 4, 'F');
      doc.setFont('helvetica', 'bold'); doc.text(String(r.n), W - M, y + 3, { align: 'right' });
      y += 7;
    });
    y += 4;
  };
  bars('Tipos de daño más reportados', CATEGORIES.map((c) => ({ label: c.name, n: s.por_categoria[c.code] ?? 0 })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n));
  bars('Barrios con más reportes', s.top_sectores.map((t) => ({ label: t.sector, n: t.n })));
  bars('Estado de verificación', Object.entries(s.por_estado).map(([k, n]) => ({ label: statusMeta(k).label, n: n ?? 0 })));

  if (s.mas_apoyados.length) {
    y = ensure(doc, y, 14 + s.mas_apoyados.length * 6);
    y = sectionTitle(doc, y, 'Reportes más apoyados por la ciudadanía');
    s.mas_apoyados.forEach((m, i) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
      doc.text(clean(`${i + 1}. ${m.code} · ${categoryMeta(m.category_code).name} · ${m.sector ?? ''} · ${m.apoyos} apoyos · ${statusMeta(m.status).label}`), M, y);
      y += 6;
    });
  }

  footer(doc);
  doc.save(`GeoVia-Cali_informe_${new Date().toISOString().slice(0, 10)}.pdf`);
}
