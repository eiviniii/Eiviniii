/* ==========================================================
   MAPAS MENTAIS — imagens/PDFs por matéria e conteúdo,
   com galeria, visualizador (zoom/arrastar/tela cheia) e revisão espaçada
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const MM = (App.MindMaps = {});
  const list = () => st().mindmaps || [];
  const subj = (id) => st().subjects.find((s) => s.id === id) || { id: '', name: 'Geral', color: '#64748b' };

  /* ---------- revisão espaçada: 1, 3, 7, 15, 30, 60 dias ---------- */
  const STEPS = [1, 3, 7, 15, 30, 60];
  MM.nextReview = (m) => {
    const r = m.reviews || [];
    if (!r.length) return null;
    return U.addDays(r[r.length - 1], STEPS[Math.min(r.length - 1, STEPS.length - 1)]);
  };
  MM.status = (m) => {
    const n = MM.nextReview(m);
    if (!n) return { cls: '', txt: 'nunca revisado', due: false };
    const d = U.diffDays(U.today(), n);
    return d <= 0 ? { cls: 'warn', txt: d === 0 ? 'revisar hoje' : `revisar (atrasado ${-d}d)`, due: true } : { cls: 'ok', txt: `próx. revisão ${U.dateBR(n).slice(0, 5)}`, due: false };
  };
  MM.due = () => list().filter((m) => MM.status(m).due);

  const topicsFor = (sid) => {
    const t = new Set(list().filter((m) => !sid || m.subjectId === sid).map((m) => m.topic).filter(Boolean));
    (st().questions || []).forEach((q) => { if (q.topic && (!sid || q.subjectId === sid)) t.add(q.topic); });
    (st().concursos || []).forEach((c) => (c.topics || []).forEach((x) => { if (!sid || U.norm(subj(sid).name) === U.norm(x.subject || '')) t.add(x.title); }));
    return [...t].sort((a, b) => a.localeCompare(b));
  };

  /* ---------- tela ---------- */
  const S = { sid: '', topic: '', q: '', only: '' };
  const filtered = () => {
    const w = U.norm(S.q).split(/\s+/).filter(Boolean);
    return list().filter((m) => (!S.sid || m.subjectId === S.sid) && (!S.topic || m.topic === S.topic) && (S.only !== 'due' || MM.status(m).due) && (S.only !== 'fav' || m.fav)
      && w.every((x) => U.norm([m.title, m.topic, m.notes, m.name, subj(m.subjectId).name].join(' ')).includes(x)))
      .sort((a, b) => subj(a.subjectId).name.localeCompare(subj(b.subjectId).name) || (a.topic || '').localeCompare(b.topic || '') || (a.title || '').localeCompare(b.title || ''));
  };
  const card = (m) => {
    const s = MM.status(m), c = subj(m.subjectId);
    return `<div class="mm-card" data-act="mmOpen" data-id="${m.id}" style="--c:${c.color}">
      <div class="mm-thumb"><img data-mmthumb="${m.fileId}" alt=""><span>${/pdf/.test(m.type) ? '📄' : '🧠'}</span></div>
      <div class="mm-info"><div class="t">${U.esc(m.title || m.name)}</div>
        <div class="s"><span class="dot" style="background:${c.color}"></span> ${U.esc(c.name)}${m.topic ? ' · ' + U.esc(m.topic) : ''}</div>
        <div class="row" style="gap:6px;margin-top:6px"><span class="chip ${s.cls}">${s.txt}</span>${m.fav ? '<span>⭐</span>' : ''}</div></div></div>`;
  };
  MM.view = () => {
    const all = list(), fl = filtered(), due = MM.due();
    const bySubj = U.groupBy(fl, (m) => m.subjectId || '');
    const subjIds = [...new Set(all.map((m) => m.subjectId || ''))];
    return `<div class="grid g4">
      <div class="card accent stat"><div class="lbl">Mapas mentais</div><div class="val">${all.length}</div><div class="sub">${subjIds.length} matéria(s)</div></div>
      <div class="card stat"><div class="lbl">Conteúdos</div><div class="val">${new Set(all.map((m) => m.subjectId + '|' + (m.topic || ''))).size}</div><div class="sub">assuntos com mapa</div></div>
      <div class="card stat"><div class="lbl">Para revisar</div><div class="val ${due.length ? 'delta badd' : ''}">${due.length}</div><div class="sub">${due.length ? `<a href="#" data-act="mmOnly" data-v="due">ver agora</a>` : 'tudo em dia'}</div></div>
      <div class="card stat"><div class="lbl">Revisões feitas</div><div class="val">${U.sum(all, (m) => (m.reviews || []).length)}</div><div class="sub">${all.filter((m) => (m.reviews || []).includes(U.today())).length} hoje</div></div></div>
    <div class="grid g2 mt" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">
      <div class="card"><header><h3>📤 Subir mapa mental</h3></header>
        <form data-submit="mmUpload">
          <label class="drop" style="padding:16px"><input type="file" name="files" accept="image/*,.pdf,application/pdf" multiple><b>🧠 Escolher imagens ou PDFs</b><small id="mm-chosen">JPG, PNG, WEBP ou PDF — pode escolher vários</small></label>
          ${F.field('Matéria', `<select name="subjectId" required><option value="">— escolher —</option>${st().subjects.map((x) => `<option value="${x.id}" ${S.sid === x.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}<option value="__new">＋ nova matéria…</option></select>`)}
          ${F.text('Conteúdo / assunto', 'topic', S.topic, 'list="mm-topics" placeholder="Ex.: Crase, Iter criminis…"')}
          <datalist id="mm-topics">${topicsFor('').map((t) => `<option value="${U.esc(t)}">`).join('')}</datalist>
          ${F.text('Título (opcional)', 'title', '', 'placeholder="se vazio, usa o nome do arquivo"')}
          <button class="btn primary block mt">Salvar mapa(s)</button></form>
        <p class="muted"><small>Dica: no visualizador, use a rodinha do mouse para dar zoom, arraste para mover e ← → para passar entre os mapas.</small></p></div>
      <div class="card"><header><h3>🗂️ Galeria</h3>
          <input placeholder="🔎 Buscar título, conteúdo, anotação…" value="${U.esc(S.q)}" data-input="mmSearch" id="mm-search" style="max-width:280px"></header>
        <div class="row" style="gap:6px">
          <button class="chip ${!S.sid ? 'info' : ''}" data-act="mmSub" data-id="">Todas</button>
          ${subjIds.map((id) => `<button class="chip ${S.sid === id ? 'info' : ''}" data-act="mmSub" data-id="${id}"><span class="dot" style="background:${subj(id).color}"></span> ${U.esc(subj(id).name)} <small>${all.filter((m) => (m.subjectId || '') === id).length}</small></button>`).join('')}
          <span style="flex:1"></span>
          <button class="chip ${S.only === 'due' ? 'warn' : ''}" data-act="mmOnly" data-v="due">⏰ revisar</button>
          <button class="chip ${S.only === 'fav' ? 'info' : ''}" data-act="mmOnly" data-v="fav">⭐ favoritos</button></div>
        ${S.sid ? `<div class="row mt" style="gap:6px"><small class="muted">Conteúdo:</small> <button class="chip ${!S.topic ? 'info' : ''}" data-act="mmTopic" data-t="">todos</button>${[...new Set(all.filter((m) => m.subjectId === S.sid).map((m) => m.topic || ''))].sort().map((t) => `<button class="chip ${S.topic === t && t ? 'info' : ''}" data-act="mmTopic" data-t="${U.esc(t)}">${U.esc(t || 'sem conteúdo')}</button>`).join('')}</div>` : ''}
        ${!all.length ? '<div class="empty mt"><div class="big">🧠</div><p>Nenhum mapa mental ainda. Suba suas imagens ou PDFs ao lado, escolhendo a matéria e o conteúdo.</p></div>'
          : !fl.length ? '<p class="muted mt">Nada encontrado com esse filtro.</p>'
          : Object.entries(bySubj).map(([sid, arr]) => { const tops = U.groupBy(arr, (m) => m.topic || ''); return `<div class="mm-group"><h4><span class="dot" style="background:${subj(sid).color}"></span> ${U.esc(subj(sid).name)} <small class="muted">${arr.length}</small></h4>
            ${Object.entries(tops).map(([t, ms]) => `${t || Object.keys(tops).length > 1 ? `<div class="mm-topic">${U.esc(t || 'Sem conteúdo definido')} <small class="muted">${ms.length}</small></div>` : ''}<div class="mm-grid">${ms.map(card).join('')}</div>`).join('')}</div>`; }).join('')}</div></div>`;
  };

  const thumbs = new Map();
  const thumbURL = async (fileId) => {
    if (thumbs.has(fileId)) return thumbs.get(fileId);
    const f = await App.files.get('thumb-' + fileId);
    const url = f ? URL.createObjectURL(f.blob) : null;
    thumbs.set(fileId, url); return url;
  };
  MM.mount = (el) => {
    const inp = el.querySelector('[data-submit=mmUpload] [name=files]'), ch = el.querySelector('#mm-chosen');
    if (inp && ch) inp.addEventListener('change', () => { ch.textContent = [...inp.files].map((f) => f.name).join(', '); });
    el.querySelectorAll('img[data-mmthumb]').forEach(async (img) => { const u = await thumbURL(img.dataset.mmthumb); if (u) { img.src = u; img.classList.add('ok'); } });
    const s = el.querySelector('#mm-search'); if (s && S._focus) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); S._focus = false; }
  };

  /* ---------- salvar ---------- */
  const ensureSubject = (v) => {
    if (v.subjectId !== '__new') return v.subjectId;
    const name = (prompt('Nome da nova matéria:') || '').trim(); if (!name) return null;
    const id = U.uid(); const colors = ['#7c5cff', '#22d3ee', '#f97316', '#22c55e', '#ec4899', '#eab308', '#3b82f6', '#ef4444', '#14b8a6', '#a855f7'];
    App.commit((x) => { x.subjects.push({ id, name, color: colors[x.subjects.length % colors.length], goalHours: 5 }); });
    return id;
  };
  MM.add = async (files, { subjectId, topic, title }) => {
    const out = [];
    for (const f of files) {
      if (!/^image\//.test(f.type) && !/pdf/.test(f.type) && !/\.pdf$/i.test(f.name)) continue;
      const fileId = await App.files.put(f);
      try { const t = await App.Docs.makeThumb(f); if (t) await App.files.put(t, 'thumb-' + fileId); } catch (e) { console.warn('miniatura', e); }
      out.push({ id: U.uid(), subjectId, topic: (topic || '').trim(), title: (files.length > 1 || !title ? f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') : title).trim(), name: f.name, type: f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : ''), size: f.size, fileId, reviews: [], notes: '', fav: false, addedAt: U.today() });
    }
    if (out.length) App.commit((x) => { x.mindmaps = x.mindmaps || []; x.mindmaps.push(...out); });
    return out;
  };

  /* ---------- visualizador ---------- */
  const viewer = async (id) => {
    const seq = filtered().map((m) => m.id); if (!seq.includes(id)) seq.unshift(id);
    let idx = seq.indexOf(id), url = null, z = 1, x0 = 0, y0 = 0;
    const m = App.modal({
      title: '🧠 Mapa mental', wide: true, hideFooter: true,
      body: `<div class="row" style="gap:8px;margin-bottom:8px"><div class="grow" id="mm-head"></div></div>
        <div class="mm-stage" id="mm-stage"></div>
        <div class="row mt" style="gap:6px">
          <button type="button" class="btn" data-mact="prev" title="anterior (←)">‹</button><button type="button" class="btn" data-mact="next" title="próximo (→)">›</button>
          <button type="button" class="btn" data-mact="zoomOut">－</button><button type="button" class="btn" data-mact="fit">Ajustar</button><button type="button" class="btn" data-mact="zoomIn">＋</button>
          <button type="button" class="btn" data-mact="full">⛶ Tela cheia</button><button type="button" class="btn" data-mact="openNew" title="abrir o arquivo original">↗</button>
          <span style="flex:1"></span>
          <button type="button" class="btn" data-mact="fav" id="mm-fav">☆</button>
          <button type="button" class="btn" data-mact="edit">✏️ Editar</button>
          <button type="button" class="btn danger" data-mact="del">🗑️</button>
          <button type="button" class="btn primary" data-mact="review">✅ Revisei hoje</button></div>`,
      actions: {
        prev: () => show(idx - 1), next: () => show(idx + 1),
        openNew: () => url && window.open(url, '_blank'),
        zoomIn: () => zoom(1.25), zoomOut: () => zoom(0.8), fit: () => { z = 1; x0 = y0 = 0; apply(); },
        full: () => { const el = stage; (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen()).catch?.(() => {}); },
        fav: () => { App.commit((x) => { const it = x.mindmaps.find((y) => y.id === seq[idx]); it.fav = !it.fav; }); head(); },
        review: () => {
          App.commit((x) => { const it = x.mindmaps.find((y) => y.id === seq[idx]); it.reviews = it.reviews || []; if (!it.reviews.includes(U.today())) it.reviews.push(U.today()); });
          const it = cur(); App.toast(`Revisão registrada ✅ ${MM.status(it).txt}`);
          head();
        },
        edit: (_, __, close) => { close(); editModal(cur()); },
        del: (_, __, close) => { const it = cur(); close(); App.confirm(`Excluir o mapa “${U.esc(it.title || it.name)}”?`, () => remove(it.id)); },
      },
    });
    const stage = m.form.querySelector('#mm-stage');
    const cur = () => list().find((y) => y.id === seq[idx]);
    const head = () => {
      const it = cur(); if (!it) return; const s = MM.status(it), c = subj(it.subjectId);
      m.form.querySelector('#mm-head').innerHTML = `<b>${U.esc(it.title || it.name)}</b> <span class="muted"><span class="dot" style="background:${c.color}"></span> ${U.esc(c.name)}${it.topic ? ' · ' + U.esc(it.topic) : ''} · ${idx + 1}/${seq.length}</span> <span class="chip ${s.cls}">${s.txt}</span>${(it.reviews || []).length ? ` <small class="muted">${it.reviews.length} revisão(ões)</small>` : ''}${it.notes ? `<div class="muted" style="margin-top:4px;white-space:pre-wrap"><small>${U.esc(it.notes)}</small></div>` : ''}`;
      m.form.querySelector('#mm-fav').textContent = it.fav ? '⭐' : '☆';
    };
    const apply = () => { const img = stage.querySelector('.mm-doc'); if (img) img.style.transform = `translate(${x0}px, ${y0}px) scale(${z})`; };
    const zoom = (k) => { z = Math.min(8, Math.max(0.3, z * k)); apply(); };
    const show = async (i) => {
      if (i < 0 || i >= seq.length) return;
      idx = i; z = 1; x0 = y0 = 0; head();
      if (url) URL.revokeObjectURL(url); url = null;
      const it = cur(); const f = it && (await App.files.get(it.fileId));
      if (!f) { stage.innerHTML = '<p class="muted" style="padding:20px">Arquivo não encontrado.</p>'; return; }
      url = URL.createObjectURL(f.blob);
      if (!/pdf/.test(f.type || it.type)) { stage.innerHTML = `<div class="mm-doc"><img src="${url}" alt="" draggable="false"></div>`; return; }
      // PDF: desenha as páginas como imagem (funciona sem leitor de PDF e permite zoom/arrastar)
      stage.innerHTML = '<p class="muted" style="padding:20px">Abrindo PDF…</p>';
      const my = idx;
      try {
        const pdf = await App.parse.openPdf(f.blob);
        const doc = document.createElement('div'); doc.className = 'mm-doc';
        const W = Math.min(2000, Math.max(900, stage.clientWidth * (window.devicePixelRatio || 1)));
        for (let n = 1; n <= Math.min(pdf.numPages, 30); n++) {
          const page = await pdf.getPage(n); const v0 = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: W / v0.width });
          const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          doc.appendChild(c);
          if (n === 1) { if (my !== idx) return; stage.innerHTML = ''; stage.appendChild(doc); }
        }
        if (pdf.numPages > 30) doc.insertAdjacentHTML('beforeend', `<p class="muted">… mais ${pdf.numPages - 30} página(s) — use “Abrir arquivo”.</p>`);
      } catch (e) { stage.innerHTML = `<iframe src="${url}" title="mapa mental"></iframe>`; }
    };
    // zoom com a rodinha e arrastar para mover
    stage.addEventListener('wheel', (e) => { if (!stage.querySelector('.mm-doc')) return; e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 0.87); }, { passive: false });
    let drag = null;
    stage.addEventListener('pointerdown', (e) => { if (!stage.querySelector('.mm-doc')) return; drag = { x: e.clientX - x0, y: e.clientY - y0 }; stage.setPointerCapture(e.pointerId); stage.classList.add('drag'); });
    stage.addEventListener('pointermove', (e) => { if (!drag) return; x0 = e.clientX - drag.x; y0 = e.clientY - drag.y; apply(); });
    const end = () => { drag = null; stage.classList.remove('drag'); };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('dblclick', () => { if (z > 1.01) { z = 1; x0 = y0 = 0; } else z = 2.2; apply(); });
    const onKey = (e) => {
      if (!m.form.isConnected) return document.removeEventListener('keydown', onKey);
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      if (e.key === 'ArrowLeft') show(idx - 1); else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === '+' || e.key === '=') zoom(1.25); else if (e.key === '-') zoom(0.8);
    };
    document.addEventListener('keydown', onKey);
    const obs = new MutationObserver(() => { if (!m.form.isConnected) { if (url) URL.revokeObjectURL(url); document.removeEventListener('keydown', onKey); obs.disconnect(); App.rerender(); } });
    obs.observe(document.getElementById('modal-root'), { childList: true });
    show(idx);
  };

  const remove = (id) => App.commit((x) => {
    const it = x.mindmaps.find((y) => y.id === id); if (!it) return;
    App.files.del(it.fileId); App.files.del('thumb-' + it.fileId); thumbs.delete(it.fileId);
    x.mindmaps = x.mindmaps.filter((y) => y.id !== id);
  });

  const editModal = (it) => App.modal({
    title: '✏️ Editar mapa mental',
    body: `${F.text('Título', 'title', it.title || '')}
      ${F.row(F.field('Matéria', `<select name="subjectId">${st().subjects.map((x) => `<option value="${x.id}" ${it.subjectId === x.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select>`), F.text('Conteúdo / assunto', 'topic', it.topic || '', 'list="mm-topics-e"'))}
      <datalist id="mm-topics-e">${topicsFor('').map((t) => `<option value="${U.esc(t)}">`).join('')}</datalist>
      ${F.area ? F.area('Anotações', 'notes', it.notes || '') : `<label class="field"><span>Anotações</span><textarea name="notes" rows="3">${U.esc(it.notes || '')}</textarea></label>`}
      ${(it.reviews || []).length ? `<p class="muted"><small>Revisões: ${it.reviews.map((d) => U.dateBR(d)).join(', ')}</small> <a href="#" data-mact="reset">zerar revisões</a></p>` : ''}`,
    actions: { reset: (_, e) => { e && e.preventDefault && e.preventDefault(); App.commit((x) => { x.mindmaps.find((y) => y.id === it.id).reviews = []; }); App.toast('Revisões zeradas'); } },
    onSubmit: (v) => { App.commit((x) => { Object.assign(x.mindmaps.find((y) => y.id === it.id), { title: v.title.trim(), subjectId: v.subjectId, topic: v.topic.trim(), notes: v.notes }); }); App.toast('Mapa atualizado'); },
  });

  /* ---------- widget (painel de estudos / início) ---------- */
  MM.widget = () => {
    const due = MM.due(); if (!due.length) return '';
    return `<div class="card"><header><h3>🧠 Mapas para revisar hoje</h3><a class="btn sm ghost" href="#/estudos/mapas">abrir</a></header>
      <div class="list">${due.slice(0, 5).map((m) => `<div class="li" data-act="mmOpen" data-id="${m.id}" style="cursor:pointer"><div class="ico" style="background:${App.alpha(subj(m.subjectId).color, .18)}">🧠</div><div class="grow"><div class="t">${U.esc(m.title || m.name)}</div><div class="s">${U.esc(subj(m.subjectId).name)}${m.topic ? ' · ' + U.esc(m.topic) : ''}</div></div><span class="chip warn">${MM.status(m).txt}</span></div>`).join('')}</div></div>`;
  };

  MM.open = (id) => viewer(id);
  MM.actions = {
    mmOpen: (t, e) => { e && e.preventDefault && e.preventDefault(); viewer(t.dataset.id); },
    mmSub: (t) => { S.sid = S.sid === t.dataset.id && t.dataset.id ? '' : t.dataset.id; S.topic = ''; App.rerender(); },
    mmTopic: (t) => { S.topic = t.dataset.t; App.rerender(); },
    mmOnly: (t, e) => { e && e.preventDefault && e.preventDefault(); S.only = S.only === t.dataset.v ? '' : t.dataset.v; App.rerender(); },
    mmSearch: (t) => { S.q = t.value; S._focus = true; clearTimeout(S._t); S._t = setTimeout(() => App.rerender(), 180); },
    mmUpload: async (form) => {
      const v = App.formData(form);
      const files = [...(form.querySelector('[name=files]').files || [])];
      if (!files.length) return App.toast('Escolha ao menos uma imagem ou PDF', 'error');
      if (!v.subjectId) return App.toast('Escolha a matéria', 'error');
      const sid = ensureSubject(v); if (!sid) return;
      App.toast('Salvando mapa(s)…');
      try {
        const out = await MM.add(files, { subjectId: sid, topic: v.topic, title: v.title });
        S.sid = sid; S.topic = ''; App.rerender();
        App.toast(out.length ? `${out.length} mapa(s) mental(is) salvo(s) 🧠` : 'Nenhum arquivo de imagem/PDF reconhecido', out.length ? 'ok' : 'error');
      } catch (e) { App.toast('Falha ao salvar: ' + e.message, 'error'); }
    },
  };
  App.globalActions.mmOpen = MM.actions.mmOpen;
})(window.App);
