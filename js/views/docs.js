/* ==========================================================
   DOCUMENTOS — CNH, RG, certidões, reservista… tudo achável
   Frente/verso (foto ou PDF), número, validade, categoria,
   busca e filtros. No pendrive com senha, fica criptografado.
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const list = () => (st().docs = st().docs || []);
  const D = (App.Docs = {});

  D.CATS = {
    identidade: { label: 'Identidade', icon: '🪪', color: '#3b82f6' },
    veiculo: { label: 'Veículo & CNH', icon: '🚗', color: '#f97316' },
    militar: { label: 'Militar', icon: '🎖️', color: '#16a34a' },
    civil: { label: 'Registro civil', icon: '📜', color: '#a855f7' },
    saude: { label: 'Saúde', icon: '🩺', color: '#14b8a6' },
    educacao: { label: 'Educação', icon: '🎓', color: '#0ea5e9' },
    trabalho: { label: 'Trabalho', icon: '💼', color: '#eab308' },
    financeiro: { label: 'Financeiro & impostos', icon: '🧾', color: '#22c55e' },
    imovel: { label: 'Casa & contratos', icon: '🏠', color: '#ec4899' },
    outros: { label: 'Outros', icon: '📁', color: '#64748b' },
  };
  /** documentos que quase todo mundo precisa ter à mão */
  D.ESSENTIALS = [
    ['RG / Carteira de identidade', 'identidade', ['rg', 'identidade', 'cin']], ['CPF', 'identidade', ['cpf']], ['CNH', 'veiculo', ['cnh', 'habilitacao', 'motorista']],
    ['Título de eleitor', 'identidade', ['eleitor']], ['Certidão de nascimento', 'civil', ['nascimento']], ['Certificado de reservista', 'militar', ['reservista', 'militar', 'alistamento']],
    ['Comprovante de residência', 'imovel', ['residencia', 'endereco']], ['Cartão do SUS', 'saude', ['sus']], ['Carteira de vacinação', 'saude', ['vacina']],
    ['Carteira de trabalho (CTPS)', 'trabalho', ['ctps', 'trabalho']], ['Diploma / histórico escolar', 'educacao', ['diploma', 'historico', 'certificado de conclusao']],
    ['Documento do veículo (CRLV)', 'veiculo', ['crlv', 'veiculo', 'renavam']], ['Passaporte', 'identidade', ['passaporte']], ['Declaração do IR', 'financeiro', ['imposto', 'irpf', ' ir']],
  ];
  D.cat = (k) => D.CATS[k] || D.CATS.outros;

  /* ---------- miniaturas (guardadas como arquivo "thumb-<id>") ---------- */
  const thumbs = new Map(); // fileId -> objectURL
  const makeThumb = async (file) => {
    const W = 360;
    let canvas;
    if (/^image\//.test(file.type)) {
      const bmp = await createImageBitmap(file);
      const s = Math.min(1, W / bmp.width);
      canvas = document.createElement('canvas'); canvas.width = Math.round(bmp.width * s); canvas.height = Math.round(bmp.height * s);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    } else if (/pdf/.test(file.type) || /\.pdf$/i.test(file.name)) {
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const page = await pdf.getPage(1);
      const v0 = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: W / v0.width });
      canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    } else return null;
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.78));
    return blob ? new File([blob], 'thumb.jpg', { type: 'image/jpeg' }) : null;
  };
  D.makeThumb = (file) => makeThumb(file);
  D.thumbURL = async (fileId) => {
    if (thumbs.has(fileId)) return thumbs.get(fileId);
    const f = await App.files.get('thumb-' + fileId);
    const url = f ? URL.createObjectURL(f.blob) : null;
    thumbs.set(fileId, url); return url;
  };
  const fillThumbs = (root) => root.querySelectorAll('img[data-thumb]').forEach(async (img) => { const u = await D.thumbURL(img.dataset.thumb); if (u) { img.src = u; img.classList.add('ok'); } });

  /* ---------- validade ---------- */
  D.expiry = (d) => {
    if (!d.expiry) return null;
    const n = U.diffDays(U.today(), d.expiry);
    return n < 0 ? { cls: 'bad', txt: `vencido há ${-n} dia(s)`, n } : n <= 60 ? { cls: 'warn', txt: n === 0 ? 'vence hoje' : `vence em ${n} dia(s)`, n } : { cls: 'ok', txt: `válido até ${U.dateBR(d.expiry)}`, n };
  };
  D.expiring = (days = 60) => list().filter((d) => d.expiry && U.diffDays(U.today(), d.expiry) <= days).sort((a, b) => a.expiry.localeCompare(b.expiry));

  /* ---------- tela ---------- */
  const S = { q: '', cat: '', person: '', view: 'grid' };
  const people = () => [...new Set(list().map((d) => d.person || 'Eu'))].sort((a, b) => (a === 'Eu' ? -1 : b === 'Eu' ? 1 : a.localeCompare(b)));
  const filtered = () => {
    const words = U.norm(S.q).split(/\s+/).filter(Boolean);
    return list().filter((d) => (!S.cat || d.category === S.cat) && (!S.person || (d.person || 'Eu') === S.person) &&
      words.every((w) => U.norm([d.title, d.number, d.issuer, d.notes, d.person, D.cat(d.category).label, (d.tags || []).join(' ')].join(' ')).includes(w)))
      .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.title.localeCompare(b.title));
  };

  const card = (d) => {
    const c = D.cat(d.category), ex = D.expiry(d), f0 = (d.files || [])[0];
    return `<div class="doc-card" data-act="docView" data-id="${d.id}">
      <div class="doc-thumb" style="background:${App.alpha(c.color, .12)}">${f0 ? `<img data-thumb="${f0.id}" alt="">` : ''}<span class="doc-ico">${c.icon}</span>${(d.files || []).length > 1 ? `<span class="doc-pages">${d.files.length} arquivos</span>` : ''}</div>
      <div class="doc-info"><div class="t">${d.fav ? '⭐ ' : ''}${U.esc(d.title)}</div>
        <div class="s"><span class="dot" style="background:${c.color}"></span> ${U.esc(c.label)}${d.person && d.person !== 'Eu' ? ' · ' + U.esc(d.person) : ''}</div>
        ${d.number ? `<div class="doc-num"><code class="priv">${U.esc(d.number)}</code><button class="icon-btn" data-act="docCopy" data-id="${d.id}" title="copiar número">📋</button></div>` : ''}
        ${ex ? `<span class="chip ${ex.cls}">${ex.txt}</span>` : ''}</div></div>`;
  };

  const renderDocs = () => {
    const rows = filtered(), all = list();
    const mine = all.filter((d) => (d.person || 'Eu') === 'Eu').map((d) => ' ' + U.norm(d.title) + ' ');
    const missing = D.ESSENTIALS.filter(([, , keys]) => !mine.some((t) => keys.some((k) => t.includes(k))));
    const exp = D.expiring();
    return `<div class="row" style="justify-content:flex-end;margin:-6px 0 14px"><button class="btn primary" data-act="docAdd">＋ Documento</button></div>
      ${exp.length ? `<div class="card" style="border-color:var(--warn);margin-bottom:16px"><header><h3>⏰ Atenção à validade</h3></header><div class="list">${exp.map((d) => { const e = D.expiry(d); return `<div class="li" data-act="docView" data-id="${d.id}" style="cursor:pointer"><div class="ico">${D.cat(d.category).icon}</div><div class="grow"><div class="t">${U.esc(d.title)}</div><div class="s">validade ${U.dateBR(d.expiry)}</div></div><span class="chip ${e.cls}">${e.txt}</span></div>`; }).join('')}</div></div>` : ''}
      <div class="card"><div class="filters" style="margin:0">
        <input id="doc-q" placeholder="🔎 Buscar: CNH, reservista, número, órgão…" value="${U.esc(S.q)}" data-input="docQ" style="flex:1;min-width:220px">
        ${people().length > 1 ? `<select data-change="docPerson"><option value="">Todas as pessoas</option>${people().map((p) => `<option ${S.person === p ? 'selected' : ''}>${U.esc(p)}</option>`).join('')}</select>` : ''}
        <div class="seg"><button class="${S.view === 'grid' ? 'on' : ''}" data-act="docViewMode" data-v="grid">▦</button><button class="${S.view === 'list' ? 'on' : ''}" data-act="docViewMode" data-v="list">☰</button></div></div>
        <div class="row mt"><button class="chip ${!S.cat ? 'info' : ''}" data-act="docCat" data-c="">Todos (${all.length})</button>${Object.entries(D.CATS).filter(([k]) => all.some((d) => d.category === k)).map(([k, c]) => `<button class="chip ${S.cat === k ? 'info' : ''}" data-act="docCat" data-c="${k}">${c.icon} ${c.label} (${all.filter((d) => d.category === k).length})</button>`).join('')}</div></div>
      ${all.length ? (rows.length ? `<div class="doc-grid ${S.view} mt">${rows.map(card).join('')}</div>` : `<div class="card mt">${App.empty('🔍', 'Nada encontrado', 'Tente outra palavra ou tire os filtros.')}</div>`)
        : `<div class="card mt">${App.empty('📁', 'Guarde seus documentos aqui', 'Tire foto da frente e do verso (ou use o PDF digital, como a CNH-e) e anexe. Depois é só buscar.', '<button class="btn primary" data-act="docAdd">＋ Primeiro documento</button>')}</div>`}
      ${missing.length ? `<div class="card mt"><header><h3>✅ Documentos essenciais</h3><small class="muted">${D.ESSENTIALS.length - missing.length} de ${D.ESSENTIALS.length} guardados</small></header>
        <div class="bar" style="margin-bottom:12px"><i style="width:${((D.ESSENTIALS.length - missing.length) / D.ESSENTIALS.length) * 100}%"></i></div>
        <div class="row">${missing.map(([t, c]) => `<button class="chip" data-act="docAddSug" data-t="${U.esc(t)}" data-c="${c}">${D.cat(c).icon} ${U.esc(t)} ＋</button>`).join('')}</div></div>` : ''}
      <p class="muted mt"><small>🔒 ${App.storage.vault ? 'Seus documentos estão criptografados no cofre.' : App.storage.isRemote() ? 'Dica: crie uma senha em Ajustes → Armazenamento para criptografar seus documentos no pendrive.' : 'Os arquivos ficam só neste navegador.'}</small></p>`;
  };

  /* ---------- modais ---------- */
  const docModal = (d = {}, preset = {}) => {
    const isNew = !d.id;
    let files = (d.files || []).slice(); const added = [];
    const fileList = () => files.map((f, i) => `<div class="li"><div class="ico">${/pdf/.test(f.type || '') ? '📄' : '🖼️'}</div><div class="grow"><div class="t">${U.esc(f.label || f.name)}</div><div class="s">${U.esc(f.name)}</div></div><button type="button" class="icon-btn" data-mact="rmFile" data-i="${i}">✕</button></div>`).join('') || '<p class="muted" style="margin:0">Nenhum arquivo ainda.</p>';
    const m = App.modal({
      title: isNew ? 'Novo documento' : 'Editar documento', wide: true,
      body: F.row(F.text('Documento', 'title', d.title || preset.title || '', 'required placeholder="Ex.: CNH, Certidão de nascimento" list="doc-names"'), F.select('Categoria', 'category', Object.entries(D.CATS).map(([k, c]) => [k, `${c.icon} ${c.label}`]), d.category || preset.category || 'identidade'), F.text('De quem', 'person', d.person || 'Eu', 'list="doc-people"')) +
        `<datalist id="doc-names">${D.ESSENTIALS.map(([t]) => `<option value="${U.esc(t)}">`).join('')}</datalist><datalist id="doc-people">${['Eu', 'Esposa', 'Mãe', 'Pai', 'Filho(a)', ...people()].map((p) => `<option value="${U.esc(p)}">`).join('')}</datalist>` +
        F.row(F.text('Número', 'number', d.number || '', 'placeholder="Ex.: nº do registro, CPF…"'), F.text('Órgão emissor', 'issuer', d.issuer || '', 'placeholder="Ex.: DETRAN/SC, SSP"')) +
        F.row(F.date('Emissão', 'issued', d.issued || ''), F.date('Validade (se tiver)', 'expiry', d.expiry || ''), F.text('Etiquetas', 'tags', (d.tags || []).join(', '), 'placeholder="original, digital, autenticada"')) +
        F.area('Observações', 'notes', d.notes || '', 'rows="2" placeholder="Ex.: original na pasta azul da gaveta"') +
        `<h4 style="margin:14px 0 8px">📎 Arquivos (frente, verso, PDF digital…)</h4><div class="list" id="doc-files">${fileList()}</div>
        <div class="row mt"><label class="btn btn-file">📷 Tirar foto / escolher imagem<input type="file" accept="image/*" capture="environment" multiple data-mchange="addFiles"></label><label class="btn btn-file">📄 Anexar PDF ou arquivo<input type="file" accept=".pdf,application/pdf,image/*" multiple data-mchange="addFiles"></label></div>
        <p id="doc-prog" class="muted"></p>` +
        F.check('⭐ Favorito (aparece primeiro)', 'fav', d.fav) + (!isNew ? '' : ''),
      actions: {
        addFiles: (inp, form) => { for (const f of inp.files) { const label = files.length === 0 ? 'Frente' : files.length === 1 ? 'Verso' : `Arquivo ${files.length + 1}`; const x = { id: U.uid(), name: f.name, type: f.type, size: f.size, label, _file: f }; files.push(x); added.push(x); } inp.value = ''; form.querySelector('#doc-files').innerHTML = fileList(); },
        rmFile: (b, form) => { files.splice(+b.dataset.i, 1); form.querySelector('#doc-files').innerHTML = fileList(); },
      },
      danger: isNew ? null : { label: 'Excluir', fn: () => App.confirm(`Excluir “${U.esc(d.title)}” e seus arquivos?`, () => App.commit((s) => { (d.files || []).forEach((f) => { App.files.del(f.id); App.files.del('thumb-' + f.id); }); s.docs = s.docs.filter((x) => x.id !== d.id); })) },
      onSubmit: async (v, form) => {
        if (!v.title) { App.toast('Dê um nome ao documento.', 'error'); return false; }
        const prog = form.querySelector('#doc-prog'); form.querySelector('[type=submit]').disabled = true;
        for (const x of added.filter((a) => files.includes(a))) {
          prog.textContent = `Salvando ${x.name}…`;
          await App.files.put(x._file, x.id);
          try { const t = await makeThumb(x._file); if (t) await App.files.put(t, 'thumb-' + x.id); } catch (e) { console.warn('miniatura', e); }
          delete x._file;
        }
        (d.files || []).filter((f) => !files.includes(f)).forEach((f) => { App.files.del(f.id); App.files.del('thumb-' + f.id); thumbs.delete(f.id); });
        const o = { title: v.title.trim(), category: v.category, person: v.person.trim() || 'Eu', number: v.number.trim(), issuer: v.issuer.trim(), issued: v.issued, expiry: v.expiry, tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean), notes: v.notes, fav: !!v.fav, files: files.map(({ _file, ...f }) => f), updatedAt: U.today() };
        App.commit((s) => { s.docs = s.docs || []; if (isNew) s.docs.push({ id: U.uid(), addedAt: U.today(), ...o }); else Object.assign(s.docs.find((x) => x.id === d.id), o); });
        App.toast('Documento salvo 📁');
      },
    });
    return m;
  };

  const viewer = async (d) => {
    const c = D.cat(d.category), ex = D.expiry(d);
    const urls = [];
    for (const f of d.files || []) { const x = await App.files.get(f.id); if (x) urls.push({ f, url: URL.createObjectURL(x.blob), type: x.type || f.type }); }
    const m = App.modal({
      title: `${c.icon} ${U.esc(d.title)}`, wide: true, hideFooter: true,
      body: `<div class="doc-meta">${[['De quem', d.person], ['Número', d.number ? `<code class="priv">${U.esc(d.number)}</code> <button type="button" class="btn sm" data-mact="copy">📋 Copiar</button>` : ''], ['Órgão', d.issuer], ['Emissão', d.issued && U.dateBR(d.issued)], ['Validade', d.expiry ? `${U.dateBR(d.expiry)} <span class="chip ${ex.cls}">${ex.txt}</span>` : ''], ['Obs.', d.notes && U.esc(d.notes)]].filter(([, v]) => v).map(([k, v]) => `<div><small class="muted">${k}</small><div>${k === 'Número' || k === 'Validade' || k === 'Obs.' ? v : U.esc(v)}</div></div>`).join('')}</div>
        ${urls.length ? `<div class="doc-tabs">${urls.map((u, i) => `<button type="button" class="chip ${i ? '' : 'info'}" data-mact="page" data-i="${i}">${U.esc(u.f.label || u.f.name)}</button>`).join('')}</div>
          <div class="doc-stage" id="doc-stage"></div>
          <div class="row mt"><button type="button" class="btn" data-mact="zoomOut">－</button><button type="button" class="btn" data-mact="zoomIn">＋</button><button type="button" class="btn" data-mact="rotate">⟳ Girar</button><span style="flex:1"></span><button type="button" class="btn" data-mact="openNew">↗ Abrir em nova aba</button><button type="button" class="btn" data-mact="download">⬇ Baixar</button><button type="button" class="btn primary" data-mact="edit">✏️ Editar</button></div>`
          : `<p class="muted">Nenhum arquivo anexado.</p><button type="button" class="btn primary" data-mact="edit">✏️ Editar / anexar</button>`}`,
      actions: {
        page: (b) => show(+b.dataset.i),
        zoomIn: () => { z = Math.min(4, z + 0.25); apply(); }, zoomOut: () => { z = Math.max(0.5, z - 0.25); apply(); }, rotate: () => { r = (r + 90) % 360; apply(); },
        openNew: () => window.open(urls[cur].url, '_blank'),
        download: () => { const a = document.createElement('a'); a.href = urls[cur].url; a.download = urls[cur].f.name; a.click(); },
        copy: () => copyNum(d),
        edit: (_, __, close) => { close(); docModal(d); },
      },
    });
    let cur = 0, z = 1, r = 0;
    const stage = m.form.querySelector('#doc-stage');
    const apply = () => { const el = stage.firstElementChild; if (el && el.tagName === 'IMG') el.style.transform = `scale(${z}) rotate(${r}deg)`; };
    const show = (i) => {
      cur = i; z = 1; r = 0;
      m.form.querySelectorAll('.doc-tabs .chip').forEach((b, j) => b.classList.toggle('info', i === j));
      const u = urls[i];
      stage.innerHTML = /pdf/.test(u.type) ? `<iframe src="${u.url}" title="documento"></iframe>` : `<img src="${u.url}" alt="">`;
    };
    if (urls.length) show(0);
    const obs = new MutationObserver(() => { if (!m.form.isConnected) { urls.forEach((u) => URL.revokeObjectURL(u.url)); obs.disconnect(); } });
    obs.observe(document.getElementById('modal-root'), { childList: true });
  };
  const copyNum = async (d) => { try { await navigator.clipboard.writeText(d.number); App.toast(`Número copiado: ${d.number}`); } catch (e) { App.toast(d.number); } };

  /* widget do início */
  D.widget = () => {
    const exp = D.expiring(90), favs = list().filter((d) => d.fav).slice(0, 6);
    return `<div class="card"><header><h3>📁 Documentos</h3><a class="btn sm ghost" href="#/documentos">abrir</a></header>
      ${exp.length ? `<div class="list">${exp.slice(0, 4).map((d) => { const e = D.expiry(d); return `<div class="li"><div class="ico">${D.cat(d.category).icon}</div><div class="grow"><div class="t">${U.esc(d.title)}</div></div><span class="chip ${e.cls}">${e.txt}</span></div>`; }).join('')}</div>` : ''}
      ${favs.length ? `<div class="row mt">${favs.map((d) => `<a class="chip" href="#/documentos" data-act="docOpenFromDash" data-id="${d.id}">${D.cat(d.category).icon} ${U.esc(d.title)}</a>`).join('')}</div>` : ''}
      ${!exp.length && !favs.length ? `<p class="muted">${list().length} documento(s) guardado(s). Marque os mais usados como ⭐ para aparecerem aqui.</p>` : ''}</div>`;
  };
  App.globalActions.docOpenFromDash = (t, e) => { e.preventDefault(); const d = list().find((x) => x.id === t.dataset.id); if (d) viewer(d); };
  D.open = (id) => { const d = list().find((x) => x.id === id); if (d) viewer(d); };

  const render = (r) => {
    const sub = { docs: renderDocs, garantias: App.Warranty.view, emergencia: App.Emergency.view }[r.sub] ? r.sub : 'docs';
    const fn = { docs: renderDocs, garantias: App.Warranty.view, emergencia: App.Emergency.view }[sub];
    return `<div class="page-head"><div><h1>📁 Documentos</h1><p>Seus documentos, notas fiscais e ficha de emergência — para achar na hora do aperto.</p></div></div>
      ${App.subtabs('documentos', [['docs', '🪪 Documentos'], ['garantias', '🧾 Garantias & notas'], ['emergencia', '🆘 Ficha de emergência']], sub)}${fn()}`;
  };

  App.views.documentos = {
    render,
    mount(el) { fillThumbs(el); const q = document.getElementById('doc-q'); if (q && S.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } },
    actions: {
      ...App.Emergency.actions,
      docAdd: () => docModal(), docAddSug: (t) => docModal({}, { title: t.dataset.t, category: t.dataset.c }),
      docView: (t, e) => { if (e.target.closest('[data-act=docCopy]')) return; D.open(t.dataset.id); },
      docCopy: (t, e) => { e.stopPropagation(); copyNum(list().find((x) => x.id === t.dataset.id)); },
      docQ: U.debounce((t) => { S.q = t.value; App.rerender(); }, 200),
      docCat: (t) => { S.cat = t.dataset.c; App.rerender(); }, docPerson: (t) => { S.person = t.value; App.rerender(); },
      docViewMode: (t) => { S.view = t.dataset.v; App.rerender(); },
    },
    quick: { doc: () => docModal() },
  };
})(window.App);
