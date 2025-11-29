// ****************************************
// UTILITÁRIOS - BACKEND
// Arquivo Util.js
// ****************************************


// ========================================
// NORMALIZAR E LIMPAR STRINGS
// ========================================
function normalizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().toLowerCase();
}

function trimString(str) {
  if (typeof str === 'string') {
  return str.trim();
  }
  return str;
}

// Converte null/string vazia em ""
function cleanValue(value) {
  if (value === null || typeof value === 'undefined' || value === '') {
  return '';
  }
  return value;
}


// ========================================
// LIMPAR NÚMERO
// ========================================
function onlyDigits(rawString) {
  const str = cleanValue(rawString);
  return typeof str === 'string' ? str.replace(/\D/g, '') : '';
}


// ========================================
// NORMALIZAR DATAS
// ========================================
function normalizeDate(dateValue) {
  if (!dateValue) return '';
  
  // 1. Se já for um objeto Date, retorna diretamente. (CORREÇÃO)
  if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
  return dateValue;
  }

  // Se não for string (ex: número lido da planilha que não é data), retorna.
  if (typeof dateValue !== 'string') return dateValue;

  // 2. Tenta formato padrão JS (YYYY-MM-DD ou outras variantes)
  let date = new Date(dateValue);
  if (!isNaN(date.getTime())) {
  return date;
  }

  // 3. Tenta formato brasileiro (DD/MM/YYYY)
  const parts = dateValue.split('/');
  if (parts.length === 3) {
  // parts[2] = Ano, parts[1]-1 = Mês, parts[0] = Dia
  date = new Date(parts[2], parts[1] - 1, parts[0]);
  
  // Verifica se o objeto Date é válido
  if (!isNaN(date.getTime())) {
  return date;
  }
  }

  // Se tudo falhar, retorna a string original
  return dateValue;
}

// Formato de data brasileiro
function formatDateForSheet(date) {
  if (!(date instanceof Date)) return '';
  const tz = Session.getScriptTimeZone();
  return Utilities.formatDate(date, tz, "dd/MM/yyyy HH:mm:ss");
}