window.FinanceBridge=(()=>{
 const key='finance.google.bridge.v1',query=new URLSearchParams(location.search);
 let configuration=null;try{configuration=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
 if(query.has('financeChannel')&&query.has('financeParent'))configuration={channel:query.get('financeChannel'),origin:query.get('financeParent')};
 const valid=configuration&&/^[a-f0-9]{48}$/.test(configuration.channel)&&/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(configuration.origin)&&window.parent!==window;
 let connected=false;const pending=new Map();let resolveReady;
 const ready=new Promise(resolve=>resolveReady=resolve);
 if(valid){sessionStorage.setItem(key,JSON.stringify(configuration));
  addEventListener('message',event=>{
   if(event.source!==parent||event.origin!==configuration.origin||event.data?.channel!==configuration.channel)return;
   if(event.data.type==='finance:ready'){connected=true;resolveReady(true);return}
   if(event.data.type==='finance:response'){
    const item=pending.get(event.data.id);if(!item)return;
    clearTimeout(item.timeout);pending.delete(event.data.id);item.resolve(event.data.result);
   }
  });
  parent.postMessage({type:'finance:hello',channel:configuration.channel},configuration.origin);
 }else resolveReady(false);
 const startupTimeout=setTimeout(()=>resolveReady(false),20000);ready.then(()=>clearTimeout(startupTimeout));
 async function fetchApi(path,options={}){
  if(!await ready||!connected)throw Error('Entre pela página de acesso com sua conta Google.');
  let body={};try{body=options.body?JSON.parse(options.body):{}}catch{throw Error('Pedido inválido.')}
  const id=crypto.randomUUID();const result=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{pending.delete(id);reject(Error('A planilha não respondeu. Confira antes de repetir o lançamento.'))},180000);
   pending.set(id,{resolve,timeout});parent.postMessage({type:'finance:request',id,channel:configuration.channel,request:{path,body}},configuration.origin);
  });return {ok:result.ok!==false,json:async()=>result};
 }
 return {fetch:fetchApi,ready};
})();
