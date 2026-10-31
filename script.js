/* ============================================
   FINEX — Nigerian Digital Wallet
   Frontend app · Data persists in localStorage
   ============================================ */

(function () {
  'use strict';

  // ---------- Constants ----------
  const STORAGE_KEY = 'finex_demo_v1';
  const INITIAL_BALANCE = 125450.00;
  const BANKS = [
    'Access Bank', 'GTBank', 'First Bank', 'UBA', 'Zenith Bank',
    'Stanbic IBTC', 'Fidelity Bank', 'Union Bank', 'Ecobank', 'Kuda',
    'Opay', 'Palmpay', 'Moniepoint', 'Wema Bank', 'Polaris Bank'
  ];
  const ELECTRICITY_PROVIDERS = ['IKEDC', 'EKEDC', 'AEDC', 'PHED', 'KEDCO', 'JED'];
  const CABLE_PROVIDERS = ['DStv', 'GOtv', 'Startimes'];
  const INTERNET_PROVIDERS = ['Spectranet', 'Smile', 'Swift', 'ipNX'];
  const NETWORKS = ['MTN', 'Airtel', 'Glo', '9mobile'];

  // ---------- State ----------
  let state = {
    user: null,
    balance: INITIAL_BALANCE,
    transactions: [],
    settings: {
      notifications: true,
      biometrics: false,
      emailAlerts: true
    }
  };

  // Current flow data (transfer, bills, etc.)
  let flow = {};

  // ---------- Helpers ----------
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function formatNaira(amount) {
    const n = Number(amount) || 0;
    return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function generateRef() {
    const t = Date.now().toString(36).toUpperCase();
    const r = Math.random().toString(36).substring(2, 8).toUpperCase();
    return 'FNX' + t + r;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const opts = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleString('en-NG', opts);
  }

  function formatShortDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  }

  function toast(msg, type) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        user: state.user,
        balance: state.balance,
        transactions: state.transactions,
        settings: state.settings
      }));
    } catch (e) {
      console.warn('localStorage save failed', e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.user) state.user = data.user;
      if (typeof data.balance === 'number') state.balance = data.balance;
      if (Array.isArray(data.transactions)) state.transactions = data.transactions;
      if (data.settings) state.settings = Object.assign(state.settings, data.settings);
    } catch (e) {
      console.warn('localStorage load failed', e);
    }
  }

  // ---------- Navigation ----------
  function showScreen(id, options) {
    options = options || {};
    $$('.screen').forEach(s => s.classList.remove('active'));
    const screen = $('#' + id);
    if (screen) {
      screen.classList.add('active');
      // Scroll top
      window.scrollTo(0, 0);
    }

    // Update bottom nav & sidebar
    const navMap = {
      'screen-dashboard': 'dashboard',
      'screen-wallet': 'wallet',
      'screen-history': 'history',
      'screen-profile': 'profile',
      'screen-bills': 'bills'
    };
    const navKey = navMap[id];
    $$('.nav-item, .side-nav button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === navKey);
    });

    // Hide bottom nav on auth & flow screens
    const appShell = $('#app-shell');
    const authScreens = ['screen-welcome', 'screen-login', 'screen-register'];
    if (authScreens.includes(id)) {
      appShell.classList.remove('visible');
      $('#bottom-nav').classList.add('hidden');
    } else {
      appShell.classList.add('visible');
      const hideNav = options.hideNav || id.startsWith('screen-transfer') ||
        id.startsWith('screen-bill-') || id === 'screen-add-money' ||
        id === 'screen-withdraw' || id === 'screen-receipt' ||
        id === 'screen-edit-profile' || id === 'screen-change-password' ||
        id === 'screen-security' || id === 'screen-notifications';
      $('#bottom-nav').classList.toggle('hidden', hideNav);
    }

    // Special renders
    if (id === 'screen-dashboard') renderDashboard();
    if (id === 'screen-wallet') renderWallet();
    if (id === 'screen-history') renderHistory(flow.historyFilter || 'all');
    if (id === 'screen-profile') renderProfile();
    if (id === 'screen-bills') { /* static */ }
  }

  function requireAuth(screenId) {
    if (!state.user) {
      showScreen('screen-welcome');
      return false;
    }
    showScreen(screenId);
    return true;
  }

  // ---------- Auth ----------
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePhone(phone) {
    const cleaned = phone.replace(/\s+/g, '');
    return /^(0|\+?234)[789][01]\d{8}$/.test(cleaned) || /^0[789][01]\d{8}$/.test(cleaned);
  }

  function registerUser(data) {
    // Store user profile locally
    state.user = {
      fullName: data.fullName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      password: data.password,
      createdAt: nowISO()
    };
    state.balance = INITIAL_BALANCE;
    state.transactions = [{
      id: generateRef(),
      type: 'credit',
      category: 'funding',
      description: 'Wallet funding',
      amount: INITIAL_BALANCE,
      date: nowISO(),
      status: 'success',
      ref: generateRef()
    }];
    saveState();
    setLoggedIn(true);
    toast('Account created successfully', 'success');
    showScreen('screen-dashboard');
  }

  function loginUser(email, password) {
    // Reload user from storage in case state was cleared on logout
    loadState();
    if (!state.user) {
      toast('No account found. Please create one first.', 'error');
      return false;
    }
    if (state.user.email !== email.trim().toLowerCase() || state.user.password !== password) {
      toast('Invalid email or password', 'error');
      return false;
    }
    setLoggedIn(true);
    toast('Welcome back!', 'success');
    showScreen('screen-dashboard');
    return true;
  }

  function setLoggedIn(flag) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        data.loggedIn = !!flag;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {}
  }

  function logout() {
    setLoggedIn(false);
    // Keep user data in localStorage so re-login works; clear in-memory session
    state.user = null;
    showScreen('screen-welcome');
    toast('Logged out');
  }

  // ---------- Transactions ----------
  function addTransaction(tx) {
    const full = Object.assign({
      id: generateRef(),
      date: nowISO(),
      status: 'success',
      ref: generateRef()
    }, tx);
    state.transactions.unshift(full);
    if (full.type === 'credit') {
      state.balance += Number(full.amount);
    } else {
      state.balance -= Number(full.amount);
    }
    // Prevent negative in demo (still allow for realism if user tries large amounts)
    if (state.balance < 0) state.balance = 0;
    saveState();
    return full;
  }

  function canDebit(amount) {
    return state.balance >= Number(amount) && Number(amount) > 0;
  }

  // ---------- Renderers ----------
  function renderDashboard() {
    if (!state.user) return;
    const first = state.user.fullName.split(' ')[0] || 'User';
    const initials = state.user.fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const topName = $('#top-name');
    const topAvatar = $('#top-avatar');
    const dashAcct = $('#dash-acct-name');
    if (topName) topName.textContent = state.user.fullName;
    if (topAvatar) topAvatar.textContent = initials;
    if (dashAcct) dashAcct.textContent = state.user.fullName;
    $('#dash-balance').textContent = formatNaira(state.balance);
    const list = $('#dash-tx-list');
    const recent = state.transactions.slice(0, 5);
    if (recent.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>No transactions yet</p></div>';
      return;
    }
    list.innerHTML = recent.map(tx => txItemHTML(tx)).join('');
    list.querySelectorAll('.tx-item').forEach(el => {
      el.addEventListener('click', () => showReceipt(el.dataset.id));
    });
  }

  function renderWallet() {
    $('#wallet-balance-amount').textContent = formatNaira(state.balance);
    const list = $('#wallet-tx-list');
    const recent = state.transactions.slice(0, 8);
    if (recent.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>No activity yet</p></div>';
      return;
    }
    list.innerHTML = recent.map(tx => txItemHTML(tx)).join('');
    list.querySelectorAll('.tx-item').forEach(el => {
      el.addEventListener('click', () => showReceipt(el.dataset.id));
    });
  }

  function renderHistory(filter) {
    flow.historyFilter = filter || 'all';
    $$('.filter-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.filter === flow.historyFilter);
    });
    let list = state.transactions;
    if (filter === 'in') list = list.filter(t => t.type === 'credit');
    if (filter === 'out') list = list.filter(t => t.type === 'debit');
    const el = $('#history-list');
    if (list.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>No transactions found</p></div>';
      return;
    }
    el.innerHTML = list.map(tx => txItemHTML(tx)).join('');
    el.querySelectorAll('.tx-item').forEach(item => {
      item.addEventListener('click', () => showReceipt(item.dataset.id));
    });
  }

  function txItemHTML(tx) {
    const isIn = tx.type === 'credit';
    const sign = isIn ? '+' : '−';
    const cat = (tx.category || tx.type || '').toLowerCase();
    let iconClass = isIn ? 'green' : 'red';
    let icon = isIn ? '↓' : '↑';
    if (cat.includes('electric') || cat.includes('bill')) { iconClass = 'blue'; icon = '⚡'; }
    else if (cat.includes('data') || cat.includes('airtime')) { iconClass = 'purple'; icon = '📶'; }
    else if (cat.includes('transfer') || cat.includes('send')) { iconClass = 'green'; icon = '✈️'; }
    else if (cat.includes('cable') || cat.includes('tv')) { iconClass = 'orange'; icon = '📺'; }
    else if (cat.includes('fund') || cat.includes('credit') || isIn) { iconClass = 'green'; icon = '💰'; }
    return `
      <div class="tx-item" data-id="${tx.id}">
        <div class="tx-icon ${iconClass}">${icon}</div>
        <div class="tx-body">
          <div class="tx-desc">${escapeHtml(tx.description)}</div>
          <div class="tx-meta">${formatShortDate(tx.date)}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${isIn ? 'in' : 'out'}">${sign}${formatNaira(tx.amount)}</div>
          <div class="tx-badge">${tx.status || 'success'}</div>
        </div>
      </div>`;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderProfile() {
    if (!state.user) return;
    const initials = state.user.fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    $('#profile-avatar').textContent = initials;
    $('#profile-name').textContent = state.user.fullName;
    $('#profile-email').textContent = state.user.email;
  }

  function showReceipt(txId) {
    const tx = state.transactions.find(t => t.id === txId);
    if (!tx) return;
    flow.currentReceipt = tx;
    const isIn = tx.type === 'credit';
    $('#receipt-icon').textContent = isIn ? '↓' : '✓';
    $('#receipt-title').textContent = isIn ? 'Money Received' : 'Payment Successful';
    $('#receipt-amount').textContent = (isIn ? '+' : '') + formatNaira(tx.amount);
    $('#receipt-desc').textContent = tx.description;
    $('#receipt-ref').textContent = tx.ref;
    $('#receipt-date').textContent = formatDate(tx.date);
    $('#receipt-status').textContent = tx.status;
    $('#receipt-type').textContent = (tx.category || tx.type).toUpperCase();
    showScreen('screen-receipt', { hideNav: true });
  }

  // ---------- Modals ----------
  function openModal(id) {
    const overlay = $('#' + id);
    if (overlay) overlay.classList.add('show');
  }

  function closeModal(id) {
    const overlay = $('#' + id);
    if (overlay) overlay.classList.remove('show');
  }

  // ---------- Form handlers ----------
  function initForms() {
    // Register
    $('#form-register').addEventListener('submit', function (e) {
      e.preventDefault();
      const fullName = $('#reg-name').value;
      const email = $('#reg-email').value;
      const phone = $('#reg-phone').value;
      const password = $('#reg-password').value;
      const confirm = $('#reg-confirm').value;
      let ok = true;

      clearErrors('form-register');
      if (!fullName || fullName.trim().length < 3) {
        showError('reg-name', 'Enter your full name');
        ok = false;
      }
      if (!validateEmail(email)) {
        showError('reg-email', 'Enter a valid email');
        ok = false;
      }
      if (!validatePhone(phone)) {
        showError('reg-phone', 'Enter a valid Nigerian phone (e.g. 0803...)');
        ok = false;
      }
      if (password.length < 6) {
        showError('reg-password', 'Password must be at least 6 characters');
        ok = false;
      }
      if (password !== confirm) {
        showError('reg-confirm', 'Passwords do not match');
        ok = false;
      }
      if (!ok) return;

      // Demo: if account already exists with different email, overwrite for simplicity
      registerUser({ fullName, email, phone, password });
    });

    // Login
    $('#form-login').addEventListener('submit', function (e) {
      e.preventDefault();
      const email = $('#login-email').value;
      const password = $('#login-password').value;
      clearErrors('form-login');
      if (!validateEmail(email)) {
        showError('login-email', 'Enter a valid email');
        return;
      }
      if (!password) {
        showError('login-password', 'Enter password');
        return;
      }
      loginUser(email, password);
    });

    // Add money
    $('#form-add-money').addEventListener('submit', function (e) {
      e.preventDefault();
      const amount = parseFloat($('#add-amount').value);
      if (!amount || amount < 100) {
        toast('Minimum funding is ₦100', 'error');
        return;
      }
      if (amount > 5000000) {
        toast('Maximum amount is ₦5,000,000', 'error');
        return;
      }
      // Simulate processing
      const btn = this.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      setTimeout(() => {
        const tx = addTransaction({
          type: 'credit',
          category: 'funding',
          description: 'Wallet funding',
          amount: amount
        });
        btn.disabled = false;
        btn.textContent = 'Add Money';
        $('#add-amount').value = '';
        toast('₦' + amount.toLocaleString() + ' added to wallet', 'success');
        showReceipt(tx.id);
      }, 900);
    });

    // Withdraw
    $('#form-withdraw').addEventListener('submit', function (e) {
      e.preventDefault();
      const amount = parseFloat($('#withdraw-amount').value);
      const bank = $('#withdraw-bank').value;
      const account = $('#withdraw-account').value;
      if (!amount || amount < 100) {
        toast('Minimum withdrawal is ₦100', 'error');
        return;
      }
      if (!canDebit(amount)) {
        toast('Insufficient balance', 'error');
        return;
      }
      if (!bank || account.length < 10) {
        toast('Enter valid bank and account number', 'error');
        return;
      }
      const btn = this.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      setTimeout(() => {
        const tx = addTransaction({
          type: 'debit',
          category: 'withdrawal',
          description: 'Withdrawal to ' + bank + ' ••••' + account.slice(-4),
          amount: amount
        });
        btn.disabled = false;
        btn.textContent = 'Withdraw';
        this.reset();
        toast('Withdrawal successful', 'success');
        showReceipt(tx.id);
      }, 1000);
    });

    // Transfer form → review
    $('#form-transfer').addEventListener('submit', function (e) {
      e.preventDefault();
      const name = $('#tf-name').value.trim();
      const bank = $('#tf-bank').value;
      const account = $('#tf-account').value.trim();
      const amount = parseFloat($('#tf-amount').value);
      const desc = $('#tf-desc').value.trim() || 'Transfer';

      clearErrors('form-transfer');
      let ok = true;
      if (!name || name.length < 2) { showError('tf-name', 'Enter recipient name'); ok = false; }
      if (!bank) { showError('tf-bank', 'Select bank'); ok = false; }
      if (!/^\d{10}$/.test(account)) { showError('tf-account', 'Enter 10-digit account number'); ok = false; }
      if (!amount || amount < 50) { showError('tf-amount', 'Minimum ₦50'); ok = false; }
      if (!canDebit(amount)) { showError('tf-amount', 'Insufficient balance'); ok = false; }
      if (!ok) return;

      flow.transfer = { name, bank, account, amount, desc };
      $('#review-name').textContent = name;
      $('#review-bank').textContent = bank;
      $('#review-account').textContent = account;
      $('#review-amount').textContent = formatNaira(amount);
      $('#review-desc').textContent = desc;
      $('#review-fee').textContent = '₦0.00';
      showScreen('screen-transfer-review', { hideNav: true });
    });

    // Confirm transfer
    $('#btn-confirm-transfer').addEventListener('click', function () {
      if (!flow.transfer) return;
      const btn = this;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Processing...';
      setTimeout(() => {
        const t = flow.transfer;
        const tx = addTransaction({
          type: 'debit',
          category: 'transfer',
          description: 'Transfer to ' + t.name + ' (' + t.bank + ')',
          amount: t.amount
        });
        btn.disabled = false;
        btn.textContent = 'Confirm Transfer';
        flow.transfer = null;
        $('#form-transfer').reset();
        toast('Transfer successful', 'success');
        showReceipt(tx.id);
      }, 1200);
    });

    // Bill forms (generic handler)
    $$('.bill-form').forEach(form => {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const type = this.dataset.bill;
        const amount = parseFloat(this.querySelector('[name=amount]').value);
        const provider = this.querySelector('[name=provider]')?.value || '';
        const meter = this.querySelector('[name=meter]')?.value || '';
        const phone = this.querySelector('[name=phone]')?.value || '';
        const packageName = this.querySelector('[name=package]')?.value || '';

        if (!amount || amount < 50) {
          toast('Enter a valid amount (min ₦50)', 'error');
          return;
        }
        if (!canDebit(amount)) {
          toast('Insufficient balance', 'error');
          return;
        }

        let description = '';
        if (type === 'electricity') description = 'Electricity — ' + provider + (meter ? ' (' + meter + ')' : '');
        else if (type === 'cable') description = packageName + ' — ' + provide
