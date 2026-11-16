/* ==========================================================
   Inicialização, busca global, menu rápido, lembretes
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U;

  App.load();
  App.applyTheme();
  App.bindView();
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => App.state.settings.theme === 'auto' && App.applyTheme());
  window.addEventListener('hashchange', App.rerender);
  App.rerender();
  App.Inv.snapshot();

  /* privacidade */
  document.getElementById('privacy-btn').onclick = () => { App.state.settings.privacy = !App.state.settings.privacy; App.save(); App.applyTheme(); };

  /* ---------- busca global ---------- */
  const inp = document.getElementById('gsearch'), box = document.getElementById('gresults');
  const search = (q) => {
    const n = U.norm(q); if (n.length < 2) return [];
    const s = App.state, out = [];
    const has = (...xs) => U.norm(xs.join(' ')).includes(n);
    s.transactions.filter((t) => has(t.desc, t.notes, t.value)).slice(0, 8).forEach((t) => out.push({ i: App.Fin.cat(t.categoryId).icon, t: t.desc, s: `${U.dateBR(t.date)} · ${U.moneyTxt(t.value)}`, go: 'financas/gastos', q: t.desc }));
    s.installments.filter((i) => has(i.desc)).forEach((i) => out.push({ i: '🔁', t: i.desc, s: `parcelamento ${i.count}x ${U.moneyTxt(i.parcel)}`, go: 'financas/parcelas' }));
    s.events.filter((e) => has(e.title, e.notes)).slice(0, 6).forEach((e) => out.push({ i: App.Agenda.type(e.type).icon, t: e.title, s: U.dateBR(e.date), go: 'agenda' }));
    s.materials.filter((m) => has(m.name)).slice(0, 6).forEach((m) => out.push({ i: '📄', t: m.name, s: 'material de estudo', file: m.fileId }));
    s.subjects.filter((x) => has(x.name, x.notes)).forEach((x) => out.push({ i: '📚', t: x.name, s: 'matéria', go: 'estudos/materias' }));
    s.concursos.filter((c) => has(c.name, c.banca, c.cargo)).forEach((c) => out.push({ i: '📝', t: c.name, s: 'concurso', go: 'estudos/concursos' }));
    s.plan.forEach((p) => p.items.filter((x) => has(x.name)).forEach((x) => out.push({ i: '🏋️', t: x.name, s: `treino de ${U.DAYS[p.day]}`, go: 'fitness/treino' })));
    s.fiis.filter((f) => has(f.ticker)).forEach((f) => out.push({ i: '🏢', t: f.ticker, s: `${f.qty} cotas`, go: 'investimentos/fiis' }));
    return out.slice(0, 25);
  };
  let results = [];
  inp.addEventListener('input', () => {
    results = search(inp.value);
    box.innerHTML = results.length ? results.map((r, k) => `<a href="#" data-k="${k}"><span>${r.i}</span><span>${U.esc(r.t)}</span><small>${U.esc(r.s)}</small></a>`).join('') : (inp.value.length > 1 ? '<a><span class="muted">Nada encontrado</span></a>' : '');
    box.classList.toggle('open', inp.value.length > 1);
  });
  box.addEventListener('mousedown', (e) => {
    const a = e.target.closest('[data-k]'); if (!a) return; e.preventDefault();
    const r = results[+a.dataset.k];
    if (r.file) App.files.open(r.file); else App.go(r.go);
    box.classList.remove('open'); inp.blur();
  });
  inp.addEventListener('blur', () => setTimeout(() => box.classList.remove('open'), 150));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inp.focus(); inp.select(); }
    if (e.key === 'Escape') { const m = document.querySelector('.modal-wrap:last-child [data-close]'); if (m) m.click(); }
  });

  /* ---------- menu rápido ---------- */
  document.getElementById('quick-btn').onclick = () => {
    const items = [
      ['💸', 'Gasto', () => App.views.financas.quick.tx()], ['🔁', 'Parcelamento', () => App.views.financas.quick.inst()],
      ['📅', 'Evento / conta', () => App.views.agenda.quick.event()], ['📚', 'Sessão de estudo', () => App.views.estudos.quick.study()],
      ['⚖️', 'Medição corporal', () => { App.go('fitness/corpo'); setTimeout(() => App.views.fitness.quick.body(), 60); }], ['🏋️', 'Registrar treino', () => App.views.fitness.quick.workout()],
      ['🏢', 'FII', () => App.views.investimentos.quick.fii()], ['⬆', 'Subir fatura', () => App.go('financas/importar')],
    ];
    const m = App.modal({ title: 'Adicionar rápido', hideFooter: true, body: `<div class="quick-grid">${items.map(([i, l], k) => `<button type="button" class="btn" data-mact="q" data-k="${k}">${i} ${l}</button>`).join('')}</div>`,
      actions: { q: (b, _, close) => { close(); setTimeout(items[+b.dataset.k][2], 200); } } });
    return m;
  };

  /* ---------- lembretes ao abrir ---------- */
  try {
    const s = App.state.settings;
    const key = 'vidaos.notified.' + U.today();
    if (s.notify && 'Notification' in window && Notification.permission === 'granted' && !localStorage.getItem(key)) {
      const up = App.Agenda.occurrences(U.today(), U.addDays(U.today(), 1)).filter((o) => !o.done);
      if (up.length) new Notification('Vida OS — hoje e amanhã', { body: up.slice(0, 5).map((o) => `${App.Agenda.type(o.type).icon} ${o.title} (${U.relDays(o.date)})${o.value ? ' ' + U.moneyTxt(o.value) : ''}`).join('\n') });
      localStorage.setItem(key, '1');
    }
    const late = App.Agenda.overdue();
    if (late.length) setTimeout(() => App.toast(`⚠️ Você tem ${late.length} conta(s) atrasada(s). Veja na Agenda.`, 'error'), 800);
    if (!s.lastBackup && (App.state.transactions.length > 30) || (s.lastBackup && U.diffDays(s.lastBackup, U.today()) > 30)) setTimeout(() => App.toast('💾 Faz mais de 30 dias sem backup. Ajustes → Dados & backup.'), 1600);
  } catch (e) { console.warn(e); }

  /* ---------- PWA (instalar no celular) ---------- */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})(window.App);
