/* Esqueci a senha */
(function () {
  'use strict';
  const GB = window.GB;

  GB.$('#form-senha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = GB.$('#email').value;
    if (!GB.emailValido(email)) { GB.mensagem('Digite um e-mail válido.'); GB.$('#email').focus(); return; }
    const btn = GB.$('button[type="submit"]', e.target);
    GB.carregando(btn, true, 'Enviando…');
    try {
      const r = await GB.api.recuperarSenha(email);
      if (r.demo) {
        GB.mensagem('Modo demonstração: nenhum e-mail é enviado. <a href="nova-senha.html">Clique aqui para criar a nova senha</a>.', 'info');
      } else {
        // Mensagem neutra: não revela se o e-mail existe
        GB.mensagem(`Se <strong>${GB.esc(email)}</strong> estiver cadastrado, você vai receber um link em instantes. Confira também o spam.`, 'sucesso');
      }
    } catch (err) {
      GB.mensagem(GB.esc(GB.erroAmigavel(err)));
    }
    GB.carregando(btn, false);
  });
})();
