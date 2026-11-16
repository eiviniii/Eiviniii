/* ==========================================================
   AVATAR CORPORAL — manequim paramétrico animado
   Silhueta única (tronco + pernas), braços com mãos, cabeça com
   mandíbula/orelhas/cabelo, sombreamento cilíndrico, sombra interna,
   linhas anatômicas, mapa de calor de gordura e modo holograma.
   A forma muda com IMC, % de gordura e massa muscular.
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U;
  const B = (App.Body = {});
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  /* ---------- parâmetros a partir de uma medição ---------- */
  B.params = (e, profile) => {
    const sex = profile.sex === 'F' ? 'F' : 'M';
    const M = sex === 'M';
    const h = (profile.height || 0) / 100;
    const weight = e.weight || (h ? 22 * h * h : 70);
    const bmi = h ? weight / (h * h) : 23;
    const age = U.age(profile.birth) || 30;
    const fat = e.fat || B.estimateFat(bmi, age, sex);
    const muscleRatio = e.muscle ? e.muscle / weight : (M ? 0.42 : 0.33);
    const m = cl((muscleRatio - (M ? 0.34 : 0.26)) / 0.14);
    const z = M
      ? { belly: (fat - 10) / 28, chest: (fat - 14) / 26, flank: (fat - 12) / 28, thigh: (fat - 16) / 30, arm: (fat - 15) / 30, face: (fat - 18) / 25 }
      : { belly: (fat - 20) / 25, chest: (fat - 22) / 25, flank: (fat - 20) / 24, thigh: (fat - 18) / 22, arm: (fat - 22) / 25, face: (fat - 26) / 22 };
    for (const k in z) z[k] = cl(z[k], 0, 1.15);
    const w = cl(1 + (bmi - 22) * 0.026, 0.86, 1.45);
    return {
      sex, bmi, fat, m, w,
      belly: z.belly * (M ? 1 : 0.6), chest: M ? z.chest : 0.55 + z.chest * 0.45,
      hips: M ? z.flank * 0.6 : 0.55 + z.thigh * 0.6, thighs: M ? z.thigh * 0.55 : 0.35 + z.thigh * 0.75,
      arms: z.arm * 0.6 + m * 0.35, shoulder: (M ? 1 : 0.87) * (1 + m * 0.12) * (0.97 + (w - 1) * 0.4),
      zones: z, def: M ? cl((16 - fat) / 7) * (0.35 + m * 0.65) : cl((22 - fat) / 6) * (0.3 + m * 0.5),
    };
  };
  /** Deurenberg — quando não há % de gordura medido. */
  B.estimateFat = (bmi, age, sex) => cl(1.2 * bmi + 0.23 * age - 10.8 * (sex === 'M' ? 1 : 0) - 5.4, 4, 60);

  /* ---------- geometria auxiliar ---------- */
  const f1 = (n) => n.toFixed(1);
  const smooth = (pts, closed = true, t = 1) => {
    const n = pts.length; const P = (i) => pts[closed ? (i + n) % n : cl(i, 0, n - 1)];
    let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      d += `C${f1(p1[0] + ((p2[0] - p0[0]) / 6) * t)},${f1(p1[1] + ((p2[1] - p0[1]) / 6) * t)} ${f1(p2[0] - ((p3[0] - p1[0]) / 6) * t)},${f1(p2[1] - ((p3[1] - p1[1]) / 6) * t)} ${f1(p2[0])},${f1(p2[1])}`;
    }
    return d + (closed ? 'Z' : '');
  };
  /** metade direita (x = deslocamento do centro) → contorno completo espelhado */
  const mirror = (half, cx) => {
    const right = half.map(([x, y]) => [cx + x, y]);
    const left = half.slice().reverse().filter(([x]) => x !== 0).map(([x, y]) => [cx - x, y]);
    return right.concat(left);
  };
  const flip = (pts, cx) => pts.map(([x, y]) => [2 * cx - x, y]).reverse();
  /** membro afunilado ao longo de um eixo (braço com mão) */
  const limb = (a, b, outer, inner, cap = 6) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; const n = [d[1], -d[0]];
    const at = (t, w, s) => [a[0] + d[0] * t * L + n[0] * w * s, a[1] + d[1] * t * L + n[1] * w * s];
    return [[a[0] - d[0] * cap, a[1] - d[1] * cap], ...outer.map(([t, w]) => at(t, w, 1)), ...inner.slice().reverse().map(([t, w]) => at(t, w, -1))];
  };
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ==========================================================
     VISTA FRONTAL (centro x = 100)
     ========================================================== */
  const front = (p) => {
    const F = p.sex === 'F', cx = 100, z = p.zones;
    const { w, belly, chest, hips, thighs, arms, m } = p;
    const S = 41 * p.shoulder;
    const neck = (F ? 7.2 : 9.3) + z.face * 1.6 + m * 1.2;
    const C = (F ? 26.5 : 30) * w + chest * (F ? 2.5 : 4) + m * 2.5;
    const W = (F ? 20.5 : 24.5) * w + belly * 12 + hips * 1.5;
    const Hh = (F ? 31.5 : 27.5) * w + hips * 8.5 + belly * 2.5;
    const knee = 15.5 + (w - 1) * 7 + thighs, calf = 17 + m * 2.5 + thighs * 1.5 + (w - 1) * 6;
    const torsoLegs = [
      [neck, 62], [neck + 0.6, 75], [S * 0.5, 82], [S * 0.84, 87], [S, 97], [S - 1.8, 108], [C + 1.6, 119],
      [C + m * 1.5, 133], [C - 2 + chest * 1.2 + belly * 3.5, 151], [W, 175], [lerp(W, Hh, 0.6) + belly * 5, 197], [Hh, 220],
      [Hh - 0.8 + thighs * 1.5, 244], [lerp(Hh, knee, 0.36) + thighs * 3, 272], [lerp(Hh, knee, 0.76) + thighs * 1.5, 300], [knee, 321], [calf, 347],
      [14 + thighs * 0.6 + (w - 1) * 3, 373], [10.2, 398], [12.2, 410], [12.6, 419], [8, 422], [4.4, 419], [4, 409], [5.1, 397], [6.4 + m, 358], [5.4, 331], [5.6, 316],
      [3.8 + thighs * 3.6 + (w - 1) * 4, 284], [2.2 + thighs * 3 + (w - 1) * 3, 254], [0.9, 240], [0, 237],
    ];
    const body = smooth(mirror(torsoLegs, cx));
    // braço direito (o esquerdo é espelhado)
    const J = [cx + S - 5.5, 96];
    const wx = Math.max(cx + S + 7, cx + Hh + 9.5 + arms * 2);
    const Wr = [wx, 236];
    const armPts = limb(J, Wr,
      [[0, 8.5 + m * 2], [0.12, 9.5 + m * 3 + arms * 2], [0.3, 7.4 + m * 2.4 + arms * 3], [0.47, 5.5 + arms * 1.2], [0.6, 6.4 + m * 1.7 + arms * 1.5], [0.83, 4.3 + arms * 0.5], [0.9, 4.1], [0.99, 5.6], [1.08, 5.1], [1.16, 2.6]],
      [[0, 6], [0.12, 6.4 + m], [0.3, 6.6 + m * 2 + arms * 3.4], [0.47, 4.9 + arms], [0.6, 5.8 + m * 1.4 + arms * 1.4], [0.83, 3.7], [0.9, 3.5], [0.98, 4.9], [1.05, 4.6], [1.16, 2.2]]);
    const armR = smooth(armPts), armL = smooth(flip(armPts, cx));
    // cabeça
    const fc = z.face;
    const headHalf = [[0, 17], [8.5, 18.3], [14.2, 23.5], [16.6, 32], [16.9, 42], [16.3, 50], [15.2 + fc * 2, 57], [12.8 + fc * 3, 64.5], [7.5 + fc * 2.5, 70.5], [0, 73 + fc * 1.5]];
    const head = smooth(mirror(headHalf, cx));
    const earR = smooth([[cx + 16, 41], [cx + 19.6, 40], [cx + 20.6, 46], [cx + 18.8, 53], [cx + 15.8, 53]]);
    const earL = smooth(flip([[cx + 16, 41], [cx + 19.6, 40], [cx + 20.6, 46], [cx + 18.8, 53], [cx + 15.8, 53]], cx));
    // cabelo
    const hairTop = F
      ? smooth(mirror([[0, 12.5], [10, 14], [17.5, 21], [20, 32], [19.5, 44], [17.2, 40], [15.4, 30], [8, 24.5], [0, 23.5]], cx))
      : smooth(mirror([[0, 13], [9.5, 14.2], [16, 19.5], [18.3, 28], [17.9, 37.5], [16.6, 34.5], [15.3, 27.5], [9, 22.8], [0, 22.2]], cx));
    const hairBack = F ? smooth(mirror([[0, 13], [12, 15], [20, 26], [22, 46], [23.5, 72], [24 + w * 2, 96], [17, 101], [14, 80], [0, 76]], cx)) : '';
    // seios (F) ou contorno peitoral (M)
    const bust = [];
    // linhas anatômicas
    const lines = [];
    const add = (d, o, cls = '') => lines.push({ d, o, cls });
    const kx = (knee + 5.6) / 2;
    add(`M${cx - 4},84 Q${cx - S * 0.4},83 ${cx - S * 0.78},88 M${cx + 4},84 Q${cx + S * 0.4},83 ${cx + S * 0.78},88`, 0.45); // clavículas
    add(`M${cx},99 L${cx},${150}`, 0.18 + p.def * 0.3); // esterno
    if (F) [-1, 1].forEach((s) => { add(`M${cx + s * 4},${128 + chest * 4} C${cx + s * 6},${139 + chest * 5} ${cx + s * (17 + chest * 3)},${140 + chest * 5} ${cx + s * (C - 3)},${124 + chest * 3}`, 0.55, 'bustline'); add(`M${cx + s * (C - 4)},116 Q${cx + s * (C + 0.5)},${124} ${cx + s * (C - 3)},${131 + chest * 3}`, 0.25); });
    if (!F) add(`M${cx},106 C${cx - 6},${126 + chest * 6} ${cx - 19},${129 + chest * 7} ${cx - C + 2},${119 + chest * 4} M${cx},106 C${cx + 6},${126 + chest * 6} ${cx + 19},${129 + chest * 7} ${cx + C - 2},${119 + chest * 4}`, 0.25 + p.def * 0.45 + chest * 0.25); // peitoral
    // abdômen (gomos) — some com gordura
    const absO = p.def * 0.75;
    if (absO > 0.04) {
      add(`M${cx},150 L${cx},186`, absO);
      [150, 163, 176].forEach((y, i) => add(`M${cx - 11 + i},${y} Q${cx},${y + 2.5} ${cx + 11 - i},${y}`, absO * 0.9));
      add(`M${cx - W + 4},184 Q${cx - 13},205 ${cx - 5},226 M${cx + W - 4},184 Q${cx + 13},205 ${cx + 5},226`, absO); // linhas do "V"
      add(`M${cx - 11},139 Q${cx - 13},160 ${cx - 12.5},187 M${cx + 11},139 Q${cx + 13},160 ${cx + 12.5},187`, absO * 0.7);
    }
    add(`M${cx - 1.6},${190 + belly * 6} a1.6,2.2 0 1,0 3.2,0 a1.6,2.2 0 1,0 -3.2,0`, 0.5, 'navel'); // umbigo
    if (belly > 0.45) add(`M${cx - W * 0.85},${206 + belly * 6} Q${cx},${222 + belly * 10} ${cx + W * 0.85},${206 + belly * 6}`, cl((belly - 0.45) * 1.4)); // dobra da barriga
    if (z.flank > 0.5) add(`M${cx - Hh + 2},${206} q4,6 2,13 M${cx + Hh - 2},${206} q-4,6 -2,13`, cl((z.flank - 0.5) * 1.5));
    // pernas: joelhos, quadríceps
    [-1, 1].forEach((s) => {
      add(`M${cx + s * (kx - 4)},314 Q${cx + s * kx},309 ${cx + s * (kx + 4)},314 Q${cx + s * kx},327 ${cx + s * (kx - 4)},314`, 0.35);
      add(`M${cx + s * (Hh * 0.55)},232 Q${cx + s * (Hh * 0.5)},270 ${cx + s * (kx + 1)},305`, 0.15 + p.def * 0.3 + m * 0.15);
      add(`M${cx + s * 7},262 Q${cx + s * 11},292 ${cx + s * (kx - 2)},305`, 0.1 + p.def * 0.25);
      add(`M${cx + s * (kx + 2)},336 Q${cx + s * (kx + 4)},356 ${cx + s * (kx + 1)},376`, 0.12 + m * 0.25); // panturrilha
    });
    // braços: deltoide e cotovelo
    const ax = J[0] - cx, L = Math.hypot(Wr[0] - J[0], Wr[1] - J[1]), ang = Math.atan2(Wr[0] - J[0], Wr[1] - J[1]);
    const ap = (t, o) => [J[0] + Math.sin(ang) * t * L + Math.cos(ang) * o, J[1] + Math.cos(ang) * t * L - Math.sin(ang) * o];
    [-1, 1].forEach((s) => {
      const X = (q) => (s > 0 ? q[0] : 2 * cx - q[0]);
      const d1 = ap(0.06, -6), d2 = ap(0.24, 2), e1 = ap(0.47, -3), e2 = ap(0.47, 3), h1 = ap(1.0, -3), h2 = ap(1.09, -1);
      add(`M${X(d1)},${d1[1]} Q${X(ap(0.2, -3))},${ap(0.2, -3)[1]} ${X(d2)},${d2[1]}`, 0.2 + m * 0.35);
      add(`M${X(e1)},${e1[1]} Q${X(ap(0.5, 0))},${ap(0.5, 0)[1] + 1.5} ${X(e2)},${e2[1]}`, 0.25);
      add(`M${X(h1)},${h1[1]} L${X(h2)},${h2[1]}`, 0.35); // polegar
    });
    void ax;
    // zonas de gordura
    const armC = (t) => ap(t, 0);
    const zones = [
      { k: 'belly', cx, cy: 184, rx: W * 0.9 + belly * 4, ry: 28 + belly * 5, v: z.belly },
      { k: 'chest', cx: cx - 14, cy: 124, rx: 12 + chest * 3, ry: 11 + chest * 2, v: z.chest }, { k: 'chest', cx: cx + 14, cy: 124, rx: 12 + chest * 3, ry: 11 + chest * 2, v: z.chest },
      { k: 'flank', cx: cx - (W + 3), cy: 199, rx: 8 + hips * 4, ry: 19, v: z.flank }, { k: 'flank', cx: cx + (W + 3), cy: 199, rx: 8 + hips * 4, ry: 19, v: z.flank },
      { k: 'thigh', cx: cx - (Hh * 0.5 + 2), cy: 262, rx: 11 + thighs * 3, ry: 25, v: z.thigh }, { k: 'thigh', cx: cx + (Hh * 0.5 + 2), cy: 262, rx: 11 + thighs * 3, ry: 25, v: z.thigh },
      { k: 'arm', cx: 2 * cx - armC(0.3)[0], cy: armC(0.3)[1], rx: 7, ry: 18, v: z.arm }, { k: 'arm', cx: armC(0.3)[0], cy: armC(0.3)[1], rx: 7, ry: 18, v: z.arm },
      { k: 'face', cx, cy: 64, rx: 12, ry: 7, v: z.face },
    ];
    return { body, armR, armL, head, earR, earL, hairTop, hairBack, bust, lines, zones, footW: Hh + 4 };
  };

  /* ==========================================================
     VISTA LATERAL (perfil olhando para a direita, centro x = 100)
     ========================================================== */
  const side = (p) => {
    const F = p.sex === 'F', cx = 100, z = p.zones;
    const { belly, chest, hips, thighs, arms, m } = p;
    const bf = belly * (F ? 0.75 : 1), fc = z.face, sw = 1 + (p.w - 1) * 0.85;
    const pts = [
      // cabeça (frente)
      [1, 16.5], [9, 18.5], [14.5, 25], [16.6, 34], [17.4, 44], [16.3, 48.5], [19.8, 55], [16.8, 57.6], [17.4, 61.5], [15.6, 65.5], [14.6 + fc, 70.5], [8 + fc * 3, 74 + fc * 2],
      // pescoço e tronco (frente)
      [8.3, 81], [12.5 + chest * 2, 95], [16 + chest * (F ? 10 : 6.5) + m * 3, 115], [14 + chest * (F ? 7 : 4.5) + bf * 5, 136], [12 + bf * 13, 158], [13 + bf * 22, 182], [12 + bf * 16, 205], [12.5 + hips * 3, 224],
      // perna (frente)
      [14 + thighs * 5, 252], [12.5 + thighs * 3.5, 290], [10.5, 318], [9.5, 346], [7.6, 393], [9.5, 405], [24, 414], [27.5, 420], [-8, 421], [-10.6, 413],
      // perna (trás)
      [-8.2, 392], [-12 - m * 3.5 - thighs * 2, 348], [-8.6, 322], [-12.5 - thighs * 4.5, 282], [-16.5 - hips * (F ? 11 : 7) - m * 2, 243], [-12 - hips * 2.5, 214],
      // costas
      [-9.5 - p.fat * 0.07, 190], [-12.5 - p.fat * 0.1, 160], [-16 - p.fat * 0.07 - m * 2.5, 121], [-13.5, 97], [-8.5, 82],
      // cabeça (trás)
      [-12, 68], [-16.5, 55], [-17.5, 41], [-14.5, 27], [-8, 19],
    ].map(([x, y]) => [cx + x * (y > 84 && y < 330 ? sw : 1), y]);
    const body = smooth(pts);
    const J = [cx - 1, 96], Wr = [cx + 4, 236];
    const armPts = limb(J, Wr,
      [[0, 8 + m * 2], [0.14, 8.5 + m * 2.4 + arms * 2], [0.32, 6.8 + m * 2 + arms * 2.8], [0.48, 5.2 + arms], [0.6, 6.2 + m * 1.4 + arms * 1.4], [0.84, 4], [0.9, 3.8], [1.0, 5.4], [1.1, 4.6], [1.17, 2.4]],
      [[0, 8.5 + m * 2], [0.14, 8.8 + m * 2.8 + arms * 2], [0.32, 7.4 + m * 2.6 + arms * 3.4], [0.48, 5.4 + arms], [0.6, 5.6 + m * 1.2 + arms * 1.2], [0.84, 3.8], [0.9, 3.6], [1.0, 4.8], [1.1, 4.2], [1.17, 2.2]], 4);
    const arm = smooth(armPts);
    const ear = smooth([[cx - 3.5, 42], [cx + 0.5, 41], [cx + 1.5, 47], [cx - 0.5, 53.5], [cx - 4, 52]]);
    const hairTop = F
      ? smooth([[cx + 2, 12.5], [cx + 12, 15], [cx + 17.5, 25], [cx + 16.5, 30], [cx + 9, 24], [cx - 4, 27], [cx - 6, 50], [cx - 13, 94], [cx - 20 - p.w * 2, 98], [cx - 21, 60], [cx - 19, 32], [cx - 12, 16]])
      : smooth([[cx + 3, 13], [cx + 11, 15.5], [cx + 16, 23], [cx + 15.6, 28.5], [cx + 9, 23.8], [cx + 1, 25.5], [cx - 5.5, 33], [cx - 10.5, 43], [cx - 15.2, 52], [cx - 18.2, 44], [cx - 18.4, 31], [cx - 14, 19.5], [cx - 6, 14]]);
    const lines = [];
    const add = (d, o) => lines.push({ d, o, cls: '' });
    add(`M${cx + 6},322 q4,-6 3,4`, 0.3); // joelho
    add(`M${cx - 15 - hips * 6},${250} q8,4 15,2`, 0.25 + hips * 0.3); // dobra do glúteo
    add(`M${cx + 12 + chest * 4},${112 + chest * 6} q-4,8 -9,10`, 0.2 + p.def * 0.3); // peitoral
    if (bf > 0.4) add(`M${cx + 8 + bf * 10},${200 + bf * 8} q6,4 -2,10`, cl((bf - 0.4) * 1.4));
    add(`M${cx + 9},88 q4,5 8,6`, 0.25); // clavícula
    const zones = [
      { k: 'belly', cx: cx + 3 + bf * 12, cy: 183, rx: 13 + bf * 12, ry: 30, v: z.belly },
      { k: 'chest', cx: cx + 8 + chest * 4, cy: 120, rx: 9, ry: 12, v: z.chest },
      { k: 'flank', cx: cx - 13 - hips * 5, cy: 232, rx: 10 + hips * 5, ry: 21, v: Math.max(z.flank, z.thigh) * 0.9 },
      { k: 'thigh', cx: cx + 1, cy: 264, rx: 14, ry: 24, v: z.thigh },
      { k: 'arm', cx: cx + 1, cy: 140, rx: 7, ry: 17, v: z.arm },
      { k: 'face', cx: cx + 9, cy: 68, rx: 8, ry: 6, v: z.face },
    ];
    return { body, arm, ear, hairTop, lines, zones, footW: 30 };
  };

  B.geometry = (p) => ({ front: front(p), side: side(p) });

  /* ---------- cores ---------- */
  B.SKINS = {
    holo: null,
    s1: ['#f6d7c3', '#e8b796', '#c98e6b'], s2: ['#efc4a0', '#d9a074', '#b37a52'], s3: ['#d9a479', '#b98157', '#8f5f3c'],
    s4: ['#a8734d', '#8a5a39', '#653f26'], s5: ['#7a4e33', '#5e3a25', '#3f2618'], mono: ['#f1f5f9', '#cbd5e1', '#8a99ad'],
  };
  B.HAIR = { preto: '#1d1a1a', castanho: '#4a2f1d', loiro: '#c79a4b', ruivo: '#9a3d1c', grisalho: '#9aa0a8' };
  B.heat = (v) => {
    const stops = [[0, [52, 211, 153]], [0.35, [163, 230, 53]], [0.58, [250, 204, 21]], [0.8, [249, 115, 22]], [1.05, [239, 68, 68]]];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (v >= stops[i][0] && v <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    if (v > 1.05) a = b;
    const t = b[0] === a[0] ? 0 : (v - a[0]) / (b[0] - a[0]);
    return `rgb(${a[1].map((c, i) => Math.round(c + (b[1][i] - c) * t)).join(',')})`;
  };
  B.level = (v) => (v < 0.25 ? 'Baixo' : v < 0.5 ? 'Moderado' : v < 0.75 ? 'Elevado' : 'Alto');
  B.ZONE_NAMES = { belly: 'Abdômen', chest: 'Peito', flank: 'Flancos / quadril', thigh: 'Coxas', arm: 'Braços', face: 'Rosto / pescoço' };

  /* ---------- SVG ---------- */
  let seq = 0;
  const shade = (id, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${c[2]}"/><stop offset=".22" stop-color="${c[1]}"/><stop offset=".48" stop-color="${c[0]}"/><stop offset=".62" stop-color="${c[0]}"/><stop offset=".82" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>`;

  B.svg = (s) => {
    const set = App.state.settings;
    const holo = (set.avatarSkin || 'holo') === 'holo';
    const acc = set.accent, acc2 = set.accent2;
    const skin = holo ? [App.mix(acc2, '#ffffff', 0.35), App.mix(acc2, acc, 0.5), App.mix(acc, '#000000', 0.25)] : (B.SKINS[set.avatarSkin] || B.SKINS.s2);
    const hair = holo ? App.mix(acc, '#000000', 0.45) : B.HAIR[set.avatarHair || 'preto'] || B.HAIR.preto;
    const showHair = set.avatarHairStyle !== 'none';
    const fig = (v, tx) => {
      const isF = v === 'f';
      const parts = isF ? ['armL', 'armR', 'body', 'head', 'earL', 'earR'] : ['body', 'head', 'ear', 'arm'];
      const clip = isF ? ['armL', 'armR', 'body', 'head'] : ['body', 'arm', 'head'];
      return `<g class="fig fig-${v}" transform="translate(${tx},0)">
        <ellipse class="floor" cx="100" cy="423" rx="44" ry="7" data-p="${v}-floor"/>
        ${holo ? `<g class="platform"><ellipse cx="100" cy="423" rx="62" ry="10"/><ellipse cx="100" cy="423" rx="76" ry="13" class="ring2"/><ellipse cx="100" cy="423" rx="62" ry="10" class="pulse"><animate attributeName="rx" values="50;84;50" dur="4s" repeatCount="indefinite"/><animate attributeName="ry" values="8;15;8" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0;.7" dur="4s" repeatCount="indefinite"/></ellipse></g>` : ''}
        ${isF && showHair ? `<path class="hair" data-p="f-hairBack" fill="url(#hr${s})"/>` : ''}
        <g class="skin" filter="url(#in${s})">
          ${parts.map((k) => `<path data-p="${v}-${k}" fill="url(#sk${s})"/>`).join('')}
        </g>
        <g clip-path="url(#c${v}${s})"><g class="heat" filter="url(#bl${s})" data-zones="${v}"></g>
          <g class="anat" data-lines="${v}"></g>
          ${holo ? `<rect x="0" y="0" width="200" height="430" fill="url(#scan${s})" opacity=".55"/><rect class="scanbar" x="0" y="0" width="200" height="34" fill="url(#bar${s})" opacity=".45"><animate attributeName="y" values="-40;430;-40" dur="6s" repeatCount="indefinite"/></rect>` : `<rect x="0" y="0" width="200" height="430" fill="url(#tl${s})"/>`}
        </g>
        ${showHair ? `<path class="hair" data-p="${v}-hairTop" fill="url(#hr${s})"/>` : ''}
        <g class="rim" filter="url(#rb${s})">${clip.map((k) => `<path data-p="${v}-${k}"/>`).join('')}</g>
        <g class="ghost" data-ghost="${v}"><path data-g="${v}"/></g>
        <clipPath id="c${v}${s}">${clip.map((k) => `<path data-p="${v}-${k}"/>`).join('')}</clipPath>
      </g>`;
    };
    return `<svg class="avatar ${holo ? 'is-holo' : 'is-skin'}" viewBox="0 0 420 440" role="img" aria-label="Representação do corpo" data-view="both">
      <defs>
        ${shade('sk' + s, skin)}
        <linearGradient id="hr${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${App.mix(hair, '#ffffff', 0.15)}"/><stop offset="1" stop-color="${hair}"/></linearGradient>
        <linearGradient id="tl${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
        <pattern id="scan${s}" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.2" fill="#fff" opacity=".22"/></pattern>
        <linearGradient id="bar${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".85" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <filter id="in${s}" x="-10%" y="-5%" width="120%" height="110%"><feFlood flood-color="#000" flood-opacity="${holo ? '.55' : '.42'}"/><feComposite in2="SourceAlpha" operator="out"/><feGaussianBlur stdDeviation="4"/><feComposite operator="atop" in2="SourceGraphic"/>${holo ? '' : ''}</filter>
        <filter id="bl${s}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
        <filter id="rb${s}" x="-20%" y="-10%" width="140%" height="120%"><feGaussianBlur stdDeviation="${holo ? '1.6' : '.6'}"/></filter>
        <radialGradient id="spot${s}" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="${holo ? acc : '#ffffff'}" stop-opacity="${holo ? '.22' : '.10'}"/><stop offset="1" stop-color="${holo ? acc : '#ffffff'}" stop-opacity="0"/></radialGradient>
      </defs>
      <rect class="spot" x="0" y="0" width="420" height="440" fill="url(#spot${s})"/>
      ${fig('f', 10)}${fig('s', 210)}
    </svg>`;
  };

  const setD = (svg, key, d) => svg.querySelectorAll(`[data-p="${key}"]`).forEach((el) => el.setAttribute('d', d || ''));

  B.draw = (svg, p, ghostP, opts = {}) => {
    const g = B.geometry(p);
    const fr = g.front, sd = g.side;
    ['body', 'armR', 'armL', 'head', 'earR', 'earL', 'hairTop', 'hairBack'].forEach((k) => setD(svg, 'f-' + k, fr[k]));
    ['body', 'arm', 'ear', 'hairTop'].forEach((k) => setD(svg, 's-' + k, sd[k]));
    svg.querySelectorAll('[data-p="f-floor"]').forEach((el) => el.setAttribute('rx', f1(fr.footW + 10)));
    svg.querySelectorAll('[data-p="s-floor"]').forEach((el) => el.setAttribute('rx', f1(32 + p.belly * 8)));
    for (const [v, geo] of [['f', fr], ['s', sd]]) {
      const zg = svg.querySelector(`[data-zones="${v}"]`);
      if (zg) {
        if (zg.childElementCount !== geo.zones.length) zg.innerHTML = geo.zones.map(() => '<ellipse/>').join('');
        geo.zones.forEach((z, i) => {
          const el = zg.children[i];
          el.setAttribute('cx', f1(z.cx)); el.setAttribute('cy', f1(z.cy)); el.setAttribute('rx', f1(z.rx)); el.setAttribute('ry', f1(z.ry));
          el.setAttribute('fill', B.heat(z.v)); el.setAttribute('opacity', z.v > 0.04 && opts.heat !== false ? (0.22 + Math.min(z.v, 1.1) * 0.6).toFixed(2) : 0);
        });
      }
      const lg = svg.querySelector(`[data-lines="${v}"]`);
      if (lg) {
        if (lg.childElementCount !== geo.lines.length) lg.innerHTML = geo.lines.map(() => '<path/>').join('');
        geo.lines.forEach((l, i) => { const el = lg.children[i]; el.setAttribute('d', l.d); el.setAttribute('opacity', opts.muscles === false ? 0 : cl(l.o, 0, 1).toFixed(2)); el.setAttribute('class', l.cls); });
      }
      const gh = svg.querySelector(`[data-ghost="${v}"] path`);
      if (gh) {
        if (ghostP) { const gg = B.geometry(ghostP); gh.setAttribute('d', v === 'f' ? gg.front.body + gg.front.armL + gg.front.armR : gg.side.body); gh.parentNode.style.display = ''; }
        else gh.parentNode.style.display = 'none';
      }
    }
  };

  const lerpP = (a, b, t) => {
    const o = { ...b, zones: {} };
    for (const k of ['bmi', 'fat', 'm', 'w', 'belly', 'chest', 'hips', 'thighs', 'arms', 'shoulder', 'def']) o[k] = a[k] + (b[k] - a[k]) * t;
    for (const k in b.zones) o.zones[k] = a.zones[k] + (b.zones[k] - a.zones[k]) * t;
    return o;
  };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /** Cria um avatar animável. view: 'both' | 'front' | 'side'. */
  B.create = (host, opts = {}) => {
    const id = 'av' + ++seq;
    host.innerHTML = B.svg(id);
    const svg = host.querySelector('svg');
    const setView = (v) => {
      svg.setAttribute('viewBox', v === 'front' ? '10 0 200 440' : v === 'side' ? '210 0 200 440' : '0 0 420 440');
      svg.dataset.view = v;
    };
    setView(opts.view || 'both');
    let cur = null, raf = 0, ghost = null;
    return {
      setView,
      setOpts(o) { Object.assign(opts, o); if (cur) B.draw(svg, cur, ghost, opts); },
      to(p, g = ghost, ms = 1100) {
        ghost = g;
        cancelAnimationFrame(raf);
        if (!cur || ms === 0) { cur = p; B.draw(svg, p, ghost, opts); return; }
        const from = cur, t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          cur = lerpP(from, p, ease(t));
          B.draw(svg, cur, ghost, opts);
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
