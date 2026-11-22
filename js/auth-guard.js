/**
 * Sanrakshan Shared Vehicle Access Guard
 * Enforces mandatory bike number authentication across all pages.
 */

const registeredVehicles = {
  'MH-12-AB-1234': 'BIKE-101',
  'MH12AB1234': 'BIKE-101',
  'BIKE-101': 'BIKE-101',
  'MH-14-CD-5678': 'BIKE-102',
  'MH14CD5678': 'BIKE-102',
  'BIKE-102': 'BIKE-102',
  'MH-12-EF-9012': 'FLEET-007',
  'MH12EF9012': 'FLEET-007',
  'FLEET-007': 'FLEET-007'
};

export function isValidBikeNumber(input) {
  if (!input) return false;
  const clean = input.trim().toUpperCase().replace(/\s+/g, '-');
  if (registeredVehicles[clean] || registeredVehicles[clean.replace(/-/g, '')]) return true;
  const regex = /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,3}[ -]?[0-9]{4}$/i;
  return regex.test(clean);
}

export function initAuthGuard(pageName = 'Portal') {
  const storedId = localStorage.getItem('smart_helmet_ride_id');
  const modalId = 'sanrakshan-auth-guard-modal';

  if (!storedId || !isValidBikeNumber(storedId)) {
    showAuthModal(pageName);
  } else {
    updateActiveBikeBadge(storedId);
  }
}

function updateActiveBikeBadge(bikeId) {
  const badge = document.getElementById('active-bike-auth-badge');
  if (badge) {
    badge.innerHTML = `<i class="fa-solid fa-motorcycle text-cyan-400"></i> <span class="font-mono font-bold">${bikeId}</span>`;
  }
}

export function lockSession() {
  localStorage.removeItem('smart_helmet_ride_id');
  location.reload();
}

function showAuthModal(pageName) {
  const existing = document.getElementById('sanrakshan-auth-guard-modal');
  if (existing) {
    existing.style.display = 'flex';
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'sanrakshan-auth-guard-modal';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(3, 7, 18, 0.94);
    backdrop-filter: blur(16px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  `;

  modal.innerHTML = `
    <div style="max-width: 440px; width: 100%; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 1.25rem; padding: 2rem; box-shadow: 0 25px 60px rgba(0,0,0,0.8); text-align: center; color: #f8fafc;">
      <div style="width: 60px; height: 60px; margin: 0 auto 1.25rem; background: linear-gradient(135deg, #2563eb, #06b6d4); border-radius: 1rem; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; color: #fff; box-shadow: 0 0 25px rgba(6, 182, 212, 0.4);">
        <i class="fa-solid fa-lock"></i>
      </div>
      <h2 style="font-size: 1.35rem; font-weight: 800; color: #fff; margin-bottom: 0.35rem; letter-spacing: -0.02em;">Sanrakshan Vehicle Access Gate</h2>
      <p style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 1.5rem; line-height: 1.5;">
        Access to <strong>${pageName}</strong> is restricted. Please enter your registered bike registration number to unlock.
      </p>

      <form id="guard-auth-form" style="display: flex; flex-direction: column; gap: 0.85rem; text-align: left;">
        <div>
          <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #cbd5e1; letter-spacing: 0.05em; display: block; margin-bottom: 0.4rem;">
            Registered Bike Number
          </label>
          <input type="text" id="guard-bike-input" placeholder="e.g. MH-12-AB-1234" required autofocus
                 style="width: 100%; box-sizing: border-box; background: #020617; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 0.75rem; padding: 0.75rem 1rem; color: #fff; font-family: monospace; font-size: 0.95rem; font-weight: 700; text-transform: uppercase; outline: none; transition: border-color 0.2s;" />
          <div id="guard-error" style="display: none; color: #fb7185; font-size: 0.75rem; margin-top: 0.4rem; font-weight: 600;"></div>
        </div>

        <button type="submit" style="width: 100%; background: linear-gradient(135deg, #2563eb, #0284c7); border: none; border-radius: 0.75rem; padding: 0.85rem; color: #fff; font-weight: 700; font-size: 0.88rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.35);">
          <i class="fa-solid fa-shield-halved"></i> Verify & Unlock
        </button>

        <div style="padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08); text-align: center; font-size: 0.72rem; color: #64748b;">
          Registered Bike: <span style="color: #38bdf8; font-family: monospace; font-weight: 700;">MH-12-AB-1234</span> (Manmath Sangave)
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = document.getElementById('guard-auth-form');
  const input = document.getElementById('guard-bike-input');
  const err = document.getElementById('guard-error');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value.trim().toUpperCase();
    if (!isValidBikeNumber(val)) {
      err.textContent = '❌ Invalid bike number! Enter a valid plate (e.g. MH-12-AB-1234).';
      err.style.display = 'block';
      return;
    }
    const resolved = registeredVehicles[val] || registeredVehicles[val.replace(/-/g, '')] || val;
    localStorage.setItem('smart_helmet_ride_id', resolved);
    modal.style.display = 'none';
    updateActiveBikeBadge(resolved);
  });
}
