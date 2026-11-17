/* ==========================================================
   ASSINATURAS (detectadas) · LISTA DE COMPRAS · CONQUISTAS
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;

  /* ==========================================================
     ASSINATURAS — cobranças que se repetem todo mês
     ========================================================== */
  const Sub = (App.Subs = {});
  Sub.detect = () => {
    const ignore = new Set(st().subsIgnore || []);
    const from = U.addMonthsYM(U.ym(), -3) + '-01';
    const tx = App.Fin.tx(from, U.today()).filter((t) => t.kind !== 'income' && !App.Fin.isTransfer(t) && !t.ruleKey && !t.eventKey && !App.parse.installmentInfo(t.desc));
    const groups = U.groupBy(tx, (t) => App.parse.merchantKey(t.desc));
    const out = [];
    for (const [k, arr] of Object.entries(groups)) {
      if (!k || ignore.has(k)) continue;
      const months = new Set(arr.map((t) => t.date.slice(0, 7)));
      const vals = arr.map((t) => t.value), mx = Math.max(...vals), mn = Math.min(...vals);
      const isSubCat = arr.some((t) => t.categoryId === 'assinaturas');
      const steady = mn > 0 && mx / mn <= 1.15 && arr.length <= months.size + 1;
      if (!(months.size >= 2 && steady) && !(isSubCat && months.size >= 1)) continue;
      const last = arr.sort((a, b) => a.date.localeCompare(b.date))[arr.length - 1];
      const avg = U.sum(arr, (t) => t.value) / arr.length;
      const next = U.addDays(last.date, 30);
      out.push({ key: k, name: last.desc, cat: App.Fin.cat(last.categoryId), avg, last: last.date, next, months: months.size, sure: months.size >= 2 && steady });
    }
    return out.sort((a, b) => b.avg - a.avg);
  };
  Sub.view = () => {
    const subs = Sub.detect(), total = U.sum(subs, (s) => s.avg);
    return `<div class="grid g3"><div class="card accent stat"><div class="lbl">Assinaturas e cobranças fixas</div><div class="val">${U.money(total)}<small style="font-size:.9rem">/mês</small></div><div class="sub">${U.money(total * 12)} por ano</div></div>
      <div class="card stat"><div class="lbl">Encontradas</div><div class="val">${subs.length}</div><div class="sub">nos últimos 3 meses de lançamentos</div></div>
      <div class="card stat"><div class="lbl">Próxima cobrança</div><div class="val" style="font-size:1.1rem">${subs.length ? (() => { const n = subs.slice().sort((a, b) => a.next.localeCompare(b.next))[0]; return `${U.esc(n.name.slice(0, 22))}<br><small class="muted">~${U.dateBR(n.next)} · ${U.moneyTxt(n.avg)}</small>`; })() : '—'}</div></div></div>
      <div class="card mt"><header><h3>🔁 Detectadas automaticamente</h3><small class="muted">mesmo estabelecimento, valor parecido, todo mês</small></header>
        ${subs.length ? `<div class="list">${subs.map((s) => `<div class="li"><div class="ico" style="background:${App.alpha(s.cat.color, .18)}">${s.cat.icon}</div><div class="grow"><div class="t">${U.esc(s.name)}</div><div class="s">${s.months} mês(es) seguidos · última ${U.dateBR(s.last)} · próxima ~${U.dateBR(s.next)}${s.sure ? '' : ' · <span class="chip">possível</span>'}</div></div><b>${U.money(s.avg)}</b><small class="muted" style="min-width:90px;text-align:right">${U.money(s.avg * 12)}/ano</small><button class="icon-btn" title="não é assinatura" data-act="subIgnore" data-k="${U.esc(s.key)}">✕</button></div>`).join('')}</div>
          <div class="note mt">💡 Cancelar uma assinatura de ${U.moneyTxt(subs[subs.length - 1].avg)} que você pouco usa economiza ${U.moneyTxt(subs[subs.length - 1].avg * 12)} por ano.</div>`
          : App.empty('🔁', 'Nada recorrente ainda', 'Suba as faturas de 2 ou 3 meses: eu identifico Netflix, Spotify, academia, planos e outras cobranças que se repetem.')}
        ${(st().subsIgnore || []).length ? `<p class="muted mt"><small>${st().subsIgnore.length} ignorada(s) · <a href="#" data-act="subReset">mostrar de novo</a></small></p>` : ''}</div>`;
  };
  Sub.actions = {
    subIgnore: (t) => App.commit((s) => { s.subsIgnore = s.subsIgnore || []; s.subsIgnore.push(t.dataset.k); }),
    subReset: (t, e) => { e.preventDefault(); App.commit((s) => { s.subsIgnore = []; }); },
  };

  /* ==========================================================
     LISTA DE COMPRAS — com histórico de preços
     ========================================================== */
  const Shop = (App.Shop = {});
  const items = () => (st().shop = st().shop || []);
  const prices = () => (st().prices = st().prices || {}); // nome normalizado -> { name, h: [{date, price, store}] }
  const hist = (k) => (prices()[k] || { h: [] }).h;
  const SEC = { hortifruti: '🥬 Hortifrúti', acougue: '🥩 Açougue', padaria: '🥖 Padaria', laticinios: '🧀 Frios e laticínios', mercearia: '🥫 Mercearia', bebidas: '🥤 Bebidas', limpeza: '🧼 Limpeza', higiene: '🧴 Higiene', congelados: '🧊 Congelados', outros: '🛒 Outros' };
  const GUESS = [['hortifruti', /banana|maca|tomate|alface|cebola|batata|alho|cenoura|fruta|laranja|limao|ovo|ovos/], ['acougue', /carne|frango|peixe|patinho|alcatra|linguica|file|bife|moida/], ['padaria', /pao|bolo|biscoito|bolacha/], ['laticinios', /leite|queijo|presunto|iogurte|manteiga|requeijao/], ['bebidas', /agua|refri|suco|cerveja|cafe|cha /], ['limpeza', /sabao|detergente|amaciante|desinfet|agua sanit|esponja|papel toalha|saco de lixo/], ['higiene', /shampoo|sabonete|pasta de dente|papel higien|desodorante|escova/], ['congelados', /sorvete|congelad|pizza|lasanha/], ['mercearia', /arroz|feijao|macarrao|oleo|acucar|sal|farinha|molho|aveia|whey|cafe/]];
  const guess = (n) => { const x = U.norm(n); return (GUESS.find(([, re]) => re.test(x)) || ['outros'])[0]; };
  Shop.priceInfo = (name) => {
    const h = hist(U.norm(name)); if (!h.length) return null;
    const last = h[h.length - 1], min = h.reduce((a, b) => (b.price < a.price ? b : a));
    const prev = h.length > 1 ? h[h.length - 2] : null;
    return { last, min, avg: U.sum(h, (x) => x.price) / h.length, n: h.length, trend: prev ? last.price - prev.price : 0 };
  };
  Shop.view = () => {
    const list = items(), pending = list.filter((i) => !i.got), got = list.filter((i) => i.got);
    const est = U.sum(list, (i) => (Shop.priceInfo(i.name) ? Shop.priceInfo(i.name).last.price * (+i.qty || 1) : 0));
    const cartTotal = U.sum(got, (i) => (+i.price || 0) * (+i.qty || 1));
    const frequent = Object.entries(prices()).filter(([k]) => !list.some((i) => U.norm(i.name) === k)).sort((a, b) => b[1].h.length - a[1].h.length).slice(0, 12);
    const bySec = U.groupBy(pending, (i) => i.sec || guess(i.name));
    const row = (i) => { const p = Shop.priceInfo(i.name); return `<div class="task ${i.got ? 'done' : ''}"><button class="tick" data-act="shTick" data-id="${i.id}">${i.got ? '✓' : ''}</button>
      <div class="grow"><div class="t">${U.esc(i.name)} ${+i.qty > 1 ? `<small class="muted">× ${i.qty}</small>` : ''}</div>${p ? `<div class="s">último ${U.moneyTxt(p.last.price)}${p.last.store ? ' (' + U.esc(p.last.store) + ')' : ''} · menor ${U.moneyTxt(p.min.price)}${p.min.store ? ' no ' + U.esc(p.min.store) : ''}${p.trend > 0 ? ' · <span style="color:var(--bad)">▲ subiu</span>' : p.trend < 0 ? ' · <span style="color:var(--ok)">▼ caiu</span>' : ''}</div>` : ''}</div>
      ${i.got ? `<input class="cell" type="number" step="0.01" placeholder="R$" value="${i.price || ''}" data-change="shPrice" data-id="${i.id}" style="width:90px">` : ''}<button class="icon-btn" data-act="shDel" data-id="${i.id}">✕</button></div>`; };
    return `<div class="grid g3">
      <div class="card span2"><header><h3>🛒 Lista de compras</h3><small class="muted">${pending.length} para comprar${est ? ' · estimativa ' + U.moneyTxt(est) : ''}</small></header>
        <form data-submit="shAdd" class="inline-form" style="margin-bottom:12px"><input name="name" placeholder="Adicionar item (ex.: arroz 5kg)" style="flex:1;min-width:180px" autocomplete="off" list="sh-hist"><input name="qty" type="number" min="1" value="1" style="width:70px"><button class="btn primary">＋</button></form>
        <datalist id="sh-hist">${Object.values(prices()).map((v) => `<option value="${U.esc(v.name)}">`).join('')}</datalist>
        ${pending.length ? Object.entries(bySec).sort().map(([s, arr]) => `<h4 class="sh-sec">${SEC[s] || SEC.outros}</h4>${arr.map(row).join('')}`).join('') : (list.length ? '' : App.empty('🛒', 'Lista vazia', 'Adicione o que precisa comprar. Ao marcar como pego, digite o preço — eu guardo o histórico e mostro onde está mais barato.'))}
        ${got.length ? `<h4 class="sh-sec">✅ No carrinho</h4>${got.map(row).join('')}
          <div class="row between mt"><b>Total no carrinho: ${U.money(cartTotal)}</b><button class="btn primary" data-act="shFinish">✔ Finalizar compra</button></div>` : ''}</div>
      <div class="stack">
        ${frequent.length ? `<div class="card"><header><h3>⭐ Compra de sempre</h3></header><div class="row">${frequent.map(([k, v]) => `<button class="chip" data-act="shQuick" data-n="${U.esc(v.name || k)}">＋ ${U.esc(v.name || k)}</button>`).join('')}</div></div>` : ''}
        <div class="card"><header><h3>📈 Histórico de preços</h3></header>${Object.keys(prices()).length ? `<div class="list">${Object.entries(prices()).slice(0, 12).map(([k, v]) => { const p = Shop.priceInfo(k); return `<div class="li"><div class="grow"><div class="t">${U.esc(v.name || k)}</div><div class="s">${p.n} compra(s) · média ${U.moneyTxt(p.avg)}</div></div><b>${U.moneyTxt(p.last.price)}</b></div>`; }).join('')}</div>` : '<p class="muted">Aparece conforme você finaliza compras.</p>'}</div>
      </div></div>`;
  };
  Shop.actions = {
    shAdd: (form) => { const d = App.formData(form); const n = (d.name || '').trim(); if (!n) return; App.commit(() => items().push({ id: U.uid(), name: n, qty: d.qty || 1, sec: guess(n) })); setTimeout(() => { const i = document.querySelector('[data-submit=shAdd] [name=name]'); i && i.focus(); }, 30); },
    shQuick: (t) => App.commit(() => items().push({ id: U.uid(), name: t.dataset.n, qty: 1, sec: guess(t.dataset.n) })),
    shTick: (t) => App.commit(() => { const i = items().find((x) => x.id === t.dataset.id); i.got = !i.got; if (i.got && !i.price) { const p = Shop.priceInfo(i.name); if (p) i.price = p.last.price; } }),
    shPrice: (t) => { const i = items().find((x) => x.id === t.dataset.id); i.price = U.num(t.value); App.save(); App.rerender(); },
    shDel: (t) => App.commit((s) => { s.shop = items().filter((x) => x.id !== t.dataset.id); }),
    shFinish: () => {
      const got = items().filter((i) => i.got); const total = U.sum(got, (i) => (+i.price || 0) * (+i.qty || 1));
      App.modal({ title: 'Finalizar compra', submitLabel: 'Finalizar',
        body: F.row(F.text('Mercado', 'store', '', 'placeholder="Ex.: Bistek" list="sh-stores"'), F.date('Data', 'date', U.today()), F.number('Total pago (R$)', 'total', U.round(total))) + `<datalist id="sh-stores">${[...new Set(Object.values(prices()).flatMap((v) => v.h).map((x) => x.store).filter(Boolean))].map((x) => `<option value="${U.esc(x)}">`).join('')}</datalist>` +
          F.check('Lançar nos gastos (Mercado)', 'toTx', true) + '<p class="muted"><small>Se pagou no cartão de crédito, desmarque — a fatura já vai trazer este gasto (e a antiduplicação evita repetir).</small></p>',
        onSubmit: (d) => App.commit((s) => {
          for (const i of got) { if (+i.price) { const k = U.norm(i.name); const v = (prices()[k] = prices()[k] || { name: i.name, h: [] }); v.name = i.name; v.h.push({ date: d.date, price: +i.price, store: d.store }); } }
          if (d.toTx && d.total) s.transactions.push({ id: U.uid(), date: d.date, desc: `Mercado${d.store ? ' — ' + d.store : ''}`, value: d.total, kind: 'expense', categoryId: 'mercado', accountId: (App.Money.mainAcc() || {}).id, account: (App.Money.mainAcc() || {}).name, source: 'compras' });
          s.shop = items().filter((i) => !i.got);
          App.toast(`🛒 Compra finalizada · ${U.moneyTxt(d.total)}`);
        }) });
    },
  };

  /* ==========================================================
     CONQUISTAS — XP, níveis e medalhas
     ========================================================== */
  const A = (App.Achv = {});
  const studyH = () => U.sum(st().sessions, (s) => s.minutes) / 60;
  const habitDays = () => U.sum(st().habits || [], (h) => Object.keys(h.log || {}).length);
  const doneTasks = () => (st().tasks || []).filter((t) => t.done).length + (st().tasksDoneCount || 0);
  A.xp = () => Math.round(st().workoutLogs.length * 25 + studyH() * 12 + habitDays() * 5 + doneTasks() * 3 + st().body.length * 10 + (st().docs || []).length * 5 + st().transactions.length * 0.2 + U.sum(st().goals || [], (g) => Math.min(g.saved || 0, g.target) / 100));
  A.level = (xp = A.xp()) => { let lv = 1, need = 100, acc = 0; while (xp >= acc + need) { acc += need; lv++; need = Math.round(need * 1.25); } return { lv, cur: xp - acc, need, pct: ((xp - acc) / need) * 100, title: ['Iniciante', 'Aprendiz', 'Focado', 'Disciplinado', 'Dedicado', 'Imparável', 'Mestre', 'Lenda'][Math.min(7, Math.floor((lv - 1) / 3))] }; };
  const monthsGreen = () => { let n = 0; for (let i = 1; i <= 12; i++) { const m = U.addMonthsYM(U.ym(), -i); const inc = App.Fin.monthIncome(m), exp = App.Fin.monthExpenses(m); if (inc && inc > exp) n++; } return n; };
  const firstLast = (k) => { const e = App.Fit.entries().filter((x) => x[k]); return e.length > 1 ? e[0][k] - e[e.length - 1][k] : 0; };
  // [id, ícone, nome, descrição, progresso(0..1)]
  A.list = () => {
    const w = st().workoutLogs.length, h = studyH(), ess = App.Docs ? App.Docs.ESSENTIALS.length : 14;
    const essHave = App.Docs ? App.Docs.ESSENTIALS.filter(([, , keys]) => (st().docs || []).some((d) => keys.some((k) => (' ' + U.norm(d.title) + ' ').includes(k)))).length : 0;
    const bestHabit = Math.max(0, ...(st().habits || []).map((x) => App.Rotina.streak(x)));
    const reserve = App.Money ? App.Money.totalBalance() + App.Inv.totals().total : 0;
    return [
      ['treino1', '🏋️', 'Primeiro treino', 'Registre seu primeiro treino', w / 1], ['treino10', '💪', 'Constância', '10 treinos registrados', w / 10], ['treino50', '🦾', 'Máquina', '50 treinos registrados', w / 50], ['treino100', '🏆', 'Centurião', '100 treinos', w / 100],
      ['estudo10', '📚', 'Estudante', '10 horas de estudo', h / 10], ['estudo50', '🎓', 'Concurseiro', '50 horas de estudo', h / 50], ['estudo200', '🧠', 'Aprovado na raça', '200 horas de estudo', h / 200],
      ['streak7', '🔥', 'Semana em chamas', '7 dias seguidos de estudo', App.Study.streak() / 7], ['habito21', '🌱', 'Hábito formado', '21 dias seguidos num hábito', bestHabit / 21],
      ['tarefas50', '✅', 'Resolve tudo', '50 tarefas concluídas', doneTasks() / 50],
      ['peso5', '⚖️', 'Menos 5 kg', 'Perder 5 kg desde a 1ª medição', firstLast('weight') / 5], ['gordura3', '🔻', 'Secando', '−3 pontos de % de gordura', firstLast('fat') / 3],
      ['azul1', '💚', 'Mês no azul', 'Receita maior que a despesa em um mês', monthsGreen() / 1], ['azul6', '💎', 'Meio ano no azul', '6 meses no azul', monthsGreen() / 6],
      ['reserva1k', '🛟', 'Primeira reserva', 'R$ 1.000 entre saldo e investimentos', reserve / 1000], ['reserva10k', '🏦', 'Reserva sólida', 'R$ 10.000 guardados', reserve / 10000],
      ['meta1', '🎯', 'Meta batida', 'Atingir uma meta financeira', (st().goals || []).some((g) => (g.saved || 0) >= g.target) ? 1 : Math.max(0, ...(st().goals || []).map((g) => (g.saved || 0) / g.target))],
      ['semparcelas', '🕊️', 'Livre das parcelas', 'Quitar todos os parcelamentos', st().installments.length && !st().installments.some((i) => !App.Fin.instStatus(i).done) ? 1 : 0],
      ['fii1', '🏢', 'Investidor', 'Primeiro fundo imobiliário', st().fiis.length ? 1 : 0], ['magico', '✨', 'Número mágico', 'Um FII que se paga sozinho', st().fiis.some((x) => { const c = App.Inv.fii(x); return c.magic && x.qty >= c.magic; }) ? 1 : 0],
      ['docs', '🗂️', 'Tudo em ordem', 'Todos os documentos essenciais guardados', essHave / ess], ['emergencia', '🆘', 'Precavido', 'Preencher a ficha de emergência', st().emergency && st().emergency.blood ? 1 : 0],
    ].map(([id, icon, name, desc, p]) => ({ id, icon, name, desc, p: U.clamp(p || 0, 0, 1), done: (p || 0) >= 1 }));
  };
  /** avisa medalhas novas (na 1ª vez só registra, sem avalanche de avisos) */
  A.check = U.debounce(() => {
    if (!App.state || !App.Rotina) return;
    const s = st(); const first = !s.achv; s.achv = s.achv || {};
    let changed = false;
    for (const a of A.list()) if (a.done && !s.achv[a.id]) { s.achv[a.id] = U.today(); changed = true; if (!first) App.toast(`🏆 Conquista desbloqueada: ${a.icon} ${a.name}!`); }
    if (changed || first) App.save();
  }, 800);
  A.view = () => {
    const L = A.level(), all = A.list(), done = all.filter((a) => a.done);
    return `<div class="grid g3"><div class="card accent"><div class="lvl"><div class="lvl-badge">${L.lv}</div><div><div style="font-size:1.3rem;font-weight:800">Nível ${L.lv} · ${L.title}</div><small>${U.fmt(A.xp(), 0)} XP no total</small></div></div>
        <div class="bar mt" style="background:rgba(255,255,255,.25);border:0"><i style="width:${L.pct}%;background:#fff"></i></div><small>${L.cur}/${L.need} XP para o nível ${L.lv + 1}</small></div>
      <div class="card stat"><div class="lbl">Medalhas</div><div class="val">${done.length} / ${all.length}</div><div class="sub">desbloqueadas</div></div>
      <div class="card"><header><h3>Como ganhar XP</h3></header><small class="muted">🏋️ treino +25 · 📚 hora de estudo +12 · ⚖️ medição +10 · 📁 documento +5 · 🔥 hábito +5 · ✅ tarefa +3 · 🎯 a cada R$100 guardado em metas +1</small></div></div>
      <div class="achv-grid mt">${all.map((a) => `<div class="achv ${a.done ? 'on' : ''}"><div class="achv-ico">${a.icon}</div><b>${a.name}</b><small>${a.desc}</small>${a.done ? `<span class="chip ok">${(st().achv || {})[a.id] ? 'desde ' + U.dateBR(st().achv[a.id]) : 'conquistada'}</span>` : `<div class="bar"><i style="width:${a.p * 100}%"></i></div><small class="muted">${Math.round(a.p * 100)}%</small>`}</div>`).join('')}</div>`;
  };
  A.widget = () => { const L = A.level(); return `<a href="#/rotina/conquistas" class="lvl-mini" title="Seu nível"><span class="lvl-badge sm">${L.lv}</span><span><b>${L.title}</b><small>${L.cur}/${L.need} XP</small></span></a>`; };
})(window.App);
