// ==================================================
// BACKEND
// Arquivo bk-Core.js - CORRIGIDO E OTIMIZADO
// ==================================================


// ==================================================
// 1) CONFIG / CONSTANTES
// ==================================================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*", // >>> TROCAR PELO DOMÍNIO DO FRONT (Cloudflare) <<<
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token, Authorization",
  "Access-Control-Max-Age":       "3600"
};


// ==================================================
// 2) UTIL / HELPERS
// ==================================================
function applyCorsHeaders_(textOutput) {
  for (const k in CORS_HEADERS) {
    try { textOutput.setHeader(k, CORS_HEADERS[k]); } 
    catch (e) { Logger.log("applyCorsHeaders_ warning: " + e.message); }
  }
  return textOutput;
}

function jsonResponse_(payload) {
  return applyCorsHeaders_(ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON));
}

function emptyCorsResponse_() {
  return applyCorsHeaders_(ContentService.createTextOutput(""));
}

function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (k, v) => {
    if (typeof v === "object" && v !== null) {
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
    }
    return v;
  });
}

function logger_(level, meta) {
  try {
    Logger.log(safeStringify({ ts: new Date().toISOString(), level, ...meta }));
  } catch (_) {
    try { Logger.log(new Date().toISOString() + " " + level + " | [logging failure]"); } catch (_) {}
  }
}

/** * Executa a função do handler de rota, garantindo que exceções sejam tratadas 
 * e que a resposta seja um objeto padronizado.
 */
function safeExecute_(fn, params) { // Recebe a função handler e os parâmetros
  try {
    const r = fn(params); // Executa a função do handler
    // Garante que o handler retorne um objeto válido para jsonResponse_
    return (r && typeof r === "object") ? r : err_("Rota retornou resposta inválida.");
  } catch (err) {
    logger_("error", { message: "safeExecute error", error: err.message, stack: err.stack });
    return err_(err.message || "Erro interno na rota."); // Retorna objeto de erro padronizado
  }
}

function parsePostData_(e) {
  if (!e?.postData?.contents) return { error: "POST sem dados" };
  try {
    const parsed = JSON.parse(e.postData.contents);
    if (!parsed || typeof parsed !== "object") throw new Error();
    return { data: parsed };
  } catch (err) {
    return { error: "JSON inválido no POST: " + err.message };
  }
}

function requireParams_(obj, params = []) {
  for (const p of params) if (!(p in obj)) throw new Error(`Parâmetro obrigatório faltando: ${p}`);
}

function ok_(data = null, message = "ok") { return { status: "ok", message, data }; }
function err_(message) { return { status: "erro", message }; }


// ==================================================
// 3) SHEETS REPOSITORY (thin wrapper)
// ==================================================
const SheetsRepo = (function () {
  function getSpreadsheet_() { return SpreadsheetApp.getActiveSpreadsheet(); }

  function getRangeValue(sheetAndA1) {
    if (!sheetAndA1 || typeof sheetAndA1 !== "string") throw new Error("Parâmetro inválido: espera 'SheetName!A1'");
    const [sheetName, a1] = sheetAndA1.split("!");
    if (!sheetName || !a1) throw new Error("Formato inválido: use 'SheetName!A1'");
    const sheet = getSpreadsheet_().getSheetByName(sheetName);
    if (!sheet) throw new Error("Planilha não encontrada: " + sheetName);
    return sheet.getRange(a1).getValue();
  }

  return { getRangeValue };
})();


// ==================================================
// 4) ROTEADOR + MIDDLEWARES
// ==================================================
const ROUTES = {
  // GET endpoints
  getCsrfTokenData:       { method: "GET", handler: getCsrfTokenData },
  getCadastroClienteData: { method: "GET", handler: getCadastroClienteData },
  getServicosData:        { method: "GET", handler: getServicosData },
  getProdutosData:        { method: "GET", handler: getProdutosData },
  getComandasAbertasData: { method: "GET", handler: getComandasAbertasData },

  // POST endpoints (sempre CSRF)
  salvarCadastro:     { method: "POST", handler: salvarCadastro },
  atualizarCadastro:  { method: "POST", handler: atualizarCadastro },
  checkinCliente:     { method: "POST", handler: checkinCliente },
  confirmarPagamento: { method: "POST", handler: confirmarPagamento },
  fecharComanda:      { method: "POST", handler: fecharComanda },
  consumoDiaria:      { method: "POST", handler: consumoDiaria },
  pausarPlano:        { method: "POST", handler: pausarPlano }
};


const Router = (function () {
  const middlewares = [];

  function use(mw) { if (typeof mw === "function") middlewares.push(mw); }

  function runMiddlewares(context, finalHandler) {
    let index = -1;
    function dispatch(i) {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      if (i === middlewares.length) return finalHandler();
      return middlewares[i](context, () => dispatch(i + 1));
    }
    return dispatch(0);
  }

  function handle(action, params, method) {
    const route = ROUTES[action];
    if (!route) return err_(`Ação '${action}' não implementada.`);
    if (route.method !== method) return err_(`Ação '${action}' não disponível via ${method}.`);

    const context = { action, params, method, route };
    try {
      // CORREÇÃO: Passa a função handler e os params diretamente para safeExecute_
      const result = runMiddlewares(context, () => safeExecute_(route.handler, params)); 

      // Verifica se a resposta final, após middlewares e safeExecute, é válida.
      if (!result || typeof result !== "object") return err_("Resposta inválida do handler.");
      return result;
    } catch (e) {
      logger_("error", { message: "router error", error: e.message, stack: e.stack, action });
      return err_("Erro interno no roteador: " + e.message);
    }
  }

  return { use, handle };
})();


// ==================================================
// 5) MIDDLEWARES
// ==================================================
// Logging
Router.use((ctx, next) => {
  const safeParams = { ...ctx.params };
  if ("csrfToken" in safeParams) safeParams.csrfToken = "[REDACTED]";
  if ("password" in safeParams) safeParams.password = "[REDACTED]";
  logger_("info", { event: "route.call", action: ctx.action, method: ctx.method, params: safeParams });
  return next();
});

// CSRF obrigatório para todos os POST
Router.use((ctx, next) => {
  if (ctx.method !== "POST") return next();
  try {
    const tokenType = ctx.action === "salvarCadastro" ? "CAD" : "SYS";
    // Assumindo que validateCsrfToken é o nome limpo e correto
    validateCsrfToken(ctx.params.csrfToken, tokenType); 
  } catch (e) {
    logger_("warn", { message: "CSRF inválido", action: ctx.action, error: e.message });
    return err_("Token CSRF inválido: " + e.message);
  }
  return next();
});

// Error boundary
Router.use((ctx, next) => {
  try { return next(); } 
  catch (e) {
    logger_("error", { message: "Unhandled error", error: e.message, stack: e.stack });
    return err_("Erro interno: " + e.message);
  }
});

// Invalidação de Cache "on update" (cadastros, tabelas de preços e CEP são disponibilizados em cache)
Router.use(function cacheInvalidationMiddleware(ctx, next) {
    const result = next(); // Executa o handler e toda a lógica de escrita

    if (ctx.method === "POST" && result?.status === "ok") {
        
        // Invalida a lista de clientes após qualquer alteração no cadastro
        if (['salvarCadastro', 'atualizarCadastro'].includes(ctx.action)) {
            // NOTE: A função 'invalidateCache' (e KEY_CLIENTES) deve estar visível aqui.
            try {
                invalidateCache(KEY_CLIENTES);
            } catch (e) {
                logger_("error", { event: "cache.invalidation.fail", key: KEY_CLIENTES, error: e.message });
            }
        }
        
        // Se houver rotas de alteração de preço (consumoDiaria, etc.), o cache KEY_ITENS também precisaria ser invalidado aqui.
    }

    return result;
});


// ==================================================
// 6) HTTP HANDLERS (doGet / doPost / doOptions)
// ==================================================
function doGet(e) {
  const params = e?.parameter || {};
  if (!params.action) return jsonResponse_(ok_(null, "API Service Running."));
  const result = Router.handle(params.action, params, "GET");
  return jsonResponse_(result);
}

function doPost(e) {
  const parsed = parsePostData_(e);
  if (parsed.error) return jsonResponse_(err_(parsed.error));
  const dados = parsed.data;
  if (!dados.action) return jsonResponse_(err_("Ação não informada no POST."));
  const result = Router.handle(dados.action, dados, "POST");
  return jsonResponse_(result);
}

function doOptions() {
  return emptyCorsResponse_();
}
