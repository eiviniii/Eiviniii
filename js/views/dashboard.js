/* ==========================================================
   INÍCIO — painel com tudo que importa hoje
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U;
  const st = () => App.state;

  const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
  const W = {};

  W.resumo = () => {
    const ym = U.ym(), Fin = App.Fin;
    const exp = Fin.monthExpenses(ym), inc = Fin.monthIncome(ym);
    const cats = Fin.byCategory(Fin.tx(...Fin.monthRange(ym)).filter((t) => !Fin.isTransfer(t)));
    const budget = U.sum(st().categories, (c) => c.budget || 0);
    return `<div class="card span2"><header><h3>💰 ${U.ymLabel(ym).replace(/^./, (c) => c.toUpperCase())}</h3><a class="btn sm ghost" href="#/financas">abrir</a></header>
      <div class="grid g3"><div class="stat"><div class="lbl">Gastos</div><div class="val">${U.money(exp)}</div>${budget ? `<div class="bar ${exp > budget ? 'over' : ''}"><i style="width:${Math.min(100, (exp / budget) * 100)}%"></i></div><div class="sub">${U.pct((exp / budget) * 100, 0)} do orçamento</div>` : ''}</div>
        <div class="stat"><div class="lbl">Receitas</div><div class="val">${U.money(inc)}</div></div>
        <div class="stat"><div class="lbl">Parcelas do mês</div><div class="val">${U.money(Fin.instMonthTotal(ym))}</div></div></div>
      <div class="chart-box sm mt"><canvas id="dash-6m"></canvas></div>
      ${cats.length ? `<div class="row mt">${cats.slice(0, 5).map((c) => `<span class="chip" style="border-color:${c.cat.color}">${c.cat.icon} ${U.esc(c.cat.name)} · ${U.money(c.total)}</span>`).join('')}</div>` : ''}
    </div>`;
  };
  W.agenda = () => {
    const up = App.Agenda.upcoming(14), late = App.Agenda.overdue();
    return `<div class="card"><header><h3>📅 Próximos 14 dias</h3><a class="btn sm ghost" href="#/agenda">agenda</a></header>
      ${late.length ? `<div class="note warn">⚠️ ${late.length} conta(s) atrasada(s) — ${U.money(U.sum(late, (x) => x.value))}</div>` : ''}
      ${up.length ? `<div class="list">${up.slice(0, 7).map((o) => App.Agenda.item(o, { noEdit: true })).join('')}</div>` : App.empty('🌤️', 'Nada marcado', 'Sua agenda está livre.')}</div>`;
  };
  W.treino = () => {
    const dp = App.Fit.dayPlan();
    const done = st().workoutLogs.find((l) => l.date === U.today());
    return `<div class="card"><header><h3>🏋️ Treino de hoje</h3><a class="btn sm ghost" href="#/fitness/registro">${done ? 'ver' : 'registrar'}</a></header>
      ${dp.items.length ? `<b>${U.esc(dp.name || U.DAYS[new Date().getDay()])}</b> ${done ? '<span class="chip ok">feito ✓</span>' : ''}<div class="list mt">${dp.items.slice(0, 6).map((it) => `<div class="li"><div class="ico">${it.type === 'run' ? '🏃' : it.type === 'strength' ? '🏋️' : '🧘'}</div><div class="grow"><div class="t">${U.esc(it.name)}</div><div class="s">${it.type === 'run' ? [it.distance && it.distance + ' km', it.duration && it.duration + ' min', it.intensity].filter(Boolean).join(' · ') : [it.sets && it.sets + '×' + (it.reps || ''), it.load && it.load + ' kg'].filter(Boolean).join(' · ')}</div></div></div>`).join('')}</div>` : App.empty('😴', 'Descanso', 'Nenhum treino planejado para hoje.', '<a class="btn sm" href="#/fitness/treino">montar plano</a>')}
      <div class="row mt"><span class="chip">${App.Fit.weekLogs().length} treino(s) nesta semana</span></div></div>`;
  };
  W.estudo = () => {
    const bl = App.Study.todayBlocks();
    const today = U.sum(st().sessions.filter((s) => s.date === U.today()), (s) => s.minutes);
    return `<div class="card"><header><h3>📚 Estudos de hoje</h3><a class="btn sm ghost" href="#/estudos">abrir</a></header>
      <div class="row" style="margin-bottom:10px"><span class="chip info">hoje ${App.Study.hm(today)}</span><span class="chip">semana ${App.Study.hm(App.Study.weekMinutes())}</span><span class="chip warn">🔥 ${App.Study.streak()} dia(s)</span></div>
      ${bl.length ? bl.map((b) => { const s = st().subjects.find((x) => x.id === b.subjectId) || { name: 'Geral', color: '#64748b' }; return `<div class="block" style="background:${s.color}"><b>${U.esc(s.name)}</b>${b.start || ''}${b.end ? '–' + b.end : ''} ${b.topic ? '· ' + U.esc(b.topic) : ''}</div>`; }).join('') : '<p class="muted">Nada no cronograma de hoje.</p>'}
      <a class="btn block mt" href="#/estudos">⏱️ Começar Pomodoro</a></div>`;
  };
  W.corpo = () => {
    const ents = App.Fit.entries().map(App.Fit.enrich);
    const e = ents[ents.length - 1], p = ents[ents.length - 2], f = ents[0];
    return `<div class="card"><header><h3>⚖️ Corpo</h3><a class="btn sm ghost" href="#/fitness">abrir</a></header>
      ${e ? `<div class="grid g2"><div class="stat"><div class="lbl">Peso</div><div class="val">${e.weight ? U.fmt(e.weight, 1) + ' kg' : '—'}</div>${p && e.weight && p.weight ? `<div class="sub ${e.weight <= p.weight ? 'delta good' : 'delta badd'}">${e.weight - p.weight > 0 ? '+' : ''}${U.fmt(e.weight - p.weight, 1)} kg</div>` : ''}</div>
        <div class="stat"><div class="lbl">Gordura</div><div class="val">${e.fat ? U.pct(e.fat, 1) : '—'}</div>${f !== e && e.fat && f.fat ? `<div class="sub ${e.fat <= f.fat ? 'delta good' : 'delta badd'}">${e.fat - f.fat > 0 ? '+' : ''}${U.fmt(e.fat - f.fat, 1)} p.p. desde o início</div>` : ''}</div></div>
        <div class="chart-box sm mt"><canvas id="dash-weight"></canvas></div><small class="muted">última medição ${U.relDays(e.date)}</small>`
      : App.empty('📏', 'Sem medições', 'Suba sua bioimpedância.', '<a class="btn sm" href="#/fitness">adicionar</a>')}</div>`;
  };
  W.parcelas = () => {
    const list = App.Fin.instMonth(U.ym());
    return `<div class="card"><header><h3>🔁 Parcelas deste mês</h3><a class="btn sm ghost" href="#/financas/parcelas">todas</a></header>
      ${list.length ? `<div class="list">${list.slice(0, 6).map((i) => { const s = App.Fin.instStatus(i); return `<div class="li"><div class="grow"><div class="t">${U.esc(i.desc)}</div><div class="s">${s.current}/${i.count} · faltam ${s.remaining}</div></div><b>${U.money(i.parcel)}</b></div>`; }).join('')}</div><div class="row between mt"><b>Total</b><b>${U.money(App.Fin.instMonthTotal(U.ym()))}</b></div>` : App.empty('🎉', 'Sem parcelas', 'Nenhuma parcela neste mês.')}</div>`;
  };
  W.concursos = () => {
    const list = st().concursos.filter((c) => c.provaDate && c.provaDate >= U.today()).sort((a, b) => a.provaDate.localeCompare(b.provaDate));
    return `<div class="card"><header><h3>⏳ Provas</h3><a class="btn sm ghost" href="#/estudos/concursos">concursos</a></header>
      ${list.length ? list.slice(0, 3).map((c) => { const d = U.diffDays(U.today(), c.provaDate); return `<div class="li"><div class="grow"><div class="t">${U.esc(c.name)}</div><div class="s">${U.dateNice(c.provaDate)}${c.tafDate ? ' · TAF ' + U.dateBR(c.tafDate) : ''}</div></div><div class="countdown"><div><b>${d}</b><small>dias</small></div></div></div>`; }).join('') : App.empty('📝', 'Nenhuma prova', 'Suba um edital para extrair as datas.', '<a class="btn sm" href="#/estudos/concursos">subir edital</a>')}</div>`;
  };
  W.patrimonio = () => {
    const t = App.Inv.totals();
    return `<div class="card"><header><h3>📈 Patrimônio</h3><a class="btn sm ghost" href="#/investimentos">abrir</a></header>
      <div class="grid g2"><div class="stat"><div class="lbl">Investido</div><div class="val">${U.money(t.total)}</div></div><div class="stat"><div class="lbl">Renda passiva</div><div class="val">${U.money(t.income)}</div><div class="sub">por mês (estimado)</div></div></div>
      <div class="row mt"><span class="chip">FIIs ${U.money(t.fii)}</span><span class="chip">Renda fixa ${U.money(t.fixed)}</span>${t.other ? `<span class="chip">Outros ${U.money(t.other)}</span>` : ''}</div></div>`;
  };

  App.views.inicio = {
    render() {
      const name = st().profile.name;
      const ws = st().settings.widgets.filter((w) => w.visible && W[w.id]);
      const firstRun = !name && !st().transactions.length && !st().body.length;
      return `<div class="page-head"><div><h1>${greet()}${name ? ', ' + U.esc(name.split(' ')[0]) : ''} 👋</h1><p>${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase())}</p></div>
        <div class="actions"><a class="btn ghost" href="#/ajustes/painel">🧩 Personalizar painel</a></div></div>
        ${firstRun ? `<div class="card accent" style="margin-bottom:16px"><h2>Bem-vindo ao seu Vida OS ✨</h2><p>Comece por aqui:</p>
          <div class="row"><a class="btn" style="background:#fff;color:#111" href="#/fitness/perfil">1. Seu perfil</a><a class="btn" style="background:#fff;color:#111" href="#/financas/importar">2. Subir fatura</a><a class="btn" style="background:#fff;color:#111" href="#/financas/parcelas">3. Parcelas</a><a class="btn" style="background:#fff;color:#111" href="#/investimentos/fiis">4. FIIs</a><a class="btn" style="background:#fff;color:#111" href="#/ajustes">5. Personalizar</a></div>
          <p style="margin-bottom:0"><small>Seus dados ficam só neste navegador. Faça backup em Ajustes de vez em quando.</small></p></div>` : ''}
        <div class="grid g3">${ws.map((w) => W[w.id]()).join('')}</div>`;
    },
    mount() {
      const c6 = document.getElementById('dash-6m');
      if (c6) { const ms = Array.from({ length: 6 }, (_, i) => U.addMonthsYM(U.ym(), i - 5)); App.chart(c6, { type: 'bar', data: { labels: ms.map(U.ymShort), datasets: [{ label: 'Gastos', data: ms.map(App.Fin.monthExpenses), backgroundColor: App.cssVar('--accent'), borderRadius: 6 }, { label: 'Receitas', data: ms.map(App.Fin.monthIncome), backgroundColor: App.alpha('#22c55e', .7), borderRadius: 6 }] }, options: { plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${U.moneyTxt(c.raw)}` } } } } }); }
      const ents = App.Fit.entries().filter((e) => e.weight).slice(-20);
      const c = document.getElementById('dash-weight');
      if (c && ents.length) App.chart(c, { type: 'line', data: { labels: ents.map((e) => U.dateBR(e.date).slice(0, 5)), datasets: [{ data: ents.map((e) => e.weight), borderColor: App.cssVar('--accent'), backgroundColor: App.alpha(App.cssVar('--accent'), .15), fill: true, tension: .35, pointRadius: 2 }] }, options: { plugins: { legend: { display: false } }, scales: { x: { display: false } } } });
    },
    actions: {
      agDone: (t) => App.commit(() => App.Agenda.toggleDone(t.dataset.k)),
      agEdit: (t) => App.Agenda.eventModal(st().events.find((e) => e.id === t.dataset.id)),
    },
  };
})(window.App);
