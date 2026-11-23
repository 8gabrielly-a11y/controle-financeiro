# Controle financeiro: GitHub + Google Sheets

Esta é a migração da versão de novembro de 2026. Este repositório contém somente a versão revisada em controle/. O repositório antigo continua privado.

## O que muda

- O GitHub guarda e publica a interface estática.
- A planilha original é a base principal: toda leitura busca os dados nela e toda gravação exige confirmação do Google Sheets.
- O acesso usa sua conta Google. A página de entrada leva à implantação privada do Apps Script, que incorpora a interface do GitHub e verifica a proprietária em toda operação.
- Não existe API_TOKEN no navegador, senha no repositório nem cópia dos dados financeiros no GitHub.
- São preservados faturas detalhadas, parcelas, recorrências, pagamentos, saldo de referência, Flash separado e projeções.

## Instalação

1. Em Settings > Pages, selecione GitHub Actions. Este repositório público contém apenas código; a planilha permanece privada.
2. Em Actions, execute **Publicar controle financeiro**, escolhendo a branch que contém esta versão. O workflow publica apenas a nova interface, não o index.html antigo.
3. No Apps Script **vinculado à planilha financeira original**, substitua o código pelo conteúdo de `apps-script/Instalacao.gs.txt` (arquivo único gerado). Não carregue simultaneamente esse arquivo e os arquivos .gs separados, pois são duas representações do mesmo código.
4. Execute `configurarControle`. A função registra a conta executora como proprietária e confere as abas existentes. Ela não cria uma base vazia nem apaga dados.
5. Crie uma **nova implantação** do tipo app da Web: executar como **usuário que acessa o app**; acesso **somente você**. Não altere a implantação antiga usada pelo Site enquanto a migração estiver em validação. Se o Google solicitar autorização, confira os acessos à planilha atual e à identificação da sua conta.
6. Copie o endereço `/exec` da nova implantação para `googleWebAppUrl` em `controle/config.js`. Essa URL não é uma chave. Faça commit e execute novamente o workflow de publicação.
7. Abra a página publicada > **Entrar com Google**. A interface abrirá dentro da sessão autenticada do Apps Script. Mantenha essa página como o endereço de uso; abrir `app/index.html` diretamente não concede acesso aos dados.

## Conferência antes da troca definitiva

Confirme no app conectado à planilha, sem cadastrar novamente dados existentes:

- Saldo disponível e sua data de referência; duas parcelas do 13º nos meses corretos.
- Aluguel de novembro pendente; empréstimos de novembro quitados.
- Totais das três faturas de dezembro iguais aos do sistema anterior.
- Descomplica, Vivo e ChatGPT mensais, com os metadados de recorrência preservados na coluna observacao.
- Previsões de novembro e dezembro iguais às da versão anterior antes de novos gastos.

Não há arquivo de dados/seed no repositório. Se algum valor não aparecer, confira a planilha e a sincronização do sistema anterior antes de fazer a troca. Não inicialize lançamentos em uma planilha nova.

Depois de conferir: nas propriedades do script, defina `SHEETS_PRIMARY=true`. Isso bloqueia novas gravações do endpoint legado, evitando que uma cópia antiga do Site sobrescreva alterações feitas diretamente na planilha. Essa propriedade não é ativada automaticamente. Após a troca, use somente a nova versão para registrar alterações.

## Desenvolvimento e testes

Execute `node controle/tests/sheets.test.cjs`. Os testes usam dados fictícios em memória e verificam acesso restrito, CRUD, alterações diretas na planilha, base financeira, empréstimos quitados e importação idempotente. Não substituem a validação final no Google e no GitHub Pages.

O Apps Script usa um bloqueio por operação; gravações em várias abas não são uma transação única do Google Sheets. Se houver interrupção, confira a planilha e tente novamente: IDs estáveis e metadados da fatura evitam duplicação na importação. Não existe gravação local com mensagem falsa de sucesso.

## Arquivos

- `index.html`, `config.js`: página de entrada e URL pública da implantação.
- `app/`: interface, cálculos e cliente da conexão autenticada.
- `apps-script/`: backend da planilha, validação da conta e ponte com a interface.
- `tests/`: testes sem dados pessoais.
- `../.github/workflows/finance-pages.yml`: publicação manual.

Referências técnicas: https://developers.google.com/apps-script/guides/web e https://developers.google.com/apps-script/guides/html/communication.
