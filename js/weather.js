/* ==========================================================
   CLIMA (Open-Meteo, grátis e sem cadastro) + RELÓGIO TELA CHEIA
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U, F = App.F;
  const st = () => App.state;
  const W = (App.Weather = {});
  const cfg = () => (st().weather = st().weather || { city: '', lat: null, lon: null, cache: null });

  // códigos WMO → ícone + texto
  const CODES = {
    0: ['☀️', 'Céu limpo', '🌙'], 1: ['🌤️', 'Poucas nuvens', '🌙'], 2: ['⛅', 'Parcialmente nublado', '☁️'], 3: ['☁️', 'Nublado'], 45: ['🌫️', 'Neblina'], 48: ['🌫️', 'Neblina com geada'],
    51: ['🌦️', 'Garoa fraca'], 53: ['🌦️', 'Garoa'], 55: ['🌧️', 'Garoa forte'], 56: ['🌧️', 'Garoa congelante'], 57: ['🌧️', 'Garoa congelante'],
    61: ['🌦️', 'Chuva fraca'], 63: ['🌧️', 'Chuva'], 65: ['🌧️', 'Chuva forte'], 66: ['🌧️', 'Chuva congelante'], 67: ['🌧️', 'Chuva congelante'],
    71: ['🌨️', 'Neve fraca'], 73: ['🌨️', 'Neve'], 75: ['❄️', 'Neve forte'], 77: ['🌨️', 'Granizo fino'], 80: ['🌦️', 'Pancadas de chuva'], 81: ['🌧️', 'Pancadas fortes'], 82: ['⛈️', 'Pancadas violentas'],
    85: ['🌨️', 'Neve'], 86: ['❄️', 'Neve forte'], 95: ['⛈️', 'Trovoadas'], 96: ['⛈️', 'Trovoadas com granizo'], 99: ['⛈️', 'Trovoadas fortes com granizo'],
  };
  W.icon = (code, isDay = 1) => { const c = CODES[code] || ['🌡️', '—']; return !isDay && c[2] ? c[2] : c[0]; };
  W.label = (code) => (CODES[code] || ['', 'Tempo'])[1];

  W.search = async (q) => {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=pt&format=json`);
    const j = await r.json(); return (j.results || []).map((x) => ({ name: x.name, admin: x.admin1 || '', country: x.country || '', lat: x.latitude, lon: x.longitude }));
  };
  W.fetch = async (force) => {
    const c = cfg(); if (c.lat == null) return null;
    if (!force && c.cache && Date.now() - c.cache.at < 30 * 60000) return c.cache.data;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max&timezone=auto&forecast_days=7`;
    try {
      const r = await fetch(url); if (!r.ok) throw new Error(r.status);
      const data = await r.json(); c.cache = { at: Date.now(), data }; App.save(); return data;
    } catch (e) { console.warn('clima', e); return c.cache ? c.cache.data : null; }
  };
  const hhmm = (iso) => (iso || '').slice(11, 16);
  const nowLocal = () => { const d = new Date(); return `${U.iso(d)}T${String(d.getHours()).padStart(2, '0')}`; }; // mesmo formato das horas do Open-Meteo (fuso local)
  const uvTxt = (u) => (u < 3 ? 'baixo' : u < 6 ? 'moderado' : u < 8 ? 'alto' : u < 11 ? 'muito alto' : 'extremo');
  W.tip = (d) => {
    const c = d.current, dl = d.daily; const out = [];
    if ((dl.precipitation_probability_max[0] || 0) >= 50) out.push('☂️ Leve guarda-chuva');
    if ((dl.uv_index_max[0] || 0) >= 8) out.push('🧴 UV muito alto: protetor solar');
    if (c.temperature_2m >= 30) out.push('💧 Calor: beba mais água');
    if (dl.temperature_2m_min[0] <= 12) out.push('🧥 Leve um agasalho');
    if (c.wind_speed_10m >= 35) out.push('💨 Vento forte');
    const run = d.hourly.time.findIndex((t, i) => t >= nowLocal() && d.hourly.precipitation_probability[i] < 20 && d.hourly.temperature_2m[i] >= 14 && d.hourly.temperature_2m[i] <= 26 && +t.slice(11, 13) >= 6 && +t.slice(11, 13) <= 20);
    if (run >= 0) out.push(`🏃 Bom horário para correr: ${hhmm(d.hourly.time[run])}`);
    return out;
  };

  /* ---------- widget do início ---------- */
  W.widget = () => {
    const c = cfg();
    if (c.lat == null) return `<div class="card"><header><h3>🌤️ Clima</h3></header>${App.empty('🌍', 'Qual é a sua cidade?', 'Configure para ver a previsão do tempo aqui.', '<button class="btn sm primary" data-act="wxSetup">Escolher cidade</button>')}</div>`;
    return `<div class="card weather-card" id="wx-card"><header><h3>🌤️ ${U.esc(c.city)}</h3><button class="btn sm ghost" data-act="wxDetail">7 dias</button></header><div id="wx-body"><p class="muted">Carregando previsão…</p></div></div>`;
  };
  W.fillWidget = async () => {
    const el = document.getElementById('wx-body'); if (!el) return;
    const d = await W.fetch(); if (!document.getElementById('wx-body')) return;
    if (!d) { el.innerHTML = '<p class="muted">Sem conexão para buscar a previsão agora.</p>'; return; }
    const c = d.current, dl = d.daily, tips = W.tip(d);
    el.innerHTML = `<div class="wx-now"><span class="wx-big">${W.icon(c.weather_code, c.is_day)}</span><div><div class="wx-temp">${Math.round(c.temperature_2m)}°</div><div class="muted">${W.label(c.weather_code)} · sensação ${Math.round(c.apparent_temperature)}°</div></div>
      <div class="wx-mm"><b>${Math.round(dl.temperature_2m_max[0])}°</b><small>${Math.round(dl.temperature_2m_min[0])}°</small></div></div>
      <div class="wx-row"><span>💧 ${c.relative_humidity_2m}%</span><span>☔ ${dl.precipitation_probability_max[0] ?? 0}%</span><span>💨 ${Math.round(c.wind_speed_10m)} km/h</span><span>🌅 ${hhmm(dl.sunrise[0])}</span><span>🌇 ${hhmm(dl.sunset[0])}</span></div>
      <div class="wx-days">${dl.time.slice(1, 6).map((t, i) => `<div><small>${U.DAY3[U.parseISO(t).getDay()]}</small><span>${W.icon(dl.weather_code[i + 1])}</span><b>${Math.round(dl.temperature_2m_max[i + 1])}°</b><small>${Math.round(dl.temperature_2m_min[i + 1])}°</small></div>`).join('')}</div>
      ${tips.length ? `<div class="row mt">${tips.map((t) => `<span class="chip">${t}</span>`).join('')}</div>` : ''}`;
  };

  W.detail = async () => {
    const d = await W.fetch(); if (!d) return App.toast('Sem conexão para buscar a previsão.', 'error');
    const dl = d.daily, now = nowLocal();
    const start = Math.max(0, d.hourly.time.findIndex((t) => t >= now));
    const hrs = d.hourly.time.slice(start, start + 24).map((t, i) => ({ t, temp: d.hourly.temperature_2m[start + i], p: d.hourly.precipitation_probability[start + i], code: d.hourly.weather_code[start + i], day: d.hourly.is_day[start + i] }));
    App.modal({
      title: `🌤️ Previsão — ${U.esc(cfg().city)}`, wide: true, hideFooter: true,
      body: `<div class="wx-hours">${hrs.map((h) => `<div><small>${hhmm(h.t)}</small><span>${W.icon(h.code, h.day)}</span><b>${Math.round(h.temp)}°</b><small class="${h.p >= 50 ? 'rain' : ''}">☔${h.p}%</small></div>`).join('')}</div>
        <div class="chart-box sm mt"><canvas id="wx-chart"></canvas></div>
        <div class="table-wrap mt"><table><thead><tr><th>Dia</th><th></th><th class="r">Máx</th><th class="r">Mín</th><th class="r">Chuva</th><th class="r">UV</th><th class="r">Sol</th></tr></thead><tbody>
        ${dl.time.map((t, i) => `<tr><td>${i ? U.dateNice(t) : 'Hoje'}</td><td>${W.icon(dl.weather_code[i])} ${W.label(dl.weather_code[i])}</td><td class="r"><b>${Math.round(dl.temperature_2m_max[i])}°</b></td><td class="r">${Math.round(dl.temperature_2m_min[i])}°</td><td class="r">${dl.precipitation_probability_max[i] ?? 0}% · ${U.fmt(dl.precipitation_sum[i] || 0, 1)} mm</td><td class="r">${Math.round(dl.uv_index_max[i] || 0)} <small>${uvTxt(dl.uv_index_max[i] || 0)}</small></td><td class="r"><small>${hhmm(dl.sunrise[i])}–${hhmm(dl.sunset[i])}</small></td></tr>`).join('')}</tbody></table></div>
        <p class="muted"><small>Dados: Open-Meteo · atualizado ${new Date(cfg().cache.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · <a href="#" data-mact="change">trocar cidade</a></small></p>`,
      actions: { change: (_, __, close, e) => { e.preventDefault(); close(); W.setup(); } },
      onMount: () => setTimeout(() => App.chart(document.getElementById('wx-chart'), { type: 'line', data: { labels: hrs.map((h) => hhmm(h.t)), datasets: [{ label: 'Temperatura', data: hrs.map((h) => h.temp), borderColor: '#f97316', tension: .35, yAxisID: 'y' }, { label: 'Chuva %', data: hrs.map((h) => h.p), type: 'bar', backgroundColor: App.alpha('#38bdf8', .5), yAxisID: 'y2' }] }, options: { scales: { y2: { position: 'right', max: 100, grid: { display: false } } } } }), 50),
    });
  };

  W.setup = () => {
    let found = [];
    App.modal({
      title: '🌍 Sua cidade', submitLabel: 'Usar esta cidade',
      body: `<div class="inline-form">${F.text('Cidade', 'q', cfg().city || '', 'placeholder="Digite e busque…"')}<button type="button" class="btn" data-mact="find">🔎 Buscar</button><button type="button" class="btn" data-mact="geo">📍 Minha localização</button></div>
        <div id="wx-res" class="list mt"></div><input type="hidden" name="pick" value="">`,
      actions: {
        find: async (_, form) => {
          const box = form.querySelector('#wx-res'); box.innerHTML = '<p class="muted">Buscando…</p>';
          try { found = await W.search(form.q.value); } catch (e) { box.innerHTML = '<p class="muted">Sem conexão.</p>'; return; }
          box.innerHTML = found.length ? found.map((x, i) => `<label class="li" style="cursor:pointer"><input type="radio" name="pickr" value="${i}" ${i ? '' : 'checked'}><div class="grow"><div class="t">${U.esc(x.name)}</div><div class="s">${U.esc([x.admin, x.country].filter(Boolean).join(' · '))}</div></div></label>`).join('') : '<p class="muted">Nenhuma cidade encontrada.</p>';
        },
        geo: (_, form) => {
          if (!navigator.geolocation) return App.toast('Localização indisponível.', 'error');
          navigator.geolocation.getCurrentPosition((p) => { found = [{ name: 'Minha localização', admin: '', country: '', lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) }]; form.querySelector('#wx-res').innerHTML = '<label class="li"><input type="radio" name="pickr" value="0" checked><div class="grow"><div class="t">📍 Minha localização</div></div></label>'; }, () => App.toast('Não foi possível obter a localização.', 'error'));
        },
      },
      onMount: (form) => form.q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); form.querySelector('[data-mact=find]').click(); } }),
      onSubmit: (d) => {
        const x = found[+d.pickr]; if (!x) { App.toast('Busque e escolha uma cidade.', 'error'); return false; }
        Object.assign(cfg(), { city: x.name, lat: x.lat, lon: x.lon, cache: null }); App.save(); App.rerender();
      },
    });
  };

  /* ==========================================================
     RELÓGIO EM TELA CHEIA (mantém a tela acordada)
     ========================================================== */
  const C = (App.Clock = { el: null, iv: null, lock: null });
  const pad = (n) => String(n).padStart(2, '0');
  C.open = async () => {
    if (C.el) return;
    const el = document.createElement('div'); el.id = 'clock'; C.el = el;
    const s = st().settings;
    el.innerHTML = `<div class="clk-top"><span id="clk-wx"></span><span class="clk-btns"><button class="icon-btn" id="clk-24" title="12/24h">${s.clock12 ? '12h' : '24h'}</button><button class="icon-btn" id="clk-sec" title="segundos">⏱️</button><button class="icon-btn" id="clk-fs" title="tela cheia">⛶</button><button class="icon-btn" id="clk-x" title="fechar (Esc)">✕</button></span></div>
      <div class="clk-mid"><div class="clk-time"><span id="clk-hm">--:--</span><span id="clk-s" class="clk-s">:--</span><small id="clk-ap"></small></div><div class="clk-date" id="clk-date"></div>
        <div class="clk-bar"><i id="clk-dayprog"></i></div></div>
      <div class="clk-bottom" id="clk-next"></div><div class="clk-lock" id="clk-lock"></div>`;
    document.body.appendChild(el);
    const tick = () => {
      const d = new Date(); let h = d.getHours(); let ap = '';
      if (s.clock12) { ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; }
      el.querySelector('#clk-hm').textContent = `${pad(h)}:${pad(d.getMinutes())}`;
      el.querySelector('#clk-s').textContent = s.clockNoSec ? '' : `:${pad(d.getSeconds())}`;
      el.querySelector('#clk-ap').textContent = ap;
      el.querySelector('#clk-date').textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, (x) => x.toUpperCase());
      el.querySelector('#clk-dayprog').style.width = ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 864) + '%';
    };
    tick(); C.iv = setInterval(tick, 1000);
    // próximos compromissos e tarefas
    const up = App.Agenda.upcoming(2).filter((o) => !o.done).slice(0, 3);
    const tasks = (st().tasks || []).filter((t) => !t.done && t.due && t.due <= U.today()).slice(0, 2);
    el.querySelector('#clk-next').innerHTML = [...up.map((o) => `<span>${App.Agenda.type(o.type).icon} ${U.esc(o.title)} · ${U.relDays(o.date)}${o.time ? ' ' + o.time : ''}</span>`), ...tasks.map((t) => `<span>✅ ${U.esc(t.title)}</span>`)].join('');
    // clima
    if (cfg().lat != null) W.fetch().then((d) => { if (d && C.el) C.el.querySelector('#clk-wx').innerHTML = `${W.icon(d.current.weather_code, d.current.is_day)} ${Math.round(d.current.temperature_2m)}° <small>${U.esc(cfg().city)} · ${W.label(d.current.weather_code)}</small>`; });
    // manter a tela acordada
    const keep = async () => { try { if ('wakeLock' in navigator && document.visibilityState === 'visible') { C.lock = await navigator.wakeLock.request('screen'); el.querySelector('#clk-lock').textContent = '☀️ tela sempre acesa'; } } catch (e) { el.querySelector('#clk-lock').textContent = ''; } };
    keep(); C.vis = () => C.el && keep(); document.addEventListener('visibilitychange', C.vis);
    el.querySelector('#clk-x').onclick = C.close;
    el.querySelector('#clk-fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen().catch(() => {}));
    el.querySelector('#clk-24').onclick = (e) => { s.clock12 = !s.clock12; e.target.textContent = s.clock12 ? '12h' : '24h'; App.save(); tick(); };
    el.querySelector('#clk-sec').onclick = () => { s.clockNoSec = !s.clockNoSec; App.save(); tick(); };
    C.key = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) C.close(); };
    document.addEventListener('keydown', C.key);
    el.requestFullscreen && el.requestFullscreen().catch(() => {});
  };
  C.close = () => {
    if (!C.el) return;
    clearInterval(C.iv); try { C.lock && C.lock.release(); } catch (e) { /* */ }
    document.removeEventListener('visibilitychange', C.vis); document.removeEventListener('keydown', C.key);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    C.el.remove(); C.el = null;
  };

  App.globalActions.wxSetup = () => W.setup();
  App.globalActions.wxDetail = () => W.detail();
  App.globalActions.clock = () => C.open();
})(window.App);
