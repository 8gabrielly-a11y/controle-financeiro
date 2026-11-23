/** @OnlyCurrentDoc */
/**
 * Backend for the private finance app. Deploy as an Apps Script web app
 * running as the sheet owner. Set API_TOKEN in Script Properties.
 * The Site server, never the browser, sends API_TOKEN.
 */
const COLLECTIONS = Object.freeze({
  contas: ['Contas', ['id','nome','tipo','saldo_inicial','data_saldo','ativa']],
  receitas: ['Receitas', ['id','nome','valor_previsto','dia_recebimento','recorrencia','inicio','fim','conta_id','ativa']],
  cartoes: ['Cartoes', ['id','nome','limite_total','dia_fechamento','dia_vencimento','ativo']],
  lancamentos: ['Lancamentos', ['id','criado_em','data_compra','descricao','valor','categoria','forma_pagamento','conta_id','cartao_id','parcelas','mes_override','status','observacao']],
  contas_a_pagar: ['Contas a pagar', ['id','nome','valor_previsto','dia_vencimento','recorrencia','inicio','fim','conta_id','ativa']],
  pagamentos: ['Pagamentos', ['id','conta_a_pagar_id','data_vencimento','pago_em','valor_pago','status','observacao']],
  cofrinhos: ['Cofrinhos', ['id','nome','valor_alvo','prazo','prioridade','ativo']],
  aportes: ['Aportes', ['id','cofrinho_id','data','valor','tipo','conta_id','observacao']]
});

function respond_(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function text_(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  const stringValue = String(value);
  return /^[=+@]/.test(stringValue) || /^-[A-Za-z(]/.test(stringValue)
    ? "'" + stringValue : stringValue;
}

function output_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'America/Sao_Paulo', 'yyyy-MM-dd');
  }
  return value;
}

function doPost(e) {
  if(PropertiesService.getScriptProperties().getProperty('SHEETS_PRIMARY')==='true')return respond_({ok:false,error:'legacy_read_only'});
  try {
    const request = JSON.parse(e && e.postData && e.postData.contents || '{}');
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('API_TOKEN');
    if (!token) return respond_({ok:false,error:'not_configured'});
    if (typeof request.token !== 'string' || request.token !== token) {
      return respond_({ok:false,error:'unauthorized'});
    }
    const definition = COLLECTIONS[request.collection];
    if (!definition) return respond_({ok:false,error:'invalid_collection'});
    if (!['list','create','update','upsert'].includes(request.action)) {
      return respond_({ok:false,error:'invalid_action'});
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(definition[0]);
      if (!sheet) return respond_({ok:false,error:'missing_sheet'});
      const headers = definition[1];
      const currentHeaders = sheet.getRange(1,1,1,headers.length).getDisplayValues()[0];
      if (currentHeaders.some((value,index)=>value!==headers[index])) {
        return respond_({ok:false,error:'schema_mismatch'});
      }
      const rowCount = Math.max(0,sheet.getLastRow()-1);
      const rows = rowCount ? sheet.getRange(2,1,rowCount,headers.length).getValues() : [];
      if (request.action === 'list') {
        return respond_({ok:true,records:rows.filter(row=>row[0]).map(row=>Object.fromEntries(headers.map((key,i)=>[key,output_(row[i])])))});
      }
      const input = request.record;
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return respond_({ok:false,error:'invalid_record'});
      }
      if (Object.keys(input).some(key=>!headers.includes(key))) {
        return respond_({ok:false,error:'unknown_field'});
      }
      if (request.action === 'upsert') {
        if (typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.id)) {
          return respond_({ok:false,error:'invalid_id'});
        }
        const index = rows.findIndex(row=>row[0]===input.id);
        const previous = index<0 ? {} : Object.fromEntries(headers.map((key,i)=>[key,output_(rows[index][i])]));
        const record = Object.assign({},previous,input);
        if (index<0) sheet.appendRow(headers.map(key=>text_(record[key])));
        else sheet.getRange(index+2,1,1,headers.length).setValues([headers.map(key=>text_(record[key]))]);
        return respond_({ok:true,record:record});
      }
      if (request.action === 'create') {
        if (input.id) return respond_({ok:false,error:'id_must_be_generated'});
        const id = Utilities.getUuid();
        const record = Object.assign({},input,{id});
        if (headers.includes('criado_em') && !record.criado_em) record.criado_em = new Date().toISOString();
        sheet.appendRow(headers.map(key=>text_(record[key])));
        return respond_({ok:true,record:record});
      }
      const id = text_(request.id);
      if (!id || input.id && text_(input.id)!==id) return respond_({ok:false,error:'invalid_id'});
      const index = rows.findIndex(row=>row[0]===id);
      if (index<0) return respond_({ok:false,error:'not_found'});
      const existing = Object.fromEntries(headers.map((key,i)=>[key,output_(rows[index][i])]));
      const updated = Object.assign({},existing,input,{id});
      sheet.getRange(index+2,1,1,headers.length).setValues([headers.map(key=>text_(updated[key]))]);
      return respond_({ok:true,record:updated});
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return respond_({ok:false,error:'request_failed'});
  }
}
