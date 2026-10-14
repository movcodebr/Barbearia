/* Página de agendamento */
(function () {
  'use strict';
  const GB = window.GB;
  const RASCUNHO = 'greybarber-rascunho';
  const DIAS_A_FRENTE = 21;

  const estado = { servico: null, barbeiroId: null, data: null, hora: null };
  let servicos = [];
  let barbeiros = [];
  let horarios = [];
  let pedido = 0; // evita resposta antiga sobrescrever a nova

  /* ---------- Render das opções ---------- */
  function renderServicos() {
    GB.$('#opcoes-servico').innerHTML = servicos.map((s) => `
      <label class="opcao">
        <input type="radio" name="servico" value="${s.id}">
        <span class="opcao-corpo">
          <span class="opcao-titulo">${GB.esc(s.nome)}</span>
          <span class="opcao-desc">${GB.esc(s.descricao || '')}</span>
          <span class="opcao-meta"><span><i class="bi bi-clock" aria-hidden="true"></i> ${GB.fmt.duracao(s.duracao_min)}</span><strong>${GB.fmt.moeda(s.preco)}</strong></span>
        </span>
      </label>`).join('');
  }

  function renderBarbeiros() {
    const sem = `
      <label class="opcao opcao-barbeiro">
        <input type="radio" name="barbeiro" value="">
        <span class="opcao-corpo"><span class="avatar" aria-hidden="true"><i class="bi bi-shuffle"></i></span>
          <span><span class="opcao-titulo">Sem preferência</span><span class="opcao-desc">Mais horários disponíveis</span></span></span>
      </label>`;
    GB.$('#opcoes-barbeiro').innerHTML = sem + barbeiros.map((b) => `
      <label class="opcao opcao-barbeiro">
        <input type="radio" name="barbeiro" value="${b.id}">
        <span class="opcao-corpo"><span class="avatar" aria-hidden="true">${GB.esc(GB.fmt.iniciais(b.nome))}</span>
          <span><span class="opcao-titulo">${GB.esc(b.nome)}</span><span class="opcao-desc">${GB.esc(b.especialidade || '')}</span></span></span>
      </label>`).join('');
  }

  function renderDias() {
    const hoje = GB.hoje();
    const html = [];
    for (let i = 0; i < DIAS_A_FRENTE; i++) {
      const data = GB.somarDias(hoje, i);
      const h = horarios.find((x) => x.dia_semana === GB.diaSemana(data));
      const fechado = !h || !h.abre;
      const d = GB.fmt.diaCurto(data);
      const rotulo = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : d.semana;
      html.push(`<button type="button" class="dia" data-data="${data}" aria-pressed="false" ${fechado ? 'disabled title="Fechado"' : ''}
        aria-label="${GB.esc(GB.fmt.dataLonga(data))}${fechado ? ' (fechado)' : ''}"><small>${rotulo}</small><strong>${d.dia}</strong><small>${d.mes}</small></button>`);
    }
    GB.$('#dias').innerHTML = html.join('');
  }

  /* ---------- Horários livres ---------- */
  async function carregarHoras() {
    const alvo = GB.$('#horas');
    estado.hora = null;
    atualizarResumo();
    if (!estado.servico) { alvo.innerHTML = '<p class="texto-suave">Escolha o serviço para ver os horários.</p>'; return; }
    if (!estado.data) { alvo.innerHTML = '<p class="texto-suave">Escolha um dia acima.</p>'; return; }
    const meu = ++pedido;
    alvo.innerHTML = '<p class="texto-suave"><span class="spinner"></span> Buscando horários livres…</p>';
    try {
      const livres = await GB.api.horariosDisponiveis({ servicoId: estado.servico.id, data: estado.data, barbeiroId: estado.barbeiroId });
      if (meu !== pedido) return;
      if (!livres.length) {
        alvo.innerHTML = `<div class="vazio"><i class="bi bi-calendar-x" aria-hidden="true"></i><span>Sem horários livres neste dia${estado.barbeiroId ? ' com este profissional' : ''}.</span>
          ${estado.barbeiroId ? '<button type="button" class="btn btn-fantasma btn-sm" id="tentar-sem-pref">Ver com qualquer profissional</button>' : '<span>Tente outro dia.</span>'}</div>`;
        const b = GB.$('#tentar-sem-pref');
        if (b) b.addEventListener('click', () => { GB.$('input[name="barbeiro"][value=""]').click(); });
        return;
      }
      const grupos = { Manhã: [], Tarde: [] };
      livres.forEach((h) => (GB.minutos(h) < 12 * 60 ? grupos.Manhã : grupos.Tarde).push(h));
      alvo.innerHTML = Object.entries(grupos).filter(([, l]) => l.length).map(([nome, l]) => `
        <div class="grupo-horas"><span class="rotulo-horas">${nome}</span>
          <div class="horas" role="group" aria-label="Horários da ${nome.toLowerCase()}">
            ${l.map((h) => `<button type="button" class="hora" data-hora="${h}" aria-pressed="${h === estado.horaDesejada}">${h}</button>`).join('')}
          </div></div>`).join('');
      if (estado.horaDesejada && livres.includes(estado.horaDesejada)) estado.hora = estado.horaDesejada;
      estado.horaDesejada = null;
      atualizarResumo();
    } catch (e) {
      if (meu !== pedido) return;
      alvo.innerHTML = `<p class="alerta">${GB.esc(GB.erroAmigavel(e))}</p>`;
    }
  }

  /* ---------- Resumo ---------- */
  function atualizarResumo() {
    const b = barbeiros.find((x) => x.id === estado.barbeiroId);
    GB.$('#r-servico').textContent = estado.servico ? `${estado.servico.nome} (${GB.fmt.duracao(estado.servico.duracao_min)})` : '—';
    GB.$('#r-barbeiro').textContent = b ? b.nome : 'Sem preferência';
    GB.$('#r-data').textContent = estado.data ? GB.fmt.dataLonga(estado.data) : '—';
    GB.$('#r-hora').textContent = estado.hora || '—';
    GB.$('#r-total').textContent = GB.fmt.moeda(estado.servico ? estado.servico.preco : 0);
    GB.$('#btn-confirmar').disabled = !(estado.servico && estado.data && estado.hora);
  }

  /* ---------- Eventos ---------- */
  function ligarEventos() {
    GB.$('#opcoes-servico').addEventListener('change', (e) => {
      estado.servico = servicos.find((s) => s.id === Number(e.target.value));
      carregarHoras();
    });
    GB.$('#opcoes-barbeiro').addEventListener('change', (e) => {
      estado.barbeiroId = e.target.value ? Number(e.target.value) : null;
      carregarHoras();
    });
    GB.$('#dias').addEventListener('click', (e) => {
      const b = e.target.closest('.dia');
      if (!b || b.disabled) return;
      GB.$$('.dia').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      estado.data = b.dataset.data;
      carregarHoras();
    });
    GB.$('#horas').addEventListener('click', (e) => {
      const b = e.target.closest('.hora');
      if (!b) return;
      GB.$$('.hora').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      estado.hora = b.dataset.hora;
      atualizarResumo();
    });
    GB.$('#form-agendar').addEventListener('submit', confirmar);
  }

  /* ---------- Confirmar ---------- */
  async function confirmar(e) {
    e.preventDefault();
    const erroBox = GB.$('#erro-agendar');
    erroBox.classList.add('oculto');
    if (!(estado.servico && estado.data && estado.hora)) return;
    const obs = GB.$('#observacoes').value;

    const sessao = await GB.api.sessao();
    if (!sessao) {
      GB.sessionStore.set(RASCUNHO, JSON.stringify({ servicoId: estado.servico.id, barbeiroId: estado.barbeiroId, data: estado.data, hora: estado.hora, obs }));
      location.href = 'login.html?voltar=agendar.html';
      return;
    }

    const btn = GB.$('#btn-confirmar');
    GB.carregando(btn, true, 'Confirmando…');
    try {
      const ag = await GB.api.criarAgendamento({ servicoId: estado.servico.id, data: estado.data, hora: estado.hora, barbeiroId: estado.barbeiroId, observacoes: obs });
      GB.sessionStore.del(RASCUNHO);
      mostrarSucesso(ag, sessao);
    } catch (err) {
      erroBox.innerHTML = `<i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>${GB.esc(GB.erroAmigavel(err))}</span>`;
      erroBox.classList.remove('oculto');
      GB.carregando(btn, false);
      carregarHoras(); // atualiza a grade (o horário pode ter sido ocupado)
    }
  }

  function mostrarSucesso(ag, sessao) {
    GB.$('.agendar-grade').classList.add('oculto');
    GB.$('.pagina-topo').classList.add('oculto');
    const s = GB.$('#sucesso');
    const msgWhats = `Olá! Acabei de agendar pelo site: ${ag.servico.nome} com ${ag.barbeiro.nome} em ${GB.fmt.data(ag.inicio)} às ${GB.fmt.hora(ag.inicio)}. Nome: ${sessao.perfil.nome}.`;
    s.innerHTML = `
      <div class="sucesso cartao">
        <div class="sucesso-icone" aria-hidden="true"><i class="bi bi-check-lg"></i></div>
        <span class="sobretitulo">Agendamento confirmado</span>
        <h1 class="titulo-secao">Te esperamos!</h1>
        <dl class="resumo-lista">
          <div><dt>Serviço</dt><dd>${GB.esc(ag.servico.nome)}</dd></div>
          <div><dt>Profissional</dt><dd>${GB.esc(ag.barbeiro.nome)}</dd></div>
          <div><dt>Quando</dt><dd>${GB.esc(GB.fmt.dataLonga(ag.inicio))}, ${GB.fmt.hora(ag.inicio)}</dd></div>
          <div class="resumo-total"><dt>Valor</dt><dd>${GB.fmt.moeda(ag.valor)}</dd></div>
        </dl>
        <div class="sucesso-acoes">
          <a class="btn btn-primario" href="minha-conta.html">Ver meus agendamentos</a>
          <a class="btn btn-contorno" href="${GB.linkGoogleAgenda(ag)}" target="_blank" rel="noopener"><i class="bi bi-calendar-plus" aria-hidden="true"></i> Salvar na agenda</a>
          <a class="btn btn-fantasma" href="${GB.linkWhatsApp(msgWhats)}" target="_blank" rel="noopener"><i class="bi bi-whatsapp" aria-hidden="true"></i> Avisar no WhatsApp</a>
        </div>
      </div>`;
    s.classList.remove('oculto');
    s.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Pré-seleções (URL ou rascunho salvo antes do login) ---------- */
  function aplicarPreSelecao(sessao) {
    let r = null;
    try { r = JSON.parse(GB.sessionStore.get(RASCUNHO) || 'null'); } catch { r = null; }
    const servicoId = r ? r.servicoId : Number(GB.param('servico')) || null;
    const barbeiroId = r ? r.barbeiroId : Number(GB.param('barbeiro')) || null;

    const marcar = (nome, valor) => {
      const el = GB.$(`input[name="${nome}"][value="${valor ?? ''}"]`);
      if (el) el.checked = true;
      return !!el;
    };
    if (servicoId && marcar('servico', servicoId)) estado.servico = servicos.find((s) => s.id === servicoId);
    if (marcar('barbeiro', barbeiroId) && barbeiroId) estado.barbeiroId = barbeiroId;
    if (r) {
      GB.$('#observacoes').value = r.obs || '';
      const dia = GB.$(`.dia[data-data="${r.data}"]:not(:disabled)`);
      if (dia) { dia.setAttribute('aria-pressed', 'true'); estado.data = r.data; estado.horaDesejada = r.hora; }
      if (sessao) GB.toast('Escolhas recuperadas. Agora é só confirmar!', 'info');
    } else {
      // seleciona automaticamente o primeiro dia aberto
      const primeiro = GB.$('.dia:not(:disabled)');
      if (primeiro) { primeiro.setAttribute('aria-pressed', 'true'); estado.data = primeiro.dataset.data; }
    }
    if (estado.servico) GB.$('#passo-barbeiro').scrollIntoView({ block: 'nearest' });
  }

  async function iniciar() {
    try {
      [servicos, barbeiros, horarios] = await Promise.all([GB.api.listarServicos(), GB.api.listarBarbeiros(), GB.api.horariosFuncionamento()]);
    } catch (e) {
      GB.$('#opcoes-servico').innerHTML = `<p class="alerta">${GB.esc(GB.erroAmigavel(e))}</p>`;
      return;
    }
    renderServicos();
    renderBarbeiros();
    renderDias();
    ligarEventos();
    const sessao = await GB.api.sessao().catch(() => null);
    if (!sessao) GB.$('#aviso-login').classList.remove('oculto');
    aplicarPreSelecao(sessao);
    carregarHoras();
  }

  iniciar();
})();
