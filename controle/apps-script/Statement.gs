/* CSV statement values are charges for this invoice, never purchase totals. */
const Statement = (() => {
  const prefix='FATURA_CSV_V1:';
  function parseCSV(text,{manual=false}={}){
    const rows=[];let row=[],cell='',quoted=false;
    text=String(text).replace(/^\uFEFF/,'');
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}
    if(quoted)throw Error('O CSV contém aspas sem fechamento.');
    row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
    const header=rows.shift()?.map(x=>x.trim().toLowerCase());
    if(!header||!['date','title','amount'].every(x=>header.includes(x)))throw Error('Use o CSV Nubank com as colunas date, title e amount.');
    if(!rows.length||rows.length>500)throw Error('Importe de 1 a 500 registros por arquivo.');
    const occurrences=new Map();
    return rows.map((cells,index)=>{
      if(cells.length!==header.length)throw Error('Número de colunas inválido na linha '+(index+2));
      const date=cells[header.indexOf('date')].trim(),title=cells[header.indexOf('title')].trim(),raw=cells[header.indexOf('amount')].trim();
      const clean=raw.replace(/\s/g,'');const decimal=clean.includes(',')?clean.replace(/\./g,'').replace(',','.'):clean;
      if(!/^-?\d+(\.\d{1,2})?$/.test(decimal))throw Error('Valor inválido na linha '+(index+2));
      const amount=Math.round(Number(decimal)*100)/100;
      if(!title||(!(manual&&!date)&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)))throw Error('Data ou descrição inválida na linha '+(index+2));
      const match=title.match(/\s*-\s*Parcela\s+(\d+)\/(\d+)\s*$/i),current=match?Number(match[1]):1,total=match?Number(match[2]):1;
      if(current<1||total<current||total>600)throw Error('Parcela inválida na linha '+(index+2));
      const type=/^Pagamento recebido/i.test(title)?'pagamento':/^Valor pendente do m[eê]s anterior/i.test(title)?'saldo_anterior':/^(Juros|Multa|IOF)\b/i.test(title)?'encargo':amount<0?'estorno':'compra';
      const base=title.replace(/\s*-\s*Parcela\s+\d+\/\d+\s*$/i,'').trim();
      const purchaseBase=[date,base.toLowerCase(),total,amount].join('|');const occurrence=(occurrences.get(purchaseBase)||0)+1;occurrences.set(purchaseBase,occurrence);
      let category=type==='pagamento'?'Pagamento de fatura':type==='saldo_anterior'?'Saldo anterior':type==='encargo'?'Encargos':'';
      // Only unambiguous merchant types get categories; other purchases remain reviewable.
      if(type==='compra'){if(/mercado oliveira|zappidelivery/i.test(title))category='Alimentação';else if(/mvmedicos/i.test(title))category='Saúde';else if(/descomplica/i.test(title))category='Educação';else if(/rmdriver/i.test(title))category='Transporte'}
      const recurrence=manual&&header.includes('recurrence')&&cells[header.indexOf('recurrence')].trim()==='monthly'?'monthly':'';if(manual&&header.includes('category')&&cells[header.indexOf('category')].trim()==='Seguros')category='Seguros';
      return {date,title,amount,raw,current,total,type,category,recurrence,purchaseKey:purchaseBase+'|'+occurrence,occurrence,line:index+2};
    });
  }
  function summary(rows){const sums={total:0,compras:0,encargos:0,saldoAnterior:0,pagamentos:0,estornos:0,count:rows.length,parceladas:0,pendentes:0};for(const r of rows){const cents=Math.round(r.amount*100);sums.total+=cents;if(r.type==='compra')sums.compras+=cents;if(r.type==='encargo')sums.encargos+=cents;if(r.type==='saldo_anterior')sums.saldoAnterior+=cents;if(r.type==='pagamento')sums.pagamentos+=cents;if(r.type==='estorno')sums.estornos+=cents;if(r.total>1)sums.parceladas++;if(!r.category)sums.pendentes++}for(const k of ['total','compras','encargos','saldoAnterior','pagamentos','estornos'])sums[k]/=100;return sums}
  function meta(note){try{return typeof note==='string'&&note.startsWith(prefix)?JSON.parse(note.slice(prefix.length)):null}catch{return null}}
  function note(data){return prefix+JSON.stringify(data)}
  function monthShift(month,n){const [y,m]=month.split('-').map(Number);const date=new Date(Date.UTC(y,m-1+n,1));return date.toISOString().slice(0,7)}
  function dueAt(month,day){const [y,m]=month.split('-').map(Number);return month+'-'+String(Math.min(day,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0')}
  function schedule(record,card,all,targetMonth){const data=record.importData||meta(record.note);if(!data)return null;const month=data.dueDate.slice(0,7),count=data.recurrence==='monthly'?Math.max(1,Math.min(600,(Number((targetMonth||month).slice(0,4))-Number(month.slice(0,4)))*12+Number((targetMonth||month).slice(5))-Number(month.slice(5))+1)):data.type==='compra'?data.total-data.current+1:1;
    return Array.from({length:count},(_,i)=>{const target=monthShift(month,i);const actual=i>0&&all.some(other=>{const m=other.importData||meta(other.note);return other!==record&&other.card===record.card&&m&&(m.purchaseKey===data.purchaseKey||data.recurrence==='monthly'&&String(m.originalTitle||other.description).trim().toLowerCase()===String(data.originalTitle||record.description).trim().toLowerCase())&&m.dueDate.slice(0,7)===target});if(actual)return null;return {number:data.current+i,amount:record.value,dueDate:dueAt(target,Number(data.dueDate.slice(8))),projected:i>0,type:data.type}}).filter(Boolean);
  }
  return {parseCSV,summary,meta,note,monthShift,dueAt,schedule};
})();
if(typeof window!=='undefined')window.Statement=Statement;
