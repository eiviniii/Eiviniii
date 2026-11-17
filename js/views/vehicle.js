/* ==========================================================
   VEÍCULO — manutenção por km/tempo, IPVA/licenciamento/seguro,
   abastecimentos, consumo e custo mensal do carro
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const V = (App.Vehicle = {});
  const cars = () => (st().vehicles = st().vehicles || []);
  const maint = () => (st().maint = st().maint || []);
  const fuel = () => (st().fuel = st().fuel || []);

  // tipos de manutenção com intervalos sugeridos (dá para mudar em cada registro)
  V.TYPES = {
    oleo: { l: 'Troca de óleo + filtro', i: '🛢️', km: 10000, m: 12 }, ar: { l: 'Filtro de ar', i: '🌬️', km: 15000, m: 12 }, cabine: { l: 'Filtro de cabine (ar-condicionado)', i: '❄️', km: 15000, m: 12 },
    combustivel: { l: 'Filtro de combustível', i: '⛽', km: 20000, m: 24 }, alinhamento: { l: 'Alinhamento e balanceamento', i: '🎯', km: 10000, m: 12 }, rodizio: { l: 'Rodízio de pneus', i: '🔄', km: 10000, m: 0 },
    pneus: { l: 'Troca de pneus', i: '🛞', km: 50000, m: 60 }, freio: { l: 'Pastilhas de freio', i: '🛑', km: 30000, m: 0 }, fluidofreio: { l: 'Fluido de freio', i: '💧', km: 0, m: 24 },
    correia: { l: 'Correia dentada', i: '⚙️', km: 50000, m: 48 }, arrefecimento: { l: 'Líquido de arrefecimento', i: '🌡️', km: 40000, m: 24 }, bateria: { l: 'Bateria', i: '🔋', km: 0, m: 36 },
    velas: { l: 'Velas de ignição', i: '⚡', km: 30000, m: 0 }, revisao: { l: 'Revisão geral', i: '🔧', km: 10000, m: 12 }, lavagem: { l: 'Lavagem / estética', i: '🧽', km: 0, m: 0 }, outro: { l: 'Outro serviço', i: '🧰', km: 0, m: 0 },
  };
  V.type = (k) => V.TYPES[k] || V.TYPES.outro;
  V.current = () => cars().find((c) => c.id === S.car) || cars()[0];

  /** km atual: o maior entre o informado, manutenções e abastecimentos */
  V.km = (c) => Math.max(+c.km || 0, ...maint().filter((m) => m.car === c.id).map((m) => +m.km || 0), ...fuel().filter((f) => f.car === c.id).map((f) => +f.km || 0));

  /** próxima manutenção de cada tipo (a partir do último registro) */
  V.next = (c) => {
    const km = V.km(c), out = [];
    const byType = U.groupBy(maint().filter((m) => m.car === c.id && m.type !== 'lavagem' && m.type !== 'outro'), (m) => m.type);
    for (const [type, arr] of Object.entries(byType)) {
      const last = arr.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.km || 0) - (b.km || 0)).pop();
      const iKm = last.everyKm ?? V.type(type).km, iM = last.everyM ?? V.type(type).m;
      const nextKm = iKm ? (+last.km || 0) + iKm : null;
      const nextDate = iM && last.date ? (() => { const d = U.parseISO(last.date); d.setMonth(d.getMonth() + iM); return U.iso(d); })() : null;
      const kmLeft = nextKm != null ? nextKm - km : null, daysLeft = nextDate ? U.diffDays(U.today(), nextDate) : null;
      const late = (kmLeft != null && kmLeft < 0) || (daysLeft != null && daysLeft < 0);
      const soon = !late && ((kmLeft != null && kmLeft <= 1000) || (daysLeft != null && daysLeft <= 30));
      out.push({ type, last, nextKm, nextDate, kmLeft, daysLeft, late, soon });
    }
    return out.sort((a, b) => (b.late - a.late) || (b.soon - a.soon) || ((a.kmLeft ?? 1e9) - (b.kmLeft ?? 1e9)));
  };

  /** gasto com combustível vindo das faturas/lançamentos */
  const isFuelTx = (t) => t.kind !== 'income' && /posto|combust|shell|ipiranga|petrobras|br mania|ale |gasolin|etanol|abastec/.test(U.norm(t.desc));
  V.monthCost = (ym, c) => {
    const [a, b] = App.Fin.monthRange(ym);
    const maintTx = new Set(maint().map((x) => x.txId).filter(Boolean)); // serviços lançados nos gastos não contam como combustível
    const fuelTx = U.sum(App.Fin.tx(a, b).filter((t) => isFuelTx(t) && !maintTx.has(t.id)), (t) => t.value);
    const m = U.sum(maint().filter((x) => (!c || x.car === c.id) && x.date >= a && x.date <= b), (x) => +x.cost || 0);
    return { fuel: fuelTx, maint: m, total: fuelTx + m };
  };
  V.consumption = (c) => {
    const fs = fuel().filter((f) => f.car === c.id && f.km && f.liters).sort((a, b) => a.km - b.km);
    const pts = [];
    for (let i = 1; i < fs.length; i++) if (fs[i].full !== false) { const km = fs[i].km - fs[i - 1].km; if (km > 0) pts.push({ date: fs[i].date, kmL: km / fs[i].liters, price: fs[i].value / fs[i].liters }); }
    return pts;
  };

  const S = { car: null };
  const kmFmt = (n) => (n == null ? '—' : U.fmt(n, 0) + ' km');
  const left = (x) => [x.kmLeft != null ? (x.kmLeft < 0 ? `passou ${U.fmt(-x.kmLeft, 0)} km` : `faltam ${U.fmt(x.kmLeft, 0)} km`) : '', x.daysLeft != null ? (x.daysLeft < 0 ? `atrasada ${-x.daysLeft} dias` : `em ${x.daysLeft} dias`) : ''].filter(Boolean).join(' · ');

  V.view = () => {
    const c = V.current();
    if (!c) return `<div class="page-head"><div><h1>🚗 Veículo</h1><p>Manutenção, documentos do carro, combustível e custo por mês.</p></div></div>
      <div class="card">${App.empty('🚗', 'Cadastre seu veículo', 'Carro ou moto: modelo, placa e a quilometragem atual. Depois registre as manutenções e eu aviso quando vencer a próxima.', '<button class="btn primary" data-act="vAdd">＋ Cadastrar veículo</button>')}</div>`;
    const km = V.km(c), nx = V.next(c), alerts = nx.filter((x) => x.late || x.soon);
    const cm = V.monthCost(U.ym(), c), cons = V.consumption(c);
    const avg = cons.length ? U.sum(cons, (p) => p.kmL) / cons.length : null;
    const obl = [['IPVA', c.ipvaDate, c.ipvaValue], ['Licenciamento', c.licDate, c.licValue], ['Seguro', c.insDate, c.insValue]].filter((o) => o[1]);
    const hist = maint().filter((m) => m.car === c.id).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 20);
    return `<div class="page-head"><div><h1>🚗 Veículo</h1><p>Manutenção, documentos do carro, combustível e custo por mês.</p></div>
      <div class="actions">${cars().length > 1 ? `<select data-change="vPick" style="width:auto">${cars().map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select>` : ''}<button class="btn" data-act="vAdd">＋ Veículo</button></div></div>
    <div class="grid g4">
      <div class="card accent stat"><div class="lbl">${U.esc(c.name)}${c.plate ? ' · ' + U.esc(c.plate) : ''}</div><div class="val">${kmFmt(km)}</div><div class="sub"><a href="#" data-act="vKm" style="color:#fff;text-decoration:underline">atualizar km</a> · <a href="#" data-act="vEdit" style="color:#fff;text-decoration:underline">editar</a></div></div>
      <div class="card stat"><div class="lbl">Custo do carro (mês)</div><div class="val">${U.money(cm.total)}</div><div class="sub">⛽ ${U.money(cm.fuel)} · 🔧 ${U.money(cm.maint)}</div></div>
      <div class="card stat"><div class="lbl">Consumo médio</div><div class="val">${avg ? U.fmt(avg, 1) + ' km/L' : '—'}</div><div class="sub">${cons.length ? `último ${U.fmt(cons[cons.length - 1].kmL, 1)} km/L` : 'registre 2 abastecimentos com tanque cheio'}</div></div>
      <div class="card stat"><div class="lbl">Manutenções</div><div class="val ${alerts.some((a) => a.late) ? 'delta badd' : ''}">${alerts.length ? alerts.length + ' pendente(s)' : 'em dia ✅'}</div><div class="sub">${nx.length} acompanhadas</div></div>
    </div>
    <div class="grid g3 mt">
      <div class="card span2"><header><h3>🔧 Próximas manutenções</h3><button class="btn primary sm" data-act="mAdd">＋ Registrar serviço</button></header>
        ${nx.length ? `<div class="list">${nx.map((x) => { const t = V.type(x.type); const pct = x.kmLeft != null && x.last.km != null && x.nextKm ? U.clamp(((km - x.last.km) / (x.nextKm - x.last.km)) * 100, 0, 100) : x.daysLeft != null ? U.clamp(100 - (x.daysLeft / ((x.last.everyM ?? t.m) * 30.4)) * 100, 0, 100) : 0; return `<div class="li"><div class="ico">${t.i}</div><div class="grow"><div class="t">${t.l}</div><div class="s">última: ${U.dateBR(x.last.date)}${x.last.km ? ' · ' + kmFmt(x.last.km) : ''} → próxima ${x.nextKm ? kmFmt(x.nextKm) : ''}${x.nextKm && x.nextDate ? ' ou ' : ''}${x.nextDate ? U.dateBR(x.nextDate) : ''}</div><div class="bar ${x.late ? 'over' : ''}" style="margin-top:5px"><i style="width:${pct}%"></i></div></div><span class="chip ${x.late ? 'bad' : x.soon ? 'warn' : 'ok'}">${left(x)}</span></div>`; }).join('')}</div>`
          : App.empty('🔧', 'Nenhuma manutenção registrada', 'Registre a última troca de óleo, alinhamento, pneus… com a data e o km. Eu calculo a próxima.', '<button class="btn primary" data-act="mQuickSet">Registrar as principais</button>')}</div>
      <div class="stack">
        <div class="card"><header><h3>📄 Documentos do carro</h3><button class="btn sm ghost" data-act="vEdit">editar</button></header>
          ${obl.length ? `<div class="list">${obl.map(([l, d, v]) => { const n = U.diffDays(U.today(), d); return `<div class="li"><div class="grow"><div class="t">${l}</div><div class="s">${U.dateBR(d)}${v ? ' · ' + U.moneyTxt(v) : ''}</div></div><span class="chip ${n < 0 ? 'bad' : n <= 30 ? 'warn' : 'ok'}">${n < 0 ? 'vencido' : n === 0 ? 'hoje' : 'em ' + n + ' dias'}</span></div>`; }).join('')}</div><p class="muted"><small>Aparecem também na Agenda.</small></p>` : '<p class="muted">Informe IPVA, licenciamento e seguro em “editar”.</p>'}</div>
        <div class="card"><header><h3>⛽ Abastecimentos</h3><button class="btn sm" data-act="fAdd">＋</button></header>
          ${fuel().filter((f) => f.car === c.id).slice(-5).reverse().map((f) => `<div class="li"><div class="grow"><div class="t">${U.money(f.value)} · ${U.fmt(f.liters, 1)} L</div><div class="s">${U.dateBR(f.date)} · ${kmFmt(f.km)} · ${U.moneyTxt(f.value / f.liters)}/L</div></div><button class="icon-btn" data-act="fDel" data-id="${f.id}">✕</button></div>`).join('') || '<p class="muted">Registre ao abastecer para ver o consumo.</p>'}</div>
      </div>
    </div>
    <div class="grid g2 mt">
      <div class="card"><header><h3>📊 Custo por mês</h3><small class="muted">combustível das faturas + manutenções</small></header><div class="chart-box"><canvas id="car-cost"></canvas></div></div>
      <div class="card"><header><h3>🗂️ Histórico de serviços</h3></header>${hist.length ? `<div class="list">${hist.map((m) => `<div class="li"><div class="ico">${V.type(m.type).i}</div><div class="grow"><div class="t">${V.type(m.type).l}</div><div class="s">${U.dateBR(m.date)}${m.km ? ' · ' + kmFmt(m.km) : ''}${m.shop ? ' · ' + U.esc(m.shop) : ''}</div></div>${m.cost ? `<b>${U.money(m.cost)}</b>` : ''}<button class="icon-btn" data-act="mEdit" data-id="${m.id}">✏️</button></div>`).join('')}</div>` : '<p class="muted">—</p>'}</div>
    </div>`;
  };
  V.mount = () => {
    const c = V.current(); if (!c) return;
    const ms = Array.from({ length: 6 }, (_, i) => U.addMonthsYM(U.ym(), i - 5));
    const data = ms.map((m) => V.monthCost(m, c));
    App.chart(document.getElementById('car-cost'), { type: 'bar', data: { labels: ms.map(U.ymShort), datasets: [{ label: 'Combustível', data: data.map((d) => U.round(d.fuel)), backgroundColor: '#f97316', borderRadius: 4 }, { label: 'Manutenção', data: data.map((d) => U.round(d.maint)), backgroundColor: '#0ea5e9', borderRadius: 4 }] }, options: { scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${U.moneyTxt(x.raw)}` } } } } });
  };

  /* ---------- modais ---------- */
  const carModal = (c = {}) => App.modal({
    title: c.id ? 'Editar veículo' : 'Novo veículo',
    body: F.row(F.text('Apelido / modelo', 'name', c.name || '', 'required placeholder="Ex.: Onix 2019"'), F.text('Placa', 'plate', c.plate || '', 'style="text-transform:uppercase"'), F.select('Combustível', 'fuelType', ['Flex', 'Gasolina', 'Etanol', 'Diesel', 'Elétrico'], c.fuelType || 'Flex')) +
      F.row(F.number('Quilometragem atual', 'km', c.km), F.text('Renavam', 'renavam', c.renavam || '')) +
      '<h4 style="margin:10px 0">📄 Documentos e vencimentos</h4>' +
      F.row(F.date('IPVA (vencimento)', 'ipvaDate', c.ipvaDate || ''), F.number('Valor IPVA', 'ipvaValue', c.ipvaValue)) +
      F.row(F.date('Licenciamento', 'licDate', c.licDate || ''), F.number('Valor', 'licValue', c.licValue)) +
      F.row(F.date('Seguro (vencimento)', 'insDate', c.insDate || ''), F.number('Valor', 'insValue', c.insValue), F.text('Seguradora / apólice', 'insurer', c.insurer || '')),
    danger: c.id ? { label: 'Excluir', fn: () => App.commit((s) => { s.vehicles = s.vehicles.filter((x) => x.id !== c.id); }) } : null,
    onSubmit: (d) => { if (!d.name) return false; d.plate = (d.plate || '').toUpperCase(); App.commit((s) => { s.vehicles = s.vehicles || []; if (c.id) Object.assign(s.vehicles.find((x) => x.id === c.id), d); else { const id = U.uid(); s.vehicles.push({ id, ...d }); S.car = id; } }); },
  });
  const mModal = (m = {}) => {
    const c = V.current(); const t0 = m.type || 'oleo';
    App.modal({
      title: m.id ? 'Editar serviço' : 'Registrar serviço',
      body: F.row(F.select('Serviço', 'type', Object.entries(V.TYPES).map(([k, v]) => [k, `${v.i} ${v.l}`]), t0, 'data-mchange="ty"'), F.date('Data', 'date', m.date || U.today()), F.number('Km no serviço', 'km', m.km ?? V.km(c))) +
        F.row(F.number('Custo (R$)', 'cost', m.cost), F.text('Oficina / loja', 'shop', m.shop || '')) +
        F.row(F.number('Repetir a cada (km) — 0 = não', 'everyKm', m.everyKm ?? V.type(t0).km), F.number('…ou a cada (meses)', 'everyM', m.everyM ?? V.type(t0).m)) + F.text('Observações', 'notes', m.notes || '', 'placeholder="Ex.: óleo 5W30 sintético"') +
        (m.id ? '' : '<div style="height:8px"></div>' + F.check('Lançar o custo nos gastos (Transporte)', 'toTx', true)),
      actions: { ty: (el, f) => { f.everyKm.value = V.type(el.value).km; f.everyM.value = V.type(el.value).m; } },
      danger: m.id ? { label: 'Excluir', fn: () => App.commit((s) => { s.maint = s.maint.filter((x) => x.id !== m.id); }) } : null,
      onSubmit: (d) => App.commit((s) => {
        s.maint = s.maint || []; const toTx = d.toTx; delete d.toTx;
        if (m.id) return Object.assign(s.maint.find((x) => x.id === m.id), d);
        const o = { id: U.uid(), car: c.id, ...d };
        if (toTx && d.cost) { const tid = U.uid(); s.transactions.push({ id: tid, date: d.date, desc: `${V.type(d.type).l} — ${c.name}`, value: d.cost, kind: 'expense', categoryId: 'transporte', accountId: (App.Money.mainAcc() || {}).id, account: (App.Money.mainAcc() || {}).name, source: 'veiculo' }); o.txId = tid; }
        s.maint.push(o);
        if (+d.km > (+c.km || 0)) s.vehicles.find((x) => x.id === c.id).km = +d.km;
      }),
    });
  };
  const fModal = () => {
    const c = V.current();
    App.modal({
      title: '⛽ Abastecimento',
      body: F.row(F.date('Data', 'date', U.today()), F.number('Km no painel', 'km', V.km(c)), F.select('Combustível', 'kind', ['Gasolina', 'Etanol', 'Diesel', 'GNV'], 'Gasolina')) +
        F.row(F.number('Valor pago (R$)', 'value', '', 'required'), F.number('Litros', 'liters', '', 'required')) + F.check('Tanque cheio (para calcular o consumo)', 'full', true) + '<br>' + F.check('Lançar nos gastos (se pagou no débito/dinheiro — a fatura do cartão já traz)', 'toTx', false),
      onSubmit: (d) => { if (!d.value || !d.liters) return false; App.commit((s) => {
        s.fuel = s.fuel || []; s.fuel.push({ id: U.uid(), car: c.id, date: d.date, km: d.km, liters: d.liters, value: d.value, kind: d.kind, full: d.full });
        if (+d.km > (+c.km || 0)) s.vehicles.find((x) => x.id === c.id).km = +d.km;
        if (d.toTx) s.transactions.push({ id: U.uid(), date: d.date, desc: `Abastecimento ${d.kind} — ${c.name}`, value: d.value, kind: 'expense', categoryId: 'transporte', accountId: (App.Money.mainAcc() || {}).id, account: (App.Money.mainAcc() || {}).name, source: 'veiculo' });
      }); App.toast(`⛽ ${U.moneyTxt(d.value / d.liters)}/L registrado`); },
    });
  };
  const quickSet = () => {
    const c = V.current(); const keys = ['oleo', 'alinhamento', 'pneus', 'freio', 'correia', 'bateria', 'revisao'];
    App.modal({
      title: 'Últimas manutenções (o que você lembrar)', wide: true, submitLabel: 'Salvar',
      body: `<p class="muted">Preencha só o que souber. Pode ser aproximado — serve para eu calcular a próxima.</p><table><thead><tr><th>Serviço</th><th>Data</th><th>Km</th></tr></thead><tbody>${keys.map((k) => `<tr><td>${V.type(k).i} ${V.type(k).l}</td><td><input type="date" name="d_${k}"></td><td><input type="number" name="k_${k}" placeholder="km"></td></tr>`).join('')}</tbody></table>`,
      onSubmit: (d) => App.commit((s) => { s.maint = s.maint || []; keys.forEach((k) => { if (d['d_' + k] || d['k_' + k]) s.maint.push({ id: U.uid(), car: c.id, type: k, date: d['d_' + k] || U.today(), km: d['k_' + k] || '', everyKm: V.type(k).km, everyM: V.type(k).m }); }); }),
    });
  };

  /* agenda: IPVA, licenciamento, seguro e manutenção por data */
  V.events = (from, to) => {
    const out = [];
    for (const c of cars()) {
      for (const [l, d, v] of [['IPVA', c.ipvaDate, c.ipvaValue], ['Licenciamento', c.licDate, c.licValue], ['Seguro', c.insDate, c.insValue]]) if (d && d >= from && d <= to) out.push({ id: `car|${c.id}|${l}`, key: `car|${c.id}|${l}`, virtual: true, title: `${l} — ${c.name}`, type: 'veiculo', date: d, value: +v || 0 });
      for (const x of V.next(c)) if (x.nextDate && x.nextDate >= from && x.nextDate <= to) out.push({ id: `carm|${c.id}|${x.type}`, key: `carm|${c.id}|${x.type}`, virtual: true, title: `${V.type(x.type).l} — ${c.name}`, type: 'veiculo', date: x.nextDate });
    }
    return out;
  };
  V.widget = () => {
    const c = V.current(); if (!c) return '';
    const al = V.next(c).filter((x) => x.late || x.soon);
    return `<div class="card"><header><h3>🚗 ${U.esc(c.name)}</h3><a class="btn sm ghost" href="#/veiculo">abrir</a></header><div class="row between"><span class="muted">${kmFmt(V.km(c))}</span><span class="muted">mês: ${U.money(V.monthCost(U.ym(), c).total)}</span></div>
      ${al.length ? `<div class="list mt">${al.slice(0, 3).map((x) => `<div class="li"><div class="ico">${V.type(x.type).i}</div><div class="grow"><div class="t">${V.type(x.type).l}</div></div><span class="chip ${x.late ? 'bad' : 'warn'}">${left(x)}</span></div>`).join('')}</div>` : '<p class="muted mt">Manutenções em dia ✅</p>'}</div>`;
  };

  App.views.veiculo = {
    render: V.view, mount: V.mount,
    actions: {
      vAdd: () => carModal(), vEdit: (t, e) => { e.preventDefault(); carModal(V.current()); }, vPick: (t) => { S.car = t.value; App.rerender(); },
      vKm: (t, e) => { e.preventDefault(); const c = V.current(); App.modal({ title: 'Atualizar quilometragem', body: F.number('Km no painel hoje', 'km', V.km(c)), onSubmit: (d) => App.commit((s) => { s.vehicles.find((x) => x.id === c.id).km = d.km; }) }); },
      mAdd: () => mModal(), mEdit: (t) => mModal(maint().find((m) => m.id === t.dataset.id)), mQuickSet: () => quickSet(),
      fAdd: () => fModal(), fDel: (t) => App.commit((s) => { s.fuel = s.fuel.filter((f) => f.id !== t.dataset.id); }),
    },
    quick: { fuel: () => (V.current() ? fModal() : App.go('veiculo')) },
  };
})(window.App);
