/* ==========================================================
   AJUSTES — personalização total, dados e backup
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const ss = () => App.state.settings;
  const ACCENTS = ['#7c5cff', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#d946ef', '#a855f7', '#64748b'];
  const PRESETS = [
    ['Neon roxo', { theme: 'dark', accent: '#7c5cff', accent2: '#22d3ee', bg: 'aurora' }],
    ['Oceano', { theme: 'dark', accent: '#0ea5e9', accent2: '#14b8a6', bg: 'aurora' }],
    ['Fogo', { theme: 'dark', accent: '#f97316', accent2: '#ef4444', bg: 'aurora' }],
    ['Floresta', { theme: 'dark', accent: '#22c55e', accent2: '#84cc16', bg: 'grid' }],
    ['Rosa', { theme: 'light', accent: '#ec4899', accent2: '#a855f7', bg: 'aurora' }],
    ['Minimal claro', { theme: 'light', accent: '#3b82f6', accent2: '#6366f1', bg: 'solid' }],
    ['Grafite', { theme: 'dark', accent: '#94a3b8', accent2: '#e2e8f0', bg: 'solid' }],
  ];
  const apply = (fn) => { fn(ss()); App.save(); App.applyTheme(); App.rerender(); };

  const reorderList = (key, labelEditable) => {
    const arr = ss()[key];
    return `<div class="list sortable">${arr.map((t, i) => `<div class="li">
      <input type="checkbox" ${t.visible ? 'checked' : ''} ${t.id === 'ajustes' ? 'disabled' : ''} data-change="vis" data-key="${key}" data-i="${i}" title="mostrar/ocultar">
      ${labelEditable ? `<input value="${U.esc(t.icon)}" style="width:56px;text-align:center" data-change="tabIcon" data-i="${i}" maxlength="4"><input value="${U.esc(t.label)}" data-change="tabLabel" data-i="${i}" style="flex:1">` : `<div class="grow">${U.esc(t.label)}</div>`}
      <button class="icon-btn" data-act="mv" data-key="${key}" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="icon-btn" data-act="mv" data-key="${key}" data-i="${i}" data-d="1" ${i === arr.length - 1 ? 'disabled' : ''}>↓</button></div>`).join('')}</div>`;
  };

  const views = {};
  views.aparencia = () => {
    const s = ss();
    return `<div class="grid g2">
      <div class="card"><header><h3>🎨 Temas prontos</h3></header><div class="row">${PRESETS.map(([n, p], i) => `<button class="btn" data-act="preset" data-i="${i}"><span class="dot" style="background:${p.accent}"></span><span class="dot" style="background:${p.accent2}"></span> ${n}</button>`).join('')}</div></div>
      <div class="card"><header><h3>🌗 Modo</h3></header><div class="seg">${[['dark', '🌙 Escuro'], ['light', '☀️ Claro'], ['auto', '🖥️ Automático']].map(([v, l]) => `<button class="${s.theme === v ? 'on' : ''}" data-act="set" data-k="theme" data-v="${v}">${l}</button>`).join('')}</div>
        <h4 style="margin:16px 0 8px">Fundo</h4><div class="seg">${[['aurora', '✨ Aurora'], ['grid', '▦ Grade'], ['solid', '■ Sólido']].map(([v, l]) => `<button class="${s.bg === v ? 'on' : ''}" data-act="set" data-k="bg" data-v="${v}">${l}</button>`).join('')}</div>
        <h4 style="margin:16px 0 8px">Densidade</h4><div class="seg">${[['normal', 'Confortável'], ['compact', 'Compacta']].map(([v, l]) => `<button class="${s.density === v ? 'on' : ''}" data-act="set" data-k="density" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="card"><header><h3>🖌️ Cor principal</h3></header><div class="swatches">${ACCENTS.map((c) => `<div class="swatch ${s.accent === c ? 'on' : ''}" style="background:${c}" data-act="set" data-k="accent" data-v="${c}"></div>`).join('')}</div>
        <div class="frow mt">${F.field('Cor principal (livre)', `<input type="color" value="${s.accent}" data-change="setInput" data-k="accent">`)}${F.field('Cor secundária', `<input type="color" value="${s.accent2}" data-change="setInput" data-k="accent2">`)}</div></div>
      <div class="card"><header><h3>📐 Formas e texto</h3></header>
        ${F.field(`Arredondamento dos cartões: <b>${s.radius}px</b>`, `<input type="range" min="0" max="28" value="${s.radius}" data-change="setInput" data-k="radius" data-num>`)}
        <div style="height:12px"></div>${F.field(`Tamanho do texto: <b>${s.fontScale}%</b>`, `<input type="range" min="85" max="125" step="5" value="${s.fontScale}" data-change="setInput" data-k="fontScale" data-num>`)}
        <h4 style="margin:16px 0 8px">Estilo do avatar corporal</h4><div class="seg">${[['holo', '🔮 Holograma'], ['skin', '🧑 Pele'], ['mono', '⚪ Neutro']].map(([v, l]) => `<button class="${s.avatarSkin === v ? 'on' : ''}" data-act="set" data-k="avatarSkin" data-v="${v}">${l}</button>`).join('')}</div>
        <div style="height:14px"></div>${F.check('Modo privacidade (borra os valores em R$ — passe o mouse para ver)', 'privacy', s.privacy).replace('name="privacy"', 'data-change="toggle" data-k="privacy"')}
      </div></div>`;
  };
  views.abas = () => `<div class="card"><header><h3>🗂️ Abas do menu</h3><small>renomeie, troque o ícone, reordene ou esconda</small></header>${reorderList('tabs', true)}<button class="btn ghost mt" data-act="resetTabs">Restaurar padrão</button></div>`;
  views.painel = () => `<div class="card"><header><h3>🧩 Blocos do painel inicial</h3><small>escolha o que aparece e a ordem</small></header>${reorderList('widgets', false)}</div>`;
  views.preferencias = () => {
    const s = ss();
    return `<div class="grid g2">
      <div class="card"><header><h3>📈 Investimentos</h3></header><form data-submit="savePrefs">
        ${F.row(F.number('CDI anual (%)', 'cdi', s.cdi, 'step="0.01"'), F.number('IPCA anual (%)', 'ipca', s.ipca, 'step="0.01"'))}
        ${F.text('Token brapi.dev (cotações e dividendos automáticos)', 'brapiToken', s.brapiToken, 'placeholder="cole aqui seu token gratuito"')}
        <p class="muted"><small>Crie uma conta grátis em <a href="https://brapi.dev" target="_blank" rel="noopener">brapi.dev</a> → Dashboard → copie o token. Ele fica salvo só no seu navegador.</small></p>
        ${F.row(F.number('Pomodoro: minutos de foco', 'pomodoro', s.pomodoro), F.number('Minutos de pausa', 'pause', s.pause))}
        <button class="btn primary">Salvar</button></form></div>
      <div class="card"><header><h3>🔔 Notificações</h3></header>
        <p class="muted">Ao abrir o sistema, avisa contas que vencem hoje/amanhã, provas e o fim do Pomodoro.</p>
        ${F.check('Ativar lembretes', 'notify', s.notify).replace('name="notify"', 'data-change="notifyToggle"')}
        <p class="muted mt"><small>Status do navegador: <b>${'Notification' in window ? Notification.permission : 'não suportado'}</b></small></p></div>
    </div>`;
  };
  views.dados = () => `<div class="grid g2">
    <div class="card"><header><h3>💾 Backup</h3></header>
      <p class="muted">Tudo fica salvo <b>apenas neste navegador</b>. Faça backup para não perder nada e para levar seus dados para o celular/outro computador.</p>
      <div class="row"><button class="btn primary" data-act="export" data-files="0">⬇ Baixar backup (dados)</button><button class="btn" data-act="export" data-files="1">⬇ Backup completo (com PDFs)</button></div>
      <label class="btn btn-file mt">⬆ Restaurar backup<input type="file" accept=".json" data-change="import"></label>
      <p class="muted mt" id="storage-info"><small>calculando uso de armazenamento…</small></p>
      <p class="muted"><small>Último backup: ${ss().lastBackup ? U.dateBR(ss().lastBackup) : 'nunca'}</small></p></div>
    <div class="card"><header><h3>🧹 Zona de perigo</h3></header>
      <button class="btn danger" data-act="wipe" data-what="transactions">Apagar todos os lançamentos</button>
      <button class="btn danger mt" data-act="wipe" data-what="all">Apagar TUDO e recomeçar</button></div>
    <div class="card full"><header><h3>📝 Bloco de notas livre</h3></header><textarea rows="8" data-input="notes" placeholder="Anotações rápidas, ideias, metas do ano…">${U.esc(st().notes)}</textarea></div>
  </div>`;

  async function exportBackup(withFiles) {
    const data = { app: 'vida-os', exportedAt: new Date().toISOString(), state: st() };
    if (withFiles) {
      const files = await App.files.all();
      data.files = await Promise.all(files.map((f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ id: f.id, name: f.name, type: f.type, size: f.size, data: r.result }); r.readAsDataURL(f.blob); })));
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vida-os-backup-${U.today()}${withFiles ? '-completo' : ''}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    ss().lastBackup = U.today(); App.save();
  }
  async function importBackup(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data.state) throw new Error('arquivo inválido');
      App.confirm('Restaurar este backup? Os dados atuais deste navegador serão substituídos.', async () => {
        localStorage.setItem('vidaos.state.v1', JSON.stringify(data.state));
        if (data.files) for (const f of data.files) { const blob = await (await fetch(f.data)).blob(); await App.files.put(new File([blob], f.name, { type: f.type }), f.id); }
        App.load(); App.applyTheme(); App.rerender(); App.toast('Backup restaurado ✅');
      }, 'Restaurar');
    } catch (e) { App.toast('Não consegui ler o backup: ' + e.message, 'error'); }
  }

  App.views.ajustes = {
    render(r) {
      const sub = views[r.sub] ? r.sub : 'aparencia'; this._sub = sub;
      return `<div class="page-head"><div><h1>⚙️ Ajustes</h1><p>Deixe o sistema com a sua cara.</p></div></div>
        ${App.subtabs('ajustes', [['aparencia', 'Aparência'], ['abas', 'Abas'], ['painel', 'Painel inicial'], ['preferencias', 'Preferências'], ['dados', 'Dados & backup']], sub)}${views[sub]()}`;
    },
    async mount() {
      const el = document.getElementById('storage-info');
      if (el && navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); el.innerHTML = `<small>Usando <b>${(e.usage / 1048576).toFixed(1)} MB</b> de ~${(e.quota / 1073741824).toFixed(1)} GB disponíveis · ${st().transactions.length} lançamentos · ${st().materials.length} materiais</small>`; }
    },
    actions: {
      set: (t) => apply((s) => { s[t.dataset.k] = t.dataset.v; }),
      setInput: (t) => apply((s) => { s[t.dataset.k] = t.dataset.num !== undefined ? +t.value : t.value; }),
      toggle: (t) => apply((s) => { s[t.dataset.k] = t.checked; }),
      preset: (t) => apply((s) => Object.assign(s, PRESETS[+t.dataset.i][1])),
      vis: (t) => apply((s) => { s[t.dataset.key][+t.dataset.i].visible = t.checked; }),
      tabIcon: (t) => apply((s) => { s.tabs[+t.dataset.i].icon = t.value || '•'; }),
      tabLabel: (t) => apply((s) => { s.tabs[+t.dataset.i].label = t.value || s.tabs[+t.dataset.i].id; }),
      mv: (t) => apply((s) => { const a = s[t.dataset.key], i = +t.dataset.i, j = i + +t.dataset.d; [a[i], a[j]] = [a[j], a[i]]; }),
      resetTabs: () => apply((s) => { s.tabs = App.defaultTabs(); }),
      savePrefs: (form) => { const d = App.formData(form); apply((s) => Object.assign(s, d)); App.toast('Preferências salvas'); },
      notifyToggle: async (t) => { if (t.checked && 'Notification' in window && Notification.permission !== 'granted') await Notification.requestPermission(); apply((s) => { s.notify = t.checked; }); },
      export: (t) => exportBackup(t.dataset.files === '1'),
      import: (t) => { if (t.files[0]) importBackup(t.files[0]); t.value = ''; },
      notes: U.debounce((t) => { st().notes = t.value; App.save(); }, 400),
      wipe: (t) => App.confirm(t.dataset.what === 'all' ? '<b>Apagar absolutamente tudo?</b> Não dá para desfazer (a menos que você tenha backup).' : 'Apagar todos os lançamentos e relatórios?', async () => {
        if (t.dataset.what === 'all') { localStorage.removeItem('vidaos.state.v1'); for (const f of await App.files.all()) await App.files.del(f.id); App.load(); App.applyTheme(); App.go('inicio'); App.rerender(); }
        else App.commit((s) => { s.transactions = []; s.reports = []; });
        App.toast('Feito.');
      }, 'Apagar'),
    },
  };
})(window.App);
