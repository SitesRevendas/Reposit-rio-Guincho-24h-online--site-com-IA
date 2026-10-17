/* Guincho 24h Online: formulários que montam a mensagem do WhatsApp. Todo texto exibido já está no HTML. */
(function () {
  'use strict';
  document.querySelectorAll('form.wa-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = null;
      f.querySelectorAll('[required]').forEach(function (el) {
        var ok = el.type === 'checkbox' ? el.checked : el.value.trim().length > 1;
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
      window.open('https://wa.me/5561993801454?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
      var st = f.querySelector('.form-status');
      if (st) st.hidden = false;
    });
  });
})();
