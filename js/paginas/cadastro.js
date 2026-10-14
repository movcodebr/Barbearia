/* Cadastro de cliente */
(function () {
  'use strict';
  const GB = window.GB;
  GB.ligarVerSenha();
  GB.mascaraTelefone(GB.$('#telefone'));

  const voltar = GB.param('voltar');
  if (voltar) GB.$('#link-login').href = `login.html?voltar=${encodeURIComponent(voltar)}`;

  const campos = ['nome', 'email', 'telefone', 'senha', 'senha2'];
  const marcar = (id, msg) => {
    GB.$(`#${id}`).setAttribute('aria-invalid', msg ? 'true' : 'false');
    GB.$(`#erro-${id}`).textContent = msg || '';
  };

  function validar() {
    const v = Object.fromEntries(campos.map((c) => [c, GB.$(`#${c}`).value]));
    const erros = {
      nome: v.nome.trim().length < 2 ? 'Digite seu nome.' : '',
      email: !GB.emailValido(v.email) ? 'Digite um e-mail válido.' : '',
      telefone: !/^\d{10,11}$/.test(v.telefone.replace(/\D/g, '')) ? 'Digite o celular com DDD.' : '',
      senha: v.senha.length < 6 ? 'A senha precisa ter pelo menos 6 caracteres.' : '',
      senha2: v.senha2 !== v.senha ? 'As senhas não conferem.' : '',
    };
    campos.forEach((c) => marcar(c, erros[c]));
    const primeiro = campos.find((c) => erros[c]);
    if (primeiro) GB.$(`#${primeiro}`).focus();
    return primeiro ? null : v;
  }

  campos.forEach((c) => GB.$(`#${c}`).addEventListener('input', () => marcar(c, '')));

  GB.$('#form-cadastro').addEventListener('submit', async (e) => {
    e.preventDefault();
    GB.mensagem('');
    const v = validar();
    if (!v) return;
    const btn = GB.$('button[type="submit"]', e.target);
    GB.carregando(btn, true, 'Criando conta…');
    try {
      const r = await GB.api.cadastrar({ nome: v.nome, email: v.email, telefone: v.telefone, senha: v.senha });
      if (r.confirmarEmail) {
        e.target.reset();
        GB.mensagem(`Conta criada! Enviamos um link de confirmação para <strong>${GB.esc(v.email)}</strong>. Confirme e depois entre.`, 'sucesso');
        GB.carregando(btn, false);
        return;
      }
      location.href = GB.voltarPara('minha-conta.html');
    } catch (err) {
      GB.mensagem(GB.esc(GB.erroAmigavel(err)));
      GB.carregando(btn, false);
    }
  });
})();
