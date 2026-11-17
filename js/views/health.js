/* ==========================================================
   REMÉDIOS & SUPLEMENTOS · SONO & HUMOR (sub-abas de Fitness)
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const H = (App.Health = {});
  const meds = () => (st().meds = st().meds || []);
  const well = () => (st().wellbeing = st().wellbeing || {});

  /* ---------- doses ---------- */
  const daysOn = (m, iso) => !m.days || !m.days.length || m.days.includes(U.parseISO(iso).getDay());
  const active = (m, iso) => !m.paused && (!m.start || iso >= m.start) && (!m.end || iso <= m.end) && daysOn(m, iso);
  H.dosesOf = (iso) => {
    const out = [];
    for (const m of meds()) if (active(m, iso)) for (const t of (m.times && m.times.length ? m.times : ['08:00'])) out.push({ m, time: t, key: `${iso}|${t}`, taken: !!(m.log || {})[`${iso}|${t}`] });
    return out.sort((a, b) => a.time.localeCompare(b.time));
  };
  H.perDay = (m) => (m.times && m.times.length ? m.times.length : 1) * (+m.perDose || 1) * (m.days && m.days.length ? m.days.length / 7 : 1);
  H.daysLeft = (m) => (m.stock === '' || m.stock == null ? null : Math.floor((+m.stock || 0) / (H.perDay(m) || 1)));
  H.adherence = (m, n = 14) => { let due = 0, ok = 0; for (let i = 1; i <= n; i++) { const d = U.addDays(U.today(), -i); if (!active(m, d)) continue; for (const t of m.times || ['08:00']) { due++; if ((m.log || {})[`${d}|${t}`]) ok++; } } return due ? ok / due : null; };

  /* ---------- lembretes (enquanto o Vida OS estiver aberto) ---------- */
  const warned = new Set();
  setInterval(() => {
    if (!App.state) return;
    const now = new Date(), hh = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    for (const d of H.dosesOf(U.today())) {
      if (d.taken || d.time > hh) continue;
      const late = (now.getHours() * 60 + now.getMinutes()) - (+d.time.slice(0, 2) * 60 + +d.time.slice(3));
      const k = d.m.id + d.key;
      if (late <= 30 && !warned.has(k)) {
        warned.add(k);
        const msg = `💊 Hora de tomar ${d.m.name}${d.m.dose ? ' (' + d.m.dose + ')' : ''} — ${d.time}`;
        App.toast(msg);
        try { if (Notification.permission === 'granted') new Notification('Vida OS', { body: msg }); } catch (e) { /* */ }
      }
    }
  }, 30000);

  const KIND = { remedio: '💊 Remédio', suplemento: '🥤 Suplemento', vitamina: '🍊 Vitamina' };
  H.viewMeds = () => {
    const today = U.today(), doses = H.dosesOf(today), done = doses.filter((d) => d.taken).length;
    const low = meds().filter((m) => { const n = H.daysLeft(m); return n != null && n <= 7 && !m.paused; });
    const now = new Date(), hh = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return `<div class="grid g3">
      <div class="card span2"><header><h3>🕐 Hoje · ${U.dateNice(today)}</h3><small class="muted">${done}/${doses.length} tomados</small></header>
        ${doses.length ? `<div class="bar" style="margin-bottom:12px"><i style="width:${(done / doses.length) * 100}%"></i></div>${doses.map((d) => `<div class="task ${d.taken ? 'done' : ''}"><button class="tick" data-act="mdTake" data-id="${d.m.id}" data-k="${d.key}" style="border-color:${d.m.color || 'var(--accent)'}">${d.taken ? '✓' : ''}</button>
          <div class="grow"><div class="t">${U.esc(d.m.name)} ${d.m.dose ? `<small class="muted">${U.esc(d.m.dose)}</small>` : ''}</div><div class="s">${KIND[d.m.kind] || ''}${d.m.notes ? ' · ' + U.esc(d.m.notes) : ''}</div></div>
          <span class="chip ${!d.taken && d.time < hh ? 'warn' : ''}">${d.time}</span></div>`).join('')}` : App.empty('💊', 'Nada para hoje', 'Cadastre remédios, suplementos (creatina, whey…) e vitaminas com os horários.')}
        <button class="btn primary mt" data-act="mdAdd">＋ Remédio / suplemento</button></div>
      <div class="stack">
        ${low.length ? `<div class="card" style="border-color:var(--warn)"><header><h3>⚠️ Acabando</h3></header>${low.map((m) => `<div class="li"><div class="grow"><div class="t">${U.esc(m.name)}</div><div class="s">restam ${m.stock} ${U.esc(m.unit || 'un.')}</div></div><span class="chip warn">${H.daysLeft(m)} dia(s)</span><button class="btn sm" data-act="mdRefill" data-id="${m.id}">＋ estoque</button></div>`).join('')}</div>` : ''}
        <div class="card"><header><h3>📋 Todos</h3></header>${meds().length ? meds().map((m) => { const a = H.adherence(m), n = H.daysLeft(m); return `<div class="li" style="${m.paused ? 'opacity:.5' : ''}"><div class="grow"><div class="t">${U.esc(m.name)}</div><div class="s">${(m.times || []).join(', ')}${n != null ? ` · estoque ${n} dia(s)` : ''}${a != null ? ` · tomou ${Math.round(a * 100)}% (14 dias)` : ''}</div></div><button class="icon-btn" data-act="mdEdit" data-id="${m.id}">✏️</button></div>`; }).join('') : '<p class="muted">—</p>'}</div>
      </div></div>
      <p class="muted"><small>🔔 Os lembretes aparecem enquanto o Vida OS estiver aberto (ative as notificações em Ajustes → Preferências). Não substitui orientação médica.</small></p>`;
  };
  const medModal = (m = {}) => App.modal({
    title: m.id ? 'Editar' : 'Novo remédio / suplemento',
    body: F.row(F.text('Nome', 'name', m.name || '', 'required placeholder="Ex.: Creatina, Vitamina D, Losartana"'), F.select('Tipo', 'kind', Object.entries(KIND), m.kind || 'suplemento'), F.color('Cor', 'color', m.color || '#7c5cff')) +
      F.row(F.text('Dose', 'dose', m.dose || '', 'placeholder="Ex.: 5 g, 1 comprimido"'), F.text('Horários (separados por vírgula)', 'times', (m.times || ['08:00']).join(', '), 'placeholder="08:00, 20:00"')) +
      `<div class="field"><span>Dias</span><div class="row">${U.DAY3.map((d, i) => `<label class="check"><input type="checkbox" name="d${i}" ${!m.days || !m.days.length || m.days.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div></div>` +
      F.row(F.number('Estoque atual', 'stock', m.stock ?? ''), F.text('Unidade', 'unit', m.unit || 'doses', 'placeholder="comprimidos, doses, g"'), F.number('Gasta por dose', 'perDose', m.perDose || 1)) +
      F.row(F.date('Início', 'start', m.start || U.today()), F.date('Fim (opcional)', 'end', m.end || '')) + F.text('Observações', 'notes', m.notes || '', 'placeholder="Ex.: depois do café, em jejum"') + (m.id ? '<br>' + F.check('Pausado', 'paused', m.paused) : ''),
    danger: m.id ? { label: 'Excluir', fn: () => App.commit((s) => { s.meds = meds().filter((x) => x.id !== m.id); }) } : null,
    onSubmit: (d) => {
      if (!d.name) return false;
      const times = d.times.split(/[,;\s]+/).map((t) => t.trim()).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).map((t) => t.padStart(5, '0')).sort();
      if (!times.length) { App.toast('Informe horários como 08:00, 20:00', 'error'); return false; }
      const days = [0, 1, 2, 3, 4, 5, 6].filter((i) => d['d' + i]);
      const o = { name: d.name, kind: d.kind, color: d.color, dose: d.dose, times, days: days.length === 7 ? [] : days, stock: d.stock, unit: d.unit, perDose: d.perDose || 1, start: d.start, end: d.end, notes: d.notes, paused: !!d.paused };
      App.commit(() => { if (m.id) Object.assign(m, o); else meds().push({ id: U.uid(), log: {}, ...o }); });
    },
  });
  H.answer = () => { const ds = H.dosesOf(U.today()); return ds.length ? `Hoje:<ul class="as-list">${ds.map((d) => `<li>${d.taken ? '✅' : '⏳'} ${d.time} — ${U.esc(d.m.name)}${d.m.dose ? ' (' + U.esc(d.m.dose) + ')' : ''}</li>`).join('')}</ul>` : 'Nenhum remédio ou suplemento para hoje.'; };

  /* ==========================================================
     SONO & HUMOR
     ========================================================== */
  const FACES = ['', '😫', '😕', '😐', '🙂', '😄'];
  H.viewSleep = () => {
    const w = well(), today = U.today(), t = w[today] || {};
    const days = Array.from({ length: 30 }, (_, i) => U.addDays(today, i - 29));
    const logged = days.filter((d) => w[d]);
    const avg = (k, arr = logged) => { const v = arr.map((d) => w[d][k]).filter((x) => x); return v.length ? U.sum(v) / v.length : null; };
    const trained = new Set(st().workoutLogs.map((l) => l.date));
    const ins = [];
    if (logged.length >= 6) {
      const good = logged.filter((d) => w[d].sleep >= 7), bad = logged.filter((d) => w[d].sleep && w[d].sleep < 7);
      if (good.length >= 2 && bad.length >= 2) { const a = avg('mood', good), b = avg('mood', bad); if (a && b) ins.push(`😴 Dormindo 7h ou mais seu humor médio é <b>${U.fmt(a, 1)}</b> contra <b>${U.fmt(b, 1)}</b> quando dorme menos.`); }
      const tr = logged.filter((d) => trained.has(d)), nt = logged.filter((d) => !trained.has(d));
      if (tr.length >= 2 && nt.length >= 2) { const a = avg('mood', tr), b = avg('mood', nt); if (a && b) ins.push(`🏋️ Em dias de treino seu humor médio é <b>${U.fmt(a, 1)}</b>; sem treino, <b>${U.fmt(b, 1)}</b>.`); }
      const sl = avg('sleep'); if (sl && sl < 7) ins.push(`⏰ Você está dormindo em média <b>${U.fmt(sl, 1)} h</b>. O recomendado é 7–9 h.`);
    }
    const pick = (k, v) => [1, 2, 3, 4, 5].map((n) => `<button type="button" class="face ${v === n ? 'on' : ''}" data-act="slPick" data-k="${k}" data-v="${n}">${k === 'quality' ? '⭐'.repeat(n) : FACES[n]}</button>`).join('');
    return `<div class="grid g3">
      <div class="card"><header><h3>📝 Como foi hoje?</h3><small class="muted">${U.dateNice(today)}</small></header>
        <div class="field"><span>😴 Horas de sono</span><input type="number" step="0.5" min="0" max="16" value="${t.sleep ?? ''}" data-change="slSet" data-k="sleep" placeholder="Ex.: 7.5"></div>
        <div class="field mt"><span>Qualidade do sono</span><div class="faces">${pick('quality', t.quality)}</div></div>
        <div class="field mt"><span>Humor</span><div class="faces">${pick('mood', t.mood)}</div></div>
        <div class="field mt"><span>Energia</span><div class="faces">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="face ${t.energy === n ? 'on' : ''}" data-act="slPick" data-k="energy" data-v="${n}">${'⚡'.repeat(n)}</button>`).join('')}</div></div>
        <div class="field mt"><span>Anotação (opcional)</span><textarea rows="2" data-change="slSet" data-k="note" placeholder="O que marcou o dia?">${U.esc(t.note || '')}</textarea></div></div>
      <div class="card span2"><header><h3>📈 Últimos 30 dias</h3><small class="muted">${logged.length} dia(s) registrados</small></header>
        <div class="grid g4" style="gap:8px;margin-bottom:10px"><div class="metric"><div class="lbl">Sono médio</div><div class="v">${avg('sleep') ? U.fmt(avg('sleep'), 1) + ' h' : '—'}</div></div><div class="metric"><div class="lbl">Qualidade</div><div class="v">${avg('quality') ? U.fmt(avg('quality'), 1) + '/5' : '—'}</div></div><div class="metric"><div class="lbl">Humor</div><div class="v">${avg('mood') ? FACES[Math.round(avg('mood'))] + ' ' + U.fmt(avg('mood'), 1) : '—'}</div></div><div class="metric"><div class="lbl">Energia</div><div class="v">${avg('energy') ? U.fmt(avg('energy'), 1) + '/5' : '—'}</div></div></div>
        <div class="chart-box"><canvas id="sl-chart"></canvas></div>
        ${ins.length ? `<div class="mt">${ins.map((x) => `<div class="tip">${x}</div>`).join('')}</div>` : '<p class="muted mt"><small>Registre pelo menos 1 semana para eu cruzar sono, humor e treinos.</small></p>'}</div></div>`;
  };
  H.mountSleep = () => {
    const w = well(), days = Array.from({ length: 30 }, (_, i) => U.addDays(U.today(), i - 29));
    const c = document.getElementById('sl-chart'); if (!c) return;
    App.chart(c, { type: 'bar', data: { labels: days.map((d) => U.dateBR(d).slice(0, 5)), datasets: [
      { label: 'Sono (h)', data: days.map((d) => (w[d] || {}).sleep || null), backgroundColor: App.alpha('#6366f1', .55), borderRadius: 4, yAxisID: 'y' },
      { label: 'Humor', type: 'line', data: days.map((d) => (w[d] || {}).mood || null), borderColor: '#f59e0b', tension: .3, spanGaps: true, yAxisID: 'y2' },
      { label: 'Energia', type: 'line', data: days.map((d) => (w[d] || {}).energy || null), borderColor: '#22c55e', tension: .3, spanGaps: true, yAxisID: 'y2' }] },
      options: { scales: { y: { min: 0, max: 12 }, y2: { position: 'right', min: 0, max: 5, grid: { display: false } } } } });
  };
  H.sleepAnswer = () => { const w = well(), d = Object.keys(w).sort().slice(-7); if (!d.length) return 'Ainda não há registros de sono.'; const v = d.map((x) => w[x].sleep).filter(Boolean); return `Nos últimos registros você dormiu em média <b>${U.fmt(U.sum(v) / (v.length || 1), 1)} h</b> e o humor médio foi ${FACES[Math.round(U.sum(d.map((x) => w[x].mood || 3)) / d.length)]}.`; };

  H.actions = {
    mdAdd: () => medModal(), mdEdit: (t) => medModal(meds().find((m) => m.id === t.dataset.id)),
    mdTake: (t) => App.commit(() => { const m = meds().find((x) => x.id === t.dataset.id); m.log = m.log || {}; const k = t.dataset.k; if (m.log[k]) { delete m.log[k]; if (m.stock !== '' && m.stock != null) m.stock = +m.stock + (+m.perDose || 1); } else { m.log[k] = 1; if (m.stock !== '' && m.stock != null) m.stock = Math.max(0, +m.stock - (+m.perDose || 1)); } }),
    mdRefill: (t) => { const m = meds().find((x) => x.id === t.dataset.id); App.modal({ title: `Repor ${U.esc(m.name)}`, body: F.number(`Quantidade comprada (${U.esc(m.unit || 'un.')})`, 'q', ''), onSubmit: (d) => App.commit(() => { m.stock = (+m.stock || 0) + (d.q || 0); }) }); },
    slSet: (t) => { const w = well(), d = U.today(); w[d] = w[d] || {}; w[d][t.dataset.k] = t.dataset.k === 'note' ? t.value : U.num(t.value); App.save(); if (t.dataset.k !== 'note') App.rerender(); },
    slPick: (t) => App.commit(() => { const w = well(), d = U.today(); w[d] = w[d] || {}; w[d][t.dataset.k] = +t.dataset.v; }),
  };
})(window.App);
