import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Clock, PlayCircle, ShieldCheck, Smartphone, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import {
  DIAGNOSTIC, FILTERS, SUS_ITEMS, TASKS, detectDevice, loadEval, newState, onEvalChange, saveEval, submitEvaluation,
  type EvalState, type Question,
} from '../lib/evaluation';

function QuestionBlock({ q, n, value, onChange, error }: {
  q: Question; n?: number; value: string | string[] | undefined; onChange: (v: string | string[]) => void; error?: boolean;
}) {
  const name = `q-${q.id}`;
  return (
    <fieldset className={`q-block${error ? ' q-error' : ''}`} id={name}>
      <legend className="q-title">{n !== undefined && <span className="q-num">{String(n).padStart(2, '0')}</span>}{q.text}</legend>
      {q.help && <p className="small muted" style={{ margin: '0 0 8px' }}>{q.help}</p>}
      {q.kind === 'open' ? (
        <textarea className="textarea" rows={3} maxLength={1000} value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)} placeholder="Escriba su respuesta" />
      ) : (
        <div className="q-options">
          {q.options!.map((o) => {
            const checked = q.kind === 'multi' ? ((value as string[]) ?? []).includes(o) : value === o;
            return (
              <label key={o} className={`q-option${checked ? ' on' : ''}`}>
                <input type={q.kind === 'multi' ? 'checkbox' : 'radio'} name={name} checked={checked}
                  onChange={() => {
                    if (q.kind === 'multi') {
                      const cur = (value as string[]) ?? [];
                      onChange(checked ? cur.filter((x) => x !== o) : [...cur, o]);
                    } else onChange(o);
                  }} />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      )}
      {error && <p className="error-text" role="alert">Responda esta pregunta para continuar.</p>}
    </fieldset>
  );
}

export default function EvaluationPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { ensureSession, user, isAnonymous } = useAuth();
  const [s, setS] = useState<EvalState>(() => loadEval() ?? newState());
  const [missing, setMissing] = useState<string[]>([]);
  const [sus, setSus] = useState<(number | null)[]>(Array(10).fill(null));
  const [liked, setLiked] = useState('');
  const [improve, setImprove] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => onEvalChange(() => { const n = loadEval(); if (n) setS(n); }), []);
  const update = (patch: Partial<EvalState>) => { const n = { ...s, ...patch }; setS(n); saveEval(n); };
  const go = (stage: EvalState['stage']) => { update({ stage }); window.scrollTo(0, 0); };

  const excluded = useMemo(() => FILTERS.some((f) => s.filters[f.id] && s.filters[f.id] !== f.options![0]), [s.filters]);

  const check = (qs: Question[], answers: Record<string, unknown>, optional: string[] = []) => {
    const miss = qs.filter((q) => {
      if (optional.includes(q.id)) return false;
      const v = answers[q.id];
      return v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    }).map((q) => q.id);
    setMissing(miss);
    if (miss.length) document.getElementById(`q-${miss[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return miss.length === 0;
  };

  const send = async (withTasks: boolean) => {
    setSending(true); setSendError(null);
    try {
      await ensureSession();
      const diag = { ...s.diagnostic, P15: s.diagnostic.P15 ?? '' };
      await submitEvaluation({
        device: detectDevice(), diagnostic: diag,
        tasks: withTasks ? s.results : null,
        sus: withTasks ? (sus as number[]) : null,
        liked, improve,
      });
      go('done');
    } catch (e) {
      const msg = (e as { message?: string }).message ?? '';
      setSendError(msg.includes('ya registró')
        ? 'En este dispositivo ya se registró una evaluación. Use «Nuevo participante» para iniciar otra.'
        : 'No se pudo enviar. Revise su conexión e intente de nuevo.');
    } finally { setSending(false); }
  };

  const newParticipant = async () => {
    if (user && isAnonymous) await supabase.auth.signOut();
    const n = newState(); setS(n); saveEval(n);
    setSus(Array(10).fill(null)); setLiked(''); setImprove(''); setMissing([]);
    window.scrollTo(0, 0);
  };

  // ---------------- Pantallas ----------------
  if (s.stage === 'intro') return (
    <div className="container container-narrow page">
      <div className="page-head"><div>
        <h1>Evaluación de GeoVía Cali</h1>
        <p>Investigación académica · Ingeniería de Sistemas, UNAD</p>
      </div></div>
      <div className="card card-pad stack">
        <p>Gracias por participar. La evaluación tiene dos partes:</p>
        <div className="eval-parts">
          <div><ClipboardList size={22} /><strong>1. Encuesta</strong><span>15 preguntas sobre su experiencia con las vías de Cali · 5 minutos</span></div>
          <div><Smartphone size={22} /><strong>2. Prueba de la app</strong><span>4 tareas cortas y 10 afirmaciones · 10 minutos (opcional)</span></div>
        </div>
        <div className="alert alert-info"><ShieldCheck size={18} /><span>Es anónima: no pedimos nombre, correo, teléfono ni dirección. Los resultados se usan solo con fines académicos y de forma agrupada. No se evalúa a usted, se evalúa la aplicación.</span></div>
        {FILTERS.map((q) => (
          <QuestionBlock key={q.id} q={q} value={s.filters[q.id]} error={missing.includes(q.id)}
            onChange={(v) => update({ filters: { ...s.filters, [q.id]: v as string } })} />
        ))}
        {excluded ? (
          <div className="alert alert-warning"><span>Gracias por su interés. Esta evaluación es para personas adultas que aceptan participar y transitan por Cali.</span></div>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={() => { if (check(FILTERS, s.filters)) go('diagnostic'); }}>Comenzar la encuesta</button>
        )}
      </div>
    </div>
  );

  if (s.stage === 'diagnostic') {
    const answered = DIAGNOSTIC.filter((q) => { const v = s.diagnostic[q.id]; return v && (!Array.isArray(v) || v.length); }).length;
    let section = '';
    return (
      <div className="container container-narrow page">
        <div className="page-head"><div>
          <h1>Parte 1 · Encuesta</h1>
          <p>Responda según su experiencia. No hay respuestas correctas o incorrectas.</p>
        </div></div>
        <div className="eval-progress" aria-label={`${answered} de 15 respondidas`}><div style={{ width: `${(answered / 15) * 100}%` }} /></div>
        <div className="stack">
          {DIAGNOSTIC.map((q, i) => {
            const head = q.section && q.section !== section ? (section = q.section) : null;
            return (
              <div key={q.id}>
                {head && <h2 className="eval-section">{head}</h2>}
                <div className="card card-pad">
                  <QuestionBlock q={q} n={i + 1} value={s.diagnostic[q.id]} error={missing.includes(q.id)}
                    onChange={(v) => update({ diagnostic: { ...s.diagnostic, [q.id]: v } })} />
                </div>
              </div>
            );
          })}
          <button className="btn btn-primary btn-lg" onClick={() => { if (check(DIAGNOSTIC, s.diagnostic, ['P15'])) go('invite'); }}>Continuar</button>
        </div>
      </div>
    );
  }

  if (s.stage === 'invite') return (
    <div className="container container-narrow page">
      <div className="card card-pad stack" style={{ textAlign: 'center' }}>
        <CheckCircle2 size={44} color="var(--green)" style={{ margin: '0 auto' }} />
        <h1 style={{ margin: 0 }}>Parte 1 completa</h1>
        <p>¿Puede dedicar unos 10 minutos más a probar la aplicación? Le pediremos cuatro tareas cortas; una barra en la parte de abajo le indicará qué hacer.</p>
        <button className="btn btn-primary btn-lg" onClick={() => go('tasks')}><PlayCircle size={20} />Sí, probar la aplicación</button>
        <button className="btn btn-lg" disabled={sending} onClick={() => send(false)}>{sending ? 'Enviando…' : 'No, solo enviar la encuesta'}</button>
        {sendError && <p className="error-text" role="alert">{sendError}</p>}
      </div>
    </div>
  );

  if (s.stage === 'tasks') {
    const t = TASKS[s.task];
    return (
      <div className="container container-narrow page">
        <div className="page-head"><div>
          <h1>Parte 2 · Prueba de la aplicación</h1>
          <p>Hágalo como lo haría solo(a). Si se bloquea, puede marcar «No pude» y seguir.</p>
        </div></div>
        <ol className="eval-tasks">
          {TASKS.map((x, i) => (
            <li key={x.id} className={i < s.task ? 'done' : i === s.task ? 'current' : ''}>
              <strong>Tarea {i + 1}. {x.title}</strong>
              <span>{x.instruction}</span>
            </li>
          ))}
        </ol>
        <div className="alert alert-info" style={{ marginTop: 16 }}><Clock size={18} /><span>Al comenzar se mide el tiempo de cada tarea. Empezará desde la pantalla de inicio de la app.</span></div>
        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 16 }}
          onClick={() => { update({ taskStart: Date.now(), taskEnd: null, pendingHelp: false }); navigate('/'); }}>
          <PlayCircle size={20} />Comenzar tarea {s.task + 1}: {t.title}
        </button>
      </div>
    );
  }

  if (s.stage === 'sus') {
    const complete = sus.every((v) => v !== null);
    return (
      <div className="container container-narrow page">
        <div className="page-head"><div>
          <h1>Parte 2 · Su opinión</h1>
          <p>Indique qué tan de acuerdo está con cada afirmación (1 = totalmente en desacuerdo, 5 = totalmente de acuerdo).</p>
        </div></div>
        <div className="stack">
          {SUS_ITEMS.map((txt, i) => (
            <div key={i} className={`card card-pad q-block${missing.includes(`S${i}`) ? ' q-error' : ''}`} id={`q-S${i}`}>
              <p className="q-title" style={{ marginTop: 0 }}><span className="q-num">{i + 1}</span>{txt}</p>
              <div className="likert" role="radiogroup" aria-label={txt}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={sus[i] === v} className={sus[i] === v ? 'on' : ''}
                    onClick={() => setSus(sus.map((x, j) => (j === i ? v : x)))}>{v}</button>
                ))}
              </div>
              <div className="likert-ends small muted"><span>Totalmente en desacuerdo</span><span>Totalmente de acuerdo</span></div>
            </div>
          ))}
          <div className="card card-pad stack">
            <div className="field"><label className="label" htmlFor="liked">¿Qué fue lo más útil o lo que más le gustó? (opcional)</label>
              <textarea id="liked" className="textarea" rows={2} maxLength={1000} value={liked} onChange={(e) => setLiked(e.target.value)} /></div>
            <div className="field"><label className="label" htmlFor="improve">¿Qué le costó trabajo o qué mejoraría? (opcional)</label>
              <textarea id="improve" className="textarea" rows={2} maxLength={1000} value={improve} onChange={(e) => setImprove(e.target.value)} /></div>
          </div>
          {sendError && <p className="error-text" role="alert">{sendError}</p>}
          <button className="btn btn-primary btn-lg" disabled={sending} onClick={() => {
            if (!complete) {
              const miss = sus.map((v, i) => (v === null ? `S${i}` : '')).filter(Boolean);
              setMissing(miss);
              document.getElementById(`q-${miss[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return;
            }
            send(true);
          }}>{sending ? 'Enviando…' : 'Enviar evaluación'}</button>
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="container container-narrow page">
      <div className="card card-pad stack" style={{ textAlign: 'center' }}>
        <CheckCircle2 size={48} color="var(--green)" style={{ margin: '0 auto' }} />
        <h1 style={{ margin: 0 }}>¡Gracias por participar!</h1>
        <p>Sus respuestas quedaron registradas de forma anónima y ayudarán a mejorar GeoVía Cali.</p>
        <Link to="/" className="btn btn-navy btn-lg">Ir al inicio</Link>
        <button className="btn btn-lg" onClick={async () => { await newParticipant(); toast('Listo para un nuevo participante'); }}>
          <UserPlus size={20} />Nuevo participante en este dispositivo
        </button>
      </div>
    </div>
  );
}
