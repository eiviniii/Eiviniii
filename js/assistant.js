/* ==========================================================
   NOTA DE SAÚDE FINANCEIRA + ASSISTENTE LOCAL (sem IA paga)
   O assistente entende perguntas comuns por padrões de texto
   e responde com os seus dados — offline e de graça.
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U;
  const st = () => App.state;

  /* ==========================================================
     NOTA 0–100
     ========================================================== */
  const Sc = (App.Score = {});
  Sc.compute = () => {
    const Fin = App.Fin, M = App.Money, b = M.budget();
    const prevMonths = [1, 2, 3].map((i) => U.addMonthsYM(U.ym(), -i));
    const avgExp = (U.sum(prevMonths, (m) => Fin.monthExpenses(m)) / 3) || Fin.monthExpenses(U.ym()) || 0;
    const income = b.salary || (U.sum(prevMonths, (m) => Fin.monthIncome(m)) / 3) || 0;
    const liquid = M.totalBalance() + U.sum(st().fixed, (f) => App.Inv.fixedValue(f).net) + U.sum(st().otherAssets.filter((a) => a.kind === 'reserva' || a.kind === 'conta'), (a) => a.value);
    const parts = [];
    const add = (key, label, pts, txt, tip) => parts.push({ key, label, pts: Math.round(U.clamp(pts, 0, 20)), txt, tip });
    // 1) reserva de emergência (meses de gasto cobertos)
    if (avgExp > 0) { const m = liquid / avgExp; add('reserva', '🛟 Reserva de emergência', (m / 6) * 20, `${U.fmt(m, 1)} mês(es) de gastos guardados`, m < 6 ? `Junte ${U.moneyTxt(Math.max(0, avgExp * 6 - liquid))} para ter 6 meses de reserva.` : ''); }
    else add('reserva', '🛟 Reserva de emergência', 10, 'sem gastos registrados ainda', 'Suba suas faturas para eu medir sua reserva.');
    // 2) quanto sobra do salário
    if (income > 0) { const p = (b.free / income) * 100; add('sobra', '💵 Sobra do salário', p >= 20 ? 20 : p <= 0 ? 0 : (p / 20) * 20, `${U.fmt(p, 0)}% do salário sobra livre`, p < 10 ? 'Tente deixar ao menos 10% do salário livre no orçamento.' : ''); }
    else add('sobra', '💵 Sobra do salário', 10, 'salário não cadastrado', 'Cadastre seu salário em Finanças → Contas & saldo.');
    // 3) peso das parcelas/dívidas
    if (income > 0) { const r = Fin.instMonthTotal(U.ym()) / income; add('dividas', '🔁 Parcelas e dívidas', r <= 0.1 ? 20 : r >= 0.5 ? 0 : 20 - ((r - 0.1) / 0.4) * 20, `parcelas comem ${U.fmt(r * 100, 0)}% da renda`, r > 0.3 ? 'Evite novas parcelas até cair abaixo de 30% da renda.' : ''); }
    else add('dividas', '🔁 Parcelas e dívidas', st().installments.length ? 10 : 20, `${st().installments.length} parcelamento(s)`, '');
    // 4) investimentos
    const inv = App.Inv.totals().total, ap = App.Planner ? App.Planner.monthlyAporte() : 0;
    const invPts = income > 0 ? Math.min(20, (inv / (income * 12)) * 12 + (ap / income) * 80) : inv > 0 ? 12 : 0;
    add('invest', '📈 Investimentos', invPts, `${U.moneyTxt(inv)} investidos${ap ? ` · plano de ${U.moneyTxt(ap)}/mês` : ''}`, invPts < 12 ? 'Defina um aporte mensal fixo em Investimentos → Planejamento (mesmo pequeno).' : '');
    // 5) controle do dia a dia
    let ctrl = 20; const late = App.Agenda.overdue().length, cur = Fin.monthExpenses(U.ym()), inc = Fin.monthIncome(U.ym());
    if (late) ctrl -= 8; if (inc && cur > inc) ctrl -= 8; if (!st().transactions.some((t) => t.date >= U.addDays(U.today(), -40))) ctrl -= 6;
    add('controle', '🧭 Controle', ctrl, [late ? `${late} conta(s) atrasada(s)` : 'contas em dia', inc && cur > inc ? 'gastando mais que a receita' : ''].filter(Boolean).join(' · '), late ? 'Pague as contas atrasadas primeiro — juros de atraso são os mais caros.' : inc && cur > inc ? 'Este mês os gastos passaram da receita: segure o variável.' : '');
    const score = U.sum(parts, (p) => p.pts);
    const level = score >= 80 ? ['Excelente', '#22c55e'] : score >= 60 ? ['Boa', '#84cc16'] : score >= 40 ? ['Atenção', '#eab308'] : ['Crítica', '#ef4444'];
    return { score, parts, level: level[0], color: level[1], tips: parts.filter((p) => p.tip).sort((a, b) => a.pts - b.pts).slice(0, 3).map((p) => p.tip) };
  };
  Sc.card = () => {
    const s = Sc.compute(), R = 46, C = 2 * Math.PI * R;
    return `<div class="card score-card"><header><h3>🩺 Saúde financeira</h3><span class="chip" style="color:${s.color}">● ${s.level}</span></header>
      <div class="score-wrap"><div class="score-ring"><svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="${R}" stroke="var(--line)"/><circle cx="55" cy="55" r="${R}" stroke="${s.color}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - s.score / 100)}" stroke-linecap="round"/></svg><div><b>${s.score}</b><small>de 100</small></div></div>
        <div class="list grow">${s.parts.map((p) => `<div class="li" title="${U.esc(p.txt)}"><div class="grow"><div class="t" style="font-size:.88rem">${p.label}</div><div class="s">${U.esc(p.txt)}</div></div><b>${p.pts}<small class="muted">/20</small></b></div>`).join('')}</div></div>
      ${s.tips.length ? `<div class="mt">${s.tips.map((t) => `<div class="tip">💡 ${U.esc(t)}</div>`).join('')}</div>` : '<div class="tip">🏆 Mandou bem! Continue assim.</div>'}</div>`;
  };

  /* ==========================================================
     ASSISTENTE
     ========================================================== */
  const As = (App.Assistant = {});
  const MES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  /** período mencionado na pergunta → { from, to, label } */
  const period = (q, def = 'mes') => {
    const t = U.today(), ym = U.ym();
    if (/\bhoje\b/.test(q)) return { from: t, to: t, label: 'hoje' };
    if (/\bontem\b/.test(q)) { const d = U.addDays(t, -1); return { from: d, to: d, label: 'ontem' }; }
    if (/semana passada/.test(q)) { const w = U.addDays(U.weekStart(t), -7); return { from: w, to: U.addDays(w, 6), label: 'na semana passada' }; }
    if (/(essa|esta|nessa|nesta) semana|\bsemana\b/.test(q)) return { from: U.weekStart(t), to: t, label: 'nesta semana' };
    if (/mes passado/.test(q)) { const m = U.addMonthsYM(ym, -1); const [a, b] = App.Fin.monthRange(m); return { from: a, to: b, label: 'em ' + U.ymLabel(m) }; }
    const mm = q.match(/(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+(?:de\s+)?(\d{4}))?/);
    if (mm) { let y = mm[2] ? +mm[2] : +t.slice(0, 4); const m = `${y}-${String(MES[mm[1]]).padStart(2, '0')}`; const use = m > ym && !mm[2] ? `${y - 1}${m.slice(4)}` : m; const [a, b] = App.Fin.monthRange(use); return { from: a, to: b, label: 'em ' + U.ymLabel(use) }; }
    if (/(esse|este|neste|nesse) ano|\bano\b/.test(q)) return { from: t.slice(0, 4) + '-01-01', to: t, label: 'neste ano' };
    if (/ultimos? (\d+) dias/.test(q)) { const n = +q.match(/ultimos? (\d+) dias/)[1]; return { from: U.addDays(t, -n + 1), to: t, label: `nos últimos ${n} dias` }; }
    if (def === 'mes' || /(esse|este|neste|nesse) mes|\bmes\b/.test(q)) { const [a, b] = App.Fin.monthRange(ym); return { from: a, to: b, label: 'neste mês' }; }
    return null;
  };
  /** categoria ou estabelecimento citado */
  const findCat = (q, exactOnly) => {
    if (exactOnly) { for (const c of st().categories) if (q.includes(U.norm(c.name))) return c; return null; }
    const syn = { comida: 'alimentacao', restaurante: 'alimentacao', lanche: 'alimentacao', ifood: 'alimentacao', delivery: 'alimentacao', supermercado: 'mercado', remedio: 'farmacia', gasolina: 'transporte', combustivel: 'transporte', uber: 'transporte', carro: 'transporte', roupa: 'vestuario', academia: 'fitness', luz: 'casa-contas', aluguel: 'casa-contas', curso: 'educacao', streaming: 'assinaturas', netflix: 'assinaturas', lazer: 'lazer' };
    for (const c of st().categories) if (q.includes(U.norm(c.name))) return c;
    for (const [w, id] of Object.entries(syn)) if (new RegExp(`\\b${w}`).test(q)) return st().categories.find((c) => c.id === id);
    return null;
  };
  const money = U.moneyTxt;
  const list = (rows) => `<ul class="as-list">${rows.map((r) => `<li>${r}</li>`).join('')}</ul>`;
  const expenses = (p) => App.Fin.tx(p.from, p.to).filter((t) => t.kind !== 'income' && !App.Fin.isTransfer(t));

  const INTENTS = [
    // quanto gastei (com X) (período)
    [/quanto (eu )?(gastei|gasto|paguei)|total (de )?gastos?|gastei quanto/, (q) => {
      const p = period(q);
      const words = q.replace(/\b(quanto|eu|gastei|gasto|paguei|com|de|do|da|no|na|em|esse|este|essa|esta|nesse|neste|mes|semana|hoje|ontem|ano|passad[ao]|ultimos?|dias?)\b/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !MES[w] && !/^\d+$/.test(w));
      let rows = expenses(p); let what = '';
      // prioridade: categoria pelo nome > estabelecimento citado (ex.: "uber") > sinônimo de categoria (ex.: "comida")
      const exact = findCat(q, true);
      const byMerchant = !exact && words.length ? rows.filter((t) => words.some((w) => U.norm(t.desc).includes(w))) : [];
      const c = exact || (!byMerchant.length ? findCat(q) : null);
      if (c) { rows = rows.filter((t) => t.categoryId === c.id); what = ` com ${c.icon} ${c.name}`; }
      else if (byMerchant.length) { rows = byMerchant; what = ` com “${words.join(' ')}”`; }
      const tot = U.sum(rows, (t) => t.value);
      return `Você gastou <b>${money(tot)}</b>${what} ${p.label} (${rows.length} lançamento${rows.length === 1 ? '' : 's'}).${rows.length ? list(rows.sort((a, b) => b.value - a.value).slice(0, 5).map((t) => `${U.dateBR(t.date).slice(0, 5)} · ${U.esc(t.desc)} — <b>${money(t.value)}</b>`)) : ''}`;
    }],
    [/onde (eu )?(mais )?gastei|maior(es)? gastos?|mais gastei|gastei mais/, (q) => {
      const p = period(q), rows = expenses(p), cats = App.Fin.byCategory(rows).slice(0, 5), tot = U.sum(rows, (t) => t.value);
      if (!rows.length) return `Não encontrei gastos ${p.label}.`;
      const top = rows.slice().sort((a, b) => b.value - a.value)[0];
      return `${p.label[0].toUpperCase() + p.label.slice(1)} você gastou <b>${money(tot)}</b>. Onde mais foi:${list(cats.map((c) => `${c.cat.icon} ${c.cat.name} — <b>${money(c.total)}</b> (${U.fmt((c.total / tot) * 100, 0)}%)`))}Maior gasto único: <b>${U.esc(top.desc)}</b> (${money(top.value)}, ${U.dateBR(top.date)}).`;
    }],
    [/resum[oa]|como (foi|esta|ta) (o |meu )?(mes|semana)|balanco/, (q) => {
      const p = period(q), rows = expenses(p), inc = U.sum(App.Fin.tx(p.from, p.to).filter((t) => t.kind === 'income'), (t) => t.value), tot = U.sum(rows, (t) => t.value);
      const cat = App.Fin.byCategory(rows)[0];
      const tr = st().workoutLogs.filter((l) => l.date >= p.from && l.date <= p.to).length, est = U.sum(st().sessions.filter((s) => s.date >= p.from && s.date <= p.to), (s) => s.minutes);
      const e = App.Fit.entries().filter((x) => x.weight), last = e[e.length - 1];
      return `📋 <b>Resumo ${p.label}</b>${list([`💸 Gastos: <b>${money(tot)}</b>${cat ? ` (mais em ${cat.cat.icon} ${cat.cat.name})` : ''}`, `💰 Receitas: <b>${money(inc)}</b> · saldo do período ${money(inc - tot)}`, `🏋️ Treinos: <b>${tr}</b>`, `📚 Estudo: <b>${App.Study.hm(est)}</b>`, last ? `⚖️ Peso atual: <b>${U.fmt(last.weight, 1)} kg</b>` : '', `🩺 Nota financeira: <b>${Sc.compute().score}/100</b>`].filter(Boolean))}`;
    }],
    [/saldo|quanto (eu )?tenho|dinheiro (na|em) conta/, () => { const f = App.Money.forecast(); return `Saldo nas contas: <b>${money(f.bal)}</b>. Até o fim do mês entram ${money(f.pendIncome)} e saem ${money(f.out)} em contas — deve sobrar <b>${money(f.end)}</b>.`; }],
    [/parcela|quanto (falta|devo) pagar|divida/, () => { const free = App.Fin.freeMonth(); return `Parcelas deste mês: <b>${money(App.Fin.instMonthTotal(U.ym()))}</b> · total ainda a pagar: <b>${money(App.Fin.debtTotal())}</b>${free ? ` · livre em <b>${U.ymLabel(free)}</b>` : ' · nenhuma parcela em aberto 🎉'}.`; }],
    [/meta|casamento|juntar|guardar/, (q) => {
      const gs = App.Money.goals(); if (!gs.length) return 'Você ainda não tem metas. Crie em Finanças → Orçamento & metas.';
      const g = gs.find((x) => q.includes(U.norm(x.name))) ; const sel = g ? [g] : gs;
      return list(sel.map((x) => { const c = App.Money.goalCalc(x); return `${U.esc(x.emoji || '🎯')} <b>${U.esc(x.name)}</b>: ${money(x.saved || 0)} de ${money(x.target)} (${U.fmt(c.pct, 0)}%)${c.done ? ' — atingida 🏆' : c.end ? ` · faltam ${money(c.left)} · chega em <b>${U.ymLabel(c.end)}</b>` : ''}`; }));
    }],
    [/vence|vencimento|validade/, (q) => {
      const docs = (st().docs || []).filter((d) => d.expiry && (q.includes(U.norm(d.title)) || U.norm(d.title).split(' ').some((w) => w.length > 2 && q.includes(w))));
      if (docs.length) return list(docs.map((d) => { const e = App.Docs.expiry(d); return `${App.Docs.cat(d.category).icon} <b>${U.esc(d.title)}</b>: validade ${U.dateBR(d.expiry)} (${e.txt})`; }));
      const up = App.Agenda.upcoming(30).filter((o) => o.type === 'conta' || o.type === 'fatura' || o.type === 'documento' || o.type === 'veiculo');
      return up.length ? `Próximos vencimentos:${list(up.slice(0, 6).map((o) => `${App.Agenda.type(o.type).icon} ${U.esc(o.title)} — ${U.dateNice(o.date)}${o.value ? ' · ' + money(o.value) : ''}`))}` : 'Nada vencendo nos próximos 30 dias. ✅';
    }],
    [/prova|concurso|taf/, () => {
      const cs = (st().concursos || []).filter((c) => c.provaDate && c.provaDate >= U.today()).sort((a, b) => a.provaDate.localeCompare(b.provaDate));
      return cs.length ? list(cs.map((c) => `📝 <b>${U.esc(c.name)}</b>: prova ${U.dateBR(c.provaDate)} (faltam <b>${U.diffDays(U.today(), c.provaDate)} dias</b>)${c.tafDate ? ` · TAF ${U.dateBR(c.tafDate)}` : ''}${c.topics && c.topics.length ? ` · edital ${App.EditalMap ? App.EditalMap.pct(c) : 0}% estudado` : ''}`)) : 'Nenhuma prova futura cadastrada.';
    }],
    [/proxim[oa]s?|agenda|compromisso|o que tenho/, () => { const up = App.Agenda.upcoming(7).filter((o) => !o.done); return up.length ? `Próximos 7 dias:${list(up.slice(0, 8).map((o) => `${App.Agenda.type(o.type).icon} ${U.esc(o.title)} — ${U.dateNice(o.date)}${o.time ? ' ' + o.time : ''}`))}` : 'Sua agenda está livre nos próximos 7 dias.'; }],
    [/peso|gordura|massa|imc|corpo/, () => {
      const e = App.Fit.entries().map(App.Fit.enrich); if (!e.length) return 'Ainda não há medições corporais.';
      const l = e[e.length - 1], f = e[0];
      return `Última medição (${U.dateBR(l.date)}): ${l.weight ? `<b>${U.fmt(l.weight, 1)} kg</b>` : ''}${l.fat ? ` · gordura <b>${U.fmt(l.fat, 1)}%</b>` : ''}${l.muscle ? ` · músculo ${U.fmt(l.muscle, 1)} kg` : ''}.${f !== l && f.weight && l.weight ? ` Desde o início: <b>${l.weight - f.weight > 0 ? '+' : ''}${U.fmt(l.weight - f.weight, 1)} kg</b>.` : ''}`;
    }],
    [/estudei|horas de estudo|quanto estud/, (q) => { const p = period(q, 'semana') || period('semana'); const s = st().sessions.filter((x) => x.date >= p.from && x.date <= p.to); const by = App.Fin ? U.groupBy(s, (x) => x.subjectId) : {}; return `Você estudou <b>${App.Study.hm(U.sum(s, (x) => x.minutes))}</b> ${p.label}.${Object.keys(by).length ? list(Object.entries(by).map(([id, arr]) => `${U.esc((st().subjects.find((x) => x.id === id) || { name: 'Geral' }).name)}: ${App.Study.hm(U.sum(arr, (x) => x.minutes))}`)) : ''}`; }],
    [/trein/, (q) => { const p = period(q, 'semana') || period('semana'); const n = st().workoutLogs.filter((l) => l.date >= p.from && l.date <= p.to).length; return `Você registrou <b>${n} treino(s)</b> ${p.label}. Sequência: ${App.Fit.streakWeeks()} semana(s) seguidas.`; }],
    [/nota|saude financeira|score/, () => { const s = Sc.compute(); return `Sua nota de saúde financeira é <b>${s.score}/100</b> (${s.level}).${s.tips.length ? list(s.tips.map((t) => '💡 ' + U.esc(t))) : ''}`; }],
    [/consumo|km\/l|abastec/, () => { const c = App.Vehicle && App.Vehicle.current(); if (!c) return 'Nenhum veículo cadastrado.'; const f = App.Vehicle.fuelStats(c); return f.n ? `${U.esc(c.name)}: média <b>${U.fmt(f.kmL, 1)} km/L</b> · <b>${money(f.perKm)}/km</b> · rodou ${U.fmt(f.monthKm, 0)} km este mês.` : 'Registre abastecimentos com os km rodados para eu calcular.'; }],
    [/dividendo|renda passiva|fii|investi/, () => { const t = App.Inv.totals(); return `Patrimônio investido: <b>${money(t.total)}</b> · renda passiva estimada: <b>${money(t.income)}/mês</b> (FIIs ${money(t.fiiIncome)} · renda fixa ${money(t.fixedIncome)}).`; }],
    [/assinatura/, () => { const s = App.Subs.detect(); return s.length ? `Encontrei <b>${s.length}</b> cobrança(s) recorrente(s), total <b>${money(U.sum(s, (x) => x.avg))}/mês</b>:${list(s.map((x) => `${U.esc(x.name)} — ${money(x.avg)}`))}` : 'Não encontrei assinaturas recorrentes.'; }],
    [/remedio|suplemento|tomei|tomar/, () => (App.Health ? App.Health.answer() : '')],
    [/dorm|sono|humor/, () => (App.Health ? App.Health.sleepAnswer() : '')],
  ];
  As.EXAMPLES = ['Quanto gastei com comida esse mês?', 'Onde mais gastei em outubro?', 'Resuma meu mês', 'Quanto tenho de saldo?', 'Quando vence minha CNH?', 'Quanto falta para a meta?', 'Quanto estudei essa semana?', 'Qual minha nota financeira?', 'Qual o consumo do carro?'];
  As.isQuestion = (q) => /\?$/.test(q.trim()) || /^(quanto|quantos|quantas|qual|quais|onde|quando|como|resum|o que|me mostra|mostre)/.test(U.norm(q));
  As.ask = (raw) => {
    const q = U.norm(raw).replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ');
    for (const [re, fn] of INTENTS) if (re.test(q)) { try { const r = fn(q); if (r) return r; } catch (e) { console.warn(e); } }
    return `Ainda não sei responder isso 😅. Experimente:${list(As.EXAMPLES.slice(0, 5).map((x) => `<a href="#" data-asq="${U.esc(x)}">${U.esc(x)}</a>`))}`;
  };

  As.open = (first) => {
    const log = [];
    const m = App.modal({
      title: '💬 Pergunte ao Vida OS', wide: true, hideFooter: true,
      body: `<div class="as-chat" id="as-chat"><div class="as-msg bot">Oi! Posso responder sobre seus <b>gastos, saldo, parcelas, metas, documentos, agenda, provas, estudo, treinos, corpo, carro e investimentos</b>. Funciono offline, sem IA paga. 🙂</div></div>
        <div class="row" style="margin:8px 0">${As.EXAMPLES.map((x) => `<button type="button" class="chip" data-asq="${U.esc(x)}">${U.esc(x)}</button>`).join('')}</div>
        <div class="inline-form"><input id="as-in" placeholder="Pergunte algo… ex.: quanto gastei com mercado em outubro?" style="flex:1" autocomplete="off"><button type="button" class="btn primary" id="as-go">Perguntar</button></div>`,
    });
    const chat = m.form.querySelector('#as-chat'), inp = m.form.querySelector('#as-in');
    const send = (q) => {
      if (!q.trim()) return;
      chat.insertAdjacentHTML('beforeend', `<div class="as-msg me">${U.esc(q)}</div><div class="as-msg bot">${As.ask(q)}</div>`);
      chat.scrollTop = chat.scrollHeight; inp.value = ''; inp.focus(); log.push(q);
    };
    m.form.querySelector('#as-go').onclick = () => send(inp.value);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(inp.value); } });
    m.form.addEventListener('click', (e) => { const a = e.target.closest('[data-asq]'); if (a) { e.preventDefault(); send(a.dataset.asq); } });
    setTimeout(() => inp.focus(), 60);
    if (first) send(first);
  };
  App.globalActions.assistant = () => As.open();
})(window.App);
