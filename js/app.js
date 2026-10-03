(() => {
  'use strict';

  /* ---------- State ---------- */
  const state = {
    type: 'url',
    fg: '#201f1c',
    bg: '#faf9f6',
    size: 280,
    margin: 4,
    ec: 'M',
  };

  const PRESETS = {
    classic: { fg: '#201f1c', bg: '#faf9f6' },
    ink:     { fg: '#0d0d0d', bg: '#ffffff' },
    signal:  { fg: '#2451b3', bg: '#eef2fb' },
    paper:   { fg: '#4a4436', bg: '#f1efe9' },
    contrast:{ fg: '#000000', bg: '#ffe600' },
  };

  const RECENT_KEY = 'qr-studio.recent';
  const MAX_RECENT = 10;

  /* ---------- Elements ---------- */
  const el = (id) => document.getElementById(id);

  const canvas = el('qrCanvas');
  const emptyState = el('emptyState');
  const dataReadout = el('dataReadout');
  const scanWarning = el('scanWarning');
  const toastEl = el('toast');

  const typeTabs = el('typeTabs');
  const inputGroups = {
    url: el('inputsUrl'),
    text: el('inputsText'),
    email: el('inputsEmail'),
    phone: el('inputsPhone'),
    wifi: el('inputsWifi'),
  };

  const fields = {
    url: el('inputUrlValue'),
    text: el('inputTextValue'),
    emailTo: el('inputEmailTo'),
    emailSubject: el('inputEmailSubject'),
    emailBody: el('inputEmailBody'),
    phone: el('inputPhoneValue'),
    wifiSsid: el('inputWifiSsid'),
    wifiPassword: el('inputWifiPassword'),
    wifiSecurity: el('inputWifiSecurity'),
  };

  const errors = {
    url: el('errUrl'), text: el('errText'), email: el('errEmail'),
    phone: el('errPhone'), wifi: el('errWifi'),
  };

  const fgColor = el('fgColor');
  const bgColor = el('bgColor');
  const sizeRange = el('sizeRange');
  const sizeValue = el('sizeValue');
  const marginRange = el('marginRange');
  const marginValue = el('marginValue');
  const ecLevel = el('ecLevel');
  const presetRow = el('presetRow');

  const recentStrip = el('recentStrip');
  const recentEmpty = el('recentEmpty');
  const clearRecentBtn = el('clearRecent');

  /* ---------- Helpers ---------- */
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('is-visible'), 1800);
  }

  function escapeWifi(str) {
    return str.replace(/([\\;,:"])/g, '\\$1');
  }

  function isValidUrl(str) {
    try {
      const withScheme = /^https?:\/\//i.test(str) ? str : `https://${str}`;
      const u = new URL(withScheme);
      return !!u.hostname && u.hostname.includes('.');
    } catch { return false; }
  }

  function isValidEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  }

  function isValidPhone(str) {
    return /^[+]?[\d\s().-]{6,}$/.test(str);
  }

  /* ---------- Build payload per type ---------- */
  function buildPayload() {
    switch (state.type) {
      case 'url': {
        const v = fields.url.value.trim();
        if (!v) return { ok: false, empty: true };
        if (!isValidUrl(v)) return { ok: false, msg: 'Enter a valid URL, e.g. example.com' };
        const value = /^https?:\/\//i.test(v) ? v : `https://${v}`;
        return { ok: true, value };
      }
      case 'text': {
        const v = fields.text.value;
        if (!v.trim()) return { ok: false, empty: true };
        return { ok: true, value: v };
      }
      case 'email': {
        const to = fields.emailTo.value.trim();
        if (!to) return { ok: false, empty: true };
        if (!isValidEmail(to)) return { ok: false, msg: 'Enter a valid email address' };
        const params = new URLSearchParams();
        if (fields.emailSubject.value.trim()) params.set('subject', fields.emailSubject.value.trim());
        if (fields.emailBody.value.trim()) params.set('body', fields.emailBody.value.trim());
        const qs = params.toString();
        return { ok: true, value: `mailto:${to}${qs ? '?' + qs : ''}` };
      }
      case 'phone': {
        const v = fields.phone.value.trim();
        if (!v) return { ok: false, empty: true };
        if (!isValidPhone(v)) return { ok: false, msg: 'Enter a valid phone number' };
        return { ok: true, value: `tel:${v.replace(/[\s().-]/g, '')}` };
      }
      case 'wifi': {
        const ssid = fields.wifiSsid.value.trim();
        if (!ssid) return { ok: false, empty: true };
        const sec = fields.wifiSecurity.value;
        const pass = fields.wifiPassword.value;
        if (sec !== 'nopass' && !pass) return { ok: false, msg: 'Enter a password, or set security to None' };
        const value = `WIFI:T:${sec};S:${escapeWifi(ssid)};${sec !== 'nopass' ? `P:${escapeWifi(pass)};` : ''}${sec === 'nopass' ? 'H:false;' : ''};`;
        return { ok: true, value };
      }
      default:
        return { ok: false, empty: true };
    }
  }

  function clearErrors() {
    Object.values(errors).forEach((e) => (e.textContent = ''));
  }

  /* ---------- Generate ---------- */
  let currentValue = null;

  function generate() {
    clearErrors();
    const result = buildPayload();

    if (!result.ok) {
      currentValue = null;
      canvas.style.display = 'none';
      emptyState.style.display = 'flex';
      dataReadout.textContent = '—';
      scanWarning.classList.add('is-hidden');
      if (result.msg) {
        const key = state.type === 'email' ? 'email' : state.type === 'wifi' ? 'wifi' : state.type;
        if (errors[key]) errors[key].textContent = result.msg;
      }
      return;
    }

    currentValue = result.value;
    emptyState.style.display = 'none';
    canvas.style.display = 'block';

    QRCode.toCanvas(canvas, result.value, {
      width: state.size,
      margin: state.margin,
      errorCorrectionLevel: state.ec,
      color: { dark: state.fg, light: state.bg },
    }, (err) => {
      if (err) {
        console.error(err);
        toast('Could not generate this code — try shortening the content');
        return;
      }
      updateReadout(result.value);
      updateScanWarning();
      saveRecent(result.value, canvas.toDataURL('image/png'));
    });
  }

  function updateReadout(value) {
    dataReadout.textContent = value.length > 60 ? value.slice(0, 60) + '…' : value;
    dataReadout.title = value;
  }

  function contrastRatio(hex1, hex2) {
    const lum = (hex) => {
      const c = hex.replace('#', '');
      const r = parseInt(c.substring(0, 2), 16) / 255;
      const g = parseInt(c.substring(2, 4), 16) / 255;
      const b = parseInt(c.substring(4, 6), 16) / 255;
      const adj = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      return 0.2126 * adj(r) + 0.7152 * adj(g) + 0.0722 * adj(b);
    };
    const L1 = lum(hex1) + 0.05;
    const L2 = lum(hex2) + 0.05;
    return L1 > L2 ? L1 / L2 : L2 / L1;
  }

  function updateScanWarning() {
    const ratio = contrastRatio(state.fg, state.bg);
    const risky = ratio < 3 || state.ec === 'L';
    scanWarning.classList.toggle('is-hidden', !risky);
  }

  /* ---------- Recent (localStorage) ---------- */
  function loadRecent() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch { return []; }
  }

  function saveRecent(value, dataUrl) {
    let list = loadRecent();
    list = list.filter((item) => item.value !== value);
    list.unshift({ value, dataUrl, type: state.type, ts: Date.now() });
    list = list.slice(0, MAX_RECENT);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
    renderRecent(list);
  }

  function renderRecent(list) {
    list = list || loadRecent();
    recentStrip.querySelectorAll('.recent-item').forEach((n) => n.remove());
    recentEmpty.classList.toggle('is-hidden', list.length > 0);
    list.forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'recent-item';
      btn.title = item.value;
      btn.innerHTML = `<img src="${item.dataUrl}" alt="QR preview" />`;
      btn.addEventListener('click', () => applyRecent(item));
      recentStrip.appendChild(btn);
    });
  }

  function applyRecent(item) {
    setActiveType(item.type);
    if (item.type === 'url') fields.url.value = item.value.replace(/^https?:\/\//, '');
    if (item.type === 'text') fields.text.value = item.value;
    generate();
    toast('Loaded from recent');
  }

  clearRecentBtn.addEventListener('click', () => {
    localStorage.removeItem(RECENT_KEY);
    renderRecent([]);
    toast('Recent codes cleared');
  });

  /* ---------- Type switching ---------- */
  function setActiveType(type) {
    state.type = type;
    typeTabs.querySelectorAll('.type-tab').forEach((tab) => {
      const active = tab.dataset.type === type;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    Object.entries(inputGroups).forEach(([key, node]) => {
      node.classList.toggle('is-hidden', key !== type);
    });
    clearErrors();
  }

  typeTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.type-tab');
    if (!tab) return;
    setActiveType(tab.dataset.type);
    generate();
  });

  /* ---------- Presets ---------- */
  presetRow.addEventListener('click', (e) => {
    const chip = e.target.closest('.preset-chip');
    if (!chip) return;
    presetRow.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    const preset = PRESETS[chip.dataset.preset];
    state.fg = preset.fg;
    state.bg = preset.bg;
    fgColor.value = preset.fg;
    bgColor.value = preset.bg;
    generate();
  });

  function unsetPresetActive() {
    presetRow.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('is-active'));
  }

  /* ---------- Customization listeners ---------- */
  fgColor.addEventListener('input', () => { state.fg = fgColor.value; unsetPresetActive(); generate(); });
  bgColor.addEventListener('input', () => { state.bg = bgColor.value; unsetPresetActive(); generate(); });

  sizeRange.addEventListener('input', () => {
    state.size = Number(sizeRange.value);
    sizeValue.textContent = `${state.size}px`;
    generate();
  });

  marginRange.addEventListener('input', () => {
    state.margin = Number(marginRange.value);
    marginValue.textContent = String(state.margin);
    generate();
  });

  ecLevel.addEventListener('change', () => { state.ec = ecLevel.value; generate(); });

  /* ---------- Live input listeners (debounced) ---------- */
  let debounceTimer;
  function debouncedGenerate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(generate, 180);
  }

  [
    fields.url, fields.text, fields.emailTo, fields.emailSubject, fields.emailBody,
    fields.phone, fields.wifiSsid, fields.wifiPassword,
  ].forEach((input) => input.addEventListener('input', debouncedGenerate));
  fields.wifiSecurity.addEventListener('change', generate);

  /* ---------- Downloads ---------- */
  el('downloadPng').addEventListener('click', () => {
    if (!currentValue) { toast('Nothing to download yet'); return; }
    const link = document.createElement('a');
    link.download = `qr-${state.type}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  el('downloadSvg').addEventListener('click', () => {
    if (!currentValue) { toast('Nothing to download yet'); return; }
    QRCode.toString(currentValue, {
      type: 'svg',
      width: state.size,
      margin: state.margin,
      errorCorrectionLevel: state.ec,
      color: { dark: state.fg, light: state.bg },
    }, (err, svgString) => {
      if (err) { toast('Could not export SVG'); return; }
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `qr-${state.type}-${Date.now()}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  });

  el('copyPng').addEventListener('click', async () => {
    if (!currentValue) { toast('Nothing to copy yet'); return; }
    try {
      canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Copied to clipboard');
      });
    } catch {
      toast('Copy not supported in this browser');
    }
  });

  /* ---------- Init ---------- */
  renderRecent();
  setActiveType('url');
  fields.url.value = 'https://gdgsrm.com';
  generate();
})();
