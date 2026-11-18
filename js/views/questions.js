/* ==========================================================
   QUESTÕES — PDF de questões vira banco de múltipla escolha
   Transcreve enunciado, alternativas e gabarito; treino,
   simulado, caderno de erros e desempenho por matéria/assunto.
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const Q = (App.Questions = {});
  const bank = () => (st().questions = st().questions || []);
  const LET = ['A', 'B', 'C', 'D', 'E'];

  /* ==========================================================
     LEITOR DE QUESTÕES
     ========================================================== */
  const clean = (s) => s.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  const oneLine = (s) => s.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();

  /** gabarito: "1-A 2-C", "01. B", "1) E", tabelas "01 02 03 / A C B", Certo/Errado */
  Q.parseKey = (txt) => {
    const key = {};
    const t = txt.replace(/\bcerto\b/gi, 'C').replace(/\berrado\b/gi, 'E');
    // tabela: linha de números seguida de linha de letras ("1 2 3 4 5" / "A E A A D")
    const lines = t.split('\n').map((l) => l.trim());
    for (let i = 0; i < lines.length - 1; i++) {
      const nums = lines[i].match(/\b\d{1,3}\b/g), lets = lines[i + 1].match(/\b[A-E]\b/g);
      if (nums && lets && nums.length >= 2 && nums.length === lets.length && /^[\d\s|.-]+$/.test(lines[i]) && /^[A-E\s|.-]+$/.test(lines[i + 1])) { nums.forEach((n, j) => { key[+n] = lets[j]; }); i++; }
    }
    if (Object.keys(key).length) return key;
    // lista: "01) C", "1-A", "2. B", "3: letra D"
    let m; const re = /(?:^|[\s,;|])(\d{1,3})\s*(?:[-–—.:)=])?\s*(?:letra\s*)?\(?([A-Ea-e])\)?(?=[\s,;|.]|$)/g;
    while ((m = re.exec(t))) key[+m[1]] = m[2].toUpperCase();
    return key;
  };

  /** linha que parece "pedaço de conta" (fração/expressão quebrada pelo PDF) */
  const mathy = (t) => /[\u{1D400}-\u{1D7FF}]/u.test(t) || (t.length <= 16 && /^[\d\s+\-−–×÷*/=().,\[\]^⋅√π𝑎-𝑧]+$/u.test(t) && /\d/.test(t));
  /** continuação de alternativa: começa minúscula ou a linha anterior não terminou a frase */
  const continues = (prev, line) => /^[a-zà-ú(“"]/.test(line) || (/[,;:–-]$/.test(prev) && !mathy(line));

  /**
   * input: texto OU linhas do PDF [{t, page, y, h}] (com posição dá para recortar a imagem da questão)
   * devolve { questions:[{num,text,options,answer,type,banca,year,orgao,explanation,ok,needsImage,region}], keyFound }
   */
  Q.parse = (input) => {
    let L = (typeof input === 'string' ? input.split('\n').map((t) => ({ t })) : input).map((l) => ({ ...l, t: App.parse.fixSpaced(l.t).replace(/^(\d)\s+(\d)\s*\)/, '$1$2)').trim() })).filter((l) => l.t);
    // 1) gabarito no fim do arquivo (lista ou tabela)
    let key = {};
    const gi = L.findIndex((l, i) => i > L.length * 0.4 && /^(gabarito|respostas|folha de respostas)\b\s*:?/i.test(l.t));
    if (gi >= 0) {
      const tail = L.slice(gi).map((l) => l.t).join('\n');
      key = Q.parseKey(tail.replace(/^(gabarito|respostas)[^\n]*\n?/i, ''));
      if (Object.keys(key).length >= 2) L = L.slice(0, gi); else key = {};
    }
    // 2) início de cada questão (números em sequência evitam falsos positivos)
    const cand = [];
    L.forEach((l, i) => {
      const s = l.t; let m;
      if ((m = s.match(/^quest[aã]o\s*(?:n[º°.]?\s*)?(\d{1,3})\b[\s.:)–-]*(.*)$/i))) cand.push({ i, n: +m[1], rest: m[2] });
      else if ((m = s.match(/^(\d{1,3})\s*[).:–-]\s*(.+)$/)) && !/^\d{1,3}\s*[.,]\d/.test(s)) cand.push({ i, n: +m[1], rest: m[2] });
      else if ((m = s.match(/^Q\d{5,}\b(.*)$/))) cand.push({ i, n: null, rest: m[1] }); // formato QConcursos (Q123456)
    });
    const starts = []; let expect = null;
    for (const c of cand) {
      if (c.n == null) { starts.push({ ...c, n: (starts.length ? starts[starts.length - 1].n : 0) + 1 }); continue; }
      if (expect == null || c.n === expect) { starts.push(c); expect = c.n + 1; }
    }
    const out = []; let carry = [];
    starts.forEach((s, k) => {
      const end = k + 1 < starts.length ? starts[k + 1].i : L.length;
      const ls = [...carry, { ...L[s.i], t: s.rest }, ...L.slice(s.i + 1, end)];
      carry = [];
      const q = { num: s.n, text: '', options: [], answer: null, type: 'mc', explanation: '', banca: '', year: '', orgao: '' };
      // gabarito/comentário dentro da própria questão
      const gIdx = ls.findIndex((l) => /^(gabarito|resposta(?: correta)?|alternativa correta|gab\.?)\s*[:\-–]?\s*(letra\s*)?\(?([A-E]|certo|errado)\)?\b/i.test(l.t));
      if (gIdx >= 0) { const m = ls[gIdx].t.match(/\(?([A-E]|certo|errado)\)?\b/i); const v = m[1].toUpperCase(); q.answer = v === 'CERTO' ? 'C' : v === 'ERRADO' ? 'E' : v; ls.splice(gIdx, 1); }
      const cIdx = ls.findIndex((l) => /^(coment[aá]rio|resolu[cç][aã]o|justificativa)\s*[:\-–]/i.test(l.t));
      if (cIdx >= 0) { q.explanation = ls.splice(cIdx).map((l) => l.t).join(' ').replace(/^\S+\s*[:\-–]\s*/, ''); }
      // alternativas: cada uma começa no início de uma linha (A) a) (A) A.)
      const optRe = /^\(?([A-Ea-e])\s*[)\].–-]\s*(.*)$/;
      let firstOpt = -1, seq = [];
      for (let i = 0; i < ls.length; i++) {
        const m = ls[i].t.match(optRe); if (!m) continue;
        const L2 = m[1].toUpperCase(), want = LET[seq.length];
        if (L2 === want && (!seq.length || (m[1] === m[1].toUpperCase()) === seq[0].upper)) { if (firstOpt < 0) firstOpt = i; seq.push({ i, l: L2, t: m[2], upper: m[1] === m[1].toUpperCase() }); }
      }
      let stemLines = ls, lastLine = ls.length - 1;
      if (seq.length >= 2) {
        stemLines = ls.slice(0, firstOpt);
        q.options = seq.map((o, j) => {
          const stop = j + 1 < seq.length ? seq[j + 1].i : ls.length;
          let parts = [o.t], i = o.i + 1;
          for (; i < stop; i++) { if (j + 1 === seq.length && !continues(ls[i - 1].t, ls[i].t)) break; parts.push(ls[i].t); }
          if (j + 1 === seq.length) { lastLine = i - 1; carry = ls.slice(i); } // sobras após a última alternativa pertencem à próxima questão (ex.: numerador de fração)
          return { l: o.l, t: parts.join(' ').replace(/\s+/g, ' ').trim() };
        }).filter((o) => o.t);
      } else {
        if (/^[CE]$/.test(q.answer || key[s.n] || '') || ls.some((l) => /\(\s*\)\s*certo|julgue/i.test(l.t))) { q.type = 'ce'; q.options = [{ l: 'C', t: 'Certo' }, { l: 'E', t: 'Errado' }]; }
      }
      let stem = stemLines.map((l) => l.t).join('\n').replace(/\(\s*\)\s*(certo|errado)/gi, '');
      // origem: "(Cargo – Órgão – 2023 – BANCA)" ou "Ano: 2023 Banca: X Órgão: Y"
      let m = stem.match(/^\s*\(\s*([^()]{6,220}?)\s*\)\s*/);
      if (m && /(19|20)\d{2}/.test(m[1])) {
        const parts = m[1].split(/\s+[–—-]\s+/).map((x) => x.trim()).filter(Boolean);
        const yi = parts.findIndex((x) => /^(19|20)\d{2}$/.test(x));
        if (yi >= 0) { q.year = parts[yi]; q.banca = parts.slice(yi + 1).join(' – ') || ''; q.orgao = parts.slice(0, yi).join(' – '); stem = stem.slice(m[0].length); }
      }
      m = stem.match(/ano:\s*(\d{4})\s*banca:\s*(.+?)\s*[óo]rg[aã]o:\s*(.+?)(?:\s*prova:[^\n]*)?\n/i);
      if (m) { q.year = m[1]; q.banca = m[2]; q.orgao = m[3]; stem = stem.slice(0, m.index) + stem.slice(m.index + m[0].length); }
      // junta as linhas quebradas pelo PDF; mantém quebra em itens (I -, II -, a., 1.) e após ":"
      q.text = stem.split('\n').reduce((acc, line, i, arr) => {
        const l = line.trim(); if (!l) return acc;
        const item = /^((?:[IVX]{1,5})\s*[-–.)]|[a-z]\s*[.)]\s|\d{1,2}\s*[.)]\s|[•\-–]\s)/.test(l);
        if (!acc) return l;
        return acc + (item || /[:;]$/.test(arr[i - 1].trim()) || mathy(l) || mathy(arr[i - 1].trim()) ? '\n' : ' ') + l;
      }, '').replace(/([.;:])\s+(?=(?:I{1,3}|IV|V|VI{1,3}|IX|X)\s*[-–]\s)/g, '$1\n').replace(/\n((?:I{1,3}|IV|V|VI{1,3}|IX|X))\s*\n\s*([-–])/g, '\n$1 $2').replace(/([.;:])\s+((?:I{1,3}|IV|V|VI{1,3}|IX|X))\n([-–])/g, '$1\n$2 $3').replace(/[ \t]+/g, ' ').trim();
      if (!q.answer && key[s.n]) q.answer = key[s.n];
      if (q.type === 'mc' && q.answer && !q.options.some((o) => o.l === q.answer)) q.answer = null;
      // fórmula/fração quebrada? marca para mostrar a imagem original da questão
      const mathLines = stemLines.filter((l) => mathy(l.t)).length + ls.slice(0, firstOpt < 0 ? ls.length : firstOpt).filter((l) => /[\u{1D400}-\u{1D7FF}]/u.test(l.t)).length;
      q.needsImage = mathLines >= 2;
      const used = ls.slice(0, lastLine + 1).filter((l) => l.page);
      if (used.length) q.region = used.reduce((acc, l) => { const r = acc.find((x) => x.page === l.page); if (r) { r.top = Math.max(r.top, l.y + l.h); r.bottom = Math.min(r.bottom, l.y - l.h * 0.45); } else acc.push({ page: l.page, top: l.y + l.h, bottom: l.y - l.h * 0.45 }); return acc; }, []);
      q.ok = (q.text.length > 8 || q.needsImage) && q.options.length >= 2;
      out.push(q);
    });
    return { questions: out, keyFound: Object.keys(key).length };
  };

  /* ---------- imagem recortada da questão no PDF ---------- */
  const pdfCache = new Map(), imgCache = new Map();
  Q.image = async (q) => {
    if (!q.pdfId || !q.region || !q.region.length) return null;
    if (imgCache.has(q.id)) return imgCache.get(q.id);
    let pdf = pdfCache.get(q.pdfId);
    if (!pdf) { const f = await App.files.get(q.pdfId); if (!f) return null; pdf = await App.parse.openPdf(new File([f.blob], f.name, { type: 'application/pdf' })); pdfCache.set(q.pdfId, pdf); }
    const parts = [];
    for (const r of q.region) {
      const page = await pdf.getPage(r.page), vp = page.getViewport({ scale: 2 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      const y0 = Math.max(0, vp.convertToViewportPoint(0, r.top)[1] - 6), y1 = Math.min(vp.height, vp.convertToViewportPoint(0, r.bottom)[1] + 6);
      parts.push({ c, y0, h: Math.max(10, y1 - y0) });
    }
    const out = document.createElement('canvas'); out.width = parts[0].c.width; out.height = parts.reduce((a, p) => a + p.h, 0);
    const ctx = out.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
    let y = 0; for (const p of parts) { ctx.drawImage(p.c, 0, p.y0, p.c.width, p.h, 0, y, p.c.width, p.h); y += p.h; }
    const url = out.toDataURL('image/png'); imgCache.set(q.id, url); return url;
  };

  /* ==========================================================
     ESTATÍSTICAS
     ========================================================== */
  const subj = (id) => st().subjects.find((s) => s.id === id) || { id: '', name: 'Sem matéria', color: '#64748b' };
  const last = (q) => (q.attempts && q.attempts.length ? q.attempts[q.attempts.length - 1] : null);
  Q.stats = (qs = bank()) => {
    const att = qs.flatMap((q) => q.attempts || []);
    const ok = att.filter((a) => a.ok).length;
    return { total: qs.length, answered: qs.filter((q) => (q.attempts || []).length).length, att: att.length, ok, pct: att.length ? (ok / att.length) * 100 : null, wrong: qs.filter((q) => { const l = last(q); return l && !l.ok; }).length };
  };

  /* ==========================================================
     TELA
     ========================================================== */
  const S = { f: { subjectId: '', topic: '', which: 'todas', n: 10, shuffle: true }, run: null, list: { q: '', page: 1 } };
  const topicsFor = (sid) => { const t = new Set(bank().filter((q) => !sid || q.subjectId === sid).map((q) => q.topic).filter(Boolean)); (st().concursos || []).forEach((c) => (c.topics || []).forEach((x) => { if (!sid || U.norm(subj(sid).name) === U.norm(x.subject)) t.add(x.title); })); return [...t].sort(); };

  Q.view = () => (S.run ? runView() : homeView());
  const homeView = () => {
    const s = Q.stats(), subs = U.groupBy(bank(), (q) => q.subjectId || '');
    const words = U.norm(S.list.q).split(/\s+/).filter(Boolean);
    const list = bank().filter((q) => words.every((w) => U.norm(q.text + ' ' + (q.topic || '') + ' ' + subj(q.subjectId).name + ' ' + (q.banca || '')).includes(w)));
    const pageSize = 30, pages = Math.max(1, Math.ceil(list.length / pageSize)), page = Math.min(S.list.page, pages);
    const f = S.f;
    return `<div class="grid g4">
      <div class="card accent stat"><div class="lbl">Questões no banco</div><div class="val">${s.total}</div><div class="sub">${s.answered} já respondidas</div></div>
      <div class="card stat"><div class="lbl">Acerto geral</div><div class="val">${s.pct != null ? U.fmt(s.pct, 0) + '%' : '—'}</div><div class="sub">${s.ok} de ${s.att} respostas</div></div>
      <div class="card stat"><div class="lbl">Caderno de erros</div><div class="val ${s.wrong ? 'delta badd' : ''}">${s.wrong}</div><div class="sub">para revisar</div></div>
      <div class="card stat"><div class="lbl">Hoje</div><div class="val">${bank().flatMap((q) => q.attempts || []).filter((a) => a.date === U.today()).length}</div><div class="sub">questões resolvidas</div></div></div>
    <div class="grid g2 mt">
      <div class="card"><header><h3>📥 Subir PDF de questões</h3></header>
        <form data-submit="qImport">
          <label class="drop" style="padding:16px"><input type="file" name="files" accept=".pdf,application/pdf,.txt" multiple><b>📎 Escolher PDF</b><small id="q-chosen">lista de questões com alternativas (e gabarito)</small></label>
          ${F.row(F.field('Matéria', `<select name="subjectId"><option value="">— escolher —</option>${st().subjects.map((x) => `<option value="${x.id}">${U.esc(x.name)}</option>`).join('')}<option value="__new">＋ nova matéria…</option></select>`), F.text('Assunto', 'topic', '', 'list="q-topics" placeholder="Ex.: Crase"'))}
          <datalist id="q-topics">${topicsFor('').map((t) => `<option value="${U.esc(t)}">`).join('')}</datalist>
          ${F.row(F.text('Banca (opcional)', 'banca', '', 'placeholder="Ex.: IBFC"'), F.text('Ano (opcional)', 'year', '', 'placeholder="2024"'))}
          <button class="btn primary block mt" id="q-btn">Ler e transcrever questões</button></form>
        <p class="muted"><small>Também dá para <a href="#" data-act="qManual">adicionar uma questão manualmente</a>.</small></p></div>
      <div class="card"><header><h3>🎯 Resolver</h3></header>
        ${bank().length ? `<form data-submit="qStart">
          ${F.row(F.field('Matéria', `<select name="subjectId" data-change="qFsub"><option value="">Todas</option>${[...new Set(bank().map((q) => q.subjectId))].map((id) => `<option value="${id}" ${f.subjectId === id ? 'selected' : ''}>${U.esc(subj(id).name)}</option>`).join('')}</select>`), F.field('Assunto', `<select name="topic"><option value="">Todos</option>${[...new Set(bank().filter((q) => !f.subjectId || q.subjectId === f.subjectId).map((q) => q.topic).filter(Boolean))].sort().map((t) => `<option ${f.topic === t ? 'selected' : ''}>${U.esc(t)}</option>`).join('')}</select>`))}
          ${F.row(F.select('Quais', 'which', [['todas', 'Todas'], ['novas', 'Só as que nunca respondi'], ['erradas', 'Caderno de erros (errei a última)'], ['fav', 'Favoritas ⭐']], f.which), F.number('Quantidade', 'n', f.n, 'min="1"'))}
          ${F.check('Ordem aleatória (embaralhar alternativas também)', 'shuffle', f.shuffle)}
          <div class="row mt"><button class="btn primary" name="mode" value="treino">✅ Treino (vê na hora)</button><button type="button" class="btn" data-act="qStartSim">⏱️ Simulado (corrige no fim)</button></div></form>` : '<p class="muted">Suba um PDF para começar a resolver.</p>'}</div></div>
    ${Object.keys(subs).length ? `<div class="card mt"><header><h3>📊 Desempenho por matéria e assunto</h3></header><div class="table-wrap"><table><thead><tr><th>Matéria / assunto</th><th class="r">Questões</th><th class="r">Respondidas</th><th>Acerto</th><th></th></tr></thead><tbody>
      ${Object.entries(subs).map(([sid, qs]) => { const ss = Q.stats(qs); const tops = U.groupBy(qs, (q) => q.topic || '—'); return `<tr><td><b><span class="dot" style="background:${subj(sid).color}"></span> ${U.esc(subj(sid).name)}</b></td><td class="r">${ss.total}</td><td class="r">${ss.answered}</td><td>${pctBar(ss.pct)}</td><td class="actions"><button class="btn sm" data-act="qGo" data-s="${sid}">▶</button></td></tr>
        ${Object.keys(tops).length > 1 || !tops['—'] ? Object.entries(tops).map(([t, arr]) => { const x = Q.stats(arr); return `<tr><td style="padding-left:28px"><small>${U.esc(t)}</small></td><td class="r"><small>${x.total}</small></td><td class="r"><small>${x.answered}</small></td><td>${pctBar(x.pct)}</td><td class="actions"><button class="btn sm ghost" data-act="qGo" data-s="${sid}" data-t="${U.esc(t === '—' ? '' : t)}">▶</button></td></tr>`; }).join('') : ''}`; }).join('')}</tbody></table></div>
      <div class="chart-box sm mt"><canvas id="q-evo"></canvas></div></div>` : ''}
    ${bank().length ? `<div class="card mt"><header><h3>🗂️ Banco de questões</h3><input placeholder="🔎 Buscar no enunciado, assunto, banca…" value="${U.esc(S.list.q)}" data-input="qSearch" id="q-search" style="max-width:320px"></header>
      ${list.slice((page - 1) * pageSize, page * pageSize).map((q) => { const l = last(q); return `<div class="li"><div class="ico" style="background:${App.alpha(subj(q.subjectId).color, .18)}">${q.type === 'ce' ? 'C/E' : '❓'}</div><div class="grow"><div class="t" style="white-space:normal">${U.esc(q.text.slice(0, 150))}${q.text.length > 150 ? '…' : ''}</div>
        <div class="s">${U.esc(subj(q.subjectId).name)}${q.topic ? ' · ' + U.esc(q.topic) : ''}${q.banca ? ' · ' + U.esc(q.banca) : ''}${q.year ? ' ' + q.year : ''} · ${q.answer ? 'gabarito ' + q.answer : '<span style="color:var(--warn)">sem gabarito</span>'}${l ? ` · ${l.ok ? '✅ acertou' : '❌ errou'} por último` : ''}</div></div>
        <button class="icon-btn" data-act="qFav" data-id="${q.id}">${q.fav ? '⭐' : '☆'}</button><button class="icon-btn" data-act="qEdit" data-id="${q.id}">✏️</button></div>`; }).join('') || '<p class="muted">Nada encontrado.</p>'}
      ${pages > 1 ? `<div class="row mt" style="justify-content:center"><button class="btn sm" data-act="qPage" data-d="-1" ${page <= 1 ? 'disabled' : ''}>‹</button><span>${page}/${pages}</span><button class="btn sm" data-act="qPage" data-d="1" ${page >= pages ? 'disabled' : ''}>›</button></div>` : ''}</div>` : ''}`;
  };
  const pctBar = (p) => (p == null ? '<small class="muted">—</small>' : `<div class="row" style="gap:8px;flex-wrap:nowrap"><div class="bar" style="flex:1;min-width:80px"><i style="width:${p}%;background:${p >= 70 ? 'var(--ok)' : p >= 50 ? 'var(--warn)' : 'var(--bad)'}"></i></div><small>${U.fmt(p, 0)}%</small></div>`);

  Q.mount = (el) => {
    const inp = el.querySelector('[data-submit=qImport] [name=files]'), ch = el.querySelector('#q-chosen');
    if (inp && ch) inp.addEventListener('change', () => { ch.textContent = [...inp.files].map((f) => f.name).join(', '); });
    const c = document.getElementById('q-evo');
    if (c) {
      const days = Array.from({ length: 14 }, (_, i) => U.addDays(U.today(), i - 13));
      const att = bank().flatMap((q) => q.attempts || []);
      App.chart(c, { type: 'bar', data: { labels: days.map((d) => U.dateBR(d).slice(0, 5)), datasets: [{ label: 'Acertos', data: days.map((d) => att.filter((a) => a.date === d && a.ok).length), backgroundColor: '#22c55e', borderRadius: 4 }, { label: 'Erros', data: days.map((d) => att.filter((a) => a.date === d && !a.ok).length), backgroundColor: '#ef4444', borderRadius: 4 }] }, options: { scales: { x: { stacked: true }, y: { stacked: true, ticks: { stepSize: 1 } } } } });
    }
    if (S.run) bindKeys();
    fillImages(el);
  };
  const fillImages = (root) => root.querySelectorAll('[data-qimg]').forEach(async (box) => {
    const q = bank().find((x) => x.id === box.dataset.qimg) || (Q._review || []).find((x) => x.id === box.dataset.qimg);
    try { const url = q && (await Q.image(q)); box.innerHTML = url ? `<img src="${url}" alt="questão original">` : '<small class="muted">imagem indisponível</small>'; } catch (e) { box.innerHTML = '<small class="muted">não consegui gerar a imagem</small>'; }
  });

  /* ---------- resolução ---------- */
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const start = (mode, f) => {
    let qs = bank().filter((q) => q.answer && (!f.subjectId || q.subjectId === f.subjectId) && (!f.topic || q.topic === f.topic));
    if (f.which === 'novas') qs = qs.filter((q) => !(q.attempts || []).length);
    if (f.which === 'erradas') qs = qs.filter((q) => { const l = last(q); return l && !l.ok; });
    if (f.which === 'fav') qs = qs.filter((q) => q.fav);
    if (!qs.length) return App.toast(bank().some((q) => !q.answer) ? 'Nenhuma questão com gabarito nesse filtro. Edite as questões sem gabarito.' : 'Nenhuma questão nesse filtro.', 'error');
    if (f.shuffle) shuffle(qs);
    qs = qs.slice(0, Math.max(1, +f.n || 10));
    S.run = { mode, ids: qs.map((q) => q.id), i: 0, answers: {}, revealed: {}, t0: Date.now(), order: Object.fromEntries(qs.map((q) => [q.id, f.shuffle && q.type === 'mc' ? shuffle(q.options.map((o) => o.l)) : q.options.map((o) => o.l)])), done: false };
    App.rerender(); window.scrollTo(0, 0);
  };
  const runView = () => {
    const r = S.run, sim = r.mode === 'simulado';
    if (r.done) return resultView();
    const q = bank().find((x) => x.id === r.ids[r.i]); if (!q) { S.run = null; return homeView(); }
    const chosen = r.answers[q.id], shown = !sim && r.revealed[q.id];
    const opts = r.order[q.id].map((l) => q.options.find((o) => o.l === l)).filter(Boolean);
    const disp = (i) => (q.type === 'ce' ? opts[i].l : LET[i]); // letra mostrada (alternativas embaralhadas recebem A, B, C…)
    return `<div class="card q-run">
      <div class="row between"><div class="row"><b>${sim ? '⏱️ Simulado' : '✅ Treino'}</b><span class="chip">${r.i + 1} de ${r.ids.length}</span><span class="chip">${U.esc(subj(q.subjectId).name)}${q.topic ? ' · ' + U.esc(q.topic) : ''}</span>${q.banca ? `<span class="chip">${U.esc(q.banca)}${q.year ? ' ' + q.year : ''}</span>` : ''}</div>
        <div class="row"><span class="chip" id="q-timer">⏱ ${(() => { const s = Math.round((Date.now() - r.t0) / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); })()}</span><button class="btn sm ghost" data-act="qQuit">Sair</button></div></div>
      <div class="bar mt"><i style="width:${(r.i / r.ids.length) * 100}%"></i></div>
      ${q.orgao || q.year ? `<div class="muted" style="margin-top:10px"><small>📌 ${U.esc([q.orgao, q.year, q.banca].filter(Boolean).join(' · '))}</small></div>` : ''}
      ${q.needsImage || S.showImg ? `<div class="q-img" data-qimg="${q.id}"><small class="muted">carregando a questão original…</small></div>` : ''}
      ${!q.needsImage || S.showText ? `<div class="q-text">${U.esc(q.text).replace(/\n/g, '<br>')}</div>` : ''}
      ${q.pdfId && q.region ? `<button class="btn sm ghost" data-act="${q.needsImage ? 'qToggleText' : 'qToggleImg'}">${q.needsImage ? (S.showText ? 'Ocultar texto' : 'Ver também como texto') : (S.showImg ? 'Ocultar original' : '🖼️ Ver como está no PDF')}</button>` : ''}
      <div class="q-opts">${opts.map((o, i) => { const sel = chosen === o.l, right = shown && o.l === q.answer, wrong = shown && sel && o.l !== q.answer; return `<button class="q-opt ${sel ? 'sel' : ''} ${right ? 'right' : ''} ${wrong ? 'wrong' : ''}" data-act="qPick" data-l="${o.l}" ${shown ? 'disabled' : ''}><b>${disp(i)}</b><span>${U.esc(o.t)}</span></button>`; }).join('')}</div>
      ${shown ? `<div class="note ${chosen === q.answer ? '' : 'warn'} mt">${chosen === q.answer ? '🎉 <b>Acertou!</b>' : `❌ <b>Errou.</b> Resposta: <b>${disp(opts.findIndex((o) => o.l === q.answer))}</b> — ${U.esc((q.options.find((o) => o.l === q.answer) || {}).t || '')}`}${q.explanation ? `<div class="mt"><small>💡 ${U.esc(q.explanation)}</small></div>` : ''}</div>` : ''}
      <div class="row mt between"><div class="row"><button class="btn ghost" data-act="qPrev" ${r.i === 0 ? 'disabled' : ''}>‹ Anterior</button><button class="icon-btn" data-act="qFav" data-id="${q.id}" title="favoritar">${q.fav ? '⭐' : '☆'}</button><button class="icon-btn" data-act="qEdit" data-id="${q.id}" title="corrigir a questão">✏️</button></div>
        <div class="row">${!sim && !shown ? `<button class="btn primary" data-act="qConfirm" ${chosen ? '' : 'disabled'}>Responder</button>` : ''}${(sim || shown) ? (r.i + 1 < r.ids.length ? '<button class="btn primary" data-act="qNext">Próxima ›</button>' : `<button class="btn primary" data-act="qFinish">${sim ? 'Finalizar e corrigir' : 'Ver resultado'}</button>`) : ''}</div></div>
      <p class="muted"><small>Atalhos: teclas ${q.type === 'ce' ? 'C / E' : 'A–E'} para escolher · Enter para responder/avançar</small></p></div>`;
  };
  const resultView = () => {
    const r = S.run, qs = r.ids.map((id) => bank().find((x) => x.id === id)).filter(Boolean);
    const ok = qs.filter((q) => r.answers[q.id] === q.answer).length, sec = Math.round((r.t1 - r.t0) / 1000);
    const bySub = U.groupBy(qs, (q) => q.subjectId);
    return `<div class="card q-run"><header><h3>🏁 Resultado</h3><button class="btn" data-act="qQuit">Voltar</button></header>
      <div class="grid g3"><div class="stat"><div class="lbl">Acertos</div><div class="val ${ok / qs.length >= 0.7 ? 'delta good' : ok / qs.length >= 0.5 ? '' : 'delta badd'}">${ok}/${qs.length} · ${U.fmt((ok / qs.length) * 100, 0)}%</div></div>
        <div class="stat"><div class="lbl">Tempo</div><div class="val">${Math.floor(sec / 60)}min ${sec % 60}s</div><div class="sub">${U.fmt(sec / qs.length, 0)} s por questão</div></div>
        <div class="stat"><div class="lbl">Por matéria</div>${Object.entries(bySub).map(([sid, arr]) => `<div><small>${U.esc(subj(sid).name)}: ${arr.filter((q) => r.answers[q.id] === q.answer).length}/${arr.length}</small></div>`).join('')}</div></div>
      <div class="list mt">${qs.map((q, i) => { const a = r.answers[q.id], okk = a === q.answer; return `<div class="li"><div class="ico">${okk ? '✅' : a ? '❌' : '⬜'}</div><div class="grow"><div class="t" style="white-space:normal">${i + 1}. ${U.esc(q.text.slice(0, 120))}${q.text.length > 120 ? '…' : ''}</div><div class="s">sua: ${a || '—'} · certa: ${q.answer}${q.explanation && !okk ? ' · 💡 ' + U.esc(q.explanation.slice(0, 120)) : ''}</div></div></div>`; }).join('')}</div>
      <div class="row mt">${qs.some((q) => r.answers[q.id] !== q.answer) ? '<button class="btn primary" data-act="qRedoWrong">🔁 Refazer as que errei</button>' : ''}<button class="btn" data-act="qQuit">Fechar</button></div></div>`;
  };
  let timerIv = null, keyFn = null;
  const bindKeys = () => {
    clearInterval(timerIv);
    timerIv = setInterval(() => { const el = document.getElementById('q-timer'); if (!el || !S.run) return clearInterval(timerIv); const s = Math.round((Date.now() - S.run.t0) / 1000); el.textContent = `⏱ ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 1000);
    if (keyFn) document.removeEventListener('keydown', keyFn);
    keyFn = (e) => {
      if (!S.run || S.run.done || document.querySelector('.modal-wrap') || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName)) return;
      const k = e.key.toUpperCase();
      const btns = [...document.querySelectorAll('.q-opt:not([disabled])')];
      const q = bank().find((x) => x.id === S.run.ids[S.run.i]);
      const idx = q && q.type === 'ce' ? ['C', 'E'].indexOf(k) : LET.indexOf(k);
      if (idx >= 0 && btns[idx]) { e.preventDefault(); btns[idx].click(); }
      else if (/^[1-5]$/.test(k) && btns[+k - 1]) { e.preventDefault(); btns[+k - 1].click(); }
      else if (e.key === 'Enter') { const b = document.querySelector('[data-act=qConfirm]:not([disabled]), [data-act=qNext], [data-act=qFinish]'); if (b) { e.preventDefault(); b.click(); } }
    };
    document.addEventListener('keydown', keyFn);
  };
  const record = (q, chosen) => { q.attempts = q.attempts || []; q.attempts.push({ date: U.today(), chosen, ok: chosen === q.answer }); };

  /* ---------- importação ---------- */
  const reviewModal = (parsed, meta) => {
    let qs = parsed.questions;
    qs.forEach((q) => { q.id = q.id || U.uid(); }); Q._review = qs;
    const listHTML = () => qs.map((q, i) => `<div class="q-rev ${q.ok ? '' : 'bad'}" data-i="${i}">
      <div class="row between"><label class="check"><input type="checkbox" data-mchange="inc" data-i="${i}" ${q.ok && q.include !== false ? 'checked' : ''}><b>Questão ${q.num}</b></label>
        <div class="row">${q.type === 'ce' ? '<span class="chip">Certo/Errado</span>' : ''}${!q.ok ? '<span class="chip warn">confira</span>' : ''}${q.banca ? `<span class="chip">${U.esc(q.banca)} ${q.year}</span>` : ''}
        <select data-mchange="ans" data-i="${i}" style="width:auto">${['', ...(q.type === 'ce' ? ['C', 'E'] : q.options.map((o) => o.l))].map((l) => `<option value="${l}" ${q.answer === l ? 'selected' : ''}>${l ? 'Gabarito: ' + l : 'sem gabarito'}</option>`).join('')}</select></div></div>
      ${q.orgao || q.year ? `<small class="muted">📌 ${U.esc([q.orgao, q.year, q.banca].filter(Boolean).join(' · '))}</small>` : ''}
      ${q.needsImage ? `<div class="q-img sm" data-qimg="${q.id}"><small class="muted">gerando imagem…</small></div><small class="muted">🖼️ Tem conta/fração: no treino a questão aparece como imagem do PDF.</small>` : ''}
      <textarea rows="3" data-minput="txt" data-i="${i}">${U.esc(q.text)}</textarea>
      ${q.options.map((o, j) => `<div class="q-rev-opt"><b>${o.l}</b><input value="${U.esc(o.t)}" data-minput="opt" data-i="${i}" data-j="${j}"></div>`).join('')}</div>`).join('');
    const summary = () => `Encontrei <b>${qs.length}</b> questão(ões) · <b>${qs.filter((q) => q.answer).length}</b> com gabarito${parsed.keyFound ? ` (gabarito do fim do arquivo: ${parsed.keyFound} respostas)` : ''} · <b>${qs.filter((q) => !q.ok).length}</b> para conferir.`;
    App.modal({
      title: `Conferir questões — ${U.esc(subj(meta.subjectId).name)}${meta.topic ? ' · ' + U.esc(meta.topic) : ''}`, wide: true, submitLabel: 'Salvar questões',
      body: `<div class="note" id="q-sum">${summary()}</div>
        <details style="margin-bottom:10px"><summary>📋 Colar gabarito separado (ex.: 1-A 2-C 3-B ou tabela)</summary><textarea id="q-key" rows="3" placeholder="1-A 2-C 3-B 4-D…"></textarea><button type="button" class="btn sm mt" data-mact="applyKey">Aplicar gabarito</button></details>
        <div id="q-list" style="max-height:58vh;overflow:auto">${listHTML()}</div>`,
      onMount: (f) => fillImages(f),
      actions: {
        inc: (el) => { qs[+el.dataset.i].include = el.checked; },
        ans: (el, f) => { qs[+el.dataset.i].answer = el.value || null; f.querySelector('#q-sum').innerHTML = summary(); },
        txt: (el) => { qs[+el.dataset.i].text = el.value; },
        opt: (el) => { qs[+el.dataset.i].options[+el.dataset.j].t = el.value; },
        applyKey: (_, f) => { const key = Q.parseKey(f.querySelector('#q-key').value); let n = 0; qs.forEach((q) => { if (key[q.num] && (q.type === 'ce' || q.options.some((o) => o.l === key[q.num]))) { q.answer = key[q.num]; n++; } }); f.querySelector('#q-list').innerHTML = listHTML(); fillImages(f); f.querySelector('#q-sum').innerHTML = summary(); App.toast(`Gabarito aplicado em ${n} questão(ões)`); },
      },
      onSubmit: () => {
        const have = new Set(bank().map((q) => U.norm(q.text + '|' + q.options.map((o) => o.t).join('|')).slice(0, 160)));
        let n = 0, dup = 0;
        App.commit(() => {
          for (const q of qs) {
            if (q.include === false || !q.ok && q.include !== true) continue;
            const k = U.norm(q.text + '|' + q.options.map((o) => o.t).join('|')).slice(0, 160); if (have.has(k)) { dup++; continue; } have.add(k);
            bank().push({ id: q.id || U.uid(), subjectId: meta.subjectId, topic: meta.topic, source: meta.source, num: q.num, text: q.text.trim(), options: q.options, answer: q.answer, type: q.type, explanation: q.explanation, banca: q.banca || meta.banca, year: q.year || meta.year, orgao: q.orgao || '', pdfId: q.pdfId, region: q.region, needsImage: q.needsImage, attempts: [], addedAt: U.today() }); n++;
          }
        });
        App.toast(`📝 ${n} questão(ões) salvas${dup ? ` · ${dup} repetida(s) ignorada(s)` : ''}`);
      },
    });
  };
  const editModal = (q = {}) => {
    const isNew = !q.id; const opts = q.options && q.options.length ? q.options.map((o) => ({ ...o })) : LET.map((l) => ({ l, t: '' }));
    App.modal({
      title: isNew ? 'Nova questão' : 'Editar questão', wide: true,
      body: F.row(F.field('Matéria', `<select name="subjectId">${st().subjects.map((x) => `<option value="${x.id}" ${q.subjectId === x.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select>`), F.text('Assunto', 'topic', q.topic || '', 'list="q-topics2"'), F.select('Tipo', 'type', [['mc', 'Múltipla escolha'], ['ce', 'Certo / Errado']], q.type || 'mc')) +
        `<datalist id="q-topics2">${topicsFor('').map((t) => `<option value="${U.esc(t)}">`).join('')}</datalist>` +
        F.area('Enunciado', 'text', q.text || '', 'rows="5" required') + `<div id="q-opts">${opts.map((o, j) => `<div class="q-rev-opt"><b>${o.l}</b><input name="o${j}" value="${U.esc(o.t)}"></div>`).join('')}</div>` +
        F.row(F.select('Gabarito', 'answer', [['', '—'], ...LET, ['C', 'C (Certo)'], ['E', 'E (Errado)']].map((x) => (Array.isArray(x) ? x : [x, x])), q.answer || ''), F.text('Banca', 'banca', q.banca || ''), F.text('Ano', 'year', q.year || '')) + F.area('Comentário / explicação', 'explanation', q.explanation || '', 'rows="2"'),
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.questions = bank().filter((x) => x.id !== q.id); if (S.run) { S.run.ids = S.run.ids.filter((id) => id !== q.id); if (!S.run.ids.length) S.run = null; else S.run.i = Math.min(S.run.i, S.run.ids.length - 1); } }) },
      onSubmit: (d) => {
        if (!d.text) return false;
        const options = d.type === 'ce' ? [{ l: 'C', t: 'Certo' }, { l: 'E', t: 'Errado' }] : opts.map((o, j) => ({ l: o.l, t: (d['o' + j] || '').trim() })).filter((o) => o.t);
        const o = { subjectId: d.subjectId, topic: d.topic, type: d.type, text: d.text, options, answer: d.answer || null, banca: d.banca, year: d.year, explanation: d.explanation };
        App.commit(() => { if (isNew) bank().push({ id: U.uid(), attempts: [], addedAt: U.today(), ...o }); else Object.assign(q, o); });
      },
    });
  };

  Q.actions = {
    qImport: async (form) => {
      const d = App.formData(form); const files = [...(d.files || [])];
      if (!files.length) return App.toast('Escolha o PDF de questões.', 'error');
      let subjectId = d.subjectId;
      if (subjectId === '__new' || !subjectId) {
        const name = prompt('Nome da matéria:'); if (!name) return;
        subjectId = U.uid(); st().subjects.push({ id: subjectId, name, color: ['#7c5cff', '#22d3ee', '#f97316', '#22c55e', '#ec4899'][st().subjects.length % 5] });
      }
      const btn = form.querySelector('#q-btn'); btn.disabled = true; btn.textContent = 'Lendo o PDF…';
      try {
        let all = { questions: [], keyFound: 0 };
        for (const f of files) {
          const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
          const r = Q.parse(isPdf ? await App.parse.pdfLines(f) : await f.text());
          if (isPdf) { const pdfId = await App.files.put(f); r.questions.forEach((q) => (q.pdfId = pdfId)); }
          all.questions.push(...r.questions); all.keyFound += r.keyFound;
        }
        if (!all.questions.length) { App.toast('Não encontrei questões numeradas neste PDF. Se for um PDF escaneado (imagem), ele não tem texto para ler.', 'error'); }
        else reviewModal(all, { subjectId, topic: d.topic.trim(), banca: d.banca, year: d.year, source: files.map((f) => f.name).join(', ') });
      } catch (e) { App.toast('Erro ao ler: ' + e.message, 'error'); }
      btn.disabled = false; btn.textContent = 'Ler e transcrever questões';
    },
    qManual: (t, e) => { e.preventDefault(); if (!st().subjects.length) return App.toast('Crie uma matéria primeiro (Estudos → Matérias).', 'error'); editModal(); },
    qEdit: (t) => editModal(bank().find((x) => x.id === t.dataset.id)),
    qFav: (t) => App.commit(() => { const q = bank().find((x) => x.id === t.dataset.id); q.fav = !q.fav; }),
    qFsub: (t) => { S.f.subjectId = t.value; S.f.topic = ''; App.rerender(); },
    qStart: (form) => { const d = App.formData(form); S.f = { ...S.f, ...d }; start('treino', S.f); },
    qStartSim: () => { const f = document.querySelector('[data-submit=qStart]'); const d = App.formData(f); S.f = { ...S.f, ...d }; start('simulado', S.f); },
    qGo: (t) => start('treino', { subjectId: t.dataset.s, topic: t.dataset.t || '', which: 'todas', n: 20, shuffle: true }),
    qPick: (t) => { const r = S.run, q = bank().find((x) => x.id === r.ids[r.i]); if (r.revealed[q.id]) return; r.answers[q.id] = t.dataset.l; App.rerender(); },
    qConfirm: () => { const r = S.run, q = bank().find((x) => x.id === r.ids[r.i]); if (!r.answers[q.id]) return; r.revealed[q.id] = true; record(q, r.answers[q.id]); App.save(); App.rerender(); },
    qNext: () => { S.run.i++; App.rerender(); window.scrollTo(0, 0); },
    qPrev: () => { S.run.i = Math.max(0, S.run.i - 1); App.rerender(); },
    qFinish: () => {
      const r = S.run; r.t1 = Date.now();
      if (r.mode === 'simulado') r.ids.forEach((id) => { const q = bank().find((x) => x.id === id); if (q && r.answers[id]) record(q, r.answers[id]); });
      r.done = true; App.save(); App.rerender(); window.scrollTo(0, 0);
      const sec = Math.round((r.t1 - r.t0) / 60000); if (sec >= 1) st().sessions.push({ id: U.uid(), date: U.today(), subjectId: (bank().find((x) => x.id === r.ids[0]) || {}).subjectId || '', minutes: sec, topic: 'Questões', source: 'questoes' });
    },
    qRedoWrong: () => { const r = S.run; const wrong = r.ids.filter((id) => { const q = bank().find((x) => x.id === id); return q && r.answers[id] !== q.answer; }); S.run = { ...r, ids: wrong, i: 0, answers: {}, revealed: {}, t0: Date.now(), done: false }; App.rerender(); },
    qToggleImg: () => { S.showImg = !S.showImg; App.rerender(); },
    qToggleText: () => { S.showText = !S.showText; App.rerender(); },
    qQuit: () => { S.run = null; clearInterval(timerIv); App.rerender(); },
    qSearch: U.debounce((t) => { S.list.q = t.value; S.list.page = 1; App.rerender(); const i = document.getElementById('q-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250),
    qPage: (t) => { S.list.page = Math.max(1, S.list.page + +t.dataset.d); App.rerender(); },
  };
})(window.App);
