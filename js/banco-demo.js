/* =====================================================================
   MODO DEMONSTRAÇÃO
   Simula o banco de dados no navegador (localStorage) com as MESMAS regras
   do banco real (horário de funcionamento, conflito de horário, limite de
   agendamentos, permissões). Usado quando o Supabase não está configurado.
   ===================================================================== */
(function () {
  'use strict';
  const GB = window.GB;
  const CHAVE = 'greybarber-demo-v2';
  const CHAVE_SESSAO = 'greybarber-demo-sessao';

  const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  const erro = (msg) => { throw new Error(msg); };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'u' + Date.now() + Math.random().toString(16).slice(2));

  /* ---------- Dados iniciais ---------- */
  function semear() {
    const hoje = GB.hoje();
    const horarios = [
      { dia_semana: 0, abre: null, fecha: null },
      ...[1, 2, 3, 4, 5].map((d) => ({ dia_semana: d, abre: '09:00', fecha: '17:00' })),
      { dia_semana: 6, abre: '09:00', fecha: '14:00' },
    ];
    const servicos = [
      { id: 1, nome: 'Corte', descricao: 'Corte moderno com acabamento profissional.', categoria: 'principal', duracao_min: 45, preco: 40, ativo: true, ordem: 1 },
      { id: 2, nome: 'Barba', descricao: 'Modelagem completa com toalha quente e hidratação.', categoria: 'principal', duracao_min: 30, preco: 30, ativo: true, ordem: 2 },
      { id: 3, nome: 'Combo', descricao: 'Corte + barba com desconto.', categoria: 'principal', duracao_min: 75, preco: 60, ativo: true, ordem: 3 },
      { id: 4, nome: 'Luzes', descricao: 'Visual moderno com estilo e personalidade.', categoria: 'adicional', duracao_min: 60, preco: 80, ativo: true, ordem: 4 },
      { id: 5, nome: 'Sobrancelha', descricao: 'Design e alinhamento na navalha.', categoria: 'adicional', duracao_min: 20, preco: 20, ativo: true, ordem: 5 },
      { id: 6, nome: 'Bigode', descricao: 'Acabamento detalhado e alinhamento perfeito.', categoria: 'adicional', duracao_min: 15, preco: 20, ativo: true, ordem: 6 },
    ];
    const barbeiros = [
      { id: 1, nome: 'Zé', especialidade: 'Especialista em cortes clássicos e barba.', ativo: true, ordem: 1 },
      { id: 2, nome: 'Rodrigo', especialidade: 'Expert em degradê e luzes.', ativo: true, ordem: 2 },
      { id: 3, nome: 'Mateus', especialidade: 'Especialista em sobrancelha e acabamentos.', ativo: true, ordem: 3 },
    ];
    const usuarios = [
      { id: 'admin', email: 'admin@greybarber.com', senha: 'admin123', nome: 'José Carlos', telefone: '16987654321', papel: 'admin' },
      { id: 'cliente-demo', email: 'cliente@greybarber.com', senha: 'cliente123', nome: 'Cliente Demonstração', telefone: '16900000000', papel: 'cliente' },
      { id: 'c1', email: 'lucas@email.com', senha: uid(), nome: 'Lucas Andrade', telefone: '11988881111', papel: 'cliente' },
      { id: 'c2', email: 'carlos@email.com', senha: uid(), nome: 'Carlos Silva', telefone: '11988882222', papel: 'cliente' },
      { id: 'c3', email: 'pedro@email.com', senha: uid(), nome: 'Pedro Costa', telefone: '11988883333', papel: 'cliente' },
      { id: 'c4', email: 'joao@email.com', senha: uid(), nome: 'João Silva', telefone: '16988884444', papel: 'cliente' },
      { id: 'c5', email: 'marcos@email.com', senha: uid(), nome: 'Marcos Oliveira', telefone: '16988885555', papel: 'cliente' },
      { id: 'c6', email: 'arnaldo@email.com', senha: uid(), nome: 'Arnaldo Rocha', telefone: '16988886666', papel: 'cliente' },
    ];
    let seq = 1;
    const ag = (cliente, barbeiro, servico, data, hora, status) => {
      const s = servicos.find((x) => x.id === servico);
      const inicio = GB.iso(data, hora);
      return {
        id: seq++, cliente_id: cliente, barbeiro_id: barbeiro, servico_id: servico, inicio,
        fim: new Date(new Date(inicio).getTime() + s.duracao_min * 60000).toISOString(),
        valor: s.preco, status, observacoes: null, criado_em: new Date().toISOString(),
      };
    };
    const agendamentos = [
      // Hoje
      ag('c1', 1, 2, hoje, '09:00', 'concluido'),
      ag('c2', 2, 1, hoje, '10:00', 'confirmado'),
      ag('c3', 1, 3, hoje, '11:00', 'confirmado'),
      ag('c4', 3, 5, hoje, '14:00', 'confirmado'),
      // Próximos dias
      ag('c5', 2, 4, GB.somarDias(hoje, 1), '10:00', 'confirmado'),
      ag('cliente-demo', 1, 1, GB.somarDias(hoje, 2), '15:00', 'confirmado'),
      // Histórico
      ag('c1', 1, 1, GB.somarDias(hoje, -7), '09:00', 'concluido'),
      ag('c1', 1, 2, GB.somarDias(hoje, -14), '09:00', 'concluido'),
      ag('c2', 2, 1, GB.somarDias(hoje, -10), '11:00', 'concluido'),
      ag('c3', 3, 3, GB.somarDias(hoje, -12), '13:00', 'concluido'),
      ag('c4', 1, 1, GB.somarDias(hoje, -20), '10:00', 'concluido'),
      ag('c5', 2, 3, GB.somarDias(hoje, -21), '10:00', 'concluido'),
      ag('c6', 2, 1, GB.somarDias(hoje, -5), '16:00', 'concluido'),
      ag('cliente-demo', 3, 3, GB.somarDias(hoje, -15), '14:00', 'concluido'),
      ag('c2', 3, 6, GB.somarDias(hoje, -3), '15:00', 'cancelado'),
    ];
    const av = (agId, nota, comentario) => {
      const a = agendamentos.find((x) => x.id === agId);
      return { id: agId, agendamento_id: agId, cliente_id: a.cliente_id, nota, comentario, publicada: true, criado_em: a.fim };
    };
    const avaliacoes = [
      av(11, 5, 'Atendimento excelente e corte impecável.'),
      av(12, 5, 'Melhor barbearia da região.'),
      av(8, 5, 'Serviço rápido e profissional.'),
      av(13, 5, 'O barbeiro entendeu exatamente o que eu queria e o corte ficou impecável.'),
    ];
    return { seq, horarios, servicos, barbeiros, usuarios, agendamentos, avaliacoes };
  }

  let db;
  function carregar() {
    if (db) return db;
    try { db = JSON.parse(GB.store.get(CHAVE)); } catch { db = null; }
    if (!db || !db.servicos) { db = semear(); salvar(); }
    return db;
  }
  function salvar() { GB.store.set(CHAVE, JSON.stringify(db)); }

  /* ---------- Sessão ---------- */
  function usuarioAtual() {
    const id = GB.store.get(CHAVE_SESSAO);
    return id ? carregar().usuarios.find((u) => u.id === id) || null : null;
  }
  const exigirLogin = () => usuarioAtual() || erro('Entre na sua conta para continuar.');
  const ehFuncionario = (u) => u && (u.papel === 'admin' || u.papel === 'barbeiro');
  const exigirFuncionario = () => { const u = exigirLogin(); if (!ehFuncionario(u)) erro('Apenas funcionários.'); return u; };
  const perfilPublico = (u) => u && { id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, papel: u.papel };

  /* ---------- Montagem do objeto agendamento ---------- */
  function montar(a) {
    const d = carregar();
    const s = d.servicos.find((x) => x.id === a.servico_id) || {};
    const b = d.barbeiros.find((x) => x.id === a.barbeiro_id) || {};
    const c = d.usuarios.find((x) => x.id === a.cliente_id) || {};
    const av = d.avaliacoes.find((x) => x.agendamento_id === a.id);
    return {
      id: a.id, inicio: a.inicio, fim: a.fim, status: a.status, valor: a.valor, observacoes: a.observacoes,
      servico: { id: s.id, nome: s.nome, duracao_min: s.duracao_min },
      barbeiro: { id: b.id, nome: b.nome },
      cliente: { id: c.id, nome: c.nome, telefone: c.telefone, email: c.email },
      avaliacao: av ? { nota: av.nota, comentario: av.comentario } : null,
    };
  }

  function validarExpediente(inicioIso, dur) {
    const d = carregar();
    const ini = new Date(inicioIso);
    if (ini <= new Date()) erro('Escolha um horário no futuro.');
    if (ini - new Date() > 60 * 86400000) erro('Só é possível agendar com até 60 dias de antecedência.');
    const p = GB.partes(ini);
    const h = d.horarios.find((x) => x.dia_semana === p.dow);
    if (!h || !h.abre) erro('A barbearia está fechada neste dia.');
    const m = GB.minutos(p.hora);
    if (m < GB.minutos(h.abre) || m + dur > GB.minutos(h.fecha)) erro(`Horário fora do expediente (${h.abre} às ${h.fecha}).`);
  }
  function conflita(barbeiroId, ini, fim, ignorarId) {
    return carregar().agendamentos.some((a) =>
      a.barbeiro_id === barbeiroId && a.status !== 'cancelado' && a.id !== ignorarId &&
      new Date(a.inicio) < fim && new Date(a.fim) > ini);
  }
  function barbeiroLivre(ini, fim, ignorarId) {
    const d = carregar();
    const dia = GB.partes(ini).data;
    const carga = (id) => d.agendamentos.filter((a) => a.barbeiro_id === id && a.status !== 'cancelado' && GB.partes(a.inicio).data === dia).length;
    const livres = d.barbeiros.filter((b) => b.ativo && !conflita(b.id, ini, fim, ignorarId));
    livres.sort((a, b) => carga(a.id) - carga(b.id) || a.ordem - b.ordem);
    return livres[0] ? livres[0].id : null;
  }

  /* ---------- API ---------- */
  GB.BancoDemo = {
    modo: 'demo',

    async sessao() {
      const u = usuarioAtual();
      return u ? { usuario: { id: u.id, email: u.email }, perfil: perfilPublico(u) } : null;
    },

    async cadastrar({ nome, email, telefone, senha }) {
      await espera();
      const d = carregar();
      email = email.trim().toLowerCase();
      const tel = String(telefone || '').replace(/\D/g, '') || null;
      if (d.usuarios.some((u) => u.email === email)) erro('Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.');
      if (tel && d.usuarios.some((u) => u.telefone === tel)) erro('Este telefone já está cadastrado.');
      if (senha.length < 6) erro('A senha precisa ter pelo menos 6 caracteres.');
      const u = { id: uid(), email, senha, nome: nome.trim(), telefone: tel, papel: 'cliente' };
      d.usuarios.push(u);
      salvar();
      GB.store.set(CHAVE_SESSAO, u.id);
      return { confirmarEmail: false };
    },

    async entrar(email, senha) {
      await espera();
      const u = carregar().usuarios.find((x) => x.email === email.trim().toLowerCase() && x.senha === senha);
      if (!u) erro('E-mail ou senha incorretos.');
      GB.store.set(CHAVE_SESSAO, u.id);
      return perfilPublico(u);
    },

    async sair() { GB.store.del(CHAVE_SESSAO); },

    async recuperarSenha(email) {
      await espera();
      // No modo demo não há envio de e-mail; o link leva direto à tela de nova senha
      const u = carregar().usuarios.find((x) => x.email === email.trim().toLowerCase());
      if (u) GB.sessionStore.set('greybarber-demo-recuperar', u.id);
      return { demo: true };
    },

    async redefinirSenha(senha) {
      await espera();
      const d = carregar();
      const id = GB.sessionStore.get('greybarber-demo-recuperar') || GB.store.get(CHAVE_SESSAO);
      const u = d.usuarios.find((x) => x.id === id);
      if (!u) erro('Link de recuperação inválido ou expirado. Peça um novo.');
      if (u.senha === senha) erro('A nova senha precisa ser diferente da anterior.');
      u.senha = senha;
      salvar();
      GB.sessionStore.del('greybarber-demo-recuperar');
      GB.store.set(CHAVE_SESSAO, u.id);
    },

    async atualizarPerfil({ nome, telefone }) {
      await espera();
      const u = exigirLogin();
      const tel = String(telefone || '').replace(/\D/g, '') || null;
      if (tel && carregar().usuarios.some((x) => x.telefone === tel && x.id !== u.id)) erro('Este telefone já está cadastrado.');
      u.nome = nome.trim(); u.telefone = tel;
      salvar();
      return perfilPublico(u);
    },

    async listarServicos({ incluirInativos = false } = {}) {
      return carregar().servicos.filter((s) => incluirInativos || s.ativo).sort((a, b) => a.ordem - b.ordem).map((s) => ({ ...s }));
    },
    async listarBarbeiros() {
      return carregar().barbeiros.filter((b) => b.ativo).sort((a, b) => a.ordem - b.ordem).map((b) => ({ ...b }));
    },
    async horariosFuncionamento() { return carregar().horarios.map((h) => ({ ...h })); },

    async horariosDisponiveis({ servicoId, data, barbeiroId = null, ignorarId = null }) {
      await espera(80);
      const d = carregar();
      return GB.calcularHorarios({
        servico: d.servicos.find((s) => s.id === servicoId && s.ativo),
        data,
        horario: d.horarios.find((h) => h.dia_semana === GB.diaSemana(data)),
        barbeiros: d.barbeiros, agendamentos: d.agendamentos, barbeiroId, ignorarId,
      });
    },

    async criarAgendamento({ servicoId, data, hora, barbeiroId = null, observacoes = '' }) {
      await espera();
      const u = exigirLogin();
      const d = carregar();
      const s = d.servicos.find((x) => x.id === servicoId && x.ativo) || erro('Serviço indisponível.');
      const inicio = GB.iso(data, hora);
      validarExpediente(inicio, s.duracao_min);
      const ini = new Date(inicio);
      const fim = new Date(ini.getTime() + s.duracao_min * 60000);
      const futuros = d.agendamentos.filter((a) => a.cliente_id === u.id && a.status === 'confirmado' && new Date(a.inicio) > new Date());
      if (futuros.length >= 3) erro('Você já tem 3 agendamentos futuros. Cancele um para marcar outro.');
      let b = barbeiroId;
      if (b == null) b = barbeiroLivre(ini, fim);
      else if (conflita(b, ini, fim)) b = null;
      if (b == null) erro('Esse horário acabou de ser ocupado. Escolha outro.');
      const novo = {
        id: d.seq++, cliente_id: u.id, barbeiro_id: b, servico_id: s.id, inicio,
        fim: fim.toISOString(), valor: s.preco, status: 'confirmado',
        observacoes: (observacoes || '').trim().slice(0, 500) || null, criado_em: new Date().toISOString(),
      };
      d.agendamentos.push(novo);
      salvar();
      return montar(novo);
    },

    async meusAgendamentos() {
      const u = exigirLogin();
      return carregar().agendamentos.filter((a) => a.cliente_id === u.id)
        .sort((a, b) => new Date(b.inicio) - new Date(a.inicio)).map(montar);
    },

    async cancelarAgendamento(id) {
      await espera();
      const u = exigirLogin();
      const a = carregar().agendamentos.find((x) => x.id === id);
      if (!a || (a.cliente_id !== u.id && !ehFuncionario(u))) erro('Agendamento não encontrado.');
      if (a.status !== 'confirmado') erro('Este agendamento não pode mais ser cancelado.');
      if (!ehFuncionario(u) && new Date(a.inicio) - new Date() < 3600000) erro('Cancelamentos online só até 1 hora antes. Fale com a barbearia pelo WhatsApp.');
      a.status = 'cancelado';
      salvar();
      return montar(a);
    },

    async remarcarAgendamento(id, { data, hora, barbeiroId = null, servicoId = null }) {
      await espera();
      const u = exigirLogin();
      const d = carregar();
      const a = d.agendamentos.find((x) => x.id === id);
      if (!a || (a.cliente_id !== u.id && !ehFuncionario(u))) erro('Agendamento não encontrado.');
      if (a.status !== 'confirmado') erro('Só é possível remarcar agendamentos confirmados.');
      if (!ehFuncionario(u) && new Date(a.inicio) - new Date() < 3600000) erro('Remarcações online só até 1 hora antes. Fale com a barbearia pelo WhatsApp.');
      const s = d.servicos.find((x) => x.id === (servicoId || a.servico_id));
      const inicio = GB.iso(data, hora);
      validarExpediente(inicio, s.duracao_min);
      const ini = new Date(inicio);
      const fim = new Date(ini.getTime() + s.duracao_min * 60000);
      let b = barbeiroId ?? barbeiroLivre(ini, fim, id);
      if (b == null || conflita(b, ini, fim, id)) erro('Esse horário já está ocupado. Escolha outro.');
      Object.assign(a, { inicio, fim: fim.toISOString(), barbeiro_id: b, servico_id: s.id, valor: s.preco });
      salvar();
      return montar(a);
    },

    async avaliar(agendamentoId, nota, comentario) {
      await espera();
      const u = exigirLogin();
      const d = carregar();
      const a = d.agendamentos.find((x) => x.id === agendamentoId && x.cliente_id === u.id && x.status === 'concluido');
      if (!a) erro('Você só pode avaliar atendimentos concluídos.');
      const existente = d.avaliacoes.find((x) => x.agendamento_id === agendamentoId);
      const c = (comentario || '').trim().slice(0, 500) || null;
      if (existente) Object.assign(existente, { nota, comentario: c });
      else d.avaliacoes.push({ id: agendamentoId, agendamento_id: agendamentoId, cliente_id: u.id, nota, comentario: c, publicada: true, criado_em: new Date().toISOString() });
      salvar();
    },

    async avaliacoesPublicas(limite = 8) {
      const d = carregar();
      return d.avaliacoes
        .filter((a) => a.publicada && a.comentario && a.nota >= 4)
        .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
        .slice(0, limite)
        .map((a) => {
          const u = d.usuarios.find((x) => x.id === a.cliente_id) || { nome: 'Cliente' };
          const ag = d.agendamentos.find((x) => x.id === a.agendamento_id);
          const s = d.servicos.find((x) => ag && x.id === ag.servico_id);
          const [p1, p2] = u.nome.split(' ');
          return { nome: p2 ? `${p1} ${p2[0]}.` : p1, nota: a.nota, comentario: a.comentario, servico: s ? s.nome : '', criado_em: a.criado_em };
        });
    },

    /* ----- Funcionários ----- */
    async agendamentosPeriodo({ de, ate }) {
      exigirFuncionario();
      const ini = new Date(GB.iso(de, '00:00'));
      const fim = new Date(GB.iso(GB.somarDias(ate, 1), '00:00'));
      return carregar().agendamentos
        .filter((a) => new Date(a.inicio) >= ini && new Date(a.inicio) < fim)
        .sort((a, b) => new Date(a.inicio) - new Date(b.inicio)).map(montar);
    },

    async concluirAgendamento(id) {
      await espera();
      exigirFuncionario();
      const a = carregar().agendamentos.find((x) => x.id === id && x.status === 'confirmado');
      if (!a) erro('Agendamento não encontrado ou já finalizado.');
      a.status = 'concluido';
      salvar();
      return montar(a);
    },

    async excluirAgendamento(id) {
      await espera();
      exigirFuncionario();
      const d = carregar();
      d.agendamentos = d.agendamentos.filter((a) => a.id !== id);
      d.avaliacoes = d.avaliacoes.filter((a) => a.agendamento_id !== id);
      salvar();
    },

    async listarClientes() {
      exigirFuncionario();
      const d = carregar();
      return d.usuarios.filter((u) => u.papel === 'cliente').map((u) => {
        const ags = d.agendamentos.filter((a) => a.cliente_id === u.id);
        const feitos = ags.filter((a) => a.status === 'concluido');
        const ultima = feitos.map((a) => a.inicio).sort().pop() || null;
        const proximo = ags.filter((a) => a.status === 'confirmado' && new Date(a.inicio) > new Date()).map((a) => a.inicio).sort()[0] || null;
        return { ...perfilPublico(u), visitas: feitos.length, ultimaVisita: ultima, proximo, totalGasto: feitos.reduce((t, a) => t + Number(a.valor), 0) };
      });
    },

    async salvarServico(s) {
      await espera();
      const u = exigirFuncionario();
      if (u.papel !== 'admin') erro('Apenas o administrador pode alterar serviços.');
      const d = carregar();
      const atual = d.servicos.find((x) => x.id === s.id) || erro('Serviço não encontrado.');
      Object.assign(atual, {
        preco: Number(s.preco), duracao_min: Number(s.duracao_min), ativo: !!s.ativo,
        descricao: s.descricao ?? atual.descricao,
      });
      salvar();
      return { ...atual };
    },

    /* Apaga tudo e recria os dados de exemplo */
    async resetarDemo() { GB.store.del(CHAVE); GB.store.del(CHAVE_SESSAO); db = null; carregar(); },
  };
})();
