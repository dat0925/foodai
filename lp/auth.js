// PIN認証共通モジュール
const PIN_HASH = '1aa219431528a059b7f0d8ec0c7d2a6dcc0f0f659a642adc4fc1ebbd907bf983';
const SESSION_KEY = 'foodai_auth';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24h

async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function isAuthed() {
  const s = sessionStorage.getItem(SESSION_KEY);
  if (!s) return false;
  try {
    const { expiry } = JSON.parse(s);
    return Date.now() < expiry;
  } catch { return false; }
}

function setAuthed() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ expiry: Date.now() + SESSION_DURATION }));
}

function renderPinUI(onSuccess) {
  const overlay = document.createElement('div');
  overlay.id = 'pin-overlay';
  overlay.innerHTML = `
    <div class="pin-box">
      <div class="pin-logo">Food<span>AI</span></div>
      <p class="pin-label">アクセスコードを入力</p>
      <div class="pin-dots" id="pinDots">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="pin-grid">
        ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => 
          `<button class="pin-key" data-key="${k}">${k}</button>`
        ).join('')}
      </div>
      <p class="pin-error" id="pinError"></p>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #pin-overlay {
      position:fixed;inset:0;z-index:9999;
      background:#0E0C0A;
      display:flex;align-items:center;justify-content:center;
    }
    .pin-box { text-align:center; }
    .pin-logo {
      font-family:'Syne',sans-serif;font-weight:800;font-size:1.8rem;
      color:#F0E8DA;margin-bottom:2rem;letter-spacing:-.02em;
    }
    .pin-logo span{color:#D4883A;}
    .pin-label{font-size:.8rem;color:#7A6F64;letter-spacing:.12em;margin-bottom:1.5rem;}
    .pin-dots{display:flex;gap:1rem;justify-content:center;margin-bottom:2rem;}
    .pin-dots span{
      width:12px;height:12px;border-radius:50%;
      border:1px solid rgba(255,255,255,.2);
      transition:all .15s;
    }
    .pin-dots span.filled{background:#D4883A;border-color:#D4883A;}
    .pin-dots span.error{background:#E05555;border-color:#E05555;}
    .pin-grid{
      display:grid;grid-template-columns:repeat(3,72px);
      gap:10px;justify-content:center;
    }
    .pin-key{
      width:72px;height:72px;border-radius:50%;
      background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
      color:#F0E8DA;font-size:1.3rem;cursor:pointer;
      font-family:'Syne',sans-serif;font-weight:600;
      transition:all .1s;
    }
    .pin-key:active{background:rgba(212,136,58,.3);transform:scale(.93);}
    .pin-key[data-key=""]{opacity:0;pointer-events:none;}
    .pin-error{margin-top:1.2rem;font-size:.78rem;color:#E05555;min-height:1.2em;}
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);

  let entered = '';

  function updateDots() {
    document.querySelectorAll('.pin-dots span').forEach((s,i) => {
      s.classList.toggle('filled', i < entered.length);
      s.classList.remove('error');
    });
  }

  async function checkPin() {
    const h = await hashPin(entered);
    if (h === PIN_HASH) {
      setAuthed();
      overlay.style.transition = 'opacity .3s';
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.remove(); style.remove(); onSuccess(); }, 300);
    } else {
      document.querySelectorAll('.pin-dots span').forEach(s => {
        s.classList.remove('filled'); s.classList.add('error');
      });
      document.getElementById('pinError').textContent = 'コードが正しくありません';
      setTimeout(() => {
        document.querySelectorAll('.pin-dots span').forEach(s => s.classList.remove('error'));
        document.getElementById('pinError').textContent = '';
        entered = '';
      }, 800);
    }
  }

  overlay.addEventListener('click', async e => {
    const key = e.target.dataset.key;
    if (key === undefined) return;
    if (key === '⌫') {
      entered = entered.slice(0,-1);
    } else if (entered.length < 4 && key !== '') {
      entered += key;
    }
    updateDots();
    if (entered.length === 4) await checkPin();
  });
}

function requireAuth(onSuccess) {
  if (isAuthed()) { onSuccess(); return; }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => renderPinUI(onSuccess));
  } else {
    renderPinUI(onSuccess);
  }
}
