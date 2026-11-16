/* ==========================================================
   DINHEIRO NO DIA A DIA — contas & saldo, receitas fixas,
   metas, orçamento do salário, insights e antiduplicação
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const M = (App.Money = {});
  const ACC_COLORS = ['#8b5cf6', '#f97316', '#22c55e', '#ef4444', '#0ea5e9', '#eab308', '#ec4899', '#14b8a6'];

  M.accounts = () => (st().accounts = st().accounts || []);
  M.rules = () => (st().rules = st().rules || []);
  M.goals = () => (st().goals = st().goals || []);
  M.acc = (id) => M.accounts().find((a) => a.id === id);
  M.mainAcc = () => M.accounts().find((a) => a.main) || M.accounts()[0];

  /* ---------- saldo ---------- */
  M.balance = (a, upTo = U.today()) => {
    let b = +a.initial || 0;
    for (const t of st().transactions) {
      if (t.accountId !== a.id || t.date < (a.initialDate || '0000') || t.date > upTo) continue;
      b += t.kind === 'income' ? t.value : -t.value;
    }
    return b;
  };
  M.totalBalance = () => U.sum(M.accounts().filter((a) => !a.hidden), (a) => M.balance(a));

  /* ---------- receitas/despesas fixas automáticas (ex.: salário) ---------- */
  M.applyRules = () => {
    let n = 0; const today = U.today();
    for (const r of M.rules()) {
      if (!r.value || !r.day) continue;
      let ym = (r.start || today).slice(0, 7);
      for (let i = 0; i < 240 && ym <= today.slice(0, 7); i++, ym = U.addMonthsYM(ym, 1)) {
        const [y, m] = ym.split('-').map(Number);
        const date = `${ym}-${String(Math.min(r.day, new Date(y, m, 0).getDate())).padStart(2, '0')}`;
        if (date > today || date < (r.start || '0000') || (r.end && date > r.end)) continue;
        const key = r.id + '|' + ym;
        if (st().transactions.some((t) => t.ruleKey === key)) continue;
        st().transactions.push({ id: U.uid(), date, desc: r.desc, value: r.value, kind: r.kind, categoryId: r.categoryId || (r.kind === 'income' ? 'salario' : 'outros'), accountId: r.accountId || (M.mainAcc() || {}).id, account: (M.acc(r.accountId) || M.mainAcc() || {}).name, source: 'fixa', ruleKey: key });
        n++;
      }
    }
    if (n) App.save();
    return n;
  };
  M.fixedIncome = () => U.sum(M.rules().filter((r) => r.kind === 'income' && (!r.end || r.end >= U.today())), (r) => r.value);

  /* ---------- antiduplicação na importação ---------- */
  /** Marca como duplicados os itens que já existem: mesmo dia + mesmo valor (mesmo com nome diferente). */
  M.findDuplicates = (rows) => {
    const pool = new Map();
    for (const t of st().transactions) { const k = `${t.date}|${U.round(t.value).toFixed(2)}|${t.kind === 'income' ? 'i' : 'e'}`; if (!pool.has(k)) pool.set(k, []); pool.get(k).push(t); }
    for (const r of rows) {
      const k = `${r.date}|${U.round(r.value).toFixed(2)}|${r.kind === 'income' ? 'i' : 'e'}`;
      const arr = pool.get(k);
      if (arr && arr.length) { r.dup = arr.shift(); r.include = false; } // casa 1 para 1
    }
    return rows;
  };

  /* ---------- metas ---------- */
  M.goalCalc = (g) => {
    const left = Math.max(0, g.target - (g.saved || 0));
    const rate = g.yieldCdi ? Math.pow(1 + (st().settings.cdi * (g.cdiPct || 100)) / 10000, 1 / 12) - 1 : 0;
    let monthly = +g.monthly || 0, months = null;
    if (g.mode === 'date' && g.deadline) {
      const n = Math.max(1, U.diffMonths(U.ym(), g.deadline.slice(0, 7)));
      monthly = rate ? Math.max(0, (g.target - (g.saved || 0) * Math.pow(1 + rate, n)) * rate / (Math.pow(1 + rate, n) - 1)) : left / n;
      months = n;
    } else if (monthly > 0) {
      let v = g.saved || 0; months = 0;
      while (v < g.target && months < 600) { v = v * (1 + rate) + monthly; months++; }
    }
    const done = left <= 0;
    return { left, monthly: done ? 0 : monthly, months: done ? 0 : months, end: months != null ? U.addMonthsYM(U.ym(), months) : null, pct: g.target ? Math.min(100, ((g.saved || 0) / g.target) * 100) : 0, done, rate };
  };
  M.goalsMonthly = () => U.sum(M.goals().filter((g) => !g.paused), (g) => M.goalCalc(g).monthly);

  /* ---------- orçamento do salário ---------- */
  M.variableAvg = () => {
    const ms = [1, 2, 3].map((i) => U.addMonthsYM(U.ym(), -i));
    const vals = ms.map((ym) => U.sum(App.Fin.tx(...App.Fin.monthRange(ym)).filter((t) => t.kind !== 'income' && !App.Fin.isTransfer(t) && !t.eventKey && t.source !== 'fixa'), (t) => t.value)).filter((v) => v > 0);
    return vals.length ? U.sum(vals) / vals.length : 0;
  };
  M.budget = (ym = U.ym()) => {
    const salary = M.fixedIncome() || +(st().budgetCfg || {}).salary || 0;
    const fixed = U.sum(App.Fin.fixedBills(ym), (b) => b.value) + U.sum(M.rules().filter((r) => r.kind === 'expense'), (r) => r.value);
    const parcelas = App.Fin.instMonthTotal(ym);
    const goals = M.goalsMonthly();
    const invest = App.Planner ? App.Planner.monthlyAporte() : 0;
    const variable = M.variableAvg();
    const free = salary - fixed - parcelas - goals - invest - variable;
    return { salary, fixed, parcelas, goals, invest, variable, free };
  };

  /* ---------- previsão do mês ---------- */
  M.forecast = () => {
    const today = U.today(), [from, to] = App.Fin.monthRange(U.ym());
    const bal = M.totalBalance();
    const pendBills = App.Agenda.occurrences(today, to).filter((o) => (o.type === 'conta' || o.type === 'fatura') && !o.paid);
    const pendIncome = U.sum(M.rules().filter((r) => r.kind === 'income'), (r) => { const d = `${U.ym()}-${String(r.day).padStart(2, '0')}`; return d > today && d <= to ? r.value : 0; });
    const out = U.sum(pendBills, (b) => b.value);
    return { bal, pendIncome, out, end: bal + pendIncome - out, bills: pendBills, from };
  };

  /* ---------- insights (oportunidades de economia) ---------- */
  M.insights = () => {
    const Fin = App.Fin, ym = U.ym(), out = [];
    const [from, to] = Fin.monthRange(ym);
    const tx = Fin.tx(from, to).filter((t) => t.kind !== 'income' && !Fin.isTransfer(t));
    const spent = U.sum(tx, (t) => t.value), inc = Fin.monthIncome(ym);
    const day = +U.today().slice(8), days = +to.slice(8);
    if (spent > 0 && day >= 5) {
      const proj = (spent / day) * days, b = M.budget();
      out.push({ ico: '📈', lvl: inc && proj > inc ? 'bad' : 'info', t: `No ritmo atual você fecha o mês com ${U.moneyTxt(proj)} em gastos`, s: inc ? (proj > inc ? `Isso é ${U.fmt(((proj - inc) / inc) * 100, 0)}% acima da sua receita.` : `Sobrariam ${U.moneyTxt(inc - proj)} da receita do mês.`) : `Média de ${U.moneyTxt(spent / day)} por dia.` + (b.salary ? '' : '') });
    }
    if (inc && spent > inc) out.push({ ico: '🚨', lvl: 'bad', t: `Você já gastou ${U.fmt(((spent - inc) / inc) * 100, 1)}% acima da receita`, s: `${U.moneyTxt(spent)} de despesas contra ${U.moneyTxt(inc)} de receita.` });
    // categorias que cresceram
    const prev = [1, 2, 3].map((i) => U.addMonthsYM(ym, -i));
    const avgCat = {};
    prev.forEach((m) => Fin.byCategory(Fin.tx(...Fin.monthRange(m)).filter((t) => !Fin.isTransfer(t))).forEach((c) => { avgCat[c.cat.id] = (avgCat[c.cat.id] || 0) + c.total / 3; }));
    const cur = Fin.byCategory(tx);
    const scale = day >= days ? 1 : days / Math.max(day, 1);
    cur.forEach((c) => { const a = avgCat[c.cat.id]; const p = c.total * scale; if (a > 30 && p > a * 1.25 && p - a > 50) out.push({ ico: c.cat.icon, lvl: 'warn', t: `${c.cat.name}: tendência de ${U.fmt(((p - a) / a) * 100, 0)}% acima da sua média`, s: `Média dos últimos 3 meses ${U.moneyTxt(a)} · este mês deve chegar a ${U.moneyTxt(p)}.` }); });
    // assinaturas
    const subs = U.sum(tx.filter((t) => t.categoryId === 'assinaturas'), (t) => t.value);
    if (subs > 0) out.push({ ico: '📺', lvl: 'info', t: `Assinaturas: ${U.moneyTxt(subs)} por mês`, s: `Isso dá ${U.moneyTxt(subs * 12)} por ano. Vale revisar as que você quase não usa.` });
    // delivery
    const deliv = tx.filter((t) => /ifood|rappi|delivery|ze delivery|aiqfome/.test(U.norm(t.desc)));
    if (deliv.length >= 3) out.push({ ico: '🛵', lvl: 'warn', t: `${deliv.length} pedidos de delivery este mês (${U.moneyTxt(U.sum(deliv, (t) => t.value))})`, s: 'Cozinhar 2 desses por semana costuma economizar bastante.' });
    // gastos pequenos
    const small = tx.filter((t) => t.value <= 20);
    if (small.length >= 8) out.push({ ico: '☕', lvl: 'info', t: `${small.length} gastos pequenos somam ${U.moneyTxt(U.sum(small, (t) => t.value))}`, s: 'O “efeito cafezinho”: valores baixos que juntos pesam.' });
    // fim de semana
    const we = U.sum(tx.filter((t) => [0, 6].includes(U.parseISO(t.date).getDay())), (t) => t.value);
    if (spent > 200 && we / spent > 0.45) out.push({ ico: '🎉', lvl: 'info', t: `${U.fmt((we / spent) * 100, 0)}% dos gastos foram no fim de semana`, s: 'Planejar o lazer do fim de semana ajuda a controlar.' });
    // acelerar metas
    const g = M.goals().find((x) => !M.goalCalc(x).done && M.goalCalc(x).monthly > 0);
    const top = cur.find((c) => !['casa-contas', 'saude', 'farmacia'].includes(c.cat.id));
    if (g && top && top.total > 100) {
      const cut = top.total * 0.2, c0 = M.goalCalc(g), c1 = M.goalCalc({ ...g, mode: 'monthly', monthly: c0.monthly + cut });
      if (c0.months && c1.months < c0.months) out.push({ ico: '🎯', lvl: 'ok', t: `Cortando 20% em ${top.cat.name} (${U.moneyTxt(cut)}/mês)`, s: `sua meta “${g.name}” chega ${c0.months - c1.months} mês(es) antes — em ${U.ymLabel(c1.end)}.` });
    }
    if (!out.length) out.push({ ico: '✨', lvl: 'ok', t: 'Tudo tranquilo por aqui', s: 'Lance seus gastos ou suba a fatura para eu analisar padrões.' });
    return out;
  };

  /* ---------- mapa de calor dos gastos do mês ---------- */
  M.heatmap = (ym) => {
    const [from, to] = App.Fin.monthRange(ym);
    const by = U.groupBy(App.Fin.tx(from, to).filter((t) => t.kind !== 'income' && !App.Fin.isTransfer(t)), (t) => t.date);
    const days = +to.slice(8), max = Math.max(1, ...Object.values(by).map((a) => U.sum(a, (t) => t.value)));
    const firstDow = (U.parseISO(from).getDay() + 6) % 7;
    let cells = Array.from({ length: firstDow }, () => '<i class="hm-pad"></i>');
    for (let d = 1; d <= days; d++) {
      const iso = `${ym}-${String(d).padStart(2, '0')}`; const v = U.sum(by[iso] || [], (t) => t.value);
      const lvl = v ? Math.min(4, Math.ceil((v / max) * 4)) : 0;
      cells.push(`<i class="hm l${lvl} ${iso === U.today() ? 'today' : ''}" title="${U.dateBR(iso)} · ${U.moneyTxt(v)}" data-act="hmDay" data-d="${iso}"></i>`);
    }
    return `<div class="heatmap">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((x) => `<b>${x}</b>`).join('')}${cells.join('')}</div>
      <div class="row between mt"><small class="muted">menos</small><span class="hm-legend">${[0, 1, 2, 3, 4].map((l) => `<i class="hm l${l}"></i>`).join('')}</span><small class="muted">mais</small></div>`;
  };

  /* ==========================================================
     TELAS (sub-abas de Finanças)
     ========================================================== */
  const accCard = () => {
    const accs = M.accounts().filter((a) => !a.hidden), total = M.totalBalance();
    const pos = accs.map((a) => ({ a, b: M.balance(a) }));
    const sumPos = U.sum(pos, (x) => Math.max(0, x.b)) || 1;
    return `<div class="card balance-card"><div class="row between"><div><div class="lbl">Saldo em ${accs.length} conta${accs.length === 1 ? '' : 's'}</div><div class="big ${total < 0 ? 'neg' : ''}">${U.money(total)}</div></div><button class="btn sm" data-act="addAcc">＋ Conta</button></div>
      <div class="segbar">${pos.filter((x) => x.b > 0).map((x) => `<i style="flex:${x.b / sumPos};background:${x.a.color}" title="${U.esc(x.a.name)}"></i>`).join('') || '<i style="flex:1;background:var(--line)"></i>'}</div>
      <div class="list">${pos.map(({ a, b }) => `<div class="li" data-act="editAcc" data-id="${a.id}" style="cursor:pointer"><span class="bank" style="background:${a.color}">${U.esc(a.icon || '🏛️')}</span><div class="grow"><div class="t">${U.money(b)}</div><div class="s">${U.esc(a.name)} · ${U.pct(total > 0 ? (Math.max(0, b) / sumPos) * 100 : 0, 0)}${a.main ? ' · principal' : ''}</div></div></div>`).join('') || '<p class="muted">Cadastre sua conta (ex.: Nubank) com o saldo de hoje.</p>'}</div></div>`;
  };

  M.viewContas = () => {
    const f = M.forecast(), b = M.budget();
    const last = st().transactions.filter((t) => t.accountId).sort((a, c) => c.date.localeCompare(a.date) || (c.id > a.id ? 1 : -1)).slice(0, 12);
    return `<div class="grid g3">
      ${accCard()}
      <div class="card"><header><h3>🔮 Previsão até o fim do mês</h3></header>
        <div class="list"><div class="li"><div class="grow">Saldo agora</div><b>${U.money(f.bal)}</b></div>
          <div class="li"><div class="grow">＋ Receitas a entrar</div><b class="delta good">${U.money(f.pendIncome)}</b></div>
          <div class="li"><div class="grow">− Contas a pagar (${f.bills.length})</div><b class="delta badd">${U.money(f.out)}</b></div>
          <div class="li"><div class="grow"><b>Deve sobrar no fim do mês</b></div><b class="${f.end < 0 ? 'delta badd' : ''}" style="font-size:1.2rem">${U.money(f.end)}</b></div></div>
        ${f.end < 0 ? '<div class="note warn mt">⚠️ Pela previsão, o saldo fica negativo. Segure os gastos variáveis.</div>' : ''}
        <p class="muted"><small>Gastos do dia a dia ainda não lançados não entram na conta.</small></p></div>
      <div class="card"><header><h3>💵 Receitas e despesas fixas</h3><button class="btn sm" data-act="addRule">＋</button></header>
        ${M.rules().length ? `<div class="list">${M.rules().map((r) => `<div class="li" data-act="editRule" data-id="${r.id}" style="cursor:pointer"><div class="ico">${r.kind === 'income' ? '💰' : '🧾'}</div><div class="grow"><div class="t">${U.esc(r.desc)}</div><div class="s">todo dia ${r.day} · ${U.esc((M.acc(r.accountId) || {}).name || 'conta principal')}</div></div><b class="${r.kind === 'income' ? 'delta good' : ''}">${r.kind === 'income' ? '+' : '−'}${U.money(r.value)}</b></div>`).join('')}</div>`
          : App.empty('💵', 'Cadastre seu salário', 'Ex.: Salário R$ 1.910 todo dia 5. Ele entra sozinho na conta todo mês.', '<button class="btn primary" data-act="addRule">＋ Salário / receita fixa</button>')}</div>
    </div>
    <div class="grid g2 mt">
      <div class="card"><header><h3>⚡ Lançar rápido</h3><small class="muted">desconta da conta na hora</small></header>
        <form data-submit="quickTx" class="inline-form">
          ${F.text('O quê', 'desc', '', 'required placeholder="Ex.: Mercado"')}${F.number('Valor (R$)', 'value', '', 'required')}
          ${F.select('Tipo', 'kind', [['expense', '− Gasto'], ['income', '＋ Entrada']], 'expense')}
          ${M.accounts().length > 1 ? F.select('Conta', 'accountId', M.accounts().map((a) => [a.id, a.name]), (M.mainAcc() || {}).id) : ''}
          ${F.date('Data', 'date', U.today())}<button class="btn primary">Lançar</button></form>
        ${!M.accounts().length ? '<div class="note mt">Cadastre uma conta primeiro para o saldo ser calculado.</div>' : ''}</div>
      <div class="card"><header><h3>🧾 Últimos lançamentos nas contas</h3><a href="#/financas/gastos" class="btn sm ghost">todos</a></header>
        ${last.length ? `<div class="list">${last.map((t) => `<div class="li"><div class="ico">${App.Fin.cat(t.categoryId).icon}</div><div class="grow"><div class="t">${U.esc(t.desc)}</div><div class="s">${U.dateNice(t.date)} · ${U.esc(App.Fin.cat(t.categoryId).name)} · ${U.esc((M.acc(t.accountId) || {}).name || '')}</div></div><b class="${t.kind === 'income' ? 'delta good' : ''}">${t.kind === 'income' ? '+' : '−'}${U.money(t.value)}</b><button class="icon-btn" data-act="editTx" data-id="${t.id}">✏️</button></div>`).join('')}</div>` : '<p class="muted">Nada ainda.</p>'}</div>
    </div>`;
  };

  M.viewMetas = () => {
    const b = M.budget();
    const parts = [['Contas fixas', b.fixed, '#f97316'], ['Parcelas', b.parcelas, '#ec4899'], ['Metas', b.goals, '#22c55e'], ['Investimentos', b.invest, '#0ea5e9'], ['Gastos variáveis (média)', b.variable, '#eab308']];
    const used = U.sum(parts, (p) => p[1]);
    return `<div class="grid g3">
      <div class="card span2"><header><h3>🧮 Para onde vai o seu salário</h3><button class="btn sm ghost" data-act="go" data-to="financas/contas">editar salário</button></header>
        ${b.salary ? `<div class="row between"><span class="muted">Salário / receitas fixas</span><b style="font-size:1.3rem">${U.money(b.salary)}</b></div>
          <div class="segbar big mt">${parts.filter((p) => p[1] > 0).map((p) => `<i style="flex:${p[1]};background:${p[2]}" title="${p[0]}"></i>`).join('')}${b.free > 0 ? `<i style="flex:${b.free};background:var(--line2)" title="Sobra"></i>` : ''}</div>
          <div class="list mt">${parts.map(([l, v, c]) => `<div class="li"><span class="dot" style="background:${c}"></span><div class="grow">${l}</div><small class="muted">${U.pct(b.salary ? (v / b.salary) * 100 : 0, 0)}</small><b style="min-width:110px;text-align:right">${U.money(v)}</b></div>`).join('')}
            <div class="li"><span class="dot" style="background:${b.free >= 0 ? 'var(--ok)' : 'var(--bad)'}"></span><div class="grow"><b>${b.free >= 0 ? 'Sobra livre por mês' : 'Falta por mês'}</b></div><b style="min-width:110px;text-align:right;font-size:1.15rem" class="${b.free >= 0 ? 'delta good' : 'delta badd'}">${U.money(Math.abs(b.free))}</b></div></div>
          ${b.free < 0 ? '<div class="note warn mt">⚠️ Os compromissos passam do salário. Reduza o valor mensal de alguma meta ou corte gastos variáveis.</div>' : ''}`
        : App.empty('💵', 'Informe seu salário', 'Cadastre o salário como receita fixa em “Contas & saldo” para ver quanto sobra.', '<button class="btn primary" data-act="go" data-to="financas/contas">Cadastrar salário</button>')}
      </div>
      <div class="card"><header><h3>🎯 Resumo das metas</h3></header>
        <div class="stat"><div class="lbl">Guardando por mês</div><div class="val">${U.money(b.goals)}</div><div class="sub">${M.goals().filter((g) => !M.goalCalc(g).done).length} meta(s) em andamento</div></div>
        <div class="stat mt"><div class="lbl">Já guardado</div><div class="val">${U.money(U.sum(M.goals(), (g) => g.saved || 0))}</div><div class="sub">de ${U.money(U.sum(M.goals(), (g) => g.target))}</div></div>
        <button class="btn primary block mt" data-act="addGoal">＋ Nova meta</button></div>
    </div>
    <div class="goal-grid mt">${M.goals().map((g) => {
      const c = M.goalCalc(g);
      const R = 34, C = 2 * Math.PI * R;
      return `<div class="card goal"><div class="row" style="gap:14px;align-items:center">
        <div class="goal-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="${R}" stroke="var(--line)"/><circle cx="40" cy="40" r="${R}" stroke="${g.color || 'var(--accent)'}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - c.pct / 100)}" stroke-linecap="round"/></svg><span>${U.esc(g.emoji || '🎯')}</span></div>
        <div class="grow"><h3>${U.esc(g.name)}</h3><div class="muted">${U.money(g.saved || 0)} de ${U.money(g.target)} · <b>${U.fmt(c.pct, 0)}%</b></div></div>
        <button class="icon-btn" data-act="editGoal" data-id="${g.id}">✏️</button></div>
        ${c.done ? '<div class="note mt">🏆 Meta atingida! Parabéns.</div>' : `
        <div class="grid g3 mt" style="gap:8px"><div class="metric"><div class="lbl">Por mês</div><div class="v">${U.money(c.monthly)}</div></div><div class="metric"><div class="lbl">Falta</div><div class="v">${U.money(c.left)}</div></div><div class="metric"><div class="lbl">Atinge em</div><div class="v" style="text-transform:capitalize">${c.end ? U.ymShort(c.end) : '—'}</div><div class="d muted">${c.months ? `${c.months} meses` : 'defina o valor'}</div></div></div>
        ${b.salary && c.monthly ? `<p class="muted" style="margin:10px 0 0"><small>Enquanto guarda, sobram <b>${U.moneyTxt(b.free)}</b> do salário por mês (já contando esta meta).</small></p>` : ''}
        ${g.yieldCdi ? `<p class="muted" style="margin:6px 0 0"><small>💹 Rendendo ${g.cdiPct || 100}% do CDI — os juros ajudam a chegar antes.</small></p>` : ''}
        <div class="row mt"><button class="btn sm primary" data-act="saveGoal" data-id="${g.id}">＋ Guardei dinheiro</button><button class="btn sm ghost" data-act="pauseGoal" data-id="${g.id}">${g.paused ? '▶ Retomar' : '⏸ Pausar'}</button></div>`}
      </div>`; }).join('') || `<div class="card">${App.empty('🎯', 'Crie sua primeira meta', 'Ex.: Casamento — R$ 10.000. Diga quanto pode guardar por mês (ou até quando quer chegar) e eu calculo o resto.', '<button class="btn primary" data-act="addGoal">＋ Nova meta</button>')}</div>`}</div>`;
  };

  /* ---------- modais ---------- */
  const accModal = (a = {}) => {
    const isNew = !a.id;
    App.modal({
      title: isNew ? 'Nova conta' : 'Editar conta',
      body: F.row(F.text('Nome', 'name', a.name || '', 'required placeholder="Ex.: Nubank, Itaú, Carteira"'), F.text('Ícone', 'icon', a.icon || '🏛️', 'maxlength="4" style="max-width:80px"', ''), F.color('Cor', 'color', a.color || ACC_COLORS[M.accounts().length % 8])) +
        F.row(F.number('Saldo em', 'initial', a.initial ?? '', 'required'), F.date('… nesta data', 'initialDate', a.initialDate || U.today())) +
        '<p class="muted"><small>Informe o saldo que aparece no app do banco hoje. A partir daí, cada entrada e gasto lançado nesta conta atualiza o saldo.</small></p>' +
        F.check('Conta principal (padrão para novos lançamentos)', 'main', isNew ? !M.accounts().length : a.main) + '<br>' + F.check('Esconder do saldo total', 'hidden', a.hidden),
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.accounts = s.accounts.filter((x) => x.id !== a.id); }) },
      onSubmit: (d) => App.commit((s) => {
        s.accounts = s.accounts || [];
        if (d.main) s.accounts.forEach((x) => (x.main = false));
        if (isNew) s.accounts.push({ id: U.uid(), ...d }); else Object.assign(s.accounts.find((x) => x.id === a.id), d);
      }),
    });
  };
  const ruleModal = (r = {}) => {
    const isNew = !r.id;
    App.modal({
      title: isNew ? 'Receita / despesa fixa' : 'Editar',
      body: F.row(F.select('Tipo', 'kind', [['income', '💰 Receita (salário…)'], ['expense', '🧾 Despesa fixa']], r.kind || 'income'), F.text('Descrição', 'desc', r.desc || 'Salário', 'required')) +
        F.row(F.number('Valor (R$)', 'value', r.value, 'required'), F.number('Todo dia', 'day', r.day || 5, 'min="1" max="31"'), M.accounts().length ? F.select('Conta', 'accountId', M.accounts().map((a) => [a.id, a.name]), r.accountId || (M.mainAcc() || {}).id) : '') +
        F.row(F.date('Começa em', 'start', r.start || U.today()), F.date('Termina em (opcional)', 'end', r.end || '')) +
        '<p class="muted"><small>Todo mês, no dia escolhido, o lançamento entra sozinho na conta.</small></p>',
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.rules = s.rules.filter((x) => x.id !== r.id); }) },
      onSubmit: (d) => { if (!d.value) return false; App.commit((s) => { s.rules = s.rules || []; if (isNew) s.rules.push({ id: U.uid(), categoryId: d.kind === 'income' ? 'salario' : 'casa-contas', ...d }); else Object.assign(s.rules.find((x) => x.id === r.id), d); }); M.applyRules(); App.rerender(); },
    });
  };
  const goalModal = (g = {}) => {
    const isNew = !g.id;
    App.modal({
      title: isNew ? 'Nova meta' : 'Editar meta',
      body: F.row(F.text('Ícone', 'emoji', g.emoji || '💍', 'maxlength="4" style="max-width:80px"', ''), F.text('Meta', 'name', g.name || '', 'required placeholder="Ex.: Casamento, viagem, carro, reserva de emergência"'), F.color('Cor', 'color', g.color || '#22c55e')) +
        F.row(F.number('Valor da meta (R$)', 'target', g.target, 'required data-minput="gp"'), F.number('Já tenho guardado (R$)', 'saved', g.saved || 0, 'data-minput="gp"')) +
        F.row(F.select('Como calcular', 'mode', [['monthly', 'Sei quanto posso guardar por mês'], ['date', 'Quero chegar até uma data']], g.mode || 'monthly', 'data-mchange="gp"')) +
        F.row(F.number('Guardar por mês (R$)', 'monthly', g.monthly || '', 'data-minput="gp"'), F.month('…ou atingir até', 'deadline', g.deadline || '', 'data-mchange="gp"')) +
        F.check('Dinheiro guardado rendendo (CDB/caixinha)', 'yieldCdi', g.yieldCdi) + ' ' + F.field('% do CDI', F.input('cdiPct', g.cdiPct || 100, 'type="number" style="max-width:110px" data-minput="gp"'), '') +
        '<div class="note mt" id="goal-prev"></div>',
      actions: { gp: (_, f) => prev(f) },
      onMount: (f) => { prev(f); f.yieldCdi.addEventListener('change', () => prev(f)); },
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.goals = s.goals.filter((x) => x.id !== g.id); }) },
      onSubmit: (d) => { if (!d.target) return false; App.commit((s) => { s.goals = s.goals || []; if (isNew) s.goals.push({ id: U.uid(), createdAt: U.today(), ...d }); else Object.assign(s.goals.find((x) => x.id === g.id), d); }); App.toast('Meta salva 🎯'); },
    });
    function prev(f) {
      const d = App.formData(f); const c = M.goalCalc({ ...d, target: +d.target || 0, saved: +d.saved || 0 });
      const b = M.budget(); const other = M.goalsMonthly() - (g.id ? M.goalCalc(g).monthly : 0);
      const free = b.salary ? b.salary - b.fixed - b.parcelas - b.invest - b.variable - other - c.monthly : null;
      f.querySelector('#goal-prev').innerHTML = !d.target ? 'Informe o valor da meta.' : c.done ? '🏆 Você já tem o valor da meta!' : !c.months ? 'Informe quanto guardar por mês ou a data.' :
        `Guardando <b>${U.moneyTxt(c.monthly)}/mês</b> você atinge em <b>${c.months} meses</b> (${U.ymLabel(c.end)}).${free !== null ? `<br>Do seu salário de ${U.moneyTxt(b.salary)} ${free >= 0 ? `ainda sobram <b>${U.moneyTxt(free)}</b> por mês.` : `<b style="color:var(--bad)">faltariam ${U.moneyTxt(-free)}</b> por mês — diminua o valor ou estique o prazo.`}` : ''}`;
    }
  };
  const saveModal = (g) => App.modal({
    title: `Guardar para “${g.name}”`,
    body: F.row(F.number('Valor guardado (R$)', 'v', M.goalCalc(g).monthly ? U.round(M.goalCalc(g).monthly) : '', 'required'), F.date('Data', 'date', U.today())) + (M.accounts().length ? F.check('Descontar do saldo da conta principal', 'debit', true) : ''),
    onSubmit: (d) => { if (!d.v) return false; App.commit((s) => {
      const x = s.goals.find((y) => y.id === g.id); x.saved = U.round((x.saved || 0) + d.v); (x.log = x.log || []).push({ date: d.date, v: d.v });
      if (d.debit && M.mainAcc()) s.transactions.push({ id: U.uid(), date: d.date, desc: `Guardado para ${g.name}`, value: d.v, kind: 'expense', categoryId: 'metas', accountId: M.mainAcc().id, account: M.mainAcc().name, source: 'meta' });
    }); App.toast(`+${U.moneyTxt(d.v)} na meta ${g.emoji || '🎯'}`); },
  });

  M.actions = {
    addAcc: () => accModal(), editAcc: (t) => accModal(M.acc(t.dataset.id)),
    addRule: () => ruleModal(), editRule: (t) => ruleModal(M.rules().find((r) => r.id === t.dataset.id)),
    addGoal: () => goalModal(), editGoal: (t) => goalModal(M.goals().find((g) => g.id === t.dataset.id)),
    saveGoal: (t) => saveModal(M.goals().find((g) => g.id === t.dataset.id)),
    pauseGoal: (t) => App.commit(() => { const g = M.goals().find((x) => x.id === t.dataset.id); g.paused = !g.paused; }),
    quickTx: (form) => {
      const d = App.formData(form); if (!d.desc || !d.value) return;
      const acc = M.acc(d.accountId) || M.mainAcc();
      App.commit((s) => s.transactions.push({ id: U.uid(), date: d.date || U.today(), desc: d.desc, value: Math.abs(d.value), kind: d.kind, categoryId: d.kind === 'income' ? 'salario' : App.parse.categorize(d.desc), accountId: acc && acc.id, account: acc && acc.name, source: 'manual' }));
      App.toast(`${d.kind === 'income' ? '+' : '−'}${U.moneyTxt(d.value)} · saldo agora ${U.moneyTxt(M.totalBalance())}`);
    },
    hmDay: (t) => { const v = App.views.financas; v.S.period = 'dia'; v.S.ref = t.dataset.d; App.go('financas/gastos'); },
  };
  M.accCard = accCard;
})(window.App);
