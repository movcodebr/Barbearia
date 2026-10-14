/* Página de contato */
(function () {
  'use strict';
  const GB = window.GB;
  const C = window.GB_CONFIG;

  const setar = (id, href, txt) => { GB.$(`#${id}`).href = href; GB.$(`#${id}-txt`).textContent = txt; };
  setar('c-whats', GB.linkWhatsApp('Olá! Vim pelo site da Grey Barber.'), C.telefone);
  setar('c-tel', `tel:+${C.whatsapp}`, C.telefone);
  setar('c-email', `mailto:${C.email}`, C.email);
  setar('c-insta', `https://instagram.com/${C.instagram}`, `@${C.instagram}`);

  const NOMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  (async () => {
    const ul = GB.$('#tabela-horario');
    try {
      const hs = await GB.api.horariosFuncionamento();
      const hoje = GB.partes().dow;
      ul.innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => {
        const h = hs.find((x) => x.dia_semana === d);
        return `<li${d === hoje ? ' class="hoje"' : ''}><span>${NOMES[d]}${d === hoje ? ' <small>(hoje)</small>' : ''}</span><strong>${h && h.abre ? `${h.abre} – ${h.fecha}` : 'Fechado'}</strong></li>`;
      }).join('');
    } catch (e) {
      ul.innerHTML = `<li>${GB.esc(GB.erroAmigavel(e))}</li>`;
    }
  })();

  GB.$('#form-whats').addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = GB.$('#w-nome').value.trim();
    const msg = GB.$('#w-msg').value.trim();
    if (!nome || !msg) { GB.toast('Preencha seu nome e a mensagem.', 'erro'); (nome ? GB.$('#w-msg') : GB.$('#w-nome')).focus(); return; }
    window.open(GB.linkWhatsApp(`Olá! Sou ${nome}. ${msg}`), '_blank', 'noopener');
  });
})();
