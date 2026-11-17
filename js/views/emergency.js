/* ==========================================================
   FICHA DE EMERGÊNCIA + GARANTIAS (sub-abas de Documentos)
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const E = (App.Emergency = {});
  const card = () => (st().emergency = st().emergency || { contacts: [] });
  const BLOOD = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const tel = (n) => String(n || '').replace(/\D/g, '');
  const wa = (n) => { const d = tel(n); return d ? `https://wa.me/${d.length <= 11 ? '55' + d : d}` : ''; };

  /** HTML da ficha (usado na aba, em tela cheia e na tela de bloqueio). */
  E.cardHTML = (c, prof = {}) => {
    const age = prof.birth ? U.age(prof.birth) : null;
    const row = (k, v, big) => (v ? `<div class="em-row ${big ? 'big' : ''}"><small>${k}</small><div>${U.esc(v)}</div></div>` : '');
    return `<div class="em-card">
      <div class="em-head"><span class="em-plus">✚</span><div><b>${U.esc(c.name || prof.name || 'Ficha de emergência')}</b><small>${[age ? age + ' anos' : '', prof.birth ? 'nasc. ' + U.dateBR(prof.birth) : '', c.cpf ? 'CPF ' + c.cpf : ''].filter(Boolean).join(' · ')}</small></div>
        ${c.blood ? `<div class="em-blood"><small>Sangue</small><b>${U.esc(c.blood)}</b></div>` : ''}</div>
      <div class="em-grid">
        ${row('⚠️ Alergias', c.allergies || 'Nenhuma conhecida', true)}${row('💊 Medicamentos em uso', c.meds)}${row('🩺 Condições de saúde', c.conditions)}
        ${row('🏥 Plano de saúde', [c.plan, c.planNumber && 'nº ' + c.planNumber].filter(Boolean).join(' · '))}${row('💳 Cartão SUS', c.sus)}
        ${row('👨‍⚕️ Médico', [c.doctor, c.doctorPhone].filter(Boolean).join(' · '))}${row('❤️ Doador de órgãos', c.donor ? 'Sim' : '')}${row('📝 Observações', c.notes)}
      </div>
      ${(c.contacts || []).length ? `<div class="em-contacts"><small>📞 Contatos de emergência</small>${c.contacts.map((x) => `<div class="em-ct"><div><b>${U.esc(x.name)}</b><small>${U.esc(x.rel || '')} · ${U.esc(x.phone || '')}</small></div>${tel(x.phone) ? `<a class="btn sm" href="tel:${tel(x.phone)}">📞 Ligar</a><a class="btn sm" target="_blank" rel="noopener" href="${wa(x.phone)}">💬</a>` : ''}</div>`).join('')}</div>` : ''}
      <div class="em-foot">Emergência: SAMU 192 · Bombeiros 193 · Polícia 190</div></div>`;
  };

  /* grava (ou apaga) a cópia sem criptografia usada na tela de bloqueio */
  E.syncLock = async () => {
    const S = App.storage, c = card();
    if (!S.isRemote()) return;
    try {
      if (c.showOnLock) await S.backend.write('emergencia.json', new TextEncoder().encode(JSON.stringify({ card: c, prof: { name: st().profile.name, birth: st().profile.birth } })));
      else await S.backend.remove('emergencia.json');
    } catch (e) { console.warn('ficha no bloqueio', e); }
  };

  E.view = () => {
    const c = card();
    const empty = !c.blood && !c.allergies && !(c.contacts || []).length;
    return `<div class="grid g2">
      <div>${empty ? `<div class="card">${App.empty('🆘', 'Monte sua ficha de emergência', 'Tipo sanguíneo, alergias, remédios e quem avisar. Em uma emergência, qualquer pessoa consegue te ajudar com essas informações.', '<button class="btn primary" data-act="emEdit">Preencher agora</button>')}</div>` : E.cardHTML(c, st().profile)}
        ${!empty ? '<div class="row mt"><button class="btn primary" data-act="emEdit">✏️ Editar</button><button class="btn" data-act="emFull">⛶ Mostrar em tela cheia</button><button class="btn" data-act="emPrint">🖨️ Imprimir (cartão para a carteira)</button></div>' : ''}</div>
      <div class="card"><header><h3>🔓 Na tela de bloqueio</h3>${c.showOnLock ? '<span class="chip ok">ativado</span>' : '<span class="chip">desativado</span>'}</header>
        <p class="muted">Com senha no cofre, tudo fica fechado. Ativando esta opção, um botão <b>“🆘 Ficha de emergência”</b> aparece na tela de senha, para alguém que te socorrer conseguir ver estas informações <b>sem</b> a senha.</p>
        <p class="muted"><small>Somente a ficha fica visível — nenhum outro dado. ${App.storage.isRemote() ? '' : 'Disponível no modo pendrive/pasta.'}</small></p>
        <button class="btn ${c.showOnLock ? '' : 'primary'}" data-act="emLock" ${App.storage.isRemote() ? '' : 'disabled'}>${c.showOnLock ? 'Desativar' : 'Ativar na tela de bloqueio'}</button></div>
    </div>`;
  };

  const editModal = () => {
    const c = card(); let contacts = (c.contacts || []).map((x) => ({ ...x }));
    const ctHTML = () => contacts.map((x, i) => `<div class="frow"><input placeholder="Nome" value="${U.esc(x.name || '')}" data-ct="${i}" data-k="name"><input placeholder="Relação (mãe, esposa…)" value="${U.esc(x.rel || '')}" data-ct="${i}" data-k="rel"><input placeholder="Telefone com DDD" value="${U.esc(x.phone || '')}" data-ct="${i}" data-k="phone" inputmode="tel"><button type="button" class="icon-btn" data-mact="ctDel" data-i="${i}">✕</button></div>`).join('');
    App.modal({
      title: '🆘 Ficha de emergência', wide: true,
      body: F.row(F.text('Nome completo', 'name', c.name || st().profile.name || ''), F.text('CPF', 'cpf', c.cpf || ''), F.select('Tipo sanguíneo', 'blood', BLOOD.map((b) => [b, b || '—']), c.blood || '')) +
        F.row(F.area('Alergias (remédios, alimentos, picadas…)', 'allergies', c.allergies || '', 'rows="2"'), F.area('Medicamentos em uso', 'meds', c.meds || '', 'rows="2"')) +
        F.row(F.area('Condições de saúde', 'conditions', c.conditions || '', 'rows="2" placeholder="Ex.: asma, diabetes, pressão alta"'), F.area('Observações', 'notes', c.notes || '', 'rows="2"')) +
        F.row(F.text('Plano de saúde', 'plan', c.plan || ''), F.text('Nº da carteirinha', 'planNumber', c.planNumber || ''), F.text('Cartão SUS', 'sus', c.sus || '')) +
        F.row(F.text('Médico', 'doctor', c.doctor || ''), F.text('Telefone do médico', 'doctorPhone', c.doctorPhone || '')) + F.check('❤️ Sou doador de órgãos', 'donor', c.donor) +
        `<h4 style="margin:16px 0 8px">📞 Contatos de emergência</h4><div id="ct-list">${ctHTML()}</div><button type="button" class="btn sm" data-mact="ctAdd">＋ Contato</button>`,
      actions: {
        ctAdd: (_, f) => { sync(f); contacts.push({}); f.querySelector('#ct-list').innerHTML = ctHTML(); },
        ctDel: (b, f) => { sync(f); contacts.splice(+b.dataset.i, 1); f.querySelector('#ct-list').innerHTML = ctHTML(); },
      },
      onMount: (f) => { if (!contacts.length) { contacts.push({}); f.querySelector('#ct-list').innerHTML = ctHTML(); } },
      onSubmit: async (d, f) => { sync(f); Object.assign(c, d, { contacts: contacts.filter((x) => x.name || x.phone) }); App.save(); await E.syncLock(); App.rerender(); App.toast('Ficha salva 🆘'); },
    });
    function sync(f) { f.querySelectorAll('[data-ct]').forEach((el) => { contacts[+el.dataset.ct][el.dataset.k] = el.value; }); }
  };

  E.full = (c = card(), prof = st().profile) => {
    const el = document.createElement('div'); el.className = 'em-full';
    el.innerHTML = `<button class="icon-btn em-x">✕</button>${E.cardHTML(c, prof)}`;
    document.body.appendChild(el);
    el.querySelector('.em-x').onclick = () => el.remove();
  };

  /* ==========================================================
     GARANTIAS & NOTAS FISCAIS
     ========================================================== */
  const W = (App.Warranty = {});
  const wl = () => (st().warranties = st().warranties || []);
  W.end = (w) => { if (!w.date) return null; const d = U.parseISO(w.date); d.setMonth(d.getMonth() + (+w.months || 0) + (+w.extra || 0)); return U.iso(d); };
  W.status = (w) => { const e = W.end(w); if (!e) return null; const n = U.diffDays(U.today(), e); return n < 0 ? { cls: '', txt: 'garantia encerrada', n } : n <= 30 ? { cls: 'warn', txt: `garantia acaba em ${n} dia(s)`, n } : { cls: 'ok', txt: `garantia até ${U.dateBR(e)}`, n }; };
  W.view = () => {
    const rows = wl().slice().sort((a, b) => String(W.end(a)).localeCompare(String(W.end(b))));
    const active = rows.filter((w) => W.status(w) && W.status(w).n >= 0);
    return `<div class="row between" style="margin-bottom:14px"><p class="muted" style="margin:0">Guarde a nota fiscal das compras importantes. Quando algo der defeito, está tudo aqui — com a data de fim da garantia.</p><button class="btn primary" data-act="wAdd">＋ Nota / garantia</button></div>
      ${rows.length ? `<div class="grid g4" style="margin-bottom:16px"><div class="card stat"><div class="lbl">Na garantia</div><div class="val">${active.length}</div></div><div class="card stat"><div class="lbl">Valor protegido</div><div class="val">${U.money(U.sum(active, (w) => w.value || 0))}</div></div></div>
        <div class="card"><div class="table-wrap"><table><thead><tr><th>Produto</th><th>Loja</th><th>Compra</th><th class="r">Valor</th><th>Garantia</th><th></th></tr></thead><tbody>
        ${rows.map((w) => { const s = W.status(w); return `<tr><td><b>${U.esc(w.product)}</b>${w.serial ? `<br><small class="muted">série ${U.esc(w.serial)}</small>` : ''}</td><td>${U.esc(w.store || '')}</td><td>${U.dateBR(w.date)}</td><td class="r">${w.value ? U.money(w.value) : ''}</td><td>${s ? `<span class="chip ${s.cls}">${s.txt}</span>` : ''}</td>
          <td class="actions">${(w.files || []).map((f) => `<button class="icon-btn" data-act="openFile" data-id="${f.id}" title="${U.esc(f.name)}">📄</button>`).join('')}<button class="icon-btn" data-act="wEdit" data-id="${w.id}">✏️</button></td></tr>`; }).join('')}</tbody></table></div></div>`
        : `<div class="card">${App.empty('🧾', 'Nenhuma nota guardada', 'Celular, notebook, eletrodomésticos, tênis… Foto ou PDF da nota + meses de garantia (lojas costumam dar 12 meses; o CDC garante 90 dias para defeitos).', '<button class="btn primary" data-act="wAdd">＋ Adicionar</button>')}</div>`}`;
  };
  const wModal = (w = {}) => {
    let files = (w.files || []).slice(); const added = [];
    const list = () => files.map((f, i) => `<div class="li"><div class="ico">📄</div><div class="grow">${U.esc(f.name)}</div><button type="button" class="icon-btn" data-mact="rm" data-i="${i}">✕</button></div>`).join('') || '<p class="muted" style="margin:0">Sem arquivos.</p>';
    App.modal({
      title: w.id ? 'Editar nota / garantia' : 'Nova nota / garantia',
      body: F.row(F.text('Produto', 'product', w.product || '', 'required placeholder="Ex.: Notebook Dell"'), F.text('Loja', 'store', w.store || '')) +
        F.row(F.date('Data da compra', 'date', w.date || U.today()), F.number('Valor (R$)', 'value', w.value), F.number('Garantia (meses)', 'months', w.months ?? 12), F.number('Garantia estendida (meses)', 'extra', w.extra || 0)) +
        F.row(F.text('Nº de série / IMEI', 'serial', w.serial || ''), F.text('Observações', 'notes', w.notes || '')) +
        `<div class="list" id="w-files">${list()}</div><label class="btn btn-file mt">📎 Anexar nota fiscal (foto/PDF)<input type="file" accept="image/*,.pdf" multiple data-mchange="add"></label><p id="w-prog" class="muted"></p>`,
      actions: {
        add: (inp, f) => { for (const x of inp.files) { const o = { id: U.uid(), name: x.name, type: x.type, _file: x }; files.push(o); added.push(o); } inp.value = ''; f.querySelector('#w-files').innerHTML = list(); },
        rm: (b, f) => { files.splice(+b.dataset.i, 1); f.querySelector('#w-files').innerHTML = list(); },
      },
      danger: w.id ? { label: 'Excluir', fn: () => App.commit((s) => { (w.files || []).forEach((f) => App.files.del(f.id)); s.warranties = s.warranties.filter((x) => x.id !== w.id); }) } : null,
      onSubmit: async (d, form) => {
        if (!d.product) return false;
        for (const x of added.filter((a) => files.includes(a))) { form.querySelector('#w-prog').textContent = 'Salvando ' + x.name + '…'; await App.files.put(x._file, x.id); delete x._file; }
        (w.files || []).filter((f) => !files.includes(f)).forEach((f) => App.files.del(f.id));
        const o = { ...d, files: files.map(({ _file, ...f }) => f) };
        App.commit((s) => { s.warranties = s.warranties || []; if (w.id) Object.assign(s.warranties.find((x) => x.id === w.id), o); else s.warranties.push({ id: U.uid(), ...o }); });
      },
    });
  };

  E.actions = {
    emEdit: () => editModal(), emFull: () => E.full(),
    emPrint: () => { const w = window.open('', '_blank'); w.document.write(`<!doctype html><meta charset="utf-8"><title>Ficha de emergência</title><link rel="stylesheet" href="${location.origin}${location.pathname.replace(/index\.html$/, '')}css/style.css"><body style="background:#fff;color:#111;padding:20px;display:block">${E.cardHTML(card(), st().profile)}<script>setTimeout(()=>print(),400)<\/script>`); w.document.close(); },
    emLock: async () => { card().showOnLock = !card().showOnLock; App.save(); await E.syncLock(); App.rerender(); App.toast(card().showOnLock ? 'A ficha aparecerá na tela de bloqueio' : 'Ficha removida da tela de bloqueio'); },
    wAdd: () => wModal(), wEdit: (t) => wModal(wl().find((w) => w.id === t.dataset.id)),
  };
})(window.App);
