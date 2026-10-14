# Grey Barber — site + banco de dados

Site da barbearia com **agendamento online de verdade**: cadastro/login, horários livres por barbeiro, "Meus agendamentos" (remarcar, cancelar, avaliar) e painel do funcionário com agenda, clientes, receita e preços.

## Como funciona

O site é estático (HTML + CSS + JavaScript), então pode ser publicado no **GitHub Pages**. Ele tem dois modos:

| Modo | Quando | Onde ficam os dados |
|---|---|---|
| **Demonstração** | `js/config.js` em branco (padrão) | No navegador de quem usa (localStorage) |
| **Banco real** | `js/config.js` com URL e chave do Supabase | PostgreSQL no Supabase |

### Contas do modo demonstração
- Funcionário: `admin@greybarber.com` / `admin123`
- Cliente: `cliente@greybarber.com` / `cliente123`

O selo "Modo demonstração" no rodapé tem um botão para restaurar os dados de exemplo.

## Ativar o banco de dados (Supabase, grátis)

1. Crie um projeto em <https://supabase.com>.
2. Abra **SQL Editor → New query**, cole o conteúdo de `banco-de-dados/01-schema.sql` e clique **Run**.
3. Faça o mesmo com `banco-de-dados/02-dados-iniciais.sql` (serviços, barbeiros e horário de funcionamento).
4. Em **Project Settings → API**, copie a *Project URL* e a *anon public key* para `js/config.js`.
5. Em **Authentication → URL Configuration**, coloque o endereço do site (ex.: `https://seuusuario.github.io/Barbearia/`) em *Site URL* e em *Redirect URLs*. Isso faz os links de confirmação de e-mail e de "esqueci a senha" funcionarem.
6. Crie sua conta pelo site e torne-se administrador no SQL Editor:
   ```sql
   update public.perfis set papel = 'admin' where email = 'seu@email.com';
   ```

Os dois arquivos SQL podem ser rodados de novo sem duplicar nada.

## O banco de dados

| Tabela | Para quê |
|---|---|
| `perfis` | Dados de cada usuário (nome, telefone, papel: cliente / barbeiro / admin). Criado automaticamente no cadastro |
| `barbeiros` | Profissionais que atendem |
| `servicos` | Catálogo com preço e duração |
| `horarios_funcionamento` | Expediente de cada dia da semana |
| `agendamentos` | Os horários marcados |
| `avaliacoes` | Nota e comentário de atendimentos concluídos |

**Regras garantidas pelo próprio banco** (ninguém consegue burlar pelo navegador):
- Dois agendamentos no mesmo horário com o mesmo barbeiro são impossíveis (restrição `exclude using gist`).
- Preço e duração vêm do banco, então o cliente não consegue mudar o valor.
- Só dá para agendar dentro do expediente, no futuro e com até 60 dias de antecedência. Cada cliente pode ter no máximo 3 horários futuros.
- O cliente cancela ou remarca até 1h antes; depois disso, só o funcionário.
- Cliente vê só os próprios dados; funcionário vê tudo; só admin altera serviços e preços (Row Level Security).
- Telefone e e-mail não se repetem entre contas.
- "Sem preferência" escolhe automaticamente o barbeiro livre com menos atendimentos no dia.

Funções disponíveis: `horarios_disponiveis`, `criar_agendamento`, `remarcar_agendamento`, `cancelar_agendamento`, `concluir_agendamento`, `avaliar_atendimento`, `avaliacoes_publicas`, `telefone_disponivel`.

## Estrutura

```
index.html          Início (serviços, equipe e avaliações vêm do banco)
servicos.html       Tabela de preços
agendar.html        Agendamento em 4 passos
contato.html        Endereço, horário, canais, mapa, mensagem via WhatsApp
login.html / cadastro.html / senha.html / nova-senha.html
minha-conta.html    Agendamentos do cliente (remarcar, cancelar, avaliar)
funcionario.html    Painel: agenda do dia, próximos 7 dias, clientes, serviços
agendamento.html    Página antiga, agora redireciona para agendar.html
estilizacoes/       base.css (comum a todas) + paginas.css
js/config.js        ← configure aqui o Supabase e os contatos
js/util.js          Datas (fuso de São Paulo), formatação, modais, toasts
js/banco-demo.js    Modo demonstração (mesmas regras do banco)
js/banco-supabase.js Conexão com o banco real
js/layout.js        Cabeçalho, rodapé e menu (um lugar só para todas as páginas)
js/remarcar.js      Janela de remarcação e cartão de agendamento
js/paginas/         Script de cada página
banco-de-dados/     SQL do banco
img/                Imagens otimizadas em WebP
```

## Para testar localmente
Abra a pasta no VS Code e use a extensão **Live Server**, ou rode `python -m http.server` e acesse `http://localhost:8000`.
