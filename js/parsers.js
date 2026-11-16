/* ==========================================================
   Leitura de arquivos + extração inteligente de dados
   PDF (pdf.js) · Excel/CSV (SheetJS) · OFX · Imagens (OCR)
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U;
  const P = (App.parse = {});

  /* ---------- leitura bruta ---------- */
  P.kind = (file) => {
    const n = file.name.toLowerCase();
    if (n.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
    if (/\.(xlsx|xls|ods)$/.test(n)) return 'sheet';
    if (/\.(csv|tsv|txt)$/.test(n)) return 'csv';
    if (n.endsWith('.ofx')) return 'ofx';
    if (n.endsWith('.json')) return 'json';
    if (/^image\//.test(file.type) || /\.(png|jpe?g|webp|heic|bmp)$/.test(n)) return 'image';
    return 'text';
  };

  /** Texto do PDF reconstruído em linhas (agrupando itens pela coordenada Y). */
  P.pdfText = async (file) => {
    if (!window.pdfjsLib) throw new Error('Leitor de PDF não carregou.');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const rows = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const y = it.transform[5], x = it.transform[4];
        let row = rows.find((r) => Math.abs(r.y - y) < 3);
        if (!row) { row = { y, parts: [] }; rows.push(row); }
        row.parts.push({ x, s: it.str });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) lines.push(r.parts.sort((a, b) => a.x - b.x).map((q) => q.s).join(' ').replace(/\s+/g, ' ').trim());
    }
    return lines.join('\n');
  };

  P.sheetRows = async (file) => {
    if (!window.XLSX) throw new Error('Leitor de planilhas não carregou.');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const out = [];
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' });
      out.push({ name, rows });
    }
    return out;
  };

  P.csvRows = async (file) => {
    const text = await file.text();
    return P.csvFromText(text);
  };
  P.csvFromText = (text) => {
    const first = text.split(/\r?\n/).slice(0, 5).join('\n');
    const delim = [';', ',', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
      if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
  };

  P.ocr = async (file, onProgress) => {
    if (!window.Tesseract) {
      App.toast('Carregando leitor de imagens (OCR)… primeira vez pode demorar.');
      await App.loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js');
    }
    const { data } = await Tesseract.recognize(file, 'por+eng', { logger: (m) => onProgress && m.progress && onProgress(m) });
    return data.text;
  };

  /** Devolve { text, tables } de qualquer arquivo. */
  P.read = async (file, onProgress) => {
    const k = P.kind(file);
    if (k === 'pdf') return { kind: k, text: await P.pdfText(file), tables: [] };
    if (k === 'sheet') { const sh = await P.sheetRows(file); return { kind: k, text: sh.map((s) => s.rows.map((r) => r.join(' ')).join('\n')).join('\n'), tables: sh.map((s) => s.rows) }; }
    if (k === 'csv') { const t = await file.text(); return { kind: k, text: t, tables: [P.csvFromText(t)] }; }
    if (k === 'image') return { kind: k, text: await P.ocr(file, onProgress), tables: [] };
    return { kind: k, text: await file.text(), tables: [] };
  };

  /* ---------- datas em texto ---------- */
  const MES = { jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, março: 3, abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6, jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12,
    feb: 2, apr: 4, may: 5, aug: 8, sep: 9, oct: 10, dec: 12 };
  const fixYear = (y) => { y = Number(y); return y < 100 ? 2000 + y : y; };
  const mk = (y, m, d) => { if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null; return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };

  /** Converte um valor (string/Date/serial Excel) em ISO YYYY-MM-DD. */
  P.toISO = (v, fallbackYear) => {
    if (!v && v !== 0) return null;
    if (v instanceof Date && !isNaN(v)) return U.iso(v);
    const s = String(v).trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return mk(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) return mk(fixYear(m[3]), +m[2], +m[1]);
    if ((m = s.match(/^(\d{1,2})[\/.](\d{1,2})$/)) && fallbackYear) return mk(fallbackYear, +m[2], +m[1]);
    if ((m = U.norm(s).match(/^(\d{1,2})\s*(?:de\s*)?([a-z]{3,9})\.?(?:\s*(?:de\s*)?(\d{2,4}))?/)) && MES[m[2]]) return mk(m[3] ? fixYear(m[3]) : fallbackYear || new Date().getFullYear(), MES[m[2]], +m[1]);
    if (/^\d{5}(\.\d+)?$/.test(s)) { const d = new Date(Math.round((+s - 25569) * 86400000)); return U.iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return mk(+m[1], +m[2], +m[3]); // OFX
    return null;
  };

  /** Todas as datas encontradas em um texto. */
  P.findDates = (text, defYear) => {
    const out = [];
    const t = U.norm(text);
    const re = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})|(\d{1,2})(?:º|o)?\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?/g;
    let m;
    while ((m = re.exec(t))) {
      const iso = m[1] ? mk(fixYear(m[3]), +m[2], +m[1]) : mk(m[6] ? +m[6] : defYear || new Date().getFullYear(), MES[m[5]], +m[4]);
      if (iso) out.push({ iso, index: m.index });
    }
    return out;
  };

  const moneyRe = /R\$\s*([\d.]+,\d{2})/;

  /* ==========================================================
     TRANSAÇÕES (faturas / extratos)
     ========================================================== */
  const HDR = {
    date: ['data', 'date', 'dt', 'data lancamento', 'data da compra', 'data de lancamento', 'data movimento'],
    desc: ['descricao', 'description', 'title', 'titulo', 'historico', 'estabelecimento', 'lancamento', 'memo', 'detalhes', 'nome'],
    amount: ['valor', 'amount', 'value', 'valor (r$)', 'valor r$', 'quantia', 'montante'],
    cat: ['categoria', 'category'],
  };
  const findCol = (header, keys) => header.findIndex((h) => keys.includes(U.norm(h).replace(/\s+/g, ' ')));

  /** Detecta parcelamento no texto da compra: "Parcela 2/6", "02/06", "2 de 6". */
  P.installmentInfo = (desc) => {
    const s = U.norm(desc);
    const m = s.match(/parc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/) || s.match(/(?:^|\s|-)(\d{1,2})\s*\/\s*(\d{1,2})\s*$/);
    if (!m) return null;
    const cur = +m[1], total = +m[2];
    if (cur < 1 || total < 2 || cur > total || total > 72) return null;
    return { cur, total };
  };

  P.transactionsFromTable = (rows, ctx = {}) => {
    let hi = rows.findIndex((r) => findCol(r, HDR.date) >= 0 && findCol(r, HDR.amount) >= 0);
    if (hi < 0) return null;
    const h = rows[hi];
    const ci = { date: findCol(h, HDR.date), desc: findCol(h, HDR.desc), amount: findCol(h, HDR.amount), cat: findCol(h, HDR.cat) };
    const out = [];
    for (const r of rows.slice(hi + 1)) {
      const date = P.toISO(r[ci.date], ctx.year);
      const amount = U.num(r[ci.amount], NaN);
      if (!date || isNaN(amount)) continue;
      const desc = ci.desc >= 0 ? String(r[ci.desc]).trim() : r.filter((_, i) => i !== ci.date && i !== ci.amount).join(' ').trim();
      out.push({ date, desc, raw: amount, catHint: ci.cat >= 0 ? r[ci.cat] : '' });
    }
    // "title" = padrão de fatura Nubank (positivo = gasto)
    const cardStyle = h.some((x) => U.norm(x) === 'title') || (out.filter((t) => t.raw > 0).length > out.length * 0.7);
    return { items: out, positiveIsExpense: cardStyle };
  };

  P.transactionsFromOFX = (text) => {
    const items = [];
    const blocks = text.split(/<STMTTRN>/i).slice(1);
    for (const b of blocks) {
      const g = (tag) => { const m = b.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i')); return m ? m[1].trim() : ''; };
      const date = P.toISO(g('DTPOSTED'));
      const raw = parseFloat(g('TRNAMT').replace(',', '.'));
      if (!date || isNaN(raw)) continue;
      items.push({ date, desc: g('MEMO') || g('NAME'), raw });
    }
    return { items, positiveIsExpense: false };
  };

  /** Fatura/extrato em PDF: procura linhas "data descrição valor". */
  P.transactionsFromText = (text, ctx = {}) => {
    const year = ctx.year || new Date().getFullYear();
    const items = [];
    const ignore = /(total|saldo|pagamento recebido|pagamento efetuado|limite|fatura anterior|encargos|juros|iof total|vencimento|resumo|credito rotativo)/;
    for (const line of text.split('\n')) {
      const l = line.trim();
      const m = l.match(/^(\d{1,2}[\/.]\d{1,2}(?:[\/.]\d{2,4})?|\d{1,2}\s+(?:de\s+)?[A-Za-zçÇ]{3,9}\.?)\s+(.+?)\s+(-?\s?R?\$?\s?-?\s?[\d.]{1,9},\d{2})\s*(-|D|C)?$/);
      if (!m) continue;
      const desc = m[2].replace(/\s+/g, ' ').trim();
      if (ignore.test(U.norm(desc))) continue;
      const date = P.toISO(m[1].replace(/\s+de\s+/, ' '), year);
      if (!date) continue;
      let raw = U.num(m[3].replace(/\s/g, ''));
      if (/-/.test(m[3]) || m[4] === 'C') raw = -Math.abs(raw);
      items.push({ date, desc, raw });
    }
    return { items, positiveIsExpense: true };
  };

  P.transactions = async (file, ctx = {}) => {
    const k = P.kind(file);
    if (k === 'ofx') return P.transactionsFromOFX(await file.text());
    if (k === 'csv') return P.transactionsFromTable(await P.csvRows(file), ctx) || { items: [], positiveIsExpense: true };
    if (k === 'sheet') {
      for (const s of await P.sheetRows(file)) { const r = P.transactionsFromTable(s.rows, ctx); if (r && r.items.length) return r; }
      return { items: [], positiveIsExpense: true };
    }
    const { text } = await P.read(file);
    return P.transactionsFromText(text, ctx);
  };

  /** Categoriza pela memória (o que você já corrigiu) e depois pelas palavras-chave. */
  P.merchantKey = (desc) => U.norm(desc).replace(/parc(ela)?\.?\s*\d+\s*(\/|de)\s*\d+/g, '').replace(/\d{1,2}\/\d{1,2}$/, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
  P.categorize = (desc, hint) => {
    const st = App.state;
    const key = P.merchantKey(desc);
    if (key && st.merchantMap[key] && st.categories.find((c) => c.id === st.merchantMap[key])) return st.merchantMap[key];
    const d = ' ' + U.norm(desc) + ' ';
    if (hint) { const h = U.norm(hint); const c = st.categories.find((c) => U.norm(c.name) === h || h.includes(U.norm(c.name))); if (c) return c.id; }
    let best = null, bestLen = 0;
    for (const c of st.categories) for (const kw of c.keywords || []) {
      const k = U.norm(kw); if (!k) continue;
      if (d.includes(k) && k.length > bestLen) { best = c.id; bestLen = k.length; }
    }
    return best || (st.categories.find((c) => c.id === 'outros') || st.categories[st.categories.length - 1]).id;
  };

  /* ==========================================================
     BIOIMPEDÂNCIA (balança / relógio Samsung / relatórios)
     ========================================================== */
  P.BIO_FIELDS = [
    ['weight', 'Peso', 'kg'], ['fat', 'Gordura corporal', '%'], ['fatMass', 'Massa de gordura', 'kg'], ['muscle', 'Massa muscular esquelética', 'kg'],
    ['lean', 'Massa magra (livre de gordura)', 'kg'], ['water', 'Água corporal', '%'], ['visceral', 'Gordura visceral', 'nível'], ['bmr', 'Taxa metabólica basal', 'kcal'],
    ['metaAge', 'Idade metabólica', 'anos'], ['bone', 'Massa óssea', 'kg'], ['protein', 'Proteína', '%'], ['subcut', 'Gordura subcutânea', '%'], ['waist', 'Cintura', 'cm'],
  ];
  // ordem importa: rótulos mais específicos primeiro
  const BIO_RULES = [
    ['visceral', /(gordura visceral|visceral fat|nivel de gordura visceral|indice de gordura visceral|vfl|vfa)/],
    ['subcut', /(gordura subcutanea|subcutaneous fat)/],
    ['fatMass', /(massa de gordura|massa gorda|body fat mass|fat mass|mgc|massa de gordura corporal)/],
    ['fat', /(percentual de gordura|% ?de ?gordura|gordura corporal|taxa de gordura|body fat(?! mass)|pgc|indice de gordura|fat ?%|gordura)/],
    ['muscle', /(massa muscular esqueletica|musculo esqueletico|skeletal muscle(?: mass)?|mme|smm|massa muscular|muscle mass|musculo)/],
    ['lean', /(massa livre de gordura|massa magra|fat[- ]free mass|lean (?:body )?mass|ffm)/],
    ['water', /(agua corporal total|agua corporal|total body water|body water|tbw|hidratacao|agua)/],
    ['bmr', /(taxa metabolica basal|metabolismo basal|basal metabolic rate|bmr|tmb)/],
    ['metaAge', /(idade metabolica|metabolic age|idade corporal|body age)/],
    ['bone', /(massa ossea|bone mass|ossos)/],
    ['protein', /(proteina|protein)/],
    ['waist', /(circunferencia da cintura|cintura|waist)/],
    ['bmi', /(imc|bmi|indice de massa corporal)/],
    ['weight', /(peso corporal|peso atual|peso|weight|massa corporal)/],
  ];
  const RANGES = { weight: [25, 300], fat: [2, 70], fatMass: [1, 200], muscle: [8, 120], lean: [20, 200], water: [20, 85], visceral: [1, 59], bmr: [700, 4500], metaAge: [10, 99], bone: [0.5, 10], protein: [5, 40], subcut: [2, 70], waist: [40, 200], bmi: [10, 70] };

  P.bioFromText = (text) => {
    let t = U.norm(text).replace(/(\d),(\d)/g, '$1.$2');
    const out = {}, found = {};
    for (const [field, re] of BIO_RULES) {
      if (out[field] !== undefined) continue;
      const g = new RegExp(re.source + '[^0-9\\n]{0,28}?(\\d{1,4}(?:\\.\\d{1,2})?)\\s*(kg|%|l|kcal|cm|anos)?', 'g');
      let m;
      while ((m = g.exec(t))) {
        let v = parseFloat(m[m.length - 2]); const unit = m[m.length - 1];
        if (field === 'water' && unit === 'l' && out.weight) v = (v / out.weight) * 100; // litros -> %
        if (field === 'water' && (unit === 'kg' || unit === 'l') && !out.weight) { found._waterL = v; continue; }
        const [a, b] = RANGES[field];
        if (v >= a && v <= b) { out[field] = v; found[field] = m[0].slice(0, 60); t = t.slice(0, m.index) + ' '.repeat(m[0].length) + t.slice(m.index + m[0].length); break; }
      }
    }
    if (found._waterL && out.weight && !out.water) out.water = (found._waterL / out.weight) * 100;
    const dates = P.findDates(text);
    if (dates.length) out.date = dates[0].iso;
    return { values: out, evidence: found };
  };

  const BIO_HDR = {
    weight: ['weight', 'peso', 'peso (kg)', 'body weight'], fat: ['body_fat', 'body fat', 'gordura', 'gordura corporal', 'gordura (%)', 'body fat (%)', 'percentual de gordura'],
    fatMass: ['body_fat_mass', 'fat_mass', 'massa de gordura'], muscle: ['skeletal_muscle_mass', 'skeletal_muscle', 'massa muscular esqueletica', 'massa muscular', 'muscle_mass', 'skeletal muscle'],
    lean: ['fat_free_mass', 'fat_free', 'massa magra', 'lean mass'], water: ['total_body_water', 'body_water', 'agua', 'agua corporal', 'water'], bmr: ['basal_metabolic_rate', 'bmr', 'tmb'],
    visceral: ['visceral_fat', 'gordura visceral', 'visceral fat'], bone: ['bone_mass', 'massa ossea'], metaAge: ['metabolic_age', 'idade metabolica'], protein: ['protein', 'proteina'],
    date: ['start_time', 'create_time', 'time', 'date', 'data', 'datetime', 'day_time', 'update_time'],
  };
  /** CSV/Excel (ex.: exportação do Samsung Health: com.samsung.health.weight.csv). */
  P.bioFromTable = (rows) => {
    let hi = -1, map = {};
    for (let i = 0; i < Math.min(rows.length, 6); i++) {
      const h = rows[i].map((x) => U.norm(String(x).replace(/^com\.samsung\.health\.[a-z_]+\./, '')));
      const m = {};
      for (const [f, keys] of Object.entries(BIO_HDR)) { const idx = h.findIndex((x) => keys.includes(x)); if (idx >= 0) m[f] = idx; }
      if (Object.keys(m).filter((k) => k !== 'date').length >= 1 && (m.weight !== undefined || m.fat !== undefined || m.muscle !== undefined)) { hi = i; map = m; break; }
    }
    if (hi < 0) return [];
    const out = [];
    for (const r of rows.slice(hi + 1)) {
      const e = {};
      for (const [f, idx] of Object.entries(map)) {
        if (f === 'date') { e.date = P.toISO(String(r[idx]).slice(0, 10)); continue; }
        const v = U.num(r[idx], NaN); if (!isNaN(v) && v > 0) e[f] = v;
      }
      if (e.water && e.weight && e.water > 85) e.water = (e.water / e.weight) * 100;
      if (Object.keys(e).length > 1) out.push(e);
    }
    return out.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  };

  P.bio = async (file, onProgress) => {
    const r = await P.read(file, onProgress);
    for (const tb of r.tables) {
      const rows = P.bioFromTable(tb);
      if (rows.length) return { values: rows[rows.length - 1], history: rows, evidence: {}, text: '' };
    }
    const b = P.bioFromText(r.text);
    return { ...b, history: [], text: r.text };
  };

  /* ==========================================================
     EDITAL DE CONCURSO
     ========================================================== */
  const BANCAS = ['CEBRASPE', 'CESPE', 'FGV', 'VUNESP', 'FCC', 'IBFC', 'IDECAN', 'INSTITUTO AOCP', 'AOCP', 'CESGRANRIO', 'QUADRIX', 'FUNDATEC', 'CONSULPLAN', 'IADES', 'SELECON', 'FUMARC', 'IBADE', 'FEPESE', 'UFPR', 'NC-UFPR', 'COPS', 'FAURGS', 'IBAM', 'OBJETIVA', 'LEGALLE', 'AVANÇA SP', 'INSTITUTO ACESSO', 'FUNCAB', 'CETRO', 'IGEDUC', 'IDIB', 'FAFIPA', 'ACCESS', 'IV-UFG', 'CETREDE', 'FADESP', 'CONSESP', 'INSTITUTO CONSULPLAN', 'FUNRIO', 'MS CONCURSOS', 'IUDS', 'FUNDEP', 'EXATUS', 'RBO'];
  const ED_RULES = [
    ['inscricaoInicio', 'Início das inscrições', /(periodo de inscric|inscricoes|inscricao)/, 'first'],
    ['inscricaoFim', 'Fim das inscrições', /(periodo de inscric|inscricoes|inscricao)/, 'last'],
    ['isencao', 'Pedido de isenção', /(isencao)/, 'first'],
    ['pagamento', 'Pagamento da taxa (limite)', /(pagamento d[ao] (?:taxa|boleto)|vencimento do boleto|recolhimento)/, 'last'],
    ['provaDate', 'Prova objetiva', /(prova objetiva|provas objetivas|aplicacao da(s)? prova|data da(s)? prova|prova escrita|prova discursiva|realizacao da(s)? prova)/, 'first'],
    ['tafDate', 'TAF / teste físico', /(taf\b|teste de aptidao fisica|teste fisico|exame de aptidao fisica|avaliacao fisica|capacidade fisica|prova de aptidao fisica|tcf\b)/, 'first'],
    ['examesDate', 'Exames médicos', /(exames? medicos?|avaliacao medica|inspecao de saude|exames? de saude|avaliacao de saude|exame toxicologico)/, 'first'],
    ['psicoDate', 'Avaliação psicológica', /(avaliacao psicologica|exame psicotecnico|psicotecnico)/, 'first'],
    ['investDate', 'Investigação social', /(investigacao social|sindicancia de vida)/, 'first'],
    ['resultadoDate', 'Resultado final', /(resultado final|homologacao)/, 'first'],
  ];

  P.edital = (text) => {
    const lines = text.split('\n');
    const nlines = lines.map(U.norm);
    const year = (() => { const ys = (text.match(/20\d{2}/g) || []).map(Number).filter((y) => y >= 2020 && y <= 2035); if (!ys.length) return new Date().getFullYear(); const c = U.groupBy(ys, (y) => y); return +Object.keys(c).sort((a, b) => c[b].length - c[a].length)[0]; })();
    const res = { fields: {}, evidence: {}, allDates: [] };

    for (const [key, , re, which] of ED_RULES) {
      for (let i = 0; i < nlines.length; i++) {
        if (!re.test(nlines[i])) continue;
        // datas na linha e na seguinte (tabelas de cronograma quebram em 2 linhas)
        let ds = P.findDates(lines[i], year);
        if (!ds.length) ds = P.findDates(lines[i + 1] || '', year);
        if (!ds.length) continue;
        res.fields[key] = which === 'last' ? ds[ds.length - 1].iso : ds[0].iso;
        res.evidence[key] = lines[i].slice(0, 140);
        break;
      }
    }
    if (res.fields.inscricaoInicio === res.fields.inscricaoFim) delete res.fields.inscricaoInicio;

    const nt = U.norm(text);
    // taxa
    let m = text.match(/(?:taxa de inscri[çc][ãa]o|valor da inscri[çc][ãa]o|valor da taxa)[^\n]{0,80}?R\$\s*([\d.]+,\d{2})/i) || text.match(/R\$\s*([\d.]+,\d{2})[^\n]{0,40}taxa de inscri/i);
    if (m) res.fields.taxa = U.num(m[1]);
    // remuneração
    m = text.match(/(?:remunera[çc][ãa]o|vencimento b[áa]sico|subs[íi]dio|sal[áa]rio)[^\n]{0,120}?R\$\s*([\d.]+,\d{2})/i);
    if (m) res.fields.salario = U.num(m[1]);
    // vagas
    m = nt.match(/(\d{1,3}(?:\.\d{3})+|\d{1,5})\s*(?:\([a-z\s]*\))?\s*vagas/) || nt.match(/total de vagas[^0-9]{0,20}(\d{1,3}(?:\.\d{3})+|\d{1,5})/);
    if (m && +m[1].replace(/\./g, '')) res.fields.vagas = +m[1].replace(/\./g, '');
    // banca
    const up = text.toUpperCase();
    const b = BANCAS.find((x) => new RegExp(`\\b${x.replace(/[-]/g, '\\-')}\\b`).test(up));
    if (b) res.fields.banca = b === 'CESPE' ? 'CEBRASPE' : b;
    // título / órgão
    const tl = lines.slice(0, 40).find((l) => /edital/i.test(l) && l.length > 12) || lines.find((l) => /concurso p[úu]blico/i.test(l));
    if (tl) res.fields.name = tl.replace(/\s+/g, ' ').slice(0, 120);
    const cargo = lines.find((l) => /^\s*cargo\s*[:\-]/i.test(l));
    if (cargo) res.fields.cargo = cargo.replace(/^\s*cargo\s*[:\-]\s*/i, '').slice(0, 80);
    m = nt.match(/(ensino (?:medio|superior|fundamental))/);
    if (m) res.fields.escolaridade = m[1].replace('medio', 'médio');

    // todas as datas com contexto, para você escolher
    const seen = new Set();
    lines.forEach((l) => {
      for (const d of P.findDates(l, year)) {
        const k = d.iso + l.slice(0, 40);
        if (seen.has(k)) continue; seen.add(k);
        res.allDates.push({ iso: d.iso, context: l.slice(0, 160) });
      }
    });
    res.allDates.sort((a, b) => a.iso.localeCompare(b.iso));
    res.allDates = res.allDates.slice(0, 80);
    return res;
  };
  P.ED_RULES = ED_RULES;

  /* ==========================================================
     PLANILHA DE TREINO
     ========================================================== */
  const WK = {
    day: ['dia', 'dia da semana', 'day', 'treino'], name: ['exercicio', 'exercicios', 'exercise', 'atividade', 'nome'], sets: ['series', 'sets', 'serie'],
    reps: ['repeticoes', 'reps', 'rep', 'repeticao'], load: ['carga', 'peso', 'kg', 'carga (kg)', 'load'], rest: ['descanso', 'intervalo', 'rest', 'pausa'],
    notes: ['obs', 'observacao', 'observacoes', 'notas', 'metodo', 'tecnica'], type: ['tipo', 'type', 'modalidade'], distance: ['distancia', 'km', 'distancia (km)'],
    duration: ['duracao', 'tempo', 'minutos', 'duracao (min)'], pace: ['pace', 'ritmo', 'pace alvo'], intensity: ['intensidade', 'zona', 'intensity'], focus: ['foco', 'grupo', 'grupo muscular'],
  };
  P.dayIndex = (s) => {
    const n = U.norm(s);
    const map = [['dom', 0], ['seg', 1], ['ter', 2], ['qua', 3], ['qui', 4], ['sex', 5], ['sab', 6], ['sun', 0], ['mon', 1], ['tue', 2], ['wed', 3], ['thu', 4], ['fri', 5], ['sat', 6]];
    for (const [k, v] of map) if (n.startsWith(k) || n.includes(' ' + k)) return v;
    const d = parseInt(n, 10); if (d >= 1 && d <= 7) return d % 7;
    return null;
  };
  P.workoutPlan = (rows) => {
    const hi = rows.findIndex((r) => r.some((c) => WK.name.includes(U.norm(c))));
    if (hi < 0) return [];
    const h = rows[hi].map((c) => U.norm(c));
    const col = (k) => h.findIndex((x) => WK[k].includes(x));
    const ci = Object.fromEntries(Object.keys(WK).map((k) => [k, col(k)]));
    const out = []; let lastDay = null;
    for (const r of rows.slice(hi + 1)) {
      const g = (k) => (ci[k] >= 0 ? String(r[ci[k]] ?? '').trim() : '');
      const d = g('day'); const di = d ? P.dayIndex(d) : null;
      if (di !== null) lastDay = di;
      if (!g('name') || lastDay === null) continue;
      const typeTxt = U.norm(g('type') + ' ' + g('name'));
      const isRun = /corrida|run|trote|caminhada|tiro|intervalado|longao|esteira/.test(typeTxt) || !!g('distance') || !!g('pace');
      out.push({ day: lastDay, focus: g('focus'), item: {
        id: U.uid(), type: isRun ? 'run' : 'strength', name: g('name'), sets: U.num(g('sets'), ''), reps: g('reps'), load: U.num(g('load'), ''), rest: g('rest'), notes: g('notes'),
        distance: U.num(g('distance'), ''), duration: U.num(g('duration'), ''), pace: g('pace'), intensity: g('intensity'),
      } });
    }
    return out;
  };
})(window.App);
