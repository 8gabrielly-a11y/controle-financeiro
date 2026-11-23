/* Monthly cash projection. Amounts are rounded in cents, and benefits stay separate. */
const FinanceOverview=(()=>{
  const cents=n=>Math.round((Number(n)||0)*100),cash=n=>Math.round(n)/100;
  const monthNumber=m=>Number(m.slice(0,4))*12+Number(m.slice(5))-1;
  const monthAt=(month,n)=>{const k=monthNumber(month)+n;return Math.floor(k/12)+'-'+String(k%12+1).padStart(2,'0')};
  const active=x=>x.ativa!==false&&x.ativa!=='false';
  function eligible(x,month){return active(x)&&(!x.inicio||String(x.inicio).slice(0,7)<=month)&&(!x.fim||month<=String(x.fim).slice(0,7))&&(String(x.recorrencia).startsWith('monthly')||String(x.inicio).slice(0,7)===month)}
  const dueAt=(month,day)=>Number.isInteger(Number(day))&&Number(day)>=1&&Number(day)<=31?Statement.dueAt(month,Number(day)):'';
  function invoiceRows(data,month){
    return data.cards.map(card=>{const records=data.records.filter(r=>r.value!==null&&r.payment==='Cartão de crédito'&&r.card?.toLowerCase()===card.name.toLowerCase());const entries=[];
      for(const r of records){try{const imported=Statement.schedule(r,card,data.records,month);const schedule=imported||Billing.schedule({amount:r.value,purchaseDate:r.date,installments:r.installments,closingDay:card.close,dueDay:card.due});entries.push(...schedule.filter(x=>x.dueDate.slice(0,7)===month))}catch{}}
      const invoiceAmount=cash(entries.reduce((n,e)=>n+cents(e.amount),0));return {id:'cartao:'+card.id+':'+month,name:'Fatura '+card.name,kind:'cartao',amount:Math.max(0,invoiceAmount),credit:Math.min(0,invoiceAmount),date:entries[0]?.dueDate||dueAt(month,card.due),estimated:entries.some(x=>x.projected),hasEntries:entries.length>0};
    }).filter(x=>x.hasEntries);
  }
  function period(data,month){
    const referenceDate=data.cashDate||data.today,referenceMonth=referenceDate.slice(0,7),remaining=month===referenceMonth,issues=[];
    const receipts=(data.receipts||[]).filter(x=>eligible(x,month)&&x.conta_id!=='beneficio:flash'&&!/flash/i.test(x.nome));
    const futureReceipts=receipts.filter(x=>{if(!remaining)return true;if(x.recorrencia==='once'&&x.dia_recebimento==='a_confirmar')return true;const day=Number(x.dia_recebimento);return Number.isInteger(day)&&day>=1&&day<=31&&dueAt(month,day)>referenceDate});
    // The reference balance already contains prior receipts; do not add a full salary twice.
    if(futureReceipts.some(x=>x.dia_recebimento==='a_confirmar'))issues.push('Há entradas previstas com data a confirmar. Elas entram no total do mês, mas podem chegar depois dos vencimentos.');
    const income=cash(futureReceipts.reduce((n,r)=>n+cents(r.valor_previsto),0));
    const paid=(key)=>data.payments.find(p=>p.conta_a_pagar_id===key&&String(p.data_vencimento).slice(0,7)===month&&p.status==='pago');
    const allBills=data.bills.filter(b=>(!b.month||b.month<=month)&&(!b.end||month<=b.end)&&(String(b.repeat).startsWith('monthly')||b.month===month));
    const dueRows=[...allBills.map(b=>({id:b.id,name:b.name,kind:'conta',amount:b.amount,date:dueAt(month,b.day),estimated:b.repeat==='monthly_variable'})),...invoiceRows(data,month)].map(row=>{
      const payment=paid(row.id);const actual=payment&&Number.isFinite(Number(payment.valor_pago))?Number(payment.valor_pago):row.amount;
      const included=!remaining||!payment||Boolean(payment.pago_em&&payment.pago_em>referenceDate);
      return {...row,payment,amount:actual,included,excludedReason:included?'':'Já pago e refletido no dinheiro informado'};
    });
    const included=dueRows.filter(x=>x.included),bills=cash(included.filter(x=>x.kind==='conta').reduce((n,x)=>n+cents(x.amount),0)),cards=cash(included.filter(x=>x.kind==='cartao').reduce((n,x)=>n+cents(x.amount),0));
    const cashRecords=data.records.filter(r=>r.month===month&&(r.payment==='Conta'||r.payment==='Dinheiro')&&(!remaining||r.date&&r.date>=referenceDate));
    const direct=cash(cashRecords.filter(x=>x.value!==null).reduce((n,r)=>n+cents(r.value),0));
    const contributions=(data.contributions||[]).filter(r=>r.data?.slice(0,7)===month&&(!remaining||r.data>=referenceDate));
    const goals=cash(contributions.reduce((n,r)=>n+(r.tipo==='retirada'?-1:1)*cents(r.valor),0));
    const outflow=cash(cents(bills)+cents(cards)+cents(direct)+cents(goals)),delta=cash(cents(income)-cents(outflow));
    const unknown=data.records.filter(r=>(r.month===month||!r.month)&&(r.value===null||!Number.isFinite(Number(r.value))||!r.payment||r.payment==='Cartão de crédito'&&(!r.card||!r.installments||!r.date&&!r.importData||!data.cards.some(c=>c.name.toLowerCase()===r.card.toLowerCase()))));
    if(unknown.length)issues.push(unknown.length+' lançamento(s) podem alterar os valores por falta de valor, pagamento ou cartão.');
    if(included.some(x=>!x.date))issues.push('Há compromissos sem vencimento informado. Os valores já estão reservados.');
    const unconfirmed=allBills.filter(b=>data.payments.some(p=>p.conta_a_pagar_id===b.id&&String(p.data_vencimento).slice(0,7)===month&&p.status==='a_confirmar'));
    if(unconfirmed.length)issues.push('Há pagamento(s) do mês a confirmar; foram considerados como compromisso.');
    if(!receipts.length&&!remaining)issues.push('Renda deste mês ainda não cadastrada.');
    const benefit=(data.receipts||[]).filter(x=>eligible(x,month)&&(x.conta_id==='beneficio:flash'||/flash/i.test(x.nome)));
    const flash=cash(benefit.reduce((n,r)=>n+cents(r.valor_previsto),0));
    return {month,remaining,referenceDate,income,bills,cards,direct,goals,outflow,delta,dueRows,receipts:futureReceipts,flash,issues,uncertain:unknown.length>0||!remaining&&!receipts.length};
  }
  function calculate(data,selectedMonth){
    const referenceDate=data.cashDate||data.today,referenceMonth=referenceDate.slice(0,7),selected=period(data,selectedMonth);let running=data.cashKnown?cents(data.cash):null;const distance=monthNumber(selectedMonth)-monthNumber(referenceMonth),count=Math.max(6,Math.min(120,distance)),timeline=[];
    for(let i=0;i<=count;i++){const p=period(data,monthAt(referenceMonth,i));if(running!==null)running+=cents(p.delta);const entry={...p,closing:running===null?null:cash(running)};timeline.push(entry)}
    const selectedEntry=timeline.find(x=>x.month===selectedMonth);const closing=selectedEntry?.closing??null;
    return {selected,closing,monthlyResult:selected.delta,opening:selected.remaining&&data.cashKnown?data.cash:null,referenceDate,referenceMonth,timeline:timeline.slice(0,7),cashKnown:data.cashKnown,carryIn:selected.remaining?(data.cashKnown?data.cash:null):selectedEntry&&closing!==null?cash(cents(closing)-cents(selected.delta)):null};
  }
  return {calculate,period,invoiceRows,monthAt};
})();
if(typeof window!=='undefined')window.FinanceOverview=FinanceOverview;
