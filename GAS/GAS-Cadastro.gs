// ****************************************
// 
// CADASTRO - BACKEND
// Código GS para Google GAS/Sheets
// arquivo x de y
// 
// ****************************************



// ========================================
// Configuração e constantes
// ========================================
const PROP_LAST_ID   = "LAST_CLIENTE_ID"; // ID sequencial
const PROP_CPF_INDEX = "CPF_INDEX";       // JSON com CPFs cadastrados
const CACHE_CEP_KEY  = "CEP_DATA_CACHE";  // chave de cache para dados de CEP
const CACHE_TTL_SEC  = 6 * 60 * 60;       // 6 horas
const CSRF_TTL_SEC   = 5 * 60;            // 5 minutos para token CSRF

// ========================================
// CSRF TOKEN
// ========================================
// Gera CSRF Token single-use
function doGet(e) {
  if (e.parameter.action === "getCsrfToken") {
    return ContentService.createTextOutput(JSON.stringify({ csrfToken: getCsrfToken() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getCsrfToken() {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(token, "1", CSRF_TTL_SEC);
  return token;
}

// Valida token CSRF
function validarCsrfToken_(token) {
  if (!token) return false;
  const cache = CacheService.getScriptCache();
  const val = cache.get(token);
  if (!val) return false;
  // invalida após uso
  cache.remove(token);
  return true;
}

// Normaliza nome_index
function normalizarNome_(str) {
  if (!str) return "";
  const semAcento = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return semAcento.replace(/\s+/g, " ").trim();
}

// Validação de CPF no backend
function cpfValido_(cpf) {
  cpf = String(cpf || "").replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0, rem;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf[i-1]) * (11 - i);
  rem = (sum * 10) % 11; if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf[i-1]) * (12 - i);
  rem = (sum * 10) % 11; if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(cpf[10])) return false;
  return true;
}

// ========================================
// CEP: Cache + lookup
// ========================================
function getCepData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_CEP_KEY);
  if (cached) return JSON.parse(cached);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaCep = ss.getSheetByName(ABA_CEP);
  const values = abaCep.getDataRange().getValues();

  const data = values.slice(1).map(row => {
    const inicio = Number(row[3]);
    const fim = Number(row[4]);
    if (isNaN(inicio) || isNaN(fim)) return null;
    return {
      macrorregiao: row[0],
      subprefeitura: row[1],
      distrito: row[2],
      cepInicio: inicio,
      cepFim: fim
    };
  }).filter(r => r !== null);

  cache.put(CACHE_CEP_KEY, JSON.stringify(data), CACHE_TTL_SEC);
  return data;
}

function resolverCep_(cepStr) {
  if (!cepStr) return { regiao: "", bairro: "" };
  const numeros = String(cepStr).replace(/\D/g, "");
  if (numeros.length < 8) return { regiao: "", bairro: "" };

  const cepNum = Number(numeros);
  const faixas = getCepData();
  const faixa = faixas.find(f => cepNum >= f.cepInicio && cepNum <= f.cepFim);
  if (!faixa) return { regiao: "", bairro: "" };

  return {
    regiao: faixa.macrorregiao || "",
    bairro: faixa.distrito || ""
  };
}

// ========================================
// CPF: índice em Properties
// ========================================
function getCpfIndex_() {
  const props = PropertiesService.getScriptProperties();
  return JSON.parse(props.getProperty(PROP_CPF_INDEX) || "{}");
}

function setCpfIndex_(indexObj) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_CPF_INDEX, JSON.stringify(indexObj || {}));
}

// ========================================
// Cadastro principal
// ========================================
function salvarCadastro(formData) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    // Valida CSRF
    if (!validarCsrfToken_(formData.csrfToken)) {
      return { status: 'erro', message: 'Token CSRF inválido ou expirado.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const abaCadastros = ss.getSheetByName(ABA_CADASTROS);
    const props = PropertiesService.getScriptProperties();

    const cpfIndex = getCpfIndex_();
    const titular = formData.titular;

    // Validação CPF duplicado e válido
    if (titular.cpf) {
      if (!cpfValido_(titular.cpf)) {
        return { status: 'erro', message: 'CPF inválido.' };
      }
      if (cpfIndex[titular.cpf]) {
        return { status: 'erro', message: 'CPF já cadastrado.' };
      }
    }

    // IDs em lote
    let lastId = Number(props.getProperty(PROP_LAST_ID) || 0);
    lastId++;
    const grupoId = lastId;

    const now = new Date();
    const tz = ss.getSpreadsheetTimeZone();
    const timestamp = Utilities.formatDate(now, tz, "dd/MM/yyyy HH:mm:ss");
    const clienteDesde = Utilities.formatDate(now, tz, "dd/MM/yyyy");

    const registros = [];

    // Titular
    const titularNomeIndex = normalizarNome_(titular.nome);
    const titularCepInfo = resolverCep_(titular.cep);

    registros.push([
      lastId,
      timestamp,
      titular.status || "Ativo",
      clienteDesde,
      grupoId,
      titular.tipo || "Titular",
      titular.cpf || "",
      titular.nome,
      titularNomeIndex,
      titular.telefone || "",
      titular.cep || "",
      titularCepInfo.regiao,
      titularCepInfo.bairro
    ]);

    if (titular.cpf) cpfIndex[titular.cpf] = true;

    // Dependentes
    if (Array.isArray(formData.dependentes)) {
      formData.dependentes.forEach(dep => {
        const depId = ++lastId;
        const depNomeIndex = normalizarNome_(dep.nome);
        const depCepInfo = resolverCep_(dep.cep);

        registros.push([
          depId,
          timestamp,
          dep.status || "Ativo",
          clienteDesde,
          grupoId,
          dep.tipo || "Dependente",
          dep.cpf || "",
          dep.nome,
          depNomeIndex,
          dep.telefone || "",
          dep.cep || "",
          depCepInfo.regiao,
          depCepInfo.bairro
        ]);

        if (dep.cpf && cpfValido_(dep.cpf)) {
          cpfIndex[dep.cpf] = true;
        }
      });
    }

    // Atualiza propriedades
    props.setProperty(PROP_LAST_ID, lastId);
    setCpfIndex_(cpfIndex);

    // Escreve em bloco
    abaCadastros.getRange(abaCadastros.getLastRow() + 1, 1, registros.length, registros[0].length)
      .setValues(registros);

    return { status: 'sucesso', message: 'Cadastro salvo com sucesso' };

  } catch (err) {
    return { status: 'erro', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ========================================
// Endpoint para GitHub Pages
// ========================================
// ========================================
// CONFIGURAÇÃO CORS CENTRALIZADA
// ========================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 
  'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token'
};

// ========================================
// FUNÇÃO AUXILIAR PARA CRIAR E APLICAR HEADERS (Construtora de Resposta)
// Esta função DEVE existir em um dos seus arquivos .gs
// ========================================
function createCorsResponse_(resultado) {
  // 1. Cria o objeto ContentService.TextOutput com o resultado
  const output = ContentService.createTextOutput(JSON.stringify(resultado));
  output.setMimeType(ContentService.MimeType.JSON);

  // 2. Aplica os headers (assume que CORS_HEADERS existe globalmente)
  for (const header in CORS_HEADERS) {
    output.setHeader(header, CORS_HEADERS[header]);
  }
  
  // 3. Retorna o objeto pronto
  return output;
}

// ========================================
// FUNÇÃO AUXILIAR PARA APLICAR HEADERS (Revisão Final)
// ========================================
function setCorsHeaders_(output) {
  // VERIFICAÇÃO CRÍTICA: Garante que o método exista antes de chamar
  // Isso deve prevenir o erro "is not a function"
  if (typeof output.setHeader === 'function') {
    for (const header in CORS_HEADERS) {
      output.setHeader(header, CORS_HEADERS[header]);
    }
  } else {
    // Caso de falha: Loga o erro, mas não trava o App Script (opcional, mas seguro)
    Logger.log("Erro de Tipagem: Objeto de saída não é um TextOutput. Headers não aplicados.");
  }
  return output;
}

// ========================================
// 1. MANIPULADOR DE REQUISIÇÕES GET / OPTIONS / CADASTRO
// ========================================
function doGet(e) {
  let resultado;

  try {
    // Roteamento
    if (e.parameter.action === 'salvarCadastro') {
      // Processamento de dados (já dentro do try/catch)
      const formData = e.parameter; 
      resultado = processarRequisicaoDeCadastro(formData); 
      
    } else if (e.parameter.action === 'getCsrfToken') {
      // Isolando a falha do token
      try {
          resultado = { status: 'ok', token: getCsrfToken() };
      } catch (tokenErr) {
          resultado = { status: 'erro', message: 'Falha ao obter Token: ' + tokenErr.message };
      }
      
    } else {
      // Resposta padrão e segura para o pré-voo OPTIONS ou GET simples
      resultado = { status: 'ok', message: 'API Service Running.' };
    }

  } catch (err) {
    // Falha em qualquer roteamento
    resultado = { 
      status: 'erro', 
      message: 'Falha no Roteamento: ' + err.message 
    };
  }
  
  // Criação do ContentService.TextOutput fora do try/catch para evitar o TypeError
  const output = ContentService.createTextOutput(JSON.stringify(resultado));
  output.setMimeType(ContentService.MimeType.JSON);
  
  // Aplica os headers CORS
  return setCorsHeaders_(output); 
}


// 2. MANIPULADOR DE REQUISIÇÕES POST
// Recebe dados JSON no corpo da requisição (Ideal para cadastro)
function doPost(e) {
  let resultado;

  try {
    const data = JSON.parse(e.postData.contents);
    resultado = salvarCadastro(data);
  } catch (err) {
    resultado = {
      status: "erro",
      message: err.message
    };
  }

  const output = ContentService.createTextOutput(JSON.stringify(resultado));
  output.setMimeType(ContentService.MimeType.JSON);
  return setCorsHeaders_(output);
}
