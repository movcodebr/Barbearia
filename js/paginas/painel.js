/* Painel do funcionário */
(function () {
  'use strict';
  const GB = window.GB;
  let sessao;
  let data = GB.hoje();
  let doDia = [];
  let clientes = null;
  let barbeiros = [];

  /* ---------- Agenda do dia ---------- */
  async function carregarDia() {
    GB.$('#data-painel').value = data;
    const alvo = GB.$('#agenda');
    alvo.innerHTML = '<div class="esqueleto"></div>';
    try {
      doDia = await GB.api.agendamentosPeriodo({ de: data, ate: data });
    } catch (e) {
      alvo.innerHTML = `<p class="alerta">${GB.esc(GB.erroAmigavel(e))}</p>`;
      return;
    }
    indicadores();
    renderAgenda();
    if (!GB.$('#painel-semana').hidden) carregarSemana();
  }

  function indicadores() {
    const ativos = doDia.filter((a) => a.status !== 'cancelado');
    const feitos = doDia.filter((a) => a.status === 'concluido');
    GB.$('#i-agendados').textContent = ativos.length;
    GB.$('#i-concluidos').textContent = feitos.length;
    GB.$('#i-receita').textContent = GB.fmt.moeda(feitos.reduce((t, a) => t + a.valor, 0));
    GB.$('#i-prevista').textContent = GB.fmt.moeda(ativos.reduce((t, a) => t + a.valor, 0));
  }

  function acoesPara(a) {
    const btns = [];
    if (a.status === 'confirmado') {
      btns.push('<button type="button" class="btn btn-sucesso btn-sm" data-acao="concluir"><i class="bi bi-check-lg" aria-hidden="true"></i> Concluir</button>');
      btns.push('<button type="button" class="btn btn-contorno btn-sm" data-acao="remarcar"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Remarcar</button>');
      btns.push('<button type="button" class="btn btn-perigo btn-sm" data-acao="cancelar"><i class="bi bi-x-lg" aria-hidden="true"></i> Cancelar</button>');
    }
    btns.push('<button type="button" class="btn-icone" data-acao="excluir" aria-label="Excluir agendamento" title="Excluir"><i class="bi bi-trash"></i></button>');
    return btns.join('');
  }

  function renderAgenda() {
    const fb = GB.$('#filtro-barbeiro').value;
    const fs = GB.$('#filtro-status').value;
    const lista = doDia.filter((a) => (!fb || String(a.barbeiro.id) === fb) && (!fs || a.status === fs));
    const titulo = data === GB.hoje() ? 'Hoje' : GB.fmt.dataLonga(data);
    GB.$('#agenda').innerHTML = `<h2 class="subtitulo">${GB.esc(titulo)} <small class="texto-suave">· ${lista.length} agendamento${lista.length === 1 ? '' : 's'}</small></h2>` +
      (lista.length
        ? lista.map((a) => GB.cartaoAgendamento(a, { mostrarCliente: true, acoes: acoesPara(a) })).join('')
        : '<div class="vazio cartao"><i class="bi bi-cup-hot" aria-hidden="true"></i><span>Nenhum agendamento para este filtro.</span></div>');
  }

  /* ---------- Próximos 7 dias ---------- */
  async function carregarSemana() {
    const alvo = GB.$('#semana');
    alvo.innerHTML = '<div class="esqueleto"></div>';
    try {
      const ate = GB.somarDias(data, 6);
      const lista = (await GB.api.agendamentosPeriodo({ de: data, ate })).filter((a) => a.status !== 'cancelado');
      const dias = [];
      for (let i = 0; i < 7; i++) dias.push(GB.somarDias(data, i));
      alvo.innerHTML = `<div class="semana-grade">${dias.map((d) => {
        const doD = lista.filter((a) => GB.partes(a.inicio).data === d);
        const total = doD.reduce((t, a) => t + a.valor, 0);
        return `
          <section class="semana-dia cartao">
            <header><button type="button" class="link-btn" data-ir="${d}">${GB.esc(GB.fmt.dataLonga(d))}</button>
              <small class="texto-suave">${doD.length} · ${GB.fmt.moeda(total)}</small></header>
            ${doD.length ? `<ul class="lista-limpa">${doD.map((a) => `
              <li><strong>${GB.fmt.hora(a.inicio)}</strong> ${GB.esc(a.servico.nome)} <span class="texto-suave">· ${GB.esc(String(a.cliente.nome || '').split(' ')[0])} · ${GB.esc(a.barbeiro.nome)}</span></li>`).join('')}</ul>`
              : '<p class="texto-suave">Livre</p>'}
          </section>`;
      }).join('')}</div>`;
    } catch (e) {
      alvo.innerHTML = `<p class="alerta">${GB.esc(GB.erroAmigavel(e))}</p>`;
    }
  }

  /* ---------- Clientes ---------- */
  async function carregarClientes() {
    const tbody = GB.$('#tabela-clientes tbody');
    if (!clientes) {
      tbody.innerHTML = '<tr><td colspan="6"><span class="spinner"></span> Carregando…</td></tr>';
      try { clientes = await GB.api.listarClientes(); } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6">${GB.esc(GB.erroAmigavel(e))}</td></tr>`;
        return;
      }
    }
    const q = GB.$('#busca-cliente').value.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    const lista = clientes
      .filter((c) => !q || String(c.nome).toLowerCase().includes(q) || String(c.email).toLowerCase().includes(q) || (qd && String(c.telefone || '').includes(qd)))
      .sort((a, b) => b.visitas - a.visitas || String(a.nome).localeCompare(b.nome));
    tbody.innerHTML = lista.length ? lista.map((c) => `
      <tr>
        <td data-rotulo="Cliente"><strong>${GB.esc(c.nome)}</strong></td>
        <td data-rotulo="Contato">${c.telefone ? `<a href="https://wa.me/55${GB.esc(c.telefone)}" target="_blank" rel="noopener"><i class="bi bi-whatsapp" aria-hidden="true"></i> ${GB.esc(GB.fmt.telefone(c.telefone))}</a><br>` : ''}<span class="texto-suave">${GB.esc(c.email)}</span></td>
        <td data-rotulo="Visitas">${c.visitas}</td>
        <td data-rotulo="Última visita">${c.ultimaVisita ? GB.fmt.data(c.ultimaVisita) : '—'}</td>
        <td data-rotulo="Próximo">${c.proximo ? `${GB.fmt.data(c.proximo)} ${GB.fmt.hora(c.proximo)}` : '—'}</td>
        <td data-rotulo="Total gasto">${GB.fmt.moeda(c.totalGasto)}</td>
      </tr>`).join('') : '<tr><td colspan="6">Nenhum cliente encontrado.</td></tr>';
  }

  /* ---------- Serviços (admin) ---------- */
  async function carregarServicos() {
    const tbody = GB.$('#tabela-servicos-admin tbody');
    const admin = sessao.perfil.papel === 'admin';
    if (!admin) GB.$('#aviso-servicos').textContent = 'Somente o administrador pode alterar preços e serviços.';
    try {
      const lista = await GB.api.listarServicos({ incluirInativos: true });
      tbody.innerHTML = lista.map((s) => `
        <tr data-servico="${s.id}">
          <td data-rotulo="Serviço"><strong>${GB.esc(s.nome)}</strong><br><small class="texto-suave">${GB.esc(s.categoria)}</small></td>
          <td data-rotulo="Preço (R$)"><input class="entrada entrada-mini" type="number" min="0" step="0.5" name="preco" value="${s.preco}" ${admin ? '' : 'disabled'} aria-label="Preço de ${GB.esc(s.nome)}"></td>
          <td data-rotulo="Duração (min)"><input class="entrada entrada-mini" type="number" min="5" max="240" step="5" name="duracao_min" value="${s.duracao_min}" ${admin ? '' : 'disabled'} aria-label="Duração de ${GB.esc(s.nome)}"></td>
          <td data-rotulo="Ativo"><label class="interruptor"><input type="checkbox" name="ativo" ${s.ativo ? 'checked' : ''} ${admin ? '' : 'disabled'}><span aria-hidden="true"></span><span class="sr-only">Ativo</span></label></td>
          <td>${admin ? '<button type="button" class="btn btn-contorno btn-sm" data-salvar>Salvar</button>' : ''}</td>
        </tr>`).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5">${GB.esc(GB.erroAmigavel(e))}</td></tr>`;
    }
  }

  /* ---------- Abas ---------- */
  function ativarAba(aba) {
    GB.$$('[role="tab"]').forEach((t) => {
      const sel = t === aba;
      t.setAttribute('aria-selected', String(sel));
      t.tabIndex = sel ? 0 : -1;
      GB.$(`#${t.getAttribute('aria-controls')}`).hidden = !sel;
    });
    if (aba.id === 'aba-semana') carregarSemana();
    if (aba.id === 'aba-clientes') carregarClientes();
    if (aba.id === 'aba-servicos') carregarServicos();
  }

  /* ---------- Eventos ---------- */
  function ligar() {
    GB.$('#data-painel').addEventListener('change', (e) => { if (e.target.value) { data = e.target.value; carregarDia(); } });
    GB.$('#dia-anterior').addEventListener('click', () => { data = GB.somarDias(data, -1); carregarDia(); });
    GB.$('#dia-seguinte').addEventListener('click', () => { data = GB.somarDias(data, 1); carregarDia(); });
    GB.$('#btn-hoje').addEventListener('click', () => { data = GB.hoje(); carregarDia(); });
    GB.$('#filtro-barbeiro').addEventListener('change', renderAgenda);
    GB.$('#filtro-status').addEventListener('change', renderAgenda);
    GB.$('#busca-cliente').addEventListener('input', carregarClientes);

    const abas = GB.$$('[role="tab"]');
    abas.forEach((t, i) => {
      t.addEventListener('click', () => ativarAba(t));
      t.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        const prox = abas[(i + d + abas.length) % abas.length];
        prox.focus();
        ativarAba(prox);
      });
    });

    GB.$('#semana').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ir]');
      if (!b) return;
      data = b.dataset.ir;
      ativarAba(GB.$('#aba-agenda'));
      carregarDia();
    });

    GB.$('#agenda').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-acao]');
      if (!b) return;
      const ag = doDia.find((a) => a.id === Number(b.closest('[data-id]').dataset.id));
      if (!ag) return;
      const desc = `${ag.servico.nome} · ${ag.cliente.nome} · ${GB.fmt.hora(ag.inicio)}`;
      try {
        if (b.dataset.acao === 'concluir') {
          await GB.api.concluirAgendamento(ag.id);
          GB.toast('Atendimento concluído.');
        } else if (b.dataset.acao === 'remarcar') {
          return GB.abrirRemarcar(ag, { onFeito: () => { clientes = null; carregarDia(); } });
        } else if (b.dataset.acao === 'cancelar') {
          if (!(await GB.confirmar('Cancelar agendamento?', desc, 'Sim, cancelar', true))) return;
          await GB.api.cancelarAgendamento(ag.id);
          GB.toast('Agendamento cancelado.');
        } else if (b.dataset.acao === 'excluir') {
          if (!(await GB.confirmar('Excluir agendamento?', `${desc}. Isso apaga o registro de vez (para manter o histórico, prefira cancelar).`, 'Excluir', true))) return;
          await GB.api.excluirAgendamento(ag.id);
          GB.toast('Agendamento excluído.');
        }
        clientes = null;
        carregarDia();
      } catch (err) { GB.toast(GB.erroAmigavel(err), 'erro'); }
    });

    GB.$('#tabela-servicos-admin').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-salvar]');
      if (!b) return;
      const tr = b.closest('tr');
      const s = {
        id: Number(tr.dataset.servico),
        preco: GB.$('[name="preco"]', tr).value,
        duracao_min: GB.$('[name="duracao_min"]', tr).value,
        ativo: GB.$('[name="ativo"]', tr).checked,
      };
      if (!(Number(s.preco) >= 0) || !(Number(s.duracao_min) >= 5 && Number(s.duracao_min) <= 240)) {
        GB.toast('Confira preço e duração (5 a 240 min).', 'erro');
        return;
      }
      GB.carregando(b, true, '');
      try { await GB.api.salvarServico(s); GB.toast('Serviço atualizado.'); } catch (err) { GB.toast(GB.erroAmigavel(err), 'erro'); }
      GB.carregando(b, false);
    });
  }

  async function iniciar() {
    sessao = await GB.exigirSessao({ funcionario: true });
    GB.$('#painel-ola').textContent = `Olá, ${String(sessao.perfil.nome).split(' ')[0]}`;
    try {
      barbeiros = await GB.api.listarBarbeiros();
      GB.$('#filtro-barbeiro').insertAdjacentHTML('beforeend', barbeiros.map((b) => `<option value="${b.id}">${GB.esc(b.nome)}</option>`).join(''));
    } catch { /* filtro fica só com "todos" */ }
    ligar();
    carregarDia();
  }
  iniciar();
})();
