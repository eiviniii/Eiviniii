/* ==========================================================
   INVESTIMENTOS — FIIs, renda fixa, patrimônio, simulador
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const Inv = (App.Inv = {});

  /* ---------- cálculos ---------- */
  Inv.irRate = (days) => (days <= 180 ? 22.5 : days <= 360 ? 20 : days <= 720 ? 17.5 : 15);
  Inv.annualRate = (f) => {
    const s = st().settings;
    if (f.indexer === 'CDI') return (s.cdi * (f.rate || 100)) / 100;
    if (f.indexer === 'IPCA') return ((1 + s.ipca / 100) * (1 + (f.rate || 0) / 100) - 1) * 100;
    if (f.indexer === 'POUP') return s.cdi > 8.5 ? 6.17 : s.cdi * 0.7;
    return f.rate || 0;
  };
  Inv.isExempt = (f) => ['LCI', 'LCA', 'Poupança', 'CRI', 'CRA', 'Debênture incentivada'].includes(f.type) || f.indexer === 'POUP' || f.exempt;
  Inv.fixedValue = (f, at = U.today()) => {
    const days = Math.max(0, U.diffDays(f.start || at, at));
    const gross = (f.amount || 0) * Math.pow(1 + Inv.annualRate(f) / 100, days / 365);
    const gain = gross - (f.amount || 0);
    const tax = Inv.isExempt(f) ? 0 : (gain * Inv.irRate(days)) / 100;
    return { days, gross, gain, tax, net: gross - tax, taxRate: Inv.isExempt(f) ? 0 : Inv.irRate(days) };
  };
  Inv.fixedMonthly = (f) => Inv.fixedValue(f).gross * (Math.pow(1 + Inv.annualRate(f) / 100, 1 / 12) - 1);
  Inv.fii = (x) => {
    const value = x.qty * (x.price || x.avg), cost = x.qty * x.avg, income = x.qty * (x.div || 0);
    return { value, cost, gain: value - cost, gainPct: cost ? ((value - cost) / cost) * 100 : 0, income, dy: x.price ? (x.div / x.price) * 100 : 0, yoc: x.avg ? (x.div / x.avg) * 100 : 0, magic: x.div ? Math.ceil((x.price || x.avg) / x.div) : null };
  };
  Inv.totals = () => {
    const fiis = st().fiis.map(Inv.fii);
    const fii = U.sum(fiis, (x) => x.value), fiiCost = U.sum(fiis, (x) => x.cost), fiiIncome = U.sum(fiis, (x) => x.income);
    const fixed = U.sum(st().fixed, (f) => Inv.fixedValue(f).net), fixedIn = U.sum(st().fixed, (f) => f.amount);
    const fixedIncome = U.sum(st().fixed, Inv.fixedMonthly);
    const other = U.sum(st().otherAssets, (a) => a.value);
    const debt = App.Fin ? App.Fin.debtTotal() : 0;
    const total = fii + fixed + other;
    return { fii, fiiCost, fiiIncome, fixed, fixedIn, fixedIncome, other, total, debt, net: total - debt, invested: fiiCost + fixedIn, income: fiiIncome + fixedIncome };
  };
  Inv.snapshot = () => {
    const t = Inv.totals(); if (!t.total && !st().snapshots.length) return;
    const ym = U.ym();
    const snap = { ym, total: U.round(t.total), fii: U.round(t.fii), fixed: U.round(t.fixed), other: U.round(t.other), debt: U.round(t.debt) };
    const i = st().snapshots.findIndex((s) => s.ym === ym);
    if (i >= 0) st().snapshots[i] = snap; else st().snapshots.push(snap);
    st().snapshots.sort((a, b) => a.ym.localeCompare(b.ym));
    App.save();
  };
  Inv.byInstitution = () => {
    const m = {};
    st().fiis.forEach((x) => { const k = x.broker || 'Sem corretora'; m[k] = (m[k] || 0) + Inv.fii(x).value; });
    st().fixed.forEach((f) => { const k = f.institution || 'Sem banco'; m[k] = (m[k] || 0) + Inv.fixedValue(f).net; });
    st().otherAssets.forEach((a) => { const k = a.institution || a.name; m[k] = (m[k] || 0) + (a.value || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  /* ---------- estado da tela ---------- */
  const PALETTE = ['#7c5cff', '#22d3ee', '#f97316', '#22c55e', '#ec4899', '#eab308', '#3b82f6', '#a855f7', '#14b8a6', '#f43f5e'];

  const views = {};
  views.carteira = () => {
    Inv.snapshot();
    const t = Inv.totals();
    const inst = Inv.byInstitution();
    return `
    <div class="grid g4">
      <div class="card accent stat"><div class="lbl">Patrimônio investido</div><div class="val">${U.money(t.total)}</div><div class="sub">aplicado: ${U.money(t.invested + t.other)}</div></div>
      <div class="card stat"><div class="lbl">Renda passiva / mês</div><div class="val">${U.money(t.income)}</div><div class="sub">FIIs ${U.money(t.fiiIncome)} · RF ${U.money(t.fixedIncome)}</div></div>
      <div class="card stat"><div class="lbl">Resultado</div><div class="val ${t.total - t.invested - t.other >= 0 ? 'delta good' : 'delta badd'}">${U.money(t.total - t.invested - t.other)}</div><div class="sub">${t.invested ? U.pct(((t.total - t.other - t.invested) / t.invested) * 100) : '—'} sobre o aplicado</div></div>
      <div class="card stat"><div class="lbl">Patrimônio líquido</div><div class="val">${U.money(t.net)}</div><div class="sub">descontando ${U.money(t.debt)} de dívidas</div></div>
    </div>
    <div class="grid g3 mt">
      <div class="card"><header><h3>🥧 Por classe</h3></header>${t.total ? '<div class="chart-box"><canvas id="inv-class"></canvas></div>' : App.empty('📈', 'Carteira vazia', 'Adicione seus FIIs, CDBs e saldos.')}</div>
      <div class="card"><header><h3>🏦 Por instituição</h3></header>${inst.length ? `<div class="list">${inst.map(([k, v], i) => `<div class="li"><span class="dot" style="background:${PALETTE[i % 10]}"></span><div class="grow"><div class="t">${U.esc(k)}</div><div class="bar"><i style="width:${(v / inst[0][1]) * 100}%;background:${PALETTE[i % 10]}"></i></div></div><b>${U.money(v)}</b></div>`).join('')}</div>` : '<p class="muted">—</p>'}</div>
      <div class="card"><header><h3>💼 Outros saldos</h3><button class="btn sm" data-act="addOther">＋</button></header>
        ${st().otherAssets.length ? `<div class="list">${st().otherAssets.map((a) => `<div class="li"><div class="ico">${({ conta: '🏦', reserva: '🛟', cripto: '🪙', acoes: '📊', outro: '💼' })[a.kind] || '💼'}</div><div class="grow"><div class="t">${U.esc(a.name)}</div><div class="s">${U.esc(a.institution || '')}</div></div><b>${U.money(a.value)}</b><button class="icon-btn" data-act="editOther" data-id="${a.id}">✏️</button></div>`).join('')}</div>` : '<p class="muted">Saldo em conta, reserva de emergência, ações, cripto…</p>'}</div>
    </div>
    <div class="card mt"><header><h3>📈 Evolução do patrimônio</h3><small>um registro por mês (automático)</small></header>
      ${st().snapshots.length > 0 ? '<div class="chart-box"><canvas id="inv-evo"></canvas></div>' : '<p class="muted">Os registros mensais aparecem aqui conforme você usa o sistema.</p>'}</div>`;
  };
  const mountCarteira = () => {
    const t = Inv.totals();
    if (t.total) App.chart(document.getElementById('inv-class'), { type: 'doughnut', data: { labels: ['FIIs', 'Renda fixa', 'Outros'], datasets: [{ data: [t.fii, t.fixed, t.other].map((v) => U.round(v)), backgroundColor: ['#7c5cff', '#22d3ee', '#f59e0b'], borderWidth: 0 }] }, options: { cutout: '66%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${U.moneyTxt(c.raw)}` } } } } });
    const sn = st().snapshots;
    if (sn.length) App.chart(document.getElementById('inv-evo'), { type: 'line', data: { labels: sn.map((s) => U.ymShort(s.ym)), datasets: [
      { label: 'Total', data: sn.map((s) => s.total), borderColor: App.cssVar('--accent'), backgroundColor: App.alpha(App.cssVar('--accent'), .15), fill: true, tension: .35 },
      { label: 'FIIs', data: sn.map((s) => s.fii), borderColor: '#a78bfa', tension: .35 }, { label: 'Renda fixa', data: sn.map((s) => s.fixed), borderColor: '#22d3ee', tension: .35 }] }, options: { plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${U.moneyTxt(c.raw)}` } } } } });
  };

  views.fiis = () => {
    const rows = st().fiis.map((x) => ({ x, c: Inv.fii(x) })).sort((a, b) => b.c.value - a.c.value);
    const t = Inv.totals();
    const hasToken = !!st().settings.brapiToken;
    return `
    <div class="grid g4">
      <div class="card accent stat"><div class="lbl">Valor em FIIs</div><div class="val">${U.money(t.fii)}</div><div class="sub">custo ${U.money(t.fiiCost)}</div></div>
      <div class="card stat"><div class="lbl">Dividendos / mês</div><div class="val">${U.money(t.fiiIncome)}</div><div class="sub">${U.money(t.fiiIncome * 12)} / ano</div></div>
      <div class="card stat"><div class="lbl">DY médio mensal</div><div class="val">${t.fii ? U.pct((t.fiiIncome / t.fii) * 100, 2) : '—'}</div><div class="sub">${t.fii ? U.pct((t.fiiIncome / t.fii) * 1200, 1) + ' a.a.' : ''}</div></div>
      <div class="card stat"><div class="lbl">Yield on cost</div><div class="val">${t.fiiCost ? U.pct((t.fiiIncome / t.fiiCost) * 100, 2) : '—'}</div><div class="sub">sobre o preço pago</div></div>
    </div>
    <div class="card mt"><header><h3>🏢 Fundos imobiliários</h3><div class="row">
      <button class="btn" data-act="refreshQuotes" title="${hasToken ? '' : 'Configure o token grátis da brapi.dev em Ajustes'}">🔄 Atualizar cotações ${hasToken ? '' : '(requer token)'}</button>
      <button class="btn primary" data-act="addFii">＋ FII</button></div></header>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Ativo</th><th class="r">Cotas</th><th class="r">Preço médio</th><th class="r">Cotação</th><th class="r">Total</th><th class="r">Resultado</th><th class="r">Últ. dividendo</th><th class="r">Renda/mês</th><th class="r">DY mês</th><th class="r">YoC</th><th class="r" title="Cotas necessárias para os dividendos comprarem 1 cota nova por mês">Nº mágico</th><th></th></tr></thead><tbody>
      ${rows.map(({ x, c }) => `<tr><td><b>${U.esc(x.ticker)}</b><br><small>${U.esc(x.broker || '')}${x.segment ? ' · ' + U.esc(x.segment) : ''}</small></td><td class="r">${x.qty}</td><td class="r">${U.money(x.avg)}</td><td class="r">${U.money(x.price || x.avg)}${x.updatedAt ? `<br><small>${U.dateBR(x.updatedAt)}</small>` : ''}</td>
        <td class="r"><b>${U.money(c.value)}</b></td><td class="r ${c.gain >= 0 ? 'delta good' : 'delta badd'}">${U.money(c.gain)}<br><small>${U.pct(c.gainPct)}</small></td>
        <td class="r">${U.money(x.div || 0)}</td><td class="r"><b>${U.money(c.income)}</b></td><td class="r">${U.pct(c.dy, 2)}</td><td class="r">${U.pct(c.yoc, 2)}</td>
        <td class="r">${c.magic ? `${c.magic}<br><small>${x.qty >= c.magic ? '✅' : `faltam ${c.magic - x.qty}`}</small>` : '—'}</td>
        <td class="actions"><a class="icon-btn" target="_blank" rel="noopener" href="https://statusinvest.com.br/fundos-imobiliarios/${encodeURIComponent(x.ticker.toLowerCase())}" title="Ver no Status Invest">↗</a><button class="icon-btn" data-act="buyFii" data-id="${x.id}" title="Registrar nova compra">🛒</button><button class="icon-btn" data-act="editFii" data-id="${x.id}">✏️</button></td></tr>`).join('')}
      </tbody></table></div>` : App.empty('🏢', 'Nenhum FII cadastrado', 'Adicione cada fundo com a quantidade de cotas, o preço médio pago e o último dividendo por cota. Ex.: MXRF11, HGLG11, KNRI11…', '<button class="btn primary" data-act="addFii">＋ Adicionar FII</button>')}
      ${!hasToken && rows.length ? '<div class="note mt">💡 Para atualizar cotação e dividendos automaticamente, crie um token grátis em <a href="https://brapi.dev" target="_blank" rel="noopener">brapi.dev</a> e cole em <a href="#/ajustes">Ajustes → Investimentos</a>. Sem token, você pode atualizar manualmente (consulte no Status Invest / Funds Explorer).</div>' : ''}
    </div>
    ${rows.length ? `<div class="grid g2 mt"><div class="card"><header><h3>💰 Renda mensal por fundo</h3></header><div class="chart-box"><canvas id="fii-inc"></canvas></div></div>
      <div class="card"><header><h3>🧩 Diversificação</h3></header><div class="chart-box"><canvas id="fii-div"></canvas></div></div></div>` : ''}`;
  };
  const mountFiis = () => {
    const rows = st().fiis.map((x) => ({ x, c: Inv.fii(x) })).sort((a, b) => b.c.income - a.c.income);
    if (!rows.length) return;
    App.chart(document.getElementById('fii-inc'), { type: 'bar', data: { labels: rows.map((r) => r.x.ticker), datasets: [{ label: 'R$/mês', data: rows.map((r) => U.round(r.c.income)), backgroundColor: rows.map((_, i) => PALETTE[i % 10]), borderRadius: 6 }] }, options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + U.moneyTxt(c.raw) } } } } });
    App.chart(document.getElementById('fii-div'), { type: 'doughnut', data: { labels: rows.map((r) => r.x.ticker), datasets: [{ data: rows.map((r) => U.round(r.c.value)), backgroundColor: rows.map((_, i) => PALETTE[i % 10]), borderWidth: 0 }] }, options: { cutout: '60%', plugins: { legend: { position: 'right' } } } });
  };

  views.rendafixa = () => {
    const s = st().settings;
    const rows = st().fixed.map((f) => ({ f, v: Inv.fixedValue(f) }));
    return `
    <div class="card"><header><h3>🏦 Renda fixa (CDB, LCI/LCA, Tesouro, caixinhas…)</h3><div class="row"><span class="chip">CDI ${U.pct(s.cdi, 2)} a.a.</span><span class="chip">IPCA ${U.pct(s.ipca, 2)}</span><a href="#/ajustes" class="btn sm ghost">alterar taxas</a><button class="btn primary" data-act="addFixed">＋ Aplicação</button></div></header>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Aplicação</th><th>Rentabilidade</th><th class="r">Aplicado</th><th class="r">Bruto hoje</th><th class="r">IR</th><th class="r">Líquido hoje</th><th class="r">Rende/mês</th><th>Vencimento</th><th></th></tr></thead><tbody>
      ${rows.map(({ f, v }) => {
        const atMat = f.maturity ? Inv.fixedValue(f, f.maturity) : null;
        return `<tr><td><b>${U.esc(f.name || f.type)}</b><br><small>${U.esc(f.institution || '')} · ${U.esc(f.type)} · desde ${U.dateBR(f.start)}</small></td>
        <td>${f.indexer === 'CDI' ? `${f.rate}% do CDI` : f.indexer === 'IPCA' ? `IPCA + ${f.rate}%` : f.indexer === 'POUP' ? 'Poupança' : `${f.rate}% a.a.`}<br><small>≈ ${U.pct(Inv.annualRate(f), 2)} a.a.${Inv.isExempt(f) ? ' · isento IR' : ''}</small></td>
        <td class="r">${U.money(f.amount)}</td><td class="r">${U.money(v.gross)}</td><td class="r">${v.taxRate ? `${v.taxRate}%<br><small>${U.money(v.tax)}</small>` : '<small>isento</small>'}</td>
        <td class="r"><b>${U.money(v.net)}</b><br><small class="delta good">+${U.money(v.net - f.amount)}</small></td><td class="r">${U.money(Inv.fixedMonthly(f))}</td>
        <td>${f.maturity ? `${U.dateBR(f.maturity)}<br><small>líquido ≈ ${U.money(atMat.net)}</small>` : '<small>liquidez diária</small>'}</td>
        <td class="actions"><button class="icon-btn" data-act="editFixed" data-id="${f.id}">✏️</button></td></tr>`; }).join('')}
      </tbody></table></div>` : App.empty('🏦', 'Nenhuma aplicação', 'Cadastre seu CDB do Nubank (ex.: 100% do CDI) com valor e data. O sistema estima o rendimento diário, o IR regressivo e o valor líquido.', '<button class="btn primary" data-act="addFixed">＋ Adicionar</button>')}
      <div class="note mt">Os valores são <b>estimativas</b> com base na taxa CDI/IPCA configurada. IR regressivo: até 180 dias 22,5% · até 360 20% · até 720 17,5% · acima 15%. Confira o valor exato no app do banco.</div>
    </div>`;
  };

  views.planejamento = () => App.Planner.view();

  views.proventos = () => {
    const list = st().dividends.slice().sort((a, b) => b.date.localeCompare(a.date));
    const t = Inv.totals();
    const yr = U.today().slice(0, 4);
    return `<div class="grid g3">
      <div class="card accent stat"><div class="lbl">Recebido em ${yr}</div><div class="val">${U.money(U.sum(list.filter((d) => d.date.startsWith(yr)), (d) => d.value))}</div><div class="sub">total histórico ${U.money(U.sum(list, (d) => d.value))}</div></div>
      <div class="card stat"><div class="lbl">Previsto este mês</div><div class="val">${U.money(t.fiiIncome)}</div><div class="sub">cotas × último dividendo</div></div>
      <div class="card stat"><div class="lbl">Ação rápida</div><button class="btn primary mt" data-act="logMonth">✅ Registrar proventos previstos de ${U.MON[new Date().getMonth()]}</button></div>
    </div>
    <div class="grid g2 mt"><div class="card"><header><h3>📊 Proventos por mês</h3></header><div class="chart-box"><canvas id="div-chart"></canvas></div></div>
    <div class="card"><header><h3>🧾 Histórico</h3><button class="btn sm" data-act="addDiv">＋ Manual</button></header>
      ${list.length ? `<div class="list" style="max-height:300px;overflow:auto">${list.map((d) => `<div class="li"><div class="ico">💵</div><div class="grow"><div class="t">${U.esc(d.ticker)}</div><div class="s">${U.dateBR(d.date)}</div></div><b>${U.money(d.value)}</b><button class="icon-btn" data-act="delDiv" data-id="${d.id}">✕</button></div>`).join('')}</div>` : '<p class="muted">Nenhum provento registrado.</p>'}</div></div>`;
  };
  const mountProv = () => {
    const months = Array.from({ length: 12 }, (_, i) => U.addMonthsYM(U.ym(), i - 11));
    const g = U.groupBy(st().dividends, (d) => d.date.slice(0, 7));
    App.chart(document.getElementById('div-chart'), { type: 'bar', data: { labels: months.map(U.ymShort), datasets: [{ label: 'Proventos', data: months.map((m) => U.round(U.sum(g[m] || [], (d) => d.value))), backgroundColor: '#22c55e', borderRadius: 6 }] }, options: { plugins: { legend: { display: false } } } });
  };

  /* ---------- modais ---------- */
  const fiiModal = (x = {}) => {
    const isNew = !x.id;
    App.modal({
      title: isNew ? 'Adicionar FII' : `Editar ${x.ticker}`,
      body: F.row(F.text('Ticker', 'ticker', x.ticker || '', 'required placeholder="MXRF11" style="text-transform:uppercase"'), F.text('Corretora', 'broker', x.broker || 'XP'), F.text('Segmento', 'segment', x.segment || '', 'placeholder="Papel, logística, shopping…"')) +
        F.row(F.number('Quantidade de cotas', 'qty', x.qty), F.number('Preço médio pago (R$)', 'avg', x.avg)) +
        F.row(F.number('Cotação atual (R$)', 'price', x.price), F.number('Último dividendo por cota (R$)', 'div', x.div, 'step="0.0001"')) +
        '<div class="note">💡 O último dividendo por cota aparece no Status Invest / Funds Explorer / app da XP (aba proventos). Ex.: MXRF11 ≈ R$ 0,10/cota.</div>',
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.fiis = s.fiis.filter((y) => y.id !== x.id); }) },
      onSubmit: (d) => {
        if (!d.ticker || !d.qty) { App.toast('Informe ticker e cotas.', 'error'); return false; }
        d.ticker = d.ticker.toUpperCase().trim();
        App.commit((s) => { if (isNew) s.fiis.push({ id: U.uid(), ...d, updatedAt: d.price ? U.today() : '' }); else Object.assign(s.fiis.find((y) => y.id === x.id), d); });
      },
    });
  };
  const buyModal = (x) => App.modal({
    title: `Nova compra de ${x.ticker}`,
    body: F.row(F.number('Cotas compradas', 'q', ''), F.number('Preço por cota (R$)', 'p', x.price || x.avg)) + '<p class="muted">O preço médio é recalculado automaticamente.</p>',
    onSubmit: (d) => { if (!d.q) return false; App.commit(() => { const tot = x.qty * x.avg + d.q * d.p; x.qty += d.q; x.avg = U.round(tot / x.qty, 4); }); App.toast(`Novo preço médio: ${U.moneyTxt(x.avg)}`); },
  });
  const fixedModal = (f = {}) => {
    const isNew = !f.id;
    App.modal({
      title: isNew ? 'Nova aplicação de renda fixa' : 'Editar aplicação',
      body: F.row(F.text('Nome', 'name', f.name || '', 'placeholder="Ex.: Caixinha reserva"'), F.text('Banco', 'institution', f.institution || 'Nubank')) +
        F.row(F.select('Tipo', 'type', ['CDB', 'LCI', 'LCA', 'Tesouro Selic', 'Tesouro IPCA+', 'Tesouro Prefixado', 'Poupança', 'CRI', 'CRA', 'Debênture', 'Outro'], f.type || 'CDB'), F.select('Indexador', 'indexer', [['CDI', '% do CDI'], ['PRE', 'Prefixado (% a.a.)'], ['IPCA', 'IPCA + %'], ['POUP', 'Poupança']], f.indexer || 'CDI'), F.number('Taxa', 'rate', f.rate ?? 100, 'step="0.01"')) +
        F.row(F.number('Valor aplicado (R$)', 'amount', f.amount), F.date('Data da aplicação', 'start', f.start || U.today()), F.date('Vencimento (opcional)', 'maturity', f.maturity || '')) +
        F.check('Isento de IR', 'exempt', f.exempt),
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.fixed = s.fixed.filter((y) => y.id !== f.id); }) },
      onSubmit: (d) => { if (!d.amount) return false; App.commit((s) => { if (isNew) s.fixed.push({ id: U.uid(), ...d }); else Object.assign(s.fixed.find((y) => y.id === f.id), d); }); },
    });
  };
  const otherModal = (a = {}) => {
    const isNew = !a.id;
    App.modal({
      title: isNew ? 'Outro saldo / ativo' : 'Editar',
      body: F.row(F.text('Nome', 'name', a.name || '', 'required placeholder="Ex.: Conta Nubank"'), F.text('Instituição', 'institution', a.institution || '')) +
        F.row(F.select('Tipo', 'kind', [['conta', 'Conta corrente'], ['reserva', 'Reserva de emergência'], ['acoes', 'Ações'], ['cripto', 'Cripto'], ['outro', 'Outro']], a.kind || 'conta'), F.number('Valor atual (R$)', 'value', a.value)),
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.otherAssets = s.otherAssets.filter((y) => y.id !== a.id); }) },
      onSubmit: (d) => App.commit((s) => { if (isNew) s.otherAssets.push({ id: U.uid(), ...d }); else Object.assign(s.otherAssets.find((y) => y.id === a.id), d); }),
    });
  };

  /* ---------- cotações (brapi.dev) ---------- */
  async function refreshQuotes() {
    const token = st().settings.brapiToken;
    if (!token) { App.toast('Configure o token da brapi.dev em Ajustes → Investimentos.', 'error'); return App.go('ajustes'); }
    let ok = 0;
    for (const x of st().fiis) {
      try {
        const r = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(x.ticker)}?dividends=true&token=${encodeURIComponent(token)}`);
        const j = await r.json();
        const q = j.results && j.results[0]; if (!q) continue;
        if (q.regularMarketPrice) x.price = q.regularMarketPrice;
        const cd = (q.dividendsData && q.dividendsData.cashDividends) || [];
        if (cd.length) { cd.sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate))); x.div = cd[0].rate; x.lastDivDate = String(cd[0].paymentDate).slice(0, 10); }
        x.updatedAt = U.today(); ok++;
      } catch (e) { console.warn(e); }
    }
    App.save(); App.rerender();
    App.toast(ok ? `${ok} cotação(ões) atualizada(s)` : 'Não consegui atualizar. Verifique o token/conexão.', ok ? 'ok' : 'error');
  }

  App.views.investimentos = {
    render(r) {
      const sub = views[r.sub] ? r.sub : 'carteira'; this._sub = sub;
      return `<div class="page-head"><div><h1>📈 Investimentos</h1><p>FIIs, renda fixa e patrimônio — com dividendos simulados mês a mês.</p></div></div>
        ${App.subtabs('investimentos', [['carteira', 'Carteira'], ['fiis', 'FIIs'], ['rendafixa', 'Renda fixa'], ['planejamento', '🧭 Planejamento'], ['proventos', 'Proventos']], sub)}${views[sub]()}`;
    },
    mount() {
      if (this._sub === 'carteira') mountCarteira();
      if (this._sub === 'fiis') mountFiis();
      if (this._sub === 'proventos') mountProv();
      if (this._sub === 'planejamento') App.Planner.mount();
    },
    actions: {
      ...App.Planner.actions,
      addFii: () => fiiModal(), editFii: (t) => fiiModal(st().fiis.find((x) => x.id === t.dataset.id)), buyFii: (t) => buyModal(st().fiis.find((x) => x.id === t.dataset.id)),
      addFixed: () => fixedModal(), editFixed: (t) => fixedModal(st().fixed.find((x) => x.id === t.dataset.id)),
      addOther: () => otherModal(), editOther: (t) => otherModal(st().otherAssets.find((x) => x.id === t.dataset.id)),
      refreshQuotes,
      logMonth: () => {
        const ym = U.ym();
        const items = st().fiis.filter((x) => x.div && x.qty);
        if (!items.length) return App.toast('Cadastre FIIs com o último dividendo.', 'error');
        App.commit((s) => items.forEach((x) => { if (!s.dividends.find((d) => d.ticker === x.ticker && d.date.startsWith(ym))) s.dividends.push({ id: U.uid(), date: U.today(), ticker: x.ticker, value: U.round(x.qty * x.div) }); }));
        App.toast('Proventos do mês registrados');
      },
      addDiv: () => App.modal({ title: 'Registrar provento', body: F.row(F.text('Ativo', 'ticker', ''), F.date('Data', 'date', U.today()), F.number('Valor (R$)', 'value', '')), onSubmit: (d) => App.commit((s) => s.dividends.push({ id: U.uid(), ...d, ticker: d.ticker.toUpperCase() })) }),
      delDiv: (t) => App.commit((s) => { s.dividends = s.dividends.filter((d) => d.id !== t.dataset.id); }),
    },
    quick: { fii: () => fiiModal() },
  };
})(window.App);
