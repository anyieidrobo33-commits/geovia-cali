// Evaluación con participantes: encuesta diagnóstica, tareas de uso y escala SUS.
import { supabase } from './supabase';

export interface Question {
  id: string;
  text: string;
  kind: 'single' | 'multi' | 'open';
  options?: string[];
  help?: string;
  section?: string;
}

/** Filtros de participación (no hacen parte de las 15 preguntas). */
export const FILTERS: Question[] = [
  { id: 'C1', text: '¿Acepta participar de manera voluntaria en esta evaluación?', kind: 'single', options: ['Sí, acepto', 'No, no acepto'] },
  { id: 'C2', text: '¿Tiene 18 años o más?', kind: 'single', options: ['Sí', 'No'] },
  { id: 'C3', text: '¿Reside, estudia, trabaja o transita habitualmente por Santiago de Cali?', kind: 'single', options: ['Sí', 'No'] },
];

export const DIAGNOSTIC: Question[] = [
  { id: 'P01', section: 'Experiencia vial', text: '¿Con qué frecuencia se desplaza por las vías de Santiago de Cali?', kind: 'single',
    options: ['Todos o casi todos los días', 'De 2 a 4 días por semana', 'Una vez por semana', 'Menos de una vez por semana'] },
  { id: 'P02', text: '¿Cuál es su medio principal de desplazamiento en la ciudad?', kind: 'single',
    options: ['Transporte público (bus o MIO)', 'Motocicleta', 'Automóvil particular o taxi', 'Bicicleta', 'A pie', 'Otro'] },
  { id: 'P03', text: 'Durante los últimos tres meses, ¿con qué frecuencia ha observado huecos, grietas, hundimientos u otros daños en las vías que utiliza?', kind: 'single',
    options: ['Todos o casi todos los días', 'Varias veces por semana', 'Algunas veces al mes', 'Rara vez', 'Nunca'] },
  { id: 'P04', text: '¿Qué tipos de afectaciones viales ha observado con mayor frecuencia?', kind: 'multi', help: 'Puede seleccionar varias respuestas.',
    options: ['Huecos o baches', 'Grietas o fisuras', 'Hundimientos o deformaciones del pavimento', 'Desniveles o tapas de alcantarilla deterioradas', 'Deterioro de señalización o demarcación', 'No he observado afectaciones', 'Otro'] },
  { id: 'P05', text: '¿Qué consecuencias ha experimentado o percibido debido al deterioro de las vías?', kind: 'multi', help: 'Puede seleccionar varias respuestas.',
    options: ['Retrasos en los desplazamientos', 'Riesgo de caídas o accidentes', 'Posibles daños a vehículos o bicicletas', 'Desvíos o cambios de ruta', 'Incomodidad o dificultad para desplazarse', 'No he percibido consecuencias', 'Otra'] },
  { id: 'P06', section: 'Canales de reporte existentes', text: 'Durante los últimos 12 meses, ¿ha comunicado alguna afectación vial a una entidad, medio de atención o canal ciudadano?', kind: 'single',
    options: ['Sí', 'No', 'No recuerda'] },
  { id: 'P07', text: '¿Qué medio ha utilizado para comunicar o informar una afectación vial?', kind: 'single', help: 'Si ha utilizado varios, seleccione el más reciente.',
    options: ['Línea telefónica o atención presencial', 'Sitio web o formulario de una entidad', 'WhatsApp u otro servicio de mensajería', 'Redes sociales', 'Aplicación móvil', 'Otro medio', 'No he realizado reportes'] },
  { id: 'P08', text: '¿Cuál considera que es la principal dificultad para comunicar una afectación vial?', kind: 'single',
    options: ['No sé a qué entidad o canal acudir', 'Es difícil describir o ubicar el daño', 'El procedimiento exige demasiado tiempo', 'No tengo claridad sobre qué datos se requieren', 'No confío en obtener una respuesta', 'No encuentro dificultades', 'Otra'] },
  { id: 'P09', text: 'Cuando ha reportado una afectación vial, ¿recibió algún número de radicado, confirmación o constancia del reporte?', kind: 'single',
    options: ['Sí', 'No', 'No recuerda', 'Nunca he realizado reportes'] },
  { id: 'P10', text: 'Después de comunicar una afectación vial, ¿recibió información sobre el estado o avance de la atención?', kind: 'single',
    options: ['Sí, de manera suficiente', 'Sí, pero de manera insuficiente', 'No recibí información de seguimiento', 'Nunca he realizado reportes'] },
  { id: 'P11', text: '¿Qué tan satisfecho está con la claridad de los medios actuales para informar sobre afectaciones viales?', kind: 'single',
    options: ['Muy satisfecho', 'Satisfecho', 'Ni satisfecho ni insatisfecho', 'Insatisfecho', 'Muy insatisfecho', 'No los conozco o no los he utilizado'] },
  { id: 'P12', section: 'Acceso digital y necesidades de información', text: '¿Qué dispositivo utiliza normalmente para consultar información o realizar trámites por internet?', kind: 'single',
    options: ['Teléfono inteligente', 'Computador portátil o de escritorio', 'Ambos con frecuencia similar', 'Tableta', 'No suelo acceder a internet'] },
  { id: 'P13', text: '¿Qué información considera importante incluir al comunicar una afectación vial?', kind: 'multi', help: 'Puede seleccionar varias respuestas.',
    options: ['Ubicación o dirección aproximada', 'Tipo de daño', 'Descripción de lo ocurrido', 'Fotografía del daño', 'Fecha de observación', 'Nivel de riesgo percibido', 'Otra'] },
  { id: 'P14', text: '¿Qué información considera más importante recibir después de comunicar una afectación vial?', kind: 'single',
    options: ['Confirmación de recepción del reporte', 'Número para consultar el reporte', 'Estado actual del reporte', 'Historial de cambios o actuaciones', 'Orientación sobre la entidad competente', 'No necesito seguimiento', 'Otra'] },
  { id: 'P15', text: 'Desde su experiencia, ¿qué debería mejorar prioritariamente en los mecanismos para informar y hacer seguimiento a las afectaciones viales en Cali?', kind: 'open',
    help: 'Describa con sus palabras una necesidad o dificultad. No mencione datos personales.' },
];

export interface EvalTask {
  id: string;
  title: string;
  instruction: string;
  /** Ruta que completa la tarea automáticamente al visitarla. */
  doneRoute?: RegExp;
  askAnswer?: string;
}

export const TASKS: EvalTask[] = [
  { id: 'T1', title: 'Reportar un daño', instruction: 'Registre un reporte de práctica: marque una ubicación, elija el tipo de daño, escriba una descripción, tome o adjunte cualquier foto y envíelo. En esta evaluación el reporte no se publica.' },
  { id: 'T2', title: 'Encontrar un reporte en el mapa', instruction: 'Abra el mapa, encuentre el hueco reportado en el barrio La Flora y abra su ficha.', doneRoute: /^\/r\/GVC-2611-C7VNG\/?$/i },
  { id: 'T3', title: 'Consultar el estado con el código', instruction: 'Consulte en qué estado está el reporte con código GVC-2611-W2AGX.', doneRoute: /^\/r\/GVC-2611-W2AGX\/?$/i },
  { id: 'T4', title: 'Revisar las estadísticas', instruction: 'Encuentre cuántos reportes visibles hay en la ciudad y escriba el número abajo.', askAnswer: 'Número de reportes visibles' },
];

export interface TaskResult {
  id: string;
  completed: boolean;
  help: boolean | null;
  seconds: number;
  answer?: string;
}

export const SUS_ITEMS = [
  'Creo que me gustaría usar GeoVía Cali con frecuencia.',
  'Encontré la aplicación innecesariamente compleja.',
  'Pensé que la aplicación era fácil de usar.',
  'Creo que necesitaría el apoyo de una persona técnica para poder usar esta aplicación.',
  'Encontré que las funciones de la aplicación estaban bien integradas.',
  'Pensé que había demasiada inconsistencia en la aplicación.',
  'Imagino que la mayoría de las personas aprendería a usar esta aplicación muy rápidamente.',
  'Encontré la aplicación muy difícil de usar.',
  'Me sentí muy seguro(a) usando la aplicación.',
  'Necesité aprender muchas cosas antes de poder usar la aplicación.',
];

export function susScore(values: number[]): number {
  return values.reduce((s, v, i) => s + (i % 2 === 0 ? v - 1 : 5 - v), 0) * 2.5;
}

// ---------- Estado persistente del recorrido ----------
export type Stage = 'intro' | 'diagnostic' | 'invite' | 'tasks' | 'sus' | 'done';

export interface EvalState {
  stage: Stage;
  filters: Record<string, string>;
  diagnostic: Record<string, string | string[]>;
  task: number;          // índice de la tarea en curso
  taskStart: number | null;
  taskEnd: number | null;
  pendingHelp: boolean;  // tarea terminada, falta preguntar si necesitó ayuda
  pendingCompleted: boolean;
  results: TaskResult[];
  startedAt: number;
}

const KEY = 'geovia.evaluacion';
const EVT = 'geovia:evaluacion';

export function newState(): EvalState {
  return { stage: 'intro', filters: {}, diagnostic: {}, task: 0, taskStart: null, taskEnd: null, pendingHelp: false, pendingCompleted: true, results: [], startedAt: Date.now() };
}

export function loadEval(): EvalState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EvalState) : null;
  } catch { return null; }
}

export function saveEval(s: EvalState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch { /* almacenamiento no disponible */ }
  window.dispatchEvent(new Event(EVT));
}

export function onEvalChange(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener('storage', cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb); };
}

/** ¿Está la persona realizando la tarea de reporte de práctica? */
export function isPracticeReport(): boolean {
  const s = loadEval();
  return Boolean(s && s.stage === 'tasks' && TASKS[s.task]?.id === 'T1' && s.taskStart && !s.pendingHelp);
}

/** Marca la tarea en curso como terminada (queda pendiente la pregunta de ayuda). */
export function finishCurrentTask(completed: boolean) {
  const s = loadEval();
  if (!s || s.stage !== 'tasks' || !s.taskStart || s.pendingHelp) return;
  saveEval({ ...s, pendingHelp: true, pendingCompleted: completed, taskEnd: Date.now() });
}

export function detectDevice(): 'telefono' | 'computador' | 'tableta' {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return 'tableta';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'telefono';
  return 'computador';
}

export async function submitEvaluation(payload: {
  device: string; diagnostic: Record<string, string | string[]>; tasks: TaskResult[] | null;
  sus: number[] | null; liked: string; improve: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('submit_evaluation', { p: payload });
  if (error) throw error;
  return data as string;
}

export interface EvaluationRow {
  id: string;
  created_at: string;
  device: string | null;
  diagnostic: Record<string, string | string[]>;
  tasks: TaskResult[] | null;
  sus: number[] | null;
  sus_score: number | null;
  liked: string | null;
  improve: string | null;
}

export async function fetchEvaluations(): Promise<EvaluationRow[]> {
  const { data, error } = await supabase.from('evaluations').select('*').order('created_at');
  if (error) throw error;
  return (data ?? []) as EvaluationRow[];
}
