// ****************************************
// BACKEND
// Arquivo bk-Tokens.js
// ****************************************


// ========================================
// 1. CONSTANTES
// ========================================
const SYS_CACHE_TIMEOUT_SECONDS = 1800; // 30 minutos
const CAD_CACHE_TIMEOUT_SECONDS = 300;  // 5 minutos

// Map de ações para tipo de token
const ACTION_TOKEN_MAP = {
  'salvarCadastro':     'CAD',
  'atualizarCadastro':  'SYS',
  'checkinCliente':     'SYS',
  'confirmarPagamento': 'SYS',
  'fecharComanda':      'SYS',
  'consumoDiaria':      'SYS',
  'pausarPlano':        'SYS',
};


// ========================================
// 2. FUNÇÕES AUXILIARES
// ========================================
// Gera um token CSRF de uso único para o tipo indicado ('SYS' ou 'CAD').
function generateCsrfToken(type) {
  if (type !== 'SYS' && type !== 'CAD') {
    throw new Error('Tipo de token inválido.');
  }

  const cache = CacheService.getScriptCache();
  const token = Utilities.getUuid();
  const cacheKey = `${type}-${token}`;
  const timeout = type === 'SYS' ? SYS_CACHE_TIMEOUT_SECONDS : CAD_CACHE_TIMEOUT_SECONDS;

  cache.put(cacheKey, '1', timeout);
  logger_('info', { event: 'csrf.generate', type, token, timeout });
  return token;
}

// Valida um token CSRF.
// - CAD: uso único, remove após validação.
// - SYS: estende validade se ainda em operação.
function validateCsrfToken(token, type) {
  if (!token) throw new Error('Token CSRF não fornecido.');
  if (type !== 'SYS' && type !== 'CAD') throw new Error('Tipo de token inválido.');

  const cache = CacheService.getScriptCache();
  const cacheKey = `${type}-${token}`;
  const cached = cache.get(cacheKey);

  if (!cached) throw new Error('Token CSRF inválido (expirado ou já utilizado).');

  if (type === 'CAD') {
    // uso único: remove
    cache.remove(cacheKey);
  } else if (type === 'SYS') {
    // estende validade
    cache.put(cacheKey, '1', SYS_CACHE_TIMEOUT_SECONDS);
  }
}

// Retorna um novo token CSRF para o front-end.
function getCsrfTokenData(params) {
  try {
    const type = params?.type || 'SYS';
    const token = generateCsrfToken(type);
    const timeout = type === 'SYS' ? SYS_CACHE_TIMEOUT_SECONDS : CAD_CACHE_TIMEOUT_SECONDS;
    return ok_({ csrfToken: token, type, expiresIn: timeout });
  } catch (err) {
    logger_('warn', { event: 'csrf.error', error: err.message, params });
    return err_(err.message);
  }
}