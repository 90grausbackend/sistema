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
const ID = "1Mb_TIXgRk363UT6JrjtxmVZrrkf_vFt_ZV-kYVmjfR4";
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
const BASE_URL = "https://script.google.com/macros/s/SEU_DEPLOY_ID/exec";



// ========================================
// 3. URL DE CADA HTML
// ========================================
// Decide qual arquivo HTML servir com base nos parâmetros da URL.
function doGet(e) {
  // O parâmetro 'e' contém informações sobre a requisição (incluindo parâmetros da URL).
  const page = e.parameter.page; 
  let template;

  if (page === 'cadastro') {
    // Se a URL for ?page=cadastro, serve o arquivo Cadastro.html
    template = HtmlService.createTemplateFromFile('Cadastro_formulario');
  } else {
    // Caso contrário (ou se não houver parâmetro), serve o Index.html (default)
    template = HtmlService.createTemplateFromFile('Sistema');
  }
  
  return template.evaluate()
      .setTitle('Nome do Sistema')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // Importante para incorporar ou se precisar de permissões
}
