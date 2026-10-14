/* Janela de remarcação — usada em "Meus agendamentos" e no painel */
(function () {
  'use strict';
  const GB = window.GB;

  GB.abrirRemarcar = async (ag, { onFeito } = {}) => {
    let horarios = [];
    let barbeiros = [];
    try {
      [horarios, barbeiros] = await Promise.all([GB.api.horariosFuncionamento(), GB.api.listarBarbeiros()]);
    } catch (e) { GB.toast(GB.erroAmigavel(e), 'erro'); return; }

    const estado = { data: null, hora: null, barbeiroId: ag.barbeiro.id };
    const hoje = GB.hoje();
    const dias = [];
    for (let i = 0; i < 21; i++) {
      const data = GB.somarDias(hoje, i);
      const h = horarios.find((x) => x.dia_semana === GB.diaSemana(data));
      const d = GB.fmt.diaCurto(data);
      dias.push(`<button type="button" class="dia" data-data="${data}" aria-pressed="false" ${!h || !h.abre ? 'disabled' : ''}
        aria-label="${GB.esc(GB.fmt.dataLonga(data))}"><small>${i === 0 ? 'Hoje' : d.semana}</small><strong>${d.dia}</strong><small>${d.mes}</small></button>`);
    }

    const m = GB.modal({
      titulo: 'Remarcar horário',
      conteudo: `
        <p class="texto-suave">${GB.esc(ag.servico.nome)} · atual: ${GB.esc(GB.fmt.dataLonga(ag.inicio))}, ${GB.fmt.hora(ag.inicio)} com ${GB.esc(ag.barbeiro.nome)}</p>
        <div class="campo">
          <label for="rm-barbeiro">Profissional</label>
          <select id="rm-barbeiro" class="entrada">
            <option value="">Sem preferência</option>
            ${barbeiros.map((b) => `<option value="${b.id}" ${b.id === ag.barbeiro.id ? 'selected' : ''}>${GB.esc(b.nome)}</option>`).join('')}
          </select>
        </div>
        <span class="rotulo">Novo dia</span>
        <div class="dias" id="rm-dias">${dias.join('')}</div>
        <div id="rm-horas" aria-live="polite"><p class="texto-suave">Escolha um dia.</p></div>
        <div id="rm-erro" class="alerta oculto" role="alert"></div>
        <div class="modal-acoes">
          <button type="button" class="btn btn-fantasma" data-fechar>Voltar</button>
          <button type="button" class="btn btn-primario" id="rm-salvar" disabled>Salvar novo horário</button>
        </div>`,
    });
    const c = m.corpo;
    let pedido = 0;

    async function horas() {
      estado.hora = null;
      GB.$('#rm-salvar', c).disabled = true;
      if (!estado.data) return;
      const meu = ++pedido;
      const alvo = GB.$('#rm-horas', c);
      alvo.innerHTML = '<p class="texto-suave"><span class="spinner"></span> Buscando horários…</p>';
      try {
        const livres = await GB.api.horariosDisponiveis({ servicoId: ag.servico.id, data: estado.data, barbeiroId: estado.barbeiroId, ignorarId: ag.id });
        if (meu !== pedido) return;
        alvo.innerHTML = livres.length
          ? `<div class="horas">${livres.map((h) => `<button type="button" class="hora" data-hora="${h}" aria-pressed="false">${h}</button>`).join('')}</div>`
          : '<p class="texto-suave">Sem horários livres neste dia.</p>';
      } catch (e) { alvo.innerHTML = `<p class="alerta">${GB.esc(GB.erroAmigavel(e))}</p>`; }
    }

    GB.$('#rm-barbeiro', c).addEventListener('change', (e) => { estado.barbeiroId = e.target.value ? Number(e.target.value) : null; horas(); });
    GB.$('#rm-dias', c).addEventListener('click', (e) => {
      const b = e.target.closest('.dia');
      if (!b || b.disabled) return;
      GB.$$('.dia', c).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      estado.data = b.dataset.data;
      horas();
    });
    GB.$('#rm-horas', c).addEventListener('click', (e) => {
      const b = e.target.closest('.hora');
      if (!b) return;
      GB.$$('.hora', c).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      estado.hora = b.dataset.hora;
      GB.$('#rm-salvar', c).disabled = false;
    });
    GB.$('#rm-salvar', c).addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      GB.carregando(btn, true, 'Salvando…');
      try {
        await GB.api.remarcarAgendamento(ag.id, { data: estado.data, hora: estado.hora, barbeiroId: estado.barbeiroId });
        m.fechar();
        GB.toast('Horário remarcado!');
        onFeito && onFeito();
      } catch (err) {
        const box = GB.$('#rm-erro', c);
        box.textContent = GB.erroAmigavel(err);
        box.classList.remove('oculto');
        GB.carregando(btn, false);
        horas();
      }
    });
  };

  /* Cartão de agendamento (lista) */
  GB.cartaoAgendamento = (ag, { mostrarCliente = false, acoes = '' } = {}) => {
    const st = { confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' }[ag.status];
    return `
      <article class="item-ag status-borda-${ag.status}" data-id="${ag.id}">
        <div class="item-ag-hora">
          <strong>${GB.fmt.hora(ag.inicio)}</strong>
          <small>${GB.fmt.hora(ag.fim)}</small>
        </div>
        <div class="item-ag-info">
          <div class="item-ag-topo">
            <h3>${GB.esc(ag.servico.nome)}</h3>
            <span class="status status-${ag.status}">${st}</span>
          </div>
          ${mostrarCliente
            ? `<p><i class="bi bi-person" aria-hidden="true"></i> ${GB.esc(ag.cliente.nome || '—')}
                ${ag.cliente.telefone ? ` · <a href="https://wa.me/55${GB.esc(ag.cliente.telefone)}" target="_blank" rel="noopener"><i class="bi bi-whatsapp" aria-hidden="true"></i> ${GB.esc(GB.fmt.telefone(ag.cliente.telefone))}</a>` : ''}</p>`
            : `<p class="texto-suave"><i class="bi bi-calendar3" aria-hidden="true"></i> ${GB.esc(GB.fmt.dataLonga(ag.inicio))}</p>`}
          <p class="texto-suave"><i class="bi bi-scissors" aria-hidden="true"></i> ${GB.esc(ag.barbeiro.nome)} · ${GB.fmt.moeda(ag.valor)}</p>
          ${ag.observacoes ? `<p class="item-ag-obs"><i class="bi bi-chat-left-text" aria-hidden="true"></i> ${GB.esc(ag.observacoes)}</p>` : ''}
          ${acoes ? `<div class="item-ag-acoes">${acoes}</div>` : ''}
        </div>
      </article>`;
  };
})();
