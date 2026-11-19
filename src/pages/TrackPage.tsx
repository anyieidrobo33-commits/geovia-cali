import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getRememberedCodes } from '../lib/api';
import { normalizeCode, REPORT_CODE_RE } from '../lib/domain';

export default function TrackPage() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recent = getRememberedCodes().slice(0, 5);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeCode(value);
    if (!REPORT_CODE_RE.test(code)) {
      setError('El código tiene el formato GVC-AAMM-XXXXX, por ejemplo GVC-2611-7K4QM.');
      return;
    }
    navigate(`/r/${code}`);
  };

  return (
    <div className="container container-narrow page">
      <div className="page-head">
        <div>
          <h1>Seguimiento de un reporte</h1>
          <p>Escriba el código que recibió al enviar su reporte.</p>
        </div>
      </div>
      <form className="card card-pad stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="label" htmlFor="code">Código de seguimiento</label>
          <input id="code" className="input code-display" style={{ fontSize: '1.25rem', textTransform: 'uppercase' }}
            value={value} onChange={(e) => { setValue(e.target.value); setError(null); }}
            placeholder="GVC-2611-7K4QM" autoComplete="off" autoCapitalize="characters" spellCheck={false}
            aria-invalid={Boolean(error)} aria-describedby={error ? 'code-err' : undefined} />
          {error && <p id="code-err" className="error-text" role="alert">{error}</p>}
        </div>
        <button className="btn btn-navy btn-lg" type="submit"><Search size={20} />Consultar</button>
      </form>

      {recent.length > 0 && (
        <section className="section">
          <h2 style={{ fontSize: '1.1rem' }}>Enviados desde este dispositivo</h2>
          <div className="chips">
            {recent.map((c) => (
              <button key={c} className="chip code-display" onClick={() => navigate(`/r/${c}`)}>{c}</button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
