/* =====================================================================
   CONFIGURAÇÃO DO BANCO DE DADOS
   ---------------------------------------------------------------------
   Deixe em branco para usar o MODO DEMONSTRAÇÃO (os dados ficam salvos
   só no navegador de quem está usando — ótimo para apresentar o projeto).

   Para usar o banco de verdade (Supabase):
     1. Crie um projeto grátis em https://supabase.com
     2. Rode os arquivos da pasta banco-de-dados/ no SQL Editor
     3. Em Project Settings → API copie a "Project URL" e a "anon public key"
     4. Cole abaixo. (A chave anon é pública por natureza; quem protege os
        dados são as regras de segurança do 01-schema.sql.)
   ===================================================================== */
window.GB_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',

  // Dados da barbearia usados nas páginas
  whatsapp: '5516987654321',
  telefone: '(16) 98765-4321',
  email: 'contato@greybarber.com.br',
  instagram: 'greybarber',
  endereco: 'Rua das Flores, 123 — Centro, Ribeirão Preto/SP',
};
