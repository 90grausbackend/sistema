// Variáveis globais
let dependenteIndex = 0;

// Utilitários
function cleanNumber(val){ return val ? val.replace(/\D/g,'') : ''; }
function normalizeName(name){ return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ç/g,'c').trim(); }
function isValidCpf(cpf){
  cpf = cleanNumber(cpf);
  if(cpf.length!==11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum=0, rem;
  for(let i=1;i<=9;i++) sum+=parseInt(cpf[i-1])*(11-i);
  rem=(sum*10)%11; if(rem===10||rem===11) rem=0;
  if(rem!==parseInt(cpf[9])) return false;
  sum=0;
  for(let i=1;i<=10;i++) sum+=parseInt(cpf[i-1])*(12-i);
  rem=(sum*10)%11; if(rem===10||rem===11) rem=0;
  if(rem!==parseInt(cpf[10])) return false;
  return true;
}
function maskCpf(val){ val=cleanNumber(val).substring(0,11); const p=val.match(/^(\d{3})(\d{3})(\d{3})(\d{2})?$/); return p ? `${p[1]}.${p[2]}.${p[3]}${p[4]?'-'+p[4]:''}` : val; }
function maskTelefone(val){ val=cleanNumber(val).substring(0,11); return val.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3'); }
function maskCep(val){ val=cleanNumber(val).substring(0,8); const p=val.match(/^(\d{5})(\d{3})?$/); return p ? `${p[1]}${p[2]?'-'+p[2]:''}` : val; }

// Getter seguro para CSRF
function getCSRFToken(){
  const el=document.getElementById('csrfToken');
  return el ? el.value : '';
}

// Feedback
function showFeedback(input,msg){ const fb=document.getElementById(input.id+'-feedback'); if(fb) fb.textContent=msg; input.classList.toggle('input-error',!!msg); }

// Verificação de titular
function checkTitularFormValidity(){
  const nome=document.getElementById('nome'), cpf=document.getElementById('cpf'), tel=document.getElementById('telefone'), cep=document.getElementById('cep'), btn=document.getElementById('btnSalvar');
  let valid=true;
  if(nome.value.trim().length<5) valid=false;
  if(!isValidCpf(cpf.value)) valid=false;
  if(cleanNumber(tel.value).length!==11) valid=false;
  if(cleanNumber(cep.value).length!==8) valid=false;
  if(btn) btn.disabled=!valid;
  return valid;
}

// Dependentes
function checkDependenteFormValidity(){
  const deps=document.querySelectorAll('#dependentesList .dependente-template');
  let valid=true;
  deps.forEach((d,i)=>{
    const n=d.querySelector('[data-key="nome-dependente"]');
    if(n && n.value.trim().length<5) valid=false;
    const header=d.querySelector('.dependente-numero');
    if(header) header.textContent=i+1;
  });
  const btn=document.getElementById('btnSalvarDependentes');
  if(btn){ btn.disabled=!valid; btn.classList.toggle('hidden', deps.length===0); }
  return valid;
}
function addDependente(){
  dependenteIndex++;
  const tpl=document.getElementById('dependenteTemplate').content.cloneNode(true);
  tpl.querySelectorAll('[id],[name]').forEach(el=>{
    if(el.id) el.id=el.id.replace(/

\[IDX\]

/g,dependenteIndex);
    if(el.name) el.name=el.name.replace(/

\[IDX\]

/g,dependenteIndex);
  });
  const group=tpl.querySelector('.dependente-template');
  document.getElementById('dependentesList').appendChild(group);
  const btnRem=group.querySelector('.btn-remover-dependente');
  btnRem.addEventListener('click',()=>{ group.remove(); checkDependenteFormValidity(); });
  const nomeInput=group.querySelector('[data-key="nome-dependente"]');
  nomeInput.addEventListener('blur', e=>{ showFeedback(e.target, e.target.value.trim().length<5?'Nome deve ter min 5 caracteres':''); checkDependenteFormValidity(); });
  nomeInput.addEventListener('input', checkDependenteFormValidity);
  checkDependenteFormValidity();
}

// Coleta dados
function collectAllFormData(){
  const titular={};
  document.querySelectorAll('#cadastroForm [data-key]').forEach(i=>{ titular[i.dataset.key]=i.value; });
  titular.cpf=cleanNumber(titular.cpf); titular.telefone=cleanNumber(titular.telefone); titular.cep=cleanNumber(titular.cep);
  titular.nome_index=normalizeName(titular.nome);
  const dependentes=[];
  document.querySelectorAll('#dependentesList .dependente-template').forEach(d=>{
    const dep={ tipo:'Dependente' };
    const n=d.querySelector('[data-key="nome-dependente"]').value;
    dep.nome=n; dep.nome_index=normalizeName(n);
    dep.cpf=''; dep.telefone=''; dep.cep='';
    dependentes.push(dep);
  });
  return { csrfToken:getCSRFToken(), titular: titular, dependentes: dependentes };
}

// Envio via fetch para GAS
function submitAllData(e){
  if(e) e.preventDefault();
  document.getElementById('btnSalvar').disabled=true; // desabilita imediatamente
  if(!checkTitularFormValidity()){ alert('Corrija dados do titular.'); document.getElementById('btnSalvar').disabled=false; return; }
  if(!checkDependenteFormValidity()){ alert('Corrija dados dos dependentes.'); document.getElementById('btnSalvar').disabled=false; return; }

  const data=collectAllFormData();
  document.getElementById('loading-message').classList.remove('hidden');
  const btnDep=document.getElementById('btnSalvarDependentes'); if(btnDep) btnDep.disabled=true;

  fetch("https://script.google.com/macros/s/SEU_DEPLOY_ID/exec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  .then(r=>r.json())
  .then(res=>{
    document.getElementById('loading-message').classList.add('hidden');
    if(res.status==='sucesso'){
      document.getElementById('cadastroForm').classList.add('hidden');
      document.getElementById('dependentesContainer').classList.add('hidden');
      document.querySelector('.cadastro-concluido').classList.remove('hidden');
    } else if(res.status==='erro' && res.message.includes('CPF')){
      showFeedback(document.getElementById('cpf'), res.message);
      document.getElementById('btnSalvar').disabled=false; if(btnDep) btnDep.disabled=false;
    } else {
      alert('Erro: '+res.message);
      document.getElementById('btnSalvar').disabled=false; if(btnDep) btnDep.disabled=false;
    }
  })
  .catch(err=>{
    alert('Erro servidor: '+err);
    document.getElementById('btnSalvar').disabled=false; if(btnDep) btnDep.disabled=false;
  });
}

// Inicialização
document.addEventListener('DOMContentLoaded',()=>{
  const nome=document.getElementById('nome'), cpf=document.getElementById('cpf'), tel=document.getElementById('telefone'), cep=document.getElementById('cep');
  const btnSalvar=document.getElementById('btnSalvar');

  nome.addEventListener('input', checkTitularFormValidity);
  cpf.addEventListener('input', e=>{ e.target.value=maskCpf(e.target.value); checkTitularFormValidity(); });
  tel.addEventListener('input', e=>{ e.target.value=maskTelefone(e.target.value); checkTitularFormValidity(); });
  cep.addEventListener('input', e=>{ e.target.value=maskCep(e.target.value); checkTitularFormValidity(); });

  nome.addEventListener('blur', checkTitularFormValidity);
  cpf.addEventListener('blur', e=>{ if(!isValidCpf(e.target.value)) showFeedback(e.target,'CPF inválido'); else showFeedback(e.target,''); });
  tel.addEventListener('blur', checkTitularFormValidity);
  cep.addEventListener('blur', checkTitularFormValidity);

  btnSalvar.addEventListener('click', submitAllData);
  document.getElementById('btnAddDependente').addEventListener('click', addDependente);
  document.getElementById('btn-cadastro-concluido').addEventListener('click', submitAllData);
  const btnDep=document.getElementById('btnSalvarDependentes'); if(btnDep) btnDep.addEventListener('click', submitAllData