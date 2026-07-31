/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const $ = id => document.getElementById(id);

const setResult = (el, type, msg) => {
  if (!el) return;
  el.className = 'ap-result' + (type ? ` ap-result--${type}` : '');
  el.textContent = msg;
};

const compressImageToBase64 = (file, maxWidth = 1080, quality = 0.75) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });

const dateToTimestamp = (dateStr) => {
  if (!dateStr) return null;
  // Set to end of the chosen day in local time
  const d = new Date(dateStr + 'T23:59:59');
  return d.getTime();
};

const timestampToDateInput = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
};

const formatExpiry = (ts) => {
  if (!ts) return null;
  const diff = ts - Date.now();
  if (diff <= 0) return 'Expirado';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `⏱ Vence en ${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `⏱ Vence en ${hours}h ${mins}m`;
};

/* ─── Auth ────────────────────────────────────────────────────────────────── */

const setAuthenticated = (ok) => {
  const loginCard = $('loginCard');
  const promoSection = $('promoSection');
  if (loginCard) loginCard.hidden = ok;
  if (promoSection) promoSection.hidden = !ok;
};

const checkAuth = async () => {
  try {
    const res = await fetch('/api/admin/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data?.authenticated) {
        setAuthenticated(true);
        fetchPromotions();
        return;
      }
    }
  } catch { /* ignore */ }
  setAuthenticated(false);
};

const loginForm = $('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const loginResult = $('loginResult');
    setResult(loginResult, 'info', 'Iniciando sesión...');
    const email = $('adminEmail').value.trim();
    const password = $('adminPassword').value.trim();
    if (!email || !password) return;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setResult(loginResult, '', '');
        setAuthenticated(true);
        fetchPromotions();
      } else {
        setResult(loginResult, 'err', data.error || 'Error de credenciales');
      }
    } catch {
      setResult($('loginResult'), 'err', 'Error de red');
    }
  });
}

/* ─── Fetch & Render list ─────────────────────────────────────────────────── */

const fetchPromotions = async () => {
  const container = $('promoListContainer');
  const countLabel = $('promosCountLabel');
  if (!container) return;
  container.innerHTML = '<div style="color: rgba(255,255,255,0.4); font-size:13px; text-align:center; padding:20px 0">Cargando...</div>';

  try {
    // Admin view: fetch all including expired (bypass filter by adding ?admin=1)
    const res = await fetch('/api/admin/promotions?admin=1', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar promociones');

    const promos = data.promotions || [];
    if (countLabel) countLabel.textContent = promos.length === 0 ? 'Sin promociones' : `${promos.length} promoción${promos.length !== 1 ? 'es' : ''}`;

    if (promos.length === 0) {
      container.innerHTML = '<div style="color: rgba(255,255,255,0.4); font-size:13px; text-align:center; padding:20px 0">No hay promociones. ¡Crea la primera!</div>';
      return;
    }

    container.innerHTML = '';
    promos.forEach(p => {
      const expiryText = formatExpiry(p.expiresAt);
      const card = document.createElement('div');
      card.className = 'ap-promo-item';
      card.innerHTML = `
        <div class="ap-promo-item__thumb">
          <img src="${p.image}" alt="${p.title}" loading="lazy" />
        </div>
        <div class="ap-promo-item__info">
          <div class="ap-promo-item__title">${p.title}</div>
          ${p.description ? `<div class="ap-promo-item__desc">${p.description}</div>` : ''}
          <div class="ap-promo-item__pts">${p.points.toLocaleString('es-VE')} Pts</div>
          ${expiryText ? `<div class="ap-promo-item__expires">${expiryText}</div>` : ''}
          <div class="ap-promo-item__actions">
            <button class="ap-promo-action ap-promo-action--edit" data-id="${p.id}">✎ Editar</button>
            <button class="ap-promo-action ap-promo-action--del" data-id="${p.id}">✕ Eliminar</button>
          </div>
        </div>
      `;

      card.querySelector('.ap-promo-action--edit').addEventListener('click', () => openEditModal(p));
      card.querySelector('.ap-promo-action--del').addEventListener('click', () => deletePromotion(p.id));
      container.appendChild(card);
    });

  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; font-size:13px; text-align:center;">${err.message}</div>`;
  }
};

/* ─── Delete ──────────────────────────────────────────────────────────────── */

const deletePromotion = async (id) => {
  if (!confirm('¿Eliminar esta promoción? Esta acción no se puede deshacer.')) return;
  try {
    const res = await fetch('/api/admin/promotions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar');
    fetchPromotions();
  } catch (err) {
    alert(err.message);
  }
};

/* ─── Create form ─────────────────────────────────────────────────────────── */

// Image preview on select
const promoImageInput = $('promoImage');
const promoImagePreview = $('promoImagePreview');
if (promoImageInput && promoImagePreview) {
  promoImageInput.addEventListener('change', () => {
    const file = promoImageInput.files[0];
    if (!file) { promoImagePreview.classList.remove('is-visible'); return; }
    promoImagePreview.src = URL.createObjectURL(file);
    promoImagePreview.classList.add('is-visible');
  });
}

const promoForm = $('promoForm');
if (promoForm) {
  promoForm.addEventListener('submit', async e => {
    e.preventDefault();
    const file = $('promoImage').files[0];
    const promoResult = $('promoResult');
    if (!file) { setResult(promoResult, 'err', 'Selecciona una imagen'); return; }
    if (file.size > 15 * 1024 * 1024) { setResult(promoResult, 'err', 'La imagen no debe superar 15 MB'); return; }

    const title = $('promoTitle').value.trim();
    const description = $('promoDesc').value.trim();
    const points = parseInt($('promoPoints').value, 10);
    const expiresAt = dateToTimestamp($('promoExpires').value);

    if (!title || !points || points <= 0) {
      setResult(promoResult, 'err', 'Completa los campos obligatorios');
      return;
    }

    const btn = $('createPromoBtn');
    btn.disabled = true;
    setResult(promoResult, 'info', 'Comprimiendo imagen...');

    try {
      const image = await compressImageToBase64(file);
      setResult(promoResult, 'info', 'Subiendo promoción...');

      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, points, image, expiresAt }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la promoción');

      setResult(promoResult, 'ok', '¡Promoción creada exitosamente!');
      promoForm.reset();
      if (promoImagePreview) promoImagePreview.classList.remove('is-visible');
      fetchPromotions();
      setTimeout(() => setResult(promoResult, '', ''), 3500);
    } catch (err) {
      setResult(promoResult, 'err', err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

/* ─── Edit Modal ──────────────────────────────────────────────────────────── */

const overlay = $('editModalOverlay');
const editForm = $('editPromoForm');
const editImageInput = $('editPromoImage');
const editImagePreview = $('editPromoImagePreview');

const openEditModal = (promo) => {
  $('editPromoId').value = promo.id;
  $('editPromoTitle').value = promo.title;
  $('editPromoDesc').value = promo.description || '';
  $('editPromoPoints').value = promo.points;
  $('editPromoExpires').value = timestampToDateInput(promo.expiresAt);
  if (editImagePreview) {
    editImagePreview.src = promo.image;
    editImagePreview.classList.add('is-visible');
  }
  setResult($('editPromoResult'), '', '');
  overlay.classList.add('is-open');
};

const closeEditModal = () => {
  overlay.classList.remove('is-open');
  if (editImageInput) editImageInput.value = '';
};

if ($('editModalClose')) $('editModalClose').addEventListener('click', closeEditModal);
if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeEditModal(); });

// Edit image preview
if (editImageInput && editImagePreview) {
  editImageInput.addEventListener('change', () => {
    const file = editImageInput.files[0];
    if (!file) return;
    editImagePreview.src = URL.createObjectURL(file);
    editImagePreview.classList.add('is-visible');
  });
}

if (editForm) {
  editForm.addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('editPromoId').value;
    const title = $('editPromoTitle').value.trim();
    const description = $('editPromoDesc').value.trim();
    const points = parseInt($('editPromoPoints').value, 10);
    const expiresAt = dateToTimestamp($('editPromoExpires').value);
    const editResult = $('editPromoResult');

    if (!title || !points || points <= 0) {
      setResult(editResult, 'err', 'Completa los campos obligatorios');
      return;
    }

    const btn = $('saveEditBtn');
    btn.disabled = true;
    setResult(editResult, 'info', 'Guardando...');

    try {
      const payload = { id, title, description, points, expiresAt };

      const newFile = editImageInput?.files[0];
      if (newFile) {
        setResult(editResult, 'info', 'Comprimiendo imagen...');
        payload.image = await compressImageToBase64(newFile);
      }

      const res = await fetch('/api/admin/promotions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      setResult(editResult, 'ok', '¡Guardado!');
      setTimeout(() => { closeEditModal(); fetchPromotions(); }, 1000);
    } catch (err) {
      setResult(editResult, 'err', err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

/* ─── Boot ────────────────────────────────────────────────────────────────── */
checkAuth();
