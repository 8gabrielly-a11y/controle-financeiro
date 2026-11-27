/** @OnlyCurrentDoc */
// Run once from the editor, in the existing spreadsheet-bound project.
function configurarControle() {
  const email=Session.getEffectiveUser().getEmail().toLowerCase();
  if(!email)throw Error('Entre na sua conta Google.');
  const props=PropertiesService.getScriptProperties();
  const previous=props.getProperty('FINANCE_OWNER_EMAIL');
  if(previous&&previous!==email)throw Error('Somente a proprietária pode configurar.');
  props.setProperties({FINANCE_OWNER_EMAIL:email,FINANCE_APP_URL:'https://8gabrielly-a11y.github.io/controle-financeiro/controle/app/index.html'});
  Object.keys(COLLECTIONS).forEach(collection=>sheet_(collection));
  console.log('Configuração concluída. Publique como usuário que acessa, somente você.');
}
function owner_(){
  const expected=PropertiesService.getScriptProperties().getProperty('FINANCE_OWNER_EMAIL');
  const email=Session.getActiveUser().getEmail().toLowerCase();
  if(!expected||!email||email!==expected)throw Error('Acesso restrito à proprietária.');
  return email;
}
function appUrl_(){
  const url=PropertiesService.getScriptProperties().getProperty('FINANCE_APP_URL')||'';
  if(!/^https:\/\/[a-z0-9-]+\.github\.io\/[^?#]+\/app\/index\.html$/.test(url))throw Error('Configure FINANCE_APP_URL com a página do GitHub.');
  return url;
}
function doGet(){
  owner_();
  const template=HtmlService.createTemplateFromFile('Bridge');
  template.appUrl=appUrl_();
  return template.evaluate().setTitle('Controle financeiro · Bia');
}
function financeApi(request){
  const owner=owner_();
  if(!request||typeof request!=='object'||JSON.stringify(request).length>220000)throw Error('Pedido inválido.');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    if(request.path==='/api/status')return {connected:true,sheetConnected:true,storage:'sheets'};
    if(request.path==='/api/sync'){
      const counts={};Object.keys(COLLECTIONS).forEach(k=>counts[k]=readCollection_(k).length);
      return {ok:true,counts,source:'Google Sheets'};
    }
    if(request.path==='/api/categories')return financeCategories_(request.body||{});
    if(request.path==='/api/sheets')return sheetRequest_(request.body||{});
    const env={DB:sheetDatabase_()};
    if(request.path==='/api/base-profile')return baseProfile(request.body||{},owner,env);
    if(request.path==='/api/import-statement')return importStatement(request.body||{},owner,env);
    return {ok:false,error:'Operação não disponível.'};
  }finally{lock.releaseLock()}
}
function sheet_(collection){
  const definition=COLLECTIONS[collection];if(!definition)throw Error('Coleção inválida.');
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(definition[0]);
  if(!sheet)throw Error('Aba ausente: '+definition[0]+'. Use a planilha original; não crie uma base vazia.');
  const current=sheet.getRange(1,1,1,definition[1].length).getDisplayValues()[0];
  if(current.some((v,i)=>v!==definition[1][i]))throw Error('Confira os cabeçalhos da aba '+definition[0]+'.');
  return sheet;
}
function normalizeCell_(key,value){
  const result=typeof value==='boolean'?String(value):output_(value);
  return ['inicio','fim','prazo','mes_override'].includes(key)&&typeof result==='string'?result.slice(0,7):result;
}
function readCollection_(collection){
  const sheet=sheet_(collection),headers=COLLECTIONS[collection][1],count=sheet.getLastRow()-1;
  if(count<=0)return [];
  return sheet.getRange(2,1,count,headers.length).getValues().filter(row=>row[0]).map(row=>Object.fromEntries(headers.map((key,i)=>[key,normalizeCell_(key,row[i])])));
}
function upsert_(collection,record,mode){
  const headers=COLLECTIONS[collection]?.[1];
  if(!headers||!record||typeof record!=='object'||Array.isArray(record)||!record.id||Object.keys(record).some(key=>!headers.includes(key)))throw Error('Registro inválido.');
  const sheet=sheet_(collection),count=sheet.getLastRow()-1;
  const ids=count>0?sheet.getRange(2,1,count,1).getValues().map(row=>row[0]):[];
  const index=ids.indexOf(record.id);
  if(index<0&&mode==='update')throw Error('Registro não encontrado.');
  if(index>=0&&mode==='ignore')return;
  const priorValues=index<0?[]:sheet.getRange(index+2,1,1,headers.length).getValues()[0];
  const previous=index<0?{}:Object.fromEntries(headers.map((k,i)=>[k,output_(priorValues[i])]));
  const saved=Object.assign({},previous,record),values=headers.map(k=>text_(saved[k]));
  if(index<0)sheet.appendRow(values);else sheet.getRange(index+2,1,1,headers.length).setValues([values]);
  SpreadsheetApp.flush();return saved;
}
function sheetRequest_(input){
  if(!COLLECTIONS[input.collection])return {ok:false,error:'Coleção inválida.'};
  if(input.action==='list')return {ok:true,records:readCollection_(input.collection)};
  if(!['create','update'].includes(input.action))return {ok:false,error:'Operação inválida.'};
  let record=input.record;if(!record||typeof record!=='object'||Array.isArray(record))return {ok:false,error:'Registro inválido.'};
  if(input.action==='create'){
    if(record.id)return {ok:false,error:'ID gerado pelo servidor.'};
    record=Object.assign({},record,{id:Utilities.getUuid()});
    if(input.collection==='lancamentos'&&!record.criado_em)record.criado_em=new Date().toISOString();
  }else{
    if(!input.id||record.id&&record.id!==input.id)return {ok:false,error:'ID inválido.'};
    record=Object.assign({},record,{id:input.id});
  }
  const saved=upsert_(input.collection,record,input.action==='update'?'update':'upsert');
  return {ok:true,record:saved,sheetSynced:true};
}
function json(value){return value}
function syncRecords(env,items){SpreadsheetApp.flush();return items.length}
function stableUUID(value){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(n=>(n+256)%256);
  bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const hex=bytes.slice(0,16).map(b=>b.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
// Adapter limited to prepared statements in Finance.gs; no SQL from browsers.
function sheetDatabase_(){
  return {prepare(sql){return {bind(...args){
    return {all(){
      const match=sql.match(/collection = '([^']+)'/),names=match?[match[1]]:Object.keys(COLLECTIONS);
      return {results:names.flatMap(collection=>readCollection_(collection).map(record=>({collection,id:record.id,payload:JSON.stringify(record)})))};
    },execute(){
      if(!sql.startsWith('INSERT INTO finance_records '))throw Error('Operação interna inválida.');
      const collection=args[1],record=JSON.parse(args[3]);
      upsert_(collection,record,sql.includes('DO NOTHING')?'ignore':'upsert');
    }};
  }}},batch(statements){statements.forEach(statement=>statement.execute());return []}};
}
