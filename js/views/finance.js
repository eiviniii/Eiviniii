/* ==========================================================
   FINANÇAS — parcelas/dívidas, gastos, relatórios, orçamento, cartões
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;

  /* ---------- cálculos compartilhados ---------- */
  const Fin = (App.Fin = {});
  Fin.cat = (id) => st().categories.find((c) => c.id === id) || { id: 'outros', name: 'Outros', icon: '📦', color: '#64748b' };
  Fin.card = (id) => st().cards.find((c) => c.id === id);
  Fin.instIndex = (i, ym) => { const k = U.diffMonths(i.startYM, ym) + 1; return k >= 1 && k <= i.count ? k : 0; };
  Fin.instEnd = (i) => U.addMonthsYM(i.startYM, i.count - 1);
  Fin.instStatus = (i, ym = U.ym()) => {
    const k = U.diffMonths(i.startYM, ym) + 1;
    const paid = i.settled ? i.count : U.clamp(k - 1, 0, i.count); // parcelas anteriores ao mês atual
    const current = k >= 1 && k <= i.count && !i.settled ? k : 0;
    const remaining = i.settled ? 0 : U.clamp(i.count - Math.max(k - 1, 0), 0, i.count); // inclui a do mês
    return { k, paid, current, remaining, remainingValue: remaining * i.parcel, done: i.settled || k > i.count, notStarted: k < 1, end: Fin.instEnd(i) };
  };
  Fin.instMonth = (ym) => st().installments.filter((i) => !i.settled && Fin.instIndex(i, ym));
  Fin.instMonthTotal = (ym, cardId) => U.sum(Fin.instMonth(ym).filter((i) => !cardId || i.cardId === cardId), (i) => i.parcel);
  Fin.debtTotal = () => U.sum(st().installments, (i) => Fin.instStatus(i).remainingValue);
  Fin.freeMonth = () => { const act = st().installments.filter((i) => !Fin.instStatus(i).done); if (!act.length) return null; return act.map(Fin.instEnd).sort().pop(); };
  Fin.tx = (from, to) => st().transactions.filter((t) => (!from || t.date >= from) && (!to || t.date <= to));
  Fin.monthRange = (ym) => { const [y, m] = ym.split('-').map(Number); return [`${ym}-01`, U.iso(new Date(y, m, 0))]; };
  Fin.monthExpenses = (ym) => U.sum(Fin.tx(...Fin.monthRange(ym)).filter((t) => t.kind !== 'income' && !Fin.isTransfer(t)), (t) => t.value);
  Fin.monthIncome = (ym) => U.sum(Fin.tx(...Fin.monthRange(ym)).filter((t) => t.kind === 'income'), (t) => t.value);
  Fin.isTransfer = (t) => t.categoryId === 'investimentos' || t.categoryId === 'transferencias' || t.categoryId === 'metas';
  Fin.byCategory = (rows) => {
    const g = U.groupBy(rows.filter((t) => t.kind !== 'income'), (t) => t.categoryId);
    return Object.entries(g).map(([id, arr]) => ({ cat: Fin.cat(id), total: U.sum(arr, (t) => t.value), n: arr.length })).sort((a, b) => b.total - a.total);
  };
  Fin.fixedBills = (ym) => (App.Agenda ? App.Agenda.occurrences(...Fin.monthRange(ym)).filter((o) => o.type === 'conta') : []);

  /* ---------- estado da tela ---------- */
  const S = { ym: U.ym(), period: 'mes', ref: U.today(), from: '', to: '', cat: '', q: '', kind: 'expense', group: 'dia', limit: 150, acc: '' };

  const filtered = () => {
    let from = null, to = null;
    if (S.period === 'dia') from = to = S.ref;
    else if (S.period === 'semana') { from = U.weekStart(S.ref); to = U.addDays(from, 6); }
    else if (S.period === 'mes') [from, to] = Fin.monthRange(S.ref.slice(0, 7));
    else if (S.period === 'ano') { from = S.ref.slice(0, 4) + '-01-01'; to = S.ref.slice(0, 4) + '-12-31'; }
    else if (S.period === 'custom') { from = S.from || null; to = S.to || null; }
    const q = U.norm(S.q);
    const rows = Fin.tx(from, to).filter((t) => (!S.cat || t.categoryId === S.cat) && (S.kind === 'all' || (S.kind === 'income' ? t.kind === 'income' : t.kind !== 'income')) && (!S.acc || t.account === S.acc) && (!q || U.norm(t.desc + ' ' + (t.notes || '') + ' ' + t.value).includes(q)));
    rows.sort((a, b) => b.date.localeCompare(a.date) || b.value - a.value);
    return { rows, from, to };
  };
  const periodLabel = (from, to) => {
    if (S.period === 'tudo') return 'Todo o período';
    if (S.period === 'dia') return U.dateNice(S.ref);
    if (S.period === 'mes') return U.ymLabel(S.ref.slice(0, 7));
    if (S.period === 'ano') return S.ref.slice(0, 4);
    return `${U.dateBR(from)} a ${U.dateBR(to)}`;
  };
  const shiftRef = (dir) => {
    if (S.period === 'dia') S.ref = U.addDays(S.ref, dir);
    else if (S.period === 'semana') S.ref = U.addDays(S.ref, 7 * dir);
    else if (S.period === 'mes') S.ref = U.addMonthsYM(S.ref.slice(0, 7), dir) + '-01';
    else if (S.period === 'ano') S.ref = `${+S.ref.slice(0, 4) + dir}-01-01`;
  };

  const catOptions = () => st().categories.map((c) => [c.id, `${c.icon} ${c.name}`]);
  const catSelect = (name, val, attrs = '') => `<select name="${name}" ${attrs}>${st().categories.map((c) => `<option value="${c.id}" ${c.id === val ? 'selected' : ''}>${c.icon} ${U.esc(c.name)}</option>`).join('')}</select>`;
  const accounts = () => [...new Set(st().transactions.map((t) => t.account).filter(Boolean))];

  /* ---------- telas ---------- */
  const views = {};

  views.visao = () => {
    const ym = S.ym;
    const exp = Fin.monthExpenses(ym), inc = Fin.monthIncome(ym), prev = Fin.monthExpenses(U.addMonthsYM(ym, -1));
    const inst = Fin.instMonthTotal(ym);
    const bills = Fin.fixedBills(ym);
    const billsTotal = U.sum(bills, (b) => b.value);
    const cats = Fin.byCategory(Fin.tx(...Fin.monthRange(ym)).filter((t) => !Fin.isTransfer(t)));
    const free = Fin.freeMonth();
    const diff = prev ? ((exp - prev) / prev) * 100 : 0;
    const top = Fin.tx(...Fin.monthRange(ym)).filter((t) => t.kind !== 'income' && !Fin.isTransfer(t)).sort((a, b) => b.value - a.value).slice(0, 6);
    const budgets = st().categories.filter((c) => c.budget > 0);
    const ins = ym === U.ym() ? App.Money.insights() : [];
    const maxRD = Math.max(exp, inc, 1);
    return `
    <div class="grid g3" style="margin-bottom:16px">
      ${App.Money.accCard()}
      <div class="card"><header><h3>⚖️ Receita × despesa</h3><small class="muted" style="text-transform:capitalize">${U.ymLabel(ym)}</small></header>
        <div class="rd"><div class="rd-val ${inc - exp >= 0 ? 'delta good' : 'delta badd'}">${U.money(Math.abs(inc - exp))}</div><div class="muted">${inc - exp >= 0 ? 'sobrou no mês' : inc ? `${U.fmt(((exp - inc) / inc) * 100, 2)}% acima da receita` : 'de despesas'}</div>
          <div class="rd-bars"><i style="height:${(inc / maxRD) * 100}%" class="in"></i><i style="height:${(exp / maxRD) * 100}%" class="out"></i></div>
          <div class="list"><div class="li"><span class="dot" style="background:var(--ok)"></span><div class="grow">Receita</div><b>${U.money(inc)}</b></div><div class="li"><span class="dot" style="background:var(--bad)"></span><div class="grow">Despesas</div><b>${U.money(exp)}</b></div></div></div></div>
      <div class="card"><header><h3>🗓️ Gastos por dia</h3><small class="muted">${U.money(exp)}</small></header>${App.Money.heatmap(ym)}</div>
    </div>
    ${ins.length ? `<div class="card" style="margin-bottom:16px"><header><h3>💡 Oportunidades e alertas</h3><small class="muted">análise automática dos seus gastos</small></header><div class="insights">${ins.map((i) => `<div class="insight ${i.lvl}"><span class="ii">${i.ico}</span><div><b>${U.esc(i.t)}</b><small>${U.esc(i.s)}</small></div></div>`).join('')}</div></div>` : ''}
    <div class="row between" style="margin-bottom:14px">
      <div class="row"><button class="btn sm" data-act="ymPrev">‹</button><h2 style="min-width:170px;text-align:center;text-transform:capitalize">${U.ymLabel(ym)}</h2><button class="btn sm" data-act="ymNext">›</button>
      ${ym !== U.ym() ? '<button class="btn sm ghost" data-act="ymNow">Hoje</button>' : ''}</div>
      <div class="row"><button class="btn" data-act="addTx">＋ Gasto</button><button class="btn" data-act="addInst">＋ Parcelamento</button><a class="btn primary" href="#/financas/importar">⬆ Subir relatório</a></div>
    </div>
    <div class="grid g4">
      <div class="card accent stat"><div class="lbl">Gastos do mês</div><div class="val">${U.money(exp)}</div><div class="sub">${prev ? `<b>${diff > 0 ? '▲' : '▼'} ${U.pct(Math.abs(diff), 0)}</b> vs mês anterior` : 'sem dados do mês anterior'}</div></div>
      <div class="card stat"><div class="lbl">Receitas</div><div class="val">${U.money(inc)}</div><div class="sub">Saldo: <b class="${inc - exp >= 0 ? 'delta down' : 'delta up'}">${U.money(inc - exp)}</b></div></div>
      <div class="card stat"><div class="lbl">Parcelas do mês</div><div class="val">${U.money(inst)}</div><div class="sub">${Fin.instMonth(ym).length} parcelamento(s) ativos</div></div>
      <div class="card stat"><div class="lbl">Dívida restante</div><div class="val">${U.money(Fin.debtTotal())}</div><div class="sub">${free ? `Livre das parcelas em <b>${U.ymLabel(free)}</b>` : 'Nenhuma parcela em aberto 🎉'}</div></div>
    </div>
    <div class="grid g3 mt">
      <div class="card"><header><h3>🍩 Onde mais gastei</h3></header>
        ${cats.length ? `<div class="chart-box"><canvas id="fin-cat"></canvas></div>` : App.empty('🧾', 'Sem gastos neste mês', 'Suba o relatório do mês ou lance gastos manualmente.')}
      </div>
      <div class="card span2"><header><h3>📊 Últimos 12 meses</h3><small>gastos × receitas</small></header><div class="chart-box"><canvas id="fin-12"></canvas></div></div>
    </div>
    <div class="grid g3 mt">
      <div class="card"><header><h3>🏷️ Ranking de categorias</h3></header>
        <div class="list">${cats.slice(0, 8).map((c) => `<div class="li"><div class="ico" style="background:${App.alpha(c.cat.color, .18)}">${c.cat.icon}</div><div class="grow"><div class="t">${U.esc(c.cat.name)}</div><div class="bar"><i style="width:${(c.total / cats[0].total) * 100}%;background:${c.cat.color}"></i></div></div><div class="r"><b>${U.money(c.total)}</b><div class="s">${U.pct((c.total / exp) * 100 || 0, 0)}</div></div></div>`).join('') || '<p class="muted">—</p>'}</div>
      </div>
      <div class="card"><header><h3>💸 Maiores gastos</h3><a href="#/financas/gastos" class="btn sm ghost">ver todos</a></header>
        <div class="list">${top.map((t) => `<div class="li"><div class="ico">${Fin.cat(t.categoryId).icon}</div><div class="grow"><div class="t">${U.esc(t.desc)}</div><div class="s">${U.dateNice(t.date)}</div></div><b>${U.money(t.value)}</b></div>`).join('') || '<p class="muted">—</p>'}</div>
      </div>
      <div class="card"><header><h3>🎯 Orçamento</h3><a href="#/financas/categorias" class="btn sm ghost">definir</a></header>
        ${budgets.length ? budgets.map((c) => { const spent = (cats.find((x) => x.cat.id === c.id) || {}).total || 0; const p = (spent / c.budget) * 100; return `<div style="margin-bottom:12px"><div class="row between"><span>${c.icon} ${U.esc(c.name)}</span><small>${U.money(spent)} / ${U.money(c.budget)}</small></div><div class="bar ${p > 100 ? 'over' : ''}"><i style="width:${Math.min(p, 100)}%"></i></div></div>`; }).join('') : App.empty('🎯', 'Sem limites definidos', 'Defina um limite mensal por categoria e acompanhe aqui.')}
      </div>
    </div>
    <div class="grid g2 mt">
      <div class="card"><header><h3>📆 Parcelas — próximos 12 meses</h3><small>quanto já está comprometido</small></header><div class="chart-box"><canvas id="fin-proj"></canvas></div></div>
      <div class="card"><header><h3>🧾 Contas fixas do mês</h3><a href="#/agenda" class="btn sm ghost">agenda</a></header>
        ${bills.length ? `<div class="list">${bills.map((b) => `<div class="li"><div class="ico">${b.paid ? '✅' : '🧾'}</div><div class="grow"><div class="t">${U.esc(b.title)}</div><div class="s">vence ${U.dateNice(b.date)}</div></div><b>${U.money(b.value)}</b></div>`).join('')}</div><div class="row between mt"><b>Total</b><b>${U.money(billsTotal)}</b></div>` : App.empty('🧾', 'Nenhuma conta fixa', 'Cadastre contas a pagar (luz, internet, aluguel…) na Agenda com repetição mensal.')}
      </div>
    </div>`;
  };
  const mountVisao = () => {
    const ym = S.ym;
    const cats = Fin.byCategory(Fin.tx(...Fin.monthRange(ym)).filter((t) => !Fin.isTransfer(t)));
    if (cats.length) App.chart(document.getElementById('fin-cat'), { type: 'doughnut', data: { labels: cats.map((c) => c.cat.name), datasets: [{ data: cats.map((c) => U.round(c.total)), backgroundColor: cats.map((c) => c.cat.color), borderWidth: 0 }] }, options: { cutout: '68%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, usePointStyle: true } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${U.moneyTxt(c.raw)}` } } } } });
    const months = Array.from({ length: 12 }, (_, i) => U.addMonthsYM(ym, i - 11));
    App.chart(document.getElementById('fin-12'), { type: 'bar', data: { labels: months.map(U.ymShort), datasets: [
      { label: 'Gastos', data: months.map(Fin.monthExpenses), backgroundColor: App.cssVar('--accent'), borderRadius: 6 },
      { label: 'Receitas', data: months.map(Fin.monthIncome), backgroundColor: App.alpha('#22c55e', .7), borderRadius: 6 }] }, options: { scales: { y: { ticks: { callback: (v) => 'R$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) } } }, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${U.moneyTxt(c.raw)}` } } } } });
    const next = Array.from({ length: 12 }, (_, i) => U.addMonthsYM(U.ym(), i));
    const cards = [...st().cards, { id: '', name: 'Outros', color: '#94a3b8' }];
    App.chart(document.getElementById('fin-proj'), { type: 'bar', data: { labels: next.map(U.ymShort), datasets: cards.map((c) => ({ label: c.name, backgroundColor: c.color, borderRadius: 4, data: next.map((m) => U.sum(Fin.instMonth(m).filter((i) => (i.cardId || '') === c.id || (!c.id && !Fin.card(i.cardId))), (i) => i.parcel)) })).filter((d) => d.data.some((x) => x > 0)) }, options: { scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${U.moneyTxt(c.raw)}` } } } } });
  };

  views.parcelas = () => {
    const ym = U.ym();
    const list = st().installments.slice().sort((a, b) => Fin.instStatus(a).done - Fin.instStatus(b).done || Fin.instEnd(a).localeCompare(Fin.instEnd(b)));
    const active = list.filter((i) => !Fin.instStatus(i).done);
    const done = list.filter((i) => Fin.instStatus(i).done);
    const row = (i) => {
      const s = Fin.instStatus(i, ym); const card = Fin.card(i.cardId); const c = Fin.cat(i.categoryId);
      const pct = (s.paid / i.count) * 100;
      return `<div class="li">
        <div class="ico" style="background:${App.alpha(card ? card.color : c.color, .2)}">${c.icon}</div>
        <div class="grow"><div class="t">${U.esc(i.desc)} ${card ? `<span class="chip" style="color:${card.color}">💳 ${U.esc(card.name)}</span>` : ''} <span class="chip">${({ cartao: 'Cartão', emprestimo: 'Empréstimo', financiamento: 'Financiamento', outro: 'Outro' })[i.type] || 'Cartão'}</span></div>
          <div class="s">${s.done ? 'Quitado ✅' : s.notStarted ? `Começa em ${U.ymLabel(i.startYM)}` : `Parcela <b>${s.current}/${i.count}</b> este mês · faltam <b>${s.remaining}</b> (incluindo a deste mês)`} · termina em ${U.ymLabel(s.end)}</div>
          <div class="bar" style="margin-top:6px"><i style="width:${pct}%"></i></div></div>
        <div class="r" style="text-align:right"><b>${U.money(i.parcel)}</b><div class="s">/mês · resta ${U.money(s.remainingValue)}</div></div>
        <button class="icon-btn" data-act="editInst" data-id="${i.id}">✏️</button>
      </div>`;
    };
    const nextYM = U.addMonthsYM(ym, 1);
    return `
    <div class="grid g4">
      <div class="card accent stat"><div class="lbl">Parcela deste mês</div><div class="val">${U.money(Fin.instMonthTotal(ym))}</div><div class="sub">${U.ymLabel(ym)}</div></div>
      <div class="card stat"><div class="lbl">Próximo mês</div><div class="val">${U.money(Fin.instMonthTotal(nextYM))}</div><div class="sub">${U.ymLabel(nextYM)}</div></div>
      <div class="card stat"><div class="lbl">Total ainda a pagar</div><div class="val">${U.money(Fin.debtTotal())}</div><div class="sub">${active.length} em aberto</div></div>
      <div class="card stat"><div class="lbl">Livre em</div><div class="val" style="text-transform:capitalize">${Fin.freeMonth() ? U.ymShort(Fin.freeMonth()) : '—'}</div><div class="sub">última parcela</div></div>
    </div>
    <div class="card mt"><header><h3>🔁 Parcelamentos e dívidas em aberto</h3><button class="btn primary" data-act="addInst">＋ Novo parcelamento</button></header>
      ${active.length ? `<div class="list">${active.map(row).join('')}</div>` : App.empty('🎉', 'Nada parcelado', 'Adicione compras parceladas no cartão, empréstimos ou financiamentos. O sistema calcula a parcela do mês e quanto falta.', '<button class="btn primary" data-act="addInst">＋ Adicionar</button>')}
    </div>
    <div class="card mt"><header><h3>🗓️ Calendário de parcelas</h3><small>soma por mês até quitar tudo</small></header><div class="table-wrap">${instTable()}</div></div>
    ${done.length ? `<div class="card mt"><header><h3>✅ Quitados</h3></header><div class="list">${done.map(row).join('')}</div></div>` : ''}`;
  };
  const instTable = () => {
    const act = st().installments.filter((i) => !Fin.instStatus(i).done);
    if (!act.length) return '<p class="muted">—</p>';
    const end = Fin.freeMonth();
    const n = Math.min(Math.max(U.diffMonths(U.ym(), end) + 1, 1), 36);
    const months = Array.from({ length: n }, (_, k) => U.addMonthsYM(U.ym(), k));
    return `<table><thead><tr><th>Compra</th>${months.map((m) => `<th class="r">${U.ymShort(m)}</th>`).join('')}</tr></thead><tbody>
      ${act.map((i) => `<tr><td>${U.esc(i.desc)}</td>${months.map((m) => { const k = Fin.instIndex(i, m); return `<td class="r">${k ? `<span class="money">${U.fmt(i.parcel, 2)}</span><br><small>${k}/${i.count}</small>` : ''}</td>`; }).join('')}</tr>`).join('')}
      <tr><td><b>Total do mês</b></td>${months.map((m) => `<td class="r"><b>${U.money(Fin.instMonthTotal(m))}</b></td>`).join('')}</tr></tbody></table>`;
  };

  views.gastos = () => {
    const { rows, from, to } = filtered();
    const total = U.sum(rows, (t) => t.value);
    const days = from && to ? U.diffDays(from, to) + 1 : null;
    const cats = Fin.byCategory(rows);
    const accs = accounts();
    const pbtn = (id, l) => `<button type="button" class="${S.period === id ? 'on' : ''}" data-act="period" data-p="${id}">${l}</button>`;
    const gbtn = (id, l) => `<button type="button" class="${S.group === id ? 'on' : ''}" data-act="group" data-g="${id}">${l}</button>`;
    return `
    <div class="card">
      <div class="filters">
        <div class="seg">${pbtn('dia', 'Dia')}${pbtn('semana', 'Semana')}${pbtn('mes', 'Mês')}${pbtn('ano', 'Ano')}${pbtn('tudo', 'Tudo')}${pbtn('custom', 'Período')}</div>
        ${['dia', 'semana', 'mes', 'ano'].includes(S.period) ? `<button class="btn sm" data-act="refPrev">‹</button><b style="text-transform:capitalize;min-width:120px;text-align:center">${periodLabel(from, to)}</b><button class="btn sm" data-act="refNext">›</button><input type="date" value="${S.ref}" data-change="ref" style="width:auto">` : ''}
        ${S.period === 'custom' ? `<input type="date" value="${S.from}" data-change="from"> até <input type="date" value="${S.to}" data-change="to">` : ''}
      </div>
      <div class="filters">
        <input placeholder="🔎 Procurar gasto (nome, valor, nota)…" value="${U.esc(S.q)}" data-input="q" style="flex:1;min-width:200px">
        <select data-change="cat"><option value="">Todas categorias</option>${catOptions().map(([v, t]) => `<option value="${v}" ${S.cat === v ? 'selected' : ''}>${U.esc(t)}</option>`).join('')}</select>
        <select data-change="kind"><option value="expense" ${S.kind === 'expense' ? 'selected' : ''}>Despesas</option><option value="income" ${S.kind === 'income' ? 'selected' : ''}>Receitas</option><option value="all" ${S.kind === 'all' ? 'selected' : ''}>Tudo</option></select>
        ${accs.length ? `<select data-change="acc"><option value="">Todas as contas</option>${accs.map((a) => `<option ${S.acc === a ? 'selected' : ''}>${U.esc(a)}</option>`).join('')}</select>` : ''}
        <button class="btn primary" data-act="addTx">＋ Lançar</button>
      </div>
    </div>
    <div class="grid g4 mt">
      <div class="card accent stat"><div class="lbl">Total no período</div><div class="val">${U.money(total)}</div><div class="sub">${rows.length} lançamento(s)</div></div>
      <div class="card stat"><div class="lbl">Média por dia</div><div class="val">${days ? U.money(total / days) : '—'}</div><div class="sub">${days ? days + ' dias' : ''}</div></div>
      <div class="card stat"><div class="lbl">Maior categoria</div><div class="val" style="font-size:1.2rem">${cats[0] ? cats[0].cat.icon + ' ' + U.esc(cats[0].cat.name) : '—'}</div><div class="sub">${cats[0] ? U.money(cats[0].total) : ''}</div></div>
      <div class="card stat"><div class="lbl">Ticket médio</div><div class="val">${rows.length ? U.money(total / rows.length) : '—'}</div><div class="sub">por lançamento</div></div>
    </div>
    <div class="grid g3 mt">
      <div class="card span2"><header><h3>📈 Evolução</h3><div class="seg">${gbtn('dia', 'Dia')}${gbtn('semana', 'Semana')}${gbtn('mes', 'Mês')}${gbtn('ano', 'Ano')}</div></header><div class="chart-box"><canvas id="tx-line"></canvas></div></div>
      <div class="card"><header><h3>🏷️ Por categoria</h3></header><div class="chart-box"><canvas id="tx-cat"></canvas></div></div>
    </div>
    <div class="card mt"><header><h3>🧾 Lançamentos</h3><small>Mude a categoria e o sistema aprende para os próximos relatórios</small></header>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th class="r">Valor</th><th></th></tr></thead><tbody>
      ${rows.slice(0, S.limit).map((t) => `<tr><td>${U.dateBR(t.date)}</td><td>${U.esc(t.desc)}${t.notes ? `<br><small>${U.esc(t.notes)}</small>` : ''}</td>
        <td>${catSelect('c', t.categoryId, `data-change="txCat" data-id="${t.id}"`)}</td><td><small>${U.esc(t.account || '')}</small></td>
        <td class="r"><b style="color:${t.kind === 'income' ? 'var(--ok)' : 'inherit'}">${t.kind === 'income' ? '+' : ''}${U.money(t.value)}</b></td>
        <td class="actions"><button class="icon-btn" data-act="editTx" data-id="${t.id}">✏️</button></td></tr>`).join('')}
      </tbody></table></div>${rows.length > S.limit ? `<div class="row" style="justify-content:center;margin-top:12px"><button class="btn" data-act="more">Mostrar mais (${rows.length - S.limit})</button></div>` : ''}`
      : App.empty('🔍', 'Nada encontrado', 'Ajuste os filtros ou suba o relatório do mês.', '<a class="btn primary" href="#/financas/importar">⬆ Subir relatório</a>')}
    </div>`;
  };
  const groupKey = (iso) => S.group === 'dia' ? iso : S.group === 'semana' ? U.weekStart(iso) : S.group === 'mes' ? iso.slice(0, 7) : iso.slice(0, 4);
  const groupLbl = (k) => S.group === 'dia' ? U.dateBR(k).slice(0, 5) : S.group === 'semana' ? 'sem ' + U.dateBR(k).slice(0, 5) : S.group === 'mes' ? U.ymShort(k) : k;
  const mountGastos = () => {
    const { rows } = filtered();
    const g = U.groupBy(rows, (t) => groupKey(t.date));
    const keys = Object.keys(g).sort();
    App.chart(document.getElementById('tx-line'), { type: 'bar', data: { labels: keys.map(groupLbl), datasets: [{ label: 'Total', data: keys.map((k) => U.round(U.sum(g[k], (t) => t.value))), backgroundColor: App.alpha(App.cssVar('--accent'), .8), borderRadius: 6 }] }, options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + U.moneyTxt(c.raw) } } } } });
    const cats = Fin.byCategory(rows);
    App.chart(document.getElementById('tx-cat'), { type: 'doughnut', data: { labels: cats.map((c) => c.cat.name), datasets: [{ data: cats.map((c) => U.round(c.total)), backgroundColor: cats.map((c) => c.cat.color), borderWidth: 0 }] }, options: { cutout: '65%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${U.moneyTxt(c.raw)}` } } } } });
  };

  views.importar = () => `
    <div class="grid g2">
      <div class="card"><header><h3>⬆ Subir relatório do mês</h3></header>
        <div class="note">Aceita <b>CSV</b> (Nubank, Inter, C6…), <b>OFX</b> (extrato bancário), <b>Excel</b> e <b>PDF</b> de fatura. É só subir: o sistema <b>descobre sozinho de qual fatura é</b> (vencimento/fechamento no próprio PDF), coloca <b>cada compra no mês em que foi feita</b>, <b>categoriza automaticamente</b>, detecta <b>compras parceladas</b> (ex.: “Parcela 3/10”) e ignora duplicados.</div>
        <form data-submit="import">
          ${F.row(F.text('Conta / cartão', 'account', '', 'placeholder="Ex.: XP cartão" list="acc-list"'))}
          <details style="margin-bottom:12px"><summary class="muted"><small>Avançado: forçar o mês da fatura (normalmente é detectado sozinho)</small></summary><div class="frow mt">${F.month('Mês da fatura (vazio = automático)', 'ym', '')}</div></details>
          <datalist id="acc-list">${[...accounts(), ...st().cards.map((c) => c.name)].map((a) => `<option value="${U.esc(a)}">`).join('')}</datalist>
          ${(st().accounts || []).length ? F.row(F.select('Descontar do saldo da conta', 'accountId', [['', 'Não — é fatura de cartão'], ...st().accounts.map((a) => [a.id, a.name + ' (extrato)'])], '')) : ''}
          ${st().cards.length ? F.row(F.select('Vincular parcelas ao cartão', 'cardId', [['', '— nenhum —'], ...st().cards.map((c) => [c.id, c.name])], '')) : ''}
          <label class="drop" id="imp-drop"><input type="file" name="files" multiple accept=".csv,.ofx,.xlsx,.xls,.pdf,.txt"><b>Arraste os arquivos aqui ou toque para escolher</b>pode enviar vários de uma vez</label>
          <div class="row mt"><button class="btn primary block">Ler arquivos</button></div>
        </form>
      </div>
      <div class="card"><header><h3>🗂️ Relatórios enviados</h3></header>
        ${st().reports.length ? `<div class="list">${st().reports.slice().reverse().map((r) => `<div class="li"><div class="ico">📄</div><div class="grow"><div class="t">${U.esc(r.fileName)}</div><div class="s">${U.ymLabel(r.ym)} · ${r.count} lançamentos · ${U.money(r.total)} · ${U.esc(r.account || '')}</div></div>
          ${r.fileId ? `<button class="icon-btn" data-act="openFile" data-id="${r.fileId}" title="abrir">👁️</button>` : ''}<button class="icon-btn" data-act="delReport" data-id="${r.id}" title="excluir relatório e lançamentos">🗑️</button></div>`).join('')}</div>`
        : App.empty('📂', 'Nenhum relatório ainda', 'No fim de cada mês, exporte a fatura/extrato do seu banco e suba aqui.')}
        <div class="note mt"><b>Dica Nubank:</b> app → Cartão → Faturas → “Exportar fatura” (CSV). Conta: Extrato → “Exportar extrato” (CSV/OFX).</div>
      </div>
    </div>`;

  views.categorias = () => {
    const ym = U.ym();
    const cats = Fin.byCategory(Fin.tx(...Fin.monthRange(ym)));
    return `<div class="card"><header><h3>🏷️ Categorias & orçamento mensal</h3><button class="btn primary" data-act="addCat">＋ Categoria</button></header>
      <p class="muted" style="margin-top:-6px">As palavras‑chave definem a categorização automática. Quando você corrige uma categoria num lançamento, o sistema memoriza aquele estabelecimento.</p>
      <div class="table-wrap"><table><thead><tr><th></th><th>Categoria</th><th>Palavras-chave</th><th class="r">Gasto (${U.MON[+ym.slice(5) - 1]})</th><th class="r">Limite</th><th></th></tr></thead><tbody>
      ${st().categories.map((c) => { const sp = (cats.find((x) => x.cat.id === c.id) || {}).total || 0; return `<tr><td><span class="ico" style="background:${App.alpha(c.color, .2)}">${c.icon}</span></td><td><b>${U.esc(c.name)}</b></td><td><small>${U.esc((c.keywords || []).slice(0, 8).join(', '))}${(c.keywords || []).length > 8 ? '…' : ''}</small></td>
        <td class="r">${U.money(sp)}</td><td class="r">${c.budget ? U.money(c.budget) : '<small>—</small>'}${c.budget ? `<div class="bar ${sp > c.budget ? 'over' : ''}" style="margin-top:4px"><i style="width:${Math.min(100, (sp / c.budget) * 100)}%"></i></div>` : ''}</td>
        <td class="actions"><button class="icon-btn" data-act="editCat" data-id="${c.id}">✏️</button></td></tr>`; }).join('')}
      </tbody></table></div>
      ${Object.keys(st().merchantMap).length ? `<details class="mt"><summary>🧠 Estabelecimentos memorizados (${Object.keys(st().merchantMap).length})</summary><div class="list">${Object.entries(st().merchantMap).map(([k, v]) => `<div class="li"><div class="grow">${U.esc(k)}</div><span class="chip">${Fin.cat(v).icon} ${U.esc(Fin.cat(v).name)}</span><button class="icon-btn" data-act="forget" data-k="${U.esc(k)}">✕</button></div>`).join('')}</div></details>` : ''}
    </div>`;
  };

  views.cartoes = () => `
    <div class="card"><header><h3>💳 Cartões de crédito</h3><button class="btn primary" data-act="addCard">＋ Cartão</button></header>
      ${st().cards.length ? `<div class="grid g-auto">${st().cards.map((c) => {
        const used = U.sum(st().installments.filter((i) => i.cardId === c.id), (i) => Fin.instStatus(i).remainingValue);
        return `<div class="card" style="background:linear-gradient(135deg, ${c.color}, ${App.alpha(c.color, .55)});color:#fff;border:0">
          <div class="row between"><b style="font-size:1.1rem">${U.esc(c.name)}</b><button class="icon-btn" style="color:#fff" data-act="editCard" data-id="${c.id}">✏️</button></div>
          <div style="margin:18px 0 6px;font-size:.8rem;opacity:.85">PARCELAS ESTE MÊS</div><div style="font-size:1.6rem;font-weight:800">${U.money(Fin.instMonthTotal(U.ym(), c.id))}</div>
          <div style="font-size:.85rem;opacity:.9;margin-top:6px">Fecha dia ${c.closeDay || '—'} · vence dia ${c.dueDay || '—'}</div>
          ${c.limit ? `<div style="margin-top:10px;font-size:.8rem">Limite comprometido com parcelas: ${U.money(used)} de ${U.money(c.limit)}</div><div class="bar" style="background:rgba(255,255,255,.25);border:0"><i style="width:${Math.min(100, (used / c.limit) * 100)}%;background:#fff"></i></div>` : ''}
        </div>`; }).join('')}</div>` : App.empty('💳', 'Nenhum cartão', 'Cadastre seus cartões para agrupar parcelas e ver o vencimento da fatura na agenda.', '<button class="btn primary" data-act="addCard">＋ Cartão</button>')}
    </div>`;

  /* ---------- modais ---------- */
  const txModal = (t = {}) => {
    const isNew = !t.id;
    App.modal({
      title: isNew ? 'Novo lançamento' : 'Editar lançamento',
      body: F.row(F.select('Tipo', 'kind', [['expense', 'Despesa'], ['income', 'Receita']], t.kind || 'expense'), F.date('Data', 'date', t.date || U.today())) +
        F.row(F.text('Descrição', 'desc', t.desc || '', 'required placeholder="Ex.: Mercado Assaí"', ''), F.number('Valor (R$)', 'value', t.value)) +
        F.row(F.field('Categoria', catSelect('categoryId', t.categoryId || '')), (st().accounts || []).length ? F.select('Conta (saldo)', 'accountId', [['', '— não mexe no saldo —'], ...st().accounts.map((a) => [a.id, a.name])], t.id ? t.accountId || '' : (App.Money.mainAcc() || {}).id) : F.text('Conta', 'account', t.account || '', 'list="acc-list2"')) +
        `<datalist id="acc-list2">${accounts().map((a) => `<option value="${U.esc(a)}">`).join('')}</datalist>` + F.area('Notas', 'notes', t.notes),
      onMount: (form) => { if (isNew) form.desc.addEventListener('change', () => { form.categoryId.value = App.parse.categorize(form.desc.value); }); },
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.transactions = s.transactions.filter((x) => x.id !== t.id); }) },
      onSubmit: (d) => {
        if (!d.desc || !d.value) { App.toast('Preencha descrição e valor.', 'error'); return false; }
        App.commit((s) => {
          const o = { ...t, ...d, value: Math.abs(d.value) };
          if (d.accountId !== undefined) o.account = (App.Money.acc(d.accountId) || {}).name || '';
          if (isNew) s.transactions.push({ id: U.uid(), source: 'manual', ...o });
          else Object.assign(s.transactions.find((x) => x.id === t.id), o);
        });
        App.toast('Lançamento salvo');
      },
    });
  };

  const instModal = (i = {}) => {
    const isNew = !i.id;
    const cur = i.id ? U.clamp(U.diffMonths(i.startYM, U.ym()) + 1, 1, i.count) : 1;
    App.modal({
      title: isNew ? 'Novo parcelamento / dívida' : 'Editar parcelamento',
      body: F.row(F.text('Descrição', 'desc', i.desc || '', 'required placeholder="Ex.: Notebook Dell"'), F.select('Tipo', 'type', [['cartao', 'Cartão de crédito'], ['emprestimo', 'Empréstimo'], ['financiamento', 'Financiamento'], ['outro', 'Outro']], i.type || 'cartao')) +
        F.row(F.number('Valor da parcela (R$)', 'parcel', i.parcel, 'data-minput="calc"'), F.number('Nº de parcelas', 'count', i.count || '', 'min="1" data-minput="calc"'), F.number('…ou valor total', 'total', i.parcel && i.count ? U.round(i.parcel * i.count) : '', 'data-minput="calcTotal"')) +
        F.row(F.number('Parcela deste mês é a nº', 'current', cur, 'min="1"'), F.month('…ou mês da 1ª parcela', 'startYM', i.startYM || '', '')) +
        F.row(F.select('Cartão', 'cardId', [['', '— nenhum —'], ...st().cards.map((c) => [c.id, c.name])], i.cardId || ''), F.field('Categoria', catSelect('categoryId', i.categoryId || 'compras'))) +
        F.area('Notas', 'notes', i.notes) + (isNew ? '' : F.check('Marcar como quitado (paguei antecipado)', 'settled', i.settled)) +
        '<div class="note" id="inst-prev"></div>',
      actions: {
        calc: (_, f) => { const p = U.num(f.parcel.value), n = U.num(f.count.value); if (p && n) f.total.value = U.round(p * n); preview(f); },
        calcTotal: (_, f) => { const t = U.num(f.total.value), n = U.num(f.count.value); if (t && n) f.parcel.value = U.round(t / n); preview(f); },
      },
      onMount: (f) => { preview(f); f.addEventListener('input', () => preview(f)); },
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.installments = s.installments.filter((x) => x.id !== i.id); }) },
      onSubmit: (d) => {
        if (!d.desc || !d.parcel || !d.count) { App.toast('Preencha descrição, parcela e nº de parcelas.', 'error'); return false; }
        // se você mexeu no nº da parcela atual, ele manda; senão vale o mês da 1ª parcela
        const startYM = d.startYM && d.current === cur ? d.startYM : U.addMonthsYM(U.ym(), -(Math.max(1, d.current || 1) - 1));
        const o = { desc: d.desc, type: d.type, parcel: d.parcel, count: Math.round(d.count), startYM, cardId: d.cardId, categoryId: d.categoryId, notes: d.notes, settled: !!d.settled };
        App.commit((s) => { if (isNew) s.installments.push({ id: U.uid(), ...o }); else Object.assign(s.installments.find((x) => x.id === i.id), o); });
        App.toast('Parcelamento salvo');
      },
    });
    function preview(f) {
      const p = U.num(f.parcel.value), n = U.num(f.count.value), c = U.num(f.current.value) || 1;
      const el = f.querySelector('#inst-prev'); if (!el) return;
      if (!p || !n) { el.textContent = 'Informe a parcela (ou o total) e o número de parcelas.'; return; }
      const end = U.addMonthsYM(U.ym(), n - c);
      el.innerHTML = `Este mês: parcela <b>${c}/${n}</b> de <b>${U.moneyTxt(p)}</b> · Faltam <b>${Math.max(0, n - c + 1)}</b> parcelas (<b>${U.moneyTxt(p * Math.max(0, n - c + 1))}</b>) · Última parcela em <b>${U.ymLabel(end)}</b>`;
    }
  };

  const catModal = (c = {}) => {
    const isNew = !c.id;
    App.modal({
      title: isNew ? 'Nova categoria' : 'Editar categoria',
      body: F.row(F.text('Ícone (emoji)', 'icon', c.icon || '🏷️', 'maxlength="4" style="width:80px"', ''), F.text('Nome', 'name', c.name || '', 'required'), F.color('Cor', 'color', c.color || '#7c5cff')) +
        F.row(F.number('Limite mensal (R$) — 0 = sem limite', 'budget', c.budget || 0)) +
        F.area('Palavras-chave (separe por vírgula) — se a descrição contiver alguma, cai nesta categoria', 'keywords', (c.keywords || []).join(', '), 'rows="4"'),
      danger: isNew || c.id === 'outros' ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.categories = s.categories.filter((x) => x.id !== c.id); s.transactions.forEach((t) => { if (t.categoryId === c.id) t.categoryId = 'outros'; }); }) },
      onSubmit: (d) => {
        const o = { icon: d.icon || '🏷️', name: d.name, color: d.color, budget: d.budget || 0, keywords: d.keywords.split(',').map((x) => x.trim()).filter(Boolean) };
        App.commit((s) => { if (isNew) s.categories.splice(s.categories.length - 1, 0, { id: U.norm(d.name).replace(/\W+/g, '-') + '-' + U.uid().slice(-3), ...o }); else Object.assign(s.categories.find((x) => x.id === c.id), o); });
      },
    });
  };

  const cardModal = (c = {}) => {
    const isNew = !c.id;
    App.modal({
      title: isNew ? 'Novo cartão' : 'Editar cartão',
      body: F.row(F.text('Nome', 'name', c.name || '', 'required placeholder="Ex.: Nubank"'), F.color('Cor', 'color', c.color || '#8b5cf6')) +
        F.row(F.number('Dia de fechamento', 'closeDay', c.closeDay, 'min="1" max="31"'), F.number('Dia de vencimento', 'dueDay', c.dueDay, 'min="1" max="31"'), F.number('Limite (R$)', 'limit', c.limit)) +
        F.check('Mostrar vencimento da fatura na agenda', 'showDue', c.showDue !== false),
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.cards = s.cards.filter((x) => x.id !== c.id); }) },
      onSubmit: (d) => App.commit((s) => { if (isNew) s.cards.push({ id: U.uid(), createdAt: U.today(), ...d }); else Object.assign(s.cards.find((x) => x.id === c.id), d); }),
    });
  };

  /* ---------- importação ---------- */
  async function runImport(form) {
    const d = App.formData(form);
    const files = [...(d.files || [])];
    if (!files.length) return App.toast('Escolha pelo menos um arquivo.', 'error');
    const btn = form.querySelector('button.primary'); if (btn) { btn.disabled = true; btn.textContent = 'Lendo…'; }
    const all = [], infos = [];
    for (const f of files) {
      try {
        const r = await App.parse.transactions(f, d.ym ? { year: +d.ym.slice(0, 4) } : {});
        const info = r.info || {};
        // mês da fatura: forçado > detectado no arquivo > mês da compra mais recente
        const last = r.items.map((x) => x.date).sort().pop();
        const fy = d.ym || info.ym || (last ? last.slice(0, 7) : U.ym());
        const ref = info.closing || (info.due ? U.addDays(info.due, -7) : last);
        infos.push({ file: f.name, ...info, fy, auto: !d.ym && !!info.ym, guessed: !d.ym && !info.ym });
        for (const it of r.items) {
          const x = { ...it, file: f, pos: r.positiveIsExpense, fy };
          // parcela 2/10, 3/10…: pertence ao mês da fatura, não ao mês da compra original
          const inst = App.parse.installmentInfo(it.desc);
          if (inst && inst.cur > 1 && ref && it.date < U.addDays(ref, -40)) {
            x.origDate = it.date;
            const day = Math.min(+it.date.slice(8), +App.Fin.monthRange(ref.slice(0, 7))[1].slice(8));
            x.date = `${ref.slice(0, 7)}-${String(day).padStart(2, '0')}`;
            if (x.date > ref) x.date = ref;
          }
          all.push(x);
        }
        if (!r.items.length) {
          let txt = ''; try { if (App.parse.kind(f) === 'pdf') txt = await App.parse.pdfText(f); } catch (x) { /* */ }
          App.modal({ title: `Não reconheci os lançamentos de “${U.esc(f.name)}”`, hideFooter: !txt, submitLabel: '📋 Copiar texto lido',
            body: `<p>O arquivo foi aberto, mas o formato desta fatura/extrato ainda não é reconhecido.</p>
              ${txt ? `<p class="muted">Copie o texto abaixo e mande para o Claude — com ele dá para ensinar o sistema a ler este banco. <small>(Vida OS ${App.VERSION})</small></p><textarea readonly rows="12" style="font-family:monospace;font-size:.75rem">${U.esc(txt.slice(0, 20000))}</textarea>` : '<p class="muted">Tente exportar em CSV ou OFX pelo app do banco.</p>'}`,
            onSubmit: async (d, form) => { try { await navigator.clipboard.writeText(txt); App.toast('Texto copiado'); } catch (x) { form.querySelector('textarea').select(); document.execCommand('copy'); } } });
        }
      } catch (e) { console.error(e); App.toast(`Erro ao ler ${f.name}: ${e.message}`, 'error'); }
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Ler arquivos'; }
    if (!all.length) return;
    previewImport(all, { ...d, ym: infos[0].fy, infos }, files);
  }

  function previewImport(items, meta, files) {
    let rows = items.map((it, idx) => {
      const isExp = it.pos ? it.raw > 0 : it.raw < 0;
      const value = Math.abs(it.raw);
      const inst = App.parse.installmentInfo(it.desc);
      const isPayment = /pagamento recebido|pagamento de fatura|pgto fatura|estorno/.test(U.norm(it.desc));
      return { idx, ...it, kind: isExp ? 'expense' : 'income', value, categoryId: App.parse.categorize(it.desc, it.catHint), dup: null, inst, include: !isPayment, mkInst: !!inst };
    });
    // mesmo dia + mesmo valor que algo já lançado (mesmo com outro nome) → não entra de novo
    App.Money.findDuplicates(rows);
    // dentro do próprio arquivo, itens idênticos continuam valendo (compras repetidas reais)
    const monthsHTML = () => {
      const g = U.groupBy(rows.filter((r) => r.include && r.kind === 'expense'), (r) => r.date.slice(0, 7));
      return Object.keys(g).sort().map((m) => `<span class="chip info" style="text-transform:capitalize">${U.ymLabel(m)}: ${g[m].length} · ${U.moneyTxt(U.sum(g[m], (r) => r.value))}</span>`).join(' ');
    };
    const infoHTML = meta.infos.map((i) => `<div>📄 <b>${U.esc(i.file)}</b> — ${i.guessed ? `<span class="chip warn">não achei o vencimento; usei as datas das compras (${U.ymLabel(i.fy)})</span>` : `fatura de <b style="text-transform:capitalize">${U.ymLabel(i.fy)}</b>${i.due ? ` · vencimento ${U.dateBR(i.due)}` : ''}${i.closing ? ` · fechada em ${U.dateBR(i.closing)}` : ''}${i.auto ? ' <span class="chip ok">detectado automaticamente</span>' : ''}`}</div>`).join('');
    const render = () => `<div class="note" style="line-height:1.7">${infoHTML}<div class="mt">🗓️ Cada compra entra no mês em que foi feita: ${monthsHTML()}</div></div><div class="note">Encontrei <b>${rows.length}</b> lançamentos · <b>${rows.filter((r) => r.dup).length}</b> já lançados antes — mesmo dia e mesmo valor (desmarcados, não serão duplicados) · <b>${rows.filter((r) => r.inst).length}</b> parcelados detectados.
      ${F.check('Inverter sinais (se despesas aparecerem como receitas)', 'flip', false)}</div>
      <div class="table-wrap" style="max-height:55vh"><table><thead><tr><th><input type="checkbox" data-mchange="all" checked></th><th>Data</th><th>Descrição</th><th>Categoria</th><th class="r">Valor</th><th>Parcela</th></tr></thead><tbody>
      ${rows.map((r) => `<tr style="${r.dup ? 'opacity:.5' : ''}"><td><input type="checkbox" data-mchange="inc" data-i="${r.idx}" ${r.include ? 'checked' : ''}></td><td>${U.dateBR(r.date)}${r.origDate ? `<br><small class="muted" title="data da compra original">compra: ${U.dateBR(r.origDate)}</small>` : ''}</td><td>${U.esc(r.desc)} ${r.dup ? `<span class="chip warn" title="já existe: ${U.esc(r.dup.desc)} · ${U.dateBR(r.dup.date)}">já lançado${U.norm(r.dup.desc) !== U.norm(r.desc) ? ' como “' + U.esc(r.dup.desc.slice(0, 24)) + '”' : ''}</span>` : ''}</td>
        <td>${catSelect('c' + r.idx, r.categoryId, `data-mchange="cat" data-i="${r.idx}"`)}</td>
        <td class="r" style="color:${r.kind === 'income' ? 'var(--ok)' : 'inherit'}">${r.kind === 'income' ? '+' : ''}${U.moneyTxt(r.value)}</td>
        <td>${r.inst ? `<label class="check"><input type="checkbox" data-mchange="mk" data-i="${r.idx}" ${r.mkInst ? 'checked' : ''}><small>${r.inst.cur}/${r.inst.total} criar parcelamento</small></label>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
    App.modal({
      title: 'Conferir importação', wide: true, body: render(), submitLabel: 'Importar selecionados',
      actions: {
        inc: (el) => { rows[el.dataset.i].include = el.checked; },
        mk: (el) => { rows[el.dataset.i].mkInst = el.checked; },
        cat: (el) => { rows[el.dataset.i].categoryId = el.value; },
        all: (el, form) => { rows.forEach((r) => (r.include = el.checked)); form.querySelectorAll('[data-mchange=inc]').forEach((c) => (c.checked = el.checked)); },
      },
      onMount: (form) => form.addEventListener('change', (e) => { if (e.target.name !== 'flip') return; const on = e.target.checked; rows.forEach((r) => (r.kind = r.kind === 'income' ? 'expense' : 'income')); form.querySelector('.modal-body').innerHTML = render(); form.flip.checked = on; }),
      onSubmit: async () => {
        const chosen = rows.filter((r) => r.include);
        let fileId = null;
        try { if (files.length === 1) fileId = await App.files.put(files[0]); } catch (e) { /* sem armazenamento de arquivo */ }
        const reportId = U.uid();
        let newInst = 0;
        App.commit((s) => {
          for (const r of chosen) {
            s.transactions.push({ id: U.uid(), date: r.date, notes: r.origDate ? `compra original em ${U.dateBR(r.origDate)}` : undefined, desc: r.desc, value: r.value, kind: r.kind, categoryId: r.categoryId, account: (App.Money.acc(meta.accountId) || {}).name || meta.account, accountId: meta.accountId || undefined, source: 'import', reportId });
            // aprende a categoria escolhida
            const k = App.parse.merchantKey(r.desc); if (k && r.categoryId !== App.parse.categorize(r.desc)) s.merchantMap[k] = r.categoryId;
            if (r.inst && r.mkInst && r.kind === 'expense') {
              const startYM = U.addMonthsYM(r.fy || meta.ym, -(r.inst.cur - 1));
              const mk = App.parse.merchantKey(r.desc);
              const exists = s.installments.find((i) => App.parse.merchantKey(i.desc) === mk && i.count === r.inst.total && Math.abs(i.parcel - r.value) < 0.05);
              if (!exists) { s.installments.push({ id: U.uid(), desc: r.desc.replace(/\s*-?\s*parc(ela)?\.?\s*\d+\s*(\/|de)\s*\d+/i, '').trim(), type: 'cartao', parcel: r.value, count: r.inst.total, startYM, cardId: meta.cardId || '', categoryId: r.categoryId, notes: 'criado pela importação' }); newInst++; }
            }
          }
          s.reports.push({ id: reportId, ym: meta.ym, account: meta.account, fileName: files.map((f) => f.name).join(', '), fileId, count: chosen.length, total: U.sum(chosen.filter((r) => r.kind === 'expense'), (r) => r.value), importedAt: U.today() });
        });
        App.toast(`${chosen.length} lançamentos importados${newInst ? ` · ${newInst} parcelamentos criados` : ''}`);
        const byM = U.groupBy(chosen.filter((r) => r.kind === 'expense'), (r) => r.date.slice(0, 7));
        const topM = Object.keys(byM).sort((a, b) => byM[b].length - byM[a].length)[0] || meta.ym;
        S.period = 'mes'; S.ref = topM + '-01'; S.ym = topM;
        App.go('financas/visao');
      },
    });
  }

  views.contas = () => App.Money.viewContas();
  views.assinaturas = () => App.Subs.view();
  views.metas = () => App.Money.viewMetas();

  /* ---------- view ---------- */
  App.views.financas = {
    S,
    render(r) {
      const sub = views[r.sub] ? r.sub : 'visao';
      this._sub = sub;
      return `<div class="page-head"><div><h1>💰 Finanças</h1><p>Gastos, parcelas, relatórios e orçamento — tudo num lugar só.</p></div></div>
        ${App.subtabs('financas', [['visao', 'Visão geral'], ['contas', 'Contas & saldo'], ['metas', 'Orçamento & metas'], ['parcelas', 'Parcelas & dívidas'], ['gastos', 'Gastos'], ['importar', 'Subir relatório'], ['categorias', 'Categorias & orçamento'], ['assinaturas', '🔁 Assinaturas'], ['cartoes', 'Cartões']], sub)}
        ${views[sub]()}`;
    },
    mount(el) {
      if (this._sub === 'visao') mountVisao();
      if (this._sub === 'gastos') mountGastos();
      const drop = el.querySelector('#imp-drop');
      if (drop) {
        const inp = drop.querySelector('input');
        ['dragenter', 'dragover'].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add('over'); }));
        ['dragleave', 'drop'].forEach((e) => drop.addEventListener(e, () => drop.classList.remove('over')));
        drop.addEventListener('drop', (ev) => { ev.preventDefault(); inp.files = ev.dataTransfer.files; drop.querySelector('b').textContent = `${inp.files.length} arquivo(s) selecionado(s)`; });
        inp.addEventListener('change', () => { drop.querySelector('b').textContent = [...inp.files].map((f) => f.name).join(', '); });
      }
    },
    actions: {
      ...App.Money.actions,
      ...App.Subs.actions,
      ymPrev: () => { S.ym = U.addMonthsYM(S.ym, -1); App.rerender(); },
      ymNext: () => { S.ym = U.addMonthsYM(S.ym, 1); App.rerender(); },
      ymNow: () => { S.ym = U.ym(); App.rerender(); },
      addTx: () => txModal(),
      editTx: (t) => txModal(st().transactions.find((x) => x.id === t.dataset.id)),
      addInst: () => instModal(),
      editInst: (t) => instModal(st().installments.find((x) => x.id === t.dataset.id)),
      addCat: () => catModal(),
      editCat: (t) => catModal(st().categories.find((x) => x.id === t.dataset.id)),
      addCard: () => cardModal(),
      editCard: (t) => cardModal(st().cards.find((x) => x.id === t.dataset.id)),
      forget: (t) => App.commit((s) => { delete s.merchantMap[t.dataset.k]; }),
      period: (t) => { S.period = t.dataset.p; S.limit = 150; if (S.period === 'semana' || S.period === 'dia') S.group = 'dia'; else if (S.period === 'ano' || S.period === 'tudo') S.group = 'mes'; App.rerender(); },
      group: (t) => { S.group = t.dataset.g; App.rerender(); },
      refPrev: () => { shiftRef(-1); App.rerender(); },
      refNext: () => { shiftRef(1); App.rerender(); },
      ref: (t) => { if (t.value) { S.ref = t.value; App.rerender(); } },
      from: (t) => { S.from = t.value; App.rerender(); },
      to: (t) => { S.to = t.value; App.rerender(); },
      cat: (t) => { S.cat = t.value; App.rerender(); },
      kind: (t) => { S.kind = t.value; App.rerender(); },
      acc: (t) => { S.acc = t.value; App.rerender(); },
      q: U.debounce((t) => { S.q = t.value; App.rerender(); const i = document.querySelector('[data-input=q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300),
      more: () => { S.limit += 300; App.rerender(); },
      txCat: (t) => {
        const tx = st().transactions.find((x) => x.id === t.dataset.id);
        const k = App.parse.merchantKey(tx.desc);
        const same = st().transactions.filter((x) => x.id !== tx.id && App.parse.merchantKey(x.desc) === k && x.categoryId === tx.categoryId);
        tx.categoryId = t.value; if (k) st().merchantMap[k] = t.value;
        if (same.length) App.confirm(`Aplicar “${Fin.cat(t.value).name}” também a outros ${same.length} lançamento(s) de “${U.esc(k)}”?`, () => App.commit(() => same.forEach((x) => (x.categoryId = t.value))), 'Aplicar');
        App.save(); App.rerender();
      },
      import: (form) => runImport(form),
      delReport: (t) => App.confirm('Excluir este relatório e todos os lançamentos importados dele?', () => App.commit((s) => { const r = s.reports.find((x) => x.id === t.dataset.id); s.transactions = s.transactions.filter((x) => x.reportId !== t.dataset.id); s.reports = s.reports.filter((x) => x.id !== t.dataset.id); if (r && r.fileId) App.files.del(r.fileId); })),
    },
    quick: { tx: () => txModal(), inst: () => instModal() },
  };
})(window.App);
