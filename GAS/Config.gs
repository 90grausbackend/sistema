// ****************************************
// 
// CONFIGURAÇÕES GERAIS
// Código GS para Google GAS/Sheets
// arquivo x de y
// 
// ****************************************


// ========================================
// 1. INCLUDES DE CSS
// ========================================
// Code.gs
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}


// ========================================
// 2. CONSTANTES GLOBAIS
// ========================================
const BASE_URL = "https://script.google.com/macros/s/AKfycbyHgg9Ks5nsLMb4KOg9pYIeLjmch7I8KsaOD-tUjMdl/dev";
const SHEET_ID = "1m_y_tVy9Cu_iKtWMJy8tHomUQksBr9TXQKTwhj5Gt6s";
const ABA_CADASTROS = "Cadastros";
const ABA_CEP = "CEP";
const ABA_CHECKINS = "Checkins";
const ABA_DIARIAS = "Diarias";
const ABA_PAUSAS = "Pausas";
const ABA_CHECKINS = "Checkins";
const ABA_TABELAS_DE_PRECOS = "Tabelas_de_Precos";
const ABA_VENDAS_SERVICOS = "Vendas_Servicos";
const ABA_VENDAS_PRODUTOS = "Vendas_Produtos";
const ABA_COMANDAS = "Comandas";


// ========================================
// 3. doGet
// ========================================
function doGet(e) {
  const action = e.parameter.action;

  // Endpoint simples para teste
  if (!action) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", message: "API ONLINE" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Exemplo de endpoint GET: consultar CEP, buscar registro etc.
  if (action === "buscar") {
    const termo = e.parameter.termo || "";
    const resultado = buscarRegistro(termo); // sua função interna
    return ContentService
      .createTextOutput(JSON.stringify(resultado))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Você pode ir adicionando outros actions aqui...

  return ContentService
    .createTextOutput(JSON.stringify({ error: "Ação desconhecida" }))
    .setMimeType(ContentService.MimeType.JSON);
}
