/* Category preferences are stored separately from financial transactions. */
function financeCategories_(input){
  const defaults=['Alimentação','Moradia','Transporte','Saúde','Educação','Outros','Seguros','Encargos','Saldo anterior','Pagamento de fatura'];
  const key=name=>name.normalize('NFC').toLocaleLowerCase('pt-BR');
  const spreadsheet=SpreadsheetApp.getActiveSpreadsheet();let sheet=spreadsheet.getSheetByName('Categorias');
  const headers=['id','nome','ativa'];
  if(sheet&&sheet.getRange(1,1,1,3).getDisplayValues()[0].some((v,i)=>v!==headers[i]))throw Error('Confira os cabeçalhos da aba Categorias.');
  const saved=sheet&&sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,3).getValues().filter(r=>r[0]).map(r=>({id:String(r[0]),nome:String(r[1]),ativa:r[2]!==false&&r[2]!=='false'})):[];
  const all=new Map();for(const name of [...defaults,...readCollection_('lancamentos').map(r=>String(r.categoria||'').trim()).filter(Boolean)]){if(!all.has(key(name)))all.set(key(name),{id:stableUUID('category|'+key(name)),nome:name,ativa:true})}for(const item of saved)all.set(key(item.nome),item);
  if(input.action==='list')return {ok:true,records:[...all.values()]};
  if(input.action!=='save'||typeof input.name!=='string'||typeof input.active!=='boolean')throw Error('Categoria inválida.');
  const name=input.name.normalize('NFC').trim().replace(/\s+/g,' ');if(!name||name.length>60||/[\x00-\x1f]/.test(input.name)||/^[=+@-]/.test(name))throw Error('Use um nome de até 60 caracteres, sem fórmulas.');
  const existing=all.get(key(name)),item={id:existing?.id||stableUUID('category|'+key(name)),nome:existing?.nome||name,ativa:input.active};
  if(!sheet){sheet=spreadsheet.insertSheet('Categorias');sheet.getRange(1,1,1,3).setValues([headers]);sheet.setFrozenRows(1)}
  const index=saved.findIndex(r=>r.id===item.id),values=[[item.id,item.nome,item.ativa?'true':'false']];if(index<0)sheet.appendRow(values[0]);else sheet.getRange(index+2,1,1,3).setValues(values);
  SpreadsheetApp.flush();return {ok:true,record:item,sheetSynced:true};
}
