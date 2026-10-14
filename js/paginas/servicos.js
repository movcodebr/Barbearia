/* Página de serviços */
(function () {
  'use strict';
  const GB = window.GB;

  async function carregar() {
    const alvo = GB.$('#tabela-servicos');
    try {
      const lista = await GB.api.listarServicos();
      const grupos = [
        ['principal', 'Principais', 'Os serviços mais pedidos da casa.'],
        ['adicional', 'Adicionais', 'Para completar o visual — sozinhos ou junto com outro serviço.'],
      ];
      alvo.innerHTML = grupos.map(([cat, titulo, sub]) => {
        const itens = lista.filter((s) => s.categoria === cat);
        if (!itens.length) return '';
        return `
          <section class="grupo-servicos" aria-labelledby="g-${cat}">
            <header><h2 id="g-${cat}">${titulo}</h2><p class="texto-suave">${sub}</p></header>
            <ul class="lista-limpa">
              ${itens.map((s) => `
                <li class="linha-servico">
                  <div class="linha-servico-info">
                    <h3>${GB.esc(s.nome)}</h3>
                    <p class="texto-suave">${GB.esc(s.descricao || '')}</p>
                    <span class="texto-suave tempo"><i class="bi bi-clock" aria-hidden="true"></i> ${GB.fmt.duracao(s.duracao_min)}</span>
                  </div>
                  <span class="linha-pontos" aria-hidden="true"></span>
                  <div class="linha-servico-acao">
                    <span class="preco">${GB.fmt.moeda(s.preco)}</span>
                    <a class="btn btn-primario btn-sm" href="agendar.html?servico=${s.id}" aria-label="Agendar ${GB.esc(s.nome)}">Agendar</a>
                  </div>
                </li>`).join('')}
            </ul>
          </section>`;
      }).join('');
    } catch (e) {
      alvo.innerHTML = `<p class="alerta">${GB.esc(GB.erroAmigavel(e))}</p>`;
    }
  }
  carregar();
})();
