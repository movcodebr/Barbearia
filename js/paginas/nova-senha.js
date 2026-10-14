/* Nova senha (link recebido por e-mail) */
(function () {
  'use strict';
  const GB = window.GB;
  GB.ligarVerSenha();

  // No Supabase o link chega com o erro no endereço quando expira
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get('error_description')) {
    GB.mensagem(`Link inválido ou expirado. <a href="senha.html">Peça um novo</a>.`);
  }

  GB.$('#form-nova').addEventListener('submit', async (e) => {
    e.preventDefault();
    const s1 = GB.$('#senha').value;
    const s2 = GB.$('#senha2').value;
    if (s1.length < 6) { GB.mensagem('A senha precisa ter pelo menos 6 caracteres.'); GB.$('#senha').focus(); return; }
    if (s1 !== s2) { GB.mensagem('As senhas não conferem.'); GB.$('#senha2').focus(); return; }
    const btn = GB.$('button[type="submit"]', e.target);
    GB.carregando(btn, true, 'Salvando…');
    try {
      await GB.api.redefinirSenha(s1);
      GB.mensagem('Senha alterada! Redirecionando…', 'sucesso');
      setTimeout(() => { location.href = 'minha-conta.html'; }, 1200);
    } catch (err) {
      GB.mensagem(GB.esc(GB.erroAmigavel(err)));
      GB.carregando(btn, false);
    }
  });
})();
