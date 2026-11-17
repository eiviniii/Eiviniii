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
    const fromTx = U.sum(App.Fin.tx(a, b).filter((t) => isFuelTx(t) && !maintTx.has(t.id)), (t) => t.value);
    const fromLog = U.sum(fuel().filter((f) => (!c || f.car === c.id) && f.date >= a && f.date <= b), (f) => +f.value || 0);
    // a fatura e o registro de abastecimento podem ser o MESMO gasto: usa o maior dos dois, sem somar
    const fuelTx = Math.max(fromTx, fromLog);
    const m = U.sum(maint().filter((x) => (!c || x.car === c.id) && x.date >= a && x.date <= b), (x) => +x.cost || 0);
    return { fuel: fuelTx, maint: m, total: fuelTx + m };
  };
  /** Cada abastecimento vira um ponto de consumo:
   *  • com "km rodados" (hodômetro parcial/trip): km ÷ litros
   *  • sem, mas com km do painel: diferença para o abastecimento anterior ÷ litros */
  V.consumption = (c) => {
    const fs = fuel().filter((f) => f.car === c.id && +f.liters > 0).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (+a.km || 0) - (+b.km || 0));
    const pts = [];
    fs.forEach((f, i) => {
      let trip = +f.trip || 0;
      if (!trip && f.km) { const prev = fs.slice(0, i).reverse().find((x) => +x.km > 0); if (prev && +f.km > +prev.km) trip = +f.km - +prev.km; }
      const price = +f.value / +f.liters;
      if (trip > 0 && f.full !== false) pts.push({ id: f.id, date: f.date, kind: f.kind || 'Gasolina', trip, liters: +f.liters, value: +f.value, kmL: trip / +f.liters, price, perKm: +f.value / trip });
    });
    return pts;
  };
  /** resumo: média ponderada (soma km ÷ soma litros), R$/km, por combustível */
  V.fuelStats = (c) => {
    const pts = V.consumption(c), sum = (arr, k) => U.sum(arr, (p) => p[k]);
    const by = U.groupBy(pts, (p) => p.kind);
    const kinds = Object.fromEntries(Object.entries(by).map(([k, arr]) => [k, { n: arr.length, kmL: sum(arr, 'trip') / sum(arr, 'liters'), perKm: sum(arr, 'value') / sum(arr, 'trip'), lastPrice: arr[arr.length - 1].price }]));
    const ym = U.ym(), month = fuel().filter((f) => f.car === c.id && (f.date || '').startsWith(ym));
    const lastPrice = (k) => { const f = fuel().filter((x) => x.car === c.id && (x.kind || 'Gasolina') === k && +x.liters).pop(); return f ? f.value / f.liters : null; };
    return {
      pts, n: pts.length, kmL: pts.length ? sum(pts, 'trip') / sum(pts, 'liters') : null, perKm: pts.length ? sum(pts, 'value') / sum(pts, 'trip') : null,
      best: pts.length ? Math.max(...pts.map((p) => p.kmL)) : null, worst: pts.length ? Math.min(...pts.map((p) => p.kmL)) : null,
      kinds, monthKm: U.sum(V.consumption(c).filter((p) => p.date.startsWith(ym)), (p) => p.trip), monthValue: U.sum(month, (f) => +f.value), monthLiters: U.sum(month, (f) => +f.liters),
      gas: lastPrice('Gasolina'), eth: lastPrice('Etanol'),
    };
  };

  const S = { car: null };
  const kmFmt = (n) => (n == null ? '—' : U.fmt(n, 0) + ' km');
  const left = (x) => [x.kmLeft != null ? (x.kmLeft < 0 ? `passou ${U.fmt(-x.kmLeft, 0)} km` : `faltam ${U.fmt(x.kmLeft, 0)} km`) : '', x.daysLeft != null ? (x.daysLeft < 0 ? `atrasada ${-x.daysLeft} dias` : `em ${x.daysLeft} dias`) : ''].filter(Boolean).join(' · ');

  V.view = () => {
    const c = V.current();
    if (!c) return `<div class="page-head"><div><h1>🚗 Veículo</h1><p>Manutenção, documentos do carro, combustível e custo por mês.</p></div></div>
      <div class="card">${App.empty('🚗', 'Cadastre seu veículo', 'Carro ou moto: modelo, placa e a quilometragem atual. Depois registre as manutenções e eu aviso quando vencer a próxima.', '<button class="btn primary" data-act="vAdd">＋ Cadastrar veículo</button>')}</div>`;
    const km = V.km(c), nx = V.next(c), alerts = nx.filter((x) => x.late || x.soon);
    const cm = V.monthCost(U.ym(), c), fsx = V.fuelStats(c), cons = fsx.pts, avg = fsx.kmL;
    const obl = [['IPVA', c.ipvaDate, c.ipvaValue], ['Licenciamento', c.licDate, c.licValue], ['Seguro', c.insDate, c.insValue]].filter((o) => o[1]);
    const hist = maint().filter((m) => m.car === c.id).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 20);
    return `<div class="page-head"><div><h1>🚗 Veículo</h1><p>Manutenção, documentos do carro, combustível e custo por mês.</p></div>
      <div class="actions">${cars().length > 1 ? `<select data-change="vPick" style="width:auto">${cars().map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select>` : ''}<button class="btn" data-act="vAdd">＋ Veículo</button></div></div>
    <div class="grid g4">
      <div class="card accent stat"><div class="lbl">${U.esc(c.name)}${c.plate ? ' · ' + U.esc(c.plate) : ''}</div><div class="val">${kmFmt(km)}</div><div class="sub"><a href="#" data-act="vKm" style="color:#fff;text-decoration:underline">atualizar km</a> · <a href="#" data-act="vEdit" style="color:#fff;text-decoration:underline">editar</a></div></div>
      <div class="card stat"><div class="lbl">Custo do carro (mês)</div><div class="val">${U.money(cm.total)}</div><div class="sub">⛽ ${U.money(cm.fuel)} · 🔧 ${U.money(cm.maint)}</div></div>
      <div class="card stat"><div class="lbl">Consumo médio</div><div class="val">${avg ? U.fmt(avg, 1) + ' km/L' : '—'}</div><div class="sub">${cons.length ? `${U.moneyTxt(fsx.perKm)}/km · último ${U.fmt(cons[cons.length - 1].kmL, 1)} km/L` : 'registre o abastecimento com os km rodados'}</div></div>
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
          ${fuel().filter((f) => f.car === c.id).slice(-5).reverse().map((f) => { const p = cons.find((x) => x.id === f.id); return `<div class="li"><div class="grow"><div class="t">${U.money(f.value)} · ${U.fmt(f.liters, 1)} L ${f.kind ? `<small class="muted">${U.esc(f.kind)}</small>` : ''}</div><div class="s">${U.dateBR(f.date)}${p ? ` · ${U.fmt(p.trip, 0)} km rodados` : f.km ? ' · ' + kmFmt(f.km) : ''} · ${U.moneyTxt(f.value / f.liters)}/L</div></div>${p ? `<b class="kml">${U.fmt(p.kmL, 1)}<small> km/L</small></b>` : ''}<button class="icon-btn" data-act="fDel" data-id="${f.id}">✕</button></div>`; }).join('') || '<p class="muted">Ao abastecer, registre os km rodados e os litros.</p>'}</div>
      </div>
    </div>
    <div class="grid g3 mt">
      <div class="card span2"><header><h3>⛽ Consumo real</h3><button class="btn primary sm" data-act="fAdd">＋ Abastecimento</button></header>
        ${cons.length ? `<div class="grid g4" style="gap:10px;margin-bottom:12px">
          <div class="metric"><div class="lbl">Média</div><div class="v">${U.fmt(fsx.kmL, 1)} km/L</div><div class="d muted">melhor ${U.fmt(fsx.best, 1)} · pior ${U.fmt(fsx.worst, 1)}</div></div>
          <div class="metric"><div class="lbl">Custo por km</div><div class="v">${U.moneyTxt(fsx.perKm)}</div><div class="d muted">${U.moneyTxt(fsx.perKm * 100)} a cada 100 km</div></div>
          <div class="metric"><div class="lbl">Rodado no mês</div><div class="v">${U.fmt(fsx.monthKm, 0)} km</div><div class="d muted">${U.fmt(fsx.monthLiters, 1)} L · ${U.moneyTxt(fsx.monthValue)}</div></div>
          <div class="metric"><div class="lbl">Projeção 1.000 km</div><div class="v">${U.moneyTxt(fsx.perKm * 1000)}</div><div class="d muted">no seu consumo atual</div></div></div>
          <div class="chart-box sm"><canvas id="car-cons"></canvas></div>
          ${Object.keys(fsx.kinds).length > 1 ? `<div class="list mt">${Object.entries(fsx.kinds).map(([k, v]) => `<div class="li"><div class="grow"><div class="t">${U.esc(k)}</div><div class="s">${v.n} abastecimento(s)</div></div><b>${U.fmt(v.kmL, 1)} km/L</b><small class="muted" style="min-width:110px;text-align:right">${U.moneyTxt(v.perKm)}/km</small></div>`).join('')}</div>` : ''}`
          : App.empty('⛽', 'Calcule o consumo real', 'Ao abastecer, zere o hodômetro parcial (trip). No próximo abastecimento, informe os km que ele marcou e os litros colocados — eu calculo km/L e quanto você gasta por km.', '<button class="btn primary" data-act="fAdd">＋ Registrar abastecimento</button>')}</div>
      <div class="card"><header><h3>🧮 Calculadoras</h3></header>
        <div class="calc"><b>Etanol ou gasolina?</b><div class="inline-form">${F.number('Gasolina R$/L', 'cGas', fsx.gas ? U.round(fsx.gas, 2) : '', 'data-input="carCalc" step="0.01"')}${F.number('Etanol R$/L', 'cEth', fsx.eth ? U.round(fsx.eth, 2) : '', 'data-input="carCalc" step="0.01"')}</div><div id="cr-fuel" class="calc-r"></div></div>
        <div class="calc"><b>Quanto custa a viagem?</b><div class="inline-form">${F.number('Distância (km, só ida)', 'tKm', '', 'data-input="carCalc"')}${F.number('Pedágios (R$)', 'tToll', '', 'data-input="carCalc"')}${F.number('Pessoas', 'tPpl', 1, 'data-input="carCalc" min="1"')}</div>
          <div class="inline-form">${F.number('Consumo (km/L)', 'tKmL', avg ? U.round(avg, 1) : 12, 'data-input="carCalc" step="0.1"')}${F.number('Preço do litro', 'tPrice', fsx.gas ? U.round(fsx.gas, 2) : 6, 'data-input="carCalc" step="0.01"')}</div><div id="cr-trip" class="calc-r"></div></div></div>
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
    const cons = V.consumption(c);
    if (cons.length) App.chart(document.getElementById('car-cons'), { type: 'line', data: { labels: cons.map((p) => U.dateBR(p.date).slice(0, 5)), datasets: [{ label: 'km/L', data: cons.map((p) => U.round(p.kmL, 2)), borderColor: '#22c55e', backgroundColor: App.alpha('#22c55e', .15), fill: true, tension: .3, yAxisID: 'y' }, { label: 'R$/km', data: cons.map((p) => U.round(p.perKm, 3)), borderColor: '#f97316', tension: .3, yAxisID: 'y2' }] }, options: { scales: { y2: { position: 'right', grid: { display: false } } } } });
    V.calc();
    App.chart(document.getElementById('car-cost'), { type: 'bar', data: { labels: ms.map(U.ymShort), datasets: [{ label: 'Combustível', data: data.map((d) => U.round(d.fuel)), backgroundColor: '#f97316', borderRadius: 4 }, { label: 'Manutenção', data: data.map((d) => U.round(d.maint)), backgroundColor: '#0ea5e9', borderRadius: 4 }] }, options: { scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${U.moneyTxt(x.raw)}` } } } } });
  };

  V.calc = () => {
    const c = V.current(); if (!c) return;
    const v = (n) => U.num((document.querySelector(`[name=${n}]`) || {}).value), set = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
    const k = V.fuelStats(c).kinds, gas = v('cGas'), eth = v('cEth');
    if (gas && eth) {
      // usa a relação REAL do seu carro quando há dados dos dois combustíveis; senão, a regra dos 70%
      const own = k.Gasolina && k.Etanol ? k.Etanol.kmL / k.Gasolina.kmL : null, lim = own || 0.7;
      const ratio = eth / gas, best = ratio <= lim ? 'Etanol' : 'Gasolina';
      set('cr-fuel', `${best === 'Etanol' ? '🌽' : '⛽'} <b>${best}</b> compensa <small class="muted">(etanol = ${U.fmt(ratio * 100, 0)}% da gasolina; limite ${U.fmt(lim * 100, 0)}% ${own ? 'pelo SEU consumo real' : 'pela regra geral'})</small>${own ? `<br><small class="muted">Seu carro: gasolina ${U.moneyTxt(gas / k.Gasolina.kmL)}/km · etanol ${U.moneyTxt(eth / k.Etanol.kmL)}/km</small>` : ''}`);
    } else set('cr-fuel', '<small class="muted">Informe os dois preços.</small>');
    const km = v('tKm'), kmL = v('tKmL') || 12, price = v('tPrice'), toll = v('tToll'), ppl = Math.max(1, v('tPpl') || 1);
    if (km && price) { const one = (km / kmL) * price + toll; set('cr-trip', `Ida: <b>${U.moneyTxt(one)}</b> · Ida e volta: <b>${U.moneyTxt(one * 2)}</b>${ppl > 1 ? ` · <b>${U.moneyTxt((one * 2) / ppl)}</b> por pessoa` : ''}<br><small class="muted">${U.fmt((km * 2) / kmL, 1)} L no total</small>`); }
    else set('cr-trip', '<small class="muted">Informe a distância.</small>');
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
    const lastKind = (fuel().filter((f) => f.car === c.id).pop() || {}).kind || 'Gasolina';
    App.modal({
      title: '⛽ Abastecimento',
      body: `<div class="note">💡 Zere o <b>hodômetro parcial (trip)</b> sempre que encher o tanque. No abastecimento seguinte, os km que ele marcar são os <b>km rodados</b>.</div>` +
        F.row(F.number('Km rodados desde o último abastecimento', 'trip', '', 'data-minput="fCalc" placeholder="Ex.: 412"'), F.number('Litros abastecidos', 'liters', '', 'required data-minput="fCalc" step="0.01"')) +
        F.row(F.number('Valor pago (R$)', 'value', '', 'data-minput="fVal" step="0.01"'), F.number('…ou preço por litro', 'ppl', '', 'data-minput="fPpl" step="0.001"'), F.select('Combustível', 'kind', ['Gasolina', 'Etanol', 'Diesel', 'GNV'], lastKind)) +
        F.row(F.date('Data', 'date', U.today()), F.number('Km total no painel (opcional)', 'km', '', `placeholder="${V.km(c) || ''}"`)) +
        F.check('Tanque cheio (consumo mais preciso)', 'full', true) + '<br>' + F.check('Lançar nos gastos (se pagou no débito/dinheiro — a fatura do cartão já traz)', 'toTx', false) +
        '<div class="note mt" id="f-res">Preencha km rodados e litros para ver o consumo.</div>',
      actions: {
        fCalc: (_, f) => res(f),
        fVal: (_, f) => { const l = U.num(f.liters.value), v = U.num(f.value.value); if (l && v) f.ppl.value = U.round(v / l, 3); res(f); },
        fPpl: (_, f) => { const l = U.num(f.liters.value), p = U.num(f.ppl.value); if (l && p) f.value.value = U.round(l * p, 2); res(f); },
      },
      onSubmit: (d) => {
        if (!d.liters) { App.toast('Informe os litros.', 'error'); return false; }
        const value = d.value || (d.ppl ? U.round(d.ppl * d.liters, 2) : 0);
        if (!value) { App.toast('Informe o valor pago ou o preço por litro.', 'error'); return false; }
        let km = d.km; if (!km && d.trip && V.km(c)) km = V.km(c) + d.trip; // atualiza o km total sozinho
        App.commit((s) => {
          s.fuel = s.fuel || []; s.fuel.push({ id: U.uid(), car: c.id, date: d.date, trip: d.trip || '', km: km || '', liters: d.liters, value, kind: d.kind, full: d.full });
          if (+km > (+c.km || 0)) s.vehicles.find((x) => x.id === c.id).km = +km;
          if (d.toTx) s.transactions.push({ id: U.uid(), date: d.date, desc: `Abastecimento ${d.kind} — ${c.name}`, value, kind: 'expense', categoryId: 'transporte', accountId: (App.Money.mainAcc() || {}).id, account: (App.Money.mainAcc() || {}).name, source: 'veiculo' });
        });
        App.toast(d.trip ? `⛽ ${U.fmt(d.trip / d.liters, 1)} km/L · ${U.moneyTxt(value / d.trip)}/km` : `⛽ ${U.moneyTxt(value / d.liters)}/L registrado`);
      },
    });
    function res(f) {
      const t = U.num(f.trip.value), l = U.num(f.liters.value), v = U.num(f.value.value) || (U.num(f.ppl.value) * l);
      const avg = V.fuelStats(c).kmL;
      if (!t || !l) { f.querySelector('#f-res').textContent = 'Preencha km rodados e litros para ver o consumo.'; return; }
      const kmL = t / l;
      f.querySelector('#f-res').innerHTML = `Consumo: <b>${U.fmt(kmL, 2)} km/L</b>${v ? ` · <b>${U.moneyTxt(v / t)}</b> por km · ${U.moneyTxt((v / t) * 100)} a cada 100 km` : ''}${avg ? `<br><small>${kmL >= avg ? '🟢 melhor' : '🔴 pior'} que a sua média (${U.fmt(avg, 1)} km/L)</small>` : ''}`;
    }
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
      fAdd: () => fModal(), carCalc: () => V.calc(), fDel: (t) => App.commit((s) => { s.fuel = s.fuel.filter((f) => f.id !== t.dataset.id); }),
    },
    quick: { fuel: () => (V.current() ? fModal() : App.go('veiculo')) },
  };
})(window.App);
