/* Login (clientes e funcionários) */
(function () {
  'use strict';
  const GB = window.GB;
  GB.ligarVerSenha();

  const voltar = GB.param('voltar');
  if (voltar) GB.$('#link-cadastro').href = `cadastro.html?voltar=${encodeURIComponent(voltar)}`;
  if (GB.param('confirmado')) GB.mensagem('E-mail confirmado! Agora é só entrar.', 'sucesso');
  if (voltar && /^agendar/.test(voltar)) GB.mensagem('Entre ou crie sua conta para garantir o seu horário.', 'info');

  if (GB.api.modo === 'demo') {
    const d = GB.$('#dica-demo');
    d.innerHTML = `<strong><i class="bi bi-database"></i> Modo demonstração</strong>
      <span>Funcionário: <button type="button" class="link-btn" data-e="admin@greybarber.com" data-s="admin123">admin@greybarber.com / admin123</button></span>
      <span>Cliente: <button type="button" class="link-btn" data-e="cliente@greybarber.com" data-s="cliente123">cliente@greybarber.com / cliente123</button></span>`;
    d.classList.remove('oculto');
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-e]');
      if (!b) return;
      GB.$('#email').value = b.dataset.e;
      GB.$('#senha').value = b.dataset.s;
      GB.$('#form-login').requestSubmit();
    });
  }

  // Já logado? segue direto
  GB.api.sessao().then((s) => {
    if (s) location.replace(GB.voltarPara(['admin', 'barbeiro'].includes(s.perfil.papel) ? 'funcionario.html' : 'minha-conta.html'));
  }).catch(() => {});

  GB.$('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = GB.$('#email').value;
    const senha = GB.$('#senha').value;
    if (!GB.emailValido(email)) { GB.mensagem('Digite um e-mail válido.'); GB.$('#email').focus(); return; }
    if (!senha) { GB.mensagem('Digite sua senha.'); GB.$('#senha').focus(); return; }
    const btn = e.submitter || GB.$('button[type="submit"]', e.target);
    GB.carregando(btn, true, 'Entrando…');
    GB.mensagem('');
    try {
      const perfil = await GB.api.entrar(email, senha);
      const func = perfil && ['admin', 'barbeiro'].includes(perfil.papel);
      location.href = GB.voltarPara(func ? 'funcionario.html' : 'minha-conta.html');
    } catch (err) {
      GB.mensagem(GB.esc(GB.erroAmigavel(err)));
      GB.carregando(btn, false);
    }
  });
})();
