// ****************************************
// 
// CADASTRO - FRONTEND
// Código GS para GitHub Pages
// arquivo x de y
// 
// ****************************************


// ========================================
// VARIÁVEIS GLOBAIS
// ========================================
const BASE_URL = "https://script.google.com/macros/s/AKfycbynvS8HXtHV8Nxf3FaLXpZNkBpySL7ThQW7qUGCR_nemtjq10qz9rWfnxCtqgaD7ZcjCw/exec";

const tokenRes = await fetch(BASE_URL + "?action=getCsrfToken");
const { csrfToken } = await tokenRes.json();
data.csrfToken = csrfToken;

let dependenteIndex = 0;


// BASE_URL
fetch(BASE_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data)
})
.then(r => r.json())
.then(res => console.log(res))
.catch(err => console.error(err));


// ========================================
// BUSCAR CSRF TOKEN
// ========================================
fetch(BASE_URL + "?action=csrf")
  .then(r => r.json())
  .then(data => {
    document.getElementById("csrfToken").value = data.token;
  });


// ========================================
// UTILITÁRIOS
// ========================================
function cleanNumber(val) { return val ? String(val).replace(/\D/g,'') : ''; }
function normalizeName(name) { return String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ç/g,'c').trim(); }
function isValidCpf(cpf) {
  cpf = cleanNumber(cpf);
  if(cpf.length!==11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum=0, rem;
  for(let i=1;i<=9;i++) sum+=parseInt(cpf[i-1],10)*(11-i);
  rem=(sum*10)%11; if(rem===10||rem===11) rem=0;
  if(rem!==parseInt(cpf[9],10)) return false;
  sum=0;
  for(let i=1;i<=10;i++) sum+=parseInt(cpf[i-1],10)*(12-i);
  rem=(sum*10)%11; if(rem===10||rem===11) rem=0;
  if(rem!==parseInt(cpf[10],10)) return false;
  return true;
}
function maskCpf(val) { val=cleanNumber(val).substring(0,11); const p=val.match(/^(\d{3})(\d{3})(\d{3})(\d{2})?$/); return p ? `${p[1]}.${p[2]}.${p[3]}${p[4]?'-'+p[4]:''}` : val; }
function maskTelefone(val) { val=cleanNumber(val).substring(0,11); return val.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3'); }
function maskCep(val) { val=cleanNumber(val).substring(0,8); const p=val.match(/^(\d{5})(\d{3})?$/); return p ? `${p[1]}${p[2]?'-'+p[2]:''}` : val; }

// ---------- Getter CSRF seguro (DOM -> optional fetch fallback) ----------
function getCSRFToken() {
  // 1) tenta pegar do DOM
  const el = document.getElementById('csrfToken');
  if (el && el.value) return el.value;

  // 2) fallback: tenta buscar token do endpoint GET /getCsrf (opcional — implemente no GAS se quiser suportar)
  // NOTA: esse fetch é opcional; se não tiver endpoint, ele falhará silenciosamente e retornará ''
  // isso não altera o fluxo atual, apenas melhora compatibilidade com GitHub Pages.
  try {
    // fetch de forma sincrona NÃO existe; então retornamos promise quando precisar ou usamos fetch de forma assíncrona.
    // Para manter API simples, aqui retornamos empty string e oferecemos função async getCsrfTokenAsync quando necessário.
    return '';
  } catch (e) {
    return '';
  }
}
async function getCSRFTokenAsync() {
  // 1) se existir no DOM (quando HTML é servido pelo GAS)
  const el = document.getElementById('csrfToken');
  if (el && el.value) return el.value;

  // 2) GitHub Pages → buscar do endpoint GAS
  try {
    const resp = await fetch(`${BASE_URL}?mode=csrf`);
    if (!resp.ok) return '';
    const j = await resp.json();
    return j && j.csrfToken ? j.csrfToken : '';
  } catch (e) {
    console.error("Erro ao obter CSRF:", e);
    return '';
  }
}


// ---------- Feedback helper ----------
function showFeedback(input, msg) {
  if (!input) return;
  const fb = document.getElementById(input.id + '-feedback') || input.closest('[data-group]') && input.closest('[data-group]').querySelector('[data-feedback]');
  if (fb) fb.textContent = msg || '';
  input.classList.toggle('input-error', !!msg);
}

// ---------- Verificação titular (segura contra nulls) ----------
function checkTitularFormValidity() {
  const nome = document.getElementById('nome');
  const cpf  = document.getElementById('cpf');
  const tel  = document.getElementById('telefone');
  const cep  = document.getElementById('cep');
  const btn  = document.getElementById('btnSalvar');

  if (!nome || !cpf || !tel || !cep) {
    if (btn) btn.disabled = true;
    return false;
  }

  let valid = true;
  if ((nome.value || '').trim().length < 5) valid = false;
  if (!isValidCpf(cpf.value)) valid = false;
  if (cleanNumber(tel.value).length !== 11) valid = false;
  if (cleanNumber(cep.value).length !== 8) valid = false;
  if (btn) btn.disabled = !valid;
  return valid;
}

// ---------- Dependentes ----------
function checkDependenteFormValidity() {
  const deps = document.querySelectorAll('#dependentesList .dependente-template');
  let valid = true;
  deps.forEach((d, i) => {
    const n = d.querySelector('[data-key="nome-dependente"]');
    if (n && (n.value || '').trim().length < 5) valid = false;
    // atualiza número visual
    const header = d.querySelector('.dependente-numero');
    if (header) header.textContent = String(i+1);
  });
  const btn = document.getElementById('btnSalvarDependentes');
  if (btn) {
    btn.disabled = !valid;
    btn.classList.toggle('hidden', deps.length === 0);
  }
  return valid;
}

function addDependente() {
  dependenteIndex++;
  const tpl = document.getElementById('dependenteTemplate');
  if (!tpl) return;

  // clone do template
  const frag = tpl.content.cloneNode(true);

  // substitui [IDX] em ids/names/for apenas onde existir
  frag.querySelectorAll('[id]').forEach(el => {
    if (el.id && el.id.includes('[IDX]')) el.id = el.id.replace(/\[IDX\]/g, String(dependenteIndex));
    else {
      // remove ID duplicado para evitar conflito
      el.removeAttribute('id');
    }
  });
  frag.querySelectorAll('[name]').forEach(el => {
    if (el.name && el.name.includes('[IDX]')) el.name = el.name.replace(/\[IDX\]/g, String(dependenteIndex));
  });
  // também substituir placeholders dentro do texto (h2 .dependente-numero)
  frag.querySelectorAll('*').forEach(el => {
    if (el.childNodes && el.childNodes.length) {
      el.childNodes.forEach((node) => {
        if (node.nodeType === 3 && node.nodeValue && node.nodeValue.includes('[IDX]')) {
          node.nodeValue = node.nodeValue.replace(/\[IDX\]/g, String(dependenteIndex));
        }
      });
    }
  });

  const group = frag.querySelector('.dependente-template');
  if (!group) return;

  // Anexa ao DOM
  const list = document.getElementById('dependentesList');
  list.insertBefore(group, document.getElementById('btnSalvarDependentes'));

  // wiring eventos localmente, sempre usando querySelector no group
  const btnRem = group.querySelector('.btn-remover-dependente');
  if (btnRem) btnRem.addEventListener('click', () => { group.remove(); checkDependenteFormValidity(); });

  const nomeInput = group.querySelector('[data-key="nome-dependente"]');
  if (nomeInput) {
    nomeInput.addEventListener('input', () => {
      // limpa feedback dinamicamente ao digitar
      if ((nomeInput.value || '').trim().length >= 5) showFeedback(nomeInput, '');
      checkDependenteFormValidity();
    });
    nomeInput.addEventListener('blur', () => {
      const ok = (nomeInput.value || '').trim().length >= 5;
      showFeedback(nomeInput, ok ? '' : 'Nome deve ter min 5 caracteres');
      checkDependenteFormValidity();
    });
  }

  checkDependenteFormValidity();
}

// ---------- Coleta de dados (segura) ----------
function collectAllFormData() {
  const titular = {};
  document.querySelectorAll('#cadastroForm [data-key]').forEach(el => {
    if (!el) return;
    const k = el.dataset.key;
    // evita colocar undefined e protege .value
    titular[k] = (el.value !== undefined && el.value !== null) ? el.value : '';
  });

  titular.cpf = cleanNumber(titular.cpf);
  titular.telefone = cleanNumber(titular.telefone);
  titular.cep = cleanNumber(titular.cep);
  titular.nome_index = normalizeName(titular.nome);

  const dependentes = [];
  document.querySelectorAll('#dependentesList .dependente-template').forEach(group => {
    const nEl = group.querySelector('[data-key="nome-dependente"]');
    const nome = nEl ? (nEl.value || '').trim() : '';
    if (!nome) return; // pula se não tiver nome (segurança)
    dependentes.push({
      tipo: 'Dependente',
      nome: nome,
      nome_index: normalizeName(nome),
      cpf: '', telefone: '', cep: ''
    });
  });

  return { csrfToken: getCSRFToken(), titular, dependentes };
}

// ---------- Proteção contra double submit ----------
function lockSubmit(timeout = 1500) {
  if (lockSubmit.locked) return false;
  lockSubmit.locked = true;
  setTimeout(()=> { lockSubmit.locked = false; }, timeout);
  return true;
}

// ---------- Envio via fetch (GAS WebApp) ----------
function submitAllData(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!lockSubmit()) return; // evita calls simultâneas

  // desabilita imediatamente
  const btnSalvar = document.getElementById('btnSalvar');
  if (btnSalvar) btnSalvar.disabled = true;
  const btnDep = document.getElementById('btnSalvarDependentes');
  if (btnDep) btnDep.disabled = true;
  const loading = document.getElementById('loading-message');
  if (loading) loading.classList.remove('hidden');

  // validações locais
  if (!checkTitularFormValidity()) {
    alert('Corrija dados do titular.');
    if (btnSalvar) btnSalvar.disabled = false;
    if (btnDep) btnDep.disabled = false;
    if (loading) loading.classList.add('hidden');
    return;
  }
  if (!checkDependenteFormValidity()) {
    alert('Corrija dados dos dependentes.');
    if (btnSalvar) btnSalvar.disabled = false;
    if (btnDep) btnDep.disabled = false;
    if (loading) loading.classList.add('hidden');
    return;
  }

  const data = collectAllFormData();

  // fetch para endpoint GAS (substitua pela sua URL deploy)
  const GAS_URL = BASE_URL;

  fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    mode: 'cors'
  })
  .then(r => r.json())
  .then(res => {
    if (loading) loading.classList.add('hidden');
    if (res && res.status === 'sucesso') {
      const form = document.getElementById('cadastroForm');
      const depContainer = document.getElementById('dependentesContainer');
      if (form) form.classList.add('hidden');
      if (depContainer) depContainer.classList.add('hidden');
      const done = document.querySelector('.cadastro-concluido');
      if (done) done.classList.remove('hidden');
    } else if (res && res.status === 'erro' && String(res.message).toLowerCase().includes('cpf')) {
      const cpfEl = document.getElementById('cpf');
      if (cpfEl) showFeedback(cpfEl, res.message);
      if (btnSalvar) btnSalvar.disabled = false;
      if (btnDep) btnDep.disabled = false;
    } else {
      alert('Erro: ' + (res && res.message ? res.message : 'Resposta inesperada'));
      if (btnSalvar) btnSalvar.disabled = false;
      if (btnDep) btnDep.disabled = false;
    }
  })
  .catch(err => {
    alert('Erro servidor: ' + err);
    if (btnSalvar) btnSalvar.disabled = false;
    if (btnDep) btnDep.disabled = false;
    if (loading) loading.classList.add('hidden');
  });
}

// ---------- Inicialização ----------
document.addEventListener('DOMContentLoaded', () => {
  const nome = document.getElementById('nome');
  const cpf  = document.getElementById('cpf');
  const tel  = document.getElementById('telefone');
  const cep  = document.getElementById('cep');
  const btnSalvar = document.getElementById('btnSalvar');

  if (nome) nome.addEventListener('input', () => { checkTitularFormValidity(); });
  if (cpf) {
    cpf.addEventListener('input', e => {
      e.target.value = maskCpf(e.target.value);
      // limpa feedback assim que CPF estiver válido
      if (isValidCpf(e.target.value)) showFeedback(e.target, '');
      checkTitularFormValidity();
    });
    cpf.addEventListener('blur', e => {
      if (!isValidCpf(e.target.value)) showFeedback(e.target, 'CPF inválido');
      else showFeedback(e.target, '');
    });
  }
  if (tel) {
    tel.addEventListener('input', e => { e.target.value = maskTelefone(e.target.value); checkTitularFormValidity(); });
    tel.addEventListener('blur', checkTitularFormValidity);
  }
  if (cep) {
    cep.addEventListener('input', e => { e.target.value = maskCep(e.target.value); checkTitularFormValidity(); });
    cep.addEventListener('blur', checkTitularFormValidity);
  }

  if (btnSalvar) btnSalvar.addEventListener('click', submitAllData);
  const addDep = document.getElementById('btnAddDependente');
  if (addDep) addDep.addEventListener('click', addDependente);
  const done = document.getElementById('btn-cadastro-concluido');
  if (done) done.addEventListener('click', submitAllData);
  const btnDep = document.getElementById('btnSalvarDependentes');
  if (btnDep) btnDep.addEventListener('click', submitAllData);
});
