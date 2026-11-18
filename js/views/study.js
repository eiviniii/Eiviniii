/* ==========================================================
   ESTUDOS — matérias, PDFs, cronograma, pomodoro, concursos/editais
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const SUBJ_COLORS = ['#7c5cff', '#22d3ee', '#f97316', '#22c55e', '#ec4899', '#eab308', '#3b82f6', '#ef4444', '#14b8a6', '#a855f7'];
  const subj = (id) => st().subjects.find((s) => s.id === id) || { id: '', name: 'Geral', color: '#64748b' };
  const Study = (App.Study = {});

  Study.weekMinutes = (subjectId) => { const ws = U.weekStart(U.today()); return U.sum(st().sessions.filter((s) => s.date >= ws && (!subjectId || s.subjectId === subjectId)), (s) => s.minutes); };
  Study.streak = () => {
    const days = new Set(st().sessions.map((s) => s.date)); let n = 0, d = U.today();
    if (!days.has(d)) d = U.addDays(d, -1);
    while (days.has(d)) { n++; d = U.addDays(d, -1); }
    return n;
  };
  Study.todayBlocks = () => st().schedule.filter((b) => +b.day === new Date().getDay()).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const hm = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m}min`; };
  Study.hm = hm;

  /* ---------- Pomodoro (continua rodando ao trocar de aba) ---------- */
  const T = (App.Timer = App.Timer || { running: false, mode: 'focus', remaining: null, endAt: 0, subjectId: '', topic: '', iv: null, focusDone: 0 });
  const focusLen = () => (st().settings.pomodoro || 25) * 60, breakLen = () => (st().settings.pause || 5) * 60;
  const beep = () => { try { const c = new AudioContext(); const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.setValueAtTime(.2, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + 1.2); o.start(); o.stop(c.currentTime + 1.2); } catch (e) { /* sem áudio */ } };
  const notify = (msg) => { try { if (Notification.permission === 'granted') new Notification('Vida OS', { body: msg }); } catch (e) { /* */ } App.toast(msg); };
  const tick = () => {
    if (!T.running) return;
    T.remaining = Math.max(0, Math.round((T.endAt - Date.now()) / 1000));
    if (T.remaining <= 0) {
      beep();
      if (T.mode === 'focus') {
        const mins = Math.round(focusLen() / 60);
        st().sessions.push({ id: U.uid(), date: U.today(), subjectId: T.subjectId, minutes: mins, topic: T.topic, source: 'pomodoro' });
        App.save(); T.focusDone++;
        notify(`Foco concluído! +${mins} min de ${subj(T.subjectId).name}. Hora da pausa.`);
        T.mode = 'break'; T.endAt = Date.now() + breakLen() * 1000;
      } else { notify('Pausa encerrada. Bora para o próximo ciclo!'); T.mode = 'focus'; T.running = false; T.remaining = focusLen(); }
      if (App.route().view === 'estudos') App.rerender();
    }
    paintTimer();
  };
  const paintTimer = () => {
    const el = document.getElementById('timer-display'); if (!el) return;
    const rem = T.remaining ?? focusLen();
    el.textContent = `${String(Math.floor(rem / 60)).padStart(2, '0')}:${String(rem % 60).padStart(2, '0')}`;
    const total = T.mode === 'focus' ? focusLen() : breakLen();
    const ring = document.getElementById('timer-ring');
    if (ring) ring.style.strokeDashoffset = String(553 * (rem / total));
    document.title = T.running ? `${el.textContent} · ${T.mode === 'focus' ? 'Foco' : 'Pausa'}` : 'Vida OS';
  };
  if (!T.iv) T.iv = setInterval(tick, 1000);

  const timerCard = () => `<div class="card"><header><h3>⏱️ Pomodoro</h3><span class="chip ${T.mode === 'focus' ? 'info' : 'ok'}">${T.mode === 'focus' ? 'Foco' : 'Pausa'}</span></header>
    <div class="ring"><svg viewBox="0 0 190 190"><circle cx="95" cy="95" r="88" stroke="var(--line)"/><circle id="timer-ring" cx="95" cy="95" r="88" stroke="${T.mode === 'focus' ? 'var(--accent)' : 'var(--ok)'}" stroke-linecap="round" stroke-dasharray="553" stroke-dashoffset="0" style="transition:stroke-dashoffset 1s linear"/></svg>
      <div><div class="timer" id="timer-display">--:--</div><div class="muted" style="text-align:center;font-size:.85rem">${T.focusDone} ciclo(s) hoje</div></div></div>
    <div class="frow mt"><label class="field"><span>Matéria</span><select data-change="tSubj"><option value="">Geral</option>${st().subjects.map((s) => `<option value="${s.id}" ${T.subjectId === s.id ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Assunto</span><input data-input="tTopic" value="${U.esc(T.topic)}" placeholder="Ex.: Crase"></label></div>
    <div class="row" style="justify-content:center"><button class="btn primary" data-act="tToggle">${T.running ? '⏸ Pausar' : '▶ Iniciar'}</button><button class="btn" data-act="tReset">↺ Zerar</button><button class="btn ghost" data-act="tSkip">⏭ Pular</button></div>
  </div>`;

  /* ---------- telas ---------- */
  const views = {};
  views.painel = () => {
    const blocks = Study.todayBlocks();
    const wk = Study.weekMinutes();
    const goals = st().subjects.filter((s) => s.goalHours > 0);
    const next = (st().concursos || []).filter((c) => c.provaDate && c.provaDate >= U.today()).sort((a, b) => a.provaDate.localeCompare(b.provaDate))[0];
    return `<div class="grid g4">
      <div class="card accent stat"><div class="lbl">Estudado na semana</div><div class="val">${hm(wk)}</div><div class="sub">hoje: ${hm(U.sum(st().sessions.filter((s) => s.date === U.today()), (s) => s.minutes))}</div></div>
      <div class="card stat"><div class="lbl">Sequência</div><div class="val">🔥 ${Study.streak()} dia(s)</div><div class="sub">estudando sem falhar</div></div>
      <div class="card stat"><div class="lbl">Materiais</div><div class="val">${st().materials.length}</div><div class="sub">${st().materials.filter((m) => m.status === 'lido').length} lidos</div></div>
      <div class="card stat"><div class="lbl">Próxima prova</div><div class="val" style="font-size:1.2rem">${next ? `${U.diffDays(U.today(), next.provaDate)} dias` : '—'}</div><div class="sub">${next ? U.esc(next.name) : 'cadastre em Concursos'}</div></div>
    </div>
    <div class="grid g3 mt">
      ${timerCard()}
      <div class="card"><header><h3>📋 Cronograma de hoje</h3><a href="#/estudos/cronograma" class="btn sm ghost">editar</a></header>
        ${blocks.length ? blocks.map((b) => { const s = subj(b.subjectId); return `<div class="block" style="background:${s.color}"><b>${U.esc(s.name)}</b>${b.start || ''}${b.end ? '–' + b.end : ''} ${b.topic ? '· ' + U.esc(b.topic) : ''}</div>`; }).join('') : App.empty('🗓️', 'Nada no cronograma hoje', 'Monte seu cronograma semanal.')}
        <button class="btn block mt" data-act="logSession">＋ Registrar estudo manual</button>
      </div>
      <div class="card"><header><h3>🎯 Metas da semana</h3></header>
        ${goals.length ? goals.map((s) => { const m = Study.weekMinutes(s.id), p = (m / (s.goalHours * 60)) * 100; return `<div style="margin-bottom:12px"><div class="row between"><span><span class="dot" style="background:${s.color}"></span> ${U.esc(s.name)}</span><small>${hm(m)} / ${s.goalHours}h</small></div><div class="bar"><i style="width:${Math.min(100, p)}%;background:${s.color}"></i></div></div>`; }).join('') : '<p class="muted">Defina horas/semana em cada matéria.</p>'}
      </div>
    </div>
    <div class="grid g2 mt"><div class="card"><header><h3>📊 Últimos 14 dias</h3></header><div class="chart-box"><canvas id="st-14"></canvas></div></div>
      <div class="card"><header><h3>🧠 Por matéria (30 dias)</h3></header><div class="chart-box"><canvas id="st-subj"></canvas></div></div></div>
    ${App.MindMaps.widget() ? `<div class="mt">${App.MindMaps.widget()}</div>` : ''}`;
  };
  const mountPainel = () => {
    paintTimer();
    const days = Array.from({ length: 14 }, (_, i) => U.addDays(U.today(), i - 13));
    const subs = [...st().subjects, { id: '', name: 'Geral', color: '#64748b' }];
    App.chart(document.getElementById('st-14'), { type: 'bar', data: { labels: days.map((d) => U.dateBR(d).slice(0, 5)), datasets: subs.map((s) => ({ label: s.name, backgroundColor: s.color, borderRadius: 4, data: days.map((d) => U.round(U.sum(st().sessions.filter((x) => x.date === d && (x.subjectId || '') === s.id), (x) => x.minutes) / 60, 2)) })).filter((d) => d.data.some((x) => x)) }, options: { scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: 'horas' } } } } });
    const from = U.addDays(U.today(), -30);
    const data = subs.map((s) => ({ s, h: U.sum(st().sessions.filter((x) => x.date >= from && (x.subjectId || '') === s.id), (x) => x.minutes) / 60 })).filter((x) => x.h);
    App.chart(document.getElementById('st-subj'), { type: 'doughnut', data: { labels: data.map((x) => x.s.name), datasets: [{ data: data.map((x) => U.round(x.h, 1)), backgroundColor: data.map((x) => x.s.color), borderWidth: 0 }] }, options: { cutout: '62%', plugins: { legend: { position: 'right' } } } });
  };

  views.materias = () => `<div class="row between" style="margin-bottom:14px"><p class="muted" style="margin:0">Seus PDFs ficam salvos no próprio navegador (não vão para nenhum servidor).</p><button class="btn primary" data-act="addSubj">＋ Matéria</button></div>
    ${st().subjects.length ? `<div class="grid g-auto">${st().subjects.map((s) => {
      const mats = st().materials.filter((m) => m.subjectId === s.id);
      return `<div class="card" style="border-top:4px solid ${s.color}"><header><h3>${U.esc(s.name)}</h3><div><button class="icon-btn" data-act="editSubj" data-id="${s.id}">✏️</button></div></header>
        <div class="row" style="margin-top:-6px;margin-bottom:10px"><span class="chip">${mats.length} arquivo(s)</span><span class="chip">${hm(U.sum(st().sessions.filter((x) => x.subjectId === s.id), (x) => x.minutes))} estudadas</span></div>
        <div class="list">${mats.map((m) => `<div class="li"><div class="ico">📄</div><div class="grow"><div class="t" title="${U.esc(m.name)}">${U.esc(m.name)}</div><div class="s">${(m.size / 1048576).toFixed(1)} MB · ${U.dateBR(m.addedAt)}</div></div>
          <select data-change="matStatus" data-id="${m.id}" style="width:auto;padding:4px 6px;font-size:.8rem">${[['', 'Não lido'], ['lendo', 'Lendo'], ['lido', 'Lido ✓']].map(([v, l]) => `<option value="${v}" ${(m.status || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button class="icon-btn" data-act="openFile" data-id="${m.fileId}">👁️</button><button class="icon-btn" data-act="delMat" data-id="${m.id}">🗑️</button></div>`).join('') || '<p class="muted" style="margin:0">Nenhum material.</p>'}</div>
        <label class="btn btn-file block mt">⬆ Subir PDFs<input type="file" accept=".pdf,application/pdf,image/*,.doc,.docx,.ppt,.pptx" multiple data-change="upMat" data-id="${s.id}"></label>
      </div>`; }).join('')}</div>` : App.empty('📚', 'Crie suas matérias', 'Ex.: Português, Direito Constitucional, Raciocínio Lógico… Depois suba os PDFs de cada uma.', '<button class="btn primary" data-act="addSubj">＋ Matéria</button>')}`;

  views.cronograma = () => {
    const td = new Date().getDay();
    return `<div class="card"><header><h3>🗓️ Cronograma semanal</h3><div class="row"><button class="btn primary" data-act="addBlock">＋ Bloco</button></div></header>
      ${st().subjects.length ? '' : '<div class="note warn">Crie suas matérias primeiro na aba “Matérias”.</div>'}
      <div class="week">${[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const bl = st().schedule.filter((b) => +b.day === d).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
        const mins = U.sum(bl, (b) => (b.start && b.end ? Math.max(0, U.diffMinutes(b.start, b.end)) : 0));
        return `<div class="col ${d === td ? 'today' : ''}"><h4>${U.DAYS[d]} <small>${mins ? hm(mins) : ''}</small></h4>
          ${bl.map((b) => { const s = subj(b.subjectId); return `<div class="block" style="background:${s.color}" data-act="editBlock" data-id="${b.id}"><b>${U.esc(s.name)}</b>${b.start || ''}${b.end ? '–' + b.end : ''}${b.topic ? `<br>${U.esc(b.topic)}` : ''}</div>`; }).join('')}
          <button class="btn sm ghost block" data-act="addBlock" data-day="${d}">＋</button></div>`; }).join('')}</div>
    </div>`;
  };
  U.diffMinutes = (a, b) => { const [h1, m1] = a.split(':').map(Number), [h2, m2] = b.split(':').map(Number); return h2 * 60 + m2 - (h1 * 60 + m1); };

  views.concursos = () => {
    const list = (st().concursos || []).slice().sort((a, b) => (a.provaDate || '9').localeCompare(b.provaDate || '9'));
    const statusChip = { interesse: ['Interesse', ''], inscrito: ['Inscrito', 'info'], pago: ['Taxa paga', 'ok'], realizado: ['Prova feita', 'warn'], aprovado: ['Aprovado 🏆', 'ok'] };
    return `<div class="grid g2">
      <div class="card"><header><h3>📄 Ler edital automaticamente</h3></header>
        <div class="note">Suba o PDF do edital. O sistema procura <b>datas de inscrição, prova, TAF, exames médicos, avaliação psicológica, taxa, salário, vagas e banca</b>. Você confere e ele joga tudo na agenda.</div>
        <label class="drop"><input type="file" accept=".pdf,application/pdf,image/*,.txt" data-change="edital"><b>📎 Escolher edital (PDF)</b>a leitura é feita no seu aparelho</label>
        <button class="btn block mt" data-act="addConc">＋ Cadastrar concurso manualmente</button>
      </div>
      <div class="card"><header><h3>⏳ Contagem regressiva</h3></header>
        ${list.filter((c) => c.provaDate >= U.today()).slice(0, 3).map((c) => { const d = U.diffDays(U.today(), c.provaDate); return `<div class="li"><div class="grow"><div class="t">${U.esc(c.name)}</div><div class="s">prova ${U.dateNice(c.provaDate)}</div></div><div class="countdown"><div><b>${d}</b><small>dias</small></div><div><b>${Math.floor(d / 7)}</b><small>semanas</small></div></div></div>`; }).join('') || '<p class="muted">Nenhuma prova futura cadastrada.</p>'}
      </div>
    </div>
    <div class="grid g-auto mt">${list.map((c) => {
      const s = statusChip[c.status] || statusChip.interesse;
      const dates = App.parse.ED_RULES.filter(([k]) => c[k]).map(([k, l]) => `<div class="li" style="padding:6px 0"><div class="grow s">${l}</div><b style="font-size:.88rem">${U.dateBR(c[k])}</b></div>`).join('');
      return `<div class="card"><header><h3>📝 ${U.esc(c.name)}</h3><span class="chip ${s[1]}">${s[0]}</span></header>
        <div class="row" style="margin:-6px 0 8px">${c.banca ? `<span class="chip">🏛️ ${U.esc(c.banca)}</span>` : ''}${c.cargo ? `<span class="chip">${U.esc(c.cargo)}</span>` : ''}${c.vagas ? `<span class="chip">${c.vagas} vagas</span>` : ''}</div>
        <div class="row between"><span class="muted">Taxa</span><b>${c.taxa ? U.money(c.taxa) : '—'}</b></div><div class="row between"><span class="muted">Remuneração</span><b>${c.salario ? U.money(c.salario) : '—'}</b></div>
        <div class="list mt">${dates || '<p class="muted">Sem datas.</p>'}</div>
        ${c.notes ? `<p class="muted">${U.esc(c.notes)}</p>` : ''}
        <div class="row mt">${c.fileId ? `<button class="btn sm" data-act="openFile" data-id="${c.fileId}">📄 Edital</button>` : ''}${c.link ? `<a class="btn sm" href="${U.esc(c.link)}" target="_blank" rel="noopener">↗ Site</a>` : ''}<button class="btn sm" data-act="emOpen" data-id="${c.id}">🗺️ Mapa${c.topics && c.topics.length ? ' ' + App.EditalMap.pct(c) + '%' : ''}</button><button class="btn sm" data-act="editConc" data-id="${c.id}">✏️ Editar</button></div>
      </div>`; }).join('')}</div>`;
  };

  views.biblioteca = () => App.Lib.view();
  views.mapa = () => App.EditalMap.view();
  views.questoes = () => App.Questions.view();
  views.mapas = () => App.MindMaps.view();
  views.historico = () => {
    const list = st().sessions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 300);
    return `<div class="card"><header><h3>🕘 Histórico de estudos</h3><button class="btn primary" data-act="logSession">＋ Registrar</button></header>
      ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Matéria</th><th>Assunto</th><th class="r">Tempo</th><th></th></tr></thead><tbody>${list.map((s) => `<tr><td>${U.dateBR(s.date)}</td><td><span class="dot" style="background:${subj(s.subjectId).color}"></span> ${U.esc(subj(s.subjectId).name)}</td><td>${U.esc(s.topic || '')}</td><td class="r">${hm(s.minutes)}</td><td class="actions"><button class="icon-btn" data-act="delSession" data-id="${s.id}">✕</button></td></tr>`).join('')}</tbody></table></div>` : App.empty('🕘', 'Sem registros', 'Use o Pomodoro ou registre manualmente.')}</div>`;
  };

  /* ---------- modais ---------- */
  const subjModal = (s = {}) => {
    const isNew = !s.id;
    App.modal({
      title: isNew ? 'Nova matéria' : 'Editar matéria',
      body: F.row(F.text('Nome', 'name', s.name || '', 'required'), F.color('Cor', 'color', s.color || SUBJ_COLORS[st().subjects.length % 10])) + F.row(F.number('Meta (horas/semana)', 'goalHours', s.goalHours || '')) + F.area('Anotações / conteúdo programático', 'notes', s.notes || ''),
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((x) => { x.subjects = x.subjects.filter((y) => y.id !== s.id); x.materials.filter((m) => m.subjectId === s.id).forEach((m) => App.files.del(m.fileId)); x.materials = x.materials.filter((m) => m.subjectId !== s.id); x.schedule = x.schedule.filter((b) => b.subjectId !== s.id); }) },
      onSubmit: (d) => { if (!d.name) return false; App.commit((x) => { if (isNew) x.subjects.push({ id: U.uid(), ...d }); else Object.assign(x.subjects.find((y) => y.id === s.id), d); }); },
    });
  };
  const blockModal = (b = {}, day) => {
    const isNew = !b.id;
    App.modal({
      title: isNew ? 'Bloco de estudo' : 'Editar bloco',
      body: F.row(F.select('Dia', 'day', [1, 2, 3, 4, 5, 6, 0].map((d) => [d, U.DAYS[d]]), b.day ?? day ?? 1), F.select('Matéria', 'subjectId', st().subjects.map((s) => [s.id, s.name]), b.subjectId)) +
        F.row(F.time('Início', 'start', b.start || '19:00'), F.time('Fim', 'end', b.end || '20:00')) + F.text('Assunto / tarefa', 'topic', b.topic || '', 'placeholder="Ex.: Questões de crase"') +
        (isNew ? '<div style="height:10px"></div>' + F.check('Repetir em todos os dias úteis (seg–sex)', 'weekdays', false) : ''),
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((x) => { x.schedule = x.schedule.filter((y) => y.id !== b.id); }) },
      onSubmit: (d) => App.commit((x) => {
        if (!isNew) return Object.assign(x.schedule.find((y) => y.id === b.id), d);
        const days = d.weekdays ? [1, 2, 3, 4, 5] : [d.day];
        days.forEach((dd) => x.schedule.push({ id: U.uid(), ...d, day: +dd, weekdays: undefined }));
      }),
    });
  };
  const sessionModal = () => App.modal({
    title: 'Registrar estudo',
    body: F.row(F.date('Data', 'date', U.today()), F.select('Matéria', 'subjectId', [['', 'Geral'], ...st().subjects.map((s) => [s.id, s.name])], T.subjectId), F.number('Minutos', 'minutes', 60)) + F.text('Assunto', 'topic', '') + '<div style="height:10px"></div>' + F.check('Agendar revisões na agenda (1, 7 e 30 dias depois)', 'review', false),
    onSubmit: (d) => {
      if (!d.minutes) return false;
      App.commit((x) => {
        x.sessions.push({ id: U.uid(), date: d.date, subjectId: d.subjectId, minutes: d.minutes, topic: d.topic });
        if (d.review) [1, 7, 30].forEach((n) => x.events.push({ id: U.uid(), title: `Revisar ${subj(d.subjectId).name}${d.topic ? ': ' + d.topic : ''} (${n}d)`, type: 'revisao', date: U.addDays(d.date, n), recur: 'none' }));
      });
      App.toast('Estudo registrado');
    },
  });

  const concModal = (c = {}, extracted) => {
    const isNew = !c.id;
    const ev = (extracted && extracted.evidence) || {};
    const dateField = ([k, l]) => F.field(l + (ev[k] ? ` <small title="${U.esc(ev[k])}">✨ lido</small>` : ''), F.input(k, c[k] || '', 'type="date"'));
    App.modal({
      title: isNew ? (extracted ? 'Conferir dados do edital' : 'Novo concurso') : 'Editar concurso', wide: true,
      body: (extracted ? `<div class="note">✨ Preenchi o que encontrei no edital. <b>Confira</b> — editais variam muito de formato. Campos com “✨ lido” vieram do arquivo (passe o mouse para ver o trecho).</div>` : '') +
        F.row(F.text('Concurso / órgão', 'name', c.name || '', 'required'), F.text('Cargo', 'cargo', c.cargo || ''), F.text('Banca', 'banca', c.banca || '')) +
        F.row(F.number('Taxa de inscrição (R$)', 'taxa', c.taxa), F.number('Remuneração (R$)', 'salario', c.salario), F.number('Vagas', 'vagas', c.vagas), F.select('Status', 'status', [['interesse', 'Interesse'], ['inscrito', 'Inscrito'], ['pago', 'Taxa paga'], ['realizado', 'Prova feita'], ['aprovado', 'Aprovado']], c.status || 'interesse')) +
        `<h4 style="margin:6px 0 10px">📅 Datas</h4><div class="frow">${App.parse.ED_RULES.map(dateField).join('')}</div>` +
        F.row(F.text('Site / link', 'link', c.link || ''), F.text('Escolaridade', 'escolaridade', c.escolaridade || '')) + F.area('Notas', 'notes', c.notes || '') +
        '<div style="height:10px"></div>' + F.check('Adicionar / atualizar estas datas na agenda', 'toAgenda', true) +
        (extracted && extracted.allDates.length ? `<details class="mt"><summary>🔎 Todas as datas encontradas no edital (${extracted.allDates.length})</summary><div class="list" style="max-height:260px;overflow:auto">${extracted.allDates.map((d) => `<div class="li"><b style="min-width:90px">${U.dateBR(d.iso)}</b><div class="grow s">${U.esc(d.context)}</div></div>`).join('')}</div></details>` : ''),
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((x) => { x.concursos = x.concursos.filter((y) => y.id !== c.id); x.events = x.events.filter((e) => e.concursoId !== c.id); if (c.fileId) App.files.del(c.fileId); }) },
      onSubmit: (d) => {
        if (!d.name) { App.toast('Informe o nome do concurso.', 'error'); return false; }
        const toAgenda = d.toAgenda; delete d.toAgenda;
        App.commit((x) => {
          let obj;
          if (isNew) { obj = { id: U.uid(), fileId: c.fileId, ...d }; x.concursos.push(obj); } else { obj = x.concursos.find((y) => y.id === c.id); Object.assign(obj, d); }
          if (toAgenda) {
            x.events = x.events.filter((e) => e.concursoId !== obj.id);
            const map = { inscricaoInicio: 'inscricao', inscricaoFim: 'inscricao', isencao: 'inscricao', pagamento: 'conta', provaDate: 'prova', tafDate: 'taf', examesDate: 'exame', psicoDate: 'exame', investDate: 'compromisso', resultadoDate: 'compromisso' };
            for (const [k, l] of App.parse.ED_RULES) if (obj[k]) x.events.push({ id: U.uid(), concursoId: obj.id, title: `${l} — ${obj.name}`.slice(0, 90), type: map[k], date: obj[k], value: k === 'pagamento' ? obj.taxa || 0 : 0, recur: 'none', link: obj.link || '' });
          }
        });
        App.toast(toAgenda ? 'Concurso salvo e datas adicionadas à agenda 📅' : 'Concurso salvo');
      },
    });
  };

  App.views.estudos = {
    render(r) {
      const sub = views[r.sub] ? r.sub : 'painel'; this._sub = sub;
      return `<div class="page-head"><div><h1>📚 Estudos</h1><p>Matérias, materiais, cronograma, foco e concursos.</p></div></div>
        ${App.subtabs('estudos', [['painel', 'Painel'], ['biblioteca', '🔎 Biblioteca'], ['materias', 'Matérias & PDFs'], ['cronograma', 'Cronograma'], ['concursos', 'Concursos & editais'], ['questoes', '📝 Questões'], ['mapas', '🧠 Mapas mentais'], ['mapa', '🗺️ Mapa do edital'], ['historico', 'Histórico']], sub)}${views[sub]()}`;
    },
    mount(el) {
      if (this._sub === 'painel') mountPainel();
      if (this._sub === 'questoes') App.Questions.mount(el);
      if (this._sub === 'mapas') App.MindMaps.mount(el);
      const inp = el.querySelector('[name=files]'); const ch = el.querySelector('#lib-chosen');
      if (inp && ch) inp.addEventListener('change', () => { ch.textContent = [...inp.files].map((f) => f.name).join(', '); });
    },
    actions: {
      ...App.Lib.actions,
      ...App.EditalMap.actions,
      ...App.Questions.actions,
      ...App.MindMaps.actions,
      emOpen: (t) => App.EditalMap.openFor(t.dataset.id),
      addSubj: () => subjModal(), editSubj: (t) => subjModal(st().subjects.find((s) => s.id === t.dataset.id)),
      addBlock: (t) => blockModal({}, t.dataset.day !== undefined ? +t.dataset.day : undefined), editBlock: (t) => blockModal(st().schedule.find((b) => b.id === t.dataset.id)),
      logSession: () => sessionModal(),
      delSession: (t) => App.commit((x) => { x.sessions = x.sessions.filter((s) => s.id !== t.dataset.id); }),
      upMat: async (t) => {
        App.toast('Salvando e lendo o conteúdo dos PDFs…');
        let n = 0; try { n = await App.Lib.addFiles([...t.files], { subjectId: t.dataset.id }); } catch (e) { App.toast('Falha ao salvar: ' + e.message, 'error'); }
        App.rerender(); App.toast(`${n} arquivo(s) salvo(s) e pesquisáveis`);
      },
      matStatus: (t) => App.commit((x) => { x.materials.find((m) => m.id === t.dataset.id).status = t.value; }),
      delMat: (t) => App.confirm('Excluir este material?', () => App.commit((x) => { const m = x.materials.find((y) => y.id === t.dataset.id); App.files.del(m.fileId); App.Lib.forget(m.fileId); x.materials = x.materials.filter((y) => y.id !== m.id); })),
      tToggle: () => {
        if (T.running) { T.running = false; T.remaining = Math.max(0, Math.round((T.endAt - Date.now()) / 1000)); }
        else { T.running = true; T.endAt = Date.now() + (T.remaining ?? focusLen()) * 1000; try { Notification.permission === 'default' && Notification.requestPermission(); } catch (e) { /* */ } }
        App.rerender();
      },
      tReset: () => { T.running = false; T.mode = 'focus'; T.remaining = focusLen(); App.rerender(); },
      tSkip: () => { T.endAt = Date.now(); T.running = true; tick(); },
      tSubj: (t) => { T.subjectId = t.value; },
      tTopic: (t) => { T.topic = t.value; },
      addConc: () => concModal(),
      editConc: (t) => concModal(st().concursos.find((c) => c.id === t.dataset.id)),
      edital: async (t) => {
        const f = t.files[0]; if (!f) return;
        App.toast('Lendo edital… isso pode levar alguns segundos.');
        try {
          const { text } = await App.parse.read(f);
          const res = App.parse.edital(text);
          let fileId = null; try { fileId = await App.files.put(f); } catch (e) { /* */ }
          concModal({ ...res.fields, fileId }, res);
          if (!Object.keys(res.fields).length) App.toast('Não achei dados automaticamente — preencha manualmente.', 'error');
        } catch (e) { console.error(e); App.toast('Não consegui ler este arquivo: ' + e.message, 'error'); }
        t.value = '';
      },
    },
    quick: { study: () => sessionModal(), lib: () => App.Lib.quickUpload() },
  };
})(window.App);
