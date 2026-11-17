/* ==========================================================
   ARMAZENAMENTO — onde seus dados ficam
   • pendrive  : aberto pelo programa portátil (VidaOS-Windows.exe…)
                 → tudo é gravado na pasta "dados" do pendrive
   • pasta     : Chrome/Edge gravando direto numa pasta escolhida
   • navegador : localStorage/IndexedDB deste navegador
   Opcional: senha com criptografia AES‑256‑GCM (PBKDF2 310 mil iterações).
   ========================================================== */
(function (App) {
  'use strict';
  const U = App.U;
  const LS_KEY = 'vidaos.state.v1';
  const MAGIC = new TextEncoder().encode('VOSENC1');
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const startsWith = (u8, pre) => u8 && u8.length >= pre.length && pre.every((b, i) => u8[i] === b);

  /* ---------- criptografia ---------- */
  const Crypto = {
    key: null,
    /** v1: PBKDF2(senha). v2 (estilo KeePassXC): PBKDF2( SHA256( SHA256(senha) || SHA256(arquivo-chave) ) ). */
    async composite(pass, keyfile) {
      const h = async (u8) => new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
      const parts = [await h(te.encode(pass))];
      if (keyfile) parts.push(await h(keyfile));
      const all = new Uint8Array(parts.length * 32); parts.forEach((p, i) => all.set(p, i * 32));
      return h(all);
    },
    async derive(pass, salt, iterations, vault, keyfile) {
      const material = vault && vault.v >= 2 ? await Crypto.composite(pass, keyfile) : te.encode(pass);
      const base = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    },
    async enc(u8, key = Crypto.key) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, u8));
      const out = new Uint8Array(MAGIC.length + 12 + c.length); out.set(MAGIC); out.set(iv, MAGIC.length); out.set(c, MAGIC.length + 12); return out;
    },
    async dec(u8, key = Crypto.key) {
      if (!startsWith(u8, MAGIC)) return u8;
      if (!key) throw new Error('bloqueado');
      const o = MAGIC.length;
      return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.subarray(o, o + 12) }, key, u8.subarray(o + 12)));
    },
  };

  /* ---------- pacote de arquivo: [4 bytes tamanho meta][meta JSON][bytes] ---------- */
  const pack = async (blob, meta) => {
    const m = te.encode(JSON.stringify(meta)); const data = new Uint8Array(await blob.arrayBuffer());
    const out = new Uint8Array(4 + m.length + data.length); new DataView(out.buffer).setUint32(0, m.length); out.set(m, 4); out.set(data, 4 + m.length); return out;
  };
  const unpack = (u8) => {
    const n = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0);
    const meta = JSON.parse(td.decode(u8.subarray(4, 4 + n)));
    return { ...meta, blob: new Blob([u8.subarray(4 + n)], { type: meta.type || '' }) };
  };

  /* ==========================================================
     BACKENDS (bytes)
     ========================================================== */
  // --- programa portátil (servidor local no pendrive) ---
  const serverBackend = (token) => {
    const H = { 'X-Token': token };
    const req = async (method, path, body) => {
      const r = await fetch(path, { method, headers: H, body, cache: 'no-store', keepalive: method === 'PUT' && body && body.byteLength < 60000 });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      return r;
    };
    return {
      kind: 'pendrive', label: '💾 Pendrive', token,
      async info() { const r = await req('GET', '/api/info'); return r ? r.json() : null; },
      async read(name) { const r = await req('GET', '/api/data/' + name); if (r && name === 'estado.json') S.version = r.headers.get('X-Version'); return r ? new Uint8Array(await r.arrayBuffer()) : null; },
      async write(name, u8) {
        if (name !== 'estado.json') return void (await req('PUT', '/api/data/' + name, u8));
        // envia a versão em que se baseou; se outro aparelho salvou antes, o servidor responde 409
        const h = { ...H }; if (S.version) h['X-Base-Version'] = S.version;
        const r = await fetch('/api/data/estado.json', { method: 'PUT', headers: h, body: u8, cache: 'no-store' });
        if (r.status === 409) { const e = new Error('conflito'); e.conflict = true; throw e; }
        if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
        S.version = r.headers.get('X-Version') || S.version;
      },
      async version() { const r = await req('GET', '/api/version'); return r ? String((await r.json()).v) : null; },
      async lan(method = 'GET') { const r = await req(method, '/api/lan'); return r ? r.json() : null; },
      async remove(name) { await req('DELETE', '/api/data/' + name); },
      async fread(id) { const r = await req('GET', '/api/files/' + id); return r ? new Uint8Array(await r.arrayBuffer()) : null; },
      async fwrite(id, u8) { await req('PUT', '/api/files/' + id, u8); },
      async fdel(id) { await req('DELETE', '/api/files/' + id); },
      async flist() { const r = await req('GET', '/api/files'); return r ? r.json() : []; },
      ping() { fetch('/api/ping', { method: 'POST', headers: H }).catch(() => {}); },
      bye() { try { navigator.sendBeacon('/api/bye?t=' + encodeURIComponent(token)); } catch (e) { /* */ } },
      async quit() { await fetch('/api/quit', { method: 'POST', headers: H }).catch(() => {}); },
    };
  };

  // --- pasta escolhida (File System Access API — Chrome/Edge) ---
  const folderBackend = (dir) => {
    const sub = async () => dir.getDirectoryHandle('arquivos', { create: true });
    const rd = async (d, name) => { try { const h = await d.getFileHandle(name); return new Uint8Array(await (await h.getFile()).arrayBuffer()); } catch (e) { if (e.name === 'NotFoundError') return null; throw e; } };
    const wr = async (d, name, u8) => { const h = await d.getFileHandle(name, { create: true }); const w = await h.createWritable(); await w.write(u8); await w.close(); };
    const rm = async (d, name) => { try { await d.removeEntry(name); } catch (e) { /* já não existe */ } };
    return {
      kind: 'pasta', label: '📁 Pasta', dir,
      async info() { return { dir: dir.name }; },
      read: (n) => rd(dir, n), write: (n, u8) => wr(dir, n, u8), remove: (n) => rm(dir, n),
      fread: async (id) => rd(await sub(), id), fwrite: async (id, u8) => wr(await sub(), id, u8), fdel: async (id) => rm(await sub(), id),
      async flist() { const out = []; for await (const [name, h] of (await sub()).entries()) if (h.kind === 'file' && !name.startsWith('.')) out.push(name); return out; },
    };
  };

  // --- IndexedDB auxiliar (arquivos do modo navegador + identificador da pasta) ---
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('vidaos-files', 2);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('files')) r.result.createObjectStore('files', { keyPath: 'id' }); if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const idb = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const r = fn(t.objectStore(store)); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };

  /* ==========================================================
     API PÚBLICA
     ========================================================== */
  const S = (App.storage = { backend: null, vault: null, status: 'saved', lastSave: null, info: null });
  S.isRemote = () => S.backend && S.backend.kind !== 'navegador';

  /* estado */
  S.loadState = async () => {
    if (!S.isRemote()) { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }
    const u8 = await S.backend.read('estado.json');
    if (!u8) return null;
    return JSON.parse(td.decode(await Crypto.dec(u8)));
  };
  let pending = null, saving = false, again = false;
  const setStatus = (s) => { S.status = s; App.renderStorageBadge && App.renderStorageBadge(); };
  S.saveState = async (state) => {
    if (!S.isRemote()) { localStorage.setItem(LS_KEY, JSON.stringify(state)); S.lastSave = new Date(); setStatus('saved'); return; }
    if (saving) { again = true; return; }
    saving = true; setStatus('saving');
    try {
      let u8 = te.encode(JSON.stringify(state));
      if (S.vault) u8 = await Crypto.enc(u8);
      try { await S.backend.write('estado.json', u8); }
      catch (e) {
        if (!e.conflict) throw e;
        // outro aparelho salvou junto: junta as duas versões e grava de novo
        const remote = await S.loadState();
        App.load(mergeStates(remote, App.state));
        let u = te.encode(JSON.stringify(App.state)); if (S.vault) u = await Crypto.enc(u);
        await S.backend.write('estado.json', u);
        App.rerender(); App.toast('🔄 Juntei suas mudanças com as do outro aparelho');
      }
      S.lastSave = new Date(); setStatus('saved');
    } catch (e) { console.error(e); setStatus('error'); App.toast('⚠️ Não consegui salvar no ' + S.backend.label.replace(/^\S+\s/, '') + '. O pendrive foi removido?', 'error'); }
    saving = false;
    if (again) { again = false; S.saveState(App.state); }
  };
  /** junta dois estados: itens (com id) dos dois lados ficam; quando existem nos dois, vale o deste aparelho */
  function mergeStates(remote, local) {
    if (!remote) return local;
    const out = { ...remote };
    for (const k of Object.keys(local)) {
      const a = remote[k], b = local[k];
      if (Array.isArray(a) && Array.isArray(b) && b.every((x) => x && typeof x === 'object' && 'id' in x)) {
        const map = new Map(a.filter((x) => x && x.id != null).map((x) => [x.id, x]));
        for (const x of b) map.set(x.id, x);
        out[k] = [...map.values()];
      } else out[k] = b;
    }
    return out;
  }
  S.mergeStates = mergeStates;
  /** outro aparelho (celular ↔ PC) salvou? recarrega quando não houver nada pendente aqui */
  S.watchRemote = () => {
    if (!S.backend || !S.backend.version) return;
    setInterval(async () => {
      if (S.hasPending() || document.querySelector('.modal-wrap') || document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      try {
        const v = await S.backend.version();
        if (v && S.version && v !== S.version) {
          const st = await S.loadState(); if (!st) return;
          App.load(st); App.applyTheme(); App.rerender(); App.toast('🔄 Atualizado com as mudanças do outro aparelho');
        }
      } catch (e) { /* PC desligado ou sem rede */ }
    }, 3000);
  };
  S.flush = async () => { if (pending) { clearTimeout(pending); pending = null; } await S.saveState(App.state); };
  S.scheduleSave = () => { setStatus(S.isRemote() ? 'saving' : 'saved'); clearTimeout(pending); pending = setTimeout(() => { pending = null; S.saveState(App.state); }, S.isRemote() ? 600 : 250); };
  S.hasPending = () => !!pending || saving;

  /* arquivos */
  S.files = {
    async put(file, id = U.uid()) {
      const meta = { id, name: file.name || id, type: file.type || '', size: file.size };
      if (!S.isRemote()) { await idb('files', 'readwrite', (st) => st.put({ ...meta, blob: file })); return id; }
      let u8 = await pack(file, meta);
      if (S.vault) u8 = await Crypto.enc(u8);
      await S.backend.fwrite(id, u8); return id;
    },
    async get(id) {
      if (!S.isRemote()) return idb('files', 'readonly', (st) => st.get(id));
      const u8 = await S.backend.fread(id); if (!u8) return null;
      return unpack(await Crypto.dec(u8));
    },
    async del(id) { if (!S.isRemote()) return idb('files', 'readwrite', (st) => st.delete(id)); return S.backend.fdel(id); },
    async ids() { if (!S.isRemote()) return (await idb('files', 'readonly', (st) => st.getAllKeys())) || []; return S.backend.flist(); },
    async all() { const out = []; for (const id of await S.files.ids()) { const f = await S.files.get(id); if (f) out.push({ id, ...f }); } return out; },
  };

  /* ---------- cofre (senha) ---------- */
  const ITER = 600000; // recomendação OWASP para PBKDF2-SHA256
  S.loadVault = async () => { const u8 = await S.backend.read('cofre.json'); S.vault = u8 ? JSON.parse(td.decode(u8)) : null; return S.vault; };
  S.unlock = async (pass, keyfile) => {
    const v = S.vault; const key = await Crypto.derive(pass, unb64(v.salt), v.iter, v, keyfile);
    try { const ok = td.decode(await Crypto.dec(unb64(v.check), key)); if (ok !== 'vidaos-ok') return false; } catch (e) { return false; }
    Crypto.key = key; return true;
  };
  /** Regrava estado + todos os arquivos com a nova chave (ou sem chave). */
  const reencrypt = async (newKey, newVault, progress) => {
    const ids = await S.files.ids();
    const items = [];
    for (const id of ids) items.push([id, await S.backend.fread(id)]);
    const oldKey = Crypto.key;
    let i = 0;
    for (const [id, raw] of items) {
      const plain = await Crypto.dec(raw, oldKey);
      await S.backend.fwrite(id, newKey ? await Crypto.enc(plain, newKey) : plain);
      progress && progress(++i, items.length);
    }
    Crypto.key = newKey; S.vault = newVault;
    if (newVault) await S.backend.write('cofre.json', te.encode(JSON.stringify(newVault))); else await S.backend.remove('cofre.json');
    await S.saveState(App.state);
  };
  S.setPassword = async (pass, progress, keyfile) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const meta = { v: 2, kdf: 'PBKDF2-SHA256', iter: ITER, keyfile: !!keyfile };
    const key = await Crypto.derive(pass, salt, ITER, meta, keyfile);
    const vault = { ...meta, salt: b64(salt), check: b64(await Crypto.enc(te.encode('vidaos-ok'), key)) };
    await reencrypt(key, vault, progress);
  };
  S.removePassword = (progress) => reencrypt(null, null, progress);
  S.lock = () => { Crypto.key = null; location.reload(); };
  /** Gera um arquivo-chave aleatório (512 bits) e baixa. */
  S.newKeyFile = () => {
    const rnd = crypto.getRandomValues(new Uint8Array(64));
    const body = `VIDAOS-ARQUIVO-CHAVE v1\nGuarde este arquivo FORA do pendrive (celular, nuvem, outro pendrive).\nSem ele, junto com a senha, os dados nao abrem.\n${b64(rnd)}\n`;
    const bytes = te.encode(body);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' })); a.download = 'vidaos.chave'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return bytes;
  };
  S.strength = (p) => {
    if (!p) return { score: 0, label: '', color: 'var(--line)' };
    let bits = 0; const pool = (/[a-z]/.test(p) ? 26 : 0) + (/[A-Z]/.test(p) ? 26 : 0) + (/\d/.test(p) ? 10 : 0) + (/[^a-zA-Z0-9]/.test(p) ? 33 : 0);
    bits = p.length * Math.log2(Math.max(pool, 2));
    if (/^(123|abc|qwe|senha|password|admin)/i.test(p) || /(.)\1{3,}/.test(p)) bits *= 0.5;
    const score = bits < 35 ? 1 : bits < 55 ? 2 : bits < 75 ? 3 : 4;
    return { score, bits: Math.round(bits), label: ['', 'Fraca', 'Razoável', 'Forte', 'Muito forte'][score], color: ['var(--line)', 'var(--bad)', 'var(--warn)', '#84cc16', 'var(--ok)'][score] };
  };

  /* ---------- migração: copiar tudo de um backend para outro ---------- */
  S.copyTo = async (target, progress) => {
    const files = await S.files.all();
    const prevB = S.backend, prevV = S.vault, prevK = Crypto.key;
    S.backend = target; S.vault = null; Crypto.key = null;
    try {
      await target.write('estado.json', te.encode(JSON.stringify(App.state)));
      let i = 0; for (const f of files) { await S.files.put(new File([f.blob], f.name, { type: f.type }), f.id); progress && progress(++i, files.length); }
    } finally { S.backend = prevB; S.vault = prevV; Crypto.key = prevK; }
  };

  /* ---------- pasta (File System Access) ---------- */
  S.folderSupported = () => 'showDirectoryPicker' in window;
  S.pickFolder = async () => {
    const dir = await window.showDirectoryPicker({ id: 'vidaos', mode: 'readwrite' });
    await idb('kv', 'readwrite', (st) => st.put(dir, 'folder'));
    return folderBackend(dir);
  };
  S.useFolder = async (b) => { localStorage.setItem('vidaos.backend', 'pasta'); S.backend = b; };
  S.useBrowser = () => { localStorage.removeItem('vidaos.backend'); location.reload(); };

  /* ==========================================================
     TELA DE ENTRADA (conectar pasta / desbloquear)
     ========================================================== */
  const gate = (html) => new Promise((resolve) => {
    let g = document.getElementById('gate');
    if (!g) { g = document.createElement('div'); g.id = 'gate'; document.body.appendChild(g); }
    g.innerHTML = `<div class="gate-box"><div class="logo big">V</div>${html}</div>`;
    g.style.display = 'grid';
    resolve(g);
  });
  const closeGate = () => { const g = document.getElementById('gate'); if (g) g.style.display = 'none'; };
  S.gate = gate; S.closeGate = closeGate;

  const askPassword = async () => {
    const g = await gate(`<h2>Cofre protegido 🔒</h2><p class="muted">${S.backend.label} · seus dados estão criptografados.</p>
      <form id="unlock"><div class="pw-wrap"><input type="password" id="pw" placeholder="Senha-mestra" autocomplete="current-password" autofocus><button type="button" class="icon-btn" id="pw-eye" title="mostrar/ocultar">👁️</button></div>
        ${S.vault.keyfile ? '<label class="drop mt" style="padding:12px"><input type="file" id="kf"><b id="kf-name">🔑 Escolher arquivo-chave</b><small>este cofre também exige o arquivo-chave</small></label>' : ''}
        <button class="btn primary block mt">Desbloquear</button><p class="err" id="pw-err"></p></form>
      <button type="button" class="btn block mt em-lock-btn" id="em-btn" style="display:none">🆘 Ficha de emergência</button>`);
    return new Promise((resolve) => {
      const f = g.querySelector('#unlock'); const pw = g.querySelector('#pw'); setTimeout(() => pw.focus(), 50);
      S.backend.read('emergencia.json').then((u8) => { if (!u8) return; const data = JSON.parse(td.decode(u8)); const b = g.querySelector('#em-btn'); b.style.display = ''; b.onclick = () => App.Emergency.full(data.card, data.prof || {}); }).catch(() => {});
      g.querySelector('#pw-eye').onclick = () => { pw.type = pw.type === 'password' ? 'text' : 'password'; pw.focus(); };
      const kf = g.querySelector('#kf'); if (kf) kf.onchange = () => { g.querySelector('#kf-name').textContent = '🔑 ' + (kf.files[0] ? kf.files[0].name : 'Escolher arquivo-chave'); };
      f.onsubmit = async (e) => {
        e.preventDefault(); const btn = f.querySelector('button.primary');
        if (kf && !kf.files[0]) { g.querySelector('#pw-err').textContent = 'Escolha o arquivo-chave.'; return; }
        btn.disabled = true; btn.textContent = 'Verificando…';
        const keyBytes = kf ? new Uint8Array(await kf.files[0].arrayBuffer()) : null;
        const ok = await S.unlock(pw.value, keyBytes);
        if (ok) { closeGate(); resolve(); } else { g.querySelector('#pw-err').textContent = kf ? 'Senha ou arquivo-chave incorretos.' : 'Senha incorreta.'; btn.disabled = false; btn.textContent = 'Desbloquear'; pw.select(); }
      };
    });
  };

  const connectFolder = async (handle) => {
    const g = await gate(`<h2>Conectar seus dados 📁</h2><p class="muted">Este navegador está configurado para usar uma pasta${handle ? ` (<b>${U.esc(handle.name)}</b>)` : ''} — por exemplo, no seu pendrive.</p>
      ${handle ? '<button class="btn primary block" id="g-reopen">🔓 Permitir acesso à pasta</button>' : ''}
      <button class="btn block mt" id="g-pick">📂 Escolher outra pasta</button>
      <button class="btn ghost block mt" id="g-local">Usar os dados deste navegador</button><p class="err" id="g-err"></p>`);
    return new Promise((resolve) => {
      const done = (b) => { S.backend = b; closeGate(); resolve(); };
      const r = g.querySelector('#g-reopen');
      if (r) r.onclick = async () => { try { if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') done(folderBackend(handle)); } catch (e) { g.querySelector('#g-err').textContent = 'Pasta não encontrada. O pendrive está conectado?'; } };
      g.querySelector('#g-pick').onclick = async () => { try { done(await S.pickFolder()); } catch (e) { /* cancelado */ } };
      g.querySelector('#g-local').onclick = () => { localStorage.removeItem('vidaos.backend'); S.backend = { kind: 'navegador', label: '🌐 Navegador' }; closeGate(); resolve(); };
    });
  };

  /** Decide o backend, desbloqueia se precisar e devolve o estado salvo. */
  S.init = async () => {
    const url = new URL(location.href);
    let token = url.searchParams.get('t');
    if (token) { sessionStorage.setItem('vidaos.token', token); url.searchParams.delete('t'); history.replaceState(null, '', url.pathname + url.search + url.hash); }
    else token = sessionStorage.getItem('vidaos.token');
    if (token && location.protocol.startsWith('http')) {
      const b = serverBackend(token);
      try { S.info = await b.info(); if (S.info) S.backend = b; } catch (e) { console.warn('servidor portátil indisponível', e); }
      if (S.backend) {
        b.ping(); setInterval(() => b.ping(), 10000);
        if (S.info.remote) { b.label = '📱 Celular → PC'; b.kind = 'pendrive'; }
        window.addEventListener('pagehide', () => { if (S.hasPending()) S.saveState(App.state); b.bye(); });
      }
    }
    if (!S.backend && localStorage.getItem('vidaos.backend') === 'pasta' && S.folderSupported()) {
      let h = null; try { h = await idb('kv', 'readonly', (st) => st.get('folder')); } catch (e) { /* */ }
      let ok = false; try { ok = h && (await h.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { /* */ }
      if (ok) S.backend = folderBackend(h); else await connectFolder(h);
    }
    if (!S.backend) S.backend = { kind: 'navegador', label: '🌐 Navegador' };
    if (S.isRemote()) {
      await S.loadVault();
      if (S.vault) await askPassword();
      if (S.backend.kind === 'pasta') S.info = { dir: S.backend.dir.name };
    }
    window.addEventListener('beforeunload', (e) => { if (S.isRemote() && S.hasPending()) { S.flush(); e.preventDefault(); e.returnValue = ''; } });
    return S.loadState();
  };
})(window.App);
