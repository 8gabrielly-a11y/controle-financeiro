/* What-if calculations only: no writes, storage, or changes to real receipts. */
(()=>{'use strict';
 const monthValid=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m||''),cents=n=>Math.round(Number(n)*100);
 function compare(data,scenarios,startMonth,count=6){
  const reference=(data.cashDate||data.today).slice(0,7),lastStart=FinanceOverview.monthAt(reference,114);
  if(!monthValid(startMonth)||startMonth<reference||startMonth>lastStart)throw Error('Escolha um mês entre a referência do saldo e os próximos 9 anos.');
  if(!Number.isInteger(count)||count<1||count>6)throw Error('Período inválido.');
  const last=FinanceOverview.monthAt(startMonth,count-1),virtual=[];
  for(const s of scenarios){
   if(!Number.isFinite(s.amount)||s.amount<=0||cents(s.amount)<1||s.amount>1e9||!monthValid(s.month)||s.month<reference||s.month>lastStart||!['once','monthly'].includes(s.repeat))throw Error('Informe valor positivo, mês válido e repetição para cada entrada.');
   // Each virtual occurrence is still pending, including in the balance-reference month.
   for(let month=s.month;month<=last;month=FinanceOverview.monthAt(month,1)){
    virtual.push({nome:'Entrada hipotética: '+(s.name||'Sem descrição'),valor_previsto:s.amount,dia_recebimento:'a_confirmar',recorrencia:'once',inicio:month,fim:month,ativa:'true',conta_id:''});
    if(s.repeat==='once')break;
   }
  }
  // Names must never trigger benefit filtering: hypothetical cash is always free cash.
  virtual.forEach(r=>r.nome=r.nome.replace(/flash/ig,'benefício em dinheiro'));
  const hypothetical={...data,receipts:[...(data.receipts||[]),...virtual]};
  return Array.from({length:count},(_,i)=>{
   const month=FinanceOverview.monthAt(startMonth,i),baseline=FinanceOverview.calculate(data,month),simulation=FinanceOverview.calculate(hypothetical,month);
   return {month,before:baseline.closing,after:simulation.closing,beforeMonthly:baseline.monthlyResult,afterMonthly:simulation.monthlyResult,improvement:baseline.closing===null||simulation.closing===null?null:(cents(simulation.closing)-cents(baseline.closing))/100,uncertain:baseline.selected.uncertain};
  });
 }
 if(typeof window!=='undefined')window.FinanceIncomeSimulation={compare};
 if(typeof module!=='undefined')module.exports={compare};
 if(typeof document==='undefined')return;
 const host=document.getElementById('incomeSimulation');if(!host)return;
 host.innerHTML=`<details class="overview-details" id="incomeSimulationPanel"><summary>Simular possíveis entradas</summary><p class="hint">Teste uma renda extra, bolsa ou outro recebimento. Esta simulação é temporária e não altera suas receitas nem a planilha.</p><p id="incomeSimulationLoading" role="status" class="hint">Aguardando seus dados…</p><form id="incomeSimulationForm" hidden><div id="incomeScenarioRows"></div><button class="button secondary" id="addIncomeScenario" type="button">Adicionar outra entrada</button><div class="actions"><button class="button" type="submit">Simular entradas</button><button class="button secondary" type="button" id="clearIncomeScenario">Limpar simulação</button></div><p id="incomeScenarioError" class="error" role="alert"></p></form><div id="incomeScenarioResult" aria-live="polite"></div></details>`;
 const $=id=>document.getElementById(id),money=n=>n===null?'Não informado':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n),monthName=m=>m.slice(5)+'/'+m.slice(0,4);let rowId=0,hasResult=false;
 function invalidate(){hasResult=false;$('incomeScenarioResult').replaceChildren();$('incomeScenarioError').textContent=''}
 function addRow(){
  const id=++rowId,box=document.createElement('fieldset');box.className='income-scenario';box.dataset.scenario=String(id);
  const ref=(window.financeProjectionData?.cashDate||window.financeProjectionData?.today||new Date().toISOString()).slice(0,7),month=window.financeMonth>=ref?window.financeMonth:ref;
  box.innerHTML=`<legend>Entrada hipotética</legend><label for="scenarioName${id}">Descrição (opcional)</label><input id="scenarioName${id}" data-field="name" maxlength="100" placeholder="Ex.: trabalho extra"><label for="scenarioAmount${id}">Valor possível (R$)</label><input id="scenarioAmount${id}" data-field="amount" type="number" min="0.01" max="1000000000" step="0.01" required><label for="scenarioMonth${id}">Mês previsto</label><input id="scenarioMonth${id}" data-field="month" type="month" required><label for="scenarioRepeat${id}">Repetição da entrada</label><select id="scenarioRepeat${id}" data-field="repeat"><option value="once">Uma vez</option><option value="monthly">Todo mês a partir desse mês</option></select><button type="button" class="button secondary" data-remove>Remover entrada</button>`;
  box.querySelector('[data-field="month"]').value=month;
  box.querySelector('[data-field="month"]').min=ref;box.querySelector('[data-field="month"]').max=FinanceOverview.monthAt(ref,114);
  box.querySelector('[data-remove]').onclick=()=>{box.remove();invalidate();if(!$('incomeScenarioRows').children.length)addRow()};
  box.addEventListener('input',invalidate);box.addEventListener('change',invalidate);$('incomeScenarioRows').append(box);invalidate();
 }
 function run(){
  const data=window.financeProjectionData;if(!data){$('incomeScenarioError').textContent='Aguarde o carregamento dos dados.';return}
  try{
   const scenarios=[...$('incomeScenarioRows').children].map(box=>({name:box.querySelector('[data-field="name"]').value.trim(),amount:Number(box.querySelector('[data-field="amount"]').value),month:box.querySelector('[data-field="month"]').value,repeat:box.querySelector('[data-field="repeat"]').value}));
   const first=scenarios.map(x=>x.month).sort()[0],rows=compare(data,scenarios,first),result=$('incomeScenarioResult');result.replaceChildren();$('incomeScenarioError').textContent='';
   const title=document.createElement('h3');title.textContent='Cenário hipotético · próximos 6 meses';result.append(title);
   const note=document.createElement('p');note.className='hint';note.textContent='Saldos acumulados, incluindo suas contas, faturas, parcelas e receitas já cadastradas. O painel principal continua com a previsão original.';result.append(note);
   const table=document.createElement('table');table.className='income-comparison';const head=document.createElement('thead'),hr=document.createElement('tr');for(const label of ['Mês','Sem a entrada','Com a entrada','Diferença']){const th=document.createElement('th');th.scope='col';th.textContent=label;hr.append(th)}head.append(hr);table.append(head);
   const body=document.createElement('tbody');for(const r of rows){const tr=document.createElement('tr');for(const v of [monthName(r.month),money(r.before),money(r.after),money(r.improvement)]){const td=document.createElement('td');td.textContent=v;tr.append(td)}if(r.after!==null&&r.after<0)tr.children[2].className='negative-text';body.append(tr)}table.append(body);result.append(table);
   if(rows[0].after===null){const p=document.createElement('p');p.className='hint';p.textContent='Informe seu saldo de partida para comparar o fechamento acumulado. A entrada hipotética não confirma dinheiro disponível.';result.append(p)}
   const caveat=document.createElement('p');caveat.className='hint';caveat.textContent='Valores hipotéticos não garantem recebimento. O mês pode fechar positivo e ainda faltar dinheiro antes de algum vencimento. Novos gastos e valores variáveis mudam a projeção.';result.append(caveat);hasResult=true;
  }catch(error){invalidate();$('incomeScenarioError').textContent=error.message}
 }
 $('addIncomeScenario').onclick=addRow;$('clearIncomeScenario').onclick=()=>{$('incomeScenarioRows').replaceChildren();addRow()};$('incomeSimulationForm').onsubmit=e=>{e.preventDefault();run()};
 function loaded(){if(!window.financeProjectionData)return;$('incomeSimulationLoading').hidden=true;$('incomeSimulationForm').hidden=false;if(!$('incomeScenarioRows').children.length)addRow();else if(hasResult)run()}
 window.addEventListener('finance:projection-ready',loaded);loaded();
})();
