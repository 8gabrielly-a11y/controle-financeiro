window.FinanceRemote=(()=>{
  let connected=false,failed=false,sheetConnected=false,sheetSynced=false;
  async function request(action,collection,record,id){
    if(failed) throw Error('Atualize a página e entre novamente.');
    if(!connected) throw Error('Armazenamento indisponível');
    const response=await FinanceBridge.fetch('/api/sheets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,collection,record,id})});
    const result=await response.json();
    if(!result.ok)throw Error(result.error||'Falha na sincronização');
    if(action!=='list'){sheetSynced=result.sheetSynced===true;window.dispatchEvent(new Event('finance:sync-state'))}
    return result;
  }
  async function initialize(){
    try{const response=await FinanceBridge.fetch('/api/status');const status=await response.json();connected=Boolean(status.connected);sheetConnected=Boolean(status.sheetConnected)}catch{connected=false}
    return connected;
  }
  async function sync(){
    const response=await FinanceBridge.fetch('/api/sync',{method:'POST'});
    const result=await response.json();
    sheetSynced=Boolean(result.ok);
    if(!result.ok)console.warn('Sincronização Google:',result.error);
    window.dispatchEvent(new Event('finance:sync-state'));
    return result;
  }
  return {initialize,request,sync,disable(){connected=false;failed=true},get connected(){return connected},get failed(){return failed},get sheetConnected(){return sheetConnected},get sheetSynced(){return sheetSynced}};
})();
