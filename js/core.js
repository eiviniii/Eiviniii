/* ==========================================================
   VIDA OS — núcleo: estado, armazenamento, utilidades, UI
   Tudo fica salvo no seu navegador (localStorage + IndexedDB).
   ========================================================== */
window.App = window.App || {};
(function (App) {
  'use strict';

  const STORE_KEY = 'vidaos.state.v1';
  const KW_VERSION = 2; // aumente ao incluir palavras-chave novas nas categorias padrão

  /* ---------- utilidades ---------- */
  const U = {};
  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.num = (v, d = 0) => {
    if (v === null || v === undefined || v === '') return d;
    if (typeof v === 'number') return isFinite(v) ? v : d;
    let s = String(v).trim().replace(/R\$|\s/g, '');
    // 1.234,56 -> 1234.56 | 1,234.56 -> 1234.56 | 12,5 -> 12.5
    if (/,\d{1,2}$/.test(s) || (s.includes(',') && !s.includes('.'))) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return isFinite(n) ? n : d;
  };
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
  U.sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
  U.groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
  U.norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  U.money = (v) => `<span class="money">${brl.format(Number(v) || 0)}</span>`;
  U.moneyTxt = (v) => brl.format(Number(v) || 0);
  U.fmt = (v, d = 1) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  U.pct = (v, d = 1) => `${U.fmt(v, d)}%`;

  /* ---------- datas (sempre ISO local YYYY-MM-DD) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  U.iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  U.today = () => U.iso(new Date());
  U.parseISO = (s) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d || 1); };
  U.ym = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  U.addDays = (iso, n) => { const d = U.parseISO(iso); d.setDate(d.getDate() + n); return U.iso(d); };
  U.addMonthsYM = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return U.ym(d); };
  U.diffMonths = (a, b) => { const [ya, ma] = a.split('-').map(Number); const [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); };
  U.diffDays = (a, b) => Math.round((U.parseISO(b) - U.parseISO(a)) / 86400000);
  U.MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  U.MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  U.DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  U.DAY3 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  U.ymLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${U.MONTHS[m - 1]}/${y}`; };
  U.ymShort = (ym) => { const [y, m] = ym.split('-').map(Number); return `${U.MON[m - 1]}/${String(y).slice(2)}`; };
  U.dateBR = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  U.dateNice = (iso) => { if (!iso) return '—'; const d = U.parseISO(iso); return `${U.DAY3[d.getDay()]}, ${d.getDate()} ${U.MON[d.getMonth()]}`; };
  U.weekStart = (iso) => { const d = U.parseISO(iso); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return U.iso(d); }; // segunda
  U.age = (birth) => { if (!birth) return null; const b = U.parseISO(birth), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--; return a; };
  U.relDays = (iso) => {
    const n = U.diffDays(U.today(), iso);
    if (n === 0) return 'hoje'; if (n === 1) return 'amanhã'; if (n === -1) return 'ontem';
    return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
  };
  App.U = U;

  /* ---------- estado padrão ---------- */
  const C = (name, icon, color, keywords, budget = 0) => ({ id: U.norm(name).replace(/\W+/g, '-'), name, icon, color, keywords, budget });
  App.defaultCategories = () => [
    C('Alimentação', '🍔', '#f97316', ['chocolate', 'cacau show', 'kopenhagen', 'bodega', 'lanchonete', 'restaurant', 'grill', 'espetinho', 'hamburgu', 'cafeteria', 'doceria', 'sorveteria', 'ifood', 'restaurante', 'lanchonete', 'padaria', 'burger', 'pizza', 'rappi', 'mcdonald', 'bk ', 'subway', 'acai', 'açaí', 'sorvete', 'cafe', 'café', 'bar e', 'churrasc', 'sushi', 'lanches', 'pastel', 'delivery', 'outback', 'habib', 'giraffas', 'coco bambu', 'starbucks', 'confeitaria']),
    C('Mercado', '🛒', '#22c55e', ['bistek', 'giassi', 'komprao', 'koch', 'cooper ', 'imperatriz', 'fort ', 'super ', 'mercearia', 'hiper', 'supermerc', 'mercado ', 'mercadinho', 'atacad', 'assai', 'assaí', 'carrefour', 'pao de acucar', 'pão de açúcar', 'extra ', 'big ', 'condor', 'angeloni', 'muffato', 'sacolao', 'hortifruti', 'açougue', 'acougue', 'fort atacadista', 'makro', 'dia brasil', 'zaffari', 'savegnago']),
    C('Farmácia', '💊', '#06b6d4', ['farmac', 'drogaria', 'drogasil', 'raia', 'pague menos', 'panvel', 'nissei', 'drogal', 'pacheco', 'sao joao', 'são joão', 'ultrafarma', 'drogao']),
    C('Saúde', '🩺', '#14b8a6', ['clinica', 'clínica', 'hospital', 'laborat', 'unimed', 'consulta', 'odonto', 'dentista', 'exame', 'amil', 'hapvida', 'psicolog', 'fisioter', 'nutricion']),
    C('Fitness', '🏋️', '#a855f7', ['academia', 'smart fit', 'smartfit', 'bluefit', 'bodytech', 'centauro', 'decathlon', 'growth', 'suplement', 'max titanium', 'integral medica', 'crossfit', 'gympass', 'wellhub', 'totalpass']),
    C('Transporte', '🚗', '#eab308', ['park', 'estacionament', 'auto posto', 'posto ', 'zona azul', 'uber', '99app', '99 ', 'posto', 'combust', 'shell', 'ipiranga', 'petrobras', 'br mania', 'estaciona', 'pedagio', 'pedágio', 'sem parar', 'conectcar', 'veloe', 'metro', 'metrô', 'onibus', 'ônibus', 'cabify', 'oficina', 'auto pecas', 'detran', 'ipva']),
    C('Lazer', '🎉', '#ec4899', ['cinema', 'cinemark', 'ingresso', 'sympla', 'eventim', 'show', 'steam', 'playstation', 'xbox', 'nintendo', 'boliche', 'parque', 'teatro', 'balada', 'pub', 'cervejaria', 'tabacaria']),
    C('Assinaturas', '📺', '#8b5cf6', ['netflix', 'spotify', 'prime video', 'amazon prime', 'youtube', 'disney', 'hbo', 'max.com', 'globoplay', 'icloud', 'apple.com', 'google one', 'google storage', 'chatgpt', 'openai', 'claude', 'anthropic', 'deezer', 'paramount', 'crunchyroll', 'microsoft']),
    C('Casa & Contas', '🏠', '#3b82f6', ['energia', 'copel', 'cemig', 'enel', 'light ', 'celesc', 'coelba', 'sanepar', 'sabesp', 'copasa', 'agua', 'água', 'internet', 'vivo', 'claro', 'tim ', 'oi ', 'net ', 'aluguel', 'condominio', 'condomínio', 'gas ', 'gás', 'leroy', 'telhanorte', 'tok&stok', 'camicado']),
    C('Educação', '📚', '#0ea5e9', ['hotmart', 'htm *', 'htm*', 'kiwify', 'eduzz', 'resumo', 'curso', 'udemy', 'alura', 'estrategia', 'estratégia', 'gran ', 'grancursos', 'direcao concursos', 'qconcursos', 'livraria', 'apostila', 'faculdade', 'universidade', 'escola', 'cebraspe', 'vunesp', 'fgv', 'ibfc', 'idecan', 'aocp', 'inscricao', 'inscrição', 'kindle', 'amazon kindle']),
    C('Vestuário', '👕', '#f43f5e', ['renner', 'riachuelo', 'c&a', 'cea ', 'shein', 'zara', 'nike', 'adidas', 'puma', 'hering', 'marisa', 'pernambucanas', 'netshoes', 'dafiti', 'olympikus', 'mizuno', 'track&field']),
    C('Compras', '🛍️', '#f59e0b', ['tiktok shop', 'tiktok', 'magic toy', 'brinquedo', 'loja', 'amazon', 'mercado livre', 'mercadolivre', 'magalu', 'magazine luiza', 'shopee', 'aliexpress', 'americanas', 'casas bahia', 'kabum', 'temu', 'submarino', 'ponto frio']),
    C('Pets', '🐾', '#84cc16', ['petz', 'cobasi', 'pet ', 'veterin', 'petshop', 'pet shop']),
    C('Viagem', '✈️', '#10b981', ['hotel', 'airbnb', 'booking', 'latam', 'gol ', 'azul ', 'decolar', '123milhas', 'passagem', 'rodoviaria', 'pousada', 'hostel']),
    C('Investimentos', '📈', '#22d3ee', ['xp invest', 'aplicacao', 'aplicação', 'rico ', 'clear corretora', 'nuinvest', 'btg', 'tesouro', 'cdb']),
    C('Salário', '💰', '#16a34a', ['salario', 'salário', 'pagamento salario', 'proventos', 'folha']),
    C('Metas', '🎯', '#10b981', ['guardado para']),
    C('Transferências', '🔁', '#94a3b8', ['pix enviado', 'transferencia', 'transferência', 'ted ', 'doc ']),
    C('Outros', '📦', '#64748b', []),
  ];

  App.defaultTabs = () => [
    { id: 'inicio', label: 'Início', icon: '🏠', visible: true },
    { id: 'financas', label: 'Finanças', icon: '💰', visible: true },
    { id: 'investimentos', label: 'Investimentos', icon: '📈', visible: true },
    { id: 'estudos', label: 'Estudos', icon: '📚', visible: true },
    { id: 'fitness', label: 'Fitness', icon: '💪', visible: true },
    { id: 'agenda', label: 'Agenda', icon: '📅', visible: true },
    { id: 'sites', label: 'Sites úteis', icon: '🔗', visible: true },
    { id: 'ajustes', label: 'Ajustes', icon: '⚙️', visible: true },
  ];

  App.defaultWidgets = () => [
    { id: 'resumo', label: 'Resumo do mês', visible: true },
    { id: 'atalhos', label: 'Atalhos (sites)', visible: true },
    { id: 'agenda', label: 'Próximos compromissos', visible: true },
    { id: 'treino', label: 'Treino de hoje', visible: true },
    { id: 'estudo', label: 'Estudos de hoje', visible: true },
    { id: 'corpo', label: 'Corpo', visible: true },
    { id: 'parcelas', label: 'Parcelas do mês', visible: true },
    { id: 'concursos', label: 'Contagem para provas', visible: true },
    { id: 'patrimonio', label: 'Patrimônio', visible: true },
    { id: 'investir', label: 'Meta de investimento do mês', visible: true },
    { id: 'notas', label: 'Notas rápidas', visible: true },
  ];

  App.defaultState = () => ({
    version: 1,
    createdAt: U.today(),
    profile: { name: '', birth: '', height: 0, sex: 'M', goalWeight: 0, goalFat: 0, activity: 1.55 },
    settings: {
      theme: 'dark', accent: '#7c5cff', accent2: '#22d3ee', bg: 'aurora', radius: 16, fontScale: 100,
      density: 'normal', privacy: false, cdi: 14.9, ipca: 4.5, brapiToken: '',
      tabs: App.defaultTabs(), widgets: App.defaultWidgets(), avatarSkin: 'holo', pomodoro: 25, pause: 5,
    },
    categories: App.defaultCategories(),
    merchantMap: {},
    cards: [],
    installments: [],
    transactions: [],
    reports: [],
    fiis: [],
    fixed: [],
    otherAssets: [],
    dividends: [],
    snapshots: [],
    subjects: [],
    materials: [],
    schedule: [],
    sessions: [],
    concursos: [],
    plan: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day: d, name: '', items: [] })),
    workoutLogs: [],
    body: [],
    events: [],
    sites: [],
    accounts: [],
    rules: [],
    goals: [],
    planner: null,
    notes: '',
  });

  /* ---------- persistência ---------- */
  function deepMerge(def, saved) {
    if (Array.isArray(def)) return Array.isArray(saved) ? saved : def;
    if (def && typeof def === 'object') {
      const out = { ...def };
      if (saved && typeof saved === 'object') for (const k of Object.keys(saved)) out[k] = k in def ? deepMerge(def[k], saved[k]) : saved[k];
      return out;
    }
    return saved === undefined ? def : saved;
  }
  App.load = (saved) => {
    App.state = deepMerge(App.defaultState(), saved || {});
    // garante abas/widgets novos ao atualizar o sistema
    for (const c of App.defaultCategories()) {
      const mine = App.state.categories.find((x) => x.id === c.id);
      if (!mine) App.state.categories.splice(Math.max(0, App.state.categories.length - 1), 0, c);
      else if ((App.state.settings.kwVersion || 1) < KW_VERSION) for (const k of c.keywords) if (!(mine.keywords || []).includes(k)) (mine.keywords = mine.keywords || []).push(k);
    }
    App.state.settings.kwVersion = KW_VERSION; // novas palavras-chave chegam uma vez só (as que você apagar não voltam)
    const s = App.state.settings;
    for (const [key, defs] of [['tabs', App.defaultTabs()], ['widgets', App.defaultWidgets()]]) {
      for (const t of defs) if (!s[key].find((x) => x.id === t.id)) s[key].splice(Math.max(0, s[key].length - (key === 'tabs' ? 1 : 0)), 0, t);
    }
  };
  App.save = (now) => {
    if (!App.storage || !App.storage.backend) { try { localStorage.setItem(STORE_KEY, JSON.stringify(App.state)); } catch (e) { /* */ } return; }
    if (now) return App.storage.flush();
    App.storage.scheduleSave();
  };
  App.commit = (fn) => { fn && fn(App.state); App.save(); App.rerender(); };

  /* ---------- arquivos (navegador ou pendrive — ver storage.js) ---------- */
  App.files = {
    put: (file, id) => App.storage.files.put(file, id),
    get: (id) => App.storage.files.get(id),
    del: (id) => App.storage.files.del(id),
    all: () => App.storage.files.all(),
    url: async (id) => { const f = await App.storage.files.get(id); return f ? URL.createObjectURL(f.blob) : null; },
    open: async (id) => {
      const w = window.open('', '_blank');
      const f = await App.storage.files.get(id);
      if (!f) { w && w.close(); return App.toast('Arquivo não encontrado.', 'error'); }
      const url = URL.createObjectURL(f.blob);
      if (w) w.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    },
  };

  /* ---------- UI: toast, modal, confirm ---------- */
  App.toast = (msg, type = 'ok') => {
    const box = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
  };

  App.modal = ({ title, body, wide, onSubmit, submitLabel = 'Salvar', onMount, actions = {}, hideFooter, danger }) => {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<form class="modal ${wide ? 'wide' : ''}" novalidate>
      <header><h3>${title}</h3><button type="button" class="icon-btn" data-close>✕</button></header>
      <div class="modal-body">${body}</div>
      ${hideFooter ? '' : `<footer>${danger ? `<button type="button" class="btn ghost danger" data-mact="__danger">${danger.label}</button><span style="flex:1"></span>` : ''}
      <button type="button" class="btn ghost" data-close>Cancelar</button>
      <button type="submit" class="btn primary">${submitLabel}</button></footer>`}
    </form>`;
    root.appendChild(wrap);
    const form = wrap.querySelector('form');
    const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); };
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return close();
      const a = e.target.closest('[data-mact]');
      if (a) {
        if (a.dataset.mact === '__danger') { danger.fn(); close(); return; }
        actions[a.dataset.mact] && actions[a.dataset.mact](a, form, close, e);
      }
    });
    form.addEventListener('change', (e) => { const a = e.target.closest('[data-mchange]'); a && actions[a.dataset.mchange] && actions[a.dataset.mchange](a, form, close, e); });
    form.addEventListener('input', (e) => { const a = e.target.closest('[data-minput]'); a && actions[a.dataset.minput] && actions[a.dataset.minput](a, form, close, e); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!onSubmit) return close();
      const r = await onSubmit(App.formData(form), form);
      if (r !== false) close();
    });
    const first = form.querySelector('input:not([type=hidden]),select,textarea');
    setTimeout(() => first && first.focus(), 50);
    onMount && onMount(form, close);
    return { form, close };
  };

  App.confirm = (msg, fn, label = 'Excluir') => App.modal({ title: 'Confirmar', body: `<p>${msg}</p>`, submitLabel: label, onSubmit: () => { fn(); } });

  App.formData = (form) => {
    const o = {};
    form.querySelectorAll('[name]').forEach((el) => {
      const k = el.name;
      if (el.type === 'checkbox') { o[k] = el.checked; return; }
      if (el.type === 'radio') { if (el.checked) o[k] = el.value; return; }
      if (el.type === 'file') { o[k] = el.files; return; }
      if (el.type === 'number' || el.dataset.num !== undefined) { o[k] = el.value === '' ? '' : U.num(el.value); return; }
      o[k] = el.value;
    });
    return o;
  };

  /* helpers de formulário */
  const F = {};
  F.field = (label, input, cls = '') => `<label class="field ${cls}"><span>${label}</span>${input}</label>`;
  F.input = (name, value = '', attrs = '') => `<input name="${name}" value="${U.esc(value)}" ${attrs}>`;
  F.text = (label, name, value, attrs = '', cls) => F.field(label, F.input(name, value, `type="text" ${attrs}`), cls);
  F.number = (label, name, value, attrs = '', cls) => F.field(label, F.input(name, value === 0 || value ? value : '', `type="number" step="any" inputmode="decimal" ${attrs}`), cls);
  F.date = (label, name, value, attrs = '', cls) => F.field(label, F.input(name, value, `type="date" ${attrs}`), cls);
  F.time = (label, name, value, attrs = '', cls) => F.field(label, F.input(name, value, `type="time" ${attrs}`), cls);
  F.month = (label, name, value, attrs = '', cls) => F.field(label, F.input(name, value, `type="month" ${attrs}`), cls);
  F.color = (label, name, value, cls) => F.field(label, F.input(name, value, 'type="color"'), cls);
  F.area = (label, name, value = '', attrs = '', cls) => F.field(label, `<textarea name="${name}" ${attrs}>${U.esc(value)}</textarea>`, cls);
  F.select = (label, name, options, value, attrs = '', cls) => F.field(label,
    `<select name="${name}" ${attrs}>${options.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${U.esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${U.esc(t)}</option>`; }).join('')}</select>`, cls);
  F.check = (label, name, checked) => `<label class="check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
  F.row = (...f) => `<div class="frow">${f.join('')}</div>`;
  App.F = F;

  /* ---------- gráficos ---------- */
  App.charts = [];
  App.cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  App.chart = (canvas, config) => {
    if (!canvas || !window.Chart) return null;
    const txt = App.cssVar('--muted'), grid = App.cssVar('--line');
    Chart.defaults.color = txt; Chart.defaults.borderColor = grid;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    config.options = config.options || {};
    config.options.responsive = true; config.options.maintainAspectRatio = false;
    config.options.plugins = config.options.plugins || {};
    config.options.plugins.legend = config.options.plugins.legend || { labels: { boxWidth: 10, usePointStyle: true } };
    const c = new Chart(canvas, config); App.charts.push(c); return c;
  };
  App.mix = (a, b, t) => {
    const h = (x) => { x = x.replace('#', ''); if (x.length === 3) x = x.split('').map((c) => c + c).join(''); const n = parseInt(x, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const A = h(a), Bc = h(b);
    return '#' + A.map((v, i) => Math.round(v + (Bc[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  App.destroyCharts = () => { App.charts.forEach((c) => c.destroy()); App.charts = []; };
  App.alpha = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

  /* ---------- roteamento & renderização ---------- */
  App.views = {};
  App.route = () => {
    const h = location.hash.replace(/^#\/?/, '') || 'inicio';
    const [view, sub, ...rest] = h.split('/');
    return { view, sub, rest };
  };
  App.go = (path) => { location.hash = '#/' + path; };

  let current = null;
  App.rerender = () => {
    const r = App.route();
    const v = App.views[r.view] || App.views.inicio;
    const el = document.getElementById('view');
    App.destroyCharts();
    const scroll = window.scrollY;
    el.innerHTML = v.render(r);
    v.mount && v.mount(el, r);
    if (current === r.view + '/' + (r.sub || '')) window.scrollTo(0, scroll); else window.scrollTo(0, 0);
    current = r.view + '/' + (r.sub || '');
    App.renderNav();
  };

  /* delegação de eventos: data-act / data-change / data-input / data-submit */
  App.bindView = () => {
    const el = document.getElementById('view');
    const handler = (attr) => (e) => {
      const t = e.target.closest(`[${attr}]`);
      if (!t || !el.contains(t)) return;
      const v = App.views[App.route().view] || App.views.inicio;
      const name = t.getAttribute(attr);
      const fn = (v.actions && v.actions[name]) || App.globalActions[name];
      if (fn) { if (attr === 'data-submit') e.preventDefault(); fn(t, e); }
    };
    el.addEventListener('click', handler('data-act'));
    el.addEventListener('change', handler('data-change'));
    el.addEventListener('input', handler('data-input'));
    el.addEventListener('submit', handler('data-submit'));
  };
  App.globalActions = {
    go: (t) => App.go(t.dataset.to),
    openFile: (t) => App.files.open(t.dataset.id),
  };

  /* ---------- tema ---------- */
  App.applyTheme = () => {
    const s = App.state.settings, r = document.documentElement;
    let theme = s.theme;
    if (theme === 'auto') theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    r.dataset.theme = theme; r.dataset.bg = s.bg; r.dataset.density = s.density;
    r.classList.toggle('privacy', !!s.privacy);
    r.style.setProperty('--accent', s.accent); r.style.setProperty('--accent2', s.accent2);
    r.style.setProperty('--accent-soft', App.alpha(s.accent, 0.16));
    r.style.setProperty('--radius', s.radius + 'px');
    r.style.fontSize = (s.fontScale / 100) * 16 + 'px';
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = theme === 'dark' ? '#0b0d14' : '#f4f6fb';
  };

  /* ---------- navegação ---------- */
  App.renderNav = () => {
    const r = App.route();
    const tabs = App.state.settings.tabs.filter((t) => t.visible || t.id === 'ajustes');
    const html = tabs.map((t) => `<a href="#/${t.id}" class="${r.view === t.id || (!App.views[r.view] && t.id === 'inicio') ? 'active' : ''}"><i>${t.icon}</i><span>${U.esc(t.label)}</span></a>`).join('');
    document.getElementById('nav').innerHTML = html;
    document.getElementById('bottomnav').innerHTML = html;
    const name = App.state.profile.name;
    document.getElementById('brand-sub').textContent = name ? `de ${name}` : 'seu sistema pessoal';
  };

  /* sub-abas internas */
  App.subtabs = (base, items, active) => `<nav class="subtabs">${items.map(([id, label]) => `<a href="#/${base}/${id}" class="${active === id ? 'active' : ''}">${label}</a>`).join('')}</nav>`;

  App.empty = (icon, title, text, btn = '') => `<div class="empty"><div class="empty-ico">${icon}</div><h4>${title}</h4><p>${text}</p>${btn}</div>`;

  App.loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
})(window.App);
