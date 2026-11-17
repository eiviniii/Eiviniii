/* ==========================================================
   CADERNO DE ANOTAÇÕES — pastas, fixar, cores, checklists, anexos
   Linhas "[ ] tarefa" viram caixinhas marcáveis.
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const N = (App.Notes = {});
  const COLORS = ['', '#7c5cff', '#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899'];
  N.book = () => {
    const s = st();
    if (!s.book) { s.book = []; if (s.notes && s.notes.trim()) s.book.push({ id: 'quick', title: 'Notas rápidas', body: s.notes, folder: 'Geral', pinned: true, updated: new Date().toISOString() }); }
    return s.book;
  };
  N.quick = () => { let q = N.book().find((n) => n.id === 'quick'); if (!q) { q = { id: 'quick', title: 'Notas rápidas', body: '', folder: 'Geral', pinned: true, updated: new Date().toISOString() }; N.book().unshift(q); } return q; };
  const S = { id: null, folder: '', q: '', mode: 'view' };
  const folders = () => [...new Set(N.book().map((n) => n.folder || 'Geral'))].sort();
  const summary = (b) => (b || '').replace(/\[( |x)\]/gi, '').replace(/\s+/g, ' ').slice(0, 90);
  const checks = (b) => { const all = (b || '').match(/\[( |x)\]/gi) || []; return { n: all.length, done: all.filter((x) => /x/i.test(x)).length }; };

  /** visualização: links clicáveis, [ ] viram caixinhas, # títulos */
  const render = (n) => U.esc(n.body || '').split('\n').map((l, i) => {
    let m;
    if ((m = l.match(/^\s*[-*]?\s*\[( |x)\]\s?(.*)$/i))) return `<label class="nb-check ${/x/i.test(m[1]) ? 'done' : ''}"><input type="checkbox" data-change="nbTick" data-line="${i}" ${/x/i.test(m[1]) ? 'checked' : ''}><span>${link(m[2])}</span></label>`;
    if ((m = l.match(/^#{1,3}\s+(.*)$/))) return `<h4>${link(m[1])}</h4>`;
    if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) return `<div class="nb-li">• ${link(m[1])}</div>`;
    return l.trim() ? `<p>${link(l)}</p>` : '<br>';
  }).join('');
  const link = (s) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  N.view = () => {
    const words = U.norm(S.q).split(/\s+/).filter(Boolean);
    const list = N.book().filter((n) => (!S.folder || (n.folder || 'Geral') === S.folder) && words.every((w) => U.norm(n.title + ' ' + n.body + ' ' + (n.folder || '')).includes(w)))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.updated).localeCompare(String(a.updated)));
    const cur = N.book().find((n) => n.id === S.id) || null;
    return `<div class="page-head"><div><h1>🗒️ Caderno</h1><p>Anotações, listas e ideias — com pastas, busca e caixinhas de marcar.</p></div><div class="actions"><button class="btn primary" data-act="nbNew">＋ Nova nota</button></div></div>
    <div class="nb">
      <div class="card nb-side">
        <input placeholder="🔎 Buscar nas notas" value="${U.esc(S.q)}" data-input="nbQ" id="nb-q">
        <div class="row mt"><button class="chip ${!S.folder ? 'info' : ''}" data-act="nbFolder" data-f="">Todas (${N.book().length})</button>${folders().map((f) => `<button class="chip ${S.folder === f ? 'info' : ''}" data-act="nbFolder" data-f="${U.esc(f)}">📁 ${U.esc(f)}</button>`).join('')}</div>
        <div class="nb-list mt">${list.map((n) => { const c = checks(n.body); return `<div class="nb-item ${n.id === S.id ? 'on' : ''}" data-act="nbOpen" data-id="${n.id}" style="${n.color ? `border-left:4px solid ${n.color}` : ''}"><div class="t">${n.pinned ? '📌 ' : ''}${U.esc(n.title || 'Sem título')}</div><div class="s">${U.esc(summary(n.body)) || '<i>vazia</i>'}</div><div class="s">${U.esc(n.folder || 'Geral')} · ${U.dateBR(String(n.updated).slice(0, 10))}${c.n ? ` · ☑ ${c.done}/${c.n}` : ''}${(n.files || []).length ? ` · 📎${n.files.length}` : ''}</div></div>`; }).join('') || '<p class="muted">Nenhuma nota.</p>'}</div>
      </div>
      <div class="card nb-main">${cur ? `
        <div class="row" style="gap:8px;margin-bottom:10px"><input class="nb-title" value="${U.esc(cur.title)}" placeholder="Título" data-change="nbField" data-k="title" style="flex:1">
          <div class="seg"><button class="${S.mode === 'view' ? 'on' : ''}" data-act="nbMode" data-m="view">👁️ Ver</button><button class="${S.mode === 'edit' ? 'on' : ''}" data-act="nbMode" data-m="edit">✏️ Editar</button></div></div>
        <div class="row" style="margin-bottom:10px"><input list="nb-folders" value="${U.esc(cur.folder || 'Geral')}" data-change="nbField" data-k="folder" style="width:160px" title="pasta"><datalist id="nb-folders">${folders().map((f) => `<option value="${U.esc(f)}">`).join('')}</datalist>
          ${COLORS.map((c) => `<button class="nb-color ${(cur.color || '') === c ? 'on' : ''}" data-act="nbColor" data-c="${c}" style="background:${c || 'var(--card2)'}" title="cor"></button>`).join('')}
          <button class="btn sm ghost" data-act="nbPin">${cur.pinned ? '📌 Desafixar' : '📌 Fixar'}</button><label class="btn sm ghost btn-file">📎 Anexar<input type="file" multiple data-change="nbAttach"></label>
          <span style="flex:1"></span><button class="btn sm ghost danger" data-act="nbDel">🗑️</button></div>
        ${S.mode === 'edit' ? `<textarea class="nb-editor" data-input="nbBody" placeholder="Escreva aqui…&#10;&#10;Dicas: [ ] cria uma caixinha · # título · - lista · **negrito**">${U.esc(cur.body || '')}</textarea>
          <div class="row mt"><button class="btn sm" data-act="nbIns" data-t="[ ] ">☑ Caixinha</button><button class="btn sm" data-act="nbIns" data-t="# ">H Título</button><button class="btn sm" data-act="nbIns" data-t="- ">• Lista</button><small class="muted" style="margin-left:auto">salva sozinho</small></div>`
          : `<div class="nb-view">${(cur.body || '').trim() ? render(cur) : '<p class="muted">Nota vazia — clique em ✏️ Editar.</p>'}</div>`}
        ${(cur.files || []).length ? `<div class="row mt">${cur.files.map((f) => `<span class="chip"><a href="#" data-act="openFile" data-id="${f.id}">📎 ${U.esc(f.name)}</a> <a href="#" data-act="nbUnattach" data-id="${f.id}" title="remover">✕</a></span>`).join('')}</div>` : ''}`
        : App.empty('🗒️', 'Escolha ou crie uma nota', 'Ideias, listas de checagem, resumos, rascunhos… Organize em pastas e fixe as importantes.', '<button class="btn primary" data-act="nbNew">＋ Nova nota</button>')}</div>
    </div>`;
  };
  const cur = () => N.book().find((n) => n.id === S.id);
  const touch = (n) => { n.updated = new Date().toISOString(); if (n.id === 'quick') st().notes = n.body; };
  N.actions = {
    nbNew: () => { const n = { id: U.uid(), title: 'Nova nota', body: '', folder: S.folder || 'Geral', updated: new Date().toISOString() }; N.book().unshift(n); S.id = n.id; S.mode = 'edit'; App.save(); App.rerender(); setTimeout(() => { const t = document.querySelector('.nb-title'); t && t.select(); }, 50); },
    nbOpen: (t) => { S.id = t.dataset.id; S.mode = (cur() && (cur().body || '').trim()) ? 'view' : 'edit'; App.rerender(); },
    nbMode: (t) => { S.mode = t.dataset.m; App.rerender(); },
    nbFolder: (t) => { S.folder = t.dataset.f; App.rerender(); },
    nbQ: U.debounce((t) => { S.q = t.value; App.rerender(); const i = document.getElementById('nb-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250),
    nbField: (t) => { const n = cur(); n[t.dataset.k] = t.value.trim() || (t.dataset.k === 'folder' ? 'Geral' : 'Sem título'); touch(n); App.save(); App.rerender(); },
    nbBody: U.debounce((t) => { const n = cur(); if (!n) return; n.body = t.value; touch(n); App.save(); }, 350),
    nbIns: (t) => { const ta = document.querySelector('.nb-editor'); if (!ta) return; const p = ta.selectionStart, v = ta.value; const before = v.slice(0, p), nl = before && !before.endsWith('\n') ? '\n' : ''; ta.value = before + nl + t.dataset.t + v.slice(p); ta.focus(); const pos = (before + nl + t.dataset.t).length; ta.setSelectionRange(pos, pos); const n = cur(); n.body = ta.value; touch(n); App.save(); },
    nbTick: (t) => { const n = cur(); const lines = (n.body || '').split('\n'); const i = +t.dataset.line; lines[i] = lines[i].replace(/\[( |x)\]/i, t.checked ? '[x]' : '[ ]'); n.body = lines.join('\n'); touch(n); App.save(); App.rerender(); },
    nbColor: (t) => App.commit(() => { cur().color = t.dataset.c; }),
    nbPin: () => App.commit(() => { cur().pinned = !cur().pinned; }),
    nbDel: () => App.confirm('Excluir esta nota?', () => App.commit((s) => { const n = cur(); (n.files || []).forEach((f) => App.files.del(f.id)); s.book = N.book().filter((x) => x.id !== n.id); if (n.id === 'quick') s.notes = ''; S.id = null; })),
    nbAttach: async (t) => { const n = cur(); n.files = n.files || []; for (const f of t.files) { const id = await App.files.put(f); n.files.push({ id, name: f.name }); } touch(n); App.save(); App.rerender(); },
    nbUnattach: (t, e) => { e.preventDefault(); App.commit(() => { const n = cur(); n.files = n.files.filter((f) => f.id !== t.dataset.id); App.files.del(t.dataset.id); }); },
  };
  N.widget = () => {
    const q = N.quick(), pins = N.book().filter((n) => n.pinned && n.id !== 'quick').slice(0, 4);
    return `<div class="card"><header><h3>🗒️ Notas rápidas</h3><a class="btn sm ghost" href="#/notas">caderno</a></header><textarea rows="6" data-input="dashNotes" placeholder="Ideias, lembretes… ([ ] vira caixinha no caderno)">${U.esc(q.body || '')}</textarea>
      ${pins.length ? `<div class="row mt">${pins.map((n) => `<a class="chip" href="#/notas" data-act="nbOpenFromDash" data-id="${n.id}">📌 ${U.esc(n.title)}</a>`).join('')}</div>` : ''}</div>`;
  };
  App.globalActions.nbOpenFromDash = (t) => { S.id = t.dataset.id; S.mode = 'view'; };
  N.search = (words) => N.book().filter((n) => words.every((w) => U.norm(n.title + ' ' + n.body).includes(w)));
  App.views.notas = { render: N.view, actions: N.actions };
})(window.App);
