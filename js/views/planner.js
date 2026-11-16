/* ==========================================================
   PLANEJAMENTO — salário → quanto investir → onde chego
   Simulação mês a mês editável, cenários e calculadoras.
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const P = (App.Planner = {});

  const defaults = () => ({
    salary: (App.Money && App.Money.fixedIncome()) || 0, mode: 'pct', pct: 10, value: 300, years: 10, scenario: 'cdi', customRate: 12,
    raise: 5, follow: true, thirteenth: 50, extraYear: 0, start: 'current', ir: true, goalIncome: 2000, overrides: {}, view: 'year', page: 1,
  });
  P.cfg = () => { const s = st(); s.planner = { ...defaults(), ...(s.planner || {}) }; if (!s.planner.salary && App.Money) s.planner.salary = App.Money.fixedIncome(); return s.planner; };

  /* ---------- cenários (taxa anual líquida) ---------- */
  P.SCEN = {
    cdi: { label: 'CDB / caixinha 100% CDI', color: '#22d3ee', rate: (c) => st().settings.cdi * (c.ir ? 0.85 : 1), note: (c) => `CDI ${U.fmt(st().settings.cdi, 2)}% a.a.${c.ir ? ' − IR 15%' : ''}` },
    fii: { label: 'Fundos imobiliários (dividendos)', color: '#a78bfa', rate: () => { const t = App.Inv.totals(); const dy = t.fii ? t.fiiIncome / t.fii : 0.009; return (Math.pow(1 + dy, 12) - 1) * 100; }, note: () => { const t = App.Inv.totals(); return `DY ${U.fmt(t.fii ? (t.fiiIncome / t.fii) * 100 : 0.9, 2)}%/mês reinvestido, isento`; } },
    ipca: { label: 'Tesouro IPCA+ 6%', color: '#f59e0b', rate: (c) => (((1 + st().settings.ipca / 100) * 1.06 - 1) * 100) * (c.ir ? 0.85 : 1), note: (c) => `IPCA ${U.fmt(st().settings.ipca, 1)}% + 6%${c.ir ? ' − IR 15%' : ''}` },
    poup: { label: 'Poupança', color: '#94a3b8', rate: () => (st().settings.cdi > 8.5 ? 6.17 : st().settings.cdi * 0.7), note: () => 'isenta, ~0,5% ao mês' },
    custom: { label: 'Taxa personalizada', color: '#22c55e', rate: (c) => +c.customRate || 0, note: (c) => `${U.fmt(+c.customRate || 0, 2)}% ao ano` },
  };
  const monthly = (annual) => Math.pow(1 + annual / 100, 1 / 12) - 1;

  P.monthlyAporte = () => { const c = P.cfg(); return c.mode === 'pct' ? (c.salary * c.pct) / 100 : +c.value || 0; };

  /** Simulação mês a mês. */
  P.simulate = (c = P.cfg(), scenKey = c.scenario, withOverrides = true) => {
    const r = monthly(P.SCEN[scenKey].rate(c)), inf = monthly(st().settings.ipca);
    const initial = c.start === 'current' ? App.Inv.totals().total : +c.startValue || 0;
    let pat = initial, invested = initial, interest = 0;
    const rows = [], N = Math.max(1, Math.round(c.years * 12));
    const startYM = U.addMonthsYM(U.ym(), 1);
    let turn = null, goalAt = null, k100 = null, k1m = null;
    for (let m = 1; m <= N; m++) {
      const yr = Math.floor((m - 1) / 12);
      const ym = U.addMonthsYM(startYM, m - 1);
      const sal = c.salary * Math.pow(1 + c.raise / 100, yr);
      let base = c.mode === 'pct' ? (sal * c.pct) / 100 : (+c.value || 0) * (c.follow ? Math.pow(1 + c.raise / 100, yr) : 1);
      const ov = withOverrides && c.overrides[m] !== undefined && c.overrides[m] !== '' ? +c.overrides[m] : null;
      let ap = ov !== null ? ov : base;
      let extra = 0;
      if (ym.endsWith('-12')) extra = (sal * (c.thirteenth || 0)) / 100 + (+c.extraYear || 0);
      const gain = pat * r;
      pat += gain + ap + extra; invested += ap + extra; interest += gain;
      const income = pat * r;
      if (!turn && gain > ap) turn = m;
      if (!goalAt && c.goalIncome && income >= c.goalIncome) goalAt = m;
      if (!k100 && pat >= 100000) k100 = m;
      if (!k1m && pat >= 1000000) k1m = m;
      rows.push({ m, ym, sal, ap, extra, edited: ov !== null, gain, pat, invested, interest, income, real: pat / Math.pow(1 + inf, m) });
    }
    return { rows, initial, r, turn, goalAt, k100, k1m, last: rows[rows.length - 1] };
  };

  const when = (m) => (m ? `${U.ymLabel(U.addMonthsYM(U.ym(), m))} <small class="muted">(${m < 12 ? m + ' meses' : U.fmt(m / 12, 1) + ' anos'})</small>` : '<small class="muted">não chega no período</small>');

  /* ---------- tela ---------- */
  P.view = () => {
    const c = P.cfg();
    const sim = P.simulate();
    const L = sim.last, ap = P.monthlyAporte();
    const b = App.Money ? App.Money.budget() : null;
    const age = U.age(st().profile.birth);
    const yearRows = [];
    for (let y = 0; y < Math.ceil(sim.rows.length / 12); y++) {
      const rs = sim.rows.slice(y * 12, y * 12 + 12); const e = rs[rs.length - 1];
      yearRows.push({ y: y + 1, rs, e, apMonth: rs[0].ap, edited: rs.some((x) => x.edited), apYear: U.sum(rs, (x) => x.ap + x.extra), gainYear: U.sum(rs, (x) => x.gain) });
    }
    const page = Math.min(c.page || 1, yearRows.length);
    return `<div class="grid g3">
      <div class="card"><header><h3>💼 Seu plano</h3></header>
        <form data-submit="planSave" data-change="planLive" class="plan-form">
          ${F.row(F.number('Salário líquido (R$)', 'salary', c.salary))}
          ${F.row(F.select('Investir', 'mode', [['pct', '% do salário'], ['value', 'valor fixo (R$)']], c.mode), c.mode === 'pct' ? F.number('% do salário', 'pct', c.pct, 'step="0.5"') : F.number('Valor por mês (R$)', 'value', c.value))}
          ${F.row(F.number('Por quantos anos', 'years', c.years, 'min="1" max="60"'), F.number('Aumento do salário/ano (%)', 'raise', c.raise, 'step="0.5"'))}
          ${c.mode === 'value' ? F.check('Aumentar o aporte junto com o salário', 'follow', c.follow) : ''}
          ${F.row(F.number('% do 13º que vou investir', 'thirteenth', c.thirteenth), F.number('Extra por ano (R$)', 'extraYear', c.extraYear, 'title="PLR, férias, restituição…"'))}
          ${F.row(F.select('Investir em', 'scenario', Object.entries(P.SCEN).map(([k, v]) => [k, v.label]), c.scenario), c.scenario === 'custom' ? F.number('Taxa anual (%)', 'customRate', c.customRate, 'step="0.1"') : '')}
          ${F.row(F.select('Começar com', 'start', [['current', `Meu patrimônio atual (${U.moneyTxt(App.Inv.totals().total)})`], ['zero', 'Outro valor']], c.start), c.start === 'zero' ? F.number('Valor inicial (R$)', 'startValue', c.startValue || 0) : '')}
          ${F.row(F.number('Renda passiva desejada (R$/mês)', 'goalIncome', c.goalIncome))}
          ${F.check('Descontar imposto de renda (15%)', 'ir', c.ir)}
          <p class="muted"><small>${P.SCEN[c.scenario].note(c)} → ${U.fmt(P.SCEN[c.scenario].rate(c), 2)}% a.a. líquido (${U.fmt(sim.r * 100, 3)}% ao mês)</small></p>
        </form>
      </div>
      <div class="span2 stack">
        <div class="grid g4 plan-stats">
          <div class="card accent stat"><div class="lbl">Patrimônio em ${c.years} anos</div><div class="val">${U.money(L.pat)}</div><div class="sub">em valores de hoje: ${U.money(L.real)}</div></div>
          <div class="card stat"><div class="lbl">Você investiu</div><div class="val">${U.money(L.invested)}</div><div class="sub">do próprio bolso</div></div>
          <div class="card stat"><div class="lbl">Os juros renderam</div><div class="val delta good">${U.money(L.interest)}</div><div class="sub">${U.pct(L.invested ? (L.interest / L.invested) * 100 : 0, 0)} a mais</div></div>
          <div class="card stat"><div class="lbl">Renda por mês no fim</div><div class="val">${U.money(L.income)}</div><div class="sub">sem mexer no principal</div></div>
        </div>
        <div class="card"><header><h3>📈 Evolução</h3><small class="muted">aporte de ${U.money(ap)}/mês hoje · ${b && b.salary ? `sobra livre do salário: <b>${U.money(b.free)}</b>` : ''}</small></header><div class="chart-box lg"><canvas id="pl-chart"></canvas></div></div>
      </div>
    </div>
    <div class="grid g4 mt">
      <div class="card stat"><div class="lbl">🎯 Renda de ${U.moneyTxt(c.goalIncome)}/mês</div><div class="val" style="font-size:1.1rem">${when(sim.goalAt)}</div><div class="sub">precisa de ~${U.money(c.goalIncome / (sim.r || 1e-9))} investidos</div></div>
      <div class="card stat"><div class="lbl">🔄 Juros passam o aporte</div><div class="val" style="font-size:1.1rem">${when(sim.turn)}</div><div class="sub">a partir daí o dinheiro trabalha mais que você</div></div>
      <div class="card stat"><div class="lbl">💯 Primeiros R$ 100 mil</div><div class="val" style="font-size:1.1rem">${when(sim.k100)}</div></div>
      <div class="card stat"><div class="lbl">🏆 R$ 1 milhão</div><div class="val" style="font-size:1.1rem">${when(sim.k1m)}</div></div>
    </div>
    <div class="grid g2 mt">
      <div class="card"><header><h3>⚖️ Mesmo aporte em cada investimento</h3></header><div class="chart-box"><canvas id="pl-comp"></canvas></div>
        <div class="list">${Object.keys(P.SCEN).map((k) => { const s = P.simulate(c, k); return `<div class="li"><span class="dot" style="background:${P.SCEN[k].color}"></span><div class="grow">${P.SCEN[k].label}</div><b>${U.money(s.last.pat)}</b><small class="muted" style="min-width:110px;text-align:right">${U.money(s.last.income)}/mês</small></div>`; }).join('')}</div></div>
      <div class="card"><header><h3>🧮 Calculadoras rápidas</h3></header>
        <div class="calc"><b>Quanto preciso investir por mês?</b><div class="inline-form">${F.number('Para ter (R$)', 'cFV', 100000, 'data-input="calc"')}${F.number('Em (anos)', 'cN', 10, 'data-input="calc"')}<div class="field"><span>Resultado</span><b id="cr1" class="calc-r"></b></div></div></div>
        <div class="calc"><b>Em quanto tempo eu chego lá?</b><div class="inline-form">${F.number('Meta (R$)', 'cG', 50000, 'data-input="calc"')}${F.number('Investindo por mês (R$)', 'cA', Math.round(ap) || 300, 'data-input="calc"')}<div class="field"><span>Resultado</span><b id="cr2" class="calc-r"></b></div></div></div>
        <div class="calc"><b>Quanto preciso juntar para viver de renda?</b><div class="inline-form">${F.number('Renda desejada (R$/mês)', 'cR', c.goalIncome || 3000, 'data-input="calc"')}<div class="field"><span>Patrimônio necessário</span><b id="cr3" class="calc-r"></b></div></div></div>
        <p class="muted"><small>Usa a taxa do cenário escolhido (${U.fmt(P.SCEN[c.scenario].rate(c), 2)}% a.a.) e conta com o patrimônio inicial.</small></p></div>
    </div>
    <div class="card mt"><header><h3>🗂️ Simulação ${c.view === 'year' ? 'ano a ano' : 'mês a mês'}</h3>
      <div class="row"><small class="muted">✏️ edite o aporte de qualquer ${c.view === 'year' ? 'ano' : 'mês'} — o resto recalcula</small>
        <div class="seg"><button class="${c.view === 'year' ? 'on' : ''}" data-act="plView" data-v="year">Por ano</button><button class="${c.view === 'month' ? 'on' : ''}" data-act="plView" data-v="month">Por mês</button></div>
        ${Object.keys(c.overrides).length ? '<button class="btn sm ghost" data-act="plReset">↺ Desfazer edições</button>' : ''}</div></header>
      <div class="table-wrap"><table class="plan-table"><thead><tr>${c.view === 'year' ? '<th>Ano</th>' + (age ? '<th>Idade</th>' : '') + '<th class="r">Salário</th><th class="r">Aporte/mês</th><th class="r">Aportado no ano</th><th class="r">Rendimento no ano</th><th class="r">Patrimônio</th><th class="r">Renda/mês</th><th class="r">Valor de hoje</th>'
        : '<th>Mês</th><th class="r">Aporte</th><th class="r">Extra</th><th class="r">Rendimento</th><th class="r">Total investido</th><th class="r">Juros acumulados</th><th class="r">Patrimônio</th><th class="r">Renda/mês</th>'}</tr></thead><tbody>
      ${c.view === 'year' ? yearRows.map((y) => `<tr class="${y.edited ? 'edited' : ''}"><td><b>${y.y}º</b> <small class="muted">${y.rs[0].ym.slice(0, 4)}</small></td>${age ? `<td>${age + y.y}</td>` : ''}<td class="r">${U.money(y.rs[0].sal)}</td>
          <td class="r"><input class="cell" type="number" step="any" value="${U.round(y.apMonth)}" data-change="plYear" data-y="${y.y}"></td><td class="r">${U.money(y.apYear)}</td><td class="r delta good">${U.money(y.gainYear)}</td><td class="r"><b>${U.money(y.e.pat)}</b></td><td class="r">${U.money(y.e.income)}</td><td class="r muted">${U.money(y.e.real)}</td></tr>`).join('')
        : yearRows[page - 1].rs.map((x) => `<tr class="${x.edited ? 'edited' : ''}"><td style="text-transform:capitalize">${U.ymShort(x.ym)}</td><td class="r"><input class="cell" type="number" step="any" value="${U.round(x.ap)}" data-change="plMonth" data-m="${x.m}"></td><td class="r">${x.extra ? U.money(x.extra) : ''}</td><td class="r delta good">${U.money(x.gain)}</td><td class="r">${U.money(x.invested)}</td><td class="r">${U.money(x.interest)}</td><td class="r"><b>${U.money(x.pat)}</b></td><td class="r">${U.money(x.income)}</td></tr>`).join('')}
      </tbody></table></div>
      ${c.view === 'month' ? `<div class="row mt" style="justify-content:center"><button class="btn sm" data-act="plPage" data-d="-1" ${page <= 1 ? 'disabled' : ''}>‹ ano anterior</button><b>${page}º ano (${yearRows[page - 1].rs[0].ym.slice(0, 4)})</b><button class="btn sm" data-act="plPage" data-d="1" ${page >= yearRows.length ? 'disabled' : ''}>próximo ano ›</button></div>` : ''}
    </div>`;
  };

  P.mount = () => {
    const c = P.cfg(), sim = P.simulate();
    const step = Math.max(1, Math.floor(sim.rows.length / 80));
    const pts = sim.rows.filter((x, i) => i % step === 0 || i === sim.rows.length - 1);
    App.chart(document.getElementById('pl-chart'), { type: 'line', data: { labels: pts.map((x) => U.ymShort(x.ym)), datasets: [
      { label: 'Patrimônio', data: pts.map((x) => U.round(x.pat)), borderColor: App.cssVar('--accent'), backgroundColor: App.alpha(App.cssVar('--accent'), .18), fill: true, tension: .3, pointRadius: 0 },
      { label: 'Do seu bolso', data: pts.map((x) => U.round(x.invested)), borderColor: '#94a3b8', backgroundColor: App.alpha('#94a3b8', .15), fill: true, tension: .3, pointRadius: 0 },
      { label: 'Em valores de hoje', data: pts.map((x) => U.round(x.real)), borderColor: '#f59e0b', borderDash: [5, 5], tension: .3, pointRadius: 0 },
      { label: 'Renda/mês', data: pts.map((x) => U.round(x.income)), borderColor: '#22c55e', tension: .3, pointRadius: 0, yAxisID: 'y2' }] },
      options: { interaction: { mode: 'index', intersect: false }, scales: { y: { ticks: { callback: (v) => 'R$' + (v >= 1e6 ? U.fmt(v / 1e6, 1) + 'mi' : v >= 1000 ? Math.round(v / 1000) + 'k' : v) } }, y2: { position: 'right', grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${U.moneyTxt(x.raw)}` } } } } });
    const keys = Object.keys(P.SCEN); const sims = keys.map((k) => P.simulate(c, k));
    const yrs = Array.from({ length: Math.ceil(sim.rows.length / 12) }, (_, i) => Math.min(sim.rows.length - 1, i * 12 + 11));
    App.chart(document.getElementById('pl-comp'), { type: 'line', data: { labels: yrs.map((i) => sim.rows[i].ym.slice(0, 4)), datasets: keys.map((k, j) => ({ label: P.SCEN[k].label, data: yrs.map((i) => U.round(sims[j].rows[i].pat)), borderColor: P.SCEN[k].color, tension: .3, pointRadius: 0, borderWidth: k === c.scenario ? 3 : 1.5 })) }, options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${U.moneyTxt(x.raw)}` } } } } });
    calc();
  };

  const calc = () => {
    const c = P.cfg(), r = monthly(P.SCEN[c.scenario].rate(c)), P0 = c.start === 'current' ? App.Inv.totals().total : +c.startValue || 0;
    const v = (id) => U.num((document.querySelector(`[name=${id}]`) || {}).value);
    const set = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
    const n = Math.round(v('cN') * 12), fv = v('cFV');
    if (n > 0) { const g = Math.pow(1 + r, n); const need = r ? ((fv - P0 * g) * r) / (g - 1) : (fv - P0) / n; set('cr1', need <= 0 ? 'Você já chega lá sem aportar 🎉' : `${U.moneyTxt(need)}/mês`); }
    const goal = v('cG'), a = v('cA');
    if (goal > 0) { let p = P0, m = 0; while (p < goal && m < 1200) { p = p * (1 + r) + a; m++; } set('cr2', m >= 1200 ? 'mais de 100 anos — aumente o aporte' : m === 0 ? 'Já atingido 🎉' : `${m} meses (${U.fmt(m / 12, 1)} anos) — ${U.ymLabel(U.addMonthsYM(U.ym(), m))}`); }
    const want = v('cR'); if (want > 0 && r > 0) set('cr3', U.moneyTxt(want / r));
  };

  /* widget do início: meta de investimento do mês */
  P.widget = () => {
    const ap = P.monthlyAporte();
    const done = U.sum(App.Fin.tx(...App.Fin.monthRange(U.ym())).filter((t) => t.categoryId === 'investimentos'), (t) => t.value);
    const goals = App.Money ? App.Money.goals().filter((g) => !App.Money.goalCalc(g).done) : [];
    return `<div class="card"><header><h3>💹 Investir este mês</h3><a class="btn sm ghost" href="#/investimentos/planejamento">plano</a></header>
      ${ap ? `<div class="row between"><span class="muted">Meta do plano</span><b>${U.money(ap)}</b></div><div class="bar mt ${done >= ap ? '' : ''}"><i style="width:${Math.min(100, (done / ap) * 100)}%"></i></div><div class="row between"><small class="muted">investido: ${U.money(done)}</small><small>${done >= ap ? '✅ meta batida' : 'faltam ' + U.money(ap - done)}</small></div>` : '<p class="muted">Monte seu plano de investimento.</p>'}
      ${goals.length ? `<div class="list mt">${goals.slice(0, 3).map((g) => { const c = App.Money.goalCalc(g); return `<div class="li"><span style="font-size:1.3rem">${U.esc(g.emoji || '🎯')}</span><div class="grow"><div class="t">${U.esc(g.name)}</div><div class="bar"><i style="width:${c.pct}%;background:${g.color || 'var(--ok)'}"></i></div></div><small>${U.fmt(c.pct, 0)}%</small></div>`; }).join('')}</div>` : ''}
    </div>`;
  };

  P.actions = {
    planLive: (form, e) => {
      if (!e.target.name) return;
      const d = App.formData(form); const c = P.cfg();
      Object.assign(c, d);
      App.save(); App.rerender();
    },
    planSave: () => {},
    plView: (t) => { P.cfg().view = t.dataset.v; App.save(); App.rerender(); },
    plPage: (t) => { const c = P.cfg(); c.page = Math.max(1, (c.page || 1) + +t.dataset.d); App.save(); App.rerender(); },
    plMonth: (t) => { const c = P.cfg(); c.overrides[t.dataset.m] = t.value === '' ? undefined : U.num(t.value); if (t.value === '') delete c.overrides[t.dataset.m]; App.save(); App.rerender(); },
    plYear: (t) => { const c = P.cfg(), y = +t.dataset.y; for (let m = (y - 1) * 12 + 1; m <= y * 12; m++) c.overrides[m] = U.num(t.value); App.save(); App.rerender(); },
    plReset: () => { P.cfg().overrides = {}; App.save(); App.rerender(); },
    calc: () => calc(),
  };
})(window.App);
