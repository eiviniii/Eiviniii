/* ==========================================================
   SITES ÚTEIS — seus atalhos com logo, descrição e busca
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const list = () => (st().sites = st().sites || []);
  const Sites = (App.Sites = {});

  const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } };
  const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  Sites.normalizeUrl = (u) => { u = (u || '').trim(); if (!u) return ''; if (!/^[a-z]+:/i.test(u)) u = 'https://' + u; return u; };

  /** Logo: emoji escolhido → favicon do site → letra colorida (sem internet). */
  Sites.logoHTML = (x, size = 44) => {
    const h = hue(host(x.url) || x.title);
    const bg = x.color || `hsl(${h} 70% 45%)`;
    const letter = U.esc((x.title || host(x.url) || '?').trim()[0].toUpperCase());
    const box = `width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.28)}px`;
    if (x.emoji) return `<span class="site-logo" style="${box};background:${App.alpha(bg.startsWith('#') ? bg : '#7c5cff', .16)};font-size:${size * 0.55}px">${U.esc(x.emoji)}</span>`;
    if (x.kind === 'whatsapp') return `<span class="site-logo" style="${box};background:#25d366;color:#fff;font-size:${size * 0.5}px">✆</span>`;
    const fav = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host(x.url))}&sz=128`;
    return `<span class="site-logo" style="${box};background:${bg}"><b style="font-size:${size * 0.45}px">${letter}</b><img src="${fav}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="if(this.naturalWidth<=16){this.remove()}else{this.parentNode.classList.add('has-img')}" onerror="this.remove()"></span>`;
  };

  Sites.open = (id) => {
    const x = list().find((s) => s.id === id); if (!x) return;
    window.open(x.url, '_blank', 'noopener');
    x.clicks = (x.clicks || 0) + 1; x.lastOpen = new Date().toISOString(); App.save();
  };

  /* ---------- sugestões prontas ---------- */
  const SUG = [
    ['PDF & documentos', [
      ['iLovePDF', 'https://www.ilovepdf.com/pt', 'Juntar, dividir, comprimir, converter e assinar PDF. PDF para Word/Excel/JPG.', 'pdf, juntar, dividir, comprimir, converter, word, assinar'],
      ['Smallpdf', 'https://smallpdf.com/pt', 'Editor de PDF online: editar, converter, comprimir e assinar.', 'pdf, editor, editar, converter, assinar'],
      ['PDF24 Tools', 'https://tools.pdf24.org/pt/', 'Dezenas de ferramentas de PDF grátis, inclusive OCR e extrair páginas.', 'pdf, ocr, extrator, extrair páginas, converter'],
      ['Sejda PDF Editor', 'https://www.sejda.com/pt/pdf-editor', 'Editar texto de PDF, preencher formulários e anotar.', 'pdf, editor, editar texto, formulário'],
      ['OnlineOCR', 'https://www.onlineocr.net/', 'Extrator de texto: transforma imagem ou PDF escaneado em texto/Word (OCR).', 'ocr, extrator, extrair texto, imagem para texto, scanner'],
      ['CloudConvert', 'https://cloudconvert.com/', 'Converter quase qualquer formato: vídeo, áudio, documento, imagem.', 'converter, conversor, formato, vídeo, áudio'],
      ['Convertio', 'https://convertio.co/pt/', 'Conversor de arquivos online com centenas de formatos.', 'converter, conversor, arquivos'],
    ]],
    ['Imagem & vídeo', [
      ['remove.bg', 'https://www.remove.bg/pt-br', 'Remover fundo de imagem automaticamente.', 'remover fundo, imagem, foto, recorte, png'],
      ['Photopea', 'https://www.photopea.com/', 'Editor de imagens no navegador parecido com o Photoshop (abre PSD).', 'editor de imagem, photoshop, psd, editar foto'],
      ['Canva', 'https://www.canva.com/', 'Criar artes, posts, apresentações, currículos e vídeos.', 'design, arte, post, apresentação, currículo, editor'],
      ['TinyPNG', 'https://tinypng.com/', 'Comprimir imagens PNG/JPG sem perder qualidade visível.', 'comprimir imagem, reduzir tamanho, png, jpg'],
      ['Squoosh', 'https://squoosh.app/', 'Redimensionar e comprimir imagens (do Google), funciona offline.', 'redimensionar, comprimir imagem, webp'],
      ['123apps', 'https://123apps.com/pt/', 'Cortar vídeo, cortar áudio, extrair áudio de vídeo, gravar tela.', 'cortar vídeo, cortar áudio, extrair áudio, mp3, editor de vídeo'],
      ['CapCut', 'https://www.capcut.com/', 'Editor de vídeo completo com legendas automáticas.', 'editor de vídeo, legenda, reels, tiktok'],
    ]],
    ['Comunicação & produtividade', [
      ['WhatsApp Web', 'https://web.whatsapp.com/', 'Seu WhatsApp no computador.', 'whatsapp, mensagens, conversa', '💬'],
      ['Telegram Web', 'https://web.telegram.org/', 'Telegram no navegador.', 'telegram, mensagens'],
      ['Gmail', 'https://mail.google.com/', 'E-mail do Google.', 'email, e-mail, gmail'],
      ['Google Drive', 'https://drive.google.com/', 'Arquivos na nuvem do Google.', 'nuvem, arquivos, drive, documentos'],
      ['Google Agenda', 'https://calendar.google.com/', 'Calendário do Google.', 'agenda, calendário'],
      ['Notion', 'https://www.notion.so/', 'Notas, wikis, tarefas e bancos de dados.', 'notas, anotações, tarefas'],
      ['Trello', 'https://trello.com/', 'Quadros Kanban para organizar tarefas.', 'tarefas, kanban, organização'],
      ['Excalidraw', 'https://excalidraw.com/', 'Quadro branco para desenhar diagramas e esquemas.', 'desenho, diagrama, quadro branco, mapa mental'],
    ]],
    ['Inteligência artificial & escrita', [
      ['Claude', 'https://claude.ai/', 'Assistente de IA para escrever, estudar, resumir e programar.', 'ia, inteligência artificial, resumo, assistente'],
      ['ChatGPT', 'https://chatgpt.com/', 'Assistente de IA da OpenAI.', 'ia, inteligência artificial, chat'],
      ['Gemini', 'https://gemini.google.com/', 'Assistente de IA do Google.', 'ia, inteligência artificial'],
      ['Perplexity', 'https://www.perplexity.ai/', 'Buscador com IA que cita as fontes.', 'ia, pesquisa, buscador'],
      ['Google Tradutor', 'https://translate.google.com/', 'Traduzir textos, documentos e sites.', 'tradutor, traduzir, inglês'],
      ['DeepL', 'https://www.deepl.com/translator', 'Tradutor com traduções muito naturais.', 'tradutor, traduzir'],
      ['LanguageTool', 'https://languagetool.org/pt-BR', 'Corretor ortográfico e gramatical.', 'corretor, ortografia, gramática, redação'],
    ]],
    ['Finanças & investimentos', [
      ['Status Invest', 'https://statusinvest.com.br/', 'Cotações, dividendos e indicadores de ações e FIIs.', 'fii, dividendos, ações, cotação, investimentos'],
      ['Funds Explorer', 'https://www.fundsexplorer.com.br/', 'Ranking e dados de fundos imobiliários.', 'fii, fundos imobiliários, ranking, dividendos'],
      ['Investidor10', 'https://investidor10.com.br/', 'Análises, carteiras e comparador de ativos.', 'investimentos, ações, fii, carteira'],
      ['Tesouro Direto', 'https://www.tesourodireto.com.br/', 'Títulos públicos e simulador do Tesouro.', 'tesouro, renda fixa, simulador'],
      ['Calculadora do Cidadão', 'https://www3.bcb.gov.br/CALCIDADAO/', 'Banco Central: corrigir valores, juros, financiamento.', 'calculadora, juros, correção, financiamento, banco central'],
      ['XP Investimentos', 'https://www.xpi.com.br/', 'Sua corretora.', 'xp, corretora, investimentos', '📈'],
      ['Nubank', 'https://nubank.com.br/', 'Banco digital.', 'nubank, banco, cdb', '💜'],
      ['Registrato (BCB)', 'https://www.bcb.gov.br/cidadaniafinanceira/registrato', 'Ver todas as suas contas, chaves Pix e dívidas no Banco Central.', 'banco central, dívidas, contas, pix'],
      ['Serasa', 'https://www.serasa.com.br/', 'Consultar score e negociar dívidas.', 'score, dívida, cpf'],
      ['brapi', 'https://brapi.dev/', 'API de cotações (token usado no Vida OS).', 'cotação, api, token'],
    ]],
    ['Estudos & concursos', [
      ['PCI Concursos', 'https://www.pciconcursos.com.br/', 'Concursos abertos, editais e provas anteriores.', 'concurso, edital, provas anteriores'],
      ['QConcursos', 'https://www.qconcursos.com/', 'Banco de questões de concursos por banca e matéria.', 'questões, concurso, banca, exercícios'],
      ['TEC Concursos', 'https://www.tecconcursos.com.br/', 'Questões comentadas e cadernos de estudo.', 'questões, concurso, simulado'],
      ['Estratégia Concursos', 'https://www.estrategiaconcursos.com.br/', 'Cursos e PDFs para concursos.', 'curso, concurso, pdf, aula'],
      ['Gran Cursos', 'https://www.grancursosonline.com.br/', 'Cursos online para concursos.', 'curso, concurso, aula'],
      ['AnkiWeb', 'https://ankiweb.net/', 'Flashcards com repetição espaçada.', 'flashcard, revisão, memorização'],
      ['YouTube', 'https://www.youtube.com/', 'Vídeo-aulas e muito mais.', 'vídeo, aula'],
    ]],
    ['Saúde & governo', [
      ['Strava', 'https://www.strava.com/', 'Registro de corridas e treinos.', 'corrida, treino, pace'],
      ['MyFitnessPal', 'https://www.myfitnesspal.com/pt', 'Contador de calorias e macros.', 'calorias, dieta, alimentação, macros'],
      ['gov.br', 'https://www.gov.br/', 'Serviços do governo federal.', 'governo, cpf, documentos, serviços'],
      ['Receita Federal', 'https://www.gov.br/receitafederal/', 'Imposto de renda, CPF e restituição.', 'imposto de renda, cpf, receita, restituição'],
    ]],
  ];

  /* ---------- estado da tela ---------- */
  const S = { q: '', cat: '', sort: 'pin', view: 'cards' };
  const cats = () => [...new Set(list().map((x) => x.category).filter(Boolean))].sort();
  const filtered = () => {
    const words = U.norm(S.q).split(/\s+/).filter(Boolean);
    let r = list().filter((x) => (!S.cat || x.category === S.cat) && words.every((w) => U.norm([x.title, x.desc, x.url, x.category, (x.tags || []).join(' ')].join(' ')).includes(w)));
    const by = { pin: (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.clicks || 0) - (a.clicks || 0) || a.title.localeCompare(b.title), az: (a, b) => a.title.localeCompare(b.title), recent: (a, b) => String(b.lastOpen || b.addedAt || '').localeCompare(String(a.lastOpen || a.addedAt || '')), used: (a, b) => (b.clicks || 0) - (a.clicks || 0) };
    return r.sort(by[S.sort]);
  };

  const card = (x) => `<div class="site-card" data-act="openSite" data-id="${x.id}" title="${U.esc(x.url)}">
      ${Sites.logoHTML(x, 48)}
      <div class="grow"><div class="t">${U.esc(x.title)} ${x.pinned ? '<span title="fixado no início">📌</span>' : ''}</div><div class="host">${U.esc(x.kind === 'whatsapp' ? 'WhatsApp · ' + (x.phone || '') : host(x.url))}</div>
        ${x.desc ? `<div class="d">${U.esc(x.desc)}</div>` : ''}
        ${(x.tags || []).length ? `<div class="tags">${x.tags.slice(0, 4).map((t) => `<span class="chip">${U.esc(t)}</span>`).join('')}</div>` : ''}</div>
      <div class="site-actions"><button class="icon-btn" data-act="pinSite" data-id="${x.id}" title="${x.pinned ? 'desafixar' : 'fixar no início'}">${x.pinned ? '★' : '☆'}</button><button class="icon-btn" data-act="editSite" data-id="${x.id}" title="editar">✏️</button></div>
    </div>`;

  const render = () => {
    const rows = filtered();
    return `<div class="page-head"><div><h1>🔗 Sites úteis</h1><p>Seus atalhos: ferramentas, extratores, editores, bancos, WhatsApp… tudo pesquisável.</p></div>
      <div class="actions"><button class="btn" data-act="suggest">✨ Sugestões prontas</button><button class="btn" data-act="addWpp">✆ Contato WhatsApp</button><button class="btn primary" data-act="addSite">＋ Site</button></div></div>
      <div class="card"><div class="filters" style="margin:0">
        <input placeholder="🔎 O que você precisa? ex.: “remover fundo”, “juntar pdf”, “extrair texto”…" value="${U.esc(S.q)}" data-input="q" style="flex:1;min-width:240px" id="site-q">
        <select data-change="sort">${[['pin', 'Fixados e mais usados'], ['used', 'Mais usados'], ['recent', 'Recentes'], ['az', 'A–Z']].map(([v, l]) => `<option value="${v}" ${S.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <div class="seg"><button class="${S.view === 'cards' ? 'on' : ''}" data-act="view" data-v="cards">▦</button><button class="${S.view === 'list' ? 'on' : ''}" data-act="view" data-v="list">☰</button></div>
      </div>
      ${cats().length ? `<div class="row mt"><button class="chip ${!S.cat ? 'info' : ''}" data-act="cat" data-c="">Todos (${list().length})</button>${cats().map((c) => `<button class="chip ${S.cat === c ? 'info' : ''}" data-act="cat" data-c="${U.esc(c)}">${U.esc(c)} (${list().filter((x) => x.category === c).length})</button>`).join('')}</div>` : ''}</div>
      ${list().length ? (rows.length ? `<div class="site-grid ${S.view} mt">${rows.map(card).join('')}</div>` : `<div class="card mt">${App.empty('🔍', 'Nada encontrado', `Nenhum site com “${U.esc(S.q)}”.`, `<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(S.q + ' site online grátis')}">Pesquisar “${U.esc(S.q)}” no Google ↗</a>`)}</div>`)
        : `<div class="card mt">${App.empty('🔗', 'Nenhum site ainda', 'Adicione os sites que você usa no dia a dia, ou comece pelas sugestões (PDF, extratores, editores, IA, investimentos, concursos…).', '<button class="btn primary" data-act="suggest">✨ Escolher sugestões</button>')}</div>`}`;
  };

  /* ---------- modais ---------- */
  const siteModal = (x = {}) => {
    const isNew = !x.id;
    const wpp = x.kind === 'whatsapp';
    App.modal({
      title: isNew ? (wpp ? 'Contato do WhatsApp' : 'Novo site') : 'Editar',
      body: (wpp
        ? F.row(F.text('Nome', 'title', x.title || '', 'required placeholder="Ex.: Meu WhatsApp / Mãe / Trabalho"'), F.text('Número com DDD', 'phone', x.phone || '', 'required placeholder="(41) 99999-9999" inputmode="tel"')) + F.text('Mensagem inicial (opcional)', 'msg', x.msg || '', 'placeholder="Olá!"')
        : F.row(F.text('Endereço (link)', 'url', x.url || '', 'required placeholder="ilovepdf.com" data-minput="urlTyped"')) + F.row(F.text('Nome', 'title', x.title || '', 'required'), F.text('Emoji (opcional, no lugar do logo)', 'emoji', x.emoji || '', 'maxlength="4" style="max-width:150px"', ''))) +
        '<div style="height:8px"></div>' + F.area('Descrição — o que ele faz (ajuda na busca)', 'desc', x.desc || '', 'rows="2" placeholder="Ex.: extrair texto de imagem, editor de PDF…"') + '<div style="height:8px"></div>' +
        F.row(F.text('Categoria', 'category', x.category || '', 'list="site-cats" placeholder="Ex.: PDF, Bancos, Estudos"'), F.text('Palavras-chave (vírgula)', 'tags', (x.tags || []).join(', '))) +
        `<datalist id="site-cats">${[...new Set([...cats(), ...SUG.map((s) => s[0])])].map((c) => `<option value="${U.esc(c)}">`).join('')}</datalist>` +
        F.check('📌 Fixar no painel inicial', 'pinned', x.pinned) + '<div class="mt" id="site-prev"></div>',
      actions: {
        urlTyped: (el, form) => { const h = host(Sites.normalizeUrl(el.value)); if (h && !form.title.dataset.touched) form.title.value = h.split('.')[0].replace(/^./, (c) => c.toUpperCase()); },
      },
      onMount: (form) => { if (form.title) form.title.addEventListener('input', () => (form.title.dataset.touched = 1)); },
      danger: isNew ? null : { label: 'Excluir', fn: () => App.commit((s) => { s.sites = s.sites.filter((y) => y.id !== x.id); }) },
      onSubmit: (d) => {
        const o = { title: d.title.trim(), desc: d.desc.trim(), category: d.category.trim(), tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean), pinned: !!d.pinned };
        if (wpp) {
          const num = d.phone.replace(/\D/g, ''); if (num.length < 10) { App.toast('Informe o número com DDD.', 'error'); return false; }
          Object.assign(o, { kind: 'whatsapp', phone: d.phone, msg: d.msg, url: `https://wa.me/${num.length <= 11 ? '55' + num : num}${d.msg ? '?text=' + encodeURIComponent(d.msg) : ''}`, category: o.category || 'WhatsApp' });
        } else { o.url = Sites.normalizeUrl(d.url); o.emoji = d.emoji.trim(); if (!o.url) return false; }
        if (!o.title) o.title = host(o.url);
        App.commit((s) => { s.sites = s.sites || []; if (isNew) s.sites.push({ id: U.uid(), addedAt: new Date().toISOString(), clicks: 0, ...o }); else Object.assign(s.sites.find((y) => y.id === x.id), o); });
        App.toast('Salvo');
      },
    });
  };

  const suggestModal = () => {
    const have = new Set(list().map((x) => host(x.url)));
    App.modal({
      title: '✨ Sugestões de sites úteis', wide: true, submitLabel: 'Adicionar selecionados',
      body: `<p class="muted">Marque os que você quer. Dá para editar tudo depois.</p>${SUG.map(([cat, items], ci) => `<h4 style="margin:16px 0 8px">${cat} <button type="button" class="btn sm ghost" data-mact="all" data-c="${ci}">marcar todos</button></h4>
        <div class="sug-grid">${items.map(([t, u, d, tags, emoji], i) => { const got = have.has(host(u)); return `<label class="sug ${got ? 'got' : ''}"><input type="checkbox" name="s${ci}_${i}" ${got ? 'disabled checked' : ''} data-c="${ci}">${Sites.logoHTML({ url: u, title: t, emoji }, 32)}<span><b>${U.esc(t)}</b><small>${U.esc(d)}</small></span></label>`; }).join('')}</div>`).join('')}`,
      actions: { all: (b, form) => form.querySelectorAll(`input[data-c="${b.dataset.c}"]:not(:disabled)`).forEach((c) => (c.checked = true)) },
      onSubmit: (d) => {
        let n = 0;
        App.commit((s) => {
          s.sites = s.sites || [];
          SUG.forEach(([cat, items], ci) => items.forEach(([t, u, desc, tags, emoji], i) => {
            if (d[`s${ci}_${i}`] && !have.has(host(u))) { s.sites.push({ id: U.uid(), title: t, url: u, desc, category: cat, tags: tags.split(',').map((x) => x.trim()), emoji: emoji || '', clicks: 0, addedAt: new Date().toISOString() }); n++; }
          }));
        });
        App.toast(`${n} site(s) adicionados`);
      },
    });
  };

  /* widget do painel inicial */
  Sites.widget = () => {
    const pins = list().filter((x) => x.pinned);
    const show = (pins.length ? pins : list().slice().sort((a, b) => (b.clicks || 0) - (a.clicks || 0))).slice(0, 12);
    return `<div class="card"><header><h3>🔗 Atalhos</h3><a class="btn sm ghost" href="#/sites">todos</a></header>
      ${show.length ? `<div class="shortcut-grid">${show.map((x) => `<a href="${U.esc(x.url)}" target="_blank" rel="noopener" data-act="countSite" data-id="${x.id}" title="${U.esc(x.desc || x.url)}">${Sites.logoHTML(x, 40)}<span>${U.esc(x.title)}</span></a>`).join('')}</div>`
        : App.empty('🔗', 'Sem atalhos', 'Adicione seus sites favoritos.', '<a class="btn sm" href="#/sites">adicionar</a>')}</div>`;
  };

  App.views.sites = {
    render,
    mount() { const q = document.getElementById('site-q'); if (q && S.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } },
    actions: {
      addSite: () => siteModal(), addWpp: () => siteModal({ kind: 'whatsapp' }),
      editSite: (t, e) => { e.stopPropagation(); siteModal(list().find((x) => x.id === t.dataset.id)); },
      pinSite: (t, e) => { e.stopPropagation(); App.commit(() => { const x = list().find((y) => y.id === t.dataset.id); x.pinned = !x.pinned; }); },
      openSite: (t, e) => { if (e.target.closest('.site-actions')) return; Sites.open(t.dataset.id); },
      suggest: () => suggestModal(),
      q: U.debounce((t) => { S.q = t.value; App.rerender(); }, 200),
      sort: (t) => { S.sort = t.value; App.rerender(); },
      view: (t) => { S.view = t.dataset.v; App.rerender(); },
      cat: (t) => { S.cat = t.dataset.c; App.rerender(); },
    },
    quick: { site: () => siteModal() },
  };
  App.globalActions.countSite = (t) => { const x = list().find((y) => y.id === t.dataset.id); if (x) { x.clicks = (x.clicks || 0) + 1; x.lastOpen = new Date().toISOString(); App.save(); } };
})(window.App);
