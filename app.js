/* =====================================================================
 * KeuanganKu — Personal Finance & Debt Tracker (PWA, iOS-style)
 * Vanilla JS, tanpa dependensi runtime. Data: IndexedDB (fallback LocalStorage).
 *
 * Susunan modul (satu file, dipisah per bagian):
 *   1. Helpers      — format Rupiah/tanggal, escape, ikon
 *   2. Storage      — IndexedDB + fallback LocalStorage
 *   3. State        — data di memori + operasi put/del
 *   4. Calc         — saldo, utang/piutang, ringkasan bulanan, budget
 *   5. UI kit       — sheet, dialog, toast, input Rupiah
 *   6. Views        — Beranda, Transaksi, Utang, Anggaran, Lainnya
 *   7. Forms        — transaksi, dompet, utang, cicilan, budget
 *   8. Data         — backup/restore JSON, CSV, cetak laporan
 *   9. Actions & boot
 * ===================================================================== */
(() => {
  'use strict';

  /* ==================================================================
   * 1. HELPERS
   * ================================================================== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () =>
    (self.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = (arr, fn = (x) => x) => arr.reduce((a, b) => a + fn(b), 0);

  const nf = new Intl.NumberFormat('id-ID');
  const fmtNum = (n) => nf.format(Math.round(n));
  const rp = (n) => (n < 0 ? '-' : '') + 'Rp ' + nf.format(Math.abs(Math.round(n)));

  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => toISO(new Date());
  const parseISO = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const fmtDate = (s) => parseISO(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const monthLabel = (k) => {
    const [y, m] = k.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };
  const shiftMonth = (k, delta) => {
    const [y, m] = k.split('-').map(Number);
    return toISO(new Date(y, m - 1 + delta, 1)).slice(0, 7);
  };
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
  const dayLabel = (s) => {
    const diff = daysBetween(today(), s);
    if (diff === 0) return 'Hari ini';
    if (diff === -1) return 'Kemarin';
    return parseISO(s).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  };
  const isIOS = () =>
    /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Ikon bergaya SF Symbols (stroke), 24x24
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    more: '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1" fill="currentColor"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
    upload: '<path d="M12 20V9m0 0-4 4m4-4 4 4M5 4h14"/>',
    printer: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/>',
    arrowUp: '<path d="M12 19V5m0 0-6 6m6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14m0 0 6-6m-6 6-6-6"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    table: '<path d="M3 5h18v14H3zM3 10h18M9 5v14"/>',
  };
  const ic = (name, cls = 'h-6 w-6') =>
    `<svg viewBox="0 0 24 24" class="${cls}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ==================================================================
   * 2. STORAGE  (IndexedDB, fallback LocalStorage)
   * ================================================================== */
  const STORES = ['wallets', 'transactions', 'debts', 'budgets', 'meta'];

  const IDB = {
    db: null,
    open() {
      return new Promise((resolve, reject) => {
        if (!self.indexedDB) return reject(new Error('IndexedDB tidak tersedia'));
        const req = indexedDB.open('keuanganku', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          STORES.forEach((s) => {
            if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
          });
        };
        req.onsuccess = () => {
          this.db = req.result;
          resolve();
        };
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB terblokir'));
      });
    },
    run(stores, mode, fn) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(stores, mode);
        let result;
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('Transaksi database gagal'));
        result = fn(tx);
      });
    },
    async getAll(store) {
      let req;
      await this.run(store, 'readonly', (tx) => {
        req = tx.objectStore(store).getAll();
      });
      return req.result;
    },
    put(store, obj) {
      return this.run(store, 'readwrite', (tx) => {
        tx.objectStore(store).put(obj);
      });
    },
    del(store, id) {
      return this.run(store, 'readwrite', (tx) => {
        tx.objectStore(store).delete(id);
      });
    },
    replaceAll(data) {
      return this.run(STORES, 'readwrite', (tx) => {
        STORES.forEach((s) => {
          const os = tx.objectStore(s);
          os.clear();
          (data[s] || []).forEach((o) => os.put(o));
        });
      });
    },
  };

  const LS = {
    key: 'keuanganku-db',
    read() {
      try {
        return JSON.parse(localStorage.getItem(this.key)) || {};
      } catch {
        return {};
      }
    },
    write(d) {
      localStorage.setItem(this.key, JSON.stringify(d));
    },
    async open() {
      localStorage.getItem(this.key);
    },
    async getAll(s) {
      return this.read()[s] || [];
    },
    async put(s, o) {
      const d = this.read();
      d[s] = d[s] || [];
      const i = d[s].findIndex((x) => x.id === o.id);
      if (i >= 0) d[s][i] = o;
      else d[s].push(o);
      this.write(d);
    },
    async del(s, id) {
      const d = this.read();
      d[s] = (d[s] || []).filter((x) => x.id !== id);
      this.write(d);
    },
    async replaceAll(data) {
      const d = {};
      STORES.forEach((s) => (d[s] = data[s] || []));
      this.write(d);
    },
  };

  let Store = IDB;

  /* ==================================================================
   * 3. STATE
   * ================================================================== */
  const DEFAULT_SETTINGS = { theme: 'auto', customCats: { expense: [], income: [] } };
  const S = {
    wallets: [],
    transactions: [],
    debts: [],
    budgets: [],
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  };
  const ui = {
    route: 'home',
    month: today().slice(0, 7),
    debtTab: 'debt',
    filters: { q: '', from: '', to: '', wallet: '', cat: '', type: '' },
    txLimit: 100,
    lastWallet: null,
  };

  const WTYPES = {
    cash: { label: 'Kas Tunai', emoji: '💵', color: '#34c759' },
    bank: { label: 'Bank', emoji: '🏦', color: '#007aff' },
    ewallet: { label: 'E-Wallet', emoji: '📱', color: '#af52de' },
    invest: { label: 'Investasi', emoji: '📈', color: '#ff9500' },
  };
  const DEFAULT_CATS = {
    expense: ['Makanan & Minuman', 'Transportasi', 'Belanja', 'Tagihan & Utilitas', 'Rumah & Sewa', 'Kesehatan', 'Pendidikan', 'Hiburan', 'Langganan', 'Donasi & Sosial', 'Biaya Admin', 'Lainnya'],
    income: ['Gaji', 'Bonus', 'Usaha', 'Investasi', 'Hadiah', 'Lainnya'],
  };
  const TYPE_LABEL = { income: 'Pemasukan', expense: 'Pengeluaran', transfer: 'Transfer' };
  const CHART_COLORS = ['#007aff', '#34c759', '#ff9500', '#af52de', '#ff2d55', '#5ac8fa', '#ffcc00', '#8e8e93'];

  const cats = (type) => {
    const list = [...DEFAULT_CATS[type], ...(S.settings.customCats[type] || [])];
    return [...new Set(list)];
  };

  let renderQueued = false;
  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }
  async function put(name, obj) {
    await Store.put(name, obj);
    const arr = S[name];
    const i = arr.findIndex((x) => x.id === obj.id);
    if (i >= 0) arr[i] = obj;
    else arr.push(obj);
    queueRender();
    markDirty();
  }
  async function del(name, id) {
    await Store.del(name, id);
    S[name] = S[name].filter((x) => x.id !== id);
    queueRender();
    markDirty();
  }
  async function saveSettings(syncIt = true) {
    await Store.put('meta', { id: 'settings', ...S.settings });
    if (syncIt) markDirty();
  }

  async function loadAll() {
    try {
      await IDB.open();
      Store = IDB;
    } catch (e) {
      console.warn('Fallback ke LocalStorage:', e.message);
      await LS.open();
      Store = LS;
    }
    const [w, t, d, b, m] = await Promise.all(STORES.map((s) => Store.getAll(s)));
    S.wallets = w.sort(byCreated); // IndexedDB mengurutkan menurut key (UUID acak), jadi urutkan manual
    S.transactions = t;
    S.debts = d;
    S.budgets = b;
    const st = m.find((x) => x.id === 'settings');
    if (st) {
      S.settings = {
        theme: st.theme || 'auto',
        customCats: { expense: st.customCats?.expense || [], income: st.customCats?.income || [] },
      };
    }
    // Seed dompet awal hanya pada pemakaian pertama
    if (!m.some((x) => x.id === 'init') && !w.length) {
      const seed = [
        { id: uid(), name: 'Kas Tunai', type: 'cash', initial: 0, createdAt: Date.now() },
        { id: uid(), name: 'Rekening Bank', type: 'bank', initial: 0, createdAt: Date.now() + 1 },
        { id: uid(), name: 'E-Wallet', type: 'ewallet', initial: 0, createdAt: Date.now() + 2 },
      ];
      for (const s of seed) {
        await Store.put('wallets', s);
        S.wallets.push(s);
      }
      await Store.put('meta', { id: 'init', done: true });
    }
    ui.lastWallet = S.wallets[0]?.id || null;
  }

  /* ==================================================================
   * 4. CALC
   * ================================================================== */
  const wallet = (id) => S.wallets.find((w) => w.id === id);
  const wname = (id) => wallet(id)?.name || '(dompet dihapus)';

  function balances() {
    const m = {};
    S.wallets.forEach((w) => (m[w.id] = Number(w.initial) || 0));
    for (const t of S.transactions) {
      if (t.type === 'income') {
        if (t.walletId in m) m[t.walletId] += t.amount;
      } else if (t.type === 'expense') {
        if (t.walletId in m) m[t.walletId] -= t.amount;
      } else if (t.type === 'transfer') {
        if (t.walletId in m) m[t.walletId] -= t.amount;
        if (t.toWalletId in m) m[t.toWalletId] += t.amount;
      }
    }
    return m;
  }

  const payments = (debtId) =>
    S.transactions.filter((t) => t.debtId === debtId && t.sys === 'pay').sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  function debtInfo(d) {
    const paid = sum(payments(d.id), (t) => t.amount);
    const remaining = Math.max(0, d.total - paid);
    const pct = d.total > 0 ? Math.min(100, (paid / d.total) * 100) : 0;
    return { paid, remaining, pct };
  }

  // Transaksi sistem (cicilan & arus pinjaman) tidak dihitung ke Cash Flow / kategori / budget.
  function monthStats(mk) {
    let inc = 0,
      exp = 0;
    const byCat = {};
    for (const t of S.transactions) {
      if (t.sys || !t.date.startsWith(mk)) continue;
      if (t.type === 'income') inc += t.amount;
      else if (t.type === 'expense') {
        exp += t.amount;
        byCat[t.category] = (byCat[t.category] || 0) + t.amount;
      }
    }
    return { inc, exp, byCat };
  }

  const tone = (pct) => (pct < 70 ? 'green' : pct <= 90 ? 'yellow' : 'red');
  const TONE = {
    green: { bar: 'bg-ios-green', text: 'text-ios-green', label: 'Aman' },
    yellow: { bar: 'bg-ios-yellow', text: 'text-ios-orange', label: 'Waspada' },
    red: { bar: 'bg-ios-red', text: 'text-ios-red', label: 'Kritis' },
  };

  const byCreated = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
  const sortTx = (list) => [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));

  function filteredTx() {
    const f = ui.filters;
    const q = f.q.trim().toLowerCase();
    return sortTx(
      S.transactions.filter((t) => {
        if (f.type && t.type !== f.type) return false;
        if (f.wallet && t.walletId !== f.wallet && t.toWalletId !== f.wallet) return false;
        if (f.cat && t.category !== f.cat) return false;
        if (f.from && t.date < f.from) return false;
        if (f.to && t.date > f.to) return false;
        if (q) {
          const hay = `${t.note || ''} ${t.category || ''} ${wname(t.walletId)} ${t.toWalletId ? wname(t.toWalletId) : ''} ${t.amount}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
    );
  }
  const hasFilters = () => Object.values(ui.filters).some(Boolean);

  /* ==================================================================
   * 5. UI KIT
   * ================================================================== */
  function toast(msg, kind = 'info', ms = 2600) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' error' : '');
    el.textContent = msg;
    $('#toastRoot').appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  function confirmBox({ title, message = '', ok = 'Hapus', danger = true }) {
    return new Promise((resolve) => {
      const root = $('#dialogRoot');
      root.innerHTML = `
        <div class="dialog-backdrop"><div class="dialog" role="alertdialog" aria-modal="true">
          <div class="p-5 text-center">
            <h3 class="text-[17px] font-semibold">${esc(title)}</h3>
            ${message ? `<p class="mt-1 text-[13px] text-ios-secondary">${esc(message)}</p>` : ''}
          </div>
          <div class="grid grid-cols-2 border-t border-ios-sep/50">
            <button data-v="0" class="border-r border-ios-sep/50 py-3 text-[17px] text-ios-blue">Batal</button>
            <button data-v="1" class="py-3 text-[17px] font-semibold ${danger ? 'text-ios-red' : 'text-ios-blue'}">${esc(ok)}</button>
          </div>
        </div></div>`;
      root.onclick = (e) => {
        const b = e.target.closest('button[data-v]');
        if (!b) return;
        root.innerHTML = '';
        root.onclick = null;
        resolve(b.dataset.v === '1');
      };
    });
  }

  function openSheet({ title, body, submit = 'Simpan', onSubmit, onMount, after, noSubmit = false }) {
    closeSheet();
    const root = $('#sheetRoot');
    root.innerHTML = `
      <div class="sheet-backdrop" data-act="sheetBackdrop">
        <form class="sheet" novalidate autocomplete="off" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="sheet-head">
            <button type="button" class="min-w-[56px] text-left text-[17px] text-ios-blue" data-act="closeSheet">${noSubmit ? 'Tutup' : 'Batal'}</button>
            <h2 class="mx-2 truncate text-[17px] font-semibold">${esc(title)}</h2>
            ${noSubmit ? '<span class="min-w-[56px]"></span>' : `<button type="submit" class="min-w-[56px] text-right text-[17px] font-semibold text-ios-blue">${esc(submit)}</button>`}
          </div>
          <div class="sheet-body">${body}</div>
        </form>
      </div>`;
    document.body.classList.add('overflow-hidden');
    const form = $('form', root);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!onSubmit) return;
      try {
        const ok = await onSubmit(form);
        if (ok !== false) {
          closeSheet();
          if (after) setTimeout(after, 0);
        }
      } catch (err) {
        console.error(err);
        toast('Gagal menyimpan: ' + err.message, 'error');
      }
    });
    if (onMount) onMount(form);
    return form;
  }
  function closeSheet() {
    $('#sheetRoot').innerHTML = '';
    document.body.classList.remove('overflow-hidden');
  }

  // Input Rupiah: tampilkan titik ribuan saat mengetik, pertahankan posisi kursor.
  function formatRpInput(el) {
    const before = el.value;
    const caret = el.selectionStart ?? before.length;
    const digitsLeft = before.slice(0, caret).replace(/\D/g, '').length;
    let digits = before.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (digits.length > 15) digits = digits.slice(0, 15);
    const out = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    el.value = out;
    // kembalikan kursor setelah digitsLeft digit
    let pos = 0,
      seen = 0;
    while (pos < out.length && seen < digitsLeft) {
      if (/\d/.test(out[pos])) seen++;
      pos++;
    }
    try {
      el.setSelectionRange(pos, pos);
    } catch {}
  }
  const parseRp = (str) => Number(String(str || '').replace(/\D/g, '')) || 0;
  const getRp = (form, name) => parseRp(form.elements[name]?.value);

  const rpField = (name, label, value = 0, extra = '') => `
    <div><label class="lbl" for="f_${name}">${esc(label)}</label>
    <div class="flex items-center gap-2 rounded-xl bg-ios-fill px-3.5 focus-within:ring-2 focus-within:ring-ios-blue/40">
      <span class="font-medium text-ios-secondary">Rp</span>
      <input id="f_${name}" name="${name}" data-rp inputmode="numeric" placeholder="0" value="${value ? fmtNum(value) : ''}" class="w-full min-w-0 bg-transparent py-3 outline-none" ${extra} />
    </div></div>`;
  const textField = (name, label, value = '', ph = '', extra = '') => `
    <div><label class="lbl" for="f_${name}">${esc(label)}</label>
    <input id="f_${name}" name="${name}" class="input" value="${esc(value)}" placeholder="${esc(ph)}" ${extra} /></div>`;
  const dateField = (name, label, value = '') => `
    <div><label class="lbl" for="f_${name}">${esc(label)}</label>
    <input id="f_${name}" type="date" name="${name}" class="input" value="${esc(value)}" /></div>`;
  const selectField = (name, label, options, selected, extra = '') => `
    <div><label class="lbl" for="f_${name}">${esc(label)}</label>
    <select id="f_${name}" name="${name}" class="input" ${extra}>${options
      .map(([v, l]) => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(l)}</option>`)
      .join('')}</select></div>`;
  const walletOptions = () => S.wallets.map((w) => [w.id, w.name]);

  const progress = (pct, barCls = 'bg-ios-blue') =>
    `<div class="h-2 w-full overflow-hidden rounded-full bg-ios-sep/40"><div class="${barCls} h-full rounded-full transition-all duration-500" style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></div></div>`;

  /* ==================================================================
   * 6. VIEWS
   * ================================================================== */
  const ROUTES = [
    { id: 'home', short: 'Beranda', long: 'Beranda', icon: 'home' },
    { id: 'tx', short: 'Transaksi', long: 'Transaksi', icon: 'list' },
    { id: 'debt', short: 'Utang', long: 'Utang & Piutang', icon: 'swap' },
    { id: 'budget', short: 'Anggaran', long: 'Anggaran', icon: 'pie' },
    { id: 'more', short: 'Lainnya', long: 'Dompet & Pengaturan', icon: 'more' },
  ];

  const header = (title, right = '') => `
    <header class="glass-top sticky top-0 z-20 -mx-4 flex items-end justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] md:-mx-8 md:px-8">
      <h1 class="text-[32px] font-bold leading-tight tracking-tight">${title}</h1>
      <div class="flex items-center gap-2 pb-1">${right}</div>
    </header>`;

  const monthSwitch = () => `
    <div class="mb-4 flex items-center justify-between rounded-2xl bg-ios-card px-2 py-1 shadow-sm">
      <button class="icon-btn !shadow-none" data-act="monthPrev" aria-label="Bulan sebelumnya">${ic('chevL', 'h-5 w-5')}</button>
      <span class="text-[16px] font-semibold capitalize">${esc(monthLabel(ui.month))}</span>
      <button class="icon-btn !shadow-none" data-act="monthNext" aria-label="Bulan berikutnya">${ic('chevR', 'h-5 w-5')}</button>
    </div>`;

  const walletIcon = (w, size = 'h-10 w-10 text-[20px]') => {
    const t = WTYPES[w.type] || WTYPES.cash;
    return `<span class="flex ${size} shrink-0 items-center justify-center rounded-xl" style="background:${t.color}22">${t.emoji}</span>`;
  };

  function donut(items, total) {
    if (!total) return `<p class="py-8 text-center text-[14px] text-ios-secondary">Belum ada pengeluaran bulan ini.</p>`;
    let acc = 0;
    const segs = items
      .map((it, i) => {
        const pct = (it.value / total) * 100;
        const s = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${CHART_COLORS[i % CHART_COLORS.length]}" stroke-width="5" stroke-dasharray="${pct.toFixed(3)} ${(100 - pct).toFixed(3)}" stroke-dashoffset="${(25 - acc).toFixed(3)}"/>`;
        acc += pct;
        return s;
      })
      .join('');
    const legend = items
      .map(
        (it, i) => `
        <li class="flex items-center gap-2 text-[14px]">
          <span class="h-3 w-3 shrink-0 rounded-full" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></span>
          <span class="min-w-0 flex-1 truncate">${esc(it.label)}</span>
          <span class="text-ios-secondary">${((it.value / total) * 100).toFixed(0)}%</span>
          <span class="w-28 text-right font-medium">${rp(it.value)}</span>
        </li>`
      )
      .join('');
    return `
      <div class="flex flex-col items-center gap-4">
        <div class="relative h-40 w-40 shrink-0">
          <svg viewBox="0 0 42 42" class="h-full w-full" role="img" aria-label="Proporsi pengeluaran per kategori">
            <circle cx="21" cy="21" r="15.9155" fill="none" stroke="rgb(var(--sep) / .35)" stroke-width="5"/>
            ${segs}
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-[11px] text-ios-secondary">Total</span>
            <span class="text-[15px] font-bold">${rp(total)}</span>
          </div>
        </div>
        <ul class="w-full space-y-2">${legend}</ul>
      </div>`;
  }

  function txRow(t, { showDate = false } = {}) {
    let title = esc(t.category || TYPE_LABEL[t.type]);
    let sub = esc(wname(t.walletId));
    let amount, amtCls, ico, icoCls;
    if (t.type === 'transfer') {
      title = 'Transfer';
      sub = `${esc(wname(t.walletId))} → ${esc(wname(t.toWalletId))}`;
      amount = rp(t.amount);
      amtCls = 'text-ios-label';
      ico = 'swap';
      icoCls = 'bg-ios-blue/15 text-ios-blue';
    } else if (t.type === 'income') {
      amount = '+' + rp(t.amount);
      amtCls = 'text-ios-green';
      ico = 'arrowDown';
      icoCls = 'bg-ios-green/15 text-ios-green';
    } else {
      amount = '-' + rp(t.amount);
      amtCls = 'text-ios-red';
      ico = 'arrowUp';
      icoCls = 'bg-ios-red/15 text-ios-red';
    }
    const extra = [t.note ? esc(t.note) : '', showDate ? esc(fmtDate(t.date)) : ''].filter(Boolean).join(' · ');
    return `
      <button class="row" data-act="editTx" data-id="${t.id}">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${icoCls}">${ic(ico, 'h-5 w-5')}</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[16px] font-medium">${title}</span>
          <span class="block truncate text-[13px] text-ios-secondary">${sub}${extra ? ' · ' + extra : ''}</span>
        </span>
        <span class="shrink-0 text-[16px] font-semibold ${amtCls}">${amount}</span>
      </button>`;
  }

  function dueBadge(d, info) {
    if (info.remaining <= 0) return `<span class="badge bg-ios-green/15 text-ios-green">Lunas</span>`;
    if (!d.dueDate) return `<span class="badge bg-ios-fill text-ios-secondary">Tanpa jatuh tempo</span>`;
    const diff = daysBetween(today(), d.dueDate);
    if (diff < 0) return `<span class="badge bg-ios-red/15 text-ios-red">Terlambat ${-diff} hari</span>`;
    if (diff === 0) return `<span class="badge bg-ios-orange/15 text-ios-orange">Jatuh tempo hari ini</span>`;
    if (diff <= 7) return `<span class="badge bg-ios-orange/15 text-ios-orange">${diff} hari lagi</span>`;
    return `<span class="badge bg-ios-fill text-ios-secondary">${esc(fmtDate(d.dueDate))}</span>`;
  }

  /* ---------- Beranda ---------- */
  function vHome() {
    const bal = balances();
    const walletsTotal = sum(S.wallets, (w) => bal[w.id] || 0);
    let recv = 0,
      owe = 0;
    S.debts.forEach((d) => {
      const i = debtInfo(d);
      if (d.kind === 'debt') owe += i.remaining;
      else recv += i.remaining;
    });
    const net = walletsTotal + recv - owe;
    const ms = monthStats(ui.month);
    const flowTotal = ms.inc + ms.exp;
    const diff = ms.inc - ms.exp;

    // Donut kategori
    const sorted = Object.entries(ms.byCat).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 6).map(([label, value]) => ({ label, value }));
    const rest = sum(sorted.slice(6), (x) => x[1]);
    if (rest > 0) top.push({ label: 'Lainnya', value: rest });

    // Budget teratas
    const budgetRows = S.budgets
      .map((b) => {
        const spent = ms.byCat[b.category] || 0;
        return { b, spent, pct: b.limit > 0 ? (spent / b.limit) * 100 : 0 };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);

    // Jatuh tempo mendekat
    const due = S.debts
      .map((d) => ({ d, i: debtInfo(d) }))
      .filter((x) => x.i.remaining > 0 && x.d.dueDate && daysBetween(today(), x.d.dueDate) <= 14)
      .sort((a, b) => a.d.dueDate.localeCompare(b.d.dueDate))
      .slice(0, 4);

    const recent = sortTx(S.transactions).slice(0, 6);

    return `
      ${header('Beranda')}
      ${monthSwitch()}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <!-- Net worth -->
        <section class="rounded-2xl bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] p-5 text-white shadow-md md:col-span-2">
          <p class="text-[13px] font-medium text-white/80">Net Worth</p>
          <p class="mt-1 text-[34px] font-bold leading-tight tracking-tight">${rp(net)}</p>
          <p class="text-[12px] text-white/70">Saldo dompet + piutang − utang</p>
          <div class="mt-4 grid grid-cols-3 gap-2 text-[13px]">
            <div class="rounded-xl bg-white/15 p-2.5"><p class="text-white/75">Saldo Dompet</p><p class="mt-0.5 font-semibold">${rp(walletsTotal)}</p></div>
            <div class="rounded-xl bg-white/15 p-2.5"><p class="text-white/75">Piutang</p><p class="mt-0.5 font-semibold">${rp(recv)}</p></div>
            <div class="rounded-xl bg-white/15 p-2.5"><p class="text-white/75">Utang</p><p class="mt-0.5 font-semibold">${rp(owe)}</p></div>
          </div>
        </section>

        <!-- Cash flow -->
        <section class="card">
          <h2 class="card-title">Cash Flow Bulan Ini</h2>
          <div class="flex items-end justify-between">
            <div><p class="text-[12px] text-ios-secondary">Pemasukan</p><p class="text-[18px] font-bold text-ios-green">${rp(ms.inc)}</p></div>
            <div class="text-right"><p class="text-[12px] text-ios-secondary">Pengeluaran</p><p class="text-[18px] font-bold text-ios-red">${rp(ms.exp)}</p></div>
          </div>
          <div class="mt-3 flex h-3 overflow-hidden rounded-full bg-ios-sep/40">
            <div class="bg-ios-green transition-all" style="width:${flowTotal ? (ms.inc / flowTotal) * 100 : 0}%"></div>
            <div class="bg-ios-red transition-all" style="width:${flowTotal ? (ms.exp / flowTotal) * 100 : 0}%"></div>
          </div>
          <p class="mt-3 text-[14px] text-ios-secondary">Selisih <span class="font-semibold ${diff >= 0 ? 'text-ios-green' : 'text-ios-red'}">${diff >= 0 ? '+' : ''}${rp(diff)}</span></p>
        </section>

        <!-- Donut -->
        <section class="card">
          <h2 class="card-title">Pengeluaran per Kategori</h2>
          ${donut(top, ms.exp)}
        </section>

        <!-- Dompet -->
        <section class="card">
          <h2 class="card-title">Dompet</h2>
          ${
            S.wallets.length
              ? S.wallets
                  .map(
                    (w) => `<div class="row">${walletIcon(w)}<span class="min-w-0 flex-1"><span class="block truncate font-medium">${esc(w.name)}</span><span class="text-[13px] text-ios-secondary">${esc(WTYPES[w.type]?.label || '')}</span></span><span class="font-semibold ${bal[w.id] < 0 ? 'text-ios-red' : ''}">${rp(bal[w.id] || 0)}</span></div>`
                  )
                  .join('')
              : '<p class="text-[14px] text-ios-secondary">Belum ada dompet.</p>'
          }
        </section>

        <!-- Budget -->
        <section class="card">
          <h2 class="card-title">Anggaran</h2>
          ${
            budgetRows.length
              ? budgetRows
                  .map(({ b, spent, pct }) => {
                    const t = TONE[tone(pct)];
                    return `<div class="mb-3 last:mb-0"><div class="mb-1 flex justify-between text-[14px]"><span class="font-medium">${esc(b.category)}</span><span class="${t.text} font-semibold">${pct.toFixed(0)}%</span></div>${progress(pct, t.bar)}<p class="mt-1 text-[12px] text-ios-secondary">${rp(spent)} dari ${rp(b.limit)}</p></div>`;
                  })
                  .join('')
              : '<p class="text-[14px] text-ios-secondary">Belum ada budget. Atur di tab Anggaran.</p>'
          }
        </section>

        <!-- Jatuh tempo -->
        <section class="card">
          <h2 class="card-title">Jatuh Tempo Terdekat</h2>
          ${
            due.length
              ? due
                  .map(
                    ({ d, i }) => `<button class="row" data-act="openDebt" data-id="${d.id}"><span class="min-w-0 flex-1"><span class="block truncate font-medium">${esc(d.party)}</span><span class="text-[12px] text-ios-secondary">${d.kind === 'debt' ? 'Utang' : 'Piutang'}</span></span><span class="text-right"><span class="block font-semibold">${rp(i.remaining)}</span>${dueBadge(d, i)}</span></button>`
                  )
                  .join('')
              : '<p class="text-[14px] text-ios-secondary">Tidak ada jatuh tempo dalam 14 hari.</p>'
          }
        </section>

        <!-- Terbaru -->
        <section class="card md:col-span-1 xl:col-span-2">
          <div class="mb-1 flex items-center justify-between"><h2 class="card-title !mb-0">Transaksi Terbaru</h2><a href="#/tx" class="text-[14px] text-ios-blue">Lihat semua</a></div>
          ${recent.length ? recent.map((t) => txRow(t, { showDate: true })).join('') : '<p class="py-6 text-center text-[14px] text-ios-secondary">Belum ada transaksi. Ketuk tombol ＋ untuk mulai.</p>'}
        </section>
      </div>`;
  }

  /* ---------- Transaksi ---------- */
  function txListHTML() {
    const list = filteredTx();
    const shown = list.slice(0, ui.txLimit);
    const real = list.filter((t) => !t.sys && t.type !== 'transfer');
    const inc = sum(real.filter((t) => t.type === 'income'), (t) => t.amount);
    const exp = sum(real.filter((t) => t.type === 'expense'), (t) => t.amount);
    if (!list.length) {
      return `<div class="card py-10 text-center text-ios-secondary">${hasFilters() ? 'Tidak ada transaksi yang cocok dengan filter.' : 'Belum ada transaksi.'}</div>`;
    }
    let html = `<p class="mb-2 px-1 text-[13px] text-ios-secondary">${list.length} transaksi · Masuk <b class="text-ios-green">${rp(inc)}</b> · Keluar <b class="text-ios-red">${rp(exp)}</b></p>`;
    let last = '';
    let open = false;
    for (const t of shown) {
      if (t.date !== last) {
        if (open) html += '</div>';
        html += `<p class="mb-1 mt-4 px-1 text-[13px] font-semibold uppercase tracking-wide text-ios-secondary first:mt-0">${esc(dayLabel(t.date))}</p><div class="card !py-1">`;
        last = t.date;
        open = true;
      }
      html += txRow(t);
    }
    if (open) html += '</div>';
    if (list.length > shown.length) html += `<button class="btn btn-gray mt-4 w-full" data-act="loadMore">Tampilkan lebih banyak (${list.length - shown.length})</button>`;
    return html;
  }
  function allCategories() {
    return [...new Set([...cats('expense'), ...cats('income'), ...S.transactions.map((t) => t.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'id'));
  }
  const resetBtn = () => (hasFilters() ? `<button class="btn btn-soft w-full !py-2" data-act="clearFilters">Reset filter</button>` : '');
  function vTx() {
    const f = ui.filters;
    const opt = (v, l, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`;
    return `
      ${header(
        'Transaksi',
        `<button class="icon-btn" data-act="exportCSVFiltered" aria-label="Ekspor CSV" title="Ekspor CSV">${ic('table', 'h-5 w-5')}</button>
         <button class="icon-btn" data-act="printFiltered" aria-label="Cetak laporan" title="Cetak / PDF">${ic('printer', 'h-5 w-5')}</button>`
      )}
      <div class="card mb-4 space-y-3">
        <div class="flex items-center gap-2 rounded-xl bg-ios-fill px-3.5">
          <span class="text-ios-secondary">${ic('search', 'h-5 w-5')}</span>
          <input data-filter="q" value="${esc(f.q)}" placeholder="Cari catatan, kategori, dompet, nominal…" class="w-full min-w-0 bg-transparent py-3 outline-none" />
        </div>
        <div class="grid grid-cols-2 gap-2 md:grid-cols-5">
          <div><label class="lbl">Dari</label><input type="date" data-filter="from" value="${esc(f.from)}" class="input" /></div>
          <div><label class="lbl">Sampai</label><input type="date" data-filter="to" value="${esc(f.to)}" class="input" /></div>
          <div><label class="lbl">Dompet</label><select data-filter="wallet" class="input">${opt('', 'Semua', f.wallet)}${S.wallets.map((w) => opt(w.id, w.name, f.wallet)).join('')}</select></div>
          <div><label class="lbl">Kategori</label><select data-filter="cat" class="input">${opt('', 'Semua', f.cat)}${allCategories().map((c) => opt(c, c, f.cat)).join('')}</select></div>
          <div class="col-span-2 md:col-span-1"><label class="lbl">Jenis</label><select data-filter="type" class="input">${opt('', 'Semua', f.type)}${Object.entries(TYPE_LABEL).map(([v, l]) => opt(v, l, f.type)).join('')}</select></div>
        </div>
        <div id="resetWrap">${resetBtn()}</div>
      </div>
      <div id="txList">${txListHTML()}</div>`;
  }

  /* ---------- Utang & Piutang ---------- */
  function vDebt() {
    const kind = ui.debtTab;
    const items = S.debts
      .filter((d) => d.kind === kind)
      .map((d) => ({ d, i: debtInfo(d) }))
      .sort((a, b) => {
        const al = a.i.remaining <= 0,
          bl = b.i.remaining <= 0;
        if (al !== bl) return al ? 1 : -1;
        return (a.d.dueDate || '9999').localeCompare(b.d.dueDate || '9999');
      });
    const totalRemain = sum(items, (x) => x.i.remaining);
    const active = items.filter((x) => x.i.remaining > 0).length;
    const isDebt = kind === 'debt';
    return `
      ${header('Utang & Piutang', `<button class="icon-btn" data-act="addDebt" aria-label="Tambah">${ic('plus', 'h-5 w-5')}</button>`)}
      <div class="seg mb-4">
        <button class="${isDebt ? 'active' : ''}" data-act="debtTab" data-v="debt">Utang Saya</button>
        <button class="${!isDebt ? 'active' : ''}" data-act="debtTab" data-v="receivable">Piutang</button>
      </div>
      <div class="card mb-4">
        <p class="text-[13px] text-ios-secondary">${isDebt ? 'Total sisa utang (kewajiban kita)' : 'Total sisa piutang (pinjaman ke orang lain)'}</p>
        <p class="text-[30px] font-bold ${isDebt ? 'text-ios-red' : 'text-ios-green'}">${rp(totalRemain)}</p>
        <p class="text-[13px] text-ios-secondary">${active} aktif · ${items.length - active} lunas</p>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${
          items.length
            ? items
                .map(({ d, i }) => {
                  const barCls = i.remaining <= 0 ? 'bg-ios-green' : isDebt ? 'bg-ios-red' : 'bg-ios-blue';
                  return `
              <button class="card w-full text-left transition active:opacity-70" data-act="openDebt" data-id="${d.id}">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0"><p class="truncate text-[17px] font-semibold">${esc(d.party)}</p><p class="truncate text-[13px] text-ios-secondary">${esc(d.note || (d.tenor ? `Tenor ${d.tenor} bulan` : '—'))}</p></div>
                  <div class="shrink-0 text-right"><p class="text-[17px] font-bold">${rp(i.remaining)}</p><p class="text-[12px] text-ios-secondary">dari ${rp(d.total)}</p></div>
                </div>
                <div class="mt-3">${progress(i.pct, barCls)}</div>
                <div class="mt-2 flex items-center justify-between text-[12px] text-ios-secondary"><span>${i.pct.toFixed(0)}% lunas</span>${dueBadge(d, i)}</div>
              </button>`;
                })
                .join('')
            : `<div class="card py-10 text-center text-ios-secondary md:col-span-2 xl:col-span-3">Belum ada catatan ${isDebt ? 'utang' : 'piutang'}.<br/><button class="btn btn-soft mt-4" data-act="addDebt">＋ Tambah ${isDebt ? 'Utang' : 'Piutang'}</button></div>`
        }
      </div>`;
  }

  /* ---------- Anggaran ---------- */
  function vBudget() {
    const ms = monthStats(ui.month);
    const rows = S.budgets
      .map((b) => {
        const spent = ms.byCat[b.category] || 0;
        return { b, spent, pct: b.limit > 0 ? (spent / b.limit) * 100 : 0 };
      })
      .sort((a, b) => b.pct - a.pct);
    const totalLimit = sum(S.budgets, (b) => b.limit);
    const totalSpent = sum(rows, (r) => r.spent);
    const totalPct = totalLimit ? (totalSpent / totalLimit) * 100 : 0;
    const tt = TONE[tone(totalPct)];
    const unbudgeted = Object.entries(ms.byCat).filter(([c]) => !S.budgets.some((b) => b.category === c)).sort((a, b) => b[1] - a[1]);
    return `
      ${header('Anggaran', `<button class="icon-btn" data-act="addBudget" aria-label="Tambah budget">${ic('plus', 'h-5 w-5')}</button>`)}
      ${monthSwitch()}
      <div class="card mb-4">
        <div class="flex items-end justify-between"><div><p class="text-[13px] text-ios-secondary">Terpakai bulan ini</p><p class="text-[28px] font-bold">${rp(totalSpent)}</p></div><div class="text-right"><p class="text-[13px] text-ios-secondary">Total budget</p><p class="text-[17px] font-semibold">${rp(totalLimit)}</p></div></div>
        <div class="mt-3">${progress(totalPct, tt.bar)}</div>
        <p class="mt-2 text-[13px] ${tt.text} font-medium">${totalLimit ? totalPct.toFixed(0) + '% · ' + tt.label : 'Belum ada budget'}</p>
        <div class="mt-3 flex flex-wrap gap-3 text-[12px] text-ios-secondary"><span><i class="mr-1 inline-block h-2 w-2 rounded-full bg-ios-green"></i>&lt;70%</span><span><i class="mr-1 inline-block h-2 w-2 rounded-full bg-ios-yellow"></i>70–90%</span><span><i class="mr-1 inline-block h-2 w-2 rounded-full bg-ios-red"></i>&gt;90% / lewat</span></div>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${
          rows.length
            ? rows
                .map(({ b, spent, pct }) => {
                  const t = TONE[tone(pct)];
                  const left = b.limit - spent;
                  return `<button class="card w-full text-left transition active:opacity-70" data-act="editBudget" data-id="${b.id}">
                    <div class="mb-2 flex items-center justify-between"><span class="text-[16px] font-semibold">${esc(b.category)}</span><span class="badge ${pct < 70 ? 'bg-ios-green/15 text-ios-green' : pct <= 90 ? 'bg-ios-yellow/25 text-ios-orange' : 'bg-ios-red/15 text-ios-red'}">${pct.toFixed(0)}%</span></div>
                    ${progress(pct, t.bar)}
                    <div class="mt-2 flex justify-between text-[13px]"><span class="text-ios-secondary">${rp(spent)} / ${rp(b.limit)}</span><span class="font-medium ${left < 0 ? 'text-ios-red' : 'text-ios-secondary'}">${left < 0 ? 'Lewat ' + rp(-left) : 'Sisa ' + rp(left)}</span></div>
                  </button>`;
                })
                .join('')
            : `<div class="card py-10 text-center text-ios-secondary md:col-span-2 xl:col-span-3">Belum ada budget.<br/><button class="btn btn-soft mt-4" data-act="addBudget">＋ Atur Budget Kategori</button></div>`
        }
      </div>
      ${
        unbudgeted.length
          ? `<section class="card mt-4"><h2 class="card-title">Pengeluaran tanpa budget</h2>${unbudgeted.map(([c, v]) => `<div class="row"><span class="flex-1">${esc(c)}</span><span class="font-semibold">${rp(v)}</span></div>`).join('')}</section>`
          : ''
      }`;
  }

  /* ---------- Lainnya: Dompet & Pengaturan ---------- */
  function vMore() {
    const bal = balances();
    const th = S.settings.theme;
    return `
      ${header('Dompet & Pengaturan')}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section class="card md:col-span-2">
          <div class="mb-1 flex items-center justify-between"><h2 class="card-title !mb-0">Dompet</h2><button class="text-[15px] font-medium text-ios-blue" data-act="addWallet">＋ Tambah</button></div>
          ${
            S.wallets.length
              ? S.wallets
                  .map(
                    (w) => `<button class="row" data-act="editWallet" data-id="${w.id}">${walletIcon(w)}<span class="min-w-0 flex-1"><span class="block truncate font-medium">${esc(w.name)}</span><span class="text-[13px] text-ios-secondary">${esc(WTYPES[w.type]?.label || '')}</span></span><span class="font-semibold ${bal[w.id] < 0 ? 'text-ios-red' : ''}">${rp(bal[w.id] || 0)}</span><span class="text-ios-secondary">${ic('chevR', 'h-4 w-4')}</span></button>`
                  )
                  .join('')
              : '<p class="py-4 text-center text-ios-secondary">Belum ada dompet.</p>'
          }
        </section>

        <section class="card md:col-span-2">
          <h2 class="card-title">Sinkronisasi Cloud</h2>
          <div id="syncBox">${syncBoxHTML()}</div>
        </section>

        <section class="card">
          <h2 class="card-title">Tampilan</h2>
          <div class="seg">
            ${[['auto', 'Otomatis'], ['light', 'Terang'], ['dark', 'Gelap']].map(([v, l]) => `<button class="${th === v ? 'active' : ''}" data-act="setTheme" data-v="${v}">${l}</button>`).join('')}
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">Laporan (${esc(monthLabel(ui.month))})</h2>
          <div class="grid gap-2">
            <button class="btn btn-gray" data-act="exportCSV">${ic('table', 'h-5 w-5')} Ekspor CSV (Excel)</button>
            <button class="btn btn-gray" data-act="printMonth">${ic('printer', 'h-5 w-5')} Cetak / Simpan PDF (A4)</button>
          </div>
          <p class="mt-2 text-[12px] text-ios-secondary">Bulan dipilih lewat tab Beranda / Anggaran. Untuk rentang tanggal bebas, gunakan filter di tab Transaksi.</p>
        </section>

        <section class="card">
          <h2 class="card-title">Backup & Restore</h2>
          <div class="grid gap-2">
            <button class="btn btn-soft" data-act="exportJSON">${ic('download', 'h-5 w-5')} Export JSON</button>
            <button class="btn btn-soft" data-act="importJSON">${ic('upload', 'h-5 w-5')} Import JSON</button>
          </div>
          <p class="mt-2 text-[12px] text-ios-secondary">Data tersimpan di perangkat ini. Pakai Export/Import untuk memindahkan data antar iPhone, tablet, dan PC.</p>
        </section>

        <section class="card">
          <h2 class="card-title">Pasang di iPhone</h2>
          <p class="text-[14px] text-ios-secondary">Buka di Safari → ketuk <b>Bagikan</b> → <b>Tambah ke Layar Utama</b>. Aplikasi tampil layar penuh dan bisa dibuka offline.</p>
          <button class="btn btn-danger mt-4 w-full" data-act="resetAll">Hapus Semua Data</button>
          <p class="mt-3 text-center text-[11px] text-ios-secondary">KeuanganKu v1.1.0</p>
        </section>
      </div>`;
  }

  /* ---------- Render ---------- */
  const VIEWS = { home: vHome, tx: vTx, debt: vDebt, budget: vBudget, more: vMore };

  function renderNav() {
    $('#sideNav').innerHTML = ROUTES.map(
      (r) => `<a href="#/${r.id}" class="nav-item ${ui.route === r.id ? 'active' : ''}">${ic(r.icon, 'h-5 w-5')}<span>${r.long}</span></a>`
    ).join('');
    $('#tabbar').innerHTML = ROUTES.map(
      (r) => `<a href="#/${r.id}" class="tab-item ${ui.route === r.id ? 'active' : ''}" ${ui.route === r.id ? 'aria-current="page"' : ''}>${ic(r.icon, 'h-[26px] w-[26px]')}<span>${r.short}</span></a>`
    ).join('');
  }
  function render() {
    $('#view').innerHTML = (VIEWS[ui.route] || vHome)();
    renderNav();
  }
  function onRoute() {
    const h = location.hash.replace(/^#\/?/, '') || 'home';
    ui.route = VIEWS[h] ? h : 'home';
    window.scrollTo(0, 0);
    render();
  }

  /* ==================================================================
   * 7. FORMS
   * ================================================================== */
  /* ---------- Transaksi ---------- */
  function openTxSheet(tx) {
    if (!S.wallets.length) {
      toast('Buat dompet dulu di tab Lainnya', 'error');
      location.hash = '#/more';
      return;
    }
    if (tx && tx.linkId) {
      const parent = S.transactions.find((x) => x.id === tx.linkId);
      if (parent) return openTxSheet(parent);
    }
    if (tx && tx.sys) {
      const d = S.debts.find((x) => x.id === tx.debtId);
      toast('Ubah lewat menu Utang & Piutang');
      if (d) openDebtSheet(d.id);
      return;
    }
    const edit = !!tx;
    let type = tx ? tx.type : 'expense';
    const defWallet = tx?.walletId || (wallet(ui.lastWallet) ? ui.lastWallet : S.wallets[0].id);
    const linkedFee = tx ? S.transactions.find((x) => x.linkId === tx.id) : null;
    const catOpts = (tp, sel) => {
      const list = cats(tp);
      if (sel && !list.includes(sel)) list.push(sel);
      return list.map((c) => `<option value="${esc(c)}" ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('') + '<option value="__new">＋ Kategori baru…</option>';
    };

    const body = `
      <div class="seg" id="txType">
        ${[['expense', 'Pengeluaran'], ['income', 'Pemasukan'], ['transfer', 'Transfer']].map(([v, l]) => `<button type="button" data-type="${v}">${l}</button>`).join('')}
      </div>
      <div class="amount-box"><span>Rp</span><input name="amount" data-rp inputmode="numeric" placeholder="0" value="${tx ? fmtNum(tx.amount) : ''}" aria-label="Jumlah" /></div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div><label class="lbl" id="lblFrom" for="f_walletId">Dompet</label>
          <select id="f_walletId" name="walletId" class="input">${S.wallets.map((w) => `<option value="${w.id}" ${w.id === defWallet ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
        <div data-show="transfer"><label class="lbl" for="f_toWalletId">Ke Dompet</label>
          <select id="f_toWalletId" name="toWalletId" class="input">${S.wallets.map((w) => `<option value="${w.id}" ${w.id === tx?.toWalletId ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
        <div data-show="income expense"><label class="lbl" for="f_category">Kategori</label>
          <select id="f_category" name="category" class="input"></select></div>
        <div data-show="transfer">${rpField('fee', 'Biaya admin (opsional)', tx?.fee || linkedFee?.amount || 0)}</div>
        ${dateField('date', 'Tanggal', tx?.date || today())}
      </div>
      ${textField('note', 'Catatan', tx?.note || '', 'Opsional', 'maxlength="120"')}
      <p class="hidden text-[12px] text-ios-secondary" data-show="transfer">Biaya admin otomatis dicatat sebagai pengeluaran kategori “Biaya Admin” dari dompet asal.</p>
      ${edit ? `<button type="button" class="btn btn-danger w-full" data-act="delTx" data-id="${tx.id}">Hapus Transaksi</button>` : ''}`;

    openSheet({
      title: edit ? 'Ubah Transaksi' : 'Transaksi Baru',
      body,
      onMount(form) {
        const seg = $('#txType', form);
        const catSel = form.elements.category;
        let currentCat = tx?.category && tx.type === type ? tx.category : '';
        const sync = () => {
          $$('button', seg).forEach((b) => b.classList.toggle('active', b.dataset.type === type));
          $$('[data-show]', form).forEach((el) => el.classList.toggle('hidden', !el.dataset.show.split(' ').includes(type)));
          $('#lblFrom', form).textContent = type === 'transfer' ? 'Dari Dompet' : 'Dompet';
          if (type !== 'transfer') catSel.innerHTML = catOpts(type, currentCat || '');
        };
        sync();
        seg.addEventListener('click', (e) => {
          const b = e.target.closest('button[data-type]');
          if (!b) return;
          if (type !== b.dataset.type) currentCat = '';
          type = b.dataset.type;
          sync();
        });
        catSel.addEventListener('change', () => {
          if (catSel.value !== '__new') {
            currentCat = catSel.value;
            return;
          }
          const name = (prompt('Nama kategori baru:') || '').trim().slice(0, 40);
          if (name) {
            const arr = S.settings.customCats[type];
            if (!cats(type).some((c) => c.toLowerCase() === name.toLowerCase())) {
              arr.push(name);
              saveSettings();
            }
            currentCat = cats(type).find((c) => c.toLowerCase() === name.toLowerCase());
          }
          catSel.innerHTML = catOpts(type, currentCat);
        });
        if (!edit) setTimeout(() => form.elements.amount.focus(), 120);
      },
      async onSubmit(form) {
        const v = (n) => form.elements[n].value;
        const amount = getRp(form, 'amount');
        if (!(amount > 0)) return toast('Masukkan jumlah lebih dari 0', 'error'), false;
        const walletId = v('walletId');
        const date = v('date');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast('Tanggal tidak valid', 'error'), false;
        const id = tx?.id || uid();
        const rec = { id, type, amount, walletId, date, note: v('note').trim(), createdAt: tx?.createdAt || Date.now() };
        let fee = 0;
        if (type === 'transfer') {
          const to = v('toWalletId');
          if (to === walletId) return toast('Dompet asal dan tujuan harus berbeda', 'error'), false;
          fee = getRp(form, 'fee');
          rec.toWalletId = to;
          rec.fee = fee;
          rec.category = 'Transfer';
        } else {
          const c = v('category');
          if (!c || c === '__new') return toast('Pilih kategori', 'error'), false;
          rec.category = c;
        }
        await put('transactions', rec);
        // Biaya admin sebagai pengeluaran terpisah (terhubung lewat linkId)
        if (type === 'transfer' && fee > 0) {
          await put('transactions', {
            id: linkedFee?.id || uid(),
            type: 'expense',
            amount: fee,
            walletId,
            date,
            category: 'Biaya Admin',
            note: `Biaya admin transfer ke ${wname(rec.toWalletId)}`,
            linkId: id,
            createdAt: linkedFee?.createdAt || Date.now(),
          });
        } else if (linkedFee) {
          await del('transactions', linkedFee.id);
        }
        ui.lastWallet = walletId;
        toast(edit ? 'Transaksi diperbarui' : 'Transaksi tersimpan');
      },
    });
  }

  /* ---------- Dompet ---------- */
  function openWalletSheet(id) {
    const w = id ? wallet(id) : null;
    openSheet({
      title: w ? 'Ubah Dompet' : 'Dompet Baru',
      body: `
        ${textField('name', 'Nama dompet', w?.name || '', 'mis. BCA, GoPay, Reksadana', 'maxlength="40"')}
        ${selectField('type', 'Jenis', Object.entries(WTYPES).map(([k, t]) => [k, `${t.emoji} ${t.label}`]), w?.type || 'cash')}
        ${rpField('initial', 'Saldo awal', w?.initial || 0)}
        ${w ? `<button type="button" class="btn btn-danger w-full" data-act="delWallet" data-id="${w.id}">Hapus Dompet</button>` : ''}`,
      async onSubmit(form) {
        const name = form.elements.name.value.trim();
        if (!name) return toast('Isi nama dompet', 'error'), false;
        await put('wallets', { id: w?.id || uid(), name, type: form.elements.type.value, initial: getRp(form, 'initial'), createdAt: w?.createdAt || Date.now() });
        toast('Dompet tersimpan');
      },
      onMount: (f) => !w && setTimeout(() => f.elements.name.focus(), 120),
    });
  }

  /* ---------- Utang & Piutang ---------- */
  function openDebtSheet(id) {
    const d = S.debts.find((x) => x.id === id);
    if (!d) return;
    const info = debtInfo(d);
    const isDebt = d.kind === 'debt';
    const pays = payments(d.id);
    const body = `
      <div class="text-center">
        <p class="text-[13px] text-ios-secondary">Sisa ${isDebt ? 'utang' : 'piutang'}</p>
        <p class="text-[34px] font-bold leading-tight ${info.remaining <= 0 ? 'text-ios-green' : isDebt ? 'text-ios-red' : 'text-ios-label'}">${rp(info.remaining)}</p>
        <div class="mt-1">${dueBadge(d, info)}</div>
      </div>
      <div>${progress(info.pct, info.remaining <= 0 ? 'bg-ios-green' : isDebt ? 'bg-ios-red' : 'bg-ios-blue')}<p class="mt-1.5 text-center text-[13px] text-ios-secondary">${info.pct.toFixed(0)}% lunas</p></div>
      <div class="grid grid-cols-3 gap-2 text-center text-[12px]">
        <div class="rounded-xl bg-ios-card p-2.5"><p class="text-ios-secondary">Total</p><p class="mt-0.5 text-[14px] font-semibold">${rp(d.total)}</p></div>
        <div class="rounded-xl bg-ios-card p-2.5"><p class="text-ios-secondary">${isDebt ? 'Terbayar' : 'Diterima'}</p><p class="mt-0.5 text-[14px] font-semibold">${rp(info.paid)}</p></div>
        <div class="rounded-xl bg-ios-card p-2.5"><p class="text-ios-secondary">Jatuh tempo</p><p class="mt-0.5 text-[14px] font-semibold">${d.dueDate ? esc(fmtDate(d.dueDate)) : '—'}</p></div>
      </div>
      ${d.tenor ? `<p class="text-center text-[13px] text-ios-secondary">Tenor ${d.tenor} bulan · ±${rp(Math.ceil(d.total / d.tenor))} / bulan</p>` : ''}
      ${d.note ? `<p class="rounded-xl bg-ios-card p-3 text-[14px]">${esc(d.note)}</p>` : ''}
      <section>
        <h3 class="card-title">Riwayat ${isDebt ? 'Cicilan' : 'Penerimaan'}</h3>
        <div class="rounded-2xl bg-ios-card px-4 py-1">
          ${
            pays.length
              ? pays
                  .map(
                    (p) => `<div class="row"><span class="min-w-0 flex-1"><span class="block font-medium">${esc(fmtDate(p.date))}</span><span class="block truncate text-[12px] text-ios-secondary">${esc(wname(p.walletId))}${p.note ? ' · ' + esc(p.note) : ''}</span></span><span class="font-semibold ${isDebt ? 'text-ios-red' : 'text-ios-green'}">${isDebt ? '-' : '+'}${rp(p.amount)}</span><button type="button" class="p-1 text-ios-secondary" data-act="delPay" data-id="${p.id}" aria-label="Hapus">${ic('trash', 'h-4 w-4')}</button></div>`
                  )
                  .join('')
              : '<p class="py-4 text-center text-[14px] text-ios-secondary">Belum ada riwayat.</p>'
          }
        </div>
      </section>
      <div class="grid gap-2">
        ${info.remaining > 0 ? `<button type="button" class="btn btn-primary w-full" data-act="payDebt" data-id="${d.id}">${isDebt ? 'Bayar Cicilan' : 'Terima Cicilan'}</button>` : ''}
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="btn btn-gray" data-act="editDebt" data-id="${d.id}">Ubah</button>
          <button type="button" class="btn btn-danger" data-act="delDebt" data-id="${d.id}">Hapus</button>
        </div>
      </div>`;
    openSheet({ title: d.party, body, noSubmit: true });
  }

  function openDebtForm(id) {
    const d = id ? S.debts.find((x) => x.id === id) : null;
    let kind = d?.kind || ui.debtTab;
    const paid = d ? debtInfo(d).paid : 0;
    openSheet({
      title: d ? 'Ubah Catatan' : 'Utang / Piutang Baru',
      body: `
        ${
          d
            ? ''
            : `<div class="seg" id="kindSeg"><button type="button" data-kind="debt">Utang (kita berutang)</button><button type="button" data-kind="receivable">Piutang (orang berutang)</button></div>`
        }
        ${textField('party', 'Nama pihak terkait', d?.party || '', 'mis. Budi / Koperasi', 'maxlength="60"')}
        ${rpField('total', 'Total nominal (pokok)', d?.total || 0)}
        <div class="grid grid-cols-2 gap-3">
          ${dateField('date', 'Tanggal pinjaman', d?.date || today())}
          ${dateField('dueDate', 'Jatuh tempo', d?.dueDate || '')}
        </div>
        <div><label class="lbl" for="f_tenor">Tenor (bulan, opsional)</label><input id="f_tenor" name="tenor" type="number" min="0" max="600" inputmode="numeric" class="input" value="${d?.tenor || ''}" placeholder="mis. 12" /></div>
        ${textField('note', 'Catatan', d?.note || '', 'Opsional', 'maxlength="160"')}
        ${
          d
            ? ''
            : `<div>${selectField('walletId', 'Catat ke dompet (opsional)', [['', 'Jangan catat ke dompet'], ...walletOptions()], '')}<p class="mt-1.5 text-[12px] text-ios-secondary" id="walletHint"></p></div>`
        }`,
      onMount(form) {
        if (d) return;
        const seg = $('#kindSeg', form);
        const hint = $('#walletHint', form);
        const sync = () => {
          $$('button', seg).forEach((b) => b.classList.toggle('active', b.dataset.kind === kind));
          hint.textContent = kind === 'debt' ? 'Jika dipilih: saldo dompet bertambah sebesar nominal (uang pinjaman diterima).' : 'Jika dipilih: saldo dompet berkurang sebesar nominal (uang dipinjamkan).';
        };
        sync();
        seg.addEventListener('click', (e) => {
          const b = e.target.closest('button[data-kind]');
          if (b) {
            kind = b.dataset.kind;
            sync();
          }
        });
        setTimeout(() => form.elements.party.focus(), 120);
      },
      async onSubmit(form) {
        const party = form.elements.party.value.trim();
        const total = getRp(form, 'total');
        if (!party) return toast('Isi nama pihak terkait', 'error'), false;
        if (!(total > 0)) return toast('Isi total nominal', 'error'), false;
        if (d && total < paid) return toast(`Total tidak boleh kurang dari yang sudah dibayar (${rp(paid)})`, 'error'), false;
        const dueDate = form.elements.dueDate.value;
        const date = form.elements.date.value || today();
        if (dueDate && dueDate < date) return toast('Jatuh tempo tidak boleh sebelum tanggal pinjaman', 'error'), false;
        const rec = {
          id: d?.id || uid(),
          kind,
          party,
          total,
          date,
          dueDate,
          tenor: Math.max(0, Math.round(Number(form.elements.tenor.value) || 0)),
          note: form.elements.note.value.trim(),
          createdAt: d?.createdAt || Date.now(),
        };
        await put('debts', rec);
        if (d) {
          const origin = S.transactions.find((t) => t.debtId === d.id && t.sys === 'origin');
          if (origin) await put('transactions', { ...origin, amount: total, note: party });
        } else if (form.elements.walletId.value) {
          const wid = form.elements.walletId.value;
          await put('transactions', {
            id: uid(),
            type: kind === 'debt' ? 'income' : 'expense',
            amount: total,
            walletId: wid,
            date,
            category: kind === 'debt' ? 'Pinjaman Diterima' : 'Pinjaman Diberikan',
            note: party,
            sys: 'origin',
            debtId: rec.id,
            createdAt: Date.now(),
          });
          ui.lastWallet = wid;
        }
        ui.debtTab = kind;
        toast('Tersimpan');
      },
    });
  }

  function openPaySheet(debtId) {
    const d = S.debts.find((x) => x.id === debtId);
    if (!d) return;
    const info = debtInfo(d);
    const isDebt = d.kind === 'debt';
    const suggested = d.tenor ? Math.min(info.remaining, Math.ceil(d.total / d.tenor)) : 0;
    openSheet({
      title: isDebt ? 'Bayar Cicilan' : 'Terima Cicilan',
      body: `
        <p class="text-center text-[14px] text-ios-secondary">${esc(d.party)} · sisa <b class="text-ios-label">${rp(info.remaining)}</b></p>
        <div class="amount-box"><span>Rp</span><input name="amount" data-rp inputmode="numeric" placeholder="0" value="${suggested ? fmtNum(suggested) : ''}" aria-label="Jumlah" /></div>
        <div class="flex gap-2"><button type="button" class="btn btn-soft flex-1 !py-2" data-act="payFull" data-v="${info.remaining}">Lunasi (${rp(info.remaining)})</button></div>
        ${selectField('walletId', isDebt ? 'Dibayar dari dompet' : 'Diterima ke dompet', walletOptions(), wallet(ui.lastWallet) ? ui.lastWallet : S.wallets[0]?.id)}
        ${dateField('date', 'Tanggal', today())}
        ${textField('note', 'Catatan', '', 'Opsional', 'maxlength="120"')}
        <p class="text-[12px] text-ios-secondary">${isDebt ? 'Saldo dompet akan berkurang' : 'Saldo dompet akan bertambah'} dan sisa pokok diperbarui otomatis.</p>`,
      submit: 'Simpan',
      after: () => openDebtSheet(debtId),
      onMount: (f) => setTimeout(() => f.elements.amount.focus(), 120),
      async onSubmit(form) {
        if (!S.wallets.length) return toast('Belum ada dompet', 'error'), false;
        const amount = getRp(form, 'amount');
        if (!(amount > 0)) return toast('Masukkan jumlah', 'error'), false;
        if (amount > info.remaining) return toast(`Melebihi sisa (${rp(info.remaining)})`, 'error'), false;
        const walletId = form.elements.walletId.value;
        await put('transactions', {
          id: uid(),
          type: isDebt ? 'expense' : 'income',
          amount,
          walletId,
          date: form.elements.date.value || today(),
          category: isDebt ? 'Bayar Utang' : 'Terima Piutang',
          note: form.elements.note.value.trim() || d.party,
          sys: 'pay',
          debtId: d.id,
          createdAt: Date.now(),
        });
        ui.lastWallet = walletId;
        toast(isDebt ? 'Cicilan dibayar' : 'Cicilan diterima');
      },
    });
  }

  /* ---------- Budget ---------- */
  function openBudgetSheet(id) {
    const b = id ? S.budgets.find((x) => x.id === id) : null;
    const available = cats('expense').filter((c) => !S.budgets.some((x) => x.category === c) || c === b?.category);
    if (!b && !available.length) return toast('Semua kategori sudah punya budget');
    openSheet({
      title: b ? 'Ubah Budget' : 'Budget Baru',
      body: `
        ${selectField('category', 'Kategori pengeluaran', available.map((c) => [c, c]), b?.category || available[0], b ? 'disabled' : '')}
        ${rpField('limit', 'Batas per bulan', b?.limit || 0)}
        <p class="text-[12px] text-ios-secondary">Indikator: hijau &lt; 70%, kuning 70–90%, merah &gt; 90% atau melebihi budget.</p>
        ${b ? `<button type="button" class="btn btn-danger w-full" data-act="delBudget" data-id="${b.id}">Hapus Budget</button>` : ''}`,
      onMount: (f) => !b && setTimeout(() => f.elements.limit.focus(), 120),
      async onSubmit(form) {
        const limit = getRp(form, 'limit');
        if (!(limit > 0)) return toast('Isi batas budget', 'error'), false;
        await put('budgets', { id: b?.id || uid(), category: b ? b.category : form.elements.category.value, limit });
        toast('Budget tersimpan');
      },
    });
  }

  /* ==================================================================
   * 8. DATA: backup, CSV, cetak
   * ================================================================== */
  function saveFile(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    // iPhone/iPad (terutama mode standalone): lembar Bagikan lebih andal daripada <a download>
    try {
      const file = new File([blob], name, { type: mime });
      if (isIOS() && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: name }).catch((e) => {
          if (e && e.name !== 'AbortError') toast('Gagal membagikan file', 'error');
        });
        return;
      }
    } catch {}
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function exportJSON() {
    const payload = {
      app: 'keuanganku',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        wallets: S.wallets,
        transactions: S.transactions,
        debts: S.debts,
        budgets: S.budgets,
        settings: S.settings,
      },
    };
    saveFile(`keuanganku-backup-${today()}.json`, JSON.stringify(payload, null, 2), 'application/json');
    toast('Backup JSON dibuat');
  }

  function sanitizeBackup(obj) {
    const d = obj && obj.data;
    if (!obj || obj.app !== 'keuanganku' || !d || typeof d !== 'object') throw new Error('File bukan backup KeuanganKu');
    const arr = (k) => (Array.isArray(d[k]) ? d[k] : []);
    const str = (v, n = 200) => String(v ?? '').slice(0, n);
    const int = (v) => Math.round(Number(v) || 0);
    const dateOk = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const wallets = arr('wallets')
      .filter((w) => w && w.id && w.name)
      .map((w, i) => ({ id: str(w.id, 80), name: str(w.name, 60), type: WTYPES[w.type] ? w.type : 'cash', initial: int(w.initial), createdAt: Number(w.createdAt) || i + 1 }))
      .sort(byCreated);
    const transactions = arr('transactions')
      .filter((t) => t && t.id && ['income', 'expense', 'transfer'].includes(t.type) && dateOk(t.date) && int(t.amount) > 0)
      .map((t) => ({
        id: str(t.id, 80),
        type: t.type,
        amount: int(t.amount),
        walletId: str(t.walletId, 80),
        ...(t.toWalletId ? { toWalletId: str(t.toWalletId, 80) } : {}),
        ...(t.fee ? { fee: int(t.fee) } : {}),
        date: t.date,
        category: str(t.category, 60),
        note: str(t.note, 200),
        ...(t.sys ? { sys: str(t.sys, 10) } : {}),
        ...(t.debtId ? { debtId: str(t.debtId, 80) } : {}),
        ...(t.linkId ? { linkId: str(t.linkId, 80) } : {}),
        createdAt: Number(t.createdAt) || Date.now(),
      }));
    const debts = arr('debts')
      .filter((x) => x && x.id && x.party && ['debt', 'receivable'].includes(x.kind) && int(x.total) > 0)
      .map((x) => ({
        id: str(x.id, 80),
        kind: x.kind,
        party: str(x.party, 60),
        total: int(x.total),
        date: dateOk(x.date) ? x.date : today(),
        dueDate: dateOk(x.dueDate) ? x.dueDate : '',
        tenor: Math.max(0, int(x.tenor)),
        note: str(x.note, 160),
        createdAt: Number(x.createdAt) || Date.now(),
      }));
    const budgets = arr('budgets')
      .filter((b) => b && b.id && b.category && int(b.limit) > 0)
      .map((b) => ({ id: str(b.id, 80), category: str(b.category, 60), limit: int(b.limit) }));
    const s = d.settings || {};
    const cc = (k) => (Array.isArray(s.customCats?.[k]) ? s.customCats[k].map((c) => str(c, 40)).filter(Boolean) : []);
    const settings = { theme: ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto', customCats: { expense: cc('expense'), income: cc('income') } };
    return { wallets, transactions, debts, budgets, settings };
  }

  async function importJSON(file) {
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('File terlalu besar');
      const clean = sanitizeBackup(JSON.parse(await file.text()));
      const ok = await confirmBox({
        title: 'Pulihkan data?',
        message: `Ditemukan ${clean.wallets.length} dompet, ${clean.transactions.length} transaksi, ${clean.debts.length} utang/piutang. Data saat ini di perangkat akan DIGANTI.`,
        ok: 'Ganti Data',
      });
      if (!ok) return;
      await Store.replaceAll({
        wallets: clean.wallets,
        transactions: clean.transactions,
        debts: clean.debts,
        budgets: clean.budgets,
        meta: [{ id: 'settings', ...clean.settings }, { id: 'init', done: true }],
      });
      Object.assign(S, { wallets: clean.wallets, transactions: clean.transactions, debts: clean.debts, budgets: clean.budgets, settings: clean.settings });
      ui.lastWallet = S.wallets[0]?.id || null;
      applyTheme();
      render();
      markDirty();
      toast('Data berhasil dipulihkan');
    } catch (e) {
      console.error(e);
      toast('Import gagal: ' + e.message, 'error', 4000);
    }
  }

  // CSV aman-Excel: BOM UTF-8, pemisah ';' + baris "sep=;" (terbaca benar di Excel locale Indonesia maupun US).
  function csvCell(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah formula injection
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCSV(list) {
    const rows = [['Tanggal', 'Jenis', 'Kategori', 'Dompet', 'Ke Dompet', 'Jumlah', 'Catatan']];
    sortTx(list)
      .reverse()
      .forEach((t) => rows.push([t.date, TYPE_LABEL[t.type], t.category || '', wname(t.walletId), t.toWalletId ? wname(t.toWalletId) : '', t.amount, t.note || '']));
    return '﻿sep=;\r\n' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  }
  function exportCSV(list, label) {
    if (!list.length) return toast('Tidak ada transaksi untuk diekspor', 'error');
    saveFile(`keuanganku-transaksi-${label}.csv`, buildCSV(list), 'text/csv;charset=utf-8');
    toast(`CSV dibuat (${list.length} baris)`);
  }

  function printReport(list, periodLabel) {
    const bal = balances();
    const real = list.filter((t) => !t.sys);
    const inc = sum(real.filter((t) => t.type === 'income'), (t) => t.amount);
    const exp = sum(real.filter((t) => t.type === 'expense'), (t) => t.amount);
    let recv = 0,
      owe = 0;
    S.debts.forEach((d) => {
      const i = debtInfo(d);
      d.kind === 'debt' ? (owe += i.remaining) : (recv += i.remaining);
    });
    const walletsTotal = sum(S.wallets, (w) => bal[w.id] || 0);
    const rows = sortTx(list).reverse();
    const debtRows = S.debts.map((d) => ({ d, i: debtInfo(d) })).filter((x) => x.i.remaining > 0);
    $('#printArea').innerHTML = `
      <h1>Laporan Keuangan</h1>
      <div class="meta">Periode: ${esc(periodLabel)} · Dicetak: ${esc(fmtDate(today()))}</div>
      <div class="sum">
        <div><small>Pemasukan</small><b class="in">${rp(inc)}</b></div>
        <div><small>Pengeluaran</small><b class="out">${rp(exp)}</b></div>
        <div><small>Selisih</small><b>${rp(inc - exp)}</b></div>
        <div><small>Net Worth</small><b>${rp(walletsTotal + recv - owe)}</b></div>
      </div>
      <h2>Saldo Dompet</h2>
      <table><thead><tr><th>Dompet</th><th>Jenis</th><th class="r">Saldo</th></tr></thead><tbody>
        ${S.wallets.map((w) => `<tr><td>${esc(w.name)}</td><td>${esc(WTYPES[w.type]?.label || '')}</td><td class="r">${rp(bal[w.id] || 0)}</td></tr>`).join('') || '<tr><td colspan="3">—</td></tr>'}
        <tr><td colspan="2"><b>Total</b></td><td class="r"><b>${rp(walletsTotal)}</b></td></tr>
      </tbody></table>
      <h2>Utang &amp; Piutang Aktif</h2>
      <table><thead><tr><th>Jenis</th><th>Pihak</th><th>Jatuh tempo</th><th class="r">Total</th><th class="r">Sisa</th></tr></thead><tbody>
        ${debtRows.map(({ d, i }) => `<tr><td>${d.kind === 'debt' ? 'Utang' : 'Piutang'}</td><td>${esc(d.party)}</td><td>${d.dueDate ? esc(fmtDate(d.dueDate)) : '—'}</td><td class="r">${rp(d.total)}</td><td class="r">${rp(i.remaining)}</td></tr>`).join('') || '<tr><td colspan="5">Tidak ada.</td></tr>'}
      </tbody></table>
      <h2>Transaksi (${rows.length})</h2>
      <table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Dompet</th><th>Catatan</th><th class="r">Jumlah</th></tr></thead><tbody>
        ${
          rows
            .map(
              (t) => `<tr><td>${esc(fmtDate(t.date))}</td><td>${TYPE_LABEL[t.type]}</td><td>${esc(t.category || '')}</td><td>${esc(wname(t.walletId))}${t.toWalletId ? ' → ' + esc(wname(t.toWalletId)) : ''}</td><td>${esc(t.note || '')}</td><td class="r ${t.type === 'income' ? 'in' : t.type === 'expense' ? 'out' : ''}">${t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}${rp(t.amount)}</td></tr>`
            )
            .join('') || '<tr><td colspan="6">Tidak ada transaksi.</td></tr>'
        }
      </tbody></table>`;
    setTimeout(() => window.print(), 80);
  }

  const monthTx = () => S.transactions.filter((t) => t.date.startsWith(ui.month));
  const filterLabel = () => {
    const f = ui.filters;
    return f.from || f.to ? `${f.from ? fmtDate(f.from) : '…'} – ${f.to ? fmtDate(f.to) : '…'}` : hasFilters() ? 'Hasil filter' : 'Semua waktu';
  };

  /* ==================================================================
   * 8b. CLOUD SYNC (Supabase: login email + 1 baris snapshot per pengguna)
   *  - Data tetap disimpan lokal (offline-first); cloud hanya salinan sinkron.
   *  - Perubahan dikirim otomatis (debounce), dan diambil saat app dibuka/aktif.
   *  - Kunci "publishable" aman ada di klien: akses dibatasi RLS per pengguna.
   * ================================================================== */
  const SB = { url: 'https://mwhibvrrarqzsbqilhoo.supabase.co', key: 'sb_publishable_Dm0KmePoeyC-MFmuzJ5u-g_02vXKKnJ' };
  const SYNC_KEY = 'kf-sync';
  function loadSync() {
    try {
      return JSON.parse(localStorage.getItem(SYNC_KEY)) || {};
    } catch {
      return {};
    }
  }
  const sync = Object.assign({ access: '', refresh: '', exp: 0, email: '', rev: 0, dirty: false, last: 0 }, loadSync());
  function saveSync() {
    try {
      localStorage.setItem(SYNC_KEY, JSON.stringify(sync));
    } catch {}
  }
  const loggedIn = () => !!sync.refresh;
  let syncing = false,
    syncTimer = null,
    syncErr = '',
    ver = 0;

  function markDirty() {
    if (!loggedIn()) return;
    ver++;
    sync.dirty = true;
    saveSync();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncNow(), 2500);
    updateSyncUI();
  }

  const authMsg = (m) =>
    /invalid login/i.test(m) ? 'Email atau password salah'
    : /already registered|already been registered/i.test(m) ? 'Email sudah terdaftar, silakan Masuk'
    : /not confirmed/i.test(m) ? 'Email belum dikonfirmasi. Cek inbox Anda.'
    : /signups? not allowed|disabled/i.test(m) ? 'Pendaftaran baru dinonaktifkan'
    : /password/i.test(m) && /6|short|weak/i.test(m) ? 'Password minimal 6 karakter'
    : /rate limit/i.test(m) ? 'Terlalu banyak percobaan, coba lagi nanti'
    : m;

  async function sbAuth(path, body) {
    const r = await fetch(`${SB.url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB.key },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(authMsg(j.msg || j.error_description || j.message || `HTTP ${r.status}`));
      e.status = r.status;
      throw e;
    }
    return j;
  }
  function setSession(j) {
    sync.access = j.access_token;
    sync.refresh = j.refresh_token;
    sync.exp = Date.now() + (j.expires_in || 3600) * 1000;
    if (j.user && j.user.email) sync.email = j.user.email;
    saveSync();
  }
  async function token() {
    if (sync.access && Date.now() < sync.exp - 60000) return sync.access;
    try {
      setSession(await sbAuth('token?grant_type=refresh_token', { refresh_token: sync.refresh }));
    } catch (e) {
      if (e.status >= 400 && e.status < 500) {
        signOut();
        toast('Sesi berakhir, silakan masuk lagi', 'error', 4000);
      }
      throw e;
    }
    return sync.access;
  }
  async function rest(method, query, body) {
    const t = await token();
    const r = await fetch(`${SB.url}/rest/v1/kf_snapshots${query}`, {
      method,
      headers: { 'Content-Type': 'application/json', apikey: SB.key, Authorization: 'Bearer ' + t, Prefer: 'return=representation' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await r.text();
    let j = null;
    try {
      j = txt ? JSON.parse(txt) : null;
    } catch {}
    if (!r.ok) {
      const e = new Error((j && (j.message || j.msg)) || `HTTP ${r.status}`);
      e.status = r.status;
      throw e;
    }
    return j;
  }

  const snapshot = () => ({
    wallets: S.wallets,
    transactions: S.transactions,
    debts: S.debts,
    budgets: S.budgets,
    settings: { customCats: S.settings.customCats },
  });
  const isPristine = () => !S.transactions.length && !S.debts.length && !S.budgets.length && S.wallets.every((w) => !w.initial);

  async function applyRemote(data) {
    const clean = sanitizeBackup({ app: 'keuanganku', data });
    clean.settings.theme = S.settings.theme; // tema tetap per perangkat
    await Store.replaceAll({
      wallets: clean.wallets,
      transactions: clean.transactions,
      debts: clean.debts,
      budgets: clean.budgets,
      meta: [{ id: 'settings', ...clean.settings }, { id: 'init', done: true }],
    });
    Object.assign(S, { wallets: clean.wallets, transactions: clean.transactions, debts: clean.debts, budgets: clean.budgets, settings: clean.settings });
    if (!wallet(ui.lastWallet)) ui.lastWallet = S.wallets[0]?.id || null;
    render();
  }

  // Gabungkan (union per id) bila dua perangkat sama-sama mengubah data sebelum sempat sinkron.
  function mergeData(remote) {
    const loc = snapshot();
    const un = (a, b) => {
      const m = new Map();
      (b || []).forEach((x) => m.set(x.id, x));
      a.forEach((x) => m.set(x.id, x)); // data perangkat ini menang bila id sama
      return [...m.values()];
    };
    const seen = new Set();
    const budgets = un(loc.budgets, remote.budgets).filter((b) => (seen.has(b.category) ? false : seen.add(b.category)));
    const cc = (k) => [...new Set([...(loc.settings.customCats[k] || []), ...(remote.settings?.customCats?.[k] || [])])];
    return {
      wallets: un(loc.wallets, remote.wallets),
      transactions: un(loc.transactions, remote.transactions),
      debts: un(loc.debts, remote.debts),
      budgets,
      settings: { customCats: { expense: cc('expense'), income: cc('income') } },
    };
  }

  async function push(base, data) {
    const v = ver;
    const body = data || snapshot();
    let res;
    try {
      if (base == null) res = await rest('POST', '', { data: body, rev: 1 });
      else {
        res = await rest('PATCH', `?rev=eq.${base}`, { data: body, rev: base + 1, updated_at: new Date().toISOString() });
        if (!res || !res.length) {
          const e = new Error('conflict');
          e.conflict = true;
          throw e;
        }
      }
    } catch (e) {
      if (e.status === 409) e.conflict = true;
      throw e;
    }
    const row = Array.isArray(res) ? res[0] : res;
    sync.rev = row.rev;
    sync.dirty = ver !== v; // perubahan yang terjadi selama proses kirim tetap ditandai
    saveSync();
  }

  async function syncNow({ manual = false } = {}) {
    if (!loggedIn() || syncing) return;
    if (!navigator.onLine) {
      if (manual) toast('Tidak ada koneksi internet', 'error');
      return;
    }
    syncing = true;
    syncErr = '';
    updateSyncUI();
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const rows = await rest('GET', '?select=data,rev&limit=1');
        const remote = rows && rows[0];
        try {
          if (!remote) {
            if (!(sync.rev === 0 && isPristine())) await push(null);
          } else if (remote.rev === sync.rev) {
            if (sync.dirty) await push(remote.rev);
          } else if (sync.rev === 0 && !isPristine()) {
            // Pertama kali terhubung, dan perangkat ini sudah punya data berbeda dari cloud
            if (await confirmBox({ title: 'Data cloud ditemukan', message: 'Data di cloud berbeda dengan data di perangkat ini. Ganti data perangkat ini dengan data cloud?', ok: 'Pakai Data Cloud', danger: false })) {
              await applyRemote(remote.data);
              sync.rev = remote.rev;
              sync.dirty = false;
            } else if (await confirmBox({ title: 'Timpa data cloud?', message: 'Data di cloud akan DIGANTI dengan data perangkat ini.', ok: 'Timpa Cloud' })) {
              await push(remote.rev);
            } else {
              signOut();
              toast('Sinkronisasi dibatalkan');
              return;
            }
          } else if (!sync.dirty || sync.rev === 0) {
            await applyRemote(remote.data);
            sync.rev = remote.rev;
            sync.dirty = false;
          } else {
            // konflik nyata: dua sisi berubah → gabungkan lalu kirim
            const merged = mergeData(remote.data);
            await applyRemote(merged);
            await push(remote.rev, merged);
            toast('Data dari dua perangkat digabungkan');
          }
          saveSync();
          break;
        } catch (e) {
          if (e.conflict && attempt < 2) continue;
          throw e;
        }
      }
      sync.last = Date.now();
      saveSync();
    } catch (e) {
      console.warn('sync gagal:', e);
      syncErr = e.message === 'Failed to fetch' ? 'Tidak ada koneksi, akan dicoba lagi' : e.message;
    } finally {
      syncing = false;
      updateSyncUI();
      if (sync.dirty && loggedIn() && !syncErr) {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => syncNow(), 2500);
      }
    }
  }

  function signOut() {
    sync.access = sync.refresh = '';
    sync.exp = 0;
    sync.rev = 0;
    sync.dirty = false;
    saveSync();
    updateSyncUI();
  }

  async function authSubmit(mode) {
    const email = ($('#syncEmail') || {}).value?.trim();
    const pw = ($('#syncPass') || {}).value;
    if (!email || !pw) return toast('Isi email dan password', 'error');
    if (pw.length < 6) return toast('Password minimal 6 karakter', 'error');
    try {
      const j = mode === 'signup' ? await sbAuth('signup', { email, password: pw }) : await sbAuth('token?grant_type=password', { email, password: pw });
      if (!j.access_token) return toast('Cek email Anda untuk konfirmasi, lalu pilih Masuk.', 'info', 6000);
      sync.rev = 0;
      sync.dirty = false;
      setSession(j);
      updateSyncUI();
      await syncNow({ manual: true });
      if (!syncErr && loggedIn()) toast('Sinkronisasi aktif');
    } catch (e) {
      toast(e.message === 'Failed to fetch' ? 'Tidak ada koneksi internet' : e.message, 'error', 4500);
    }
  }

  function syncBoxHTML() {
    if (!loggedIn()) {
      return `
        <form id="syncForm" class="grid gap-3" novalidate>
          <p class="text-[14px] text-ios-secondary">Masuk agar data otomatis tersinkron di HP dan laptop, sekaligus tersimpan aman di cloud.</p>
          <input id="syncEmail" type="email" autocomplete="email" inputmode="email" class="input" placeholder="Email" />
          <input id="syncPass" type="password" autocomplete="current-password" class="input" placeholder="Password (min. 6 karakter)" />
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="btn btn-primary" data-act="syncLogin">Masuk</button>
            <button type="button" class="btn btn-gray" data-act="syncSignup">Daftar</button>
          </div>
        </form>`;
    }
    const when = sync.last ? new Date(sync.last).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const status = syncing ? 'Menyinkronkan…' : syncErr ? '⚠️ ' + esc(syncErr) : sync.dirty ? 'Perubahan menunggu dikirim…' : when ? '✓ Tersinkron ' + esc(when) : 'Belum disinkronkan';
    return `
      <div class="grid gap-3">
        <div><p class="text-[13px] text-ios-secondary">Masuk sebagai</p><p class="break-all font-semibold">${esc(sync.email)}</p></div>
        <p class="text-[14px] ${syncErr ? 'text-ios-red' : 'text-ios-secondary'}">${status}</p>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="btn btn-soft" data-act="syncBtn">Sinkronkan Sekarang</button>
          <button type="button" class="btn btn-gray" data-act="syncLogout">Keluar</button>
        </div>
        <p class="text-[12px] text-ios-secondary">Otomatis: saat aplikasi dibuka, tiap ada perubahan, dan berkala. Data tetap bisa dipakai offline.</p>
      </div>`;
  }
  function updateSyncUI() {
    const b = $('#syncBox');
    if (b && !b.contains(document.activeElement)) b.innerHTML = syncBoxHTML();
  }

  /* ==================================================================
   * 9. ACTIONS & BOOT
   * ================================================================== */
  function applyTheme() {
    const t = S.settings.theme;
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    $('#metaTheme').setAttribute('content', dark ? '#000000' : '#f2f2f7');
    try {
      localStorage.setItem('kf-theme', t);
    } catch {}
  }

  const ACT = {
    closeSheet: () => closeSheet(),
    syncLogin: () => authSubmit('login'),
    syncSignup: () => authSubmit('signup'),
    syncBtn: () => syncNow({ manual: true }),
    async syncLogout() {
      if (!(await confirmBox({ title: 'Keluar dari sinkronisasi?', message: 'Data di perangkat ini tetap ada. Perubahan berikutnya tidak lagi dikirim ke cloud.', ok: 'Keluar' }))) return;
      signOut();
    },
    sheetBackdrop: (el, e) => e.target === el && closeSheet(),
    addTx: () => openTxSheet(),
    editTx: (el) => openTxSheet(S.transactions.find((t) => t.id === el.dataset.id)),
    async delTx(el) {
      const t = S.transactions.find((x) => x.id === el.dataset.id);
      if (!t) return;
      if (!(await confirmBox({ title: 'Hapus transaksi?', message: 'Saldo dompet akan dihitung ulang.' }))) return;
      for (const x of S.transactions.filter((x) => x.linkId === t.id)) await del('transactions', x.id);
      await del('transactions', t.id);
      closeSheet();
      toast('Transaksi dihapus');
    },
    monthPrev: () => ((ui.month = shiftMonth(ui.month, -1)), render()),
    monthNext: () => ((ui.month = shiftMonth(ui.month, 1)), render()),
    loadMore: () => ((ui.txLimit += 100), updateTxList()),
    clearFilters: () => ((ui.filters = { q: '', from: '', to: '', wallet: '', cat: '', type: '' }), (ui.txLimit = 100), render()),
    exportCSVFiltered: () => exportCSV(filteredTx(), hasFilters() ? 'filter' : 'semua'),
    printFiltered: () => printReport(filteredTx(), filterLabel()),
    exportCSV: () => exportCSV(monthTx(), ui.month),
    printMonth: () => printReport(monthTx(), monthLabel(ui.month)),
    exportJSON,
    importJSON: () => $('#fileImport').click(),
    setTheme(el) {
      S.settings.theme = el.dataset.v;
      saveSettings(false);
      applyTheme();
      render();
    },
    async resetAll() {
      if (!(await confirmBox({ title: 'Hapus semua data?', message: 'Semua dompet, transaksi, utang, dan budget di perangkat ini akan dihapus permanen. Buat backup JSON dulu bila perlu.', ok: 'Hapus Semua' }))) return;
      await Store.replaceAll({ wallets: [], transactions: [], debts: [], budgets: [], meta: [{ id: 'init', done: true }] });
      Object.assign(S, { wallets: [], transactions: [], debts: [], budgets: [], settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) });
      ui.lastWallet = null;
      applyTheme();
      render();
      markDirty();
      toast('Semua data dihapus');
    },
    // Dompet
    addWallet: () => openWalletSheet(),
    editWallet: (el) => openWalletSheet(el.dataset.id),
    async delWallet(el) {
      const id = el.dataset.id;
      if (S.transactions.some((t) => t.walletId === id || t.toWalletId === id)) return toast('Dompet masih punya transaksi. Hapus/pindahkan transaksinya dulu.', 'error', 4000);
      if (!(await confirmBox({ title: 'Hapus dompet?', message: wname(id) }))) return;
      await del('wallets', id);
      closeSheet();
      toast('Dompet dihapus');
    },
    // Utang
    debtTab: (el) => ((ui.debtTab = el.dataset.v), render()),
    addDebt: () => openDebtForm(),
    openDebt: (el) => openDebtSheet(el.dataset.id),
    editDebt: (el) => openDebtForm(el.dataset.id),
    payDebt: (el) => openPaySheet(el.dataset.id),
    payFull(el) {
      const inp = $('input[name=amount]', el.closest('form'));
      inp.value = fmtNum(Number(el.dataset.v));
    },
    async delPay(el) {
      const p = S.transactions.find((t) => t.id === el.dataset.id);
      if (!p) return;
      if (!(await confirmBox({ title: 'Hapus riwayat ini?', message: 'Saldo dompet dan sisa pokok akan dikembalikan.' }))) return;
      await del('transactions', p.id);
      openDebtSheet(p.debtId);
    },
    async delDebt(el) {
      const id = el.dataset.id;
      const d = S.debts.find((x) => x.id === id);
      if (!d) return;
      if (!(await confirmBox({ title: `Hapus ${d.kind === 'debt' ? 'utang' : 'piutang'} “${d.party}”?`, message: 'Seluruh riwayat cicilan & transaksi terkait ikut dihapus, saldo dompet dihitung ulang.' }))) return;
      for (const t of S.transactions.filter((x) => x.debtId === id)) await del('transactions', t.id);
      await del('debts', id);
      closeSheet();
      toast('Dihapus');
    },
    // Budget
    addBudget: () => openBudgetSheet(),
    editBudget: (el) => openBudgetSheet(el.dataset.id),
    async delBudget(el) {
      if (!(await confirmBox({ title: 'Hapus budget?' }))) return;
      await del('budgets', el.dataset.id);
      closeSheet();
    },
  };
  function updateTxList() {
    const box = $('#txList');
    if (box) box.innerHTML = txListHTML();
    const rw = $('#resetWrap');
    if (rw) rw.innerHTML = resetBtn();
  }

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const fn = ACT[el.dataset.act];
      if (fn) fn(el, e);
    });
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (t.matches('[data-rp]')) return formatRpInput(t);
      if (t.matches('[data-filter]')) {
        ui.filters[t.dataset.filter] = t.value;
        ui.txLimit = 100;
        updateTxList(); // hanya daftar yang diganti, input tetap fokus (keyboard iOS tidak menutup)
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSheet();
    });
    $('#fileImport').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) importJSON(f);
    });
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'syncForm') {
        e.preventDefault();
        authSubmit('login');
      }
    });
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow());
    window.addEventListener('online', () => syncNow());
    setInterval(() => document.visibilityState === 'visible' && !sync.dirty && syncNow(), 90000);
    window.addEventListener('hashchange', onRoute);
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => S.settings.theme === 'auto' && applyTheme());
  }

  function registerSW() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        const prompt = () => {
          const el = document.createElement('div');
          el.className = 'toast pointer-events-auto';
          el.innerHTML = 'Versi baru tersedia · <button class="font-bold underline" id="swReload">Muat ulang</button>';
          $('#toastRoot').appendChild(el);
          $('#swReload').onclick = () => reg.waiting && reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        };
        if (reg.waiting && navigator.serviceWorker.controller) prompt();
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw &&
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) prompt();
            });
        });
      })
      .catch((e) => console.warn('SW gagal:', e));
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  }

  async function boot() {
    bindEvents();
    try {
      await loadAll();
    } catch (e) {
      console.error(e);
      $('#view').innerHTML = `<div class="card mt-10 text-center"><p class="font-semibold">Penyimpanan tidak dapat diakses</p><p class="mt-1 text-[14px] text-ios-secondary">${esc(e.message)}. Coba keluar dari mode Private Browsing.</p></div>`;
      return;
    }
    applyTheme();
    // Minta penyimpanan persisten agar iOS/Chrome tidak menghapus data saat ruang menipis
    try {
      navigator.storage && navigator.storage.persist && navigator.storage.persist();
    } catch {}
    onRoute();
    registerSW();
    syncNow();
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'add') {
      history.replaceState(null, '', location.pathname + location.hash);
      openTxSheet();
    }
  }

  // Hook untuk pengujian/debug
  window.__kf = { S, ui, rp, balances, debtInfo, monthStats, sync };
  boot();
})();
