/* ==========================================================
   BIBLIOTECA — PDFs por data/assunto com busca no conteúdo
   O texto de cada PDF é extraído uma vez e guardado junto
   (arquivo "txt-<id>"), então a busca funciona offline.
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const L = (App.Lib = {});
  const cache = new Map(); // fileId -> { raw, norm }

  // normalização caractere a caractere (mantém os índices alinhados com o texto original)
  const normChars = (s) => { let o = ''; for (const ch of s) { const n = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); o += n.length === 1 ? n : n[0] || ' '; } return o; };

  const canText = (f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf' || /\.(txt|md|csv)$/i.test(f.name);

  /** Salva os arquivos e extrai o texto. meta: { subjectId, date, topic, tags, ocr } */
  L.addFiles = async (files, meta, onProgress) => {
    let n = 0;
    for (const f of files) {
      onProgress && onProgress(`Salvando ${f.name}…`);
      const fileId = await App.files.put(f);
      const m = { id: U.uid(), subjectId: meta.subjectId || '', name: f.name, size: f.size, fileId, addedAt: U.today(), date: meta.date || U.today(), topic: meta.topic || '', tags: meta.tags || [], hasText: false };
      try {
        let text = '';
        if (canText(f)) { onProgress && onProgress(`Lendo o conteúdo de ${f.name}…`); text = /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? await App.parse.pdfText(f) : await f.text(); }
        else if (meta.ocr && /^image\//.test(f.type)) { onProgress && onProgress(`Lendo imagem ${f.name} (OCR)…`); text = await App.parse.ocr(f); }
        if (text && text.trim()) { await App.files.put(new File([text], f.name + '.txt', { type: 'text/plain' }), 'txt-' + fileId); m.hasText = true; m.chars = text.length; cache.set(fileId, { raw: text, norm: normChars(text) }); }
        else if (/\.pdf$/i.test(f.name)) m.scanned = true; // PDF de imagem (escaneado): sem texto
      } catch (e) { console.warn('texto não extraído', e); }
      st().materials.push(m); n++;
    }
    App.save();
    return n;
  };

  L.text = async (m) => {
    if (!m.hasText) return null;
    if (cache.has(m.fileId)) return cache.get(m.fileId);
    const f = await App.files.get('txt-' + m.fileId); if (!f) return null;
    const raw = await f.blob.text(); const v = { raw, norm: normChars(raw) }; cache.set(m.fileId, v); return v;
  };
  L.forget = (fileId) => { cache.delete(fileId); App.files.del('txt-' + fileId); };

  const esc = U.esc;
  const snippetAt = (raw, idx, len, words) => {
    const a = Math.max(0, idx - 70), b = Math.min(raw.length, idx + len + 110);
    let s = raw.slice(a, b).replace(/\s+/g, ' ');
    let h = esc(s);
    for (const w of words) { const re = new RegExp(`(${w.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\u0300-\\u036f]?').join('')})`, 'gi'); h = h.replace(re, '<mark>$1</mark>'); }
    return (a > 0 ? '…' : '') + h + (b < raw.length ? '…' : '');
  };

  /** Busca em nome, assunto, tags, matéria e no conteúdo. */
  L.search = async (q, limit = 50, filt = {}) => {
    const words = U.norm(q).split(/\s+/).filter((w) => w.length > 1);
    const out = [];
    const subj = (id) => (st().subjects.find((s) => s.id === id) || {}).name || '';
    for (const m of st().materials) {
      if (filt.subjectId && m.subjectId !== filt.subjectId) continue;
      if (filt.from && (m.date || m.addedAt) < filt.from) continue;
      if (filt.to && (m.date || m.addedAt) > filt.to) continue;
      if (!words.length) { out.push({ m, score: 0, hits: 0, snippet: '' }); continue; }
      const meta = U.norm([m.name, m.topic, (m.tags || []).join(' '), subj(m.subjectId)].join(' '));
      const t = await L.text(m);
      let score = 0, hits = 0, snippet = '', ok = true;
      for (const w of words) {
        const inMeta = meta.includes(w);
        let c = 0, first = -1;
        if (t) { let i = t.norm.indexOf(w); first = i; while (i >= 0 && c < 999) { c++; i = t.norm.indexOf(w, i + w.length); } }
        if (!inMeta && !c) { ok = false; break; }
        score += (inMeta ? 50 : 0) + c; hits += c;
        if (!snippet && first >= 0) snippet = snippetAt(t.raw, first, w.length, words);
      }
      if (ok) out.push({ m, score, hits, snippet: snippet || esc([m.topic, (m.tags || []).join(', ')].filter(Boolean).join(' · ')) });
    }
    out.sort((a, b) => b.score - a.score || String(b.m.date || b.m.addedAt).localeCompare(String(a.m.date || a.m.addedAt)));
    return out.slice(0, limit);
  };

  /* ---------- tela (Estudos → Biblioteca) ---------- */
  const S = { q: '', subjectId: '', from: '', to: '', results: null, busy: false };
  L.view = () => {
    const mats = st().materials;
    const subjOpts = [['', 'Todas as matérias'], ...st().subjects.map((s) => [s.id, s.name])];
    const res = S.results;
    const subj = (id) => st().subjects.find((s) => s.id === id) || { name: 'Geral', color: '#64748b' };
    const row = (r) => {
      const m = r.m, s = subj(m.subjectId);
      return `<div class="lib-item"><div class="lib-ico" style="background:${App.alpha(s.color, .18)};color:${s.color}">📄</div>
        <div class="grow"><div class="t">${esc(m.name)}</div>
          <div class="s"><span class="chip" style="border-color:${s.color}">${esc(s.name)}</span> ${m.topic ? `<b>${esc(m.topic)}</b> · ` : ''}📅 ${U.dateBR(m.date || m.addedAt)}${(m.tags || []).length ? ' · ' + m.tags.map((x) => '#' + esc(x)).join(' ') : ''}${m.scanned ? ' · <span class="chip warn" title="PDF de imagem: não dá para buscar dentro">sem texto</span>' : ''}${r.hits ? ` · <span class="chip info">${r.hits} ocorrência(s)</span>` : ''}</div>
          ${r.snippet ? `<div class="snip">${r.snippet}</div>` : ''}</div>
        <div class="lib-actions"><button class="btn sm" data-act="openFile" data-id="${m.fileId}">Abrir</button><button class="icon-btn" data-act="libEdit" data-id="${m.id}">✏️</button></div></div>`;
    };
    const list = res || mats.slice().sort((a, b) => String(b.date || b.addedAt).localeCompare(String(a.date || a.addedAt))).map((m) => ({ m }));
    const groups = U.groupBy(list, (r) => (res && S.q ? 'Resultados' : U.ymLabel((r.m.date || r.m.addedAt).slice(0, 7))));
    return `<div class="grid g3">
      <div class="card span2"><header><h3>🔎 Encontrar nos seus PDFs</h3><small class="muted">${mats.length} arquivo(s) · ${mats.filter((m) => m.hasText).length} com texto pesquisável</small></header>
        <form data-submit="libSearch" class="filters" style="margin:0">
          <input name="q" value="${esc(S.q)}" placeholder="Ex.: crase, art. 5º, princípio da legalidade, 'lei 8.112'…" style="flex:1;min-width:220px" autofocus>
          <select name="subjectId">${subjOpts.map(([v, l]) => `<option value="${v}" ${S.subjectId === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
          <input type="date" name="from" value="${S.from}" title="de"><input type="date" name="to" value="${S.to}" title="até">
          <button class="btn primary">${S.busy ? 'Buscando…' : 'Buscar'}</button>${res ? '<button type="button" class="btn ghost" data-act="libClear">Limpar</button>' : ''}
        </form></div>
      <div class="card"><header><h3>⬆ Subir PDFs</h3></header>
        <form data-submit="libUpload">
          <label class="drop" style="padding:16px"><input type="file" name="files" multiple accept=".pdf,application/pdf,.txt,.md,image/*,.doc,.docx,.ppt,.pptx"><b>📎 Escolher arquivos</b><small id="lib-chosen">PDF, imagens, Word…</small></label>
          ${F.row(F.date('Estudado em', 'date', U.today()), F.select('Matéria', 'subjectId', [['', 'Geral'], ...st().subjects.map((s) => [s.id, s.name])], S.subjectId))}
          ${F.row(F.text('Assunto', 'topic', '', 'placeholder="Ex.: Crase — regras e exceções"'))}
          ${F.row(F.text('Etiquetas (vírgula)', 'tags', '', 'placeholder="revisar, prova PM, resumo"'))}
          ${F.check('Ler texto de imagens (OCR, mais lento)', 'ocr', false)}
          <button class="btn primary block mt" id="lib-btn">Salvar na biblioteca</button></form></div>
    </div>
    <div class="card mt">${list.length ? Object.entries(groups).map(([g, rs]) => `<h4 class="lib-group">${esc(g)} <small class="muted">${rs.length}</small></h4>${rs.map(row).join('')}`).join('')
      : App.empty(res ? '🔍' : '📚', res ? 'Nada encontrado' : 'Biblioteca vazia', res ? 'Tente outra palavra ou tire os filtros.' : 'Suba seus PDFs com a data e o assunto. Depois é só pesquisar qualquer palavra que esteja dentro deles.')}</div>`;
  };

  const editModal = (m) => App.modal({
    title: 'Editar material',
    body: F.row(F.text('Nome', 'name', m.name), F.date('Estudado em', 'date', m.date || m.addedAt)) + F.row(F.select('Matéria', 'subjectId', [['', 'Geral'], ...st().subjects.map((s) => [s.id, s.name])], m.subjectId), F.select('Status', 'status', [['', 'Não lido'], ['lendo', 'Lendo'], ['lido', 'Lido ✓']], m.status || '')) +
      F.row(F.text('Assunto', 'topic', m.topic || '')) + F.row(F.text('Etiquetas', 'tags', (m.tags || []).join(', '))),
    danger: { label: 'Excluir', fn: () => App.commit((x) => { App.files.del(m.fileId); L.forget(m.fileId); x.materials = x.materials.filter((y) => y.id !== m.id); }) },
    onSubmit: (d) => App.commit(() => Object.assign(m, d, { tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean) })),
  });

  L.actions = {
    libSearch: async (form) => {
      const d = App.formData(form); Object.assign(S, { q: d.q, subjectId: d.subjectId, from: d.from, to: d.to, busy: true });
      S.results = await L.search(S.q, 200, S); S.busy = false; App.rerender();
    },
    libClear: () => { Object.assign(S, { q: '', from: '', to: '', results: null }); App.rerender(); },
    libEdit: (t) => editModal(st().materials.find((m) => m.id === t.dataset.id)),
    libUpload: async (form) => {
      const d = App.formData(form); const files = [...(d.files || [])];
      if (!files.length) return App.toast('Escolha os arquivos.', 'error');
      const btn = form.querySelector('#lib-btn'); btn.disabled = true;
      try {
        const n = await L.addFiles(files, { subjectId: d.subjectId, date: d.date, topic: d.topic, tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean), ocr: d.ocr }, (msg) => { btn.textContent = msg; });
        App.toast(`📚 ${n} arquivo(s) na biblioteca — já dá para pesquisar dentro deles`);
      } catch (e) { App.toast('Erro: ' + e.message, 'error'); }
      S.results = null; App.rerender();
    },
  };
  L.quickUpload = () => App.go('estudos/biblioteca');
})(window.App);
