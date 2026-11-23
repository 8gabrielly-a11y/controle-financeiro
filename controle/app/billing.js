/* Date-only credit-card schedule. Dates are local calendar dates in YYYY-MM-DD. */
window.Billing = (()=>{
  const pad=n=>String(n).padStart(2,'0');
  const days=(y,m)=>new Date(y,m,0).getDate();
  const dayIn=(y,m,d)=>`${y}-${pad(m)}-${pad(Math.min(Number(d),days(y,m)))}`;
  const shift=(year,month,n)=>{const z=year*12+(month-1)+n;return {year:Math.floor(z/12),month:z%12+1}};
  function firstClose(purchaseDate,closingDay){
    const [y,m]=purchaseDate.split('-').map(Number);
    let close=dayIn(y,m,closingDay);
    if(purchaseDate>=close){const next=shift(y,m,1);close=dayIn(next.year,next.month,closingDay)}
    return close;
  }
  function dueAfter(closeDate,dueDay){
    const [y,m]=closeDate.split('-').map(Number);
    let due=dayIn(y,m,dueDay);
    if(due<=closeDate){const next=shift(y,m,1);due=dayIn(next.year,next.month,dueDay)}
    return due;
  }
  function schedule({amount,purchaseDate,installments,closingDay,dueDay}){
    if(!(Number(amount)>0)||!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)||!Number.isInteger(Number(installments))||Number(installments)<1)throw Error('Compra inválida');
    if(![closingDay,dueDay].every(x=>Number.isInteger(Number(x))&&Number(x)>=1&&Number(x)<=31))throw Error('Dias inválidos');
    const first=firstClose(purchaseDate,closingDay),[y,m]=first.split('-').map(Number),n=Number(installments),cents=Math.round(Number(amount)*100),base=Math.floor(cents/n),remainder=cents-base*n;
    return Array.from({length:n},(_,i)=>{const x=shift(y,m,i),closingDate=dayIn(x.year,x.month,closingDay);return {number:i+1,amount:(base+(i<remainder?1:0))/100,closingDate,dueDate:dueAfter(closingDate,dueDay)}});
  }
  return {firstClose,dueAfter,schedule};
})();
