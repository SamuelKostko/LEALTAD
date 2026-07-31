const loginForm = document.getElementById("loginForm");
const adminEmailEl = document.getElementById("adminEmail");
const adminPasswordEl = document.getElementById("adminPassword");
const loginResultEl = document.getElementById("loginResult");
const promoSection = document.getElementById("promoSection");
const promoForm = document.getElementById("promoForm");
const promoImageEl = document.getElementById("promoImage");
const promoTitleEl = document.getElementById("promoTitle");
const promoDescEl = document.getElementById("promoDesc");
const promoPointsEl = document.getElementById("promoPoints");
const promoResultEl = document.getElementById("promoResult");
const promoListContainer = document.getElementById("promoListContainer");
const createPromoBtn = document.getElementById("createPromoBtn");

const setLoginResult = (type, message) => {
  if (!loginResultEl) return;
  loginResultEl.classList.remove("adminResult--ok", "adminResult--err", "adminResult--info");
  if (type) loginResultEl.classList.add(type);
  loginResultEl.textContent = message;
};

const setPromoResult = (type, message) => {
  if (!promoResultEl) return;
  promoResultEl.classList.remove("adminResult--ok", "adminResult--err", "adminResult--info");
  if (type) promoResultEl.classList.add(type);
  promoResultEl.textContent = message;
};

const setAuthenticated = (authenticated) => {
  const loginCard = document.getElementById("loginCard");
  if (loginCard) loginCard.hidden = authenticated;
  if (promoSection) promoSection.hidden = !authenticated;
};

const compressImageToBase64 = (file, maxWidth = 1080, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to WebP (better compression than JPEG)
        resolve(canvas.toDataURL("image/webp", quality));
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

const fetchPromotions = async () => {
  if (!promoListContainer) return;
  promoListContainer.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.5);">Cargando...</div>';
  
  try {
    const res = await fetch("/api/admin/promotions");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar promociones");
    
    const promos = data.promotions || [];
    if (promos.length === 0) {
      promoListContainer.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.5);">No hay promociones activas.</div>';
      return;
    }
    
    promoListContainer.innerHTML = "";
    promos.forEach(p => {
      const card = document.createElement("div");
      card.style.cssText = "background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; display: flex; gap: 16px; align-items: center;";
      
      card.innerHTML = `
        <div style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #000;">
          <img src="${p.image}" alt="${p.title}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div style="flex: 1; min-width: 0;">
          <h4 style="margin: 0 0 4px 0; color: #fff; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.title}</h4>
          <p style="margin: 0 0 6px 0; color: rgba(255,255,255,0.6); font-size: 13px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.description || ""}</p>
          <div style="color: #f43f5e; font-weight: bold; font-size: 14px;">${p.points} Puntos</div>
        </div>
        <button class="aBtn" style="background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); padding: 8px 16px; width: auto;" data-id="${p.id}">
          Eliminar
        </button>
      `;
      
      const delBtn = card.querySelector("button");
      delBtn.addEventListener("click", () => deletePromotion(p.id));
      
      promoListContainer.appendChild(card);
    });
    
  } catch (err) {
    promoListContainer.innerHTML = `<div style="text-align: center; color: #ef4444;">${err.message}</div>`;
  }
};

const deletePromotion = async (id) => {
  if (!confirm("¿Seguro que deseas eliminar esta promoción?")) return;
  
  try {
    const res = await fetch("/api/admin/promotions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al eliminar");
    
    fetchPromotions();
  } catch (err) {
    alert(err.message);
  }
};

const checkAuth = async () => {
  try {
    const res = await fetch("/api/admin/me");
    if (res.ok) {
      setAuthenticated(true);
      fetchPromotions();
    } else {
      setAuthenticated(false);
    }
  } catch (err) {
    setAuthenticated(false);
  }
};

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setLoginResult("adminResult--info", "Iniciando sesión...");
    const email = adminEmailEl.value.trim();
    const password = adminPasswordEl.value.trim();
    if (!email || !password) return;
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setLoginResult("", "");
        setAuthenticated(true);
        fetchPromotions();
      } else {
        setLoginResult("adminResult--err", data.error || "Error de credenciales");
      }
    } catch (err) {
      setLoginResult("adminResult--err", "Error de red");
    }
  });
}

if (promoForm) {
  promoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const file = promoImageEl.files[0];
    if (!file) {
      setPromoResult("adminResult--err", "Por favor selecciona una imagen");
      return;
    }
    
    if (file.size > 15 * 1024 * 1024) {
      setPromoResult("adminResult--err", "La imagen no debe superar los 15MB");
      return;
    }
    
    const title = promoTitleEl.value.trim();
    const description = promoDescEl.value.trim();
    const points = parseInt(promoPointsEl.value, 10);
    
    if (!title || !points || points <= 0) {
      setPromoResult("adminResult--err", "Completa los campos obligatorios");
      return;
    }

    createPromoBtn.disabled = true;
    setPromoResult("adminResult--info", "Procesando imagen y subiendo...");
    
    try {
      const base64Image = await compressImageToBase64(file);
      
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          points,
          image: base64Image
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear la promoción");
      
      setPromoResult("adminResult--ok", "¡Promoción creada exitosamente!");
      promoForm.reset();
      fetchPromotions();
      
      setTimeout(() => setPromoResult("", ""), 3000);
      
    } catch (err) {
      setPromoResult("adminResult--err", err.message);
    } finally {
      createPromoBtn.disabled = false;
    }
  });
}

checkAuth();
