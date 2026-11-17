/* ==========================================================
   ROTINA — tarefas (com prioridade e prazo) + hábitos diários
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const tasks = () => (st().tasks = st().tasks || []);
  const habits = () => (st().habits = st().habits || []);
  const R = (App.Rotina = {});
  const PRI = { alta: { l: 'Alta', c: '#ef4444', o: 0 }, media: { l: 'Média', c: '#f59e0b', o: 1 }, baixa: { l: 'Baixa', c: '#64748b', o: 2 } };

  R.open = () => tasks().filter((t) => !t.done).sort((a, b) => PRI[a.pri || 'media'].o - PRI[b.pri || 'media'].o || String(a.due || '9').localeCompare(String(b.due || '9')));
  R.streak = (h) => { let n = 0, d = U.today(); if (!(h.log || {})[d]) d = U.addDays(d, -1); while ((h.log || {})[d]) { n++; d = U.addDays(d, -1); } return n; };
  const dueChip = (t) => { if (!t.due) return ''; const n = U.diffDays(U.today(), t.due); return `<span class="chip ${n < 0 ? 'bad' : n === 0 ? 'warn' : ''}">${n < 0 ? `atrasada ${-n}d` : n === 0 ? 'hoje' : n === 1 ? 'amanhã' : U.dateBR(t.due).slice(0, 5)}</span>`; };

  const taskRow = (t) => `<div class="task ${t.done ? 'done' : ''}"><button class="tick" data-act="tkDone" data-id="${t.id}" style="border-color:${PRI[t.pri || 'media'].c}">${t.done ? '✓' : ''}</button>
    <div class="grow"><div class="t">${U.esc(t.title)}</div>${t.notes ? `<div class="s">${U.esc(t.notes)}</div>` : ''}</div>${dueChip(t)}<span class="dot" title="prioridade ${PRI[t.pri || 'media'].l}" style="background:${PRI[t.pri || 'media'].c}"></span><button class="icon-btn" data-act="tkEdit" data-id="${t.id}">✏️</button></div>`;

  R.view = () => {
    const open = R.open(), done = tasks().filter((t) => t.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt))).slice(0, 15);
    const days = Array.from({ length: 7 }, (_, i) => U.addDays(U.today(), i - 6));
    const today = U.today();
    const doneToday = habits().filter((h) => (h.log || {})[today]).length;
    return `<div class="page-head"><div><h1>✅ Rotina</h1><p>Tarefas do dia e hábitos — o que precisa ser feito, num lugar só.</p></div>
      <div class="actions"><button class="btn" data-act="clock">🕐 Relógio tela cheia</button></div></div>
    <div class="grid g3">
      <div class="card span2"><header><h3>📝 Tarefas</h3><small class="muted">${open.length} pendente(s)</small></header>
        <form data-submit="tkQuick" class="inline-form" style="margin-bottom:12px">
          <input name="title" placeholder="O que precisa fazer? (Enter para adicionar)" style="flex:1;min-width:200px" autocomplete="off">
          <select name="pri" style="width:auto">${Object.entries(PRI).map(([k, v]) => `<option value="${k}" ${k === 'media' ? 'selected' : ''}>${v.l}</option>`).join('')}</select>
          <input type="date" name="due" style="width:auto"><button class="btn primary">＋</button></form>
        ${open.length ? open.map(taskRow).join('') : App.empty('🎉', 'Nada pendente', 'Adicione tarefas acima.')}
        ${done.length ? `<details class="mt"><summary class="muted">Concluídas recentemente (${done.length})</summary>${done.map(taskRow).join('')}<button class="btn sm ghost mt" data-act="tkClear">Limpar concluídas</button></details>` : ''}
      </div>
      <div class="card"><header><h3>🔥 Hábitos de hoje</h3><button class="btn sm" data-act="hbAdd">＋</button></header>
        ${habits().length ? `<div class="row between" style="margin-bottom:10px"><small class="muted">${doneToday} de ${habits().length} feitos</small><small class="muted">${U.dateNice(today)}</small></div><div class="bar" style="margin-bottom:12px"><i style="width:${(doneToday / habits().length) * 100}%"></i></div>
          ${habits().map((h) => `<div class="habit"><button class="hb-today ${(h.log || {})[today] ? 'on' : ''}" data-act="hbTick" data-id="${h.id}" data-d="${today}" style="--c:${h.color || 'var(--accent)'}">${U.esc(h.icon || '⭐')}</button>
            <div class="grow"><div class="t">${U.esc(h.name)}</div><div class="s">🔥 ${R.streak(h)} dia(s) seguidos</div>
              <div class="hb-week">${days.map((d) => `<i class="${(h.log || {})[d] ? 'on' : ''}" title="${U.dateNice(d)}" data-act="hbTick" data-id="${h.id}" data-d="${d}" style="--c:${h.color || 'var(--accent)'}">${U.DAY3[U.parseISO(d).getDay()][0]}</i>`).join('')}</div></div>
            <button class="icon-btn" data-act="hbEdit" data-id="${h.id}">✏️</button></div>`).join('')}`
          : App.empty('🔥', 'Crie seus hábitos', 'Ex.: 💧 beber 2L de água, 📖 ler 20 min, 🏃 treinar, 📚 estudar.', '<button class="btn primary" data-act="hbSuggest">Sugestões</button>')}
      </div>
    </div>`;
  };

  const taskModal = (t = {}) => App.modal({
    title: t.id ? 'Editar tarefa' : 'Nova tarefa',
    body: F.row(F.text('Tarefa', 'title', t.title || '', 'required')) + F.row(F.select('Prioridade', 'pri', Object.entries(PRI).map(([k, v]) => [k, v.l]), t.pri || 'media'), F.date('Prazo', 'due', t.due || '')) + F.area('Detalhes', 'notes', t.notes || '', 'rows="2"'),
    danger: t.id ? { label: 'Excluir', fn: () => App.commit((s) => { s.tasks = s.tasks.filter((x) => x.id !== t.id); }) } : null,
    onSubmit: (d) => { if (!d.title) return false; App.commit((s) => { s.tasks = s.tasks || []; if (t.id) Object.assign(s.tasks.find((x) => x.id === t.id), d); else s.tasks.push({ id: U.uid(), createdAt: U.today(), ...d }); }); },
  });
  const habitModal = (h = {}) => App.modal({
    title: h.id ? 'Editar hábito' : 'Novo hábito',
    body: F.row(F.text('Ícone', 'icon', h.icon || '⭐', 'maxlength="4" style="max-width:80px"', ''), F.text('Hábito', 'name', h.name || '', 'required placeholder="Ex.: Beber 2L de água"'), F.color('Cor', 'color', h.color || '#7c5cff')),
    danger: h.id ? { label: 'Excluir', fn: () => App.commit((s) => { s.habits = s.habits.filter((x) => x.id !== h.id); }) } : null,
    onSubmit: (d) => { if (!d.name) return false; App.commit((s) => { s.habits = s.habits || []; if (h.id) Object.assign(s.habits.find((x) => x.id === h.id), d); else s.habits.push({ id: U.uid(), log: {}, ...d }); }); },
  });

  R.widget = () => {
    const open = R.open().slice(0, 5), today = U.today();
    return `<div class="card"><header><h3>✅ Hoje</h3><a class="btn sm ghost" href="#/rotina">rotina</a></header>
      <form data-submit="tkQuick" class="inline-form" style="margin-bottom:8px"><input name="title" placeholder="＋ Nova tarefa…" autocomplete="off" style="flex:1"></form>
      ${open.map(taskRow).join('') || '<p class="muted">Nenhuma tarefa pendente 🎉</p>'}
      ${habits().length ? `<div class="row mt">${habits().map((h) => `<button class="hb-today sm ${(h.log || {})[today] ? 'on' : ''}" title="${U.esc(h.name)}" data-act="hbTick" data-id="${h.id}" data-d="${today}" style="--c:${h.color || 'var(--accent)'}">${U.esc(h.icon || '⭐')}</button>`).join('')}</div>` : ''}</div>`;
  };

  const actions = {
    tkQuick: (form) => { const d = App.formData(form); if (!d.title || !d.title.trim()) return; App.commit((s) => { s.tasks = s.tasks || []; s.tasks.push({ id: U.uid(), title: d.title.trim(), pri: d.pri || 'media', due: d.due || '', createdAt: U.today() }); }); const i = document.querySelector('[data-submit=tkQuick] [name=title]'); if (i) i.focus(); },
    tkDone: (t) => App.commit(() => { const x = tasks().find((y) => y.id === t.dataset.id); x.done = !x.done; x.doneAt = x.done ? new Date().toISOString() : null; }),
    tkEdit: (t) => taskModal(tasks().find((y) => y.id === t.dataset.id)),
    tkClear: () => App.commit((s) => { s.tasks = s.tasks.filter((x) => !x.done); }),
    hbAdd: () => habitModal(), hbEdit: (t) => habitModal(habits().find((h) => h.id === t.dataset.id)),
    hbTick: (t) => App.commit(() => { const h = habits().find((x) => x.id === t.dataset.id); h.log = h.log || {}; if (h.log[t.dataset.d]) delete h.log[t.dataset.d]; else h.log[t.dataset.d] = 1; }),
    hbSuggest: () => App.commit((s) => { s.habits = [['💧', 'Beber 2L de água', '#0ea5e9'], ['📚', 'Estudar', '#7c5cff'], ['🏃', 'Treinar', '#22c55e'], ['📖', 'Ler 20 minutos', '#f59e0b'], ['😴', 'Dormir 7h+', '#64748b']].map(([icon, name, color]) => ({ id: U.uid(), icon, name, color, log: {} })); }),
  };
  Object.assign(App.globalActions, actions); // funcionam também no Início
  App.views.rotina = { render: R.view, actions, quick: { task: () => taskModal() } };
})(window.App);
