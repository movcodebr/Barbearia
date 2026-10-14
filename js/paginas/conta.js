/* Minha conta — agendamentos do cliente */
(function () {
  'use strict';
  const GB = window.GB;
  let lista = [];

  async function carregar() {
    try {
      lista = await GB.api.meusAgendamentos();
    } catch (e) {
      GB.$('#proximos').innerHTML = `<p class="alerta">${GB.esc(GB.erroAmigavel(e))}</p>`;
      return;
    }
    const agora = new Date();
    const proximos = lista.filter((a) => a.status === 'confirmado' && new Date(a.fim) > agora)
      .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    const historico = lista.filter((a) => !proximos.includes(a));

    GB.$('#proximos').innerHTML = proximos.length
      ? proximos.map((a) => GB.cartaoAgendamento(a, {
        acoes: `
          <button type="button" class="btn btn-contorno btn-sm" data-acao="remarcar"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Remarcar</button>
          <a class="btn btn-fantasma btn-sm" href="${GB.linkGoogleAgenda(a)}" target="_blank" rel="noopener"><i class="bi bi-calendar-plus" aria-hidden="true"></i> Agenda</a>
          <button type="button" class="btn btn-perigo btn-sm" data-acao="cancelar"><i class="bi bi-x-lg" aria-hidden="true"></i> Cancelar</button>`,
      })).join('')
      : `<div class="vazio cartao"><i class="bi bi-calendar-plus" aria-hidden="true"></i><span>Você não tem horários marcados.</span><a class="btn btn-primario btn-sm" href="agendar.html">Agendar agora</a></div>`;

    GB.$('#historico').innerHTML = historico.length
      ? historico.map((a) => {
        let acoes = '';
        if (a.status === 'concluido') {
          acoes = a.avaliacao
            ? `<span class="estrelas" aria-label="Sua nota: ${a.avaliacao.nota} de 5">${GB.estrelas(a.avaliacao.nota)}</span> <button type="button" class="link-btn" data-acao="avaliar">Editar avaliação</button>`
            : `<button type="button" class="btn btn-contorno btn-sm" data-acao="avaliar"><i class="bi bi-star" aria-hidden="true"></i> Avaliar atendimento</button>`;
        }
        acoes += ` <a class="btn btn-fantasma btn-sm" href="agendar.html?servico=${a.servico.id}&barbeiro=${a.barbeiro.id}"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Agendar de novo</a>`;
        return GB.cartaoAgendamento(a, { acoes });
      }).join('')
      : '<p class="texto-suave">Seu histórico aparece aqui depois do primeiro atendimento.</p>';
  }

  function avaliar(ag) {
    let nota = ag.avaliacao ? ag.avaliacao.nota : 5;
    const m = GB.modal({
      titulo: 'Avaliar atendimento',
      conteudo: `
        <p class="texto-suave">${GB.esc(ag.servico.nome)} com ${GB.esc(ag.barbeiro.nome)} em ${GB.fmt.data(ag.inicio)}</p>
        <div class="seletor-estrelas" role="radiogroup" aria-label="Nota">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" data-nota="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}">★</button>`).join('')}
        </div>
        <div class="campo">
          <label for="av-comentario">Comentário (aparece no site)</label>
          <textarea id="av-comentario" class="entrada" maxlength="500" placeholder="Como foi?">${GB.esc(ag.avaliacao ? ag.avaliacao.comentario || '' : '')}</textarea>
        </div>
        <div class="modal-acoes">
          <button type="button" class="btn btn-fantasma" data-fechar>Voltar</button>
          <button type="button" class="btn btn-primario" id="av-enviar">Enviar avaliação</button>
        </div>`,
    });
    const pintar = () => GB.$$('.seletor-estrelas button', m.corpo).forEach((b) => {
      const n = Number(b.dataset.nota);
      b.classList.toggle('on', n <= nota);
      b.setAttribute('aria-checked', String(n === nota));
    });
    pintar();
    GB.$('.seletor-estrelas', m.corpo).addEventListener('click', (e) => {
      const b = e.target.closest('[data-nota]');
      if (b) { nota = Number(b.dataset.nota); pintar(); }
    });
    GB.$('#av-enviar', m.corpo).addEventListener('click', async (e) => {
      GB.carregando(e.currentTarget, true, 'Enviando…');
      try {
        await GB.api.avaliar(ag.id, nota, GB.$('#av-comentario', m.corpo).value);
        m.fechar();
        GB.toast('Obrigado pela avaliação!');
        carregar();
      } catch (err) {
        GB.toast(GB.erroAmigavel(err), 'erro');
        GB.carregando(e.currentTarget, false);
      }
    });
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const ag = lista.find((a) => a.id === Number(b.closest('[data-id]').dataset.id));
    if (!ag) return;
    if (b.dataset.acao === 'remarcar') GB.abrirRemarcar(ag, { onFeito: carregar });
    if (b.dataset.acao === 'avaliar') avaliar(ag);
    if (b.dataset.acao === 'cancelar') {
      const ok = await GB.confirmar('Cancelar horário?', `${ag.servico.nome} em ${GB.fmt.dataLonga(ag.inicio)} às ${GB.fmt.hora(ag.inicio)}.`, 'Sim, cancelar', true);
      if (!ok) return;
      try {
        await GB.api.cancelarAgendamento(ag.id);
        GB.toast('Horário cancelado.');
        carregar();
      } catch (err) { GB.toast(GB.erroAmigavel(err), 'erro'); }
    }
  });

  async function iniciar() {
    const s = await GB.exigirSessao();
    const p = s.perfil;
    GB.$('#ola').textContent = `Olá, ${String(p.nome).split(' ')[0]}!`;
    GB.$('#p-nome').value = p.nome || '';
    GB.$('#p-tel').value = GB.fmt.telefone(p.telefone);
    GB.$('#p-email').value = p.email || s.usuario.email;
    GB.mascaraTelefone(GB.$('#p-tel'));

    GB.$('#form-perfil').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = GB.$('#p-nome').value.trim();
      const tel = GB.$('#p-tel').value.replace(/\D/g, '');
      if (nome.length < 2) { GB.toast('Digite seu nome.', 'erro'); return; }
      if (tel && !/^\d{10,11}$/.test(tel)) { GB.toast('Telefone inválido. Use DDD + número.', 'erro'); return; }
      const btn = GB.$('button[type="submit"]', e.target);
      GB.carregando(btn, true, 'Salvando…');
      try {
        const np = await GB.api.atualizarPerfil({ nome, telefone: tel });
        GB.$('#ola').textContent = `Olá, ${np.nome.split(' ')[0]}!`;
        GB.toast('Dados atualizados.');
      } catch (err) { GB.toast(GB.erroAmigavel(err), 'erro'); }
      GB.carregando(btn, false);
    });
    carregar();
  }
  iniciar();
})();
