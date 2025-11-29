// ****************************************
// BACKEND
// Arquivo SheetsRepo.gs
// ****************************************


const SheetsRepo = (function () {


// ========================================
// A. UTILS E HELPERS INTERNOS
// ========================================
  function getSheetByName_(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Aba "${sheetName}" nao encontrada.`);
  }
  return sheet;
}

// Usa CacheService para buscar ou ler os headers da planilha.
function getCachedHeaders_(sheetName, sheet) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `HEADERS_${sheetName}`;
  let headers = cache.get(cacheKey);

  if (headers) {
    return JSON.parse(headers);
  }

  // Lenta: Le da planilha
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Salva no cache por 1 hora
  cache.put(cacheKey, JSON.stringify(headers), 3600); 
  
  return headers;
}

// Converte uma linha Array da planilha em um objeto JSON.
function rowToObject_(headers, rowData) {
  const result = {};
  headers.forEach((header, index) => {
    const cleanHeader = cleanValue(header); 
    // Garante que o indice existe para evitar erros
    if (index < rowData.length) { 
      result[cleanHeader] = rowData[index];
    }
  });
  return result;
}

// Funcao interna de referencia para os contadores (se ATOMIC_COUNTERS for global)
function getAtomicCounters_() {
  return ATOMIC_COUNTERS;
}


// ========================================
// B. OPERAÇÕES ATÔMICAS E GERAÇÃO DE ID
// ========================================
function generateAtomicId(key) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Servidor ocupado. Nao foi possivel obter o ID atomico.');
  }

  try {
    const counters = getAtomicCounters_();
    const cellRef = counters[key];

    if (!cellRef) {
      throw new Error(`Chave do contador atomico "${key}" nao encontrada.`);
    }

    const sheet = getSheetByName_("Config"); 
    const counterCell = sheet.getRange(cellRef);
    
    const currentId = parseInt(counterCell.getValue()) || 0;
    const newId = currentId + 1;
    counterCell.setValue(newId);
    
    return newId;

  } catch (e) {
    logger_('error', { event: 'atomic.id.fail', key: key, error: e.message });
    throw new Error(`Falha critica ao gerar ID: ${e.message}`);
  } finally {
    lock.releaseLock();
  }
}


// ========================================
// C. LEITURA (READ)
// ========================================
// Busca e retorna uma linha completa como Objeto JSON, buscando por chave. (SNAPSHOT)
function readByKey(sheetName, keyColumnName, keyValue) {
  const sheet = getSheetByName_(sheetName);

  // 1. Le todos os dados (LENTO, mas necessário para a busca)
  const [headers, ...data] = sheet.getDataRange().getValues();
  
  // 2. Determina a posicao da coluna chave
  const keyIndex = headers.findIndex(h => cleanValue(h) === cleanValue(keyColumnName));

  if (keyIndex === -1) return null; 

  // 3. Busca o registro pela chave
  const targetRow = data.find(row => row[keyIndex] === keyValue);

  if (!targetRow) return null;

  // 4. Converte o Array da linha em Objeto JSON
  return rowToObject_(headers, targetRow);
}

// Busca de CEP (MANTIDA UMA ÚNICA DEFINIÇÃO)
function findRegiaoByCep(cep) {
  const cepLimpo = onlyDigits(cep);
  if (cepLimpo.length !== 8) return null;

  const cepData = getCepCache(); 
  const cepNumero = parseInt(cepLimpo);

  const found = cepData.find(item => {
    const inicio = parseInt(item.cepInicio);
    const fim = parseInt(item.cepFim);
    return cepNumero >= inicio && cepNumero <= fim;
  });

  if (found) {
    return { macroRegiao: found.macroRegiao, distrito: found.distrito };
  }
  return null;
}


// ========================================
// D. ESCRITA (CREATE, UPDATE, DELETE)
// ========================================
function writeToSheet(sheetName, dataArray) {
  if (!dataArray || dataArray.length === 0) return 0;
  
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Servidor ocupado. Nao foi possivel gravar os dados.');
  }

  try {
    const sheet = getSheetByName_(sheetName);
    
    const headers = getCachedHeaders_(sheetName, sheet);
    const rowsToWrite = [];
    
    dataArray.forEach(record => {
      const row = headers.map(header => {
        const key = cleanValue(header); 
        return record[key] !== undefined ? record[key] : '';
      });
      rowsToWrite.push(row);
    });
    
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToWrite.length, rowsToWrite[0].length)
       .setValues(rowsToWrite);

    return rowsToWrite.length;

  } catch (e) {
    logger_('error', { event: 'sheet.write.fail', sheet: sheetName, error: e.message });
    throw new Error(`Falha ao gravar em ${sheetName}: ${e.message}`);

  } finally {
    lock.releaseLock();
  }
}

function updateSheetRecord(sheetName, recordKey, recordValue, newRecord) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Servidor ocupado. Nao foi possivel atualizar o registro.');
  }

  try {
    const sheet = getSheetByName_(sheetName);
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return false;

    const headers = data.shift();
    const keyColumn = headers.findIndex(h => cleanValue(h) === cleanValue(recordKey)); 

    if (keyColumn === -1) {
      throw new Error(`Coluna chave "${recordKey}" nao encontrada na aba ${sheetName}.`);
    }
    
    let targetRowIndex = -1;

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][keyColumn]) === String(recordValue)) {
        targetRowIndex = i + 2; 
        break;
      }
    }

    if (targetRowIndex === -1) return false;

    const updatedRow = data[targetRowIndex - 2]; 
    
    headers.forEach((header, colIndex) => {
      const key = cleanValue(header); 
      if (newRecord[key] !== undefined) {
        updatedRow[colIndex] = newRecord[key]; 
      }
    });

    sheet.getRange(targetRowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);

    return true;

  } catch (e) {
    logger_('error', { event: 'sheet.update.fail', sheet: sheetName, key: recordKey, value: recordValue, error: e.message });
    throw new Error(`Falha ao atualizar em ${sheetName}: ${e.message}`);
  } finally {
    lock.releaseLock();
  }
}


// ========================================
// E. APAGAR REGISTRO
// ========================================
// Localiza e DELETA um registro completo da planilha.
function deleteSheetRecord(sheetName, recordKey, recordValue) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Servidor ocupado. Nao foi possivel excluir o registro.');
  }

  try {
    const sheet = getSheetByName_(sheetName);
    
    // Le todos os dados para localizar o registro
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return false;

    const headers = data.shift();
    const keyColumn = headers.findIndex(h => cleanValue(h) === cleanValue(recordKey)); 

    if (keyColumn === -1) {
      throw new Error(`Coluna chave "${recordKey}" nao encontrada na aba ${sheetName}.`);
    }
    
    let targetRowIndex = -1;

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][keyColumn]) === String(recordValue)) {
        // i + 2 = linha real na planilha (base 1, apos o header)
        targetRowIndex = i + 2; 
        break;
      }
    }

    if (targetRowIndex === -1) return false;

    // Executa a exclusao da linha
    sheet.deleteRow(targetRowIndex);

    return true;

  } catch (e) {
    logger_('error', { event: 'sheet.delete.fail', sheet: sheetName, key: recordKey, value: recordValue, error: e.message });
    throw new Error(`Falha ao excluir em ${sheetName}: ${e.message}`);
  } finally {
    lock.releaseLock();
  }
}


// ========================================
// E. RETORNO DO REPOSITÓRIO (API Pública)
// ========================================
return {
  // Funções CRUD/Operacionais
  generateAtomicId,
  writeToSheet,
  updateSheetRecord,
  deleteSheetRecord, // Adicionado DELETE
  readByKey,

  // Funções de Busca Específica
  findRegiaoByCep
};

})(); // FIM DO IIFE DO SHEETS REPO