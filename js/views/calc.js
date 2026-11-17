/* ==========================================================
   CALCULADORAS — salário líquido, férias, 13º, rescisão,
   à vista × parcelado. Tabelas editáveis (mudam todo ano).
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const K = (App.Calc = {});

  /* ---------- tabelas (padrão: INSS 2025; IRRF desde mai/2025 + redução de 2026) ---------- */
  K.DEFAULTS = {
    inss: [[1518.0, 7.5], [2793.88, 9], [4190.83, 12], [8157.41, 14]], // faixa até R$ / alíquota %
    irrf: [[2428.8, 0, 0], [2826.65, 7.5, 182.16], [3751.05, 15, 394.16], [4664.68, 22.5, 675.49], [Infinity, 27.5, 908.73]], // até / % / dedução
    dep: 189.59, simplificado: 607.2,
    // Lei 15.270/2025 (a partir de 2026): isento até R$ 5.000; redução gradual até R$ 7.350
    reducao: { ate: 5000, faixa: 7350, a: 978.62, b: 0.133145 },
  };
  K.t = () => { const s = st().settings; s.taxTables = s.taxTables || JSON.parse(JSON.stringify(K.DEFAULTS, (k, v) => (v === Infinity ? 1e12 : v))); return s.taxTables; };

  K.inss = (bruto) => {
    let prev = 0, total = 0;
    for (const [lim, pct] of K.t().inss) { if (bruto <= prev) break; total += (Math.min(bruto, lim) - prev) * pct / 100; prev = lim; }
    return U.round(total);
  };
  /** IRRF mensal: base = bruto − INSS − dependentes (ou desconto simplificado, o que for melhor) + redução da lei de 2026 */
  K.irrf = (bruto, inss, deps = 0, outras = 0) => {
    const T = K.t();
    const calc = (base) => { if (base <= 0) return 0; const f = T.irrf.find(([lim]) => base <= lim) || T.irrf[T.irrf.length - 1]; return Math.max(0, base * f[1] / 100 - f[2]); };
    const legal = calc(bruto - inss - deps * T.dep - outras), simpl = calc(bruto - T.simplificado);
    let ir = Math.min(legal, simpl);
    const r = T.reducao;
    if (r && bruto <= r.ate) ir = 0; else if (r && bruto <= r.faixa) ir = Math.max(0, ir - (r.a - r.b * bruto));
    return U.round(ir);
  };
  K.liquido = (bruto, deps = 0, outros = 0) => { const inss = K.inss(bruto), ir = K.irrf(bruto, inss, deps); return { bruto, inss, ir, outros, liq: U.round(bruto - inss - ir - outros) }; };

  K.ferias = (sal, dias = 30, vender = false, deps = 0) => {
    const d = vender ? Math.min(dias, 20) : dias;
    const rem = (sal / 30) * d, terco = rem / 3;
    const abono = vender ? (sal / 30) * 10 * (4 / 3) : 0; // abono pecuniário + 1/3: sem INSS/IR
    const inss = K.inss(rem + terco), ir = K.irrf(rem + terco, inss, deps);
    return { rem, terco, abono, inss, ir, liq: U.round(rem + terco + abono - inss - ir) };
  };
  K.decimo = (sal, meses = 12, deps = 0) => {
    const total = (sal / 12) * meses, p1 = total / 2;
    const inss = K.inss(total), ir = K.irrf(total, inss, deps);
    return { total, p1, p2: U.round(total - p1 - inss - ir), inss, ir, liq: U.round(total - inss - ir) };
  };
  K.rescisao = ({ sal, adm, saida, motivo, aviso, vencidas, fgts, deps }) => {
    const a = U.parseISO(adm), s = U.parseISO(saida);
    const anos = Math.floor(U.diffDays(adm, saida) / 365.25);
    const out = [], add = (l, v, obs = '') => { if (v) out.push({ l, v: U.round(v), obs }); };
    add('Saldo de salário', (sal / 30) * s.getDate(), `${s.getDate()} dia(s)`);
    let avisoDias = 0;
    if ((motivo === 'sem' || motivo === 'acordo') && aviso === 'indenizado') { avisoDias = Math.min(90, 30 + 3 * anos); if (motivo === 'acordo') avisoDias = Math.round(avisoDias / 2); add('Aviso prévio indenizado', (sal / 30) * avisoDias, `${avisoDias} dias`); }
    const fim = U.addDays(saida, avisoDias), fimD = U.parseISO(fim);
    if (motivo !== 'justa') {
      // 13º proporcional: meses do ano com 15+ dias trabalhados (inclui a projeção do aviso)
      let m13 = fimD.getMonth() + (fimD.getDate() >= 15 ? 1 : 0);
      if (a.getFullYear() === fimD.getFullYear()) m13 = m13 - a.getMonth() - (a.getDate() > 15 ? 1 : 0);
      add('13º proporcional', (sal / 12) * Math.max(0, m13), `${Math.max(0, m13)}/12`);
      // férias proporcionais: meses desde o último aniversário de admissão
      const ult = new Date(a); ult.setFullYear(fimD.getFullYear()); if (ult > fimD) ult.setFullYear(ult.getFullYear() - 1);
      let mf = (fimD.getFullYear() - ult.getFullYear()) * 12 + fimD.getMonth() - ult.getMonth(); if (fimD.getDate() - ult.getDate() >= 14) mf++;
      mf = U.clamp(mf, 0, 12);
      add('Férias proporcionais + 1/3', (sal / 12) * mf * (4 / 3), `${mf}/12`);
    }
    if (vencidas) add('Férias vencidas + 1/3', sal * (4 / 3));
    const bruto = U.sum(out, (x) => x.v);
    const baseInss = U.sum(out.filter((x) => /Saldo|13º/.test(x.l)), (x) => x.v);
    const inss = K.inss(baseInss), ir = K.irrf(baseInss, inss, deps);
    const meses = Math.max(1, Math.round(U.diffDays(adm, saida) / 30.4));
    const saldoFgts = +fgts || sal * 0.08 * meses;
    const multa = motivo === 'sem' ? saldoFgts * 0.4 : motivo === 'acordo' ? saldoFgts * 0.2 : 0;
    const saque = motivo === 'sem' ? saldoFgts : motivo === 'acordo' ? saldoFgts * 0.8 : 0;
    return { itens: out, bruto, inss, ir, liq: U.round(bruto - inss - ir), saldoFgts, multa: U.round(multa), saque: U.round(saque), estimado: !+fgts, seguro: motivo === 'sem', anos };
  };
  /** à vista × parcelado: traz as parcelas a valor presente com o rendimento líquido do seu dinheiro */
  K.vista = ({ preco, desc, n, parcela, cdiPct }) => {
    const vista = preco * (1 - (desc || 0) / 100);
    const p = parcela || preco / n;
    const anual = (st().settings.cdi * (cdiPct || 100)) / 100 * 0.85; // líquido aprox. (IR 15%)
    const r = Math.pow(1 + anual / 100, 1 / 12) - 1;
    let pv = 0; for (let k = 1; k <= n; k++) pv += p / Math.pow(1 + r, k);
    const total = p * n, juros = total - preco;
    return { vista, total, pv, juros, r, rendimento: total - pv, melhor: vista <= pv ? 'vista' : 'parcelado', economia: Math.abs(pv - vista) };
  };

  /* ---------- tela ---------- */
  const S = { tab: 'salario' };
  const line = (l, v, cls = '') => `<div class="li"><div class="grow">${l}</div><b class="${cls}">${U.money(v)}</b></div>`;
  K.view = () => {
    const sal = App.Money ? App.Money.fixedIncome() : 0;
    const tabs = [['salario', '💼 Salário líquido'], ['ferias', '🏖️ Férias'], ['decimo', '🎄 13º salário'], ['rescisao', '📤 Rescisão'], ['vista', '🛍️ À vista × parcelado']];
    return `<div class="seg" style="margin-bottom:14px;flex-wrap:wrap">${tabs.map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="ckTab" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="grid g2"><div class="card"><form data-input="ckRun" data-change="ckRun" id="ck-form">${form(sal)}</form></div><div class="card" id="ck-out"></div></div>
      ${S.tab !== 'vista' ? `<details class="card mt"><summary><b>⚙️ Tabelas de INSS e IR usadas</b> <small class="muted">— confira se mudaram (gov.br) e edite</small></summary>${tablesHTML()}</details>` : ''}
      <p class="muted"><small>Valores estimados para orientação. Convenções coletivas, horas extras, adicionais e médias podem mudar o resultado — confira com o RH/contador.</small></p>`;
  };
  const form = (sal) => {
    const b = sal || '';
    if (S.tab === 'salario') return F.row(F.number('Salário bruto (R$)', 'bruto', b), F.number('Dependentes', 'deps', 0)) + F.row(F.number('Outros descontos (VT, plano…)', 'outros', 0));
    if (S.tab === 'ferias') return F.row(F.number('Salário bruto (R$)', 'bruto', b), F.number('Dias de férias', 'dias', 30, 'max="30"')) + F.row(F.number('Dependentes', 'deps', 0)) + F.check('Vender 10 dias (abono pecuniário)', 'vender', false);
    if (S.tab === 'decimo') return F.row(F.number('Salário bruto (R$)', 'bruto', b), F.number('Meses trabalhados no ano', 'meses', 12, 'max="12"'), F.number('Dependentes', 'deps', 0));
    if (S.tab === 'rescisao') return F.row(F.number('Último salário bruto (R$)', 'bruto', b), F.date('Admissão', 'adm', ''), F.date('Saída', 'saida', U.today())) +
      F.row(F.select('Motivo', 'motivo', [['sem', 'Demissão sem justa causa'], ['pedido', 'Pedido de demissão'], ['acordo', 'Acordo (demissão consensual)'], ['justa', 'Justa causa']], 'sem'), F.select('Aviso prévio', 'aviso', [['indenizado', 'Indenizado'], ['trabalhado', 'Trabalhado']], 'indenizado')) +
      F.row(F.number('Saldo do FGTS (opcional)', 'fgts', ''), F.number('Dependentes', 'deps', 0)) + F.check('Tenho férias vencidas', 'vencidas', false);
    return F.row(F.number('Preço cheio (R$)', 'preco', ''), F.number('Desconto à vista (%)', 'desc', 5)) + F.row(F.number('Nº de parcelas', 'n', 10), F.number('Valor da parcela (vazio = sem juros)', 'parcela', '')) +
      F.row(F.number('Seu dinheiro rende (% do CDI)', 'cdiPct', 100)) + `<p class="muted"><small>CDI configurado: ${U.fmt(st().settings.cdi, 2)}% a.a.</small></p>`;
  };
  const tablesHTML = () => {
    const T = K.t();
    return `<div class="grid g2 mt"><div><h4>INSS (progressivo)</h4><table><thead><tr><th>Até (R$)</th><th>Alíquota %</th></tr></thead><tbody>${T.inss.map(([a, b], i) => `<tr><td><input class="cell" data-change="ckTable" data-t="inss" data-i="${i}" data-j="0" value="${a}"></td><td><input class="cell" data-change="ckTable" data-t="inss" data-i="${i}" data-j="1" value="${b}"></td></tr>`).join('')}</tbody></table></div>
      <div><h4>IRRF mensal</h4><table><thead><tr><th>Até (R$)</th><th>%</th><th>Dedução</th></tr></thead><tbody>${T.irrf.map((r, i) => `<tr>${r.map((v, j) => `<td><input class="cell" data-change="ckTable" data-t="irrf" data-i="${i}" data-j="${j}" value="${v >= 1e12 ? 'acima' : v}" ${v >= 1e12 ? 'disabled' : ''}></td>`).join('')}</tr>`).join('')}</tbody></table>
      <p class="muted"><small>Dependente: R$ ${U.fmt(T.dep, 2)} · desconto simplificado: R$ ${U.fmt(T.simplificado, 2)} · 2026: isento até R$ ${U.fmt(T.reducao.ate, 0)}, redução até R$ ${U.fmt(T.reducao.faixa, 0)}.</small></p>
      <button class="btn sm ghost" data-act="ckReset">Restaurar padrão</button></div></div>`;
  };
  K.run = () => {
    const f = document.getElementById('ck-form'), out = document.getElementById('ck-out'); if (!f || !out) return;
    const d = App.formData(f);
    if (S.tab === 'salario') {
      if (!d.bruto) return (out.innerHTML = '<p class="muted">Informe o salário bruto.</p>');
      const r = K.liquido(d.bruto, d.deps, d.outros || 0);
      out.innerHTML = `<header><h3>💼 Salário líquido</h3></header><div class="stat"><div class="val delta good">${U.money(r.liq)}</div><div class="sub">por mês</div></div><div class="list mt">${line('Salário bruto', r.bruto)}${line('− INSS', -r.inss, 'delta badd')}${line('− Imposto de renda', -r.ir, 'delta badd')}${r.outros ? line('− Outros', -r.outros, 'delta badd') : ''}</div>
        <p class="muted"><small>INSS efetivo ${U.pct((r.inss / r.bruto) * 100)} · IR efetivo ${U.pct((r.ir / r.bruto) * 100)}${r.bruto <= K.t().reducao.ate ? ' · isento de IR pela regra de 2026' : ''}</small></p>`;
    } else if (S.tab === 'ferias') {
      if (!d.bruto) return (out.innerHTML = '<p class="muted">Informe o salário.</p>');
      const r = K.ferias(d.bruto, d.dias || 30, d.vender, d.deps);
      out.innerHTML = `<header><h3>🏖️ Férias</h3></header><div class="stat"><div class="val delta good">${U.money(r.liq)}</div><div class="sub">líquido a receber (até 2 dias antes das férias)</div></div><div class="list mt">${line(`Férias (${d.vender ? Math.min(20, d.dias) : d.dias} dias)`, r.rem)}${line('+ 1/3 constitucional', r.terco)}${r.abono ? line('+ Abono (10 dias vendidos + 1/3) — sem desconto', r.abono) : ''}${line('− INSS', -r.inss, 'delta badd')}${line('− IR', -r.ir, 'delta badd')}</div>`;
    } else if (S.tab === 'decimo') {
      if (!d.bruto) return (out.innerHTML = '<p class="muted">Informe o salário.</p>');
      const r = K.decimo(d.bruto, d.meses || 12, d.deps);
      out.innerHTML = `<header><h3>🎄 13º salário</h3></header><div class="grid g2"><div class="stat"><div class="lbl">1ª parcela (até 30/11)</div><div class="val">${U.money(r.p1)}</div><div class="sub">sem descontos</div></div><div class="stat"><div class="lbl">2ª parcela (até 20/12)</div><div class="val">${U.money(r.p2)}</div><div class="sub">com INSS e IR</div></div></div>
        <div class="list mt">${line('13º bruto', r.total)}${line('− INSS', -r.inss, 'delta badd')}${line('− IR (tributação exclusiva)', -r.ir, 'delta badd')}${line('Total líquido', r.liq, 'delta good')}</div>`;
    } else if (S.tab === 'rescisao') {
      if (!d.bruto || !d.adm || !d.saida) return (out.innerHTML = '<p class="muted">Informe salário, admissão e saída.</p>');
      const r = K.rescisao({ sal: d.bruto, adm: d.adm, saida: d.saida, motivo: d.motivo, aviso: d.aviso, vencidas: d.vencidas, fgts: d.fgts, deps: d.deps });
      out.innerHTML = `<header><h3>📤 Rescisão (estimativa)</h3><small class="muted">${r.anos} ano(s) de empresa</small></header><div class="stat"><div class="val delta good">${U.money(r.liq)}</div><div class="sub">verbas rescisórias líquidas</div></div>
        <div class="list mt">${r.itens.map((x) => `<div class="li"><div class="grow">${x.l} <small class="muted">${x.obs}</small></div><b>${U.money(x.v)}</b></div>`).join('')}${line('− INSS', -r.inss, 'delta badd')}${line('− IR', -r.ir, 'delta badd')}</div>
        <div class="note mt">🏦 <b>FGTS</b>: saldo ${r.estimado ? '≈ ' : ''}${U.moneyTxt(r.saldoFgts)}${r.multa ? ` · multa ${d.motivo === 'acordo' ? '20%' : '40%'}: <b>${U.moneyTxt(r.multa)}</b>` : ''}${r.saque ? ` · pode sacar: <b>${U.moneyTxt(r.saque + r.multa)}</b>` : ' · sem saque neste tipo de saída'}${r.seguro ? '<br>📋 Pode ter direito ao <b>seguro-desemprego</b>.' : ''}</div>`;
    } else {
      if (!d.preco || !d.n) return (out.innerHTML = '<p class="muted">Informe o preço e as parcelas.</p>');
      const r = K.vista(d);
      const win = r.melhor === 'vista';
      out.innerHTML = `<header><h3>🛍️ Resultado</h3></header><div class="note" style="font-size:1.05rem">${win ? `✅ <b>Pague à vista</b>: você economiza <b>${U.moneyTxt(r.economia)}</b> comparando com parcelar e deixar o dinheiro rendendo.` : `✅ <b>Parcele</b> e deixe o dinheiro rendendo: você ganha <b>${U.moneyTxt(r.economia)}</b> em relação a pagar à vista.`}</div>
        <div class="list mt">${line('À vista' + (d.desc ? ` (−${d.desc}%)` : ''), r.vista)}${line(`Parcelado: ${d.n}× de ${U.moneyTxt(d.parcela || d.preco / d.n)}`, r.total)}${line('Valor presente das parcelas (dinheiro rendendo)', r.pv)}${r.juros > 0.5 ? line('Juros embutidos no parcelamento', r.juros, 'delta badd') : ''}</div>
        <p class="muted"><small>Considera seu dinheiro rendendo ${U.fmt(r.r * 100, 2)}% ao mês (líquido de IR) até cada parcela vencer.</small></p>`;
    }
  };
  K.actions = {
    ckTab: (t) => { S.tab = t.dataset.k; App.rerender(); },
    ckRun: () => K.run(),
    ckTable: (t) => { const T = K.t(); T[t.dataset.t][+t.dataset.i][+t.dataset.j] = U.num(t.value); App.save(); K.run(); },
    ckReset: () => { delete st().settings.taxTables; App.save(); App.rerender(); },
  };
})(window.App);
