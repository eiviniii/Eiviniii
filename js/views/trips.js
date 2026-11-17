/* ==========================================================
   VIAGENS — orçamento × gasto real, roteiro, mala, combustível
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const T = (App.Trips = {});
  const trips = () => (st().trips = st().trips || []);
  const BUD = { transporte: '🚗 Transporte', hospedagem: '🏨 Hospedagem', alimentacao: '🍽️ Alimentação', passeios: '🎡 Passeios', compras: '🛍️ Compras', outros: '📦 Outros' };
  const MALA = ['Documento com foto (RG/CNH)', 'Carregador do celular', 'Remédios de uso contínuo', 'Escova e pasta de dente', 'Roupas para os dias', 'Roupa de banho', 'Protetor solar', 'Óculos de sol', 'Cartão / dinheiro', 'Garrafa de água'];
  const S = { open: null };

  T.spent = (t) => U.sum(t.items || [], (i) => +i.value || 0);
  T.planned = (t) => U.sum(Object.values(t.budget || {}), (v) => +v || 0);
  T.fuelEstimate = (t) => {
    if (t.transport !== 'carro' || !t.distance) return null;
    const c = App.Vehicle && App.Vehicle.current(); const fs = c ? App.Vehicle.fuelStats(c) : null;
    const kmL = (fs && fs.kmL) || 12, price = (fs && (fs.gas || fs.eth)) || 6;
    const km = t.distance * (t.roundTrip !== false ? 2 : 1);
    return { km, kmL, price, liters: km / kmL, cost: (km / kmL) * price + (+t.tolls || 0), real: !!(fs && fs.kmL) };
  };
  const status = (t) => { const td = U.today(); return td < t.start ? ['em ' + U.diffDays(td, t.start) + ' dias', 'info'] : td > (t.end || t.start) ? ['concluída', ''] : ['acontecendo agora ✈️', 'ok']; };

  T.view = () => {
    const t = trips().find((x) => x.id === S.open);
    if (!t) {
      const list = trips().slice().sort((a, b) => (b.start || '').localeCompare(a.start || ''));
      return `<div class="page-head"><div><h1>✈️ Viagens</h1><p>Planeje o orçamento, o roteiro e a mala — e compare com o que gastou de verdade.</p></div><div class="actions"><button class="btn primary" data-act="trNew">＋ Nova viagem</button></div></div>
        ${list.length ? `<div class="grid g-auto">${list.map((x) => { const s = status(x), sp = T.spent(x), pl = T.planned(x); return `<div class="card trip-card" data-act="trOpen" data-id="${x.id}"><header><h3>${U.esc(x.emoji || '✈️')} ${U.esc(x.name)}</h3><span class="chip ${s[1]}">${s[0]}</span></header>
          <div class="muted">${U.esc(x.dest || '')} · ${U.dateBR(x.start)}${x.end ? ' a ' + U.dateBR(x.end) : ''}</div><div class="row between mt"><span>Gasto ${U.money(sp)}</span><span class="muted">de ${U.money(pl)}</span></div><div class="bar ${pl && sp > pl ? 'over' : ''}"><i style="width:${pl ? Math.min(100, (sp / pl) * 100) : 0}%"></i></div></div>`; }).join('')}</div>`
          : `<div class="card">${App.empty('✈️', 'Nenhuma viagem', 'Crie a primeira: destino, datas, orçamento por categoria, roteiro e checklist da mala.', '<button class="btn primary" data-act="trNew">＋ Nova viagem</button>')}</div>`}`;
    }
    const s = status(t), sp = T.spent(t), pl = T.planned(t), fe = T.fuelEstimate(t);
    const byCat = U.groupBy(t.items || [], (i) => i.cat || 'outros');
    const nDays = t.end ? U.diffDays(t.start, t.end) + 1 : 1;
    const checks = t.checklist || [];
    return `<div class="page-head"><div><h1>${U.esc(t.emoji || '✈️')} ${U.esc(t.name)}</h1><p>${U.esc(t.dest || '')} · ${U.dateBR(t.start)}${t.end ? ' a ' + U.dateBR(t.end) : ''} · ${nDays} dia(s) · ${t.people || 1} pessoa(s) <span class="chip ${s[1]}">${s[0]}</span></p></div>
      <div class="actions"><button class="btn" data-act="trBack">‹ Viagens</button><button class="btn" data-act="trEdit">✏️ Editar</button></div></div>
    <div class="grid g4">
      <div class="card accent stat"><div class="lbl">Gasto até agora</div><div class="val">${U.money(sp)}</div><div class="sub">${pl ? `${U.fmt((sp / pl) * 100, 0)}% do orçamento` : 'sem orçamento'}</div></div>
      <div class="card stat"><div class="lbl">Orçamento</div><div class="val">${U.money(pl)}</div><div class="sub">${pl ? `sobra ${U.money(pl - sp)}` : ''}</div></div>
      <div class="card stat"><div class="lbl">Por pessoa</div><div class="val">${U.money(sp / (t.people || 1))}</div><div class="sub">${U.money(sp / nDays)} por dia</div></div>
      <div class="card stat"><div class="lbl">${fe ? '⛽ Combustível estimado' : 'Transporte'}</div><div class="val">${fe ? U.money(fe.cost) : ({ aviao: '✈️ Avião', onibus: '🚌 Ônibus', carro: '🚗 Carro' })[t.transport] || '—'}</div><div class="sub">${fe ? `${U.fmt(fe.km, 0)} km · ${U.fmt(fe.liters, 1)} L · ${fe.real ? 'seu consumo real' : 'consumo estimado'}` : ''}</div></div>
    </div>
    <div class="grid g3 mt">
      <div class="card span2"><header><h3>💸 Gastos da viagem</h3><button class="btn sm" data-act="trPull" title="trazer lançamentos do período da viagem">⬇ Puxar dos lançamentos</button></header>
        <form data-submit="trItem" class="inline-form" style="margin-bottom:10px"><input name="desc" placeholder="O quê" required style="flex:1;min-width:140px"><input name="value" type="number" step="0.01" placeholder="R$" required style="width:100px"><select name="cat" style="width:auto">${Object.entries(BUD).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><input name="date" type="date" value="${U.today() >= t.start && U.today() <= (t.end || t.start) ? U.today() : t.start}" style="width:auto"><button class="btn primary">＋</button></form>
        ${Object.entries(BUD).map(([k, l]) => { const arr = byCat[k] || [], v = U.sum(arr, (i) => +i.value), b = +(t.budget || {})[k] || 0; if (!arr.length && !b) return ''; return `<div style="margin-bottom:12px"><div class="row between"><b>${l}</b><small class="muted">${U.money(v)}${b ? ' de ' + U.money(b) : ''}</small></div>${b ? `<div class="bar ${v > b ? 'over' : ''}"><i style="width:${Math.min(100, (v / b) * 100)}%"></i></div>` : ''}${arr.map((i) => `<div class="li"><div class="grow">${U.esc(i.desc)} <small class="muted">${U.dateBR(i.date)}</small></div><b>${U.money(i.value)}</b><button class="icon-btn" data-act="trDelItem" data-id="${i.id}">✕</button></div>`).join('')}</div>`; }).join('') || '<p class="muted">Lance os gastos durante a viagem — ou puxe dos lançamentos/fatura depois.</p>'}</div>
      <div class="stack">
        <div class="card"><header><h3>🧳 Mala & documentos</h3><small class="muted">${checks.filter((c) => c.done).length}/${checks.length}</small></header>
          ${checks.map((c, i) => `<label class="check" style="margin-bottom:6px"><input type="checkbox" data-change="trCheck" data-i="${i}" ${c.done ? 'checked' : ''}><span style="${c.done ? 'text-decoration:line-through;opacity:.6' : ''}">${U.esc(c.t)}</span></label>`).join('')}
          <form data-submit="trCheckAdd" class="inline-form mt"><input name="t" placeholder="＋ item" style="flex:1"></form></div>
        <div class="card"><header><h3>🗺️ Roteiro</h3></header>
          ${Array.from({ length: Math.min(nDays, 31) }, (_, i) => { const d = U.addDays(t.start, i); return `<div class="field" style="margin-bottom:8px"><span>${U.dateNice(d)}</span><textarea rows="2" data-change="trDay" data-d="${d}" placeholder="O que fazer neste dia…">${U.esc((t.days || {})[d] || '')}</textarea></div>`; }).join('')}</div>
      </div></div>`;
  };
  const tripModal = (t = {}) => App.modal({
    title: t.id ? 'Editar viagem' : 'Nova viagem', wide: true,
    body: F.row(F.text('Ícone', 'emoji', t.emoji || '✈️', 'maxlength="4" style="max-width:80px"', ''), F.text('Nome', 'name', t.name || '', 'required placeholder="Ex.: Férias em Bombinhas"'), F.text('Destino', 'dest', t.dest || '')) +
      F.row(F.date('Ida', 'start', t.start || U.today()), F.date('Volta', 'end', t.end || ''), F.number('Pessoas', 'people', t.people || 1, 'min="1"')) +
      F.row(F.select('Transporte', 'transport', [['carro', '🚗 Carro'], ['aviao', '✈️ Avião'], ['onibus', '🚌 Ônibus'], ['outro', 'Outro']], t.transport || 'carro'), F.number('Distância só ida (km)', 'distance', t.distance), F.number('Pedágios (R$)', 'tolls', t.tolls)) +
      '<h4 style="margin:10px 0">💰 Orçamento previsto</h4><div class="frow">' + Object.entries(BUD).map(([k, l]) => F.number(l, 'b_' + k, (t.budget || {})[k])).join('') + '</div>' +
      F.check('Aparecer na Agenda', 'agenda', t.agenda !== false),
    danger: t.id ? { label: 'Excluir', fn: () => App.commit((s) => { s.trips = trips().filter((x) => x.id !== t.id); S.open = null; }) } : null,
    onSubmit: (d) => {
      if (!d.name) return false;
      const budget = Object.fromEntries(Object.keys(BUD).map((k) => [k, d['b_' + k] || 0]));
      const o = { emoji: d.emoji, name: d.name, dest: d.dest, start: d.start, end: d.end, people: d.people || 1, transport: d.transport, distance: d.distance, tolls: d.tolls, budget, agenda: d.agenda };
      App.commit(() => {
        if (t.id) Object.assign(t, o);
        else { const id = U.uid(); const mala = MALA.concat(d.transport === 'carro' ? ['CNH', 'Documento do carro (CRLV)', 'Calibrar pneus e checar óleo'] : d.transport === 'aviao' ? ['Cartão de embarque', 'Checar limite de bagagem'] : []); trips().push({ id, ...o, items: [], checklist: mala.map((x) => ({ t: x, done: false })), days: {} }); S.open = id; }
      });
    },
  });
  T.events = (from, to) => trips().filter((t) => t.agenda !== false && t.start <= to && (t.end || t.start) >= from).map((t) => ({ id: 'trip|' + t.id, key: 'trip|' + t.id, virtual: true, title: `${t.emoji || '✈️'} ${t.name}`, type: 'compromisso', date: t.start >= from ? t.start : from }));
  T.actions = {
    trNew: () => tripModal(), trOpen: (t) => { S.open = t.dataset.id; App.rerender(); }, trBack: () => { S.open = null; App.rerender(); },
    trEdit: () => tripModal(trips().find((x) => x.id === S.open)),
    trItem: (form) => { const d = App.formData(form); if (!d.desc || !d.value) return; App.commit(() => trips().find((x) => x.id === S.open).items.push({ id: U.uid(), ...d })); },
    trDelItem: (t) => App.commit(() => { const tr = trips().find((x) => x.id === S.open); tr.items = tr.items.filter((i) => i.id !== t.dataset.id); }),
    trCheck: (t) => App.commit(() => { trips().find((x) => x.id === S.open).checklist[+t.dataset.i].done = t.checked; }),
    trCheckAdd: (form) => { const v = App.formData(form).t; if (v) App.commit(() => trips().find((x) => x.id === S.open).checklist.push({ t: v, done: false })); },
    trDay: (t) => { const tr = trips().find((x) => x.id === S.open); tr.days = tr.days || {}; tr.days[t.dataset.d] = t.value; App.save(); },
    trPull: () => {
      const tr = trips().find((x) => x.id === S.open), have = new Set((tr.items || []).map((i) => i.txId));
      const rows = App.Fin.tx(tr.start, tr.end || tr.start).filter((x) => x.kind !== 'income' && !App.Fin.isTransfer(x) && !have.has(x.id));
      if (!rows.length) return App.toast('Nenhum lançamento novo nas datas da viagem.', 'error');
      const map = { alimentacao: 'alimentacao', mercado: 'alimentacao', transporte: 'transporte', lazer: 'passeios', viagem: 'hospedagem', compras: 'compras', vestuario: 'compras' };
      App.modal({ title: 'Puxar lançamentos da viagem', wide: true, submitLabel: 'Adicionar marcados', body: `<p class="muted">Lançamentos entre ${U.dateBR(tr.start)} e ${U.dateBR(tr.end || tr.start)}:</p>${rows.map((x) => `<label class="li"><input type="checkbox" name="x_${x.id}" checked><div class="grow">${U.esc(x.desc)} <small class="muted">${U.dateBR(x.date)}</small></div><b>${U.money(x.value)}</b></label>`).join('')}`,
        onSubmit: (d) => App.commit(() => rows.filter((x) => d['x_' + x.id]).forEach((x) => tr.items.push({ id: U.uid(), txId: x.id, desc: x.desc, value: x.value, date: x.date, cat: map[x.categoryId] || 'outros' }))) });
    },
  };
  App.views.viagens = { render: T.view, actions: T.actions };
})(window.App);
