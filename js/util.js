/* Utilitários compartilhados — Grey Barber */
(function () {
  'use strict';
  const GB = (window.GB = window.GB || {});
  const FUSO = 'America/Sao_Paulo';
  const OFFSET = '-03:00'; // Brasil sem horário de verão desde 2019

  /* ---------- DOM ---------- */
  GB.$ = (sel, el = document) => el.querySelector(sel);
  GB.$$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  GB.esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  GB.param = (nome) => new URLSearchParams(location.search).get(nome);

  /* ---------- Armazenamento seguro (pode falhar em aba anônima) ---------- */
  const memoria = {};
  GB.store = {
    get(k) {
      try { const v = localStorage.getItem(k); return v == null ? (memoria[k] ?? null) : v; } catch { return memoria[k] ?? null; }
    },
    set(k, v) { memoria[k] = v; try { localStorage.setItem(k, v); } catch { /* ignora */ } },
    del(k) { delete memoria[k]; try { localStorage.removeItem(k); } catch { /* ignora */ } },
  };
  GB.sessionStore = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignora */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch { /* ignora */ } },
  };

  /* ---------- Datas (sempre no fuso de São Paulo) ---------- */
  const partesFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  });
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  GB.partes = (d = new Date()) => {
    const p = Object.fromEntries(partesFmt.formatToParts(new Date(d)).map((x) => [x.type, x.value]));
    return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}`, dow: DOW[p.weekday] };
  };
  GB.hoje = () => GB.partes().data;
  GB.iso = (data, hora) => `${data}T${hora}:00${OFFSET}`;
  GB.somarDias = (data, n) => {
    const d = new Date(`${data}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  GB.diaSemana = (data) => new Date(`${data}T12:00:00Z`).getUTCDay();
  GB.minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  GB.hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

  GB.fmt = {
    moeda: (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    hora: (iso) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }),
    data: (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' }),
    dataLonga: (isoOuData) => {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(isoOuData) ? new Date(`${isoOuData}T12:00:00${OFFSET}`) : new Date(isoOuData);
      const s = d.toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long' });
      return s.charAt(0).toUpperCase() + s.slice(1);
    },
    diaCurto: (data) => {
      const d = new Date(`${data}T12:00:00${OFFSET}`);
      return {
        semana: d.toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'short' }).replace('.', ''),
        dia: d.toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit' }),
        mes: d.toLocaleDateString('pt-BR', { timeZone: FUSO, month: 'short' }).replace('.', ''),
      };
    },
    telefone: (t) => {
      const d = String(t || '').replace(/\D/g, '');
      if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
      if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return t || '';
    },
    duracao: (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`),
    iniciais: (nome) => String(nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase(),
  };

  /* Máscara de telefone em inputs */
  GB.mascaraTelefone = (input) => {
    input.addEventListener('input', () => {
      const d = input.value.replace(/\D/g, '').slice(0, 11);
      let v = d;
      if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, d.length === 11 ? 7 : 6)}-${d.slice(d.length === 11 ? 7 : 6)}`;
      input.value = v;
    });
  };

  /* ---------- Cálculo de horários livres (usado pelo modo demonstração) ---------- */
  GB.calcularHorarios = ({ servico, data, horario, barbeiros, agendamentos, barbeiroId = null, ignorarId = null, agora = new Date(), passo = 30 }) => {
    if (!servico || !horario || !horario.abre) return [];
    const abre = GB.minutos(horario.abre);
    const fecha = GB.minutos(horario.fecha);
    const ativos = barbeiros.filter((b) => b.ativo && (barbeiroId == null || b.id === barbeiroId));
    const livres = [];
    for (let m = abre; m + servico.duracao_min <= fecha; m += passo) {
      const ini = new Date(GB.iso(data, GB.hhmm(m)));
      const fim = new Date(ini.getTime() + servico.duracao_min * 60000);
      if (ini <= agora) continue;
      const algumLivre = ativos.some((b) =>
        !agendamentos.some((a) =>
          a.barbeiro_id === b.id && a.status !== 'cancelado' && a.id !== ignorarId &&
          new Date(a.inicio) < fim && new Date(a.fim) > ini));
      if (algumLivre) livres.push(GB.hhmm(m));
    }
    return livres;
  };

  /* ---------- Mensagens de erro em português ---------- */
  GB.erroAmigavel = (err) => {
    const msg = (err && (err.message || err.error_description || err.msg)) || String(err || '');
    const mapa = [
      [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
      [/email not confirmed/i, 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada e o spam).'],
      [/user already registered|already been registered/i, 'Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.'],
      [/password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres.'],
      [/rate limit|too many requests/i, 'Muitas tentativas. Aguarde um minuto e tente de novo.'],
      [/failed to fetch|networkerror|load failed/i, 'Sem conexão com o servidor. Verifique sua internet.'],
      [/perfis_telefone_unico/i, 'Este telefone já está cadastrado.'],
      [/database error saving new user/i, 'Não foi possível criar a conta. Este telefone pode já estar cadastrado.'],
      [/same.*password|different from the old/i, 'A nova senha precisa ser diferente da anterior.'],
      [/jwt|session.*(missing|expired)|auth session missing/i, 'Sua sessão expirou. Entre novamente.'],
    ];
    for (const [re, txt] of mapa) if (re.test(msg)) return txt;
    return msg || 'Algo deu errado. Tente novamente.';
  };

  /* ---------- Toasts ---------- */
  GB.toast = (msg, tipo = 'ok') => {
    let box = GB.$('#toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    const icone = { ok: 'bi-check-circle-fill', erro: 'bi-exclamation-octagon-fill', info: 'bi-info-circle-fill' }[tipo] || 'bi-info-circle-fill';
    t.innerHTML = `<i class="bi ${icone}" aria-hidden="true"></i><span>${GB.esc(msg)}</span>`;
    box.appendChild(t);
    setTimeout(() => t.classList.add('saindo'), 4200);
    setTimeout(() => t.remove(), 4600);
  };

  /* ---------- Modal simples e acessível ---------- */
  GB.modal = ({ titulo, conteudo, onAbrir }) => {
    const anterior = document.activeElement;
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <div class="modal-topo">
          <h2 id="modal-titulo">${GB.esc(titulo)}</h2>
          <button type="button" class="btn-icone" data-fechar aria-label="Fechar"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="modal-corpo"></div>
      </div>`;
    const corpo = GB.$('.modal-corpo', fundo);
    if (typeof conteudo === 'string') corpo.innerHTML = conteudo; else corpo.appendChild(conteudo);
    const fechar = () => { fundo.remove(); document.removeEventListener('keydown', esc); document.body.classList.remove('sem-rolagem'); anterior && anterior.focus && anterior.focus(); };
    const esc = (e) => { if (e.key === 'Escape') fechar(); };
    fundo.addEventListener('click', (e) => { if (e.target === fundo || e.target.closest('[data-fechar]')) fechar(); });
    document.addEventListener('keydown', esc);
    document.body.appendChild(fundo);
    document.body.classList.add('sem-rolagem');
    const foco = GB.$('input, select, textarea, button:not([data-fechar])', corpo) || GB.$('[data-fechar]', fundo);
    foco && foco.focus();
    onAbrir && onAbrir(corpo, fechar);
    return { fechar, corpo };
  };

  GB.confirmar = (titulo, texto, rotuloOk = 'Confirmar', perigo = false) =>
    new Promise((resolve) => {
      let ok = false;
      const m = GB.modal({
        titulo,
        conteudo: `<p class="texto-suave">${GB.esc(texto)}</p>
          <div class="modal-acoes">
            <button type="button" class="btn btn-fantasma" data-fechar>Voltar</button>
            <button type="button" class="btn ${perigo ? 'btn-perigo' : 'btn-primario'}" data-ok>${GB.esc(rotuloOk)}</button>
          </div>`,
      });
      GB.$('[data-ok]', m.corpo).addEventListener('click', () => { ok = true; m.fechar(); });
      const obs = new MutationObserver(() => { if (!document.body.contains(m.corpo)) { obs.disconnect(); resolve(ok); } });
      obs.observe(document.body, { childList: true });
    });

  /* ---------- Botão com estado de carregando ---------- */
  GB.carregando = (btn, ativo, texto) => {
    if (!btn) return;
    if (ativo) {
      btn.dataset.textoOriginal = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${GB.esc(texto || 'Aguarde…')}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.textoOriginal) btn.innerHTML = btn.dataset.textoOriginal;
    }
  };

  /* ---------- Links úteis ---------- */
  GB.linkWhatsApp = (texto) => `https://wa.me/${(window.GB_CONFIG || {}).whatsapp}?text=${encodeURIComponent(texto || '')}`;
  GB.linkGoogleAgenda = (ag) => {
    const f = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const p = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${ag.servico.nome} — Grey Barber`,
      dates: `${f(ag.inicio)}/${f(ag.fim)}`,
      details: `Profissional: ${ag.barbeiro.nome}`,
      location: (window.GB_CONFIG || {}).endereco || '',
    });
    return `https://calendar.google.com/calendar/render?${p}`;
  };

  /* Botão "mostrar senha" e mensagens dos formulários de conta */
  GB.ligarVerSenha = () => {
    GB.$$('.ver-senha').forEach((b) => b.addEventListener('click', () => {
      const input = b.parentElement.querySelector('input');
      const mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';
      b.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
      b.innerHTML = `<i class="bi ${mostrar ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
    }));
  };
  GB.mensagem = (texto, tipo = 'erro') => {
    const m = GB.$('#msg');
    if (!m) return;
    if (!texto) { m.className = 'oculto'; m.innerHTML = ''; return; }
    const icone = tipo === 'sucesso' ? 'bi-check-circle' : tipo === 'info' ? 'bi-info-circle' : 'bi-exclamation-triangle';
    m.className = `alerta ${tipo === 'erro' ? '' : tipo}`;
    m.innerHTML = `<i class="bi ${icone}" aria-hidden="true"></i><span>${texto}</span>`;
  };
  GB.emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e).trim());

  GB.estrelas = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
})();
