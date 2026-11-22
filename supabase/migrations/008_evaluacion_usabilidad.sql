-- =====================================================================
-- GeoVía Cali · Migración 008 · Evaluación con participantes
-- Guarda las respuestas de la encuesta diagnóstica (15 preguntas), las
-- tareas de uso del prototipo y la escala SUS. Participación anónima:
-- no se guardan nombres, correos ni ubicación. Solo el equipo (revisor o
-- administrador) puede leer los resultados.
-- =====================================================================
create table if not exists public.evaluations (
  id              uuid primary key default gen_random_uuid(),
  session_user_id uuid not null default auth.uid(),
  created_at      timestamptz not null default now(),
  device          text check (device in ('telefono', 'computador', 'tableta')),
  diagnostic      jsonb not null,
  tasks           jsonb,
  sus             jsonb,
  sus_score       numeric(5,2) check (sus_score between 0 and 100),
  liked           text check (char_length(liked) <= 1000),
  improve         text check (char_length(improve) <= 1000)
);
create index if not exists evaluations_created_idx on public.evaluations (created_at);

alter table public.evaluations enable row level security;
drop policy if exists evaluations_staff_read on public.evaluations;
create policy evaluations_staff_read on public.evaluations for select using (public.is_staff());
revoke insert, update, delete on public.evaluations from anon, authenticated;
grant select on public.evaluations to authenticated;

-- Registro validado en el servidor. Una evaluación por sesión.
create or replace function public.submit_evaluation(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_sus jsonb := p->'sus';
  v_score numeric;
  v_sum int := 0;
  i int;
  v int;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión' using errcode = '28000';
  end if;
  if exists (select 1 from public.evaluations where session_user_id = auth.uid()) then
    raise exception 'Esta sesión ya registró una evaluación' using errcode = '23505';
  end if;
  if jsonb_typeof(p->'diagnostic') <> 'object' or (select count(*) from jsonb_object_keys(p->'diagnostic')) < 14 then
    raise exception 'La encuesta diagnóstica está incompleta' using errcode = '22023';
  end if;
  if v_sus is not null and jsonb_typeof(v_sus) = 'array' then
    if jsonb_array_length(v_sus) <> 10 then
      raise exception 'La escala SUS requiere 10 respuestas' using errcode = '22023';
    end if;
    for i in 0..9 loop
      v := (v_sus->>i)::int;
      if v is null or v < 1 or v > 5 then
        raise exception 'Respuesta SUS fuera de rango' using errcode = '22023';
      end if;
      -- Ítems impares (1,3,5,7,9) positivos; pares negativos (Brooke, 1996)
      v_sum := v_sum + case when i % 2 = 0 then v - 1 else 5 - v end;
    end loop;
    v_score := v_sum * 2.5;
  else
    v_sus := null;
  end if;

  insert into public.evaluations (device, diagnostic, tasks, sus, sus_score, liked, improve)
  values (nullif(p->>'device', ''), p->'diagnostic',
          case when jsonb_typeof(p->'tasks') = 'array' then p->'tasks' end,
          v_sus, v_score,
          nullif(left(trim(p->>'liked'), 1000), ''), nullif(left(trim(p->>'improve'), 1000), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_evaluation(jsonb) from public, anon;
grant execute on function public.submit_evaluation(jsonb) to authenticated;
