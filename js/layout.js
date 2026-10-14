/* Escolhe o banco, monta cabeçalho/rodapé e controla o menu — Grey Barber */
(function () {
  'use strict';
  const GB = window.GB;
  const C = window.GB_CONFIG || {};

  /* ---------- Qual banco usar ---------- */
  const temSupabase = !!(C.supabaseUrl && C.supabaseAnonKey);
  GB.api = temSupabase ? GB.BancoSupabase : GB.BancoDemo;

  /* Redireciona para o login se a página exige conta */
  GB.exigirSessao = async ({ funcionario = false } = {}) => {
    const s = await GB.api.sessao();
    if (!s) {
      location.replace(`login.html?voltar=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}`);
      return new Promise(() => {}); // interrompe a página
    }
    if (funcionario && !['admin', 'barbeiro'].includes(s.perfil.papel)) {
      location.replace('minha-conta.html');
      return new Promise(() => {});
    }
    return s;
  };

  GB.voltarPara = (padrao) => {
    const v = GB.param('voltar');
    // só aceita páginas locais (evita redirecionamento para outro site)
    return v && /^[\w-]+\.html(\?[^#]*)?$/.test(v) ? v : padrao;
  };

  const LINKS = [
    { id: 'inicio', href: 'index.html', texto: 'Início' },
    { id: 'servicos', href: 'servicos.html', texto: 'Serviços' },
    { id: 'agendar', href: 'agendar.html', texto: 'Agendar' },
    { id: 'contato', href: 'contato.html', texto: 'Contato' },
  ];

  function montarCabecalho(pagina) {
    const topo = GB.$('#topo');
    if (!topo) return;
    const links = LINKS.map((l) =>
      `<li><a href="${l.href}"${l.id === pagina ? ' class="ativo" aria-current="page"' : ''}>${l.texto}</a></li>`).join('');
    topo.outerHTML = `
      <a class="pular" href="#conteudo">Pular para o conteúdo</a>
      <header class="cabecalho">
        <div class="cabecalho-interno">
          <a href="index.html" class="marca" aria-label="Grey Barber — página inicial">
            <img src="img/logo-192.webp" alt="" width="44" height="48">
            <span>Grey Barber</span>
          </a>
          <nav class="nav" id="nav" aria-label="Principal">
            <ul>${links}</ul>
            <div class="nav-conta" id="nav-conta">
              <a href="login.html" class="btn btn-contorno btn-sm"><i class="bi bi-person-circle" aria-hidden="true"></i> Entrar</a>
            </div>
          </nav>
          <button class="btn-menu" id="btn-menu" aria-label="Abrir menu" aria-expanded="false" aria-controls="nav">
            <i class="bi bi-list" aria-hidden="true"></i>
          </button>
        </div>
      </header>`;

    const btn = GB.$('#btn-menu');
    const nav = GB.$('#nav');
    const alternar = (abrir) => {
      nav.classList.toggle('aberto', abrir);
      btn.setAttribute('aria-expanded', String(abrir));
      btn.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
      btn.innerHTML = `<i class="bi ${abrir ? 'bi-x-lg' : 'bi-list'}" aria-hidden="true"></i>`;
      document.body.classList.toggle('menu-aberto', abrir);
    };
    btn.addEventListener('click', () => alternar(!nav.classList.contains('aberto')));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) alternar(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('aberto')) { alternar(false); btn.focus(); } });
  }

  async function atualizarConta() {
    const alvo = GB.$('#nav-conta');
    if (!alvo) return;
    let s = null;
    try { s = await GB.api.sessao(); } catch { /* sem conexão: mantém "Entrar" */ }
    if (!s) return;
    const func = ['admin', 'barbeiro'].includes(s.perfil.papel);
    const primeiro = GB.esc(String(s.perfil.nome).split(' ')[0]);
    alvo.innerHTML = `
      <details class="menu-conta">
        <summary class="btn btn-contorno btn-sm"><span class="avatar-mini">${GB.esc(GB.fmt.iniciais(s.perfil.nome))}</span> ${primeiro} <i class="bi bi-chevron-down" aria-hidden="true"></i></summary>
        <div class="menu-conta-lista">
          ${func ? '<a href="funcionario.html"><i class="bi bi-speedometer2"></i> Painel</a>' : ''}
          <a href="minha-conta.html"><i class="bi bi-calendar-check"></i> Meus agendamentos</a>
          <button type="button" id="btn-sair"><i class="bi bi-box-arrow-right"></i> Sair</button>
        </div>
      </details>`;
    const det = GB.$('.menu-conta', alvo);
    document.addEventListener('click', (e) => { if (!det.contains(e.target)) det.removeAttribute('open'); });
    GB.$('#btn-sair', alvo).addEventListener('click', async () => {
      await GB.api.sair();
      location.href = 'index.html';
    });
  }

  function montarRodape() {
    const r = GB.$('#rodape');
    if (!r) return;
    const ano = new Date().getFullYear();
    r.outerHTML = `
      <footer class="rodape">
        <div class="rodape-grade container">
          <div>
            <a href="index.html" class="marca"><img src="img/logo-192.webp" alt="" width="40" height="44" loading="lazy"><span>Grey Barber</span></a>
            <p class="texto-suave">Tradição e estilo em cada detalhe.</p>
          </div>
          <div>
            <h2 class="rodape-titulo">Horário</h2>
            <ul class="lista-limpa texto-suave" id="rodape-horario">
              <li>Seg a Sex · 09:00 – 17:00</li><li>Sábado · 09:00 – 14:00</li><li>Domingo · Fechado</li>
            </ul>
          </div>
          <div>
            <h2 class="rodape-titulo">Contato</h2>
            <ul class="lista-limpa texto-suave">
              <li><i class="bi bi-geo-alt" aria-hidden="true"></i> ${GB.esc(C.endereco)}</li>
              <li><i class="bi bi-whatsapp" aria-hidden="true"></i> <a href="${GB.linkWhatsApp('Olá! Vim pelo site da Grey Barber.')}" target="_blank" rel="noopener">${GB.esc(C.telefone)}</a></li>
              <li><i class="bi bi-instagram" aria-hidden="true"></i> <a href="https://instagram.com/${GB.esc(C.instagram)}" target="_blank" rel="noopener">@${GB.esc(C.instagram)}</a></li>
            </ul>
          </div>
        </div>
        <div class="rodape-base container">
          <span>© ${ano} Grey Barber · Todos os direitos reservados</span>
          ${GB.api.modo === 'demo' ? '<button type="button" class="selo-demo" id="selo-demo" title="Os dados ficam salvos só neste navegador"><i class="bi bi-database"></i> Modo demonstração</button>' : ''}
        </div>
      </footer>`;

    const selo = GB.$('#selo-demo');
    if (selo) selo.addEventListener('click', () => {
      const m = GB.modal({
        titulo: 'Modo demonstração',
        conteudo: `
          <p class="texto-suave">O site está rodando sem banco de dados configurado, então tudo fica salvo apenas neste navegador.
          Para usar o banco real, preencha <code>js/config.js</code> com os dados do Supabase (veja o README).</p>
          <div class="caixa-info">
            <strong>Contas de teste</strong>
            <span>Funcionário: <code>admin@greybarber.com</code> / <code>admin123</code></span>
            <span>Cliente: <code>cliente@greybarber.com</code> / <code>cliente123</code></span>
          </div>
          <div class="modal-acoes">
            <button type="button" class="btn btn-fantasma" data-reset>Restaurar dados de exemplo</button>
            <button type="button" class="btn btn-primario" data-fechar>Entendi</button>
          </div>`,
      });
      GB.$('[data-reset]', m.corpo).addEventListener('click', async () => {
        await GB.api.resetarDemo();
        location.reload();
      });
    });
  }

  async function horarioRodape() {
    const ul = GB.$('#rodape-horario');
    if (!ul) return;
    try {
      const hs = await GB.api.horariosFuncionamento();
      GB.horarios = hs;
      const txt = (h) => (h && h.abre ? `${h.abre} – ${h.fecha}` : 'Fechado');
      const por = (d) => hs.find((h) => h.dia_semana === d);
      const semana = [1, 2, 3, 4, 5].map((d) => txt(por(d)));
      const linhas = semana.every((t) => t === semana[0])
        ? [`Seg a Sex · ${semana[0]}`]
        : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((n, i) => `${n} · ${semana[i]}`);
      linhas.push(`Sábado · ${txt(por(6))}`, `Domingo · ${txt(por(0))}`);
      ul.innerHTML = linhas.map((l) => `<li>${GB.esc(l)}</li>`).join('');
    } catch { /* mantém o texto padrão */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const pagina = document.body.dataset.pagina;
    montarCabecalho(pagina);
    montarRodape();
    atualizarConta();
    horarioRodape();
  });
})();
