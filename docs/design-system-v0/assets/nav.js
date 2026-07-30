/* Barra lateral compartilhada das folhas do sistema.
   Injetada em cada lote para nao duplicar markup entre 10 arquivos. */
(function () {
  var LOTES = [
    ['00', 'Visão geral',          'index.html'],
    ['01', 'Fundamentos',          '01-fundamentos.html'],
    ['02', 'O orbe e a marca',     '02-marca-orbe.html'],
    ['03', 'Os 16 primitivos',     '03-componentes-base.html'],
    ['04', 'A conversa',           '04-conversa.html'],
    ['05', 'O canvas',             '05-canvas.html'],
    ['06', 'Shell e navegação',    '06-shell-navegacao.html'],
    ['07', 'As telas',             '07-telas.html'],
    ['08', 'A auditoria',          '08-auditoria.html'],
    ['09', 'Estados transversais', '09-estados-transversais.html']
  ];

  var here = (location.pathname.split('/').pop() || 'index.html');

  var nav = document.createElement('nav');
  nav.className = 'doc-nav';
  nav.setAttribute('data-od-id', 'doc-nav');
  nav.setAttribute('aria-label', 'Lotes do sistema de design');

  var brand = document.createElement('a');
  brand.className = 'doc-nav__brand';
  brand.href = 'index.html';
  brand.style.color = 'var(--foreground)';
  brand.style.textDecoration = 'none';
  brand.innerHTML =
    '<span class="orb orb--sm" aria-hidden="true"></span>' +
    '<strong>Nexo</strong>' +
    '<span class="mono-label dim" style="margin-left:auto">DS</span>';
  nav.appendChild(brand);

  LOTES.forEach(function (l) {
    var a = document.createElement('a');
    a.href = l[2];
    a.innerHTML = '<span class="n">' + l[0] + '</span><span>' + l[1] + '</span>';
    if (l[2] === here) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  });

  var foot = document.createElement('div');
  foot.className = 'doc-nav__foot';
  foot.textContent = 'NEXO · v0 · pt-BR';
  nav.appendChild(foot);

  var host = document.querySelector('.doc');
  if (host) host.insertBefore(nav, host.firstChild);
})();
