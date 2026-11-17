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
        <h4 style="margin:16px 0 8px">Boneco corporal</h4>
        <div class="seg">${[['holo', '🔮 Holograma'], ['skin', '🧑 Pele']].map(([v, l]) => `<button class="${(v === 'holo') === (s.avatarSkin === 'holo') ? 'on' : ''}" data-act="${v === 'holo' ? 'set' : 'skinMode'}" data-k="avatarSkin" data-v="${v}">${l}</button>`).join('')}</div>
        ${s.avatarSkin !== 'holo' ? `<div class="swatches mt">${['s1', 's2', 's3', 's4', 's5', 'mono'].map((k) => `<div class="swatch ${s.avatarSkin === k ? 'on' : ''}" title="tom de pele" style="background:linear-gradient(90deg, ${App.Body.SKINS[k][2]}, ${App.Body.SKINS[k][0]}, ${App.Body.SKINS[k][2]})" data-act="skinTone" data-v="${k}"></div>`).join('')}</div>` : ''}
        <div class="frow mt">${F.select('Cabelo', 'hs', [['short', 'Mostrar'], ['none', 'Sem cabelo']], s.avatarHairStyle || 'short', 'data-change="setSel" data-k="avatarHairStyle"')}${F.select('Cor do cabelo', 'hc', Object.keys(App.Body.HAIR).map((k) => [k, k[0].toUpperCase() + k.slice(1)]), s.avatarHair || 'preto', 'data-change="setSel" data-k="avatarHair"')}</div>
        <div id="av-prev" class="avatar-host" style="max-width:300px"></div>
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
      <div class="card"><header><h3>🌤️ Clima e relógio</h3></header>
        <p>Cidade da previsão: <b>${U.esc((st().weather || {}).city || 'não definida')}</b></p>
        <div class="row"><button class="btn" data-act="wxSetup">🌍 Escolher cidade</button><button class="btn" data-act="clock">🕐 Abrir relógio</button></div>
        <p class="muted"><small>No relógio: ⛶ tela cheia, 12/24h e segundos. A tela fica acesa enquanto ele estiver aberto. Atalho: botão 🕐 no topo.</small></p></div>
      <div class="card"><header><h3>🔔 Notificações</h3></header>
        <p class="muted">Ao abrir o sistema, avisa contas que vencem hoje/amanhã, provas e o fim do Pomodoro.</p>
        ${F.check('Ativar lembretes', 'notify', s.notify).replace('name="notify"', 'data-change="notifyToggle"')}
        <p class="muted mt"><small>Status do navegador: <b>${'Notification' in window ? Notification.permission : 'não suportado'}</b></small></p></div>
    </div>`;
  };
  views.armazenamento = () => {
    const S = App.storage, b = S.backend, remote = S.isRemote();
    const where = b.kind === 'pendrive' ? `Pasta <b>${U.esc((S.info && S.info.dir) || 'dados')}</b> no pendrive` : b.kind === 'pasta' ? `Pasta <b>${U.esc(b.dir.name)}</b>` : 'Somente <b>neste navegador</b> deste computador';
    return `<div class="grid g2">
    <div class="card"><header><h3>${b.label} — onde seus dados estão</h3><span class="chip ${S.status === 'error' ? 'bad' : 'ok'}">${S.status === 'error' ? 'erro ao salvar' : 'salvando automaticamente'}</span></header>
      <p>${where}.</p>
      ${b.kind === 'pendrive' ? `<div class="note">✅ <b>Modo portátil ativo.</b> Tudo o que você faz é gravado no pendrive na hora. O computador não guarda nada — nem os dados, nem o navegador (o perfil do navegador também fica no pendrive). Cópias de segurança automáticas ficam em <code>dados/backups</code>.</div>
        <button class="btn primary" data-act="safeExit">⏏️ Sair com segurança</button>` : ''}
      ${b.kind === 'pasta' ? `<div class="note">Os dados são gravados direto na pasta escolhida. Para máxima privacidade use o <b>programa portátil</b> (o navegador deste PC ainda guarda uma referência à pasta).</div>
        <div class="row"><button class="btn" data-act="toFolder">📂 Trocar de pasta</button><button class="btn ghost" data-act="toBrowser">Voltar a usar o navegador</button></div>` : ''}
      ${b.kind === 'navegador' ? `<div class="note warn">Seus dados estão presos a este navegador. Para levar tudo no <b>pendrive</b>, use uma das opções:</div>
        <ol class="steps">
          <li><b>Programa portátil (recomendado):</b> copie a pasta do Vida OS para o pendrive e abra <code>VidaOS-Windows.exe</code> (ou <code>VidaOS-Mac</code> / <code>VidaOS-Linux</code>). Para trazer o que já está aqui: <button class="btn sm" data-act="export" data-files="1">⬇ Backup completo</button> e depois “Restaurar backup” dentro do programa.</li>
          <li><b>Gravar direto numa pasta</b> (Chrome/Edge): ${S.folderSupported() ? '<button class="btn sm primary" data-act="toFolder">📂 Escolher pasta no pendrive e mover dados</button>' : '<i>não suportado neste navegador</i>'}</li>
        </ol>` : ''}
    </div>
    <div class="card"><header><h3>🔒 Senha e criptografia</h3>${S.vault ? '<span class="chip ok">ativada</span>' : '<span class="chip">desativada</span>'}</header>
      ${remote ? (S.vault ? `<p class="muted">Seus dados e PDFs estão <b>criptografados (AES‑256)</b>, no mesmo modelo do KeePassXC: sem a senha${App.storage.vault && App.storage.vault.keyfile ? ' e o arquivo-chave' : ''}, ninguém lê o conteúdo do pendrive.</p>
          <div class="row"><button class="btn" data-act="pwChange">🔑 Trocar senha</button><button class="btn" data-act="lockNow">🔒 Bloquear agora</button><button class="btn ghost danger" data-act="pwRemove">Remover senha</button></div>
          <div class="frow mt">${F.select('Bloquear sozinho após inatividade', 'al', [[0, 'Nunca'], [5, '5 minutos'], [10, '10 minutos'], [15, '15 minutos'], [30, '30 minutos'], [60, '1 hora']], ss().autoLockMin || 0, 'data-change="setSel" data-k="autoLockMin"')}${F.select('Ao minimizar / trocar de janela', 'lh', [[0, 'Não bloquear'], [10, 'Bloquear após 10 s'], [60, 'Bloquear após 1 min']], ss().lockOnHide || 0, 'data-change="setSel" data-k="lockOnHide"')}</div>
          <p class="muted"><small>🔐 ${App.storage.vault.v >= 2 ? `AES‑256‑GCM · PBKDF2‑SHA256 ${U.fmt(App.storage.vault.iter / 1000, 0)} mil iterações${App.storage.vault.keyfile ? ' · <b>senha + arquivo-chave</b>' : ' · só senha'}` : 'Cofre antigo (310 mil iterações) — use “Trocar senha” para atualizar para o padrão novo.'}</small></p>`
        : `<p class="muted">Proteja tudo com uma senha. Se perder o pendrive, ninguém consegue abrir seus dados.</p><button class="btn primary" data-act="pwSet">🔒 Criar senha</button>
          <div class="note warn mt">⚠️ Não existe “esqueci a senha”: sem ela os dados não podem ser recuperados. Guarde-a no seu gerenciador de chaves.</div>`)
      : '<p class="muted">A senha com criptografia fica disponível nos modos <b>pendrive</b> e <b>pasta</b>.</p>'}
    </div>
    <div class="card"><header><h3>💾 Backup</h3></header>
      <p class="muted">Um arquivo único com todos os seus dados — serve para guardar uma cópia extra ou mudar de aparelho.</p>
      <div class="row"><button class="btn primary" data-act="export" data-files="0">⬇ Backup (dados)</button><button class="btn" data-act="export" data-files="1">⬇ Backup completo (com PDFs)</button></div>
      <label class="btn btn-file mt">⬆ Restaurar backup<input type="file" accept=".json" data-change="import"></label>
      <p class="muted mt" id="storage-info"><small>${st().transactions.length} lançamentos · ${st().materials.length} PDFs · ${(st().sites || []).length} sites</small></p>
      <p class="muted"><small>Versão do Vida OS: <b>${App.VERSION}</b>${App.storage.info && App.storage.info.version ? ` · programa portátil ${App.storage.info.version}${App.storage.info.files ? ' · arquivos: ' + App.storage.info.files : ''}` : ''}</small></p>
      <p class="muted"><small>Último backup manual: ${ss().lastBackup ? U.dateBR(ss().lastBackup) : 'nunca'}</small></p></div>
    <div class="card"><header><h3>🧹 Zona de perigo</h3></header>
      <button class="btn danger" data-act="wipe" data-what="transactions">Apagar todos os lançamentos</button>
      <button class="btn danger mt" data-act="wipe" data-what="all">Apagar TUDO e recomeçar</button></div>
  </div>`;
  };

  const pwModal = (title, onOk) => {
    let keyBytes = null;
    App.modal({
      title, submitLabel: 'Confirmar',
      body: F.row(F.field('Nova senha-mestra', '<div class="pw-wrap"><input type="password" name="p1" autocomplete="new-password" data-minput="str"><button type="button" class="icon-btn" data-mact="eye">👁️</button></div>')) +
        '<div class="pw-meter"><i id="pw-bar"></i></div><p class="muted" style="margin:4px 0 12px"><small id="pw-lbl">Dica: uma frase longa (ex.: “café forte antes do treino de terça”) é mais forte e mais fácil de lembrar.</small></p>' +
        F.row(F.field('Repita a senha', '<input type="password" name="p2" autocomplete="new-password">')) +
        `<h4 style="margin:8px 0">🔑 Arquivo-chave (opcional, como no KeePassXC)</h4>
        <p class="muted" style="margin-top:0"><small>Exige a senha <b>e</b> um arquivo para abrir. Guarde o arquivo <b>fora</b> do pendrive (celular, nuvem, outro pendrive). Se perder o arquivo, os dados não abrem.</small></p>
        <div class="seg"><button type="button" class="on" data-mact="kfNone">Sem arquivo</button><button type="button" data-mact="kfNew">Gerar novo</button><label class="btn-file" style="position:relative;padding:6px 11px;cursor:pointer">Usar um existente<input type="file" data-mchange="kfPick" style="position:absolute;inset:0;opacity:0"></label></div>
        <p id="kf-info" class="muted"><small>Nenhum arquivo-chave.</small></p><p id="pw-prog" class="muted"></p>`,
      actions: {
        eye: (b, f) => { f.p1.type = f.p2.type = f.p1.type === 'password' ? 'text' : 'password'; },
        str: (el, f) => { const r = App.storage.strength(el.value); const bar = f.querySelector('#pw-bar'); bar.style.width = r.score * 25 + '%'; bar.style.background = r.color; f.querySelector('#pw-lbl').innerHTML = el.value ? `Força: <b style="color:${r.color}">${r.label}</b> (~${r.bits} bits)` : ''; },
        kfNone: (b, f) => { keyBytes = null; seg(f, 0); f.querySelector('#kf-info').innerHTML = '<small>Nenhum arquivo-chave.</small>'; },
        kfNew: (b, f) => { keyBytes = App.storage.newKeyFile(); seg(f, 1); f.querySelector('#kf-info').innerHTML = '<small>✅ <b>vidaos.chave</b> baixado. Mova-o para um lugar seguro <b>fora do pendrive</b>.</small>'; },
        kfPick: async (inp, f) => { const file = inp.files[0]; if (!file) return; keyBytes = new Uint8Array(await file.arrayBuffer()); seg(f, 2); f.querySelector('#kf-info').innerHTML = `<small>✅ Usando <b>${U.esc(file.name)}</b> como arquivo-chave.</small>`; },
      },
      onSubmit: async (d, form) => {
        if ((d.p1 || '').length < 8) { App.toast('Use pelo menos 8 caracteres.', 'error'); return false; }
        if (d.p1 !== d.p2) { App.toast('As senhas não conferem.', 'error'); return false; }
        if (App.storage.strength(d.p1).score < 2 && !keyBytes) { App.toast('Senha fraca demais. Use uma frase mais longa ou um arquivo-chave.', 'error'); return false; }
        const prog = form.querySelector('#pw-prog'); form.querySelector('[type=submit]').disabled = true; prog.textContent = 'Criptografando…';
        await onOk(d.p1, (i, n) => { prog.textContent = `Criptografando arquivos ${i}/${n}…`; }, keyBytes);
        App.renderStorageBadge(); App.rerender();
      },
    });
    function seg(f, i) { f.querySelectorAll('.seg > *').forEach((x, j) => x.classList.toggle('on', i === j)); }
  };

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
      App.confirm('Restaurar este backup? Os dados atuais serão substituídos.', async () => {
        App.toast('Restaurando…');
        if (data.files) for (const f of data.files) { const blob = await (await fetch(f.data)).blob(); await App.files.put(new File([blob], f.name, { type: f.type }), f.id); }
        App.load(data.state); await App.save(true); App.applyTheme(); App.rerender(); App.toast('Backup restaurado ✅');
      }, 'Restaurar');
    } catch (e) { App.toast('Não consegui ler o backup: ' + e.message, 'error'); }
  }

  App.views.ajustes = {
    render(r) {
      const sub = views[r.sub] ? r.sub : 'aparencia'; this._sub = sub;
      return `<div class="page-head"><div><h1>⚙️ Ajustes</h1><p>Deixe o sistema com a sua cara.</p></div></div>
        ${App.subtabs('ajustes', [['aparencia', 'Aparência'], ['abas', 'Abas'], ['painel', 'Painel inicial'], ['preferencias', 'Preferências'], ['armazenamento', '💾 Armazenamento & segurança']], sub)}${views[sub]()}`;
    },
    async mount() {
      const host = document.getElementById('av-prev');
      if (host) { const ents = App.Fit.entries(); const e = ents.length ? App.Fit.enrich(ents[ents.length - 1]) : { weight: 0 }; App.Body.create(host, { view: 'both' }).to(App.Body.params(e, st().profile), null, 0); }
    },
    actions: {
      set: (t) => apply((s) => { s[t.dataset.k] = t.dataset.v; }),
      setInput: (t) => apply((s) => { s[t.dataset.k] = t.dataset.num !== undefined ? +t.value : t.value; }),
      skinMode: () => apply((s) => { s.avatarSkin = s.lastSkin || 's2'; }),
      skinTone: (t) => apply((s) => { s.avatarSkin = t.dataset.v; s.lastSkin = t.dataset.v; }),
      setSel: (t) => apply((s) => { s[t.dataset.k] = t.value; }),
      toggle: (t) => apply((s) => { s[t.dataset.k] = t.checked; }),
      preset: (t) => apply((s) => Object.assign(s, PRESETS[+t.dataset.i][1])),
      vis: (t) => apply((s) => { s[t.dataset.key][+t.dataset.i].visible = t.checked; }),
      tabIcon: (t) => apply((s) => { s.tabs[+t.dataset.i].icon = t.value || '•'; }),
      tabLabel: (t) => apply((s) => { s.tabs[+t.dataset.i].label = t.value || s.tabs[+t.dataset.i].id; }),
      mv: (t) => apply((s) => { const a = s[t.dataset.key], i = +t.dataset.i, j = i + +t.dataset.d; [a[i], a[j]] = [a[j], a[i]]; }),
      resetTabs: () => apply((s) => { s.tabs = App.defaultTabs(); }),
      savePrefs: (form) => { const d = App.formData(form); apply((s) => Object.assign(s, d)); App.toast('Preferências salvas'); },
      notifyToggle: async (t) => { if (t.checked && 'Notification' in window && Notification.permission !== 'granted') await Notification.requestPermission(); apply((s) => { s.notify = t.checked; }); },
      safeExit: () => App.safeExit(),
      lockNow: async () => { await App.storage.flush(); App.storage.lock(); },
      pwSet: () => pwModal('Criar senha do cofre', (p, prog, kf) => App.storage.setPassword(p, prog, kf).then(() => App.toast('🔒 Cofre criado. Seus dados agora estão criptografados.'))),
      pwChange: () => pwModal('Trocar senha / arquivo-chave', (p, prog, kf) => App.storage.setPassword(p, prog, kf).then(() => App.toast('Senha trocada.'))),
      pwRemove: () => App.confirm('Remover a senha? Os dados voltam a ficar sem criptografia.', async () => { await App.storage.removePassword(); App.renderStorageBadge(); App.rerender(); App.toast('Senha removida.'); }, 'Remover'),
      toFolder: async () => {
        let target; try { target = await App.storage.pickFolder(); } catch (e) { return; }
        const existing = await target.read('estado.json');
        const go = async (copy) => {
          if (copy) { App.toast('Copiando seus dados para a pasta…'); await App.storage.copyTo(target); }
          await App.storage.useFolder(target); location.reload();
        };
        if (existing) App.modal({ title: 'Essa pasta já tem dados do Vida OS', body: '<p>Quer <b>abrir os dados da pasta</b> ou <b>substituí-los</b> pelos dados atuais?</p>', submitLabel: 'Abrir dados da pasta', danger: { label: 'Substituir pelos atuais', fn: () => go(true) }, onSubmit: () => go(false) });
        else go(true);
      },
      toBrowser: () => App.confirm('Voltar a usar os dados salvos neste navegador? (os dados da pasta continuam lá)', () => App.storage.useBrowser(), 'Voltar'),
      export: (t) => exportBackup(t.dataset.files === '1'),
      import: (t) => { if (t.files[0]) importBackup(t.files[0]); t.value = ''; },
      notes: U.debounce((t) => { st().notes = t.value; App.save(); }, 400),
      wipe: (t) => App.confirm(t.dataset.what === 'all' ? '<b>Apagar absolutamente tudo?</b> Não dá para desfazer (a menos que você tenha backup).' : 'Apagar todos os lançamentos e relatórios?', async () => {
        if (t.dataset.what === 'all') { for (const id of await App.storage.files.ids()) await App.files.del(id); App.load(null); await App.save(true); App.applyTheme(); App.go('inicio'); App.rerender(); }
        else App.commit((s) => { s.transactions = []; s.reports = []; });
        App.toast('Feito.');
      }, 'Apagar'),
    },
  };
})(window.App);
