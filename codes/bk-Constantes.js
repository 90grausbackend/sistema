// ****************************************
// 
// CONSTANTES.GS - BACKEND
// Código GS para Google GAS
// arquivo x de y
// 
// ****************************************


// ========================================
// CONSTANTES GLOBAIS
// ========================================
const SHEET_ID = "1m_y_tVy9Cu_iKtWMJy8tHomUQksBr9TXQKTwhj5Gt6s";

const ABA_CADASTROS         = "Cadastros";
const ABA_TABELAS_DE_PRECOS = "Tabelas_de_Precos";
const ABA_CHECKINS          = "Checkins";
const ABA_DIARIAS           = "Diarias";
const ABA_PAUSAS            = "Pausas";
const ABA_COMANDAS          = "Comandas";
const ABA_VENDAS_SERVICOS   = "Vendas_Servicos";
const ABA_VENDAS_PRODUTOS   = "Vendas_Produtos";
const ABA_CEP               = "CEP";


// ========================================
// CONTADOR ATÔMICO (evita duplicidade de IDs)
// ========================================
const CONFIG = {
  sheetConfigName: "Config",
  ids: {
    CADASTRO:    "Config!B3",
    CHECKIN:     "Config!B4",
    DIARIAS:     "Config!B5",
    PAUSAS:      "Config!B6",
    COMANDA:     "Config!B7",
    VENDAS_SERV: "Config!B8",
    VENDAS_PROD: "Config!B9"
  }
};