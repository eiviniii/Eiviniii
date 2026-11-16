/* ==========================================================
   AVATAR CORPORAL — silhueta paramétrica animada
   O formato muda conforme IMC, % de gordura e massa muscular.
   Zonas de calor mostram onde a gordura se acumula
   (homens: barriga, peito, flancos | mulheres: quadril, coxas).
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U;
  const B = (App.Body = {});
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  /** Converte um registro de composição corporal em parâmetros de forma. */
  B.params = (e, profile) => {
    const sex = profile.sex === 'F' ? 'F' : 'M';
    const h = (profile.height || 0) / 100;
    const weight = e.weight || (h ? 22 * h * h : 70);
    const bmi = h ? weight / (h * h) : 23;
    const age = U.age(profile.birth) || 30;
    const fat = e.fat || B.estimateFat(bmi, age, sex);
    const muscleRatio = e.muscle ? e.muscle / weight : (sex === 'M' ? 0.42 : 0.33);
    const m = cl((muscleRatio - (sex === 'M' ? 0.34 : 0.26)) / 0.14);
    const M = sex === 'M';
    const z = M
      ? { belly: (fat - 10) / 28, chest: (fat - 14) / 26, flank: (fat - 12) / 28, thigh: (fat - 16) / 30, arm: (fat - 15) / 30, face: (fat - 18) / 25 }
      : { belly: (fat - 20) / 25, chest: (fat - 22) / 25, flank: (fat - 20) / 24, thigh: (fat - 18) / 22, arm: (fat - 22) / 25, face: (fat - 26) / 22 };
    for (const k in z) z[k] = cl(z[k], 0, 1.15);
    const w = cl(1 + (bmi - 22) * 0.028, 0.84, 1.5);
    return {
      sex, bmi, fat, m, w,
      belly: z.belly * (M ? 1 : 0.6), chest: M ? z.chest : 0.55 + z.chest * 0.45,
      hips: M ? z.flank * 0.55 : 0.55 + z.thigh * 0.6, thighs: M ? z.thigh * 0.5 : 0.35 + z.thigh * 0.75,
      arms: z.arm * 0.6 + m * 0.45, shoulder: (M ? 1 : 0.86) * (1 + m * 0.13) * (0.96 + (w - 1) * 0.45),
      zones: z, abs: M ? cl((15 - fat) / 6) * (0.4 + m * 0.6) : cl((21 - fat) / 5) * (0.3 + m * 0.5),
    };
  };

  /** Fórmula de Deurenberg — usada quando não há % de gordura medido. */
  B.estimateFat = (bmi, age, sex) => cl(1.2 * bmi + 0.23 * age - 10.8 * (sex === 'M' ? 1 : 0) - 5.4, 4, 60);

  /* curva suave fechada (Catmull-Rom → Bézier) */
  const smooth = (pts, closed = true, t = 1) => {
    const n = pts.length; const P = (i) => pts[closed ? (i + n) % n : cl(i, 0, n - 1)];
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * t, p1[1] + ((p2[1] - p0[1]) / 6) * t];
      const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * t, p2[1] - ((p3[1] - p1[1]) / 6) * t];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d + (closed ? 'Z' : '');
  };
  const mirror = (half, cx = 100) => [...half.map(([x, y]) => [cx + x, y]), ...half.slice().reverse().map(([x, y]) => [cx - x, y])];
  const flipX = (pts, cx = 100) => pts.map(([x, y]) => [2 * cx - x, y]).reverse();

  B.geometry = (p) => {
    const { w, belly, chest, hips, thighs, arms, m } = p;
    const F = p.sex === 'F';
    const S = 39 * p.shoulder;
    const waistBase = F ? 21.5 : 25;
    // ---------- vista frontal ----------
    const torsoHalf = [
      [10.5, 64], [12, 80], [S * 0.72, 87], [S, 97],
      [S - 5 + chest * 2.5, 116], [29 * w + chest * (F ? 6 : 4.5) + m * 2.5, 133],
      [27 * w + belly * 5 + (F ? -2 : 0), 152], [waistBase * w + belly * 13 + hips * 2, 176],
      [(F ? 28 : 27) * w + belly * 13 + hips * 6, 199], [(F ? 33 : 30.5) * w + hips * 10, 220],
      [(F ? 33 : 30.5) * w + hips * 9 + thighs * 4, 238], [3, 250],
    ];
    const hipX = torsoHalf[10][0];
    const legR = [
      [100 + hipX - 1, 232], [100 + 27.5 * w + thighs * 8, 268], [100 + 20 + w * 2 + thighs * 3, 316],
      [100 + 19.5 + m * 2.5 + thighs * 1.5, 344], [100 + 13.5, 386], [100 + 18, 399], [100 + 5.5, 399], [100 + 6.5, 386],
      [100 + 7.5 + m, 344], [100 + 7, 316], [100 + 3 + thighs * 4, 268], [100 + 1.2, 248],
    ];
    const ax = S;
    const armR = [
      [100 + ax - 6, 95], [100 + ax + 3 + arms * 3, 104], [100 + ax + 5.5 + arms * 6, 138], [100 + ax + 3.5 + arms * 3, 170],
      [100 + ax + 4.5 + arms * 3.5, 198], [100 + ax + 2.5, 226], [100 + ax + 4, 246], [100 + ax - 1, 254], [100 + ax - 5, 246],
      [100 + ax - 4, 226], [100 + ax - 5 - arms * 1.5, 198], [100 + ax - 6.5 - arms * 1.5, 170], [100 + ax - 8 - arms * 3, 138], [100 + ax - 9, 115],
    ];
    const front = {
      torso: smooth(mirror(torsoHalf)), legR: smooth(legR), legL: smooth(flipX(legR)), armR: smooth(armR), armL: smooth(flipX(armR)),
      head: { cx: 100, cy: 41, rx: 16 + p.zones.face * 3, ry: 21 + p.zones.face * 1.5 },
    };
    // ---------- vista lateral ----------
    const bf = belly * (F ? 0.7 : 1);
    const frontC = [
      [9, 62], [9, 80], [15 + chest * (F ? 10 : 6.5) + m * 3, 112], [14 + chest * (F ? 7 : 5) + bf * 5, 136],
      [12 + bf * 14, 160], [13 + bf * 24, 184], [12 + bf * 17, 207], [13 + hips * 3, 228], [14 + thighs * 5, 256],
      [11, 318], [9, 352], [7, 385], [24, 397], [22, 400],
    ];
    const backC = [
      [-9, 400], [-10, 390], [-12 - m * 3 - thighs * 2, 346], [-9, 318], [-13 - thighs * 5, 268], [-17 - hips * (F ? 11 : 7) - m * 2, 240],
      [-10 - hips * 2 - p.fat * 0.06, 206], [-12.5 - p.fat * 0.12, 166], [-16 - p.fat * 0.09 - m * 2, 120], [-13, 92], [-7.5, 70], [-7.5, 62],
    ];
    const side = {
      body: smooth([...frontC, ...backC].map(([x, y]) => [100 + x, y])),
      arm: smooth([[96, 96], [104 + arms * 3, 100], [106 + arms * 5, 138], [104 + arms * 3, 172], [106 + arms * 3, 200], [104, 228], [106, 248], [100, 254], [96, 246], [97, 226], [94 - arms * 2, 198], [94 - arms * 2, 170], [92 - arms * 4, 138], [92, 108]]),
      head: { cx: 102, cy: 41, rx: 18 + p.zones.face * 2, ry: 21 },
    };
    // ---------- zonas de gordura ----------
    const z = p.zones;
    const zones = {
      front: [
        { cx: 100, cy: 184, rx: 22 * w + belly * 9, ry: 30, v: z.belly },
        { cx: 100 - 15, cy: 132, rx: 12 + chest * 3, ry: 10 + chest * 2, v: z.chest }, { cx: 100 + 15, cy: 132, rx: 12 + chest * 3, ry: 10 + chest * 2, v: z.chest },
        { cx: 100 - (24 * w + hips * 8), cy: 202, rx: 9 + hips * 4, ry: 20, v: z.flank }, { cx: 100 + (24 * w + hips * 8), cy: 202, rx: 9 + hips * 4, ry: 20, v: z.flank },
        { cx: 100 - 15, cy: 262, rx: 12 + thighs * 3, ry: 24, v: z.thigh }, { cx: 100 + 15, cy: 262, rx: 12 + thighs * 3, ry: 24, v: z.thigh },
        { cx: 100 - (ax + 1), cy: 142, rx: 6, ry: 20, v: z.arm }, { cx: 100 + ax + 1, cy: 142, rx: 6, ry: 20, v: z.arm },
        { cx: 100, cy: 56, rx: 12, ry: 7, v: z.face },
      ],
      side: [
        { cx: 104 + bf * 12, cy: 184, rx: 14 + bf * 12, ry: 32, v: z.belly },
        { cx: 108 + chest * 4, cy: 122, rx: 9, ry: 12, v: z.chest },
        { cx: 86 - hips * 5, cy: 236, rx: 10 + hips * 5, ry: 20, v: Math.max(z.flank, z.thigh) * 0.9 },
        { cx: 101, cy: 262, rx: 14, ry: 22, v: z.thigh },
      ],
    };
    return { front, side, zones };
  };

  /** cor da zona: verde → amarelo → laranja → vermelho */
  B.heat = (v) => {
    const stops = [[0, [52, 211, 153]], [0.35, [163, 230, 53]], [0.58, [250, 204, 21]], [0.8, [249, 115, 22]], [1.05, [239, 68, 68]]];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (v >= stops[i][0] && v <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    if (v > 1.05) a = b;
    const t = b[0] === a[0] ? 0 : (v - a[0]) / (b[0] - a[0]);
    return `rgb(${a[1].map((c, i) => Math.round(c + (b[1][i] - c) * t)).join(',')})`;
  };

  /* ---------- componente ---------- */
  let seq = 0;
  B.svg = (id) => {
    const skin = App.state.settings.avatarSkin;
    const s = id;
    const stops = skin === 'skin' ? ['#f3c9a8', '#d99b76'] : skin === 'mono' ? ['#cbd5e1', '#64748b'] : [App.state.settings.accent2, App.state.settings.accent];
    const part = (cls, ref) => `<path class="${cls}" data-p="${ref}" fill="url(#g${s})"/>`;
    return `<svg class="avatar" viewBox="0 0 400 410" role="img" aria-label="Representação do corpo">
      <defs>
        <linearGradient id="g${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${stops[0]}" stop-opacity=".85"/><stop offset="1" stop-color="${stops[1]}" stop-opacity=".75"/></linearGradient>
        <radialGradient id="hz${s}"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <clipPath id="cf${s}"><path data-p="f-torso"/><path data-p="f-legL"/><path data-p="f-legR"/><path data-p="f-armL"/><path data-p="f-armR"/><ellipse data-p="f-head"/></clipPath>
        <clipPath id="cs${s}"><path data-p="s-body"/><path data-p="s-arm"/><ellipse data-p="s-head"/></clipPath>
        <filter id="glow${s}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <ellipse cx="100" cy="402" rx="46" ry="5" class="shadow"/><ellipse cx="300" cy="402" rx="40" ry="5" class="shadow"/>
      <g class="ghost" data-ghost><path data-p="gf-torso"/><path data-p="gf-legL"/><path data-p="gf-legR"/><path data-p="gs-body" transform="translate(200,0)"/></g>
      <g class="bodyfill" filter="url(#glow${s})">
        ${part('', 'f-legL')}${part('', 'f-legR')}${part('', 'f-torso')}<ellipse data-p="f-head" fill="url(#g${s})"/>
      </g>
      <g clip-path="url(#cf${s})" data-zones="front"></g>
      <g class="abs" data-abs></g>
      <g class="bodyfill arms">${part('', 'f-armL')}${part('', 'f-armR')}</g>
      <g clip-path="url(#cf${s})" data-zones="arms"></g>
      <g transform="translate(200,0)">
        <g class="bodyfill" filter="url(#glow${s})">${part('', 's-body')}<ellipse data-p="s-head" fill="url(#g${s})"/></g>
        <g clip-path="url(#cs${s})" data-zones="side"></g>
        <g class="bodyfill arms">${part('', 's-arm')}</g>
      </g>
      <text x="100" y="12" class="avatar-lbl">FRENTE</text><text x="300" y="12" class="avatar-lbl">LADO</text>
    </svg>`;
  };

  const setAttrs = (el, o) => { for (const k in o) el.setAttribute(k, typeof o[k] === 'number' ? o[k].toFixed(1) : o[k]); };

  B.draw = (svg, p, ghostP) => {
    const g = B.geometry(p);
    const q = (k) => svg.querySelectorAll(`[data-p="${k}"]`);
    const map = { 'f-torso': g.front.torso, 'f-legL': g.front.legL, 'f-legR': g.front.legR, 'f-armL': g.front.armL, 'f-armR': g.front.armR, 's-body': g.side.body, 's-arm': g.side.arm };
    for (const k in map) q(k).forEach((el) => el.setAttribute('d', map[k]));
    q('f-head').forEach((el) => setAttrs(el, g.front.head));
    q('s-head').forEach((el) => setAttrs(el, g.side.head));
    const s = svg.querySelector('linearGradient').id.slice(1);
    const zoneHTML = (arr) => arr.filter((zz) => zz.v > 0.05).map((zz) => `<ellipse cx="${zz.cx.toFixed(1)}" cy="${zz.cy.toFixed(1)}" rx="${zz.rx.toFixed(1)}" ry="${zz.ry.toFixed(1)}" fill="${B.heat(zz.v)}" opacity="${(0.25 + Math.min(zz.v, 1.1) * 0.6).toFixed(2)}" filter="url(#blur${s})"/>`).join('');
    // desfoque das zonas
    if (!svg.querySelector(`#blur${s}`)) {
      svg.querySelector('defs').insertAdjacentHTML('beforeend', `<filter id="blur${s}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>`);
    }
    const fz = g.zones.front;
    svg.querySelector('[data-zones=front]').innerHTML = zoneHTML(fz.slice(0, 7).concat(fz.slice(9)));
    svg.querySelector('[data-zones=arms]').innerHTML = zoneHTML(fz.slice(7, 9));
    svg.querySelector('[data-zones=side]').innerHTML = zoneHTML(g.zones.side);
    // definição abdominal quando o % de gordura é baixo
    const a = p.abs;
    svg.querySelector('[data-abs]').innerHTML = a > 0.05 ? `<g opacity="${(a * 0.7).toFixed(2)}">
      <path d="M100,150 L100,215"/><path d="M88,165 Q100,168 112,165"/><path d="M89,182 Q100,185 111,182"/><path d="M90,199 Q100,202 110,199"/>
      <path d="M86,128 Q100,140 114,128"/></g>` : '';
    // contorno fantasma (comparação)
    const gh = svg.querySelector('[data-ghost]');
    if (ghostP) {
      const gg = B.geometry(ghostP);
      gh.style.display = '';
      svg.querySelector('[data-p="gf-torso"]').setAttribute('d', gg.front.torso);
      svg.querySelector('[data-p="gf-legL"]').setAttribute('d', gg.front.legL);
      svg.querySelector('[data-p="gf-legR"]').setAttribute('d', gg.front.legR);
      svg.querySelector('[data-p="gs-body"]').setAttribute('d', gg.side.body);
    } else gh.style.display = 'none';
  };

  const lerpP = (a, b, t) => {
    const o = { ...b, zones: {} };
    for (const k of ['bmi', 'fat', 'm', 'w', 'belly', 'chest', 'hips', 'thighs', 'arms', 'shoulder', 'abs']) o[k] = a[k] + (b[k] - a[k]) * t;
    for (const k in b.zones) o.zones[k] = a.zones[k] + (b.zones[k] - a.zones[k]) * t;
    return o;
  };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /** Cria um avatar animável num elemento. Retorna { to(params, ghost) }. */
  B.create = (host) => {
    const id = 'av' + ++seq;
    host.innerHTML = B.svg(id);
    const svg = host.querySelector('svg');
    let cur = null, raf = 0, ghost = null;
    return {
      to(p, g = ghost, ms = 1100) {
        ghost = g;
        cancelAnimationFrame(raf);
        if (!cur || ms === 0) { cur = p; B.draw(svg, p, ghost); return; }
        const from = cur, t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          cur = lerpP(from, p, ease(t));
          B.draw(svg, cur, ghost);
          if (t < 1 && svg.isConnected) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
    };
  };

  /* ---------- classificações ---------- */
  B.fatClass = (fat, sex) => {
    const t = sex === 'F' ? [[14, 'Essencial', '#38bdf8'], [21, 'Atleta', '#22c55e'], [25, 'Fitness', '#84cc16'], [32, 'Média', '#eab308'], [99, 'Obesidade', '#ef4444']]
      : [[6, 'Essencial', '#38bdf8'], [14, 'Atleta', '#22c55e'], [18, 'Fitness', '#84cc16'], [25, 'Média', '#eab308'], [99, 'Obesidade', '#ef4444']];
    const r = t.find(([lim]) => fat < lim) || t[t.length - 1];
    return { label: r[1], color: r[2] };
  };
  B.bmiClass = (bmi) => {
    const t = [[18.5, 'Abaixo do peso', '#38bdf8'], [25, 'Peso normal', '#22c55e'], [30, 'Sobrepeso', '#eab308'], [35, 'Obesidade I', '#f97316'], [40, 'Obesidade II', '#ef4444'], [999, 'Obesidade III', '#b91c1c']];
    const r = t.find(([lim]) => bmi < lim); return { label: r[1], color: r[2] };
  };
  B.visceralClass = (v) => (v <= 9 ? { label: 'Saudável', color: '#22c55e' } : v <= 14 ? { label: 'Elevada', color: '#f97316' } : { label: 'Alta', color: '#ef4444' });
  B.waterClass = (w, sex) => { const [a, b] = sex === 'F' ? [45, 60] : [50, 65]; return w < a ? { label: 'Baixa', color: '#f97316' } : w > b ? { label: 'Alta', color: '#38bdf8' } : { label: 'Ideal', color: '#22c55e' }; };
})(window.App);
