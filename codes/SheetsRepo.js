// ****************************************
// BACKEND
// Arquivo SheetsRepo.gs
// ****************************************

const SheetsRepo = (function () {

  // ========================================
  // A. UTILS INTERNOS
  // ========================================
  function getSheetByName_(sheetName) {
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada.`);
    return sheet;
  }

  function getCachedHeaders_(sheetName, sheet) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `HEADERS_${sheetName}`;
    let headers = cache.get(cacheKey);
    if (headers) return JSON.parse(headers);

    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    cache.put(cacheKey, JSON.stringify(headers), 3600);
    return headers;
  }

  function rowToObject_(headers, rowData) {
    const result = {};
    headers.forEach((header, index) => {
      const key = cleanValue(header);
      if (index < rowData.length) result[key] = rowData[index];
    });
    return result;
  }

  // ========================================
  // B. OPERAÇÕES ATÔMICAS
  // ========================================
  function generateAtomicId(counterKey) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error("Servidor ocupado. Não foi possível obter ID atômico.");

    try {
      const cellRef = ATOMIC_COUNTERS[counterKey];
      if (!cellRef) throw new Error(`Chave de contador "${counterKey}" não encontrada.`);

      const sheet = getSheetByName_("Config");
      const counterCell = sheet.getRange(cellRef);
      const currentId = parseInt(counterCell.getValue()) || 0;
      const newId = currentId + 1;
      counterCell.setValue(newId);
      return newId;
    } finally {
      lock.releaseLock();
    }
  }

  // ========================================
  // C. CRUD
  // ========================================
  function createRecords(sheetName, recordsArray) {
    try {
      const sheet = getSheetByName_(sheetName);
      const headers = getCachedHeaders_(sheetName, sheet);
      const rows = recordsArray.map(r => headers.map(h => r[cleanValue(h)] ?? ""));
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
      return ok_(rows.length);
    } catch (e) {
      return err_(e.message);
    }
  }

  function readRecord(sheetName, keyColumn, keyValue) {
    try {
      const sheet = getSheetByName_(sheetName);
      const [headers, ...data] = sheet.getDataRange().getValues();
      const keyIndex = headers.findIndex(h => cleanValue(h) === cleanValue(keyColumn));
      if (keyIndex === -1) return err_("Coluna chave não encontrada");
      const row = data.find(r => String(r[keyIndex]) === String(keyValue));
      if (!row) return err_("Registro não encontrado");
      return ok_(rowToObject_(headers, row));
    } catch (e) {
      return err_(e.message);
    }
  }

  function listAll(sheetName) {
    try {
      const sheet = getSheetByName_(sheetName);
      const [headers, ...data] = sheet.getDataRange().getValues();
      const records = data.map(r => rowToObject_(headers, r));
      return ok_(records);
    } catch (e) {
      return err_(e.message);
    }
  }

  function updateRecord(sheetName, keyColumn, keyValue, newRecord) {
    try {
      const sheet = getSheetByName_(sheetName);
      const data = sheet.getDataRange().getValues();
      const headers = data.shift();
      const keyIndex = headers.findIndex(h => cleanValue(h) === cleanValue(keyColumn));
      if (keyIndex === -1) return err_("Coluna chave não encontrada");

      const rowIndex = data.findIndex(r => String(r[keyIndex]) === String(keyValue));
      if (rowIndex === -1) return err_("Registro não encontrado");

      const updatedRow = data[rowIndex];
      headers.forEach((h, i) => {
        const key = cleanValue(h);
        if (newRecord[key] !== undefined) updatedRow[i] = newRecord[key];
      });
      sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([updatedRow]);
      return ok_(true);
    } catch (e) {
      return err_(e.message);
    }
  }

  function deleteRecord(sheetName, keyColumn, keyValue) {
    try {
      const sheet = getSheetByName_(sheetName);
      const data = sheet.getDataRange().getValues();
      const headers = data.shift();
      const keyIndex = headers.findIndex(h => cleanValue(h) === cleanValue(keyColumn));
      if (keyIndex === -1) return err_("Coluna chave não encontrada");

      const rowIndex = data.findIndex(r => String(r[keyIndex]) === String(keyValue));
      if (rowIndex === -1) return err_("Registro não encontrado");

      sheet.deleteRow(rowIndex + 2);
      return ok_(true);
    } catch (e) {
      return err_(e.message);
    }
  }

  // ========================================
  // D. BUSCA DE CEP
  // ========================================
  function lookupCep(rawCep) {
    const targetCep = onlyDigits(rawCep);
    if (targetCep.length !== 8) return null;

    const cepRanges = getCepCache();
    for (const range of cepRanges) {
      if (targetCep >= range.cepInicio && targetCep <= range.cepFim) {
        return { macroRegiao: range.macroRegiao, distrito: range.distrito };
      }
    }
    return null;
  }

  // ========================================
  // E. API PÚBLICA
  // ========================================
  return {
    createRecords,
    readRecord,
    listAll,
    updateRecord,
    deleteRecord,
    generateAtomicId,
    lookupCep
  };

})();
