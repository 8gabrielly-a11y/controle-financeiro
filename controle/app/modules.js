/* Navigation changes visibility only; financial data and forms stay mounted. */
(()=>{'use strict';
 const modules={overview:{title:'Visão geral',panels:[]},money:{title:'Meu dinheiro',panels:['settings-money']},bills:{title:'Contas e pagamentos',panels:['settings-bills','settings-payments']},cards:{title:'Cartões e faturas',panels:['settings-cards']},goals:{title:'Cofrinhos',panels:['settings-goals']},simulations:{title:'Simulações',panels:['settings-income-simulation','settings-purchase','settings-loan']}};
 const buttons=[...document.querySelectorAll('[data-module]')];
 const panels=[...document.querySelectorAll('#plan > .card')].filter(x=>x.id!=='syncNotice');let current='overview';
 function select(name){
  if(name===undefined)return;
  for(const button of buttons){if(button.dataset.module===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')}
  if(name&&modules[name])current=name;
 }
 function open(name){
  const module=modules[name];if(!module)return;
  window.financeShow(name==='overview'?'home':'plan');select(name);
  for(const panel of panels){panel.classList.add('module-page');panel.hidden=!module.panels.includes(panel.id)}
  document.getElementById('heading').textContent=module.title;
  if(name==='simulations'){const simulation=document.getElementById('incomeSimulationPanel');if(simulation)simulation.open=true}
  window.scrollTo({top:0,behavior:'instant'});
 }
 window.financeSetModule=select;window.financeOpenModule=open;
 for(const button of buttons)button.onclick=()=>open(button.dataset.module);
 document.getElementById('navPlan').onclick=()=>open(current==='overview'?'money':current);
 open('overview');
})();
