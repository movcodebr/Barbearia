/* Página inicial */
(function () {
  'use strict';
  const GB = window.GB;

  const ICONES = { Corte: 'bi-scissors', Barba: 'bi-droplet-half', Combo: 'bi-stars', Luzes: 'bi-brightness-high', Sobrancelha: 'bi-eye', Bigode: 'bi-emoji-sunglasses' };

  async function servicos() {
    const alvo = GB.$('#lista-servicos');
    try {
      const todos = await GB.api.listarServicos();
      const lista = [...todos.filter((s) => s.categoria === 'principal'), ...todos.filter((s) => s.categoria !== 'principal')].slice(0, 6);
      alvo.innerHTML = lista.map((s) => `
        <article class="card-servico">
          <i class="bi ${ICONES[s.nome] || 'bi-scissors'} card-servico-icone" aria-hidden="true"></i>
          <h3>${GB.esc(s.nome)}</h3>
          <p>${GB.esc(s.descricao || '')}</p>
          <div class="card-servico-rodape">
            <span class="preco">${GB.fmt.moeda(s.preco)}</span>
            <span class="texto-suave"><i class="bi bi-clock" aria-hidden="true"></i> ${GB.fmt.duracao(s.duracao_min)}</span>
          </div>
          <a class="btn btn-contorno btn-sm" href="agendar.html?servico=${s.id}" aria-label="Agendar ${GB.esc(s.nome)}">Agendar</a>
        </article>`).join('');
    } catch (e) {
      alvo.innerHTML = `<p class="alerta">${GB.esc(GB.erroAmigavel(e))}</p>`;
    }
  }

  async function equipe() {
    const alvo = GB.$('#lista-equipe');
    try {
      const bs = await GB.api.listarBarbeiros();
      alvo.innerHTML = bs.map((b) => `
        <article class="card-barbeiro">
          <div class="avatar" aria-hidden="true">${GB.esc(GB.fmt.iniciais(b.nome))}</div>
          <div>
            <h3>${GB.esc(b.nome)}</h3>
            <p class="texto-suave">${GB.esc(b.especialidade || '')}</p>
            <a href="agendar.html?barbeiro=${b.id}">Agendar com ${GB.esc(b.nome)} <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
          </div>
        </article>`).join('');
    } catch { alvo.innerHTML = ''; }
  }

  async function avaliacoes() {
    const alvo = GB.$('#lista-avaliacoes');
    try {
      const avs = await GB.api.avaliacoesPublicas(10);
      if (!avs.length) { alvo.closest('section').classList.add('oculto'); return; }
      alvo.innerHTML = avs.map((a) => `
        <figure class="card-avaliacao">
          <div class="estrelas" aria-label="${a.nota} de 5 estrelas">${GB.estrelas(a.nota)}</div>
          <blockquote>“${GB.esc(a.comentario)}”</blockquote>
          <figcaption><span class="avatar-mini">${GB.esc(GB.fmt.iniciais(a.nome))}</span> ${GB.esc(a.nome)}${a.servico ? ` <span class="texto-suave">· ${GB.esc(a.servico)}</span>` : ''}</figcaption>
        </figure>`).join('');
    } catch { alvo.closest('section').classList.add('oculto'); }
  }

  async function statusAberto() {
    const el = GB.$('#status-aberto');
    try {
      const hs = await GB.api.horariosFuncionamento();
      const p = GB.partes();
      const h = hs.find((x) => x.dia_semana === p.dow);
      const agora = GB.minutos(p.hora);
      if (h && h.abre && agora >= GB.minutos(h.abre) && agora < GB.minutos(h.fecha)) {
        el.innerHTML = `<span class="ponto-verde" aria-hidden="true"></span> Aberto agora · até ${h.fecha}`;
      } else {
        // próximo dia aberto
        for (let i = 0; i < 7; i++) {
          const data = GB.somarDias(p.data, i);
          const hh = hs.find((x) => x.dia_semana === GB.diaSemana(data));
          if (hh && hh.abre && (i > 0 || agora < GB.minutos(hh.abre))) {
            const quando = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : GB.fmt.diaCurto(data).semana;
            el.innerHTML = `<i class="bi bi-moon" aria-hidden="true"></i> Fechado · abre ${quando} às ${hh.abre}`;
            break;
          }
        }
      }
    } catch { /* mantém texto padrão */ }
  }

  servicos();
  equipe();
  avaliacoes();
  statusAberto();
})();
