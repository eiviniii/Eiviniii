/* ==========================================================
   AGENDA — compromissos, contas a pagar, provas, inscrições
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const A = (App.Agenda = {});

  A.TYPES = {
    compromisso: { label: 'Compromisso', icon: '📌', color: '#7c5cff' },
    conta: { label: 'Conta a pagar', icon: '🧾', color: '#f97316' },
    fatura: { label: 'Fatura do cartão', icon: '💳', color: '#ec4899' },
    prova: { label: 'Prova / concurso', icon: '📝', color: '#ef4444' },
    inscricao: { label: 'Inscrição', icon: '🖊️', color: '#0ea5e9' },
    taf: { label: 'TAF / teste físico', icon: '🏃', color: '#22c55e' },
    exame: { label: 'Exame médico', icon: '🩺', color: '#14b8a6' },
    revisao: { label: 'Revisão de estudo', icon: '🔁', color: '#a855f7' },
    aniversario: { label: 'Aniversário', icon: '🎂', color: '#eab308' },
    outro: { label: 'Outro', icon: '•', color: '#64748b' },
  };
  A.type = (t) => A.TYPES[t] || A.TYPES.outro;

  /** Expande eventos recorrentes + faturas dos cartões no intervalo [from, to]. */
  A.occurrences = (from, to) => {
    const out = [];
    for (const e of st().events) {
      if (!e.date) continue;
      const push = (date) => { if (date >= from && date <= to && (!e.until || date <= e.until)) out.push({ ...e, date, key: e.id + '|' + date, paid: e.recur && e.recur !== 'none' ? (e.paidDates || []).includes(date) : !!e.paid, done: e.recur && e.recur !== 'none' ? (e.paidDates || []).includes(date) : !!e.paid }); };
      if (!e.recur || e.recur === 'none') { push(e.date); continue; }
      if (e.recur === 'weekly') { let d = e.date; if (d < from) d = U.addDays(d, Math.ceil(U.diffDays(d, from) / 7) * 7); for (; d <= to; d = U.addDays(d, 7)) push(d); continue; }
      const step = e.recur === 'yearly' ? 12 : 1;
      const day = +e.date.slice(8, 10);
      let ym = e.date.slice(0, 7);
      if (ym < from.slice(0, 7)) ym = U.addMonthsYM(ym, Math.floor(U.diffMonths(ym, from.slice(0, 7)) / step) * step);
      for (let i = 0; i < 400 && ym <= to.slice(0, 7); i++, ym = U.addMonthsYM(ym, step)) {
        if (ym < e.date.slice(0, 7)) continue;
        const [y, m] = ym.split('-').map(Number); const last = new Date(y, m, 0).getDate();
        push(`${ym}-${String(Math.min(day, last)).padStart(2, '0')}`);
      }
    }
    // faturas dos cartões (valor = parcelas do mês)
    for (const c of st().cards) {
      if (!c.dueDay || c.showDue === false) continue;
      for (let ym = from.slice(0, 7); ym <= to.slice(0, 7); ym = U.addMonthsYM(ym, 1)) {
        const [y, m] = ym.split('-').map(Number); const date = `${ym}-${String(Math.min(c.dueDay, new Date(y, m, 0).getDate())).padStart(2, '0')}`;
        if (date < from || date > to || (c.createdAt && date < c.createdAt)) continue;
        const v = App.Fin ? App.Fin.instMonthTotal(ym, c.id) : 0;
        const paidKey = `fatura|${c.id}|${ym}`;
        out.push({ id: paidKey, key: paidKey, virtual: true, title: `Fatura ${c.name}`, type: 'fatura', date, value: v, paid: (st().settings.paidFaturas || []).includes(paidKey), notes: v ? 'valor = parcelas conhecidas do mês (sem gastos avulsos)' : '' });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  };
  A.upcoming = (days = 30) => A.occurrences(U.today(), U.addDays(U.today(), days));
  A.overdue = () => A.occurrences(U.addDays(U.today(), -60), U.addDays(U.today(), -1)).filter((o) => (o.type === 'conta' || o.type === 'fatura') && !o.paid);

  const S = { ym: U.ym() };

  const eventModal = (e = {}, date) => {
    const isNew = !e.id;
    App.modal({
      title: isNew ? 'Novo evento' : 'Editar evento',
      body: F.row(F.text('Título', 'title', e.title || '', 'required placeholder="Ex.: Conta de luz"'), F.select('Tipo', 'type', Object.entries(A.TYPES).filter(([k]) => k !== 'fatura').map(([k, v]) => [k, `${v.icon} ${v.label}`]), e.type || 'compromisso')) +
        F.row(F.date('Data', 'date', e.date || date || U.today()), F.time('Horário', 'time', e.time || ''), F.number('Valor (R$)', 'value', e.value)) +
        F.row(F.select('Repetir', 'recur', [['none', 'Não repete'], ['weekly', 'Toda semana'], ['monthly', 'Todo mês'], ['yearly', 'Todo ano']], e.recur || 'none'), F.date('Repetir até (opcional)', 'until', e.until || '')) +
        F.text('Link (inscrição, boleto…)', 'link', e.link || '', 'placeholder="https://"') + '<div style="height:10px"></div>' + F.area('Notas', 'notes', e.notes),
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.events = s.events.filter((x) => x.id !== e.id); }) },
      onSubmit: (d) => {
        if (!d.title) { App.toast('Dê um título.', 'error'); return false; }
        App.commit((s) => { if (isNew) s.events.push({ id: U.uid(), ...d }); else Object.assign(s.events.find((x) => x.id === e.id), d); });
        App.toast('Evento salvo');
      },
    });
  };
  A.eventModal = eventModal;

  const toggleDone = (key) => {
    const [id, date] = key.split('|');
    if (id === 'fatura') { const s = st().settings; s.paidFaturas = s.paidFaturas || []; const i = s.paidFaturas.indexOf(key); i >= 0 ? s.paidFaturas.splice(i, 1) : s.paidFaturas.push(key); return; }
    const e = st().events.find((x) => x.id === id); if (!e) return;
    let nowPaid;
    if (e.recur && e.recur !== 'none') { e.paidDates = e.paidDates || []; const i = e.paidDates.indexOf(date); i >= 0 ? e.paidDates.splice(i, 1) : e.paidDates.push(date); nowPaid = i < 0; }
    else { e.paid = !e.paid; nowPaid = e.paid; }
    // conta paga → desconta do saldo da conta principal (desmarcar devolve)
    const acc = App.Money && App.Money.mainAcc();
    if (e.type === 'conta' && e.value && acc) {
      if (nowPaid) st().transactions.push({ id: U.uid(), date: U.today() < (date || e.date) ? U.today() : (date || e.date), desc: e.title, value: +e.value, kind: 'expense', categoryId: App.parse.categorize(e.title) === 'outros' ? 'casa-contas' : App.parse.categorize(e.title), accountId: acc.id, account: acc.name, source: 'agenda', eventKey: key });
      else st().transactions = st().transactions.filter((t) => t.eventKey !== key);
      App.toast(nowPaid ? `✅ Paga · −${U.moneyTxt(e.value)} do saldo` : 'Pagamento desfeito');
    }
  };
  A.toggleDone = toggleDone;

  A.item = (o, opts = {}) => {
    const t = A.type(o.type);
    const payable = o.type === 'conta' || o.type === 'fatura';
    const late = payable && !o.paid && o.date < U.today();
    return `<div class="li" style="${o.done ? 'opacity:.55' : ''}">
      <div class="ico" style="background:${App.alpha(t.color, .18)}">${t.icon}</div>
      <div class="grow"><div class="t">${U.esc(o.title)}</div><div class="s">${U.dateNice(o.date)}${o.time ? ' · ' + o.time : ''} · ${U.relDays(o.date)} ${late ? '<span class="chip bad">atrasada</span>' : ''}${o.link ? ` · <a href="${U.esc(o.link)}" target="_blank" rel="noopener">link ↗</a>` : ''}</div></div>
      ${o.value ? `<b>${U.money(o.value)}</b>` : ''}
      ${opts.noToggle ? '' : `<button class="icon-btn" data-act="agDone" data-k="${U.esc(o.key)}" title="${payable ? 'marcar como pago' : 'concluído'}">${o.done ? '✅' : '⬜'}</button>`}
      ${o.virtual || opts.noEdit ? '' : `<button class="icon-btn" data-act="agEdit" data-id="${o.id}">✏️</button>`}
    </div>`;
  };

  App.views.agenda = {
    render() {
      const [y, m] = S.ym.split('-').map(Number);
      const first = new Date(y, m - 1, 1), startPad = first.getDay();
      const gridStart = U.addDays(U.iso(first), -startPad);
      const cells = Array.from({ length: 42 }, (_, i) => U.addDays(gridStart, i));
      const occ = A.occurrences(cells[0], cells[41]);
      const byDay = U.groupBy(occ, (o) => o.date);
      const today = U.today();
      const monthOcc = occ.filter((o) => o.date.startsWith(S.ym));
      const bills = monthOcc.filter((o) => o.type === 'conta' || o.type === 'fatura');
      const pend = bills.filter((b) => !b.paid);
      const overdue = A.overdue();
      const up = A.upcoming(45);
      return `<div class="page-head"><div><h1>📅 Agenda</h1><p>Compromissos, contas a pagar, provas, inscrições e TAF — para você não se perder.</p></div>
        <div class="actions"><button class="btn primary" data-act="agNew">＋ Evento</button></div></div>
      <div class="grid g4">
        <div class="card accent stat"><div class="lbl">Contas do mês</div><div class="val">${U.money(U.sum(bills, (b) => b.value))}</div><div class="sub">${bills.length} conta(s)</div></div>
        <div class="card stat"><div class="lbl">A pagar</div><div class="val">${U.money(U.sum(pend, (b) => b.value))}</div><div class="sub">${pend.length} pendente(s)</div></div>
        <div class="card stat"><div class="lbl">Atrasadas</div><div class="val ${overdue.length ? 'delta badd' : ''}">${overdue.length}</div><div class="sub">${overdue.length ? U.money(U.sum(overdue, (b) => b.value)) : 'tudo em dia ✨'}</div></div>
        <div class="card stat"><div class="lbl">Próximos 7 dias</div><div class="val">${A.upcoming(7).length}</div><div class="sub">eventos</div></div>
      </div>
      <div class="grid g3 mt">
        <div class="card span2">
          <header><div class="row"><button class="btn sm" data-act="agPrev">‹</button><h3 style="min-width:160px;text-align:center;text-transform:capitalize">${U.ymLabel(S.ym)}</h3><button class="btn sm" data-act="agNext">›</button>${S.ym !== U.ym() ? '<button class="btn sm ghost" data-act="agToday">Hoje</button>' : ''}</div>
          <div class="row">${Object.entries(A.TYPES).slice(0, 6).map(([, t]) => `<span class="chip"><span class="dot" style="background:${t.color}"></span>${t.label}</span>`).join('')}</div></header>
          <div class="cal">${U.DAY3.map((d) => `<div class="dow">${d}</div>`).join('')}
            ${cells.map((d) => { const evs = byDay[d] || []; return `<div class="day ${d.slice(0, 7) !== S.ym ? 'other' : ''} ${d === today ? 'today' : ''}" data-act="agDay" data-d="${d}"><div class="n">${+d.slice(8)}</div>
              ${evs.slice(0, 3).map((o) => `<div class="ev" style="background:${A.type(o.type).color};${o.done ? 'opacity:.5;text-decoration:line-through' : ''}">${A.type(o.type).icon} ${U.esc(o.title)}</div>`).join('')}${evs.length > 3 ? `<div class="more">+${evs.length - 3}</div>` : ''}</div>`; }).join('')}
          </div>
        </div>
        <div class="stack">
          ${overdue.length ? `<div class="card" style="border-color:var(--bad)"><header><h3>⚠️ Atrasadas</h3></header><div class="list">${overdue.map((o) => A.item(o)).join('')}</div></div>` : ''}
          <div class="card"><header><h3>⏭️ Próximos 45 dias</h3></header>${up.length ? `<div class="list">${up.slice(0, 20).map((o) => A.item(o)).join('')}</div>` : App.empty('🗓️', 'Agenda livre', 'Adicione compromissos, contas e datas de provas.')}</div>
        </div>
      </div>`;
    },
    actions: {
      agNew: () => eventModal(),
      agEdit: (t) => eventModal(st().events.find((e) => e.id === t.dataset.id)),
      agDone: (t) => App.commit(() => toggleDone(t.dataset.k)),
      agPrev: () => { S.ym = U.addMonthsYM(S.ym, -1); App.rerender(); },
      agNext: () => { S.ym = U.addMonthsYM(S.ym, 1); App.rerender(); },
      agToday: () => { S.ym = U.ym(); App.rerender(); },
      agDay: (t) => {
        const d = t.dataset.d; const evs = A.occurrences(d, d);
        const m = App.modal({
          title: U.dateNice(d) + ' · ' + U.dateBR(d), hideFooter: true,
          body: `${evs.length ? `<div class="list">${evs.map((o) => A.item(o, { noToggle: true })).join('')}</div>` : '<p class="muted">Nada neste dia.</p>'}<button type="button" class="btn primary block mt" data-mact="add">＋ Adicionar neste dia</button>`,
          actions: { add: (_, __, close) => { close(); eventModal({}, d); } },
        });
        m.form.addEventListener('click', (e) => { const b = e.target.closest('[data-act=agEdit]'); if (b) { m.close(); eventModal(st().events.find((x) => x.id === b.dataset.id)); } });
      },
    },
    quick: { event: () => eventModal() },
  };
})(window.App);
