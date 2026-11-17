/* ==========================================================
   IMPOSTO DE RENDA ORGANIZADO · RACHAR CONTAS · LISTA DE DESEJOS
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const money = U.moneyTxt;

  /* ==========================================================
     IMPOSTO DE RENDA — junta tudo do ano-base
     ========================================================== */
  const IR = (App.IR = {});
  const S = { year: new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0) };
  const box = () => { const s = st(); s.irpf = s.irpf || {}; s.irpf[S.year] = s.irpf[S.year] || { items: [], informes: [], checks: {}, ignored: [] }; return s.irpf[S.year]; };
  const KIND = { saude: '🩺 Saúde (médico, dentista, exames, plano)', educacao: '🎓 Educação (escola, faculdade, pós)', previdencia: '🏦 Previdência privada (PGBL)', pensao: '⚖️ Pensão alimentícia', doacao: '❤️ Doações incentivadas', outro: '📎 Outro comprovante' };
  const CHECK = ['Informe de rendimentos do empregador', 'Informe de rendimentos dos bancos (Nubank…)', 'Informe da corretora (XP)', 'Recibos e notas de saúde', 'Comprovantes de educação', 'Recibo da declaração do ano anterior', 'Dados bancários para restituição', 'Documentos de bens (carro, imóvel)'];
  /** gastos do ano que parecem dedutíveis (saúde/educação) ainda não adicionados */
  IR.suggest = () => {
    const b = box(), have = new Set(b.items.map((i) => i.txId).concat(b.ignored));
    return App.Fin.tx(`${S.year}-01-01`, `${S.year}-12-31`).filter((t) => t.kind !== 'income' && ['saude', 'educacao'].includes(t.categoryId) && !have.has(t.id)).slice(0, 30);
  };
  IR.view = () => {
    const b = box(), y = S.year;
    const salary = U.sum(App.Fin.tx(`${y}-01-01`, `${y}-12-31`).filter((t) => t.kind === 'income' && t.categoryId === 'salario'), (t) => t.value);
    const divs = U.sum(st().dividends.filter((d) => d.date.startsWith(String(y))), (d) => d.value);
    const by = U.groupBy(b.items, (i) => i.kind);
    const sug = IR.suggest();
    const checks = CHECK.filter((c) => b.checks[c]).length;
    return `<div class="row between" style="margin-bottom:14px"><div class="row"><button class="btn sm" data-act="irYear" data-d="-1">‹</button><h2>Ano-base ${y} <small class="muted">(declaração ${y + 1})</small></h2><button class="btn sm" data-act="irYear" data-d="1">›</button></div>
      <div class="row"><button class="btn" data-act="irPrint">🖨️ Resumo para declarar</button><button class="btn primary" data-act="irAdd">＋ Comprovante</button></div></div>
    <div class="grid g4">
      <div class="card accent stat"><div class="lbl">Despesas dedutíveis</div><div class="val">${U.money(U.sum(b.items, (i) => i.value))}</div><div class="sub">${b.items.length} comprovante(s)</div></div>
      <div class="card stat"><div class="lbl">Salário recebido (lançado)</div><div class="val">${U.money(salary)}</div><div class="sub">confira no informe do empregador</div></div>
      <div class="card stat"><div class="lbl">Dividendos de FII (isentos)</div><div class="val">${U.money(divs)}</div><div class="sub">registrados em Proventos</div></div>
      <div class="card stat"><div class="lbl">Checklist</div><div class="val">${checks}/${CHECK.length}</div><div class="sub">documentos reunidos</div></div>
    </div>
    ${sug.length ? `<div class="card mt" style="border-color:var(--info)"><header><h3>🔎 Achei gastos que podem ser dedutíveis</h3><small class="muted">saúde e educação de ${y}</small></header><div class="list">${sug.map((t) => `<div class="li"><div class="ico">${App.Fin.cat(t.categoryId).icon}</div><div class="grow"><div class="t">${U.esc(t.desc)}</div><div class="s">${U.dateBR(t.date)}</div></div><b>${U.money(t.value)}</b><button class="btn sm" data-act="irTake" data-id="${t.id}">＋ Adicionar</button><button class="icon-btn" data-act="irSkip" data-id="${t.id}" title="não é dedutível">✕</button></div>`).join('')}</div><p class="muted"><small>Farmácia, academia e óculos <b>não</b> são dedutíveis. Consultas, exames, dentista, plano de saúde, escola e faculdade são.</small></p></div>` : ''}
    <div class="grid g2 mt">
      <div class="card"><header><h3>🧾 Comprovantes dedutíveis</h3></header>
        ${b.items.length ? Object.entries(by).map(([k, arr]) => `<h4 class="sh-sec">${KIND[k] || k} — ${U.money(U.sum(arr, (i) => i.value))}</h4>${arr.map((i) => `<div class="li"><div class="grow"><div class="t">${U.esc(i.desc)}</div><div class="s">${U.dateBR(i.date)}${i.cnpj ? ' · CPF/CNPJ ' + U.esc(i.cnpj) : ''}${i.who ? ' · ' + U.esc(i.who) : ''}</div></div><b>${U.money(i.value)}</b>${i.fileId ? `<button class="icon-btn" data-act="openFile" data-id="${i.fileId}">📄</button>` : '<span class="chip warn" title="anexe o comprovante">sem arquivo</span>'}<button class="icon-btn" data-act="irEdit" data-id="${i.id}">✏️</button></div>`).join('')}`).join('') : App.empty('🧾', 'Nada ainda', 'Adicione recibos de médico, dentista, exames, escola… com o CPF/CNPJ de quem recebeu.')}</div>
      <div class="stack">
        <div class="card"><header><h3>📥 Informes de rendimento</h3><label class="btn sm btn-file">⬆ Subir<input type="file" multiple accept=".pdf,image/*" data-change="irInforme"></label></header>
          ${b.informes.length ? b.informes.map((f) => `<div class="li"><div class="ico">📄</div><div class="grow">${U.esc(f.name)}</div><button class="icon-btn" data-act="openFile" data-id="${f.id}">👁️</button><button class="icon-btn" data-act="irInfDel" data-id="${f.id}">✕</button></div>`).join('') : '<p class="muted">Empregador, bancos e corretora liberam até o fim de fevereiro.</p>'}</div>
        <div class="card"><header><h3>🏠 Bens e direitos em 31/12</h3></header>
          ${st().fiis.map((x) => `<div class="li"><div class="grow">🏢 ${U.esc(x.ticker)} — ${x.qty} cotas</div><b>${U.money(x.qty * x.avg)}</b></div>`).join('')}
          ${st().fixed.map((f) => `<div class="li"><div class="grow">🏦 ${U.esc(f.name || f.type)} (${U.esc(f.institution || '')})</div><b>${U.money(App.Inv.fixedValue(f, `${y}-12-31`).gross)}</b></div>`).join('')}
          ${(st().accounts || []).map((a) => `<div class="li"><div class="grow">💳 Conta ${U.esc(a.name)}</div><b>${U.money(App.Money.balance(a, `${y}-12-31`))}</b></div>`).join('')}
          ${(st().vehicles || []).map((c) => `<div class="li"><div class="grow">🚗 ${U.esc(c.name)}${c.plate ? ' · ' + U.esc(c.plate) : ''}</div><small class="muted">valor de compra</small></div>`).join('') || ''}
          <p class="muted"><small>FIIs vão pelo <b>custo de compra</b> (não pela cotação). Confira os saldos nos informes.</small></p></div>
        <div class="card"><header><h3>✅ Checklist</h3></header>${CHECK.map((c) => `<label class="check" style="margin-bottom:6px"><input type="checkbox" data-change="irCheck" data-c="${U.esc(c)}" ${b.checks[c] ? 'checked' : ''}><span>${U.esc(c)}</span></label>`).join('')}</div>
      </div></div>`;
  };
  const itemModal = (i = {}) => {
    let file = null;
    App.modal({
      title: i.id ? 'Editar comprovante' : 'Novo comprovante',
      body: F.row(F.select('Tipo', 'kind', Object.entries(KIND), i.kind || 'saude'), F.date('Data do pagamento', 'date', i.date || `${S.year}-01-01`), F.number('Valor (R$)', 'value', i.value)) +
        F.row(F.text('Descrição', 'desc', i.desc || '', 'required placeholder="Ex.: Consulta Dr. Fulano"'), F.text('CPF/CNPJ de quem recebeu', 'cnpj', i.cnpj || '')) + F.row(F.text('Beneficiário (você ou dependente)', 'who', i.who || 'Eu')) +
        `<label class="btn btn-file mt">📎 Anexar recibo/nota<input type="file" accept=".pdf,image/*" data-mchange="f"></label> <small id="ir-f" class="muted">${i.fileId ? 'arquivo já anexado' : ''}</small>`,
      actions: { f: (inp, form) => { file = inp.files[0]; form.querySelector('#ir-f').textContent = file ? file.name : ''; } },
      danger: i.id ? { label: 'Excluir', fn: () => App.commit(() => { const b = box(); b.items = b.items.filter((x) => x.id !== i.id); if (i.fileId) App.files.del(i.fileId); }) } : null,
      onSubmit: async (d) => {
        if (!d.desc || !d.value) return false;
        let fileId = i.fileId; if (file) fileId = await App.files.put(file);
        App.commit(() => { const b = box(); const o = { ...d, fileId }; if (i.id) Object.assign(b.items.find((x) => x.id === i.id), o); else b.items.push({ id: U.uid(), txId: i.txId, ...o }); });
      },
    });
  };
  IR.actions = {
    irYear: (t) => { S.year += +t.dataset.d; App.rerender(); },
    irAdd: () => itemModal(), irEdit: (t) => itemModal(box().items.find((x) => x.id === t.dataset.id)),
    irTake: (t) => { const tx = st().transactions.find((x) => x.id === t.dataset.id); itemModal({ txId: tx.id, kind: tx.categoryId === 'educacao' ? 'educacao' : 'saude', date: tx.date, value: tx.value, desc: tx.desc }); },
    irSkip: (t) => App.commit(() => box().ignored.push(t.dataset.id)),
    irCheck: (t) => { box().checks[t.dataset.c] = t.checked; App.save(); App.rerender(); },
    irInforme: async (t) => { for (const f of t.files) { const id = await App.files.put(f); box().informes.push({ id, name: f.name }); } App.save(); App.rerender(); App.toast('Informe(s) guardado(s)'); },
    irInfDel: (t) => App.confirm('Excluir este informe?', () => App.commit(() => { const b = box(); b.informes = b.informes.filter((x) => x.id !== t.dataset.id); App.files.del(t.dataset.id); })),
    irPrint: () => {
      const b = box(), y = S.year, by = U.groupBy(b.items, (i) => i.kind);
      const w = window.open('', '_blank');
      w.document.write(`<!doctype html><meta charset="utf-8"><title>IR ${y + 1}</title><body style="font-family:system-ui;padding:24px;color:#111"><h1>Resumo para a declaração ${y + 1} (ano-base ${y})</h1>
        ${Object.entries(by).map(([k, arr]) => `<h3>${KIND[k]} — ${money(U.sum(arr, (i) => i.value))}</h3><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%"><tr><th>Data</th><th>Descrição</th><th>CPF/CNPJ</th><th>Beneficiário</th><th>Valor</th></tr>${arr.map((i) => `<tr><td>${U.dateBR(i.date)}</td><td>${U.esc(i.desc)}</td><td>${U.esc(i.cnpj || '')}</td><td>${U.esc(i.who || '')}</td><td>${money(i.value)}</td></tr>`).join('')}</table>`).join('')}
        <h3>Bens e direitos em 31/12/${y}</h3><ul>${st().fiis.map((x) => `<li>${U.esc(x.ticker)}: ${x.qty} cotas — custo ${money(x.qty * x.avg)}</li>`).join('')}${st().fixed.map((f) => `<li>${U.esc(f.name || f.type)} (${U.esc(f.institution || '')}) — ${money(App.Inv.fixedValue(f, `${y}-12-31`).gross)}</li>`).join('')}</ul>
        <h3>Rendimentos isentos</h3><p>Dividendos de FII: ${money(U.sum(st().dividends.filter((d) => d.date.startsWith(String(y))), (d) => d.value))}</p><script>setTimeout(()=>print(),300)<\/script>`);
      w.document.close();
    },
  };

  /* ==========================================================
     RACHAR CONTAS
     ========================================================== */
  const SP = (App.Split = {});
  const groups = () => (st().splits = st().splits || []);
  const SS = { open: null };
  /** saldo de cada pessoa e as transferências mínimas para acertar */
  SP.settle = (g) => {
    const bal = Object.fromEntries(g.people.map((p) => [p, 0]));
    for (const it of g.items) {
      const among = (it.among && it.among.length ? it.among : g.people);
      bal[it.paidBy] = (bal[it.paidBy] || 0) + +it.value;
      among.forEach((p) => { bal[p] = (bal[p] || 0) - +it.value / among.length; });
    }
    const deb = Object.entries(bal).filter(([, v]) => v < -0.009).map(([p, v]) => [p, -v]).sort((a, b) => b[1] - a[1]);
    const cre = Object.entries(bal).filter(([, v]) => v > 0.009).sort((a, b) => b[1] - a[1]);
    const tr = []; let i = 0, j = 0;
    while (i < deb.length && j < cre.length) { const v = Math.min(deb[i][1], cre[j][1]); tr.push({ from: deb[i][0], to: cre[j][0], v: U.round(v) }); deb[i][1] -= v; cre[j][1] -= v; if (deb[i][1] < 0.01) i++; if (cre[j][1] < 0.01) j++; }
    return { bal, tr, total: U.sum(g.items, (x) => +x.value) };
  };
  SP.view = () => {
    const g = groups().find((x) => x.id === SS.open);
    if (!g) return `<div class="row between" style="margin-bottom:14px"><p class="muted" style="margin:0">Viagem, churrasco, bar, aluguel de casa na praia… registre quem pagou o quê e eu calculo quem deve a quem.</p><button class="btn primary" data-act="spNew">＋ Nova divisão</button></div>
      ${groups().length ? `<div class="grid g-auto">${groups().slice().reverse().map((x) => { const r = SP.settle(x); return `<div class="card" style="cursor:pointer" data-act="spOpen" data-id="${x.id}"><header><h3>🍕 ${U.esc(x.name)}</h3>${x.closed ? '<span class="chip ok">acertado</span>' : ''}</header><div class="muted">${x.people.length} pessoas · ${U.dateBR(x.date)}</div><div class="stat mt"><div class="val">${U.money(r.total)}</div><div class="sub">${r.tr.length ? r.tr.length + ' pagamento(s) para acertar' : 'tudo certo'}</div></div></div>`; }).join('')}</div>`
        : `<div class="card">${App.empty('🍕', 'Nenhuma divisão', 'Crie uma divisão, adicione as pessoas e os gastos.', '<button class="btn primary" data-act="spNew">＋ Nova divisão</button>')}</div>`}`;
    const r = SP.settle(g);
    const msg = `*${g.name}* — total ${money(r.total)}\n` + (r.tr.length ? r.tr.map((t) => `• ${t.from} → ${t.to}: ${money(t.v)}`).join('\n') : 'Tudo acertado ✅') + '\n_(calculado no Vida OS)_';
    return `<div class="row between" style="margin-bottom:14px"><div class="row"><button class="btn sm" data-act="spBack">‹ Voltar</button><h2>🍕 ${U.esc(g.name)}</h2></div><div class="row"><button class="btn" data-act="spEdit">✏️ Pessoas</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">💬 Enviar no WhatsApp</a></div></div>
    <div class="grid g3">
      <div class="card span2"><header><h3>🧾 Gastos</h3><small class="muted">total ${U.money(r.total)}</small></header>
        <form data-submit="spItem" class="inline-form" style="margin-bottom:10px"><input name="desc" placeholder="O quê (ex.: carne)" style="flex:1;min-width:140px" required><input name="value" type="number" step="0.01" placeholder="R$" style="width:110px" required>
          <select name="paidBy" style="width:auto">${g.people.map((p) => `<option>${U.esc(p)}</option>`).join('')}</select><button class="btn primary">＋</button></form>
        ${g.items.length ? g.items.map((it) => `<div class="li"><div class="grow"><div class="t">${U.esc(it.desc)}</div><div class="s">pago por <b>${U.esc(it.paidBy)}</b> · dividido entre ${(it.among && it.among.length ? it.among : g.people).map(U.esc).join(', ')}</div></div><b>${U.money(it.value)}</b><button class="icon-btn" data-act="spAmong" data-id="${it.id}" title="quem participa">👥</button><button class="icon-btn" data-act="spDel" data-id="${it.id}">✕</button></div>`).join('') : '<p class="muted">Adicione o primeiro gasto acima.</p>'}</div>
      <div class="stack">
        <div class="card"><header><h3>💸 Quem paga quem</h3></header>${r.tr.length ? r.tr.map((t) => `<div class="li"><div class="grow"><b>${U.esc(t.from)}</b> → <b>${U.esc(t.to)}</b></div><b>${U.money(t.v)}</b></div>`).join('') : '<p class="muted">Nada a acertar ✅</p>'}
          ${r.tr.length ? `<button class="btn block mt" data-act="spClose">${g.closed ? '↺ Reabrir' : '✅ Marcar como acertado'}</button>` : ''}</div>
        <div class="card"><header><h3>👥 Saldo de cada um</h3></header>${Object.entries(r.bal).map(([p, v]) => `<div class="li"><div class="grow">${U.esc(p)}</div><b class="${v >= 0 ? 'delta good' : 'delta badd'}">${v >= 0 ? 'recebe ' : 'deve '}${U.money(Math.abs(v))}</b></div>`).join('')}
          ${g.people.includes('Eu') ? `<button class="btn sm ghost mt" data-act="spMine">Lançar minha parte nos gastos</button>` : ''}</div>
      </div></div>`;
  };
  const groupModal = (g = {}) => App.modal({
    title: g.id ? 'Pessoas da divisão' : 'Nova divisão',
    body: F.row(F.text('Nome', 'name', g.name || '', 'required placeholder="Ex.: Churrasco sábado"'), F.date('Data', 'date', g.date || U.today())) + F.area('Pessoas (uma por linha ou separadas por vírgula)', 'people', (g.people || ['Eu']).join('\n'), 'rows="5"'),
    danger: g.id ? { label: 'Excluir divisão', fn: () => App.commit((s) => { s.splits = groups().filter((x) => x.id !== g.id); SS.open = null; }) } : null,
    onSubmit: (d) => { const people = [...new Set(d.people.split(/[\n,]/).map((x) => x.trim()).filter(Boolean))]; if (people.length < 2) { App.toast('Coloque pelo menos 2 pessoas.', 'error'); return false; }
      App.commit(() => { if (g.id) Object.assign(g, { name: d.name, date: d.date, people }); else { const id = U.uid(); groups().push({ id, name: d.name, date: d.date, people, items: [] }); SS.open = id; } }); },
  });
  SP.actions = {
    spNew: () => groupModal(), spOpen: (t) => { SS.open = t.dataset.id; App.rerender(); }, spBack: () => { SS.open = null; App.rerender(); },
    spEdit: () => groupModal(groups().find((x) => x.id === SS.open)),
    spItem: (form) => { const d = App.formData(form); if (!d.desc || !d.value) return; App.commit(() => groups().find((x) => x.id === SS.open).items.push({ id: U.uid(), desc: d.desc, value: d.value, paidBy: d.paidBy, among: [] })); },
    spDel: (t) => App.commit(() => { const g = groups().find((x) => x.id === SS.open); g.items = g.items.filter((x) => x.id !== t.dataset.id); }),
    spAmong: (t) => { const g = groups().find((x) => x.id === SS.open), it = g.items.find((x) => x.id === t.dataset.id); App.modal({ title: `Quem participa de “${U.esc(it.desc)}”?`, body: g.people.map((p) => F.check(U.esc(p), 'p_' + p, !(it.among && it.among.length) || it.among.includes(p))).join('<br>'), onSubmit: (d) => App.commit(() => { it.among = g.people.filter((p) => d['p_' + p]); }) }); },
    spClose: () => App.commit(() => { const g = groups().find((x) => x.id === SS.open); g.closed = !g.closed; }),
    spMine: () => { const g = groups().find((x) => x.id === SS.open); const share = U.sum(g.items, (it) => { const am = it.among && it.among.length ? it.among : g.people; return am.includes('Eu') ? +it.value / am.length : 0; }); App.commit((s) => s.transactions.push({ id: U.uid(), date: g.date, desc: `Minha parte — ${g.name}`, value: U.round(share), kind: 'expense', categoryId: 'lazer', accountId: (App.Money.mainAcc() || {}).id, account: (App.Money.mainAcc() || {}).name, source: 'divisao' })); App.toast(`Lançado: ${money(share)}`); },
  };

  /* ==========================================================
     LISTA DE DESEJOS
     ========================================================== */
  const WI = (App.Wish = {});
  const wishes = () => (st().wishes = st().wishes || []);
  const PRI = { 1: ['🔥 Muito quero', '#ef4444'], 2: ['⭐ Quero', '#f59e0b'], 3: ['💭 Um dia', '#64748b'] };
  WI.view = () => {
    const free = App.Money ? Math.max(0, App.Money.budget().free) : 0;
    const per = +st().settings.wishMonthly || Math.round(free * 0.5);
    const open = wishes().filter((w) => !w.bought).sort((a, b) => (a.pri || 2) - (b.pri || 2) || (a.price || 0) - (b.price || 0));
    let acc = 0;
    const rows = open.map((w) => { const left = Math.max(0, (w.price || 0) - (w.saved || 0)); acc += left; return { w, left, months: per ? Math.ceil(acc / per) : null }; });
    return `<div class="grid g3"><div class="card accent stat"><div class="lbl">Na lista</div><div class="val">${U.money(U.sum(open, (w) => w.price || 0))}</div><div class="sub">${open.length} desejo(s)</div></div>
      <div class="card stat"><div class="lbl">Separar por mês para desejos</div><div class="inline-form" style="margin-top:6px"><input type="number" value="${per || ''}" data-change="wiPer" style="width:130px" placeholder="R$/mês"><small class="muted">${free ? `sobra do salário: ${money(free)}` : 'defina quanto separar'}</small></div></div>
      <div class="card stat"><div class="lbl">Ação</div><button class="btn primary mt" data-act="wiAdd">＋ Novo desejo</button></div></div>
      <div class="card mt"><header><h3>🎁 Lista de desejos</h3><small class="muted">em ordem de prioridade — quando dá para comprar sem estourar o orçamento</small></header>
        ${rows.length ? rows.map(({ w, left, months }) => `<div class="li"><span class="dot" style="background:${PRI[w.pri || 2][1]}" title="${PRI[w.pri || 2][0]}"></span><div class="grow"><div class="t">${U.esc(w.name)} ${w.link ? `<a href="${U.esc(w.link)}" target="_blank" rel="noopener" title="abrir">↗</a>` : ''}</div>
          <div class="s">${PRI[w.pri || 2][0]}${w.saved ? ` · guardado ${money(w.saved)}` : ''}${w.priceGoal ? ` · comprar se baixar para ${money(w.priceGoal)}` : ''}</div>${w.saved && w.price ? `<div class="bar" style="margin-top:4px"><i style="width:${Math.min(100, (w.saved / w.price) * 100)}%"></i></div>` : ''}</div>
          <b>${U.money(w.price || 0)}</b><span class="chip ${left === 0 ? 'ok' : ''}">${left === 0 ? 'dá para comprar!' : months ? `≈ ${U.ymShort(U.addMonthsYM(U.ym(), months))}` : '—'}</span>
          <button class="icon-btn" data-act="wiSave" data-id="${w.id}" title="guardar dinheiro">💰</button><button class="icon-btn" data-act="wiBuy" data-id="${w.id}" title="comprei">✅</button><button class="icon-btn" data-act="wiEdit" data-id="${w.id}">✏️</button></div>`).join('')
          : App.empty('🎁', 'Lista vazia', 'Coloque aqui o que você quer comprar: preço, link e prioridade. Eu mostro quando cabe no seu orçamento.')}</div>
      ${wishes().some((w) => w.bought) ? `<details class="mt"><summary class="muted">Comprados (${wishes().filter((w) => w.bought).length})</summary>${wishes().filter((w) => w.bought).map((w) => `<div class="li"><div class="grow">✅ ${U.esc(w.name)}</div><small class="muted">${U.dateBR(w.bought)}</small><b>${U.money(w.paid || w.price || 0)}</b></div>`).join('')}</details>` : ''}`;
  };
  const wModal = (w = {}) => App.modal({
    title: w.id ? 'Editar desejo' : 'Novo desejo',
    body: F.row(F.text('O que é', 'name', w.name || '', 'required placeholder="Ex.: Relógio Garmin"'), F.number('Preço (R$)', 'price', w.price)) + F.row(F.text('Link', 'link', w.link || '', 'placeholder="https://"'), F.select('Prioridade', 'pri', Object.entries(PRI).map(([k, v]) => [k, v[0]]), w.pri || 2)) +
      F.row(F.number('Já guardei (R$)', 'saved', w.saved || 0), F.number('Comprar se baixar para (R$)', 'priceGoal', w.priceGoal)) + F.text('Observações', 'notes', w.notes || ''),
    danger: w.id ? { label: 'Excluir', fn: () => App.commit((s) => { s.wishes = wishes().filter((x) => x.id !== w.id); }) } : null,
    onSubmit: (d) => { if (!d.name) return false; d.pri = +d.pri; App.commit(() => { if (w.id) Object.assign(w, d); else wishes().push({ id: U.uid(), ...d }); }); },
  });
  WI.actions = {
    wiAdd: () => wModal(), wiEdit: (t) => wModal(wishes().find((x) => x.id === t.dataset.id)),
    wiPer: (t) => { st().settings.wishMonthly = U.num(t.value); App.save(); App.rerender(); },
    wiSave: (t) => { const w = wishes().find((x) => x.id === t.dataset.id); App.modal({ title: `Guardar para “${U.esc(w.name)}”`, body: F.number('Valor (R$)', 'v', ''), onSubmit: (d) => App.commit(() => { w.saved = U.round((w.saved || 0) + (d.v || 0)); }) }); },
    wiBuy: (t) => { const w = wishes().find((x) => x.id === t.dataset.id); App.modal({ title: `Comprei “${U.esc(w.name)}” 🎉`, body: F.row(F.number('Quanto paguei (R$)', 'paid', w.price), F.date('Data', 'date', U.today())) + F.check('Lançar nos gastos', 'tx', true) + '<p class="muted"><small>Se foi parcelado no cartão, cadastre em Parcelas & dívidas.</small></p>',
      onSubmit: (d) => App.commit((s) => { w.bought = d.date; w.paid = d.paid; if (d.tx) s.transactions.push({ id: U.uid(), date: d.date, desc: w.name, value: d.paid, kind: 'expense', categoryId: App.parse.categorize(w.name) === 'outros' ? 'compras' : App.parse.categorize(w.name), accountId: (App.Money.mainAcc() || {}).id, account: (App.Money.mainAcc() || {}).name, source: 'desejo' }); }) }); },
  };
})(window.App);
