/* =====================================================================
   BANCO REAL — Supabase (PostgreSQL)
   Usa as tabelas e funções de banco-de-dados/01-schema.sql
   ===================================================================== */
(function () {
  'use strict';
  const GB = window.GB;
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

  let clientePromise = null;
  function cliente() {
    if (clientePromise) return clientePromise;
    clientePromise = new Promise((resolve, reject) => {
      const criar = () => resolve(window.supabase.createClient(GB_CONFIG.supabaseUrl, GB_CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }));
      if (window.supabase && window.supabase.createClient) return criar();
      const s = document.createElement('script');
      s.src = CDN;
      s.onload = criar;
      s.onerror = () => reject(new Error('Não foi possível carregar o Supabase. Verifique sua internet.'));
      document.head.appendChild(s);
    });
    return clientePromise;
  }

  const ok = ({ data, error }) => { if (error) throw new Error(GB.erroAmigavel(error)); return data; };
  const base = () => new URL('.', location.href).href;
  const um = (v) => (Array.isArray(v) ? v[0] || null : v || null);

  const SELECT_AG = `id, inicio, fim, status, valor, observacoes,
    servico:servicos(id, nome, duracao_min),
    barbeiro:barbeiros(id, nome),
    cliente:perfis(id, nome, telefone, email),
    avaliacao:avaliacoes(nota, comentario)`;
  const normalizar = (a) => ({ ...a, valor: Number(a.valor), avaliacao: um(a.avaliacao) });

  let cacheSessao;

  GB.BancoSupabase = {
    modo: 'supabase',

    async sessao() {
      if (cacheSessao !== undefined) return cacheSessao;
      const sb = await cliente();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return (cacheSessao = null);
      const { data: perfil } = await sb.from('perfis').select('id, nome, email, telefone, papel').eq('id', session.user.id).maybeSingle();
      return (cacheSessao = { usuario: { id: session.user.id, email: session.user.email }, perfil: perfil || { id: session.user.id, nome: session.user.email, email: session.user.email, papel: 'cliente' } });
    },

    async cadastrar({ nome, email, telefone, senha }) {
      const sb = await cliente();
      const tel = String(telefone || '').replace(/\D/g, '');
      if (tel) {
        const livre = ok(await sb.rpc('telefone_disponivel', { p_telefone: tel }));
        if (!livre) throw new Error('Este telefone já está cadastrado.');
      }
      const data = ok(await sb.auth.signUp({
        email: email.trim().toLowerCase(),
        password: senha,
        options: { data: { nome: nome.trim(), telefone: tel }, emailRedirectTo: base() + 'login.html?confirmado=1' },
      }));
      // Quando o Supabase devolve usuário sem "identities", o e-mail já existia
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.');
      }
      cacheSessao = undefined;
      return { confirmarEmail: !data.session };
    },

    async entrar(email, senha) {
      const sb = await cliente();
      ok(await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha }));
      cacheSessao = undefined;
      const s = await this.sessao();
      return s && s.perfil;
    },

    async sair() {
      const sb = await cliente();
      await sb.auth.signOut();
      cacheSessao = null;
    },

    async recuperarSenha(email) {
      const sb = await cliente();
      ok(await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: base() + 'nova-senha.html' }));
      return { demo: false };
    },

    async redefinirSenha(senha) {
      const sb = await cliente();
      ok(await sb.auth.updateUser({ password: senha }));
      cacheSessao = undefined;
    },

    async atualizarPerfil({ nome, telefone }) {
      const sb = await cliente();
      const s = await this.sessao();
      const tel = String(telefone || '').replace(/\D/g, '') || null;
      const p = ok(await sb.from('perfis').update({ nome: nome.trim(), telefone: tel }).eq('id', s.usuario.id).select('id, nome, email, telefone, papel').single());
      cacheSessao = { ...s, perfil: p };
      return p;
    },

    async listarServicos({ incluirInativos = false } = {}) {
      const sb = await cliente();
      let q = sb.from('servicos').select('*').order('ordem');
      if (!incluirInativos) q = q.eq('ativo', true);
      return ok(await q).map((s) => ({ ...s, preco: Number(s.preco) }));
    },
    async listarBarbeiros() {
      const sb = await cliente();
      return ok(await sb.from('barbeiros').select('id, nome, especialidade, ativo, ordem').eq('ativo', true).order('ordem'));
    },
    async horariosFuncionamento() {
      const sb = await cliente();
      return ok(await sb.from('horarios_funcionamento').select('*').order('dia_semana'))
        .map((h) => ({ ...h, abre: h.abre && h.abre.slice(0, 5), fecha: h.fecha && h.fecha.slice(0, 5) }));
    },

    async horariosDisponiveis({ servicoId, data, barbeiroId = null, ignorarId = null }) {
      const sb = await cliente();
      const r = ok(await sb.rpc('horarios_disponiveis', { p_servico: servicoId, p_data: data, p_barbeiro: barbeiroId, p_ignorar: ignorarId }));
      return r.map((x) => String(x.horario).slice(0, 5));
    },

    async criarAgendamento({ servicoId, data, hora, barbeiroId = null, observacoes = '' }) {
      const sb = await cliente();
      const novo = ok(await sb.rpc('criar_agendamento', {
        p_servico: servicoId, p_inicio: GB.iso(data, hora), p_barbeiro: barbeiroId, p_observacoes: observacoes || null,
      }));
      return normalizar(ok(await sb.from('agendamentos').select(SELECT_AG).eq('id', novo.id).single()));
    },

    async meusAgendamentos() {
      const sb = await cliente();
      const s = await this.sessao();
      if (!s) throw new Error('Entre na sua conta para continuar.');
      return ok(await sb.from('agendamentos').select(SELECT_AG).eq('cliente_id', s.usuario.id).order('inicio', { ascending: false })).map(normalizar);
    },

    async cancelarAgendamento(id) {
      const sb = await cliente();
      ok(await sb.rpc('cancelar_agendamento', { p_id: id }));
    },

    async remarcarAgendamento(id, { data, hora, barbeiroId = null, servicoId = null }) {
      const sb = await cliente();
      ok(await sb.rpc('remarcar_agendamento', { p_id: id, p_inicio: GB.iso(data, hora), p_barbeiro: barbeiroId, p_servico: servicoId }));
    },

    async avaliar(agendamentoId, nota, comentario) {
      const sb = await cliente();
      ok(await sb.rpc('avaliar_atendimento', { p_agendamento: agendamentoId, p_nota: nota, p_comentario: comentario || null }));
    },

    async avaliacoesPublicas(limite = 8) {
      const sb = await cliente();
      return ok(await sb.rpc('avaliacoes_publicas', { p_limite: limite }));
    },

    /* ----- Funcionários ----- */
    async agendamentosPeriodo({ de, ate }) {
      const sb = await cliente();
      return ok(await sb.from('agendamentos').select(SELECT_AG)
        .gte('inicio', GB.iso(de, '00:00')).lt('inicio', GB.iso(GB.somarDias(ate, 1), '00:00'))
        .order('inicio')).map(normalizar);
    },

    async concluirAgendamento(id) {
      const sb = await cliente();
      ok(await sb.rpc('concluir_agendamento', { p_id: id }));
    },

    async excluirAgendamento(id) {
      const sb = await cliente();
      ok(await sb.from('agendamentos').delete().eq('id', id));
    },

    async listarClientes() {
      const sb = await cliente();
      const [perfis, ags] = await Promise.all([
        sb.from('perfis').select('id, nome, email, telefone, papel').eq('papel', 'cliente').order('nome').then(ok),
        sb.from('agendamentos').select('cliente_id, inicio, status, valor').then(ok),
      ]);
      const agora = new Date();
      return perfis.map((p) => {
        const meus = ags.filter((a) => a.cliente_id === p.id);
        const feitos = meus.filter((a) => a.status === 'concluido');
        return {
          ...p,
          visitas: feitos.length,
          ultimaVisita: feitos.map((a) => a.inicio).sort().pop() || null,
          proximo: meus.filter((a) => a.status === 'confirmado' && new Date(a.inicio) > agora).map((a) => a.inicio).sort()[0] || null,
          totalGasto: feitos.reduce((t, a) => t + Number(a.valor), 0),
        };
      });
    },

    async salvarServico(s) {
      const sb = await cliente();
      return ok(await sb.from('servicos').update({
        preco: Number(s.preco), duracao_min: Number(s.duracao_min), ativo: !!s.ativo, descricao: s.descricao,
      }).eq('id', s.id).select().single());
    },
  };
})();
