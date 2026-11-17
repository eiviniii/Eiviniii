/* ==========================================================
   MAPA DO EDITAL — conteúdo programático vira checklist
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U;
  const st = () => App.state;
  const EM = (App.EditalMap = {});
  const STATUS = [['⬜', 'Não visto', '#64748b'], ['📖', 'Estudado', '#0ea5e9'], ['🔁', 'Revisado', '#a855f7'], ['✅', 'Dominado', '#22c55e']];
  const S = { cid: null, onlyPending: false, q: '' };

  const SUBJ_RE = /^(l[ií]ngua portuguesa|portugu[eê]s|matem[aá]tica|racioc[ií]nio l[oó]gico|direito|inform[aá]tica|no[cç][oõ]es|hist[oó]ria|geografia|legisla[cç][aã]o|conhecimentos|atualidades|f[ií]sica|qu[ií]mica|biologia|l[ií]ngua inglesa|ingl[eê]s|espanhol|estat[ií]stica|contabilidade|administra[cç][aã]o|[eé]tica|criminologia|medicina legal|direitos humanos|sociologia|filosofia|reda[cç][aã]o|arquivologia|economia|finan[cç]as)/i;

  /** texto → [{subject, topics[]}] */
  EM.parse = (text) => {
    const lines = text.split(/\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const out = []; let cur = null;
    const isSubj = (l) => {
      if (l.length > 90 || l.length < 4) return false;
      const letters = l.replace(/[^A-Za-zÀ-ú]/g, ''); const up = letters.replace(/[^A-ZÀ-Ý]/g, '').length;
      return (/:$/.test(l) && l.length < 70) || (letters.length > 3 && up / letters.length > 0.75 && !/[.;]$/.test(l)) || (SUBJ_RE.test(l) && l.length < 60 && !/[.;]$/.test(l));
    };
    for (const l of lines) {
      if (/^#\s*/.test(l)) { cur = { subject: l.replace(/^#\s*/, ''), buf: [] }; out.push(cur); continue; }
      if (/^[-•*]\s+/.test(l)) { if (!cur) { cur = { subject: 'Geral', buf: [] }; out.push(cur); } cur.buf.push('§' + l.replace(/^[-•*]\s+/, '')); continue; }
      const pre = l.match(/^([A-ZÀ-Ý][A-ZÀ-Ý ,–-]{3,70}):\s*(.+)$/); // "LÍNGUA PORTUGUESA: 1. … 2. …"
      if (pre) { cur = { subject: pre[1].trim(), buf: [pre[2]] }; out.push(cur); continue; }
      if (isSubj(l)) { const m = l.match(/^(.{3,70}?):\s*(.+)$/); cur = { subject: (m ? m[1] : l).replace(/:$/, '').trim(), buf: [] }; out.push(cur); if (m && m[2].length > 3) cur.buf.push(m[2]); continue; }
      if (!cur) { cur = { subject: 'Geral', buf: [] }; out.push(cur); }
      cur.buf.push(l);
    }
    return out.map((s) => {
      let topics;
      if (s.buf.every((b) => b.startsWith('§'))) topics = s.buf.map((b) => b.slice(1));
      else {
        const joined = s.buf.map((b) => b.replace(/^§/, '')).join(' ');
        topics = joined.split(/(?:^|\s)(?:\d{1,2}(?:\.\d{1,2})*)\s*[.)–-]\s+|;\s*|\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/);
      }
      topics = topics.map((t) => t.replace(/^[\s.,;:–-]+|[\s.,;:–-]+$/g, '')).filter((t) => t.length >= 3 && t.length <= 220);
      const sub = s.subject.length > 3 && s.subject === s.subject.toUpperCase() ? s.subject.charAt(0) + s.subject.slice(1).toLowerCase() : s.subject;
      return { subject: sub, topics };
    }).filter((s) => s.topics.length);
  };
  /** encontra o conteúdo programático dentro do texto do edital */
  EM.extract = (text) => {
    const i = text.search(/conte[uú]do[s]? program[aá]tico|conhecimentos (gerais|espec[ií]ficos|b[aá]sicos)\s*:?\s*\n/i);
    if (i < 0) return null;
    let part = text.slice(i, i + 60000);
    const firstNl = part.indexOf('\n'); part = part.slice(firstNl + 1);
    const end = part.search(/\n\s*ANEXO\s+[IVX]+\b(?!.*conte[uú]do)/);
    return end > 200 ? part.slice(0, end) : part;
  };
  const toText = (topics) => { const g = U.groupBy(topics, (t) => t.subject); return Object.entries(g).map(([s, arr]) => `# ${s}\n${arr.map((t) => '- ' + t.title).join('\n')}`).join('\n\n'); };

  EM.pct = (c) => { const t = c.topics || []; return t.length ? Math.round((U.sum(t, (x) => x.status || 0) / (t.length * 3)) * 100) : 0; };
  const conc = () => (st().concursos || []);

  EM.view = () => {
    const cs = conc();
    if (!cs.length) return `<div class="card">${App.empty('🗺️', 'Cadastre um concurso primeiro', 'Em “Concursos & editais”, suba o edital — depois o conteúdo programático vira um mapa de estudo aqui.', '<a class="btn primary" href="#/estudos/concursos">Ir para concursos</a>')}</div>`;
    const c = cs.find((x) => x.id === S.cid) || cs[0]; S.cid = c.id;
    const topics = c.topics || [];
    const q = U.norm(S.q);
    const by = U.groupBy(topics.filter((t) => (!S.onlyPending || (t.status || 0) < 3) && (!q || U.norm(t.title + ' ' + t.subject).includes(q))), (t) => t.subject);
    const all = U.groupBy(topics, (t) => t.subject);
    const days = c.provaDate ? U.diffDays(U.today(), c.provaDate) : null;
    const left = topics.filter((t) => (t.status || 0) === 0).length;
    return `<div class="row between" style="margin-bottom:14px"><select data-change="emPick" style="width:auto">${cs.map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>📝 ${U.esc(x.name)}</option>`).join('')}</select>
      <div class="row"><button class="btn" data-act="emImport">${topics.length ? '✏️ Editar conteúdo' : '📥 Importar conteúdo programático'}</button></div></div>
    ${topics.length ? `<div class="grid g4">
      <div class="card accent stat"><div class="lbl">Edital dominado</div><div class="val">${EM.pct(c)}%</div><div class="sub">${topics.length} tópicos em ${Object.keys(all).length} matérias</div></div>
      <div class="card stat"><div class="lbl">Ainda não vistos</div><div class="val">${left}</div><div class="sub">tópicos</div></div>
      <div class="card stat"><div class="lbl">Prova</div><div class="val">${days != null ? (days >= 0 ? days + ' dias' : 'realizada') : '—'}</div><div class="sub">${c.provaDate ? U.dateBR(c.provaDate) : 'sem data'}</div></div>
      <div class="card stat"><div class="lbl">Ritmo necessário</div><div class="val">${days > 0 && left ? U.fmt(left / Math.max(1, days / 7), 1) : '—'}</div><div class="sub">tópicos novos por semana</div></div></div>
    <div class="card mt"><header><h3>📊 Por matéria</h3></header>${Object.entries(all).map(([s, arr]) => { const p = Math.round((U.sum(arr, (t) => t.status || 0) / (arr.length * 3)) * 100); return `<div style="margin-bottom:10px"><div class="row between"><span>${U.esc(s)}</span><small class="muted">${arr.filter((t) => t.status >= 1).length}/${arr.length} · ${p}%</small></div><div class="bar"><i style="width:${p}%"></i></div></div>`; }).join('')}</div>
    <div class="card mt"><div class="filters"><input placeholder="🔎 Buscar tópico" value="${U.esc(S.q)}" data-input="emQ" id="em-q" style="flex:1"><label class="check"><input type="checkbox" data-change="emPend" ${S.onlyPending ? 'checked' : ''}><span>Só o que falta dominar</span></label>
      <span class="muted"><small>Clique no status para avançar: ${STATUS.map((s) => s[0] + ' ' + s[1]).join(' → ')}</small></span></div>
      ${Object.entries(by).map(([s, arr]) => `<h4 class="sh-sec">${U.esc(s)}</h4>${arr.map((t) => `<div class="topic"><button class="st-btn" data-act="emStatus" data-id="${t.id}" title="${STATUS[t.status || 0][1]}" style="border-color:${STATUS[t.status || 0][2]}">${STATUS[t.status || 0][0]}</button><div class="grow">${U.esc(t.title)}${t.studiedAt ? `<small class="muted"> · ${U.dateBR(t.studiedAt)}</small>` : ''}</div><button class="icon-btn" data-act="emStudy" data-id="${t.id}" title="estudar agora (Pomodoro)">▶</button></div>`).join('')}`).join('') || '<p class="muted">Nada encontrado.</p>'}</div>`
      : `<div class="card">${App.empty('🗺️', 'Monte o mapa deste edital', 'Eu leio o “conteúdo programático” do PDF do edital (ou você cola o texto) e transformo em uma lista de tópicos por matéria para marcar o que já estudou.', '<button class="btn primary" data-act="emImport">📥 Importar conteúdo programático</button>')}</div>`}`;
  };

  const importModal = async (c) => {
    let text = c.topics && c.topics.length ? toText(c.topics) : '';
    let note = '';
    if (!text && c.fileId) {
      try { const f = await App.files.get(c.fileId); if (f) { const raw = await App.parse.pdfText(new File([f.blob], f.name, { type: f.type })); const part = EM.extract(raw); if (part) { text = toText(EM.parse(part).flatMap((s) => s.topics.map((t) => ({ subject: s.subject, title: t })))); note = '✨ Encontrei o conteúdo programático no edital. Confira e ajuste abaixo.'; } else note = 'Não achei a seção “conteúdo programático” no PDF — cole o texto abaixo.'; } } catch (e) { note = 'Não consegui ler o PDF do edital — cole o texto abaixo.'; }
    }
    App.modal({
      title: `🗺️ Conteúdo programático — ${U.esc(c.name)}`, wide: true, submitLabel: 'Salvar mapa',
      body: `${note ? `<div class="note">${note}</div>` : ''}<p class="muted" style="margin-top:0">Formato: <code># Matéria</code> numa linha e cada tópico começando com <code>- </code>. Também pode colar o texto do edital como está — eu separo pelos números e pontos-e-vírgulas.</p>
        <textarea name="txt" rows="18" style="font-family:monospace;font-size:.85rem" placeholder="# Língua Portuguesa&#10;- Compreensão e interpretação de textos&#10;- Ortografia oficial&#10;# Direito Constitucional&#10;- Direitos e garantias fundamentais">${U.esc(text)}</textarea>
        <button type="button" class="btn sm mt" data-mact="tidy">🪄 Organizar texto colado</button> <small class="muted" id="em-count"></small>`,
      actions: { tidy: (_, f) => { const p = EM.parse(f.txt.value); f.txt.value = toText(p.flatMap((s) => s.topics.map((t) => ({ subject: s.subject, title: t })))); f.querySelector('#em-count').textContent = `${U.sum(p, (s) => s.topics.length)} tópicos em ${p.length} matérias`; } },
      onSubmit: (d) => {
        const p = EM.parse(d.txt); if (!p.length) { App.toast('Não encontrei tópicos no texto.', 'error'); return false; }
        const old = new Map((c.topics || []).map((t) => [U.norm(t.subject + '|' + t.title), t]));
        App.commit(() => { c.topics = p.flatMap((s) => s.topics.map((t) => { const o = old.get(U.norm(s.subject + '|' + t)); return { id: o ? o.id : U.uid(), subject: s.subject, title: t, status: o ? o.status : 0, studiedAt: o ? o.studiedAt : '' }; })); });
        App.toast(`🗺️ ${c.topics.length} tópicos no mapa`);
      },
    });
  };

  EM.actions = {
    emPick: (t) => { S.cid = t.value; App.rerender(); },
    emImport: () => importModal(conc().find((x) => x.id === S.cid)),
    emStatus: (t) => App.commit(() => { const c = conc().find((x) => x.id === S.cid); const tp = c.topics.find((x) => x.id === t.dataset.id); tp.status = ((tp.status || 0) + 1) % 4; if (tp.status) tp.studiedAt = U.today(); }),
    emStudy: (t) => {
      const c = conc().find((x) => x.id === S.cid), tp = c.topics.find((x) => x.id === t.dataset.id);
      const subj = st().subjects.find((s) => U.norm(s.name) === U.norm(tp.subject) || U.norm(tp.subject).includes(U.norm(s.name)) || U.norm(s.name).includes(U.norm(tp.subject)));
      App.Timer.subjectId = subj ? subj.id : ''; App.Timer.topic = tp.title;
      App.go('estudos/painel'); App.toast(`▶ Pronto para estudar: ${tp.title.slice(0, 40)} — inicie o Pomodoro`);
    },
    emPend: (t) => { S.onlyPending = t.checked; App.rerender(); },
    emQ: U.debounce((t) => { S.q = t.value; App.rerender(); const i = document.getElementById('em-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250),
  };
  EM.openFor = (cid) => { S.cid = cid; App.go('estudos/mapa'); };
})(window.App);
