// ****************************************
// BACKEND
// Arquivo bk-Caches.js
// ****************************************

/* CACHE:
 * Cadastro (dados DO cliente, status de check-in, pausa/retomada, adição de serviços, desconto de diária)
 * Comandas
*/
// ========================================
// 1. CONSTANTES
// ========================================
const ABA_CEP = "CEP";
const KEY_CEP = 'CACHE_MAPA_CEP';
const TIMEOUT_CEP_SECONDS = 86400;     // 24 horas

const ABA_CLIENTES = "Cadastro";
const KEY_CLIENTES = 'CACHE_LISTA_CLIENTES';
const TIMEOUT_CLIENTES_SECONDS = 1800; // 30 minutos

const ABA_ITENS = "Tabelas_de_Precos"; 
const KEY_ITENS = 'CACHE_ITENS_VENDIDOS';
const TIMEOUT_ITENS_SECONDS = 43200;   // 12 horas

// Variáveis de Cache de 1ª Camada (In-Memory)
let _cepCacheData = { value: null }; 
let _clientesCacheData = { value: null };
let _itensCacheData = { value: null };

// MAPA CENTRALIZADO: Armazena a referência à variável global de cada cache
const GLOBAL_CACHE_MAP = {}; 


// ========================================
// 2. UTILIDADE GERAL E ABSTRAÇÃO
// ========================================
// Remove uma chave do cache e a variável global correspondente
function invalidateCache(key) {
  CacheService.getScriptCache().remove(key);
  
  const globalVar = GLOBAL_CACHE_MAP[key]; // Busca a referência no Mapa

  if (globalVar) {
    globalVar.value = null; // Limpa a variável global
    logger_('warn', { event: 'cache.invalidate.full', key });
    return;
  }
  
  logger_('warn', { event: 'cache.invalidate.miss', key, message: 'Chave nao registrada no mapa.' });
}

function resolveCache(globalVar, cacheKey, timeout, getterFn) {
  if (globalVar.value !== null) return globalVar.value;

  const cachedData = CacheService.getScriptCache().get(cacheKey);
  if (cachedData) {
  const data = JSON.parse(cachedData);
  globalVar.value = data;
  return data;
  }

  const data = getterFn();
  try {
  CacheService.getScriptCache().put(cacheKey, JSON.stringify(data), timeout);
  } catch(e) {
  logger_('error', { event: 'cache.put.fail', key: cacheKey, error: e.message });
  }
  globalVar.value = data;
  return data;
}

// Registra um novo cache, cria a função loader e a função getter.
function registerCache({ sheetName, key, timeout, requiredCols, rowMapper, globalVar }) {
  
  // REGISTRO CENTRALIZADO: Adiciona a referência ao Mapa
  GLOBAL_CACHE_MAP[key] = globalVar; 
  
  function loaderFn() {
  logger_('info', { event: `${sheetName}.cache.miss`, action: 'loading' });
  const sheet = getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data.shift();
  if (!headers) return [];

  const idx = getColumnIndexes(headers, requiredCols);
  const result = [];
  for (const row of data) {
    const mapped = rowMapper(row, idx);
    if (mapped !== null && mapped !== undefined) result.push(mapped);
  }
  logger_('info', { event: `${sheetName}.cache.loaded`, count: result.length });
  return result;
  }
  
  // Retorna o getter que chamará a função genérica
  return function() {
  return resolveCache(globalVar, key, timeout, loaderFn);
  };
}

function getColumnIndexes(headers, requiredCols) {
  const indexes = {};
  for (const col of requiredCols) {
  const idx = headers.indexOf(col);
  if (idx < 0) throw new Error(`Coluna "${col}" não encontrada`);
  indexes[col] = idx;
  }
  return indexes;
}


// ========================================
// 3. DEFINIÇÃO DOS CACHES
// ========================================
const getCepCache = registerCache({
  sheetName: ABA_CEP, key: KEY_CEP, timeout: TIMEOUT_CEP_SECONDS,
  requiredCols: ['Macrorregião','Distritos','CEP Início','CEP Fim'],
  rowMapper: (row, idx) => { /* ... mapeamento CEP ... */
    const cepInicio = onlyDigits(row[idx['CEP Início']]);
    const cepFim = onlyDigits(row[idx['CEP Fim']]);
    if (cepInicio.length !== 8 || cepFim.length !== 8) return null;
    return {
      macroRegiao: trimString(row[idx['Macrorregião']]),
      distrito: trimString(row[idx['Distritos']]),
      cepInicio, cepFim
    };
  }, globalVar: _cepCacheData
});

const getClientesCache = registerCache({
  sheetName: ABA_CLIENTES, key: KEY_CLIENTES, timeout: TIMEOUT_CLIENTES_SECONDS,
  requiredCols: ['ID','Nome Completo','CPF/CNPJ'],
  rowMapper: (row, idx) => ({
    id: row[idx['ID']],
    nome: trimString(row[idx['Nome Completo']]),
    cpf: onlyDigits(row[idx['CPF/CNPJ']])
  }), globalVar: _clientesCacheData
});

const getItensCache = registerCache({
  sheetName: ABA_ITENS, key: KEY_ITENS, timeout: TIMEOUT_ITENS_SECONDS,
  requiredCols: ['ID','Nome do Item','Preço','Tipo'],
  rowMapper: (row, idx) => {
    let priceValue = row[idx['Preço']];
    let price = (typeof priceValue === 'number') ? priceValue : parseFloat(String(priceValue).replace(/[^\d,.-]/g, '').replace(",", "."));
    if (isNaN(price)) price = 0;
    return {
      id: row[idx['ID']], nome: trimString(row[idx['Nome do Item']]),
      preco: price, tipo: normalizeString(row[idx['Tipo']])
    };
  }, globalVar: _itensCacheData
});