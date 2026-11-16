/* ==========================================================
   Inicialização, busca global, menu rápido, lembretes
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U;

  /* ---------- indicador "salvo no pendrive" ---------- */
  App.renderStorageBadge = () => {
    const S = App.storage; if (!S.backend) return;
    const st = { saved: ['ok', 'salvo'], saving: ['warn', 'salvando…'], error: ['bad', 'ERRO ao salvar'] }[S.status] || ['ok', ''];
 const html = `<span class="dot"></span><span><b>${S.backend.label}</b><small>${st[1]}${S.lastSave && S.status === 'saved' ? ' · ' + S.lastSave.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</small></span>`;
    ['save-badge', 'save-badge-m'].forEach((id) => { const b = document.getElementById(id); if (b) { b.className = 'save-badge ' + st[0] + (id.endsWith('-m') ? ' mobile-only' : ''); b.innerHTML = html; } });
    document.getElementById('quit-btn').style.display = S.backend.kind === 'pendrive' ? '' : 'none';
    document.getElementById('lock-btn').style.display = S.vault ? '' : 'none';
  };

  App.safeExit = async () => {
    await App.storage.flush();
    const S = App.storage;
    if (S.status === 'error') return App.toast('Não consegui salvar! Verifique o pendrive antes de sair.', 'error');
    await S.gate(`<h2>Tudo salvo ✅</h2><p class="muted">Seus dados estão gravados ${S.backend.kind === 'pendrive' ? 'no pendrive' : 'na pasta'}.<br>Pode fechar esta janela e remover o pendrive com segurança.</p>`);
    if (S.backend.quit) await S.backend.quit();
    setTimeout(() => window.close(), 400);
  };

  async function boot() {
    let saved = null;
    try { saved = await App.storage.init(); }
    catch (e) {
      console.error(e);
      await App.storage.gate(`<h2>Não consegui ler seus dados</h2><p class="muted">${U.esc(e.message)}</p><button class="btn primary" onclick="location.reload()">Tentar de novo</button>`);
      return;
    }
    App.load(saved);
    if (!saved && App.storage.isRemote()) App.save(true); // cria o arquivo de dados no pendrive
    App.Money.applyRules();
    App.applyTheme();
    App.bindView();
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => App.state.settings.theme === 'auto' && App.applyTheme());
    window.addEventListener('hashchange', App.rerender);
    App.rerender();
    App.renderStorageBadge();
    App.Inv.snapshot();
    document.getElementById('privacy-btn').onclick = () => { App.state.settings.privacy = !App.state.settings.privacy; App.save(); App.applyTheme(); };
    document.getElementById('quit-btn').onclick = App.safeExit;
    document.getElementById('lock-btn').onclick = async () => { await App.storage.flush(); App.storage.lock(); };
    setupSearch(); setupQuick(); reminders(); autoLock();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !App.storage.backend.token) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  /* ---------- bloqueio automático por inatividade ---------- */
  function autoLock() {
    let last = Date.now();
    ['mousemove', 'keydown', 'touchstart', 'click'].forEach((ev) => document.addEventListener(ev, () => (last = Date.now()), { passive: true }));
    setInterval(async () => {
      const min = +App.state.settings.autoLockMin || 0;
      if (App.storage.vault && min && Date.now() - last > min * 60000) { await App.storage.flush(); App.storage.lock(); }
    }, 20000);
  }

  /* ---------- busca global ---------- */
  function setupSearch() {
    const inp = document.getElementById('gsearch'), box = document.getElementById('gresults');
    let results = [], seq = 0;
    const search = (q) => {
      const n = U.norm(q); if (n.length < 2) return [];
      const s = App.state, out = [];
      const words = n.split(/\s+/).filter(Boolean);
      const has = (...xs) => { const t = U.norm(xs.join(' ')); return words.every((w) => t.includes(w)); };
      (s.sites || []).filter((x) => has(x.title, x.desc, x.url, (x.tags || []).join(' '), x.category)).slice(0, 8).forEach((x) => out.push({ ico: App.Sites.logoHTML(x, 22), t: x.title, s: x.desc || x.url, url: x.url, site: x.id }));
      s.transactions.filter((t) => has(t.desc, t.notes, t.value)).slice(0, 6).forEach((t) => out.push({ i: App.Fin.cat(t.categoryId).icon, t: t.desc, s: `${U.dateBR(t.date)} · ${U.moneyTxt(t.value)}`, go: 'financas/gastos' }));
      s.installments.filter((i) => has(i.desc)).forEach((i) => out.push({ i: '🔁', t: i.desc, s: `parcelamento ${i.count}x ${U.moneyTxt(i.parcel)}`, go: 'financas/parcelas' }));
      s.events.filter((e) => has(e.title, e.notes)).slice(0, 5).forEach((e) => out.push({ i: App.Agenda.type(e.type).icon, t: e.title, s: U.dateBR(e.date), go: 'agenda' }));
      s.subjects.filter((x) => has(x.name, x.notes)).forEach((x) => out.push({ i: '📚', t: x.name, s: 'matéria', go: 'estudos/materias' }));
      s.concursos.filter((c) => has(c.name, c.banca, c.cargo)).forEach((c) => out.push({ i: '📝', t: c.name, s: 'concurso', go: 'estudos/concursos' }));
      s.plan.forEach((p) => p.items.filter((x) => has(x.name)).forEach((x) => out.push({ i: '🏋️', t: x.name, s: `treino de ${U.DAYS[p.day]}`, go: 'fitness/treino' })));
      s.fiis.filter((f) => has(f.ticker)).forEach((f) => out.push({ i: '🏢', t: f.ticker, s: `${f.qty} cotas`, go: 'investimentos/fiis' }));
      return out;
    };
    const paint = () => {
      box.innerHTML = results.length ? results.slice(0, 30).map((r, k) => `<a href="#" data-k="${k}"><span class="gr-ico">${r.ico || r.i}</span><span class="gr-t"><b>${U.esc(r.t)}</b><small>${r.snippet || U.esc(r.s)}</small></span></a>`).join('') : (inp.value.length > 1 ? '<a><span class="muted">Nada encontrado</span></a>' : '');
      box.classList.toggle('open', inp.value.length > 1);
    };
    inp.addEventListener('input', U.debounce(async () => {
      const my = ++seq, q = inp.value;
      results = search(q); paint();
      // conteúdo dos PDFs (biblioteca)
      if (q.trim().length >= 3 && App.Lib) {
        const lib = await App.Lib.search(q, 6);
        if (my !== seq) return;
        const add = lib.map((h) => ({ i: '📄', t: h.m.name, s: '', snippet: h.snippet, file: h.m.fileId }));
        const firstOther = results.findIndex((r) => !r.site);
        results.splice(firstOther < 0 ? results.length : firstOther, 0, ...add);
        paint();
      }
    }, 180));
    box.addEventListener('mousedown', (e) => {
      const a = e.target.closest('[data-k]'); if (!a) return; e.preventDefault();
      const r = results[+a.dataset.k];
      if (r.url) App.Sites.open(r.site); else if (r.file) App.files.open(r.file); else App.go(r.go);
      box.classList.remove('open'); inp.blur();
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && results[0]) { box.querySelector('[data-k="0"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } });
    inp.addEventListener('blur', () => setTimeout(() => box.classList.remove('open'), 150));
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inp.focus(); inp.select(); }
      if (e.key === 'Escape') { const m = document.querySelector('.modal-wrap:last-child [data-close]'); if (m) m.click(); }
    });
  }

  /* ---------- menu rápido ---------- */
  function setupQuick() {
    document.getElementById('quick-btn').onclick = () => {
      const items = [
        ['💸', 'Gasto', () => App.views.financas.quick.tx()], ['🔁', 'Parcelamento', () => App.views.financas.quick.inst()],
        ['📅', 'Evento / conta', () => App.views.agenda.quick.event()], ['📚', 'Sessão de estudo', () => App.views.estudos.quick.study()],
        ['📄', 'PDF na biblioteca', () => App.views.estudos.quick.lib()], ['🔗', 'Site útil', () => App.views.sites.quick.site()],
        ['⚖️', 'Medição corporal', () => { App.go('fitness/corpo'); setTimeout(() => App.views.fitness.quick.body(), 60); }], ['🏋️', 'Registrar treino', () => App.views.fitness.quick.workout()],
        ['🏢', 'FII', () => App.views.investimentos.quick.fii()], ['⬆', 'Subir fatura', () => App.go('financas/importar')],
      ];
      App.modal({ title: 'Adicionar rápido', hideFooter: true, body: `<div class="quick-grid">${items.map(([i, l], k) => `<button type="button" class="btn" data-mact="q" data-k="${k}">${i} ${l}</button>`).join('')}</div>`,
        actions: { q: (b, _, close) => { close(); setTimeout(items[+b.dataset.k][2], 200); } } });
    };
  }

  /* ---------- lembretes ao abrir ---------- */
  function reminders() {
    try {
      const s = App.state.settings;
      const key = 'vidaos.notified.' + U.today();
      if (s.notify && 'Notification' in window && Notification.permission === 'granted' && !sessionStorage.getItem(key)) {
        const up = App.Agenda.occurrences(U.today(), U.addDays(U.today(), 1)).filter((o) => !o.done);
        if (up.length) new Notification('Vida OS — hoje e amanhã', { body: up.slice(0, 5).map((o) => `${App.Agenda.type(o.type).icon} ${o.title} (${U.relDays(o.date)})${o.value ? ' ' + U.moneyTxt(o.value) : ''}`).join('\n') });
        sessionStorage.setItem(key, '1');
      }
      const late = App.Agenda.overdue();
      if (late.length) setTimeout(() => App.toast(`⚠️ Você tem ${late.length} conta(s) atrasada(s). Veja na Agenda.`, 'error'), 800);
      if (App.storage.backend.kind === 'navegador' && ((!s.lastBackup && App.state.transactions.length > 30) || (s.lastBackup && U.diffDays(s.lastBackup, U.today()) > 30))) setTimeout(() => App.toast('💾 Faz mais de 30 dias sem backup. Ajustes → Armazenamento.'), 1600);
    } catch (e) { console.warn(e); }
  }

  boot();
})(window.App);
