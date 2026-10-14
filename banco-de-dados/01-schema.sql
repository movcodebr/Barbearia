-- =====================================================================
--  GREY BARBER — BANCO DE DADOS (PostgreSQL / Supabase)
--  Rode este arquivo inteiro no Supabase: SQL Editor → New query → Run.
--  Depois rode o 02-dados-iniciais.sql.
-- =====================================================================

create extension if not exists btree_gist;   -- necessário para impedir horários sobrepostos

-- ---------------------------------------------------------------------
--  TIPOS
-- ---------------------------------------------------------------------
do $$ begin
  create type papel_usuario as enum ('cliente', 'barbeiro', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_agendamento as enum ('confirmado', 'concluido', 'cancelado');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
--  TABELAS
-- ---------------------------------------------------------------------

-- Perfil de cada usuário (1 para 1 com auth.users, criado automaticamente no cadastro)
create table if not exists public.perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null check (char_length(trim(nome)) between 2 and 120),
  email      text not null,
  telefone   text check (telefone is null or telefone ~ '^[0-9]{10,11}$'),
  papel      papel_usuario not null default 'cliente',
  criado_em  timestamptz not null default now()
);
create unique index if not exists perfis_telefone_unico on public.perfis (telefone) where telefone is not null;
create unique index if not exists perfis_email_unico    on public.perfis (lower(email));

-- Profissionais que atendem
create table if not exists public.barbeiros (
  id            bigint generated always as identity primary key,
  perfil_id     uuid unique references public.perfis(id) on delete set null,
  nome          text not null,
  especialidade text,
  ativo         boolean not null default true,
  ordem         int not null default 0
);

-- Catálogo de serviços
create table if not exists public.servicos (
  id          bigint generated always as identity primary key,
  nome        text not null unique,
  descricao   text,
  categoria   text not null default 'principal' check (categoria in ('principal', 'adicional')),
  duracao_min int  not null check (duracao_min between 5 and 240),
  preco       numeric(10,2) not null check (preco >= 0),
  ativo       boolean not null default true,
  ordem       int not null default 0
);

-- Horário de funcionamento (0 = domingo … 6 = sábado). abre/fecha nulos = fechado
create table if not exists public.horarios_funcionamento (
  dia_semana smallint primary key check (dia_semana between 0 and 6),
  abre       time,
  fecha      time,
  check ((abre is null and fecha is null) or (abre < fecha))
);

-- Agendamentos
create table if not exists public.agendamentos (
  id           bigint generated always as identity primary key,
  cliente_id   uuid   not null references public.perfis(id) on delete cascade,
  barbeiro_id  bigint not null references public.barbeiros(id),
  servico_id   bigint not null references public.servicos(id),
  inicio       timestamptz not null,
  fim          timestamptz not null,
  valor        numeric(10,2) not null check (valor >= 0),
  status       status_agendamento not null default 'confirmado',
  observacoes  text check (observacoes is null or char_length(observacoes) <= 500),
  criado_em    timestamptz not null default now(),
  check (fim > inicio),
  -- O próprio banco impede dois agendamentos ativos no mesmo horário para o mesmo barbeiro
  constraint agendamento_sem_conflito exclude using gist (
    barbeiro_id with =,
    tstzrange(inicio, fim, '[)') with &&
  ) where (status <> 'cancelado')
);
create index if not exists agendamentos_cliente_idx on public.agendamentos (cliente_id, inicio desc);
create index if not exists agendamentos_inicio_idx  on public.agendamentos (inicio);

-- Avaliações (uma por agendamento concluído)
create table if not exists public.avaliacoes (
  id              bigint generated always as identity primary key,
  agendamento_id  bigint not null unique references public.agendamentos(id) on delete cascade,
  cliente_id      uuid   not null references public.perfis(id) on delete cascade,
  nota            smallint not null check (nota between 1 and 5),
  comentario      text check (comentario is null or char_length(comentario) <= 500),
  publicada       boolean not null default true,
  criado_em       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  FUNÇÕES AUXILIARES
-- ---------------------------------------------------------------------

-- Fuso usado em todo o sistema
create or replace function public.fuso() returns text
language sql immutable as $$ select 'America/Sao_Paulo' $$;

-- O usuário logado é funcionário (barbeiro ou admin)?
create or replace function public.eh_funcionario() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel in ('barbeiro', 'admin'));
$$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin');
$$;

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.criar_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tel text := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'telefone', ''), '\D', '', 'g'), '');
begin
  insert into perfis (id, nome, email, telefone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    v_tel
  );
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- Permite ao cadastro verificar antes se o telefone já está em uso
create or replace function public.telefone_disponivel(p_telefone text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from perfis where telefone = regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g')
  );
$$;

-- ---------------------------------------------------------------------
--  HORÁRIOS DISPONÍVEIS
--  Retorna os horários livres (grade de 30 min) de um dia.
--  p_barbeiro nulo = "sem preferência" (livre com pelo menos um barbeiro).
-- ---------------------------------------------------------------------
create or replace function public.horarios_disponiveis(
  p_servico  bigint,
  p_data     date,
  p_barbeiro bigint default null,
  p_ignorar  bigint default null      -- id de agendamento a ignorar (usado ao remarcar)
) returns table (horario time)
language plpgsql stable security definer set search_path = public as $$
declare
  v_dur   int;
  v_abre  time;
  v_fecha time;
begin
  select duracao_min into v_dur from servicos where id = p_servico and ativo;
  if v_dur is null then return; end if;

  select abre, fecha into v_abre, v_fecha
    from horarios_funcionamento where dia_semana = extract(dow from p_data);
  if v_abre is null then return; end if;

  return query
  with grade as (
    select g::time as h
    from generate_series(p_data + v_abre,
                         p_data + v_fecha - make_interval(mins => v_dur),
                         interval '30 minutes') g
  ),
  slots as (
    select h,
           (p_data + h) at time zone fuso()                                  as ini,
           (p_data + h) at time zone fuso() + make_interval(mins => v_dur)   as fim
    from grade
  )
  select s.h
  from slots s
  where s.ini > now()
    and exists (
      select 1 from barbeiros b
      where b.ativo
        and (p_barbeiro is null or b.id = p_barbeiro)
        and not exists (
          select 1 from agendamentos a
          where a.barbeiro_id = b.id
            and a.status <> 'cancelado'
            and (p_ignorar is null or a.id <> p_ignorar)
            and tstzrange(a.inicio, a.fim, '[)') && tstzrange(s.ini, s.fim, '[)')
        )
    )
  order by s.h;
end $$;

-- Valida se um horário cabe no expediente (uso interno)
create or replace function public._validar_expediente(p_inicio timestamptz, p_dur int) returns void
language plpgsql stable set search_path = public as $$
declare
  v_local timestamp := p_inicio at time zone fuso();
  v_abre time; v_fecha time;
begin
  if p_inicio <= now() then
    raise exception 'Escolha um horário no futuro.' using errcode = 'P0001';
  end if;
  if p_inicio > now() + interval '60 days' then
    raise exception 'Só é possível agendar com até 60 dias de antecedência.' using errcode = 'P0001';
  end if;
  select abre, fecha into v_abre, v_fecha
    from horarios_funcionamento where dia_semana = extract(dow from v_local);
  if v_abre is null then
    raise exception 'A barbearia está fechada neste dia.' using errcode = 'P0001';
  end if;
  if v_local::time < v_abre or (v_local + make_interval(mins => p_dur))::time > v_fecha
     or (v_local + make_interval(mins => p_dur))::date <> v_local::date then
    raise exception 'Horário fora do expediente (% às %).', to_char(v_abre, 'HH24:MI'), to_char(v_fecha, 'HH24:MI')
      using errcode = 'P0001';
  end if;
end $$;

-- Escolhe um barbeiro livre (para "sem preferência")
create or replace function public._barbeiro_livre(p_inicio timestamptz, p_fim timestamptz, p_ignorar bigint default null)
returns bigint language sql stable set search_path = public as $$
  select b.id from barbeiros b
  where b.ativo and not exists (
    select 1 from agendamentos a
    where a.barbeiro_id = b.id and a.status <> 'cancelado'
      and (p_ignorar is null or a.id <> p_ignorar)
      and tstzrange(a.inicio, a.fim, '[)') && tstzrange(p_inicio, p_fim, '[)')
  )
  order by (select count(*) from agendamentos a2
            where a2.barbeiro_id = b.id and a2.status <> 'cancelado'
              and (a2.inicio at time zone fuso())::date = (p_inicio at time zone fuso())::date),
           b.ordem, b.id
  limit 1;
$$;

-- ---------------------------------------------------------------------
--  CRIAR AGENDAMENTO (o cliente só agenda por aqui; preço e duração vêm do banco)
-- ---------------------------------------------------------------------
create or replace function public.criar_agendamento(
  p_servico     bigint,
  p_inicio      timestamptz,
  p_barbeiro    bigint default null,
  p_observacoes text   default null
) returns public.agendamentos
language plpgsql security definer set search_path = public as $$
declare
  v_srv servicos;
  v_barb bigint := p_barbeiro;
  v_fim timestamptz;
  v_novo agendamentos;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para agendar.' using errcode = '42501';
  end if;

  select * into v_srv from servicos where id = p_servico and ativo;
  if not found then raise exception 'Serviço indisponível.' using errcode = 'P0001'; end if;

  perform _validar_expediente(p_inicio, v_srv.duracao_min);
  v_fim := p_inicio + make_interval(mins => v_srv.duracao_min);

  if (select count(*) from agendamentos
      where cliente_id = auth.uid() and status = 'confirmado' and inicio > now()) >= 3 then
    raise exception 'Você já tem 3 agendamentos futuros. Cancele um para marcar outro.' using errcode = 'P0001';
  end if;

  if v_barb is null then
    v_barb := _barbeiro_livre(p_inicio, v_fim);
    if v_barb is null then
      raise exception 'Esse horário acabou de ser ocupado. Escolha outro.' using errcode = 'P0001';
    end if;
  elsif not exists (select 1 from barbeiros where id = v_barb and ativo) then
    raise exception 'Profissional indisponível.' using errcode = 'P0001';
  end if;

  begin
    insert into agendamentos (cliente_id, barbeiro_id, servico_id, inicio, fim, valor, observacoes)
    values (auth.uid(), v_barb, v_srv.id, p_inicio, v_fim, v_srv.preco, nullif(trim(p_observacoes), ''))
    returning * into v_novo;
  exception when exclusion_violation then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.' using errcode = 'P0001';
  end;

  return v_novo;
end $$;

-- ---------------------------------------------------------------------
--  REMARCAR (cliente: o próprio agendamento futuro; funcionário: qualquer um)
-- ---------------------------------------------------------------------
create or replace function public.remarcar_agendamento(
  p_id       bigint,
  p_inicio   timestamptz,
  p_barbeiro bigint default null,
  p_servico  bigint default null
) returns public.agendamentos
language plpgsql security definer set search_path = public as $$
declare
  v_ag agendamentos;
  v_srv servicos;
  v_barb bigint;
  v_fim timestamptz;
begin
  select * into v_ag from agendamentos where id = p_id for update;
  if not found or (v_ag.cliente_id <> auth.uid() and not eh_funcionario()) then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_ag.status <> 'confirmado' then
    raise exception 'Só é possível remarcar agendamentos confirmados.' using errcode = 'P0001';
  end if;
  if not eh_funcionario() and v_ag.inicio < now() + interval '1 hour' then
    raise exception 'Remarcações online só até 1 hora antes. Fale com a barbearia pelo WhatsApp.' using errcode = 'P0001';
  end if;

  select * into v_srv from servicos where id = coalesce(p_servico, v_ag.servico_id);
  perform _validar_expediente(p_inicio, v_srv.duracao_min);
  v_fim := p_inicio + make_interval(mins => v_srv.duracao_min);

  v_barb := coalesce(p_barbeiro, _barbeiro_livre(p_inicio, v_fim, p_id));
  if v_barb is null then
    raise exception 'Nenhum profissional livre nesse horário.' using errcode = 'P0001';
  end if;

  begin
    update agendamentos
       set inicio = p_inicio, fim = v_fim, barbeiro_id = v_barb,
           servico_id = v_srv.id, valor = v_srv.preco
     where id = p_id
     returning * into v_ag;
  exception when exclusion_violation then
    raise exception 'Esse horário já está ocupado. Escolha outro.' using errcode = 'P0001';
  end;
  return v_ag;
end $$;

-- ---------------------------------------------------------------------
--  CANCELAR / CONCLUIR
-- ---------------------------------------------------------------------
create or replace function public.cancelar_agendamento(p_id bigint) returns public.agendamentos
language plpgsql security definer set search_path = public as $$
declare v_ag agendamentos;
begin
  select * into v_ag from agendamentos where id = p_id for update;
  if not found or (v_ag.cliente_id <> auth.uid() and not eh_funcionario()) then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_ag.status <> 'confirmado' then
    raise exception 'Este agendamento não pode mais ser cancelado.' using errcode = 'P0001';
  end if;
  if not eh_funcionario() and v_ag.inicio < now() + interval '1 hour' then
    raise exception 'Cancelamentos online só até 1 hora antes. Fale com a barbearia pelo WhatsApp.' using errcode = 'P0001';
  end if;
  update agendamentos set status = 'cancelado' where id = p_id returning * into v_ag;
  return v_ag;
end $$;

create or replace function public.concluir_agendamento(p_id bigint) returns public.agendamentos
language plpgsql security definer set search_path = public as $$
declare v_ag agendamentos;
begin
  if not eh_funcionario() then
    raise exception 'Apenas funcionários.' using errcode = '42501';
  end if;
  update agendamentos set status = 'concluido'
   where id = p_id and status = 'confirmado'
   returning * into v_ag;
  if not found then
    raise exception 'Agendamento não encontrado ou já finalizado.' using errcode = 'P0002';
  end if;
  return v_ag;
end $$;

-- ---------------------------------------------------------------------
--  AVALIAR (somente atendimento concluído do próprio cliente)
-- ---------------------------------------------------------------------
create or replace function public.avaliar_atendimento(p_agendamento bigint, p_nota int, p_comentario text default null)
returns public.avaliacoes
language plpgsql security definer set search_path = public as $$
declare v_av avaliacoes;
begin
  if not exists (select 1 from agendamentos
                 where id = p_agendamento and cliente_id = auth.uid() and status = 'concluido') then
    raise exception 'Você só pode avaliar atendimentos concluídos.' using errcode = 'P0001';
  end if;
  insert into avaliacoes (agendamento_id, cliente_id, nota, comentario)
  values (p_agendamento, auth.uid(), p_nota, nullif(trim(p_comentario), ''))
  on conflict (agendamento_id) do update set nota = excluded.nota, comentario = excluded.comentario
  returning * into v_av;
  return v_av;
end $$;

-- Avaliações para a página inicial (mostra só o primeiro nome do cliente)
create or replace function public.avaliacoes_publicas(p_limite int default 8)
returns table (nome text, nota smallint, comentario text, servico text, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select split_part(p.nome, ' ', 1) || coalesce(' ' || left(nullif(split_part(p.nome, ' ', 2), ''), 1) || '.', ''),
         av.nota, av.comentario, s.nome, av.criado_em
  from avaliacoes av
  join perfis p        on p.id = av.cliente_id
  join agendamentos a  on a.id = av.agendamento_id
  join servicos s      on s.id = a.servico_id
  where av.publicada and av.comentario is not null and av.nota >= 4
  order by av.criado_em desc
  limit least(coalesce(p_limite, 8), 30);
$$;

-- ---------------------------------------------------------------------
--  SEGURANÇA (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.perfis                 enable row level security;
alter table public.barbeiros              enable row level security;
alter table public.servicos               enable row level security;
alter table public.horarios_funcionamento enable row level security;
alter table public.agendamentos           enable row level security;
alter table public.avaliacoes             enable row level security;

-- Perfis: cada um vê o seu; funcionários veem todos. Cliente só altera nome/telefone.
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select to authenticated
  using (id = auth.uid() or eh_funcionario());
drop policy if exists perfis_update on public.perfis;
create policy perfis_update on public.perfis for update to authenticated
  using (id = auth.uid() or eh_admin()) with check (id = auth.uid() or eh_admin());
revoke update on public.perfis from authenticated;
grant  update (nome, telefone) on public.perfis to authenticated;

-- Catálogo público (qualquer visitante lê); só admin altera
drop policy if exists servicos_select on public.servicos;
create policy servicos_select on public.servicos for select to anon, authenticated
  using (ativo or eh_funcionario());
drop policy if exists servicos_admin on public.servicos;
create policy servicos_admin on public.servicos for all to authenticated
  using (eh_admin()) with check (eh_admin());

drop policy if exists barbeiros_select on public.barbeiros;
create policy barbeiros_select on public.barbeiros for select to anon, authenticated
  using (ativo or eh_funcionario());
drop policy if exists barbeiros_admin on public.barbeiros;
create policy barbeiros_admin on public.barbeiros for all to authenticated
  using (eh_admin()) with check (eh_admin());

drop policy if exists horarios_select on public.horarios_funcionamento;
create policy horarios_select on public.horarios_funcionamento for select to anon, authenticated
  using (true);
drop policy if exists horarios_admin on public.horarios_funcionamento;
create policy horarios_admin on public.horarios_funcionamento for all to authenticated
  using (eh_admin()) with check (eh_admin());

-- Agendamentos: leitura do próprio (ou tudo, se funcionário).
-- Criar/remarcar/cancelar/concluir SOMENTE pelas funções acima. Funcionário pode excluir.
drop policy if exists agendamentos_select on public.agendamentos;
create policy agendamentos_select on public.agendamentos for select to authenticated
  using (cliente_id = auth.uid() or eh_funcionario());
drop policy if exists agendamentos_delete on public.agendamentos;
create policy agendamentos_delete on public.agendamentos for delete to authenticated
  using (eh_funcionario());

-- Avaliações: o autor e os funcionários veem; o público usa avaliacoes_publicas()
drop policy if exists avaliacoes_select on public.avaliacoes;
create policy avaliacoes_select on public.avaliacoes for select to authenticated
  using (cliente_id = auth.uid() or eh_funcionario());
drop policy if exists avaliacoes_moderar on public.avaliacoes;
create policy avaliacoes_moderar on public.avaliacoes for update to authenticated
  using (eh_funcionario()) with check (eh_funcionario());

-- Permissões das funções
revoke execute on function public._validar_expediente(timestamptz, int)        from public, anon, authenticated;
revoke execute on function public._barbeiro_livre(timestamptz, timestamptz, bigint) from public, anon, authenticated;
revoke execute on function public.criar_perfil_novo_usuario()                    from public, anon, authenticated;
revoke execute on function public.criar_agendamento(bigint, timestamptz, bigint, text)      from public, anon;
revoke execute on function public.remarcar_agendamento(bigint, timestamptz, bigint, bigint) from public, anon;
revoke execute on function public.cancelar_agendamento(bigint)                   from public, anon;
revoke execute on function public.concluir_agendamento(bigint)                   from public, anon;
revoke execute on function public.avaliar_atendimento(bigint, int, text)          from public, anon;
grant  execute on function public.criar_agendamento(bigint, timestamptz, bigint, text)      to authenticated;
grant  execute on function public.remarcar_agendamento(bigint, timestamptz, bigint, bigint) to authenticated;
grant  execute on function public.cancelar_agendamento(bigint)                   to authenticated;
grant  execute on function public.concluir_agendamento(bigint)                   to authenticated;
grant  execute on function public.avaliar_atendimento(bigint, int, text)          to authenticated;
grant  execute on function public.horarios_disponiveis(bigint, date, bigint, bigint) to anon, authenticated;
grant  execute on function public.avaliacoes_publicas(int)                       to anon, authenticated;
grant  execute on function public.telefone_disponivel(text)                      to anon, authenticated;
