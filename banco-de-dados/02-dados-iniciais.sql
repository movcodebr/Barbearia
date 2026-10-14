-- =====================================================================
--  GREY BARBER — DADOS INICIAIS
--  Rode depois do 01-schema.sql. Pode rodar de novo sem duplicar nada.
-- =====================================================================

-- Horário de funcionamento (0 = domingo … 6 = sábado)
insert into public.horarios_funcionamento (dia_semana, abre, fecha) values
  (0, null,    null),      -- domingo: fechado
  (1, '09:00', '17:00'),
  (2, '09:00', '17:00'),
  (3, '09:00', '17:00'),
  (4, '09:00', '17:00'),
  (5, '09:00', '17:00'),
  (6, '09:00', '14:00')
on conflict (dia_semana) do update set abre = excluded.abre, fecha = excluded.fecha;

-- Serviços
insert into public.servicos (nome, descricao, categoria, duracao_min, preco, ordem) values
  ('Corte',       'Corte moderno com acabamento profissional.',        'principal', 45, 40.00, 1),
  ('Barba',       'Modelagem completa com toalha quente e hidratação.', 'principal', 30, 30.00, 2),
  ('Combo',       'Corte + barba com desconto.',                        'principal', 75, 60.00, 3),
  ('Luzes',       'Visual moderno com estilo e personalidade.',         'adicional', 60, 80.00, 4),
  ('Sobrancelha', 'Design e alinhamento na navalha.',                   'adicional', 20, 20.00, 5),
  ('Bigode',      'Acabamento detalhado e alinhamento perfeito.',       'adicional', 15, 20.00, 6)
on conflict (nome) do update
  set descricao = excluded.descricao, categoria = excluded.categoria,
      duracao_min = excluded.duracao_min, preco = excluded.preco, ordem = excluded.ordem;

-- Barbeiros
insert into public.barbeiros (nome, especialidade, ordem)
select v.nome, v.esp, v.ordem
from (values
  ('Zé',      'Especialista em cortes clássicos e barba.', 1),
  ('Rodrigo', 'Expert em degradê e luzes.',                2),
  ('Mateus',  'Especialista em sobrancelha e acabamentos.', 3)
) as v(nome, esp, ordem)
where not exists (select 1 from public.barbeiros b where b.nome = v.nome);

-- ---------------------------------------------------------------------
--  COMO TORNAR ALGUÉM FUNCIONÁRIO / ADMIN
--  1) A pessoa cria a conta normalmente pelo site (cadastro.html).
--  2) Rode no SQL Editor, trocando o e-mail:
--
--     update public.perfis set papel = 'admin' where email = 'dono@greybarber.com';
--
--  3) Para ligar um barbeiro à conta dele (opcional):
--
--     update public.barbeiros set perfil_id = (select id from public.perfis where email = 'ze@greybarber.com')
--      where nome = 'Zé';
--     update public.perfis set papel = 'barbeiro' where email = 'ze@greybarber.com';
-- ---------------------------------------------------------------------
