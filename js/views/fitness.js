/* ==========================================================
   FITNESS — corpo (bioimpedância + avatar), treino, registro, evolução
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F, B = App.Body;
  const st = () => App.state;
  const prof = () => st().profile;
  const Fit = (App.Fit = {});

  const FIELDS = App.parse.BIO_FIELDS;
  const fieldInfo = Object.fromEntries(FIELDS.map(([k, l, u]) => [k, { l, u }]));
  const ZONES = [
    ['Z1', 'Z1 · Regenerativo (50–60% FCmáx) — conversa fácil'], ['Z2', 'Z2 · Leve/aeróbico (60–70%) — base'], ['Z3', 'Z3 · Moderado (70–80%) — ritmo confortável'],
    ['Z4', 'Z4 · Forte/limiar (80–90%) — difícil falar'], ['Z5', 'Z5 · Máximo (90–100%) — tiros curtos'],
  ];
  const RUN_KINDS = ['Contínua leve', 'Intervalado', 'Tiros', 'Fartlek', 'Longão', 'Regenerativo', 'Progressivo', 'Subida', 'Caminhada', 'Esteira', 'Prova/teste'];

  Fit.entries = () => st().body.slice().sort((a, b) => a.date.localeCompare(b.date));
  Fit.last = () => { const e = Fit.entries(); return e[e.length - 1]; };
  Fit.bmi = (w) => { const h = (prof().height || 0) / 100; return h && w ? w / (h * h) : null; };
  Fit.enrich = (e) => {
    if (!e) return e;
    const o = { ...e };
    if (o.weight) o.bmi = Fit.bmi(o.weight);
    if (o.weight && o.fat && !o.fatMass) o.fatMass = (o.weight * o.fat) / 100;
    if (o.weight && o.fatMass && !o.fat) o.fat = (o.fatMass / o.weight) * 100;
    if (o.weight && o.fatMass && !o.lean) o.lean = o.weight - o.fatMass;
    if (o.weight && !o.fat && o.bmi) { o.fat = B.estimateFat(o.bmi, U.age(prof().birth) || 30, prof().sex); o.fatEstimated = true; }
    return o;
  };
  Fit.pace = (dist, dur) => { if (!dist || !dur) return ''; const p = dur / dist; const m = Math.floor(p), s = Math.round((p - m) * 60); return `${m}:${String(s).padStart(2, '0')}/km`; };
  Fit.dayPlan = (d = new Date().getDay()) => st().plan.find((p) => +p.day === +d) || { day: d, name: '', items: [] };
  Fit.weekLogs = () => { const ws = U.weekStart(U.today()); return st().workoutLogs.filter((l) => l.date >= ws); };
  Fit.streakWeeks = () => { let n = 0, ws = U.weekStart(U.today()); const has = (w) => st().workoutLogs.some((l) => l.date >= w && l.date <= U.addDays(w, 6)); if (!has(ws)) ws = U.addDays(ws, -7); while (has(ws)) { n++; ws = U.addDays(ws, -7); } return n; };

  /* ---------- estado da tela ---------- */
  const S = { idx: null, ghost: true, day: new Date().getDay(), metric: 'weight', ex: '', logDate: U.today() };
  let avatar = null, playing = 0, lastParams = null;

  const fmtV = (k, v) => (v === undefined || v === null || v === '' || isNaN(v) ? '—' : `${U.fmt(v, k === 'visceral' || k === 'bmr' || k === 'metaAge' ? 0 : 1)}${fieldInfo[k] && fieldInfo[k].u !== 'nível' ? ' ' + fieldInfo[k].u : ''}`);
  const deltaHTML = (k, cur, prev, goodDown) => {
    if (cur == null || prev == null || isNaN(cur) || isNaN(prev)) return '';
    const d = cur - prev; if (Math.abs(d) < 0.05) return '<span class="d muted">= estável</span>';
    const good = goodDown ? d < 0 : d > 0;
    return `<span class="d ${good ? 'delta good' : 'delta badd'}">${d > 0 ? '▲' : '▼'} ${U.fmt(Math.abs(d), 1)}</span>`;
  };
  const GOOD_DOWN = { weight: true, fat: true, fatMass: true, visceral: true, metaAge: true, bmi: true, waist: true, subcut: true };

  /* ---------- CORPO ---------- */
  const viewCorpo = () => {
    const ents = Fit.entries().map(Fit.enrich);
    const p = prof();
    if (S.idx === null || S.idx >= ents.length) S.idx = ents.length - 1;
    const e = ents[S.idx], prev = ents[S.idx - 1], first = ents[0];
    const noProfile = !p.height || !p.birth;
    const metrics = ['weight', 'fat', 'muscle', 'fatMass', 'water', 'visceral', 'bmr', 'metaAge', 'lean', 'bone'];
    return `${noProfile ? `<div class="note warn">👤 Preencha <b>altura, sexo e data de nascimento</b> no <a href="#/fitness/perfil">Perfil</a> — o avatar e os cálculos dependem disso.</div>` : ''}
    <div class="grid">
      <div class="card"><header><h3>🧍 Seu corpo ${e ? `<small class="muted">· ${U.dateBR(e.date)}${e.source ? ' · ' + U.esc(e.source) : ''}</small>` : ''}</h3>
        <div class="row">${ents.length > 1 ? `${F.check('comparar com o 1º registro', 'ghost', S.ghost).replace('name="ghost"', 'data-change="ghost"')}<button class="btn sm" data-act="play">${playing ? '⏹' : '▶'} Animar evolução</button>` : ''}</div></header>
        <div class="avatar-wrap">
          <div><div class="avatar-host" id="avatar-host"></div>
            ${ents.length > 1 ? `<div class="timeline"><small>${U.dateBR(first.date).slice(0, 5)}</small><input type="range" min="0" max="${ents.length - 1}" value="${S.idx}" data-input="scrub" data-change="scrubDone"><small>${U.dateBR(ents[ents.length - 1].date).slice(0, 5)}</small></div>` : ''}
            <div class="avatar-tools">
              <div class="seg">${[['both', 'Frente + lado'], ['front', 'Frente'], ['side', 'Lado']].map(([v, l]) => `<button class="${(av().avatarView || 'both') === v ? 'on' : ''}" data-act="avView" data-v="${v}">${l}</button>`).join('')}</div>
              <div class="seg">${[['holo', '🔮 Holograma'], ['skin', '🧑 Pele']].map(([v, l]) => `<button class="${(v === 'holo') === ((av().avatarSkin || 'holo') === 'holo') ? 'on' : ''}" data-act="avSkin" data-v="${v}">${l}</button>`).join('')}</div>
              <div class="seg"><button class="${av().avatarHeat !== false ? 'on' : ''}" data-act="avToggle" data-k="avatarHeat">🔥 Gordura</button><button class="${av().avatarMuscles !== false ? 'on' : ''}" data-act="avToggle" data-k="avatarMuscles">💪 Músculos</button></div>
            </div>
            ${e && av().avatarHeat !== false ? `<div class="heat-legend"></div><div class="row between"><small>pouca gordura</small><small>acúmulo de gordura</small></div>
            <div class="zone-list">${(() => { const pz = B.params(e, p).zones; return ['belly', 'chest', 'flank', 'thigh', 'arm', 'face'].map((k) => `<div><span class="dot" style="background:${B.heat(pz[k])}"></span>${B.ZONE_NAMES[k]}<b>${B.level(pz[k])}</b></div>`).join(''); })()}</div>` : ''}
          </div>
          <div>${e ? `
            <div class="row" style="margin-bottom:10px">${e.fat ? (() => { const c = B.fatClass(e.fat, p.sex); return `<span class="chip" style="color:${c.color}">● Gordura: ${c.label}</span>`; })() : ''}
              ${e.bmi ? (() => { const c = B.bmiClass(e.bmi); return `<span class="chip" style="color:${c.color}">● IMC ${U.fmt(e.bmi, 1)} · ${c.label}</span>`; })() : ''}
              ${e.visceral ? (() => { const c = B.visceralClass(e.visceral); return `<span class="chip" style="color:${c.color}">● Visceral ${c.label}</span>`; })() : ''}
              ${e.water ? (() => { const c = B.waterClass(e.water, p.sex); return `<span class="chip" style="color:${c.color}">● Água ${c.label}</span>`; })() : ''}</div>
            <div class="metric-grid">${metrics.filter((k) => e[k] != null).map((k) => `<div class="metric"><div class="lbl">${fieldInfo[k].l}${k === 'fat' && e.fatEstimated ? ' (estimado)' : ''}</div><div class="v">${fmtV(k, e[k])}</div>${deltaHTML(k, e[k], prev && prev[k], GOOD_DOWN[k])}${first !== e && first[k] != null ? `<div class="d muted">desde o início: ${(e[k] - first[k] > 0 ? '+' : '') + U.fmt(e[k] - first[k], 1)}</div>` : ''}</div>`).join('')}</div>
            ${p.goalWeight && e.weight ? `<div class="mt"><div class="row between"><small>Meta de peso ${U.fmt(p.goalWeight, 1)} kg</small><small>${U.fmt(Math.abs(e.weight - p.goalWeight), 1)} kg ${e.weight > p.goalWeight ? 'para perder' : 'para ganhar'}</small></div><div class="bar"><i style="width:${first && first.weight !== p.goalWeight ? U.clamp(((first.weight - e.weight) / (first.weight - p.goalWeight)) * 100, 0, 100) : 100}%"></i></div></div>` : ''}
            ${p.goalFat && e.fat ? `<div class="mt"><div class="row between"><small>Meta de gordura ${U.fmt(p.goalFat, 1)}%</small><small>${e.fat > p.goalFat ? U.fmt(e.fat - p.goalFat, 1) + ' p.p. a reduzir' : 'meta atingida 🏆'}</small></div><div class="bar"><i style="width:${first && first.fat !== p.goalFat ? U.clamp(((first.fat - e.fat) / (first.fat - p.goalFat)) * 100, 0, 100) : 100}%"></i></div></div>` : ''}
          ` : App.empty('📏', 'Nenhuma medição ainda', 'Suba os arquivos da sua balança e do relógio, ou lance os dados manualmente.')}</div>
        </div>
      </div>
      <div class="grid g2">
        <div class="card"><header><h3>⬆ Atualizar medidas</h3></header>
          <div class="note">Suba os relatórios da <b>balança de bioimpedância</b> e do <b>relógio Samsung</b> (PDF, foto/print, CSV do Samsung Health ou Excel). Se enviar dois, eu mesclo os valores.</div>
          <label class="drop"><input type="file" multiple accept=".pdf,.csv,.xlsx,.xls,.txt,image/*" data-change="bioFiles"><b>📎 Escolher arquivos</b>até 2 ou mais de uma vez</label>
          <button class="btn block mt" data-act="bioManual">✍️ Lançar manualmente</button>
        </div>
        ${e ? `<div class="card"><header><h3>🔥 Gasto calórico</h3><a href="#/fitness/perfil" class="btn sm ghost">detalhes</a></header>${calorieMini(e)}</div>` : ''}
      </div>
    </div>`;
  };
  const calorieMini = (e) => {
    const c = Fit.calories(e); if (!c) return '<p class="muted">Complete o perfil.</p>';
    return `<div class="list"><div class="li"><div class="grow">Metabolismo basal</div><b>${Math.round(c.bmr)} kcal</b></div><div class="li"><div class="grow">Gasto diário (TDEE)</div><b>${Math.round(c.tdee)} kcal</b></div><div class="li"><div class="grow">Para secar (−20%)</div><b>${Math.round(c.tdee * 0.8)} kcal</b></div><div class="li"><div class="grow">Proteína (1,8 g/kg)</div><b>${Math.round(e.weight * 1.8)} g</b></div><div class="li"><div class="grow">Água / dia</div><b>${U.fmt((e.weight * 35) / 1000, 1)} L</b></div></div>`;
  };
  Fit.calories = (e) => {
    const p = prof(); const age = U.age(p.birth); if (!e || !e.weight || !p.height || !age) return null;
    const mifflin = 10 * e.weight + 6.25 * p.height - 5 * age + (p.sex === 'F' ? -161 : 5);
    const lean = e.lean || (e.fat ? e.weight * (1 - e.fat / 100) : null);
    const katch = lean ? 370 + 21.6 * lean : null;
    const bmr = e.bmr || katch || mifflin;
    return { bmr, mifflin, katch, tdee: bmr * (p.activity || 1.55) };
  };
  const mountCorpo = (el) => {
    const host = el.querySelector('#avatar-host'); if (!host) return;
    const a = av();
    host.dataset.view = a.avatarView || 'both';
    avatar = B.create(host, { view: a.avatarView || 'both', heat: a.avatarHeat !== false, muscles: a.avatarMuscles !== false });
    const ents = Fit.entries().map(Fit.enrich);
    const p = prof();
    const e = ents[S.idx] || { weight: 0 };
    const startP = lastParams || B.params(ents.length ? ents[0] : e, p);
    avatar.to(startP, null, 0);
    const ghost = S.ghost && ents.length > 1 ? B.params(ents[0], p) : null;
    lastParams = B.params(e, p);
    setTimeout(() => avatar && avatar.to(lastParams, ghost), 120);
  };
  const av = () => st().settings;
  const scrubTo = (i) => {
    S.idx = i; const ents = Fit.entries().map(Fit.enrich);
    lastParams = B.params(ents[i], prof());
    if (avatar) avatar.to(lastParams, S.ghost && ents.length > 1 ? B.params(ents[0], prof()) : null, 700);
  };

  /* ---------- upload de bioimpedância ---------- */
  async function bioFiles(input) {
    const files = [...input.files]; if (!files.length) return;
    App.toast('Lendo arquivo(s)… imagens podem levar ~30s na primeira vez.');
    const parsed = [];
    for (const f of files) {
      try { const r = await App.parse.bio(f); parsed.push({ file: f, ...r }); }
      catch (e) { console.error(e); App.toast(`Não consegui ler ${f.name}: ${e.message}`, 'error'); }
    }
    input.value = '';
    if (!parsed.length) return;
    // CSV com histórico (ex.: Samsung Health) → importar várias datas
    const hist = parsed.find((p) => p.history && p.history.length > 1);
    if (hist) return historyImport(hist);
    bioModal({}, parsed);
  }
  function historyImport(p) {
    const known = new Set(st().body.map((b) => b.date));
    const rows = p.history.filter((r) => r.date);
    App.modal({
      title: `Importar histórico (${rows.length} medições)`, wide: true, submitLabel: 'Importar novas',
      body: `<div class="note">Encontrei um histórico em <b>${U.esc(p.file.name)}</b>. Datas já existentes serão ignoradas.</div><div class="table-wrap" style="max-height:50vh"><table><thead><tr><th>Data</th>${['weight', 'fat', 'muscle', 'water', 'bmr'].map((k) => `<th class="r">${fieldInfo[k].l}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr style="${known.has(r.date) ? 'opacity:.4' : ''}"><td>${U.dateBR(r.date)}</td>${['weight', 'fat', 'muscle', 'water', 'bmr'].map((k) => `<td class="r">${fmtV(k, r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
      onSubmit: () => { const add = rows.filter((r) => !known.has(r.date)); App.commit((s) => add.forEach((r) => s.body.push({ id: U.uid(), source: 'Samsung Health', ...r }))); S.idx = null; App.toast(`${add.length} medições importadas`); },
    });
  }
  const bioModal = (entry = {}, parsed = []) => {
    const isNew = !entry.id;
    const merged = { ...entry };
    if (parsed.length) for (const [k] of FIELDS) { const vals = parsed.map((p) => p.values[k]).filter((v) => v != null); if (vals.length) merged[k] = U.round(U.sum(vals) / vals.length, 1); }
    const dateGuess = entry.date || parsed.map((p) => p.values.date).find(Boolean) || U.today();
    const cols = parsed.length ? `<th>Campo</th>${parsed.map((p) => `<th class="r" title="${U.esc(p.file.name)}">${U.esc(p.file.name.slice(0, 18))}</th>`).join('')}<th>Valor final</th>` : '<th>Campo</th><th>Valor</th>';
    App.modal({
      title: isNew ? (parsed.length ? 'Conferir medições lidas' : 'Nova medição') : 'Editar medição', wide: parsed.length > 0,
      body: (parsed.length ? `<div class="note">✨ Li ${parsed.map((p) => `<b>${Object.keys(p.values).filter((k) => k !== 'date').length}</b> valores em “${U.esc(p.file.name)}”`).join(' e ')}. ${parsed.length > 1 ? 'Quando os dois arquivos trazem o mesmo dado, usei a <b>média</b>. ' : ''}Confira e corrija se precisar.</div>` : '') +
        F.row(F.date('Data da medição', 'date', dateGuess), F.text('Origem', 'source', entry.source || (parsed.length > 1 ? 'Balança + relógio' : parsed.length ? 'Arquivo' : 'Manual'), 'list="src-list"')) +
        '<datalist id="src-list"><option value="Balança"><option value="Relógio Samsung"><option value="Balança + relógio"><option value="Manual"><option value="Nutricionista"></datalist>' +
        `<div class="table-wrap"><table><thead><tr>${cols}</tr></thead><tbody>${FIELDS.map(([k, l, u]) => `<tr><td>${l} <small>(${u})</small></td>${parsed.map((p) => `<td class="r">${p.values[k] != null ? `<a href="#" data-mact="use" data-k="${k}" data-v="${U.round(p.values[k], 2)}" title="${U.esc((p.evidence || {})[k] || 'usar este')}">${U.fmt(p.values[k], 1)}</a>` : '<small>—</small>'}</td>`).join('')}<td style="width:140px">${F.input(k, merged[k] ?? '', 'type="number" step="any" inputmode="decimal"')}</td></tr>`).join('')}</tbody></table></div>` +
        F.area('Notas', 'notes', entry.notes || '') +
        (parsed.some((p) => p.text) ? `<details class="mt"><summary>📄 Texto lido dos arquivos</summary><pre style="white-space:pre-wrap;font-size:.75rem;max-height:200px;overflow:auto">${U.esc(parsed.map((p) => p.text).join('\n---\n').slice(0, 6000))}</pre></details>` : ''),
      actions: { use: (a, form, _, ev) => { ev.preventDefault(); form[a.dataset.k].value = a.dataset.v; } },
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.body = s.body.filter((b) => b.id !== entry.id); S.idx = null; }) },
      onSubmit: async (d) => {
        const o = { date: d.date, source: d.source, notes: d.notes };
        for (const [k] of FIELDS) if (d[k] !== '' && d[k] != null) o[k] = d[k];
        if (!o.weight && !o.fat && !o.muscle) { App.toast('Informe ao menos peso, gordura ou massa muscular.', 'error'); return false; }
        const fileIds = [];
        for (const p of parsed) { try { fileIds.push(await App.files.put(p.file)); } catch (e) { /* */ } }
        App.commit((s) => { if (isNew) s.body.push({ id: U.uid(), ...o, files: fileIds }); else Object.assign(s.body.find((b) => b.id === entry.id), o); S.idx = null; });
        App.toast('Medição salva — veja o avatar se transformar ✨');
      },
    });
  };

  /* ---------- EVOLUÇÃO ---------- */
  const viewEvolucao = () => {
    const ents = Fit.entries().map(Fit.enrich);
    const opts = [['weight', 'Peso'], ['fat', '% Gordura'], ['muscle', 'Massa muscular'], ['fatMass', 'Massa de gordura'], ['water', 'Água'], ['visceral', 'Visceral'], ['bmr', 'TMB'], ['bmi', 'IMC'], ['waist', 'Cintura']];
    return `<div class="card"><header><h3>📉 Evolução corporal</h3><div class="seg">${opts.map(([k, l]) => `<button class="${S.metric === k ? 'on' : ''}" data-act="metric" data-m="${k}">${l}</button>`).join('')}</div></header>
      ${ents.length ? '<div class="chart-box lg"><canvas id="evo-chart"></canvas></div>' : App.empty('📉', 'Sem dados', 'Registre medições para ver o gráfico.')}</div>
    <div class="grid g2 mt"><div class="card"><header><h3>⚖️ Peso × gordura × músculo</h3></header><div class="chart-box"><canvas id="evo-combo"></canvas></div></div>
      <div class="card"><header><h3>🏋️ Treinos por semana</h3></header><div class="chart-box"><canvas id="evo-freq"></canvas></div></div></div>
    <div class="card mt"><header><h3>🗂️ Histórico de medições</h3><button class="btn" data-act="bioManual">＋ Medição</button></header>
      ${ents.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Origem</th>${['weight', 'fat', 'muscle', 'fatMass', 'water', 'visceral', 'bmr'].map((k) => `<th class="r">${fieldInfo[k].l.split(' ')[0]} ${k === 'muscle' ? 'musc.' : k === 'fatMass' ? 'gord.' : ''}</th>`).join('')}<th class="r">IMC</th><th></th></tr></thead><tbody>
      ${ents.slice().reverse().map((e) => `<tr><td>${U.dateBR(e.date)}</td><td><small>${U.esc(e.source || '')}</small></td>${['weight', 'fat', 'muscle', 'fatMass', 'water', 'visceral', 'bmr'].map((k) => `<td class="r">${fmtV(k, e[k])}${k === 'fat' && e.fatEstimated ? '*' : ''}</td>`).join('')}<td class="r">${e.bmi ? U.fmt(e.bmi, 1) : '—'}</td>
        <td class="actions">${(e.files || []).map((f) => `<button class="icon-btn" data-act="openFile" data-id="${f}">📄</button>`).join('')}<button class="icon-btn" data-act="bioEdit" data-id="${e.id}">✏️</button></td></tr>`).join('')}</tbody></table></div><small class="muted">* estimado pelo IMC (fórmula de Deurenberg)</small>` : '<p class="muted">—</p>'}</div>`;
  };
  const mountEvolucao = () => {
    const ents = Fit.entries().map(Fit.enrich);
    const acc = App.cssVar('--accent');
    if (ents.length) {
      const k = S.metric, data = ents.map((e) => (e[k] != null ? U.round(e[k], 2) : null));
      const ds = [{ label: (fieldInfo[k] || { l: 'IMC' }).l, data, borderColor: acc, backgroundColor: App.alpha(acc, .15), fill: true, tension: .35, spanGaps: true, pointRadius: 4 }];
      const goal = k === 'weight' ? prof().goalWeight : k === 'fat' ? prof().goalFat : 0;
      if (goal) ds.push({ label: 'Meta', data: ents.map(() => goal), borderColor: '#22c55e', borderDash: [6, 6], pointRadius: 0 });
      App.chart(document.getElementById('evo-chart'), { type: 'line', data: { labels: ents.map((e) => U.dateBR(e.date)), datasets: ds } });
      App.chart(document.getElementById('evo-combo'), { type: 'line', data: { labels: ents.map((e) => U.dateBR(e.date).slice(0, 5)), datasets: [
        { label: 'Peso (kg)', data: ents.map((e) => e.weight || null), borderColor: acc, tension: .3, yAxisID: 'y', spanGaps: true },
        { label: 'Músculo (kg)', data: ents.map((e) => e.muscle || null), borderColor: '#22c55e', tension: .3, yAxisID: 'y', spanGaps: true },
        { label: 'Gordura (%)', data: ents.map((e) => (e.fat ? U.round(e.fat, 1) : null)), borderColor: '#f97316', tension: .3, yAxisID: 'y2', spanGaps: true }] },
        options: { scales: { y: { position: 'left' }, y2: { position: 'right', grid: { display: false } } } } });
    }
    const weeks = Array.from({ length: 12 }, (_, i) => U.addDays(U.weekStart(U.today()), (i - 11) * 7));
    App.chart(document.getElementById('evo-freq'), { type: 'bar', data: { labels: weeks.map((w) => U.dateBR(w).slice(0, 5)), datasets: [{ label: 'Treinos', data: weeks.map((w) => st().workoutLogs.filter((l) => l.date >= w && l.date <= U.addDays(w, 6)).length), backgroundColor: acc, borderRadius: 6 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { stepSize: 1 } } } } });
  };

  /* ---------- PLANO DE TREINO ---------- */
  const exMeta = (it) => it.type === 'run'
    ? [it.runKind, it.distance ? `${it.distance} km` : '', it.duration ? `${it.duration} min` : '', it.pace ? `pace ${it.pace}` : (it.distance && it.duration ? Fit.pace(it.distance, it.duration) : ''), it.reps ? it.reps : ''].filter(Boolean)
    : it.type === 'strength' ? [it.sets ? `${it.sets} séries` : '', it.reps ? `${it.reps} reps` : '', it.load ? `${it.load} kg` : '', it.rest ? `desc. ${it.rest}` : ''].filter(Boolean)
      : [it.duration ? `${it.duration} min` : '', it.reps || ''].filter(Boolean);
  const exItem = (it, i, n, editable = true) => `<div class="ex"><div class="ico">${it.type === 'run' ? '🏃' : it.type === 'strength' ? '🏋️' : '🧘'}</div>
    <div class="grow"><div class="t">${U.esc(it.name)}</div><div class="meta">${exMeta(it).map((m) => `<span class="chip">${U.esc(m)}</span>`).join('')}${it.intensity ? `<span class="chip" style="color:#fff" ><span class="dot zone-${it.intensity.slice(1)}"></span> ${U.esc(it.intensity)}</span>` : ''}</div>${it.notes ? `<div class="s" style="margin-top:4px">${U.esc(it.notes)}</div>` : ''}</div>
    ${editable ? `<button class="icon-btn" data-act="exUp" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="icon-btn" data-act="exDown" data-i="${i}" ${i === n - 1 ? 'disabled' : ''}>↓</button><button class="icon-btn" data-act="exEdit" data-i="${i}">✏️</button>` : ''}</div>`;

  const viewTreino = () => {
    const td = new Date().getDay();
    const dp = Fit.dayPlan(S.day);
    const total = st().plan.reduce((a, p) => a + p.items.length, 0);
    return `<div class="card"><header><h3>🗓️ Meu plano semanal</h3><div class="row">
        <label class="btn btn-file">📥 Importar planilha<input type="file" accept=".xlsx,.xls,.csv" data-change="importPlan"></label>
        <button class="btn" data-act="templates">✨ Modelos</button></div></header>
      <div class="daytabs">${[1, 2, 3, 4, 5, 6, 0].map((d) => { const p = Fit.dayPlan(d); return `<button class="${S.day === d ? 'on' : ''} ${d === td ? 'today' : ''}" data-act="day" data-d="${d}">${U.DAY3[d]}<small>${p.items.length ? U.esc(p.name || p.items.length + ' itens') : 'descanso'}</small></button>`; }).join('')}</div>
      <div class="frow"><label class="field"><span>Nome do treino de ${U.DAYS[S.day].toLowerCase()}</span><input value="${U.esc(dp.name)}" placeholder="Ex.: Treino A — Peito e tríceps / Corrida intervalada" data-change="dayName"></label></div>
      ${dp.items.length ? dp.items.map((it, i) => exItem(it, i, dp.items.length)).join('') : App.empty('😴', 'Dia de descanso', 'Adicione exercícios de musculação, corrida ou mobilidade.')}
      <div class="row mt"><button class="btn primary" data-act="exAdd" data-type="strength">＋ Musculação</button><button class="btn primary" data-act="exAdd" data-type="run">＋ Corrida</button><button class="btn" data-act="exAdd" data-type="other">＋ Outro (mobilidade, cardio…)</button>
        <span style="flex:1"></span>${dp.items.length ? `<button class="btn ghost" data-act="copyDay">⧉ Copiar para…</button><button class="btn ghost danger" data-act="clearDay">Limpar dia</button>` : ''}</div>
    </div>
    ${total === 0 ? '<div class="note mt">💡 Já tem uma planilha de treino? Use “Importar planilha” — colunas aceitas: <b>Dia, Exercício, Séries, Repetições, Carga, Descanso, Tipo, Distância, Duração, Pace, Intensidade, Obs</b>.</div>' : ''}`;
  };
  const exModal = (type, i) => {
    const dp = Fit.dayPlan(S.day);
    const it = i !== undefined ? dp.items[i] : { type };
    const t = it.type;
    const isNew = i === undefined;
    const body = t === 'run'
      ? F.row(F.text('Nome', 'name', it.name || 'Corrida', 'required'), F.select('Tipo de corrida', 'runKind', RUN_KINDS, it.runKind || 'Contínua leve')) +
        F.row(F.number('Distância (km)', 'distance', it.distance), F.number('Duração (min)', 'duration', it.duration), F.text('Pace alvo (min/km)', 'pace', it.pace || '', 'placeholder="6:00"')) +
        F.row(F.select('Intensidade', 'intensity', ZONES, it.intensity || 'Z2'), F.text('Séries/intervalos', 'reps', it.reps || '', 'placeholder="Ex.: 6×400m c/ 1min trote"')) +
        F.area('Aquecimento, desaquecimento e observações', 'notes', it.notes || '', 'placeholder="Ex.: 10min trote leve + educativos; 5min caminhada no final"')
      : t === 'strength'
        ? F.row(F.text('Exercício', 'name', it.name || '', 'required placeholder="Ex.: Supino reto" list="ex-list"')) + `<datalist id="ex-list">${[...new Set(st().plan.flatMap((p) => p.items.map((x) => x.name)))].map((n) => `<option value="${U.esc(n)}">`).join('')}</datalist>` +
          F.row(F.number('Séries', 'sets', it.sets), F.text('Repetições', 'reps', it.reps || '', 'placeholder="10-12"'), F.number('Carga (kg)', 'load', it.load), F.text('Descanso', 'rest', it.rest || '', 'placeholder="60s"')) +
          F.row(F.select('Intensidade (opcional)', 'intensity', [['', '—'], ...ZONES], it.intensity || '')) + F.area('Método / observações', 'notes', it.notes || '', 'placeholder="Ex.: drop-set na última série, cadência 3-1-1"')
        : F.row(F.text('Atividade', 'name', it.name || '', 'required placeholder="Ex.: Alongamento, bike, abdominal"'), F.number('Duração (min)', 'duration', it.duration), F.text('Detalhes', 'reps', it.reps || '')) + F.area('Observações', 'notes', it.notes || '');
    App.modal({
      title: (isNew ? 'Adicionar ' : 'Editar ') + (t === 'run' ? 'corrida' : t === 'strength' ? 'exercício' : 'atividade') + ` · ${U.DAYS[S.day]}`, body,
      danger: isNew ? null : { label: 'Remover', fn: () => App.commit(() => dp.items.splice(i, 1)) },
      onSubmit: (d) => {
        if (!d.name) return false;
        App.commit((s) => {
          let p = s.plan.find((x) => +x.day === S.day); if (!p) { p = { day: S.day, name: '', items: [] }; s.plan.push(p); }
          if (isNew) p.items.push({ id: U.uid(), type: t, ...d }); else Object.assign(p.items[i], d);
        });
      },
    });
  };
  const TEMPLATES = {
    abc: { name: 'ABC musculação (seg–sex) + corrida', days: {
      1: ['Treino A — Peito/Ombro/Tríceps', [['strength', 'Supino reto', 4, '8-10'], ['strength', 'Supino inclinado halteres', 3, '10-12'], ['strength', 'Desenvolvimento', 3, '10'], ['strength', 'Elevação lateral', 3, '12-15'], ['strength', 'Tríceps corda', 3, '12']]],
      2: ['Corrida leve', [['run', 'Corrida contínua', 0, '', { runKind: 'Contínua leve', distance: 5, duration: 35, intensity: 'Z2' }]]],
      3: ['Treino B — Costas/Bíceps', [['strength', 'Puxada frente', 4, '8-10'], ['strength', 'Remada curvada', 3, '10'], ['strength', 'Remada unilateral', 3, '10'], ['strength', 'Rosca direta', 3, '10-12'], ['strength', 'Rosca martelo', 3, '12']]],
      4: ['Corrida intervalada', [['run', 'Intervalado', 0, '6×400m c/ 1min trote', { runKind: 'Intervalado', distance: 5, duration: 35, intensity: 'Z4', notes: '10min aquecimento + educativos; 5min desaquecimento' }]]],
      5: ['Treino C — Pernas/Abdômen', [['strength', 'Agachamento livre', 4, '8-10'], ['strength', 'Leg press', 3, '12'], ['strength', 'Cadeira extensora', 3, '12-15'], ['strength', 'Mesa flexora', 3, '12'], ['strength', 'Panturrilha em pé', 4, '15'], ['other', 'Prancha', 0, '3×45s']]],
      6: ['Longão', [['run', 'Longão', 0, '', { runKind: 'Longão', distance: 8, duration: 55, intensity: 'Z2' }]]],
    } },
    taf: { name: 'Preparação TAF (corrida + barra + flexão + abdominal)', days: {
      1: ['Força + barra', [['strength', 'Barra fixa (pegada pronada)', 5, 'máx'], ['strength', 'Flexão de braço', 4, 'máx'], ['strength', 'Remada curvada', 3, '10'], ['other', 'Abdominal remador', 0, '4×1min']]],
      2: ['Corrida intervalada', [['run', 'Tiros', 0, '8×400m c/ 1min30 trote', { runKind: 'Tiros', distance: 6, duration: 40, intensity: 'Z4' }]]],
      3: ['Pernas + core', [['strength', 'Agachamento', 4, '10'], ['strength', 'Afundo', 3, '12'], ['other', 'Prancha', 0, '4×1min'], ['other', 'Abdominal supra', 0, '4×30']]],
      4: ['Corrida contínua', [['run', 'Contínua', 0, '', { runKind: 'Contínua leve', distance: 6, duration: 40, intensity: 'Z2' }]]],
      5: ['Simulado TAF', [['run', 'Teste de 12 minutos (Cooper)', 0, '', { runKind: 'Prova/teste', duration: 12, intensity: 'Z5' }], ['strength', 'Barra (teste)', 1, 'máx'], ['strength', 'Flexão (1 min)', 1, 'máx'], ['other', 'Abdominal (1 min)', 0, 'máx']]],
      6: ['Longão', [['run', 'Longão', 0, '', { runKind: 'Longão', distance: 10, duration: 65, intensity: 'Z2' }]]],
    } },
    run5k: { name: 'Corrida 5 km (iniciante, 3x/semana)', days: {
      2: ['Corrida/caminhada', [['run', 'Trote + caminhada', 0, '8×(2min trote + 1min caminhada)', { runKind: 'Intervalado', duration: 30, intensity: 'Z2' }]]],
      4: ['Corrida leve', [['run', 'Contínua leve', 0, '', { runKind: 'Contínua leve', distance: 3, duration: 25, intensity: 'Z2' }]]],
      6: ['Longão leve', [['run', 'Longão', 0, '', { runKind: 'Longão', distance: 4, duration: 32, intensity: 'Z2' }]]],
    } },
  };

  /* ---------- REGISTRO (treino de hoje) ---------- */
  const viewRegistro = () => {
    const d = U.parseISO(S.logDate).getDay();
    const dp = Fit.dayPlan(d);
    const done = st().workoutLogs.find((l) => l.date === S.logDate);
    const logs = st().workoutLogs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
    const last = (name) => { const l = st().workoutLogs.filter((x) => x.date < S.logDate).sort((a, b) => b.date.localeCompare(a.date)).find((x) => x.items.some((i) => i.name === name && i.done)); return l && l.items.find((i) => i.name === name); };
    return `<div class="grid g4">
      <div class="card accent stat"><div class="lbl">Treinos na semana</div><div class="val">${Fit.weekLogs().length}</div><div class="sub">planejados: ${st().plan.filter((p) => p.items.length).length}</div></div>
      <div class="card stat"><div class="lbl">Sequência</div><div class="val">🔥 ${Fit.streakWeeks()} sem.</div><div class="sub">semanas seguidas treinando</div></div>
      <div class="card stat"><div class="lbl">Total registrados</div><div class="val">${st().workoutLogs.length}</div><div class="sub">treinos</div></div>
      <div class="card stat"><div class="lbl">Km corridos (mês)</div><div class="val">${U.fmt(U.sum(st().workoutLogs.filter((l) => l.date.startsWith(U.ym())).flatMap((l) => l.items), (i) => (i.type === 'run' && i.done ? i.distance : 0)), 1)}</div><div class="sub">km</div></div>
    </div>
    <div class="grid g3 mt">
      <div class="card span2"><header><h3>✅ ${S.logDate === U.today() ? 'Treino de hoje' : 'Treino de ' + U.dateNice(S.logDate)} ${dp.name ? `<small class="muted">· ${U.esc(dp.name)}</small>` : ''}</h3><input type="date" value="${S.logDate}" data-change="logDate" style="width:auto"></header>
        ${done ? '<div class="note">Você já registrou este dia — salvar de novo substitui o registro.</div>' : ''}
        <form data-submit="saveLog">
        ${dp.items.length ? dp.items.map((it, i) => { const prev = done ? done.items[i] : null; const lp = last(it.name); const v = prev || it; return `<div class="ex">
          <input type="checkbox" name="done${i}" ${prev ? (prev.done ? 'checked' : '') : 'checked'}>
          <div class="grow"><div class="t">${it.type === 'run' ? '🏃' : it.type === 'strength' ? '🏋️' : '🧘'} ${U.esc(it.name)}</div>
            <div class="meta">${exMeta(it).map((m) => `<span class="chip">${U.esc(m)}</span>`).join('')}${lp && lp.load ? `<span class="chip info">última vez: ${lp.load} kg</span>` : ''}</div>
            <div class="inline-form" style="margin-top:8px">${it.type === 'strength'
              ? F.number('Séries', 'sets' + i, v.sets) + F.text('Reps feitas', 'reps' + i, v.reps || '') + F.number('Carga (kg)', 'load' + i, v.load)
              : it.type === 'run' ? F.number('Distância (km)', 'distance' + i, v.distance) + F.number('Tempo (min)', 'duration' + i, v.duration) + F.text('FC média', 'hr' + i, v.hr || '')
                : F.number('Tempo (min)', 'duration' + i, v.duration)}</div></div></div>`; }).join('') : App.empty('😴', 'Sem treino planejado para este dia', 'Monte o plano na aba “Plano de treino” ou registre um treino livre abaixo.')}
        <div class="frow mt">${F.number('Duração total (min)', 'totalMin', done ? done.totalMin : '')}${F.select('Como foi?', 'feel', [['', '—'], ['😫', '😫 Muito difícil'], ['😮‍💨', '😮‍💨 Pesado'], ['🙂', '🙂 Bom'], ['💪', '💪 Ótimo'], ['🔥', '🔥 Excelente']], done ? done.feel : '')}${F.number('Esforço (RPE 1–10)', 'rpe', done ? done.rpe : '', 'min="1" max="10"')}</div>
        ${F.area('Notas do treino', 'notes', done ? done.notes : '', 'placeholder="Como se sentiu, dores, recordes…"')}
        <div class="row mt"><button class="btn primary">💾 Salvar treino</button>${done ? '<button type="button" class="btn ghost danger" data-act="delLog">Excluir registro</button>' : ''}</div>
        </form>
      </div>
      <div class="card"><header><h3>🕘 Últimos treinos</h3></header>${logs.length ? `<div class="list">${logs.map((l) => `<div class="li" data-act="logDateSet" data-d="${l.date}" style="cursor:pointer"><div class="ico">${l.feel || '🏋️'}</div><div class="grow"><div class="t">${U.esc(l.name || 'Treino')}</div><div class="s">${U.dateNice(l.date)} · ${l.items.filter((i) => i.done).length}/${l.items.length} feitos${l.totalMin ? ' · ' + l.totalMin + ' min' : ''}</div></div></div>`).join('')}</div>` : '<p class="muted">Nenhum treino registrado.</p>'}</div>
    </div>`;
  };

  /* ---------- PROGRESSO DOS EXERCÍCIOS ---------- */
  const viewProgresso = () => {
    const names = [...new Set(st().workoutLogs.flatMap((l) => l.items.filter((i) => i.done).map((i) => i.name)))].sort();
    if (!S.ex || !names.includes(S.ex)) S.ex = names[0] || '';
    const pts = progressPoints(S.ex);
    const isRun = pts.length && pts[0].type === 'run';
    const best = pts.length ? (isRun ? pts.reduce((a, b) => (b.paceN && (!a.paceN || b.paceN < a.paceN) ? b : a), pts[0]) : pts.reduce((a, b) => ((b.load || 0) > (a.load || 0) ? b : a), pts[0])) : null;
    return `<div class="card"><header><h3>📈 Evolução por exercício</h3><select data-change="ex" style="width:auto">${names.map((n) => `<option ${n === S.ex ? 'selected' : ''}>${U.esc(n)}</option>`).join('')}</select></header>
      ${pts.length ? `<div class="grid g3" style="margin-bottom:14px">
        <div class="stat"><div class="lbl">${isRun ? 'Melhor pace' : 'Recorde de carga'}</div><div class="val">${isRun ? Fit.pace(best.distance, best.duration) : best.load + ' kg'}</div><div class="sub">${U.dateBR(best.date)}</div></div>
        <div class="stat"><div class="lbl">Primeiro registro</div><div class="val">${isRun ? (pts[0].distance || 0) + ' km' : (pts[0].load || 0) + ' kg'}</div><div class="sub">${U.dateBR(pts[0].date)}</div></div>
        <div class="stat"><div class="lbl">Evolução</div><div class="val">${isRun ? `${pts.length} corridas` : (pts[0].load ? (((pts[pts.length - 1].load - pts[0].load) / pts[0].load) * 100 > 0 ? '+' : '') + U.fmt(((pts[pts.length - 1].load - pts[0].load) / pts[0].load) * 100, 0) + '%' : '—')}</div><div class="sub">${pts.length} sessões</div></div></div>
        <div class="chart-box lg"><canvas id="prog-chart"></canvas></div>` : App.empty('📈', 'Sem dados ainda', 'Registre seus treinos com a carga usada — aqui aparece sua evolução de força e de corrida.')}</div>`;
  };
  const progressPoints = (name) => st().workoutLogs.slice().sort((a, b) => a.date.localeCompare(b.date)).map((l) => { const i = l.items.find((x) => x.name === name && x.done); return i ? { ...i, date: l.date, paceN: i.distance && i.duration ? i.duration / i.distance : null, volume: (i.sets || 0) * (parseInt(i.reps, 10) || 0) * (i.load || 0) } : null; }).filter(Boolean);
  const mountProgresso = () => {
    const pts = progressPoints(S.ex); if (!pts.length) return;
    const acc = App.cssVar('--accent');
    const isRun = pts[0].type === 'run';
    const labels = pts.map((p) => U.dateBR(p.date).slice(0, 5));
    App.chart(document.getElementById('prog-chart'), isRun
      ? { type: 'line', data: { labels, datasets: [{ label: 'Distância (km)', data: pts.map((p) => p.distance || null), borderColor: acc, tension: .3, yAxisID: 'y' }, { label: 'Pace (min/km)', data: pts.map((p) => (p.paceN ? U.round(p.paceN, 2) : null)), borderColor: '#22c55e', tension: .3, yAxisID: 'y2' }] }, options: { scales: { y: { position: 'left' }, y2: { position: 'right', reverse: true, grid: { display: false } } } } }
      : { type: 'line', data: { labels, datasets: [{ label: 'Carga (kg)', data: pts.map((p) => p.load || null), borderColor: acc, backgroundColor: App.alpha(acc, .15), fill: true, tension: .3, yAxisID: 'y' }, { label: 'Volume (séries×reps×kg)', data: pts.map((p) => p.volume || null), borderColor: '#f97316', tension: .3, yAxisID: 'y2' }] }, options: { scales: { y: { position: 'left' }, y2: { position: 'right', grid: { display: false } } } } });
  };

  /* ---------- PERFIL ---------- */
  const viewPerfil = () => {
    const p = prof(); const e = Fit.enrich(Fit.last());
    const c = Fit.calories(e);
    const h = p.height / 100;
    return `<div class="grid g2">
      <div class="card"><header><h3>👤 Dados básicos</h3></header>
        <form data-submit="saveProfile">
          ${F.row(F.text('Nome', 'name', p.name), F.select('Sexo', 'sex', [['M', 'Masculino'], ['F', 'Feminino']], p.sex))}
          ${F.row(F.date('Data de nascimento', 'birth', p.birth), F.number('Altura (cm)', 'height', p.height))}
          ${F.row(F.number('Meta de peso (kg)', 'goalWeight', p.goalWeight), F.number('Meta de gordura (%)', 'goalFat', p.goalFat))}
          ${F.row(F.select('Nível de atividade', 'activity', [[1.2, 'Sedentário'], [1.375, 'Leve (1–3x/sem)'], [1.55, 'Moderado (3–5x/sem)'], [1.725, 'Intenso (6–7x/sem)'], [1.9, 'Atleta / 2x por dia']], p.activity))}
          <button class="btn primary">Salvar perfil</button>
        </form>
        ${p.birth ? `<p class="muted mt">Idade: <b>${U.age(p.birth)} anos</b></p>` : ''}
      </div>
      <div class="card"><header><h3>🧮 Calculadoras</h3></header>
        ${c && e ? `<div class="list">
          <div class="li"><div class="grow">IMC</div><b>${U.fmt(e.bmi, 1)} · ${B.bmiClass(e.bmi).label}</b></div>
          <div class="li"><div class="grow">Peso saudável para sua altura (IMC 18,5–24,9)</div><b>${U.fmt(18.5 * h * h, 1)} – ${U.fmt(24.9 * h * h, 1)} kg</b></div>
          <div class="li"><div class="grow">TMB — Mifflin-St Jeor</div><b>${Math.round(c.mifflin)} kcal</b></div>
          ${c.katch ? `<div class="li"><div class="grow">TMB — Katch-McArdle (usa massa magra)</div><b>${Math.round(c.katch)} kcal</b></div>` : ''}
          ${e.bmr ? `<div class="li"><div class="grow">TMB medida pela bioimpedância</div><b>${Math.round(e.bmr)} kcal</b></div>` : ''}
          <div class="li"><div class="grow">Gasto total diário (TDEE)</div><b>${Math.round(c.tdee)} kcal</b></div>
          <div class="li"><div class="grow">🔻 Emagrecer (−20%)</div><b>${Math.round(c.tdee * 0.8)} kcal</b></div>
          <div class="li"><div class="grow">⚖️ Manter</div><b>${Math.round(c.tdee)} kcal</b></div>
          <div class="li"><div class="grow">🔺 Ganhar massa (+10%)</div><b>${Math.round(c.tdee * 1.1)} kcal</b></div>
          <div class="li"><div class="grow">Proteína (1,6–2,2 g/kg)</div><b>${Math.round(e.weight * 1.6)}–${Math.round(e.weight * 2.2)} g/dia</b></div>
          <div class="li"><div class="grow">Água (35 ml/kg)</div><b>${U.fmt((e.weight * 35) / 1000, 1)} L/dia</b></div>
          <div class="li"><div class="grow">FC máxima estimada (Tanaka)</div><b>${Math.round(208 - 0.7 * U.age(p.birth))} bpm</b></div>
        </div><p class="muted"><small>Estimativas gerais — não substituem nutricionista/médico.</small></p>` : App.empty('🧮', 'Complete o perfil', 'Preencha os dados e registre uma medição para ver os cálculos.')}
      </div>
      ${p.birth ? `<div class="card"><header><h3>❤️ Zonas de frequência cardíaca</h3></header><div class="list">${(() => { const max = 208 - 0.7 * U.age(p.birth); return [[1, .5, .6], [2, .6, .7], [3, .7, .8], [4, .8, .9], [5, .9, 1]].map(([z, a, b]) => `<div class="li"><span class="dot zone-${z}"></span><div class="grow">${ZONES[z - 1][1]}</div><b>${Math.round(max * a)}–${Math.round(max * b)} bpm</b></div>`).join(''); })()}</div></div>` : ''}
    </div>`;
  };

  /* ---------- view ---------- */
  App.views.fitness = {
    render(r) {
      const VIEWS = { corpo: viewCorpo, evolucao: viewEvolucao, treino: viewTreino, registro: viewRegistro, progresso: viewProgresso, remedios: App.Health.viewMeds, sono: App.Health.viewSleep, perfil: viewPerfil };
      const sub = VIEWS[r.sub] ? r.sub : 'corpo';
      this._sub = sub;
      const fn = VIEWS[sub];
      return `<div class="page-head"><div><h1>💪 Fitness</h1><p>Composição corporal, plano de treino, corrida e evolução.</p></div></div>
        ${App.subtabs('fitness', [['corpo', 'Corpo'], ['evolucao', 'Evolução'], ['treino', 'Plano de treino'], ['registro', 'Registrar treino'], ['progresso', 'Cargas & corrida'], ['remedios', '💊 Remédios & suplementos'], ['sono', '😴 Sono & humor'], ['perfil', 'Perfil & cálculos']], sub)}${fn()}`;
    },
    mount(el) {
      playing = 0;
      if (this._sub === 'corpo') mountCorpo(el);
      if (this._sub === 'evolucao') mountEvolucao();
      if (this._sub === 'progresso') mountProgresso();
      if (this._sub === 'sono') App.Health.mountSleep();
    },
    actions: {
      ...App.Health.actions,
      ghost: (t) => { S.ghost = t.checked; scrubTo(S.idx); },
      scrub: (t) => scrubTo(+t.value),
      avView: (t) => { lastParams = null; App.commit((x) => { x.settings.avatarView = t.dataset.v; }); },
      avSkin: (t) => App.commit((x) => { x.settings.avatarSkin = t.dataset.v === 'holo' ? 'holo' : (x.settings.lastSkin || 's2'); }),
      avToggle: (t) => App.commit((x) => { x.settings[t.dataset.k] = x.settings[t.dataset.k] === false; }),
      scrubDone: () => App.rerender(),
      play: async (t) => {
        if (playing) { playing = 0; return App.rerender(); }
        playing = 1; t.textContent = '⏹ Parar';
        const n = Fit.entries().length;
        for (let i = 0; i < n && playing; i++) {
          scrubTo(i);
          const r = document.querySelector('[data-input=scrub]'); if (r) r.value = i;
          await new Promise((res) => setTimeout(res, 1300));
        }
        playing = 0; App.rerender();
      },
      bioFiles: (t) => bioFiles(t),
      bioManual: () => bioModal({ date: U.today(), ...(Fit.last() ? { weight: Fit.last().weight } : {}) }),
      bioEdit: (t) => bioModal(st().body.find((b) => b.id === t.dataset.id)),
      metric: (t) => { S.metric = t.dataset.m; App.rerender(); },
      day: (t) => { S.day = +t.dataset.d; App.rerender(); },
      dayName: (t) => App.commit((s) => { let p = s.plan.find((x) => +x.day === S.day); if (!p) { p = { day: S.day, name: '', items: [] }; s.plan.push(p); } p.name = t.value; }),
      exAdd: (t) => exModal(t.dataset.type),
      exEdit: (t) => exModal(null, +t.dataset.i),
      exUp: (t) => App.commit(() => { const it = Fit.dayPlan(S.day).items; const i = +t.dataset.i; [it[i - 1], it[i]] = [it[i], it[i - 1]]; }),
      exDown: (t) => App.commit(() => { const it = Fit.dayPlan(S.day).items; const i = +t.dataset.i; [it[i + 1], it[i]] = [it[i], it[i + 1]]; }),
      clearDay: () => App.confirm(`Limpar o treino de ${U.DAYS[S.day]}?`, () => App.commit(() => { const p = Fit.dayPlan(S.day); p.items = []; p.name = ''; }), 'Limpar'),
      copyDay: () => App.modal({
        title: `Copiar ${U.DAYS[S.day]} para…`, submitLabel: 'Copiar',
        body: [1, 2, 3, 4, 5, 6, 0].filter((d) => d !== S.day).map((d) => F.check(U.DAYS[d], 'd' + d, false)).join('<br>'),
        onSubmit: (d) => App.commit((s) => { const src = Fit.dayPlan(S.day); Object.keys(d).filter((k) => d[k]).forEach((k) => { const day = +k.slice(1); let p = s.plan.find((x) => +x.day === day); if (!p) { p = { day, items: [] }; s.plan.push(p); } p.name = src.name; p.items = src.items.map((x) => ({ ...x, id: U.uid() })); }); }),
      }),
      templates: () => App.modal({
        title: '✨ Modelos de treino', submitLabel: 'Aplicar modelo',
        body: `<div class="note warn">Aplicar um modelo <b>substitui</b> os dias que ele usa. Depois você ajusta tudo como quiser.</div>${Object.entries(TEMPLATES).map(([k, v], i) => `<label class="check" style="margin-bottom:10px"><input type="radio" name="tpl" value="${k}" ${i === 0 ? 'checked' : ''}><span><b>${v.name}</b></span></label>`).join('')}`,
        onSubmit: (d) => App.commit((s) => {
          const t = TEMPLATES[d.tpl];
          for (const [day, [name, items]] of Object.entries(t.days)) {
            let p = s.plan.find((x) => +x.day === +day); if (!p) { p = { day: +day, items: [] }; s.plan.push(p); }
            p.name = name; p.items = items.map(([type, n, sets, reps, extra]) => ({ id: U.uid(), type, name: n, sets: sets || '', reps: reps || '', ...(extra || {}) }));
          }
          App.toast('Modelo aplicado');
        }),
      }),
      importPlan: async (t) => {
        const f = t.files[0]; if (!f) return;
        try {
          const r = await App.parse.read(f);
          const items = r.tables.flatMap((tb) => App.parse.workoutPlan(tb));
          if (!items.length) { App.toast('Não reconheci as colunas. Use cabeçalhos como Dia, Exercício, Séries, Repetições, Carga.', 'error'); return; }
          App.confirm(`Importar <b>${items.length}</b> exercícios para ${[...new Set(items.map((x) => U.DAYS[x.day]))].join(', ')}? Os dias da planilha serão substituídos.`, () => App.commit((s) => {
            const days = U.groupBy(items, (x) => x.day);
            for (const [day, arr] of Object.entries(days)) {
              let p = s.plan.find((x) => +x.day === +day); if (!p) { p = { day: +day, items: [] }; s.plan.push(p); }
              p.items = arr.map((x) => x.item); if (arr[0].focus) p.name = arr[0].focus;
            }
          }), 'Importar');
        } catch (e) { App.toast('Erro ao ler planilha: ' + e.message, 'error'); }
        t.value = '';
      },
      logDate: (t) => { S.logDate = t.value || U.today(); App.rerender(); },
      logDateSet: (t) => { S.logDate = t.dataset.d; App.rerender(); window.scrollTo(0, 0); },
      saveLog: (form) => {
        const d = App.formData(form);
        const dp = Fit.dayPlan(U.parseISO(S.logDate).getDay());
        const items = dp.items.map((it, i) => ({ name: it.name, type: it.type, done: !!d['done' + i], sets: d['sets' + i], reps: d['reps' + i], load: d['load' + i], distance: d['distance' + i], duration: d['duration' + i], hr: d['hr' + i] }));
        App.commit((s) => {
          s.workoutLogs = s.workoutLogs.filter((l) => l.date !== S.logDate);
          s.workoutLogs.push({ id: U.uid(), date: S.logDate, name: dp.name || 'Treino livre', items, totalMin: d.totalMin, feel: d.feel, rpe: d.rpe, notes: d.notes });
        });
        App.toast('Treino registrado 💪');
      },
      delLog: () => App.confirm('Excluir o registro deste dia?', () => App.commit((s) => { s.workoutLogs = s.workoutLogs.filter((l) => l.date !== S.logDate); })),
      ex: (t) => { S.ex = t.value; App.rerender(); },
      saveProfile: (form) => { const d = App.formData(form); App.commit((s) => { Object.assign(s.profile, d, { activity: +d.activity }); }); App.toast('Perfil salvo'); },
    },
    quick: { body: () => bioModal({ date: U.today() }), workout: () => App.go('fitness/registro') },
  };
})(window.App);
