import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, ClipboardCheck, PlayCircle } from 'lucide-react';
import { TASKS, finishCurrentTask, loadEval, onEvalChange, saveEval, type EvalState } from '../lib/evaluation';

/** Barra de tareas que acompaña a la persona mientras usa la app durante la evaluación. */
export default function EvalBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [s, setS] = useState<EvalState | null>(() => loadEval());
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [answer, setAnswer] = useState('');

  useEffect(() => onEvalChange(() => setS(loadEval())), []);
  useEffect(() => {
    if (!s?.taskStart || s.pendingHelp) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [s?.taskStart, s?.pendingHelp]);

  const task = s && s.stage === 'tasks' ? TASKS[s.task] : null;

  // Finalización automática al llegar a la pantalla objetivo
  useEffect(() => {
    if (task?.doneRoute && s?.taskStart && !s.pendingHelp && task.doneRoute.test(pathname)) finishCurrentTask(true);
  }, [pathname, task, s?.taskStart, s?.pendingHelp]);

  useEffect(() => { setAnswer(''); }, [s?.task]);
  // Abierta al iniciar o al terminar una tarea; compacta mientras se realiza
  useEffect(() => { setOpen(!s?.taskStart || Boolean(s?.pendingHelp)); }, [s?.taskStart, s?.pendingHelp]);
  const visible = Boolean(s && task && !pathname.startsWith('/evaluar'));
  useEffect(() => {
    document.body.classList.toggle('eval-active', visible);
    return () => document.body.classList.remove('eval-active');
  }, [visible]);

  if (!s || !task || pathname.startsWith('/evaluar')) return null;

  const seconds = s.taskStart ? Math.max(0, Math.round(((s.pendingHelp ? s.taskEnd ?? now : now) - s.taskStart) / 1000)) : 0;

  const record = (help: boolean) => {
    const secs = Math.max(1, Math.round(((s.taskEnd ?? Date.now()) - (s.taskStart ?? Date.now())) / 1000));
    const results = [...s.results, { id: task.id, completed: s.pendingCompleted, help, seconds: secs, ...(answer.trim() ? { answer: answer.trim() } : {}) }];
    const last = s.task >= TASKS.length - 1;
    const next: EvalState = { ...s, results, task: last ? s.task : s.task + 1, taskStart: null, taskEnd: null, pendingHelp: false, pendingCompleted: true, stage: last ? 'sus' : 'tasks' };
    saveEval(next);
    if (last) navigate('/evaluar');
  };

  const finish = (completed: boolean) => finishCurrentTask(completed);

  const mm = Math.floor(seconds / 60), ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className="eval-bar" role="region" aria-label="Tarea de evaluación">
      <div className="eval-bar-head" onClick={() => setOpen(!open)}>
        <ClipboardCheck size={18} />
        <strong>Tarea {s.task + 1} de {TASKS.length}: {task.title}</strong>
        {s.taskStart && !s.pendingHelp && <span className="eval-timer">{mm}:{ss}</span>}
        <button className="icon-btn eval-toggle" onClick={(e) => { e.stopPropagation(); setOpen(!open); }} aria-label={open ? 'Ocultar instrucciones' : 'Mostrar instrucciones'}>
          {open ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>
      {open && (
        <div className="eval-bar-body">
          {!s.taskStart ? (
            <>
              <p>{task.instruction}</p>
              <button className="btn btn-primary btn-block" onClick={() => { saveEval({ ...s, taskStart: Date.now(), taskEnd: null, pendingHelp: false }); navigate('/'); }}>
                <PlayCircle size={18} />Comenzar tarea {s.task + 1}
              </button>
            </>
          ) : s.pendingHelp ? (
            <>
              <p><strong>{s.pendingCompleted ? '¡Tarea terminada!' : 'Tarea marcada como no lograda.'}</strong> ¿Necesitó ayuda de otra persona para hacerla?</p>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => record(false)}>No, lo hice solo(a)</button>
                <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => record(true)}>Sí, necesité ayuda</button>
              </div>
            </>
          ) : (
            <>
              <p>{task.instruction}</p>
              {task.askAnswer && (
                <input className="input" inputMode="numeric" placeholder={task.askAnswer} value={answer}
                  onChange={(e) => setAnswer(e.target.value)} aria-label={task.askAnswer} style={{ marginBottom: 8 }} />
              )}
              <div className="row" style={{ gap: 8 }}>
                {!task.doneRoute && task.id !== 'T1' && (
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={Boolean(task.askAnswer) && !answer.trim()} onClick={() => finish(true)}>Terminé</button>
                )}
                <button className="btn btn-sm btn-ghost" style={{ flex: 1 }} onClick={() => finish(false)}>No pude</button>
              </div>
              {(task.doneRoute || task.id === 'T1') && <p className="small muted" style={{ margin: '6px 0 0' }}>La tarea se marca sola cuando la complete.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
