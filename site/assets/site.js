/* Guincho 24h Online: formulários que montam a mensagem do WhatsApp. Todo texto exibido já está no HTML. */
(function () {
  'use strict';
  var inicio = Date.now();
  /* Cópia do pedido para a central (e-mail e planilha), mesmo que a pessoa não envie a mensagem no WhatsApp */
  function copia(f) {
    var d = { gatilho: 'formulario', pagina: location.pathname, titulo: document.title, servico: document.title.split(' | ')[0],
              tempo: Math.round((Date.now() - inicio) / 1000), lgpd: 'on', site: '' };
    var cod = /\[(T\d\d-[A-Z0-9]+)\]/.exec(f.dataset.intro || '');
    if (cod) d.codigo = cod[1];
    d.tipo = /parceiro/.test(f.dataset.intro || '') ? 'parceiro' : 'cliente';
    var eq = [];
    f.querySelectorAll('input[name], select[name], textarea[name]').forEach(function (el) {
      if (el.type === 'checkbox') { if (el.name === 'equipamento[]' && el.checked) eq.push(el.value); return; }
      var k = el.name === 'servico' ? 'atendimento' : el.name;
      if (el.value.trim()) d[k] = el.value.trim();
    });
    if (eq.length) d.equipamento = eq.join(', ');
    try { fetch('/api/lead', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); } catch (e) { /* sem rede: o WhatsApp segue abrindo */ }
  }
  document.querySelectorAll('form.wa-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = null;
      f.querySelectorAll('[required]').forEach(function (el) {
        var ok = el.type === 'checkbox' ? el.checked : el.type === 'tel' ? el.value.replace(/\D/g, '').length >= 10 : el.value.trim().length > 1;
        var err = document.getElementById(el.getAttribute('aria-describedby'));
        if (err) err.hidden = ok;
        if (ok) { el.removeAttribute('aria-invalid'); } else { el.setAttribute('aria-invalid', 'true'); if (!first) first = el; }
      });
      if (first) { first.focus(); return; }
      var lines = [f.dataset.intro || 'Olá!'];
      f.querySelectorAll('[data-wa]').forEach(function (el) { if (el.value.trim()) lines.push(el.dataset.wa + ': ' + el.value.trim()); });
      var groups = {};
      f.querySelectorAll('[data-wa-group]:checked').forEach(function (el) { (groups[el.dataset.waGroup] = groups[el.dataset.waGroup] || []).push(el.value); });
      Object.keys(groups).forEach(function (g) { lines.push(g + ': ' + groups[g].join(', ')); });
      copia(f);
      window.open('https://wa.me/5561993801454?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
      var st = f.querySelector('.form-status');
      if (st) st.hidden = false;
    });
  });
})();

/* Pop-ups de captação: saída, rolagem e parada. Regras em docs/13-pop-ups-de-captacao.md */
(function () {
  'use strict';
  var dlg = document.getElementById('lp');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  var form = dlg.querySelector('form'), nudge = document.getElementById('lp-nudge'), tab = document.getElementById('lp-tab');
  var tipo = dlg.dataset.tipo, inicio = Date.now(), abriu = 0, nudgeVisto = false, ultimaAcao = Date.now();
  var q = new URLSearchParams(location.search).get('popup');
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function n(k) { return parseInt(ss(k) || '0', 10); }
  function enviado() { var t = parseInt(ls('lp_enviado') || '0', 10); return t && Date.now() - t < 2592e6; }
  function ocupado() {
    var a = document.activeElement;
    return dlg.open || (a && a.closest && a.closest('form') && a.closest('form') !== form);
  }
  function pode(modal) {
    if (dlg.open) return false;
    if (q) return modal ? abriu === 0 : !nudgeVisto && !abriu;
    if (enviado() || ss('lp_contatou') || ocupado() || Date.now() - inicio < 6000) return false;
    if (modal) return abriu === 0 && n('lp_modais') < 2 && Date.now() - n('lp_ultimo') > 60000;
    return !nudgeVisto && !abriu && n('lp_nudges') < 3;
  }
  function etapa(s) {
    dlg.querySelectorAll('[data-step]').forEach(function (el) { el.hidden = el.dataset.step !== String(s); });
    dlg.querySelectorAll('[data-s]').forEach(function (el) { el.hidden = el.dataset.s !== String(s); });
    dlg.querySelector('.lp-bar span').style.width = s === 1 ? '50%' : '100%';
  }
  function abrir(g, origem) {
    if (dlg.open) return;
    dlg.querySelectorAll('[data-g]').forEach(function (el) { el.hidden = el.dataset.g !== g; });
    dlg.setAttribute('aria-labelledby', 'lp-h-' + g);
    form.elements.gatilho.value = origem || g;
    etapa(1);
    esconderNudge();
    tab.hidden = true;
    dlg.showModal();
    abriu++;
    if (!origem) { ss('lp_modais', n('lp_modais') + 1); ss('lp_ultimo', String(Date.now())); }
  }
  function esconderNudge() { nudge.hidden = true; nudge.removeAttribute('data-on'); }
  function fechar() { if (dlg.open) dlg.close(); if (!enviado()) tab.hidden = false; }
  dlg.addEventListener('close', fechar);
  dlg.addEventListener('cancel', function () { setTimeout(fechar, 0); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) fechar(); });
  dlg.querySelector('[data-lp-close]').addEventListener('click', fechar);
  nudge.querySelector('[data-nudge-close]').addEventListener('click', function () { esconderNudge(); tab.hidden = false; });
  tab.addEventListener('click', function () { abrir('saida', 'botao'); });
  nudge.querySelectorAll('.lp-nudge-opt').forEach(function (b) {
    b.addEventListener('click', function () {
      var nome = b.dataset.situacao ? 'situacao' : 'interesse';
      var v = b.dataset.situacao || b.dataset.interesse;
      form.querySelectorAll('[name="' + nome + '"]').forEach(function (r) { r.checked = r.value === v; });
      abrir('rolagem');
    });
  });

  function validar(box) {
    var first = null, grupos = {};
    box.querySelectorAll('[required]').forEach(function (el) {
      var ok;
      if (el.type === 'radio') { if (grupos[el.name]) return; grupos[el.name] = 1; ok = !!box.querySelector('[name="' + el.name + '"]:checked'); }
      else if (el.type === 'checkbox') ok = el.checked;
      else if (el.type === 'tel') ok = el.value.replace(/\D/g, '').length >= 10;
      else ok = el.value.trim().length > 1;
      var err = document.getElementById(el.getAttribute('aria-describedby'));
      if (err) err.hidden = ok;
      if (ok) el.removeAttribute('aria-invalid'); else { el.setAttribute('aria-invalid', 'true'); if (!first) first = el; }
    });
    if (first) first.focus();
    return !first;
  }
  dlg.querySelector('.lp-next').addEventListener('click', function () {
    if (validar(dlg.querySelector('[data-step="1"]'))) { etapa(2); var f = dlg.querySelector('[data-step="2"] input:not([type=hidden])'); if (f) f.focus(); }
  });
  dlg.querySelector('.lp-back').addEventListener('click', function () { etapa(1); });
  var tel = form.elements.whatsapp;
  tel.addEventListener('input', function () {
    var d = tel.value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11), o = d;
    if (d.length > 2) o = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 7) o = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length - 4) + '-' + d.slice(-4);
    tel.value = o;
  });

  function status(k) { form.querySelectorAll('[data-lp]').forEach(function (p) { p.hidden = p.dataset.lp !== k; }); }
  function mensagem(dados) {
    var linhas = [tipo === 'parceiro' ? 'Olá! Quero cadastrar meu guincho como parceiro.' : 'Olá! Preciso de guincho.'];
    if (dados.codigo) linhas[0] += ' [' + dados.codigo + ']';
    [['situacao', 'Situação'], ['interesse', 'Interesse'], ['veiculo', 'Veículo'], ['equipamento', 'Equipamento'], ['local', 'Onde está o veículo'],
     ['destino', 'Destino'], ['cidade', 'Cidade da base'], ['nome', 'Nome']].forEach(function (p) { if (dados[p[0]]) linhas.push(p[1] + ': ' + dados[p[0]]); });
    return linhas.join('\n');
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validar(dlg.querySelector('[data-step="2"]'))) return;
    var dados = {};
    new FormData(form).forEach(function (v, k) { dados[k] = String(v).trim(); });
    dados.titulo = document.title;
    dados.tempo = Math.round((Date.now() - inicio) / 1000);
    var wa = 'https://wa.me/5561993801454?text=' + encodeURIComponent(mensagem(dados));
    form.querySelector('.lp-wa').href = wa;
    var btn = form.querySelector('.lp-submit');
    btn.disabled = true; status('enviando');
    fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error('falha'); }); })
      .then(function () {
        status('ok');
        ls('lp_enviado', String(Date.now()));
        ss('lp_lead', JSON.stringify({ tipo: tipo, wa: wa }));
        if (window.dataLayer) window.dataLayer.push({ event: 'lead_popup', gatilho: dados.gatilho, codigo: dados.codigo, pagina: dados.pagina });
        location.href = '/obrigado/' + (tipo === 'parceiro' ? '?tipo=parceiro' : '');
      })
      .catch(function () { btn.disabled = false; status('erro'); });
  });

  /* Quem já chamou no WhatsApp ou ligou nesta visita não recebe pop-up automático */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="https://wa.me"], a[href^="tel:"]');
    if (a && !a.classList.contains('lp-wa')) ss('lp_contatou', '1');
  });

  /* Gatilho de saída: no computador, o mouse sai pelo topo; no celular, rolagem rápida para cima depois de ler metade da página */
  document.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget && e.clientY <= 0 && pode(true)) abrir('saida');
  });
  var ultimoY = window.scrollY, ultimoT = Date.now(), fundo = 0;
  function profundidade() { var h = document.documentElement.scrollHeight - innerHeight; return h > 0 ? window.scrollY / h : 1; }
  window.addEventListener('scroll', function () {
    var y = window.scrollY, t = Date.now(), p = profundidade();
    fundo = Math.max(fundo, p);
    if (matchMedia('(pointer: coarse)').matches && fundo > 0.5 && ultimoY - y > 140 && t - ultimoT < 350 && pode(true)) abrir('saida');
    /* Gatilho de rolagem: aviso pequeno no canto ao passar de 55% da página */
    if (p > 0.55 && pode(false)) {
      nudgeVisto = true; ss('lp_nudges', n('lp_nudges') + 1);
      nudge.hidden = false; requestAnimationFrame(function () { nudge.setAttribute('data-on', ''); });
    }
    if (t - ultimoT > 120) { ultimoY = y; ultimoT = t; }
  }, { passive: true });

  /* Gatilho de parada: 25 segundos sem rolar, tocar, mover o mouse ou digitar, depois de 15 segundos na página */
  ['scroll', 'mousemove', 'keydown', 'touchstart', 'pointerdown'].forEach(function (ev) {
    window.addEventListener(ev, function () { ultimaAcao = Date.now(); }, { passive: true });
  });
  setInterval(function () {
    if (Date.now() - ultimaAcao > 25000 && Date.now() - inicio > 15000 && document.visibilityState === 'visible' && pode(true)) abrir('parada');
  }, 2000);

  if (q === 'saida' || q === 'parada' || q === 'rolagem') setTimeout(function () { abrir(q); }, 300);
  if (q === 'aviso') setTimeout(function () { nudge.hidden = false; nudge.setAttribute('data-on', ''); }, 300);
})();

(function () {
  'use strict';
  var box = document.getElementById('obrigado');
  if (!box) return;
  var lead = null;
  try { lead = JSON.parse(sessionStorage.getItem('lp_lead') || 'null'); } catch (e) { lead = null; }
  var parceiro = /tipo=parceiro/.test(location.search) || (lead && lead.tipo === 'parceiro');
  box.querySelectorAll('[data-ob]').forEach(function (el) { el.hidden = el.dataset.ob !== (parceiro ? 'parceiro' : 'cliente'); });
  if (lead && lead.wa) box.querySelectorAll('.ob-wa').forEach(function (a) { a.href = lead.wa; });
})();
