window.walletState = {
  activeMerchantId: null,
  allTransactions: [],
  filterActivity: null
};

window.formatPts = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").then(reg => {
      // Standard Service Worker update logic: refresh UI if a new worker is installed
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Guard against reload loops if the browser keeps detecting an update.
            try {
              const key = 'wallet.swAutoReloaded';
              if (sessionStorage.getItem(key) === '1') return;
              sessionStorage.setItem(key, '1');
            } catch {
              // Ignore storage errors.
            }
            console.log("PWA: Nueva versión detectada, recargando...");
            window.location.reload();
          }
        });
      });
    }).catch(() => { });
  });
}
(() => {
  const setAppHeightVar = () => {
    document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
  };
  setAppHeightVar();
  window.addEventListener("resize", setAppHeightVar);
  window.addEventListener("orientationchange", setAppHeightVar);
})();
(() => {
  const banner = document.getElementById("installBanner");
  const btn = document.getElementById("installBannerBtn");
  const closeBtn = document.getElementById("installBannerClose");
  const desc = document.getElementById("installBannerDesc");
  if (!banner || !btn || !closeBtn || !desc) return;

  const BANNER_CLOSED_KEY = "wallet.installBannerClosed";
  
  const isStandalone = () => {
    return (typeof navigator.standalone === "boolean" && navigator.standalone) ||
      (window.matchMedia && (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches
      ));
  };

  if (isStandalone()) {
    console.log("PWA: Ya est\xE1 en modo standalone.");
    return;
  }

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isInApp = () => {
    const ua = navigator.userAgent || "";
    return /FBAN|FBAV|Instagram|Gmail|GSA|Outlook|Messenger|YaBrowser/i.test(ua);
  };

  const showBanner = () => {
    if (localStorage.getItem(BANNER_CLOSED_KEY) === "1") {
      console.log("PWA: El banner est\xE1 bloqueado por el usuario (localStorage).");
      return; 
    }
    setTimeout(() => {
      banner.classList.add("installBanner--show");
      banner.setAttribute("aria-hidden", "false");
    }, 400);
  };

  const hideBanner = () => {
    banner.classList.remove("installBanner--show");
    banner.setAttribute("aria-hidden", "true");
    try { localStorage.setItem(BANNER_CLOSED_KEY, "1"); } catch (e) { }
  };

  closeBtn.addEventListener("click", hideBanner);

  let promptFired = false;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    console.log("PWA: Evento beforeinstallprompt detectado.");
    promptFired = true;
    window.deferredInstallPrompt = e;

    btn.textContent = "Instalar";
    desc.textContent = "Acceso r\xE1pido y mejor experiencia.";
    btn.onclick = async () => {
      hideBanner();
      if (!window.deferredInstallPrompt) return;
      try {
        window.deferredInstallPrompt.prompt();
        await window.deferredInstallPrompt.userChoice;
      } catch (err) { }
      window.deferredInstallPrompt = null;
    };
    showBanner();
  });

  // Failsafe: Si en 4s no ha saltado el prompt automático y es móvil, mostrar instrucciones
  setTimeout(() => {
    const ios = isIOS();
    const inApp = isInApp();
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    console.log("PWA Debug:", { mobile, ios, inApp, promptFired });

    if (promptFired || isStandalone()) return;
    if (!mobile) return;

    if (inApp) {
      console.log("PWA: Navegador interno detectado.");
      if (ios) {
        desc.textContent = "Para instalar, toca el icono de br\xFAjula o compartir y elige 'Abrir en Safari'.";
      } else {
        desc.textContent = "Para instalar, toca los tres puntos y elige 'Abrir en Chrome' o 'Navegador'.";
      }
    } else if (ios) {
      console.log("PWA: iOS detectado.");
      const tutorial = document.getElementById("installBannerTutorial");
      if (tutorial) tutorial.hidden = false;
      desc.textContent = "Toca Compartir y luego 'A\xF1adir a la pantalla de inicio'.";
    } else {
      console.log("PWA: Android/Otro detectado (Manual).");
      desc.textContent = "Toca el men\xFA del navegador y selecciona 'Instalar App' o 'A\xF1adir a inicio'.";
    }
    
    btn.textContent = "Entendido";
    btn.onclick = hideBanner;
    showBanner();
  }, 4000);

  // Botón persistente en el menú de perfil
  const profileBtn = document.getElementById("profileInstallBtn");
  if (profileBtn) {
    profileBtn.hidden = false;
    profileBtn.onclick = () => {
      // Cerrar el menú de perfil
      const menu = document.getElementById("profileMenu");
      if (menu) {
        menu.classList.remove("profileMenu--active");
        menu.setAttribute("aria-hidden", "true");
        const profileTrigger = document.getElementById("profileButton");
        if (profileTrigger) profileTrigger.setAttribute("aria-expanded", "false");
      }

      // Olvidar que el banner se cerró para forzar su aparición
      localStorage.removeItem(BANNER_CLOSED_KEY);

      // Si hay un prompt nativo pendiente, lo usamos
      if (promptFired && window.deferredInstallPrompt) {
        btn.click(); 
      } else {
        // Si no, mostramos el banner con instrucciones manuales
        showBanner();
      }
    };
  }
})();
const qrButton = document.getElementById("qrButton");
if (qrButton) {
  const pulse = () => {
    qrButton.classList.remove("is-glowing");
    void qrButton.offsetWidth;
    qrButton.classList.add("is-glowing");
    window.setTimeout(() => qrButton.classList.remove("is-glowing"), 320);
  };
  qrButton.addEventListener("click", pulse);
  qrButton.addEventListener("touchend", pulse, { passive: true });
}
(() => {
  const card = document.getElementById("clientCard");
  if (!card) return;
  const details = document.getElementById("cardDetails");
  const pointsEl = document.getElementById("points");
  const pointsCashEl = document.getElementById("pointsCash");
  const balanceEl = document.getElementById("clientBalance");
  const clientBalanceCashEl = document.getElementById("clientBalanceCash");
  const nameEl = document.getElementById("clientName");
  const idEl = document.getElementById("clientId");
  const greetingNameEl = document.getElementById("greetingName");
  const avatarInitialsEl = document.getElementById("avatarInitials");
  const updatedEl = document.getElementById("cardUpdated");
  const floatingPointsEl = document.getElementById("floatingPoints");
  const getTokenFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      const qp = (url.searchParams.get("token") || url.searchParams.get("t") || "").trim();
      if (qp) return qp;
      const path = url.pathname || "";
      if (path.startsWith("/card/")) {
        return decodeURIComponent(path.slice("/card/".length)).trim();
      }
    } catch {
    }
    return "";
  };
  const getGreetingNameFromFullName = (fullName) => {
    const parts = String(fullName != null ? fullName : "").trim().split(/\s+/).filter(Boolean);
    return parts[0] || "";
  };
  const getInitialsFromFullName = (fullName) => {
    const parts = String(fullName != null ? fullName : "").trim().split(/\s+/).filter(Boolean);
    const letters = parts.slice(0, 2).map((p) => p[0]).join("");
    return letters.toUpperCase() || "";
  };
  const setUpdatedText = (updatedAtIso) => {
    if (!updatedEl) return;
    if (!updatedAtIso) {
      updatedEl.textContent = "Actualizado";
      return;
    }
    const d = new Date(updatedAtIso);
    if (Number.isNaN(d.getTime())) {
      updatedEl.textContent = "Actualizado";
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (sameDay) {
      updatedEl.textContent = "Actualizado hoy";
      return;
    }
    const dateStr = d.toLocaleDateString("es-VE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    updatedEl.textContent = `Actualizado ${dateStr}`;
  };
  const setPoints = (value) => {
    const n = Number(value);
    if (!pointsEl) return;
    if (!Number.isFinite(n)) return;
    pointsEl.textContent = formatPts(n);
    if (floatingPointsEl) floatingPointsEl.textContent = formatPts(n);
    if (pointsCashEl) pointsCashEl.textContent = `\u2248 ${formatPts(n / 100)} $`;
  };
  const loadCardData = window.loadCardData = async () => {
    const token = getTokenFromUrl();
    if (!token) {
      setTimeout(() => document.body.classList.add("is-ready"), 2e3);
      return;
    }
    try {
      const res = await fetch(
        `/api/card?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        if (nameEl) nameEl.textContent = "Tarjeta no v\xE1lida";
        if (greetingNameEl) greetingNameEl.textContent = "Usuario";
        document.body.classList.add("is-ready");
        return;
      }
      const data = await res.json();
      if (data && typeof data === "object") {
        if (nameEl && typeof data.name === "string") nameEl.textContent = data.name;
        if (idEl && typeof data.cedula === "string") idEl.textContent = data.cedula;
        if (typeof data.balance !== "undefined") setPoints(data.balance);
        syncBalance();
        if (greetingNameEl && typeof data.name === "string") {
          const greetingName = getGreetingNameFromFullName(data.name);
          if (greetingName) greetingNameEl.textContent = greetingName;
        }
        if (avatarInitialsEl && typeof data.name === "string") {
          const initials = getInitialsFromFullName(data.name);
          if (initials) avatarInitialsEl.textContent = initials;
        }
        if (typeof data.updatedAt === "string") setUpdatedText(data.updatedAt);
        
        // Render merchant-specific cards into the main carousel track
        const track = document.getElementById("cardsCarouselTrack");
        const hint = document.getElementById("cardsCarouselHint");
        if (track) {
          // Remove previous dynamic merchant slides
          const prevSlides = track.querySelectorAll(".cardsCarousel__slide--merchant");
          prevSlides.forEach(s => s.remove());

          const balances = Array.isArray(data.merchantBalances) ? data.merchantBalances : [];

          balances.forEach(m => {
            // --- Slide wrapper ---
            const slide = document.createElement("div");
            slide.className = "cardsCarousel__slide cardsCarousel__slide--merchant";
            slide.dataset.merchantId = m.merchantId;

            // --- Merchant name label above the card ---
            const label = document.createElement("div");
            label.className = "cardsCarousel__merchantLabel";
            label.textContent = m.name;
            slide.appendChild(label);

            // --- Card: same artwork as the client card ---
            const mCard = document.createElement("section");
            mCard.className = "card card--merchant";
            mCard.setAttribute("aria-label", `Tarjeta de puntos – ${m.name}`);
            mCard.innerHTML = `
              <img class="card__art" src="/images/card-cliente.png" alt="Tarjeta de puntos" draggable="false" />
              <div class="card__floatingPoints">
                <div class="card__floatingLabel">Ptos.</div>
                <div class="floatingPoints">${formatPts(m.balance)}</div>
              </div>
            `;

            slide.appendChild(mCard);
            track.appendChild(slide);
          });

          // Show or hide the swipe hint
          if (hint) hint.hidden = balances.length === 0;

          // Scroll snap detection — reads merchantId from the slide wrapper
          let scrollTimeout;
          track.addEventListener("scroll", () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
              const slides = track.querySelectorAll(".cardsCarousel__slide");
              if (!slides.length) return;

              let closestSlide = null;
              let minDistance = Infinity;

              slides.forEach(slide => {
                const slideCenter = slide.getBoundingClientRect().left + slide.offsetWidth / 2;
                const trackCenter = track.getBoundingClientRect().left + track.offsetWidth / 2;
                const distance = Math.abs(slideCenter - trackCenter);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestSlide = slide;
                }
              });

              if (closestSlide) {
                const merchantId = closestSlide.dataset.merchantId || null;
                if (window.walletState.activeMerchantId !== merchantId) {
                  window.walletState.activeMerchantId = merchantId;
                  if (typeof window.walletState.filterActivity === "function") {
                    window.walletState.filterActivity();
                  }
                }
              }
            }, 80);
          });

          // Prevent the parent vertical scroll from stealing horizontal swipe gestures
          let touchStartX = 0;
          let touchStartY = 0;
          const contentEl = track.closest(".content");

          track.addEventListener("touchstart", (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
          }, { passive: true });

          track.addEventListener("touchmove", (e) => {
            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);
            // If gesture is more horizontal than vertical, lock parent scroll
            if (dx > dy && dx > 6) {
              if (contentEl) contentEl.style.overflowY = "hidden";
            }
          }, { passive: true });

          track.addEventListener("touchend", () => {
            if (contentEl) contentEl.style.overflowY = "";
          }, { passive: true });
        }

        // Control de Modal de Promoción
        const showPromoModal = () => {
          const promoModal = document.getElementById("promoModal");
          const promoImg = document.getElementById("promoModalImage");
          if (promoModal && promoImg) {
            // Selección aleatoria entre publi1 y publi2
            const chosenImg = Math.random() < 0.5 ? "/images/publi1.jpeg" : "/images/publi2.jpeg";
            promoImg.src = chosenImg;

            setTimeout(() => {
              promoModal.classList.add("promoModal--active");
              promoModal.setAttribute("aria-hidden", "false");
            }, 800);

            const hidePromo = () => {
              promoModal.classList.remove("promoModal--active");
              promoModal.setAttribute("aria-hidden", "true");
            };

            const closeBtn = document.getElementById("promoModalCloseBtn");
            if (closeBtn) closeBtn.onclick = hidePromo;

            const backdrop = document.getElementById("promoModalBackdrop");
            if (backdrop) backdrop.onclick = hidePromo;
          }
        };

        // Control del Modal de Primera Vez
        if (data.isFirstOpen) {
          const firstModal = document.getElementById("firstOpenModal");
          if (firstModal) {
            firstModal.classList.add("firstOpenModal--active");
            firstModal.setAttribute("aria-hidden", "false");

            const hideFirstModal = () => {
              firstModal.classList.remove("firstOpenModal--active");
              firstModal.setAttribute("aria-hidden", "true");
            };

            const triggerPromoAfterFirstModal = () => {
              hideFirstModal();
              showPromoModal();
            };

            const installBtn = document.getElementById("firstOpenInstallBtn");
            if (installBtn) {
              installBtn.onclick = async () => {
                try {
                  const prompt = window.deferredInstallPrompt;
                  if (prompt && typeof prompt.prompt === "function") {
                    prompt.prompt();
                    try {
                      await prompt.userChoice;
                    } catch {
                    }
                    window.deferredInstallPrompt = null;
                    triggerPromoAfterFirstModal();
                    return;
                  }

                  // Fallback: mostrar el banner de instalación (con instrucciones según el navegador)
                  const banner = document.getElementById("installBanner");
                  if (banner) {
                    banner.classList.add("installBanner--show");
                    banner.setAttribute("aria-hidden", "false");
                  }
                  triggerPromoAfterFirstModal();
                } catch {
                  triggerPromoAfterFirstModal();
                }
              };
            }
            
            const btnClose = document.getElementById("firstOpenCloseBtn");
            if (btnClose) {
              btnClose.onclick = () => {
                triggerPromoAfterFirstModal();
              };
            }
          } else {
            showPromoModal();
          }
        } else {
          showPromoModal();
        }

        // Control de Primera Vez Completado
      }
    } catch {
    } finally {
      setTimeout(() => document.body.classList.add("is-ready"), 2e3);
    }
  };
  let autoCloseTimer = null;
  const setExpanded = (expanded) => {
    if (autoCloseTimer) {
      window.clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    card.classList.toggle("is-details", expanded);
    card.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (details) details.setAttribute("aria-hidden", expanded ? "false" : "true");
    if (expanded) {
      autoCloseTimer = window.setTimeout(() => {
        setExpanded(false);
      }, 5e3);
    }
  };
  const syncBalance = () => {
    var _a;
    if (!balanceEl) return;
    const raw = (_a = pointsEl == null ? void 0 : pointsEl.textContent) != null ? _a : "0";
    const val = raw.replace(/\s+/g, "").trim() || "0";
    balanceEl.textContent = val;
    if (clientBalanceCashEl) {
      const n = Number(val);
      clientBalanceCashEl.textContent = `\u2248 ${formatPts(Number.isFinite(n) ? n / 100 : 0)} $`;
    }
  };
  const initialToken = getTokenFromUrl();
  if (initialToken) {
    if (nameEl) nameEl.textContent = "Cargando...";
    if (idEl) idEl.textContent = "\u2014";
    if (greetingNameEl) greetingNameEl.textContent = "...";
    if (avatarInitialsEl) avatarInitialsEl.textContent = "...";
    if (updatedEl) updatedEl.textContent = "Actualizando...";
    setPoints(0);
  } else {
    document.body.classList.add("mode-admin");
    card.hidden = true;
    const activity = document.querySelector(".activity");
    if (activity) activity.hidden = true;
    const cta = document.querySelector(".cta");
    if (cta) cta.hidden = true;
    const profileButton = document.getElementById("profileButton");
    if (profileButton) profileButton.hidden = true;

    const dash = document.getElementById("adminDash");
    const goQrBtn = document.getElementById("adminHeaderGoQr");
    const logoutBtn = document.getElementById("adminHeaderLogout");
    const adminLogoutBtn = document.getElementById("adminLogout");
    const adminResetTxsBtn = document.getElementById("adminResetTxsBtnSidebar");
    const adminCreditPointsBtn = document.getElementById("adminCreditPointsBtn");
    const adminCreateCashierBtn = document.getElementById("adminCreateCashierBtn");
    const adminCreateMerchantBtn = document.getElementById("adminCreateMerchantBtn");
    const panelClientes = document.getElementById("aPanelClientes");
    const panelTx = document.getElementById("aPanelTx");
    const panelStats = document.getElementById("aPanelStats");
    const navClientes = document.getElementById("aNavClientes");
    const navTx = document.getElementById("aNavTx");
    const navStats = document.getElementById("aNavStats");
    const searchInput = document.getElementById("adminClientSearch");
    const dropdown = document.getElementById("adminSearchDropdown");
    const clientCard = document.getElementById("aClientCard");
    const clientAvatarEl = document.getElementById("aClientAvatar");
    const clientNameEl = document.getElementById("aClientName");
    const clientMetaEl = document.getElementById("aClientMeta");
    const clientBalanceEl = document.getElementById("aClientBalance");
    const clientClearBtn = document.getElementById("aClientClear");
    const clientEditBtn = document.getElementById("adminClientEditBtn");
    const clientResendBtn = document.getElementById("adminClientResendBtn");
    const clientDeleteBtn = document.getElementById("adminClientDeleteBtn");
    const clientsResult = document.getElementById("adminClientsResult");
    const cardTxSection = document.getElementById("adminRootCardTx");
    const cardTxHint = document.getElementById("adminCardTxHint");
    const cardTxList = document.getElementById("adminCardTxList");
    const cardTxResult = document.getElementById("adminCardTxResult");
    const adminCardTxLoadMore = document.getElementById("adminCardTxLoadMore");
    const txRefresh = document.getElementById("adminTxRefresh");
    const txList = document.getElementById("adminTxList");
    const txResult = document.getElementById("adminTxResult");
    const adminTxLoadMore = document.getElementById("adminTxLoadMore");
    const panelCajeros = document.getElementById("aPanelCajeros");
    const navCajeros = document.getElementById("aNavCajeros");
    const cajerosList = document.getElementById("adminCajerosList");
    const cajerosResult = document.getElementById("adminCajerosResult");
    const cajerosRefresh = document.getElementById("adminCajerosRefresh");
    const mobNavCajeros = document.getElementById("aMobNavCajeros");
    const panelComercios = document.getElementById("aPanelComercios");
    const navComercios = document.getElementById("aNavComercios");
    const merchantsList = document.getElementById("adminMerchantsList");
    const merchantsResult = document.getElementById("adminMerchantsResult");
    const merchantsRefresh = document.getElementById("adminMerchantsRefresh");
    const mobNavComercios = document.getElementById("aMobNavComercios");
    const panelSedes = document.getElementById("aPanelSedes");
    const navSedes = document.getElementById("aNavSedes");
    const mobNavSedes = document.getElementById("aMobNavSedes");
    const sedesList = document.getElementById("adminSedesList");
    const sedesResult = document.getElementById("adminSedesResult");
    const sedesRefresh = document.getElementById("adminSedesRefresh");
    
    // Reports Panel DOM elements
    const panelReportes = document.getElementById("aPanelReportes");
    const navReportes = document.getElementById("aNavReportes");
    const mobNavReportes = document.getElementById("aMobNavReportes");
    const panelReferidos = document.getElementById("secReferidos");
    const navReferidos = document.getElementById("aNavReferidos");
    const mobNavReferidos = document.getElementById("aMobNavReferidos");
    
    // Marketing & Promociones
    const panelMarketing = document.getElementById("secMarketing");
    const navMarketing = document.getElementById("aNavMarketing");
    const mobNavMarketing = document.getElementById("aMobNavMarketing");
    const panelPromociones = document.getElementById("secPromociones");
    const navPromociones = document.getElementById("aNavPromociones");
    const mobNavPromociones = document.getElementById("aMobNavPromociones");
    const reportRefresh = document.getElementById("adminReportRefresh");
    const reportDateInput = document.getElementById("adminReportDate");
    const reportSendEmailBtn = document.getElementById("adminReportSendEmailBtn");
    const reportPrintBtn = document.getElementById("adminReportPrintBtn");
    const reportActionStatus = document.getElementById("adminReportActionStatus");
    const reportPeriodLabel = document.getElementById("adminReportPeriodLabel");
    const repNewClientsVal = document.getElementById("repNewClientsVal");
    const repCreditedVal = document.getElementById("repCreditedVal");
    const repRedeemedVal = document.getElementById("repRedeemedVal");
    const repBalanceVal = document.getElementById("repBalanceVal");
    const repTotalClientsHistorical = document.getElementById("repTotalClientsHistorical");
    const reportSedesTableBody = document.getElementById("adminReportSedesTableBody");
    const reportConfigForm     = document.getElementById("adminReportConfigForm");
    const reportEmailInput      = document.getElementById("adminReportEmailInput");
    const reportAddEmailBtn     = document.getElementById("adminReportAddEmailBtn");
    const reportEmailsList      = document.getElementById("adminReportEmailsList");
    const reportConfigResult    = document.getElementById("adminReportConfigResult");
    const reportScheduleEnabled    = document.getElementById("adminReportScheduleEnabled");
    const reportScheduleTime       = document.getElementById("adminReportScheduleTime");
    const reportSchedulePeriod     = document.getElementById("adminReportSchedulePeriod");
    const reportScheduleTimeGroup  = document.getElementById("adminReportScheduleTimeGroup");
    const reportSchedulePeriodGroup = document.getElementById("adminReportSchedulePeriodGroup");

    // ── Email list state ─────────────────────────────────────────────────────
    let configuredReportEmails = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const renderConfiguredEmails = () => {
      if (!reportEmailsList) return;
      if (configuredReportEmails.length === 0) {
        reportEmailsList.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"><path d="M4 4h16v16H4z" stroke="none"/><path d="M22 6l-10 7L2 6"/><polyline points="2,6 2,20 22,20 22,6"/></svg>
            <span style="font-size:13px;color:rgba(255,255,255,0.3);font-style:italic;">No hay destinatarios configurados aún.</span>
          </div>`;
        return;
      }
      reportEmailsList.innerHTML = configuredReportEmails.map((email, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;
          background:rgba(6,182,212,0.06);border:1px solid rgba(6,182,212,0.2);
          border-radius:8px;padding:9px 12px;transition:background 0.15s;"
          onmouseover="this.style.background='rgba(6,182,212,0.12)'"
          onmouseout="this.style.background='rgba(6,182,212,0.06)'">
          <div style="display:flex;align-items:center;gap:8px;overflow:hidden;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#06b6d4" stroke-width="2" style="flex-shrink:0">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <span style="font-size:13px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${email}">${email}</span>
          </div>
          <button type="button" onclick="window._removeReportEmail(${i})"
            title="Eliminar ${email}"
            style="flex-shrink:0;background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.3);color:#f43f5e;
              width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:15px;line-height:1;
              display:flex;align-items:center;justify-content:center;transition:background 0.15s,border-color 0.15s;"
            onmouseover="this.style.background='rgba(244,63,94,0.22)';this.style.borderColor='rgba(244,63,94,0.6)'"
            onmouseout="this.style.background='rgba(244,63,94,0.1)';this.style.borderColor='rgba(244,63,94,0.3)'">
            &times;
          </button>
        </div>`).join("");
    };

    window._removeReportEmail = (index) => {
      configuredReportEmails.splice(index, 1);
      renderConfiguredEmails();
    };

    const addReportEmail = () => {
      if (!reportEmailInput) return;
      const val = reportEmailInput.value.trim().toLowerCase();
      if (!emailRegex.test(val)) {
        reportEmailInput.style.borderColor = "rgba(244,63,94,0.7)";
        reportEmailInput.focus();
        setTimeout(() => { reportEmailInput.style.borderColor = "rgba(255,255,255,0.1)"; }, 1500);
        return;
      }
      if (configuredReportEmails.includes(val)) {
        reportEmailInput.style.borderColor = "rgba(251,191,36,0.7)";
        setTimeout(() => { reportEmailInput.style.borderColor = "rgba(255,255,255,0.1)"; }, 1500);
        reportEmailInput.select();
        return;
      }
      configuredReportEmails.push(val);
      reportEmailInput.value = "";
      renderConfiguredEmails();
    };

    const getVzlaTodayStr = () => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Caracas',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(new Date());
      const d = {};
      parts.forEach(p => d[p.type] = p.value);
      return `${d.year}-${d.month}-${d.day}`;
    };

    let currentReportPeriod = "day";
    let currentReportDate = getVzlaTodayStr();
    let allCards = [];
    let selectedToken = "";
    let selectedBranch = "";
    let currentValidCode = null;
    let currentTxLimit = 10;
    let currentCardTxLimit = 10;
    const setText = (el, text) => {
      if (el) el.textContent = String(text != null ? text : "");
    };
    const setResult = (el, type, msg) => {
      if (!el) return;
      el.className = "aResult" + (type ? ` aResult--${type}` : "");
      el.textContent = msg;
    };
    const apiGet = async (path) => {
      const res = await fetch(path, { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err = new Error((data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return data;
    };
    const formatTxDate = (tx) => {
      const iso = tx.processedAt || tx.createdAt || "";
      if (!iso) return "\u2014";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "\u2014";
      return d.toLocaleString("es-VE", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    };
    const renderTxTable = (container, txs, mode) => {
      if (!container) return;
      container.innerHTML = "";
      if (!txs.length) {
        const empty = document.createElement("div");
        empty.className = "aTxEmpty";
        empty.textContent = "Sin transacciones registradas";
        container.appendChild(empty);
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "aTxTable";
      const headLabels = mode === "card" ? ["Fecha", "Tipo", "Estado", "Pts", "Antes", "Despu\xE9s", "Sede", "Descripci\xF3n", "Acci\xF3n"] : ["Fecha", "Tipo", "Estado", "Pts", "Cliente", "Sede", "Descripci\xF3n", "Acci\xF3n"];
      const head = document.createElement("div");
      head.className = mode === "card" ? "aTxRow aTxRow--card aTxRow--head" : "aTxRow aTxRow--head";
      for (const lbl of headLabels) {
        const c = document.createElement("div");
        c.className = "aTxCell" + (lbl === "Acci\xF3n" ? " aTxCell--actions" : "");
        c.textContent = lbl;
        head.appendChild(c);
      }
      wrap.appendChild(head);
      for (const t of txs) {
        const row = document.createElement("div");
        row.className = mode === "card" ? "aTxRow aTxRow--card" : "aTxRow";
        const pts = Number.isFinite(Number(t.points)) ? Number(t.points) : 0;
        const before = Number.isFinite(Number(t.balanceBefore)) ? Number(t.balanceBefore) : null;
        const after = Number.isFinite(Number(t.balanceAfter)) ? Number(t.balanceAfter) : null;
        const addCell = (label, text, cls) => {
          const c = document.createElement("div");
          c.className = "aTxCell" + (cls ? ` ${cls}` : "");
          c.setAttribute("data-label", label);
          c.textContent = text;
          row.appendChild(c);
        };
        addCell("Fecha", formatTxDate(t));
        addCell("Tipo", String(t.type || "\u2014"));
        addCell("Estado", String(t.status || "\u2014"), "aTxCell--strong");
        addCell("Pts", formatPts(pts), "aTxCell--pts");
        if (mode === "card") {
          addCell("Antes", before === null ? "\u2014" : formatPts(before));
          addCell("Despu\xE9s", after === null ? "\u2014" : formatPts(after));
        } else {
          addCell("Cliente", String((t == null ? void 0 : t.name) || (t == null ? void 0 : t.token) || "\u2014"));
        }
        addCell("Sede", String(t.branchName || "\u2014"));
        addCell("Descripci\xF3n", String(t.description || "\u2014"));
        
        const actionsCell = document.createElement("div");
        actionsCell.className = "aTxCell aTxCell--actions";
        const delBtn = document.createElement("button");
        delBtn.className = "aTxDelBtn";
        delBtn.textContent = "Eliminar";
        delBtn.onclick = (e) => {
          e.stopPropagation();
          doDeleteTransaction(t.id);
        };
        actionsCell.appendChild(delBtn);
        row.appendChild(actionsCell);

        wrap.appendChild(row);
      }
      container.appendChild(wrap);
    };
    const showDash = () => {
      if (dash) dash.hidden = false;
    };
    const switchPanel = (panel) => {
      if (panelClientes) panelClientes.hidden = panel !== "clientes";
      if (panelTx) panelTx.hidden = panel !== "transacciones";
      if (panelStats) panelStats.hidden = panel !== "metricas";
      if (panelCajeros) panelCajeros.hidden = panel !== "cajeros";
      if (panelComercios) panelComercios.hidden = panel !== "comercios";
      if (panelSedes) panelSedes.hidden = panel !== "sedes";
      if (panelReportes) panelReportes.hidden = panel !== "reportes";
      if (panelReferidos) panelReferidos.hidden = panel !== "referidos";
      if (panelMarketing) panelMarketing.hidden = panel !== "marketing";
      if (panelPromociones) panelPromociones.hidden = panel !== "promociones";
      
      if (navClientes) navClientes.classList.toggle("is-active", panel === "clientes");
      if (navTx) navTx.classList.toggle("is-active", panel === "transacciones");
      if (navStats) navStats.classList.toggle("is-active", panel === "metricas");
      if (navCajeros) navCajeros.classList.toggle("is-active", panel === "cajeros");
      if (navComercios) navComercios.classList.toggle("is-active", panel === "comercios");
      if (navSedes) navSedes.classList.toggle("is-active", panel === "sedes");
      if (navReportes) navReportes.classList.toggle("is-active", panel === "reportes");
      if (navReferidos) navReferidos.classList.toggle("is-active", panel === "referidos");
      if (navMarketing) navMarketing.classList.toggle("is-active", panel === "marketing");
      if (navPromociones) navPromociones.classList.toggle("is-active", panel === "promociones");
      
      const mobClientes = document.getElementById("aMobNavClientes");
      const mobTx = document.getElementById("aMobNavTx");
      const mobStats = document.getElementById("aMobNavStats");
      const mobCajeros = document.getElementById("aMobNavCajeros");
      const mobComercios2 = document.getElementById("aMobNavComercios");
      const mobSedes = document.getElementById("aMobNavSedes");
      const mobReportes = document.getElementById("aMobNavReportes");
      const mobReferidos = document.getElementById("aMobNavReferidos");
      const mobMarketing = document.getElementById("aMobNavMarketing");
      const mobPromociones = document.getElementById("aMobNavPromociones");
      if (mobClientes) mobClientes.classList.toggle("is-active", panel === "clientes");
      if (mobTx) mobTx.classList.toggle("is-active", panel === "transacciones");
      if (mobStats) mobStats.classList.toggle("is-active", panel === "metricas");
      if (mobCajeros) mobCajeros.classList.toggle("is-active", panel === "cajeros");
      if (mobComercios2) mobComercios2.classList.toggle("is-active", panel === "comercios");
      if (mobSedes) mobSedes.classList.toggle("is-active", panel === "sedes");
      if (mobReportes) mobReportes.classList.toggle("is-active", panel === "reportes");
      if (mobReferidos) mobReferidos.classList.toggle("is-active", panel === "referidos");
      if (mobMarketing) mobMarketing.classList.toggle("is-active", panel === "marketing");
      if (mobPromociones) mobPromociones.classList.toggle("is-active", panel === "promociones");
      const main = document.querySelector(".aDash__main");
      if (main) main.scrollTop = 0;
    };
    if (navClientes) navClientes.addEventListener("click", () => switchPanel("clientes"));
    if (navTx) navTx.addEventListener("click", () => {
      switchPanel("transacciones");
      currentTxLimit = 10;
      loadAllTransactions("");
    });
    if (navStats) navStats.addEventListener("click", () => {
      switchPanel("metricas");
      loadAdminStats();
    });
    if (navCajeros) navCajeros.addEventListener("click", () => {
      switchPanel("cajeros");
      loadCashiers();
    });
    if (navComercios) navComercios.addEventListener("click", () => {
      switchPanel("comercios");
      loadMerchants();
    });
    if (navSedes) navSedes.addEventListener("click", () => {
      switchPanel("sedes");
      loadSedesStats();
    });
    if (navReportes) navReportes.addEventListener("click", () => {
      switchPanel("reportes");
      loadAdminReports();
      loadReportsConfig();
    });
    if (navReferidos) navReferidos.addEventListener("click", () => {
      switchPanel("referidos");
    });
    if (navMarketing) navMarketing.addEventListener("click", () => {
      switchPanel("marketing");
      loadMarketingUsers();
    });
    if (navPromociones) navPromociones.addEventListener("click", () => {
      switchPanel("promociones");
      loadPromotionsAdmin();
    });
    const mobNavClientes = document.getElementById("aMobNavClientes");
    const mobNavTx = document.getElementById("aMobNavTx");
    const mobNavStats = document.getElementById("aMobNavStats");
    const mobNavMarketing = document.getElementById("aMobNavMarketing");
    const mobNavPromociones = document.getElementById("aMobNavPromociones");
    const mobNavCajerosLocal = document.getElementById("aMobNavCajeros");
    const mobNavLogout = document.getElementById("aMobNavLogout");
    if (mobNavClientes) mobNavClientes.addEventListener("click", () => switchPanel("clientes"));
    if (mobNavTx) mobNavTx.addEventListener("click", () => {
      switchPanel("transacciones");
      currentTxLimit = 10;
      loadAllTransactions("");
    });
    if (mobNavStats) mobNavStats.addEventListener("click", () => {
      switchPanel("metricas");
      loadAdminStats();
    });
    if (mobNavCajerosLocal) mobNavCajerosLocal.addEventListener("click", () => {
      switchPanel("cajeros");
      loadCashiers();
    });
    const mobNavComerciosLocal = document.getElementById("aMobNavComercios");
    if (mobNavComerciosLocal) mobNavComerciosLocal.addEventListener("click", () => {
      switchPanel("comercios");
      loadMerchants();
    });
    if (mobNavSedes) mobNavSedes.addEventListener("click", () => {
      switchPanel("sedes");
      loadSedesStats();
    });
    if (mobNavReportes) mobNavReportes.addEventListener("click", () => {
      switchPanel("reportes");
      loadAdminReports();
      loadReportsConfig();
    });
    if (mobNavReferidos) mobNavReferidos.addEventListener("click", () => {
      switchPanel("referidos");
    });
    if (mobNavMarketing) mobNavMarketing.addEventListener("click", () => {
      switchPanel("marketing");
      loadMarketingUsers();
    });
    if (mobNavPromociones) mobNavPromociones.addEventListener("click", () => {
      switchPanel("promociones");
      loadPromotionsAdmin();
    });

    if (goQrBtn) goQrBtn.addEventListener("click", () => {
      window.location.href = "/admin/qr";
    });
    const doLogout = async (e) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      try {
        await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
        window.location.replace("/login");
      } catch (err) {
        window.location.replace("/login");
      }
    };
    if (logoutBtn) logoutBtn.addEventListener("click", doLogout);
    if (mobNavLogout) mobNavLogout.addEventListener("click", (e) => doLogout(e));
    if (adminLogoutBtn) adminLogoutBtn.addEventListener("click", doLogout);

    const doResetTransactions = async () => {
      const password = window.prompt("\xBFEst\xE1s seguro de que deseas reiniciar todas las transacciones?\n\nEsta acci\xF3n eliminar\xE1 el historial completo y dejar\xE1 los saldos en 0.\n\nPOR FAVOR, INGRESA TU CLAVE PARA CONFIRMAR:");
      
      if (password === null) return; // Cancelled
      if (!password.trim()) {
        alert("Se requiere la clave para proceder.");
        return;
      }

      try {
        const res = await fetch("/api/admin/reset-transactions", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password.trim() }),
          credentials: "include" 
        });
        const data = await res.json().catch(() => null);
        
        if (!res.ok || !(data == null ? void 0 : data.ok)) {
          alert("Error al reiniciar: " + ((data == null ? void 0 : data.error) || "Desconocido"));
          return;
        }
        
        alert("Reinicio completado con \xE9xito. Todos los balances est\xE1n en 0.");
        
        // Recargar el panel actual para reflejar los cambios
        if (panelClientes && !panelClientes.hidden) loadClients();
        if (panelTx && !panelTx.hidden) loadAllTransactions();
        if (panelStats && !panelStats.hidden) loadAdminStats();
        
        // Cerrar el menú de perfil si está abierto
        const menu = document.getElementById("profileMenu");
        if (menu) {
          menu.classList.remove("profileMenu--active");
          menu.setAttribute("aria-hidden", "true");
        }
      } catch (err) {
        alert("Error de red al intentar reiniciar transacciones.");
      }
    };

    if (adminResetTxsBtn) {
      adminResetTxsBtn.addEventListener("click", doResetTransactions);
    }

    const doManualCredit = async () => {
      if (!selectedToken) {
        alert("Por favor, selecciona un cliente primero buscando por nombre o c\xE9dula.");
        return;
      }

      const pointsStr = window.prompt(`Ingresa la cantidad de puntos a ABONAR a ${clientNameEl ? clientNameEl.textContent : 'este cliente'}:`);
      if (pointsStr === null) return;
      const points = Number(pointsStr);
      if (isNaN(points) || points <= 0) {
        alert("Cantidad de puntos inv\xE1lida.");
        return;
      }

      const password = window.prompt("Introduce tu CLAVE DE ADMINISTRADOR para confirmar el abono manual:");
      if (password === null) return;
      if (!password.trim()) {
        alert("Se requiere la clave para continuar.");
        return;
      }

      try {
        const res = await fetch("/api/admin/manual-credit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: selectedToken,
            points: points,
            password: password.trim()
          }),
          credentials: "include"
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !(data == null ? void 0 : data.ok)) {
          alert("Error: " + ((data == null ? void 0 : data.error) || "Desconocido"));
          return;
        }

        alert(data.message || "Puntos acreditados correctamente.");
        
        // Recargar datos para ver el nuevo balance
        loadClients();
        if (selectedToken) loadCardTransactions(selectedToken);
        loadAdminStats();
      } catch (err) {
        alert("Error de red al intentar acreditar puntos.");
      }
    };

    if (adminCreditPointsBtn) {
      adminCreditPointsBtn.addEventListener("click", doManualCredit);
    }

    const doCreateCashier = async () => {
      const username = String(window.prompt("Nombre de usuario del cajero:") ?? "").trim().toLowerCase();
      if (!username) return;

      const password = String(window.prompt("Contraseña del cajero (mínimo 6 caracteres):") ?? "").trim();
      if (!password) return;

      if (password.length < 6) {
        alert("La contraseña es muy corta.");
        return;
      }

      const name = String(window.prompt("Nombre del cajero (opcional):") ?? "").trim();

      try {
        const res = await fetch("/api/admin/cashiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password, name })
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            doLogout();
            return;
          }
          alert(String((data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`));
          return;
        }

        alert("Cajero creado correctamente.");
        if (panelCajeros && !panelCajeros.hidden) loadCashiers();
      } catch {
        alert("Error de red al crear el cajero.");
      }
    };

    if (adminCreateCashierBtn) {
      adminCreateCashierBtn.addEventListener("click", doCreateCashier);
    }

    const doCreateMerchant = async () => {
      const name = String(window.prompt("Nombre del comercio:") ?? "").trim();
      if (!name) return;

      const email = String(window.prompt("Correo electrónico del comercio:") ?? "").trim();
      if (!email) return;

      try {
        const res = await fetch("/api/admin/invite-merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, email })
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            doLogout();
            return;
          }
          alert(String(data?.error || data?.message || `Error (${res.status})`));
          return;
        }

        alert("Invitación enviada correctamente al correo proporcionado.");
      } catch {
        alert("Error de red al invitar al comercio.");
      }
    };

    if (adminCreateMerchantBtn) {
      adminCreateMerchantBtn.addEventListener("click", doCreateMerchant);
    }

    const doEditClient = async () => {
      if (!selectedToken) {
        alert("Por favor, selecciona un cliente primero.");
        return;
      }

      const current = allCards.find((c) => c.token === selectedToken) || { name: "", cedula: "", sedes: "" };
      const name = String(window.prompt("Nombre del cliente:", current.name || "") ?? "").trim();
      if (!name) return;

      const cedula = String(window.prompt("Cédula del cliente:", current.cedula || "") ?? "").trim();
      if (!cedula) return;

      const email = String(window.prompt("Correo del cliente:", current.email || "") ?? "").trim();

      const sede = String(window.prompt("Sede del cliente:", current.sedes || "") ?? "").trim();

      setResult(clientsResult, "info", "Actualizando cliente…");
      try {
        const res = await fetch("/api/admin/cards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: selectedToken, name, cedula, sede, email })
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            doLogout();
            return;
          }
          setResult(clientsResult, "err", (data == null ? void 0 : data.error) || `Error (${res.status})`);
          return;
        }

        await loadClients();
        const updated = allCards.find((c) => c.token === selectedToken);
        if (updated) selectClient(updated);
        setResult(clientsResult, "ok", "Datos actualizados.");
      } catch {
        setResult(clientsResult, "err", "Error de red al actualizar.");
      }
    };

    const doDeleteClient = async () => {
      if (!selectedToken) {
        alert("Por favor, selecciona un cliente primero.");
        return;
      }

      const current = allCards.find((c) => c.token === selectedToken) || { name: "", cedula: "" };
      const ok = window.confirm(
        `¿Eliminar al cliente${current.name ? ` "${current.name}"` : ""}${current.cedula ? ` (CI: ${current.cedula})` : ""}?

Esto eliminará también sus transacciones.`
      );
      if (!ok) return;

      const password = String(window.prompt("Introduce tu CLAVE DE ADMINISTRADOR para confirmar la eliminación:") ?? "").trim();
      if (!password) {
        alert("Se requiere la clave para continuar.");
        return;
      }

      setResult(clientsResult, "info", "Eliminando cliente…");
      try {
        const res = await fetch("/api/admin/cards", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: selectedToken, password, deleteTransactions: true })
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            doLogout();
            return;
          }
          setResult(clientsResult, "err", (data == null ? void 0 : data.error) || `Error (${res.status})`);
          return;
        }

        clearClient();
        await loadClients();
        if (panelTx && !panelTx.hidden) loadAllTransactions();
        if (panelStats && !panelStats.hidden) loadAdminStats();
        setResult(clientsResult, "ok", "Cliente eliminado.");
      } catch {
        setResult(clientsResult, "err", "Error de red al eliminar.");
      }
    };

    const doResendCard = async () => {
      if (!selectedToken) {
        alert("Por favor, selecciona un cliente primero.");
        return;
      }

      const current = allCards.find((c) => c.token === selectedToken) || { name: "", email: "" };
      if (!current.email || !current.email.includes('@')) {
        alert("Este cliente no tiene un correo válido configurado. Por favor, dale a 'Editar' y asigna un correo electrónico primero.");
        return;
      }

      const ok = window.confirm(`¿Enviar enlace de la tarjeta al correo ${current.email}?`);
      if (!ok) return;

      setResult(clientsResult, "info", "Enviando correo...");
      try {
        const res = await fetch("/api/admin/resend-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: selectedToken })
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            doLogout();
            return;
          }
          setResult(clientsResult, "err", (data?.error || `Error (${res.status})`));
          return;
        }

        setResult(clientsResult, "ok", "Correo enviado exitosamente.");
      } catch {
        setResult(clientsResult, "err", "Error de red al reenviar la tarjeta.");
      }
    };

    const doDeleteTransaction = async (txId) => {
      const ok = window.confirm("\xBFEst\xE1s seguro de que deseas eliminar esta transacci\xF3n?\n\nEsta acci\xF3n afectar\xE1 el balance del cliente de forma permanente.");
      if (!ok) return;

      const password = window.prompt("Introduce tu CLAVE DE ADMINISTRADOR para confirmar la eliminaci\xF3n:");
      if (password === null) return;
      if (!password.trim()) {
        alert("Se requiere la clave para continuar.");
        return;
      }

      try {
        const res = await fetch("/api/admin/delete-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: txId, password: password.trim() })
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          alert("Error: " + ((data == null ? void 0 : data.error) || "Desconocido"));
          return;
        }

        alert("Transacci\xF3n eliminada y balance actualizado.");
        
        // Refresh relevant panels
        if (panelTx && !panelTx.hidden) loadAllTransactions();
        if (selectedToken) {
          await loadClients(); // Refresh client list to get new balance
          const updated = allCards.find(c => c.token === selectedToken);
          if (updated) selectClient(updated);
        } else {
          // If we are in general transactions view, we still want to refresh client data in memory
          loadClients();
        }
        if (panelStats && !panelStats.hidden) loadAdminStats();
      } catch (err) {
        alert("Error de red al intentar eliminar la transacci\xF3n.");
      }
    };

    if (clientEditBtn) clientEditBtn.addEventListener("click", doEditClient);
    if (clientResendBtn) clientResendBtn.addEventListener("click", doResendCard);
    if (clientDeleteBtn) clientDeleteBtn.addEventListener("click", doDeleteClient);

    const getInitials = (name) => {
      const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
      return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
    };
    const clearClient = () => {
      selectedToken = "";
      if (clientCard) clientCard.hidden = true;
      if (cardTxSection) cardTxSection.hidden = true;
      if (clientEditBtn) clientEditBtn.disabled = true;
      if (clientResendBtn) clientResendBtn.disabled = true;
      if (clientDeleteBtn) clientDeleteBtn.disabled = true;
      if (searchInput) searchInput.value = "";
      if (dropdown) {
        dropdown.hidden = true;
        dropdown.innerHTML = "";
      }
    };
    const selectClient = (c) => {
      var _a, _b;
      selectedToken = c.token;
      if (clientEditBtn) clientEditBtn.disabled = false;
      if (clientResendBtn) clientResendBtn.disabled = false;
      if (clientDeleteBtn) clientDeleteBtn.disabled = false;
      if (searchInput) searchInput.value = "";
      if (dropdown) {
        dropdown.hidden = true;
        dropdown.innerHTML = "";
      }
      if (clientAvatarEl) clientAvatarEl.textContent = getInitials(c.name);
      if (clientNameEl) clientNameEl.textContent = c.name || "\u2014";
      if (clientMetaEl) clientMetaEl.textContent = c.cedula ? `CI: ${c.cedula}` : "Sin c\xE9dula";
      const sedesEl = document.getElementById("aClientSedes");
      if (sedesEl) sedesEl.textContent = `Sede: ${c.sedes || "Sin sede"}`;
      if (clientBalanceEl) clientBalanceEl.textContent = formatPts((_a = c.balance) != null ? _a : 0);
      const cashEl = document.getElementById("aClientBalanceCash");
      if (cashEl) cashEl.textContent = `\u2248 ${formatPts(Number((_b = c.balance) != null ? _b : 0) / 100)} $`;
      if (clientCard) clientCard.hidden = false;
      if (cardTxSection) {
        cardTxSection.hidden = false;
      }
      if (cardTxHint) cardTxHint.textContent = `Transacciones \xB7 ${c.name || "\u2014"}`;
      currentCardTxLimit = 10;
      loadCardTransactions(c.token);
    };
    if (clientClearBtn) clientClearBtn.addEventListener("click", clearClient);
    const buildDropdown = (query) => {
      if (!dropdown || !searchInput) return;
      const q = query.trim().toLowerCase();
      if (!q) {
        dropdown.hidden = true;
        dropdown.innerHTML = "";
        return;
      }
      const matches = allCards.filter((c) => 
        c.name.toLowerCase().includes(q) || 
        c.cedula.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.token.toLowerCase().includes(q)
      ).slice(0, 8);
      dropdown.innerHTML = "";
      if (!matches.length) {
        if (isSearchingRemote) {
          const el = document.createElement("div");
          el.className = "aDropdown__empty";
          el.textContent = "Buscando\u2026";
          dropdown.appendChild(el);
          dropdown.hidden = false;
          return;
        }
        const el = document.createElement("div");
        el.className = "aDropdown__empty";
        el.textContent = "Sin resultados";
        dropdown.appendChild(el);
        dropdown.hidden = false;
        return;
      }
      for (const c of matches) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "aDropdown__item";
        btn.innerHTML = `<span class="aDropdown__name">${c.name || "\u2014"}</span><span class="aDropdown__cedula">${c.cedula || ""}</span><span class="aDropdown__pts">${formatPts(c.balance)} pts</span>`;
        btn.addEventListener("click", () => selectClient(c));
        dropdown.appendChild(btn);
      }
      dropdown.hidden = false;
    };
    let searchTimeout = null;
    let isSearchingRemote = false;
    const performRemoteSearch = async (query) => {
      if (!query || query.length < 2) return;
      isSearchingRemote = true;
      buildDropdown(query);
      try {
        const data = await apiGet(`/api/admin/cards?limit=20&q=${encodeURIComponent(query)}`);
        const results = (Array.isArray(data == null ? void 0 : data.cards) ? data.cards : []).map((c) => ({
          token: String(c.token || "").trim(),
          name: String(c.name || "").trim(),
          email: String(c.email || "").trim(),
          cedula: String(c.cedula || "").trim(),
          sedes: String(c.sedes || "Sin sede").trim(),
          balance: Number(c.balance || 0)
        }));
        
        for (const r of results) {
          if (!allCards.find(c => c.token === r.token)) {
            allCards.push(r);
          }
        }
        isSearchingRemote = false;
        if (searchInput.value.trim().toLowerCase() === query.trim().toLowerCase()) {
          buildDropdown(query);
        }
      } catch (err) {
        isSearchingRemote = false;
        setResult(clientsResult, "err", `Error en búsqueda: ${err.message}`);
      }
    };

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const val = searchInput.value;
        buildDropdown(val);
        
        if (searchTimeout) clearTimeout(searchTimeout);
        if (val.trim().length >= 2) {
          searchTimeout = setTimeout(() => performRemoteSearch(val), 500);
        }
      });
      searchInput.addEventListener("focus", () => {
        if (searchInput.value) buildDropdown(searchInput.value);
      });
      document.addEventListener("click", (e) => {
        if (!searchInput.contains(e.target) && !(dropdown == null ? void 0 : dropdown.contains(e.target))) {
          if (dropdown) {
            dropdown.hidden = true;
          }
        }
      });
    }
    const loadClients = async () => {
      var _a;
      setResult(clientsResult, "info", "Cargando clientes\u2026");
      try {
        const data = await apiGet("/api/admin/cards?limit=500");
        allCards = (Array.isArray(data == null ? void 0 : data.cards) ? data.cards : []).map((c) => {
          var _a2, _b, _c;
          return {
            token: String((_a2 = c == null ? void 0 : c.token) != null ? _a2 : "").trim(),
            name: String((_b = c == null ? void 0 : c.name) != null ? _b : "").trim(),
            email: String((c == null ? void 0 : c.email) || "").trim(),
            cedula: String((_c = c == null ? void 0 : c.cedula) != null ? _c : "").trim(),
            sedes: String((c == null ? void 0 : c.sedes) || (c == null ? void 0 : c.sede) || "Sin sede").trim(),
            balance: Number.isFinite(Number(c == null ? void 0 : c.balance)) ? Number(c.balance) : 0
          };
        }).filter((c) => c.token);
        setResult(clientsResult, "", "");
      } catch (err) {
        if ((err == null ? void 0 : err.status) === 401) {
          doLogout();
          return;
        }
        setResult(clientsResult, "err", (_a = err == null ? void 0 : err.message) != null ? _a : "Error al cargar clientes");
      }
    };

    const loadAllTransactions = async (branch = selectedBranch) => {
      var _a;
      if (!txList) return;
      selectedBranch = branch;

      // Update header to reflect if we're filtering
      const titleEl = panelTx.querySelector(".aPanel__title");
      const subEl = panelTx.querySelector(".aPanel__sub");
      if (selectedBranch) {
        if (titleEl) titleEl.innerHTML = `Tx: ${selectedBranch} <button id="clearBranchFilter" style="font-size: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 8px; cursor: pointer; vertical-align: middle;">Limpiar</button>`;
        if (subEl) subEl.textContent = `Viendo transacciones de esta sede`;
        const btn = document.getElementById("clearBranchFilter");
        if (btn) btn.onclick = () => loadAllTransactions("");
      } else {
        if (titleEl) titleEl.textContent = `Transacciones`;
        if (subEl) subEl.textContent = `Historial reciente de todas las tarjetas`;
      }

      if (adminTxLoadMore) adminTxLoadMore.disabled = true;
      setResult(txResult, "info", "Cargando\u2026");
      try {
        let url = `/api/admin/transactions?limit=${currentTxLimit}`;
        if (selectedBranch) url += `&branch=${encodeURIComponent(selectedBranch)}`;
        const data = await apiGet(url);
        const txs = Array.isArray(data == null ? void 0 : data.transactions) ? data.transactions : [];
        renderTxTable(txList, txs, "all");
        setResult(txResult, "", "");
        if (adminTxLoadMore) {
          adminTxLoadMore.hidden = txs.length < currentTxLimit;
          adminTxLoadMore.disabled = false;
        }
      } catch (err) {
        if ((err == null ? void 0 : err.status) === 401) {
          doLogout();
          return;
        }
        if (adminTxLoadMore) adminTxLoadMore.disabled = false;
        setResult(txResult, "err", (_a = err == null ? void 0 : err.message) != null ? _a : "Error");
      }
    };
    const loadCardTransactions = async (token) => {
      var _a;
      if (!cardTxList) return;
      if (adminCardTxLoadMore) adminCardTxLoadMore.disabled = true;
      setResult(cardTxResult, "info", "Cargando\u2026");
      try {
        const data = await apiGet(`/api/admin/transactions?token=${encodeURIComponent(token)}&limit=${currentCardTxLimit}`);
        const txs = Array.isArray(data == null ? void 0 : data.transactions) ? data.transactions : [];
        renderTxTable(cardTxList, txs, "card");
        setResult(cardTxResult, "", "");
        if (adminCardTxLoadMore) {
          adminCardTxLoadMore.hidden = txs.length < currentCardTxLimit;
          adminCardTxLoadMore.disabled = false;
        }
      } catch (err) {
        if ((err == null ? void 0 : err.status) === 401) {
          doLogout();
          return;
        }
        if (adminCardTxLoadMore) adminCardTxLoadMore.disabled = false;
        setResult(cardTxResult, "err", (_a = err == null ? void 0 : err.message) != null ? _a : "Error");
      }
    };
    if (adminTxLoadMore) {
      adminTxLoadMore.addEventListener("click", () => {
        currentTxLimit += 10;
        loadAllTransactions();
      });
    }
    if (adminCardTxLoadMore) {
      adminCardTxLoadMore.addEventListener("click", () => {
        currentCardTxLimit += 10;
        loadCardTransactions(selectedToken);
      });
    }
    if (txRefresh) {
      txRefresh.addEventListener("click", () => {
        currentTxLimit = 10;
        loadAllTransactions();
      });
    }

    let currentSedesRange = "all";
    const loadSedesStats = async (range = currentSedesRange) => {
      if (!sedesList) return;
      currentSedesRange = range;
      
      const filterGroup = document.getElementById("sedesFilterGroups");
      if (filterGroup) {
        filterGroup.querySelectorAll(".aFilterBtn").forEach(btn => {
          btn.classList.toggle("is-active", btn.getAttribute("data-range") === range);
        });
      }

      setResult(sedesResult, "info", "Cargando desglose de sedes\u2026");
      try {
        const data = await apiGet(`/api/admin/stats?range=${encodeURIComponent(range)}`);
        renderSedesTable(sedesList, data);
        setResult(sedesResult, "", "");
      } catch (err) {
        if ((err == null ? void 0 : err.status) === 401) {
          doLogout();
          return;
        }
        setResult(sedesResult, "err", (err == null ? void 0 : err.message) || "Error al cargar sedes");
      }
    };

    const sedesFilterGroup = document.getElementById("sedesFilterGroups");
    if (sedesFilterGroup) {
      sedesFilterGroup.addEventListener("click", (e) => {
        const btn = e.target.closest(".aFilterBtn");
        if (btn) {
          const range = btn.getAttribute("data-range");
          if (range) loadSedesStats(range);
        }
      });
    }

    const renderSedesTable = (container, data) => {
      if (!container) return;
      container.innerHTML = "";
      
      const earned = data.earnedByBranch || {};
      const redeemed = data.redeemedByBranch || {};
      const clients = data.clientsByBranch || {};
      
      // Get unique list of all branches mentioned
      const branches = [...new Set([
        ...Object.keys(earned),
        ...Object.keys(redeemed),
        ...Object.keys(clients)
      ])].sort();

      if (!branches.length) {
        const empty = document.createElement("div");
        empty.className = "aTxEmpty";
        empty.textContent = "No hay datos de sedes registrados";
        container.appendChild(empty);
        return;
      }

      const wrap = document.createElement("div");
      wrap.className = "aTxTable";
      
      const head = document.createElement("div");
      head.className = "aTxRow aTxRow--sedes aTxRow--head";
      ["Sede", "Clientes", "Acreditados", "Canjeados", "Balance"].forEach(lbl => {
        const c = document.createElement("div");
        c.className = "aTxCell";
        c.textContent = lbl;
        head.appendChild(c);
      });
      wrap.appendChild(head);

      for (const b of branches) {
        const row = document.createElement("div");
        row.className = "aTxRow aTxRow--sedes";
        
        const bEarned = earned[b] || 0;
        const bRedeemed = redeemed[b] || 0;
        const bClients = clients[b] || 0;
        const bBalance = bEarned - bRedeemed;

        const addCell = (label, text, cls) => {
          const div = document.createElement("div");
          div.className = "aTxCell" + (cls ? ` ${cls}` : "");
          div.setAttribute("data-label", label);
          div.textContent = text;
          row.appendChild(div);
        };

        addCell("Sede", b, "aTxCell--strong");
        addCell("Clientes", String(bClients));
        addCell("Acreditados", formatPts(bEarned));
        addCell("Canjeados", formatPts(bRedeemed));
        addCell("Balance", formatPts(bBalance), bBalance >= 0 ? "aTxCell--pts" : "aTxCell--danger");
        
        row.style.cursor = "pointer";
        row.addEventListener("click", () => {
          currentTxLimit = 10;
          selectedBranch = b;
          switchPanel("transacciones");
          loadAllTransactions(b);
        });

        wrap.appendChild(row);
      }
      container.appendChild(wrap);
    };

    if (sedesRefresh) sedesRefresh.addEventListener("click", loadSedesStats);

    // --- REPORTS PANEL INTERACTIVITY ---

    const apiPost = async (path, bodyObj) => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
        credentials: "include"
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err = new Error((data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return data;
    };

    const loadAdminReports = async () => {
      if (!panelReportes) return;
      
      // Update filter buttons UI
      const periodFilterGroup = document.getElementById("reportPeriodFilterGroups");
      if (periodFilterGroup) {
        periodFilterGroup.querySelectorAll(".aFilterBtn").forEach(btn => {
          btn.classList.toggle("is-active", btn.getAttribute("data-period") === currentReportPeriod);
        });
      }

      // Initialize date input value if it hasn't been set
      if (reportDateInput && !reportDateInput.value) {
        reportDateInput.value = currentReportDate;
      }

      // Set loading state
      if (reportActionStatus) {
        reportActionStatus.className = "aResult aResult--info";
        reportActionStatus.textContent = "Cargando datos del reporte...";
      }

      try {
        const data = await apiGet(`/api/admin/reports?date=${encodeURIComponent(currentReportDate)}&period=${encodeURIComponent(currentReportPeriod)}`);
        
        // Update stats cards
        if (repNewClientsVal) repNewClientsVal.textContent = data.totalNewClients;
        if (repCreditedVal) repCreditedVal.textContent = `+${formatPts(data.totalPointsCredited)} pts`;
        if (repRedeemedVal) repRedeemedVal.textContent = `-${formatPts(data.totalPointsRedeemed)} pts`;
        
        if (repBalanceVal) {
          const balance = Number(data.totalBalance || 0);
          repBalanceVal.textContent = `${balance >= 0 ? "+" : ""}${formatPts(balance)} pts`;
          
          if (balance >= 0) {
            repBalanceVal.style.color = "#10b981";
          } else {
            repBalanceVal.style.color = "#f43f5e";
          }
        }
        
        if (repTotalClientsHistorical) repTotalClientsHistorical.textContent = data.totalClients || 0;

        // Render date range label
        if (reportPeriodLabel) {
          const startD = new Date(data.startDate);
          const endD = new Date(data.endDate);
          
          let periodText = "";
          if (currentReportPeriod === "day") {
            periodText = `Reporte Diario del ${startD.toLocaleDateString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "2-digit", year: "numeric" })}`;
          } else if (currentReportPeriod === "week") {
            periodText = `Reporte Semanal: del ${startD.toLocaleDateString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "2-digit" })} al ${endD.toLocaleDateString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "2-digit", year: "numeric" })}`;
          } else if (currentReportPeriod === "month") {
            periodText = `Reporte Mensual: ${startD.toLocaleDateString("es-VE", { timeZone: "America/Caracas", month: "long", year: "numeric" }).toUpperCase()}`;
          } else if (currentReportPeriod === "year") {
            periodText = `Reporte Anual del Año ${startD.getFullYear()}`;
          }
          reportPeriodLabel.textContent = periodText;
        }

        // Render Sede breakdown table body
        if (reportSedesTableBody) {
          reportSedesTableBody.innerHTML = "";
          
          if (!data.branches || data.branches.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="5" style="padding: 20px; text-align: center; color: rgba(255,255,255,0.4);">No hay actividad en ninguna sede en este período.</td>`;
            reportSedesTableBody.appendChild(row);
          } else {
            data.branches.forEach(b => {
              const row = document.createElement("tr");
              row.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
              
              const formattedCredited = formatPts(b.pointsCredited);
              const formattedRedeemed = formatPts(b.pointsRedeemed);
              const formattedBalance = formatPts(b.balance);
              
              const balanceSign = Number(b.balance) > 0 ? `+${formattedBalance}` : formattedBalance;
              const balanceColor = Number(b.balance) >= 0 ? "#10b981" : "#f43f5e";
              
              row.innerHTML = `
                <td style="padding: 12px 8px; text-align: left; font-weight: bold; color: #fff;">${b.branchName}</td>
                <td style="padding: 12px 8px; text-align: center; color: rgba(255,255,255,0.8);">${b.newClients}</td>
                <td style="padding: 12px 8px; text-align: right; color: #10b981; font-weight: 500;">+${formattedCredited}</td>
                <td style="padding: 12px 8px; text-align: right; color: #f43f5e; font-weight: 500;">-${formattedRedeemed}</td>
                <td style="padding: 12px 8px; text-align: right; color: ${balanceColor}; font-weight: bold;">${balanceSign} pts</td>
              `;
              
              // Allow clicking a branch in report to view its transaction history
              row.style.cursor = "pointer";
              row.addEventListener("click", () => {
                currentTxLimit = 10;
                selectedBranch = b.branchName;
                switchPanel("transacciones");
                loadAllTransactions(b.branchName);
              });
              
              reportSedesTableBody.appendChild(row);
            });
          }
        }

        if (reportActionStatus) {
          reportActionStatus.textContent = "";
          reportActionStatus.className = "aResult";
        }
      } catch (err) {
        console.error("Failed to load reports:", err);
        if (err?.status === 401) {
          doLogout();
          return;
        }
        if (reportActionStatus) {
          reportActionStatus.className = "aResult aResult--err";
          reportActionStatus.textContent = err?.message || "Error al cargar datos del reporte";
        }
      }
    };

    const toggleScheduleInputs = () => {
      if (!reportScheduleEnabled || !reportScheduleTimeGroup || !reportSchedulePeriodGroup) return;
      const isEnabled = reportScheduleEnabled.checked;
      reportScheduleTimeGroup.style.opacity = isEnabled ? "1" : "0.3";
      reportScheduleTimeGroup.style.pointerEvents = isEnabled ? "auto" : "none";
      reportSchedulePeriodGroup.style.opacity = isEnabled ? "1" : "0.3";
      reportSchedulePeriodGroup.style.pointerEvents = isEnabled ? "auto" : "none";
    };

    const loadReportsConfig = async () => {
      try {
        const data = await apiGet("/api/admin/reports-config");
        // Parse emails string → array
        configuredReportEmails = (data.emails || "")
          .split(",")
          .map(e => e.trim().toLowerCase())
          .filter(e => emailRegex.test(e));
        renderConfiguredEmails();
        if (reportScheduleEnabled) reportScheduleEnabled.checked = !!data.scheduleEnabled;
        if (reportScheduleTime) reportScheduleTime.value = data.scheduleTime || "18:00";
        if (reportSchedulePeriod) reportSchedulePeriod.value = data.schedulePeriod || "day";
        toggleScheduleInputs();
      } catch (err) {
        console.error("Failed to load reports config:", err);
      }
    };

    const saveReportsConfig = async (e) => {
      if (e) e.preventDefault();
      if (!reportConfigResult) return;

      reportConfigResult.className = "aResult aResult--info";
      reportConfigResult.textContent = "Guardando configuración...";

      try {
        const response = await apiPost("/api/admin/reports-config", {
          emails: configuredReportEmails.join(", "),
          scheduleEnabled: reportScheduleEnabled ? reportScheduleEnabled.checked : false,
          scheduleTime: reportScheduleTime ? reportScheduleTime.value : "18:00",
          schedulePeriod: reportSchedulePeriod ? reportSchedulePeriod.value : "day"
        });
        reportConfigResult.className = "aResult aResult--ok";
        reportConfigResult.textContent = "Configuración de reportes guardada con éxito.";

        // Re-sync the list from canonical server response
        configuredReportEmails = (response.emails || "")
          .split(",")
          .map(e => e.trim().toLowerCase())
          .filter(e => emailRegex.test(e));
        renderConfiguredEmails();
        if (reportScheduleEnabled) reportScheduleEnabled.checked = !!response.scheduleEnabled;
        if (reportScheduleTime) reportScheduleTime.value = response.scheduleTime || "18:00";
        if (reportSchedulePeriod) reportSchedulePeriod.value = response.schedulePeriod || "day";
        toggleScheduleInputs();

        setTimeout(() => {
          if (reportConfigResult.textContent.includes("éxito")) {
            reportConfigResult.textContent = "";
            reportConfigResult.className = "aResult";
          }
        }, 5000);
      } catch (err) {
        reportConfigResult.className = "aResult aResult--err";
        reportConfigResult.textContent = err?.message || "Error al guardar configuración";
      }
    };

    const adminReferralConfigForm = document.getElementById("adminReferralConfigForm");
    const adminReferralBonusPercent = document.getElementById("adminReferralBonusPercent");
    const adminReferralConfigResult = document.getElementById("adminReferralConfigResult");

    const loadReferralConfig = async () => {
      try {
        const data = await apiGet("/api/admin/referral-config");
        if (adminReferralBonusPercent && data.settings) {
          adminReferralBonusPercent.value = data.settings.bonusPercent ?? 5;
        }
      } catch (err) {
        console.error("Failed to load referral config:", err);
      }
    };

    const saveReferralConfig = async (e) => {
      if (e) e.preventDefault();
      if (!adminReferralConfigResult) return;

      adminReferralConfigResult.className = "aResult aResult--info";
      adminReferralConfigResult.textContent = "Guardando configuración...";

      try {
        const percentVal = adminReferralBonusPercent ? Number(adminReferralBonusPercent.value) : 5;
        await apiPost("/api/admin/referral-config", {
          bonusPercent: percentVal
        });
        adminReferralConfigResult.className = "aResult aResult--ok";
        adminReferralConfigResult.textContent = "Configuración de referidos guardada con éxito.";

        setTimeout(() => {
          if (adminReferralConfigResult.textContent.includes("éxito")) {
            adminReferralConfigResult.textContent = "";
            adminReferralConfigResult.className = "aResult";
          }
        }, 5000);
      } catch (err) {
        adminReferralConfigResult.className = "aResult aResult--err";
        adminReferralConfigResult.textContent = err?.message || "Error al guardar configuración";
      }
    };

    if (adminReportConfigForm) {
      adminReportConfigForm.addEventListener("submit", saveReportsConfig);
    }
    if (adminReferralConfigForm) {
      adminReferralConfigForm.addEventListener("submit", saveReferralConfig);
      loadReferralConfig();
    }

    const sendReportByEmail = async () => {
      if (!reportActionStatus || !reportSendEmailBtn) return;
      
      const originalText = reportSendEmailBtn.innerHTML;
      reportSendEmailBtn.disabled = true;
      reportSendEmailBtn.style.opacity = "0.7";
      reportSendEmailBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" class="spinner" style="animation: spin 1s linear infinite; display: inline-block; margin-right: 5px;">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" stroke-dasharray="32" stroke-dashoffset="10"></circle>
        </svg>
        Enviando...
      `;
      
      reportActionStatus.className = "aResult aResult--info";
      reportActionStatus.textContent = "Despachando correo del reporte actual...";
      
      try {
        const response = await apiPost("/api/admin/send-report", {
          date: currentReportDate,
          period: currentReportPeriod
        });
        
        reportActionStatus.className = "aResult aResult--ok";
        if (response.devMode) {
          reportActionStatus.textContent = `Reporte simulado enviado con éxito a: ${response.sentTo.join(", ")} (ver consola del servidor)`;
        } else {
          reportActionStatus.textContent = `Reporte enviado con éxito a: ${response.sentTo.join(", ")}`;
        }
        
        setTimeout(() => {
          if (reportActionStatus.className.includes("aResult--ok")) {
            reportActionStatus.textContent = "";
            reportActionStatus.className = "aResult";
          }
        }, 5000);
      } catch (err) {
        reportActionStatus.className = "aResult aResult--err";
        reportActionStatus.textContent = err?.message || "Error al enviar el reporte por correo";
      } finally {
        reportSendEmailBtn.disabled = false;
        reportSendEmailBtn.style.opacity = "1";
        reportSendEmailBtn.innerHTML = originalText;
      }
    };

    // Bind report control events
    if (reportRefresh) {
      reportRefresh.addEventListener("click", loadAdminReports);
    }
    
    if (reportDateInput) {
      reportDateInput.addEventListener("change", (e) => {
        currentReportDate = e.target.value;
        loadAdminReports();
      });
    }

    const reportPeriodFilterGroup = document.getElementById("reportPeriodFilterGroups");
    if (reportPeriodFilterGroup) {
      reportPeriodFilterGroup.addEventListener("click", (e) => {
        const btn = e.target.closest(".aFilterBtn");
        if (btn) {
          const period = btn.getAttribute("data-period");
          if (period) {
            currentReportPeriod = period;
            loadAdminReports();
          }
        }
      });
    }

    if (reportConfigForm) {
      reportConfigForm.addEventListener("submit", saveReportsConfig);
    }

    // Wire up add-email button and Enter key on email input
    if (reportAddEmailBtn) {
      reportAddEmailBtn.addEventListener("click", addReportEmail);
    }
    if (reportEmailInput) {
      reportEmailInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); addReportEmail(); }
      });
    }

    if (reportScheduleEnabled) {
      reportScheduleEnabled.addEventListener("change", toggleScheduleInputs);
    }

    if (reportSendEmailBtn) {
      reportSendEmailBtn.addEventListener("click", sendReportByEmail);
    }

    if (reportPrintBtn) {
      reportPrintBtn.addEventListener("click", () => {
        window.print();
      });
    }

    const doEditCashier = async (id, currentUsername, currentName) => {
      const name = window.prompt(`Nuevo nombre para el cajero ${currentUsername} (deja en blanco para no cambiar el nombre actual):`, currentName || "");
      if (name === null) return;
      const pwd = window.prompt(`Nueva contraseña para ${currentUsername} (deja en blanco para no cambiarla):`);
      if (pwd === null) return;

      if (!name.trim() && !pwd.trim()) {
        alert("No se introdujeron cambios.");
        return;
      }

      const body = { id };
      if (name.trim() !== (currentName || "")) body.name = name.trim();
      if (pwd.trim()) body.password = pwd.trim();

      try {
        const res = await fetch("/api/admin/cashiers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          alert((data?.error) || "Error al actualizar cajero");
          return;
        }
        alert("Cajero actualizado correctamente.");
        loadCashiers();
      } catch {
        alert("Error de red al actualizar cajero.");
      }
    };

    const doDeleteCashier = async (id, currentUsername) => {
      if (!window.confirm(`¿Estás seguro de que deseas ELIMINAR al cajero "${currentUsername}"? Esta acción no se puede deshacer.`)) return;
      
      const pwd = window.prompt("Introduce tu CLAVE DE ADMINISTRADOR para confirmar la eliminación:");
      if (!pwd) return;

      try {
        const res = await fetch("/api/admin/cashiers", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id, password: pwd.trim() }) // We don't verify pwd on backend for this specific route right now, but we prompt to be safe.
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          alert((data?.error) || "Error al eliminar cajero");
          return;
        }
        alert("Cajero eliminado correctamente.");
        loadCashiers();
      } catch {
        alert("Error de red al eliminar cajero.");
      }
    };

    const loadCashiers = async () => {
      if (!cajerosList) return;
      setResult(cajerosResult, "info", "Cargando cajeros\u2026");
      try {
        const data = await apiGet("/api/admin/cashiers");
        const list = Array.isArray(data == null ? void 0 : data.cashiers) ? data.cashiers : [];
        renderCashiers(cajerosList, list);
        setResult(cajerosResult, "", "");
      } catch (err) {
        if ((err == null ? void 0 : err.status) === 401) {
          doLogout();
          return;
        }
        setResult(cajerosResult, "err", (err == null ? void 0 : err.message) || "Error al cargar cajeros");
      }
    };

    const renderCashiers = (container, list) => {
      if (!container) return;
      container.innerHTML = "";
      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "aTxEmpty";
        empty.textContent = "No hay cajeros creados";
        container.appendChild(empty);
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "aTxTable";
      const head = document.createElement("div");
      head.className = "aTxRow aTxRow--cajeros aTxRow--head";
      ["Nombre", "Usuario", "Creado", "Último Acceso", "Acción"].forEach(lbl => {
        const c = document.createElement("div");
        c.className = "aTxCell" + (lbl === "Acción" ? " aTxCell--actions" : "");
        c.textContent = lbl;
        head.appendChild(c);
      });
      wrap.appendChild(head);
      for (const c of list) {
        const row = document.createElement("div");
        row.className = "aTxRow aTxRow--cajeros";
        const addCell = (label, text, cls) => {
          const div = document.createElement("div");
          div.className = "aTxCell" + (cls ? ` ${cls}` : "");
          div.setAttribute("data-label", label);
          div.textContent = text || "—";
          row.appendChild(div);
        };
        addCell("Nombre", c.name, "aTxCell--strong");
        addCell("Usuario", c.username);
        addCell("Creado", c.createdAt ? new Date(c.createdAt).toLocaleDateString("es-VE") : "—");
        addCell("Último Acceso", c.lastLogin ? new Date(c.lastLogin).toLocaleString("es-VE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "Nunca");
        
        const actionsCell = document.createElement("div");
        actionsCell.className = "aTxCell aTxCell--actions";
        actionsCell.style.gap = "6px";
        
        const editBtn = document.createElement("button");
        editBtn.className = "aTxDelBtn";
        editBtn.style.background = "rgba(96, 165, 250, 0.1)";
        editBtn.style.color = "#60a5fa";
        editBtn.style.borderColor = "rgba(96, 165, 250, 0.2)";
        editBtn.textContent = "Editar";
        editBtn.onclick = () => doEditCashier(c.id, c.username, c.name);

        const delBtn = document.createElement("button");
        delBtn.className = "aTxDelBtn";
        delBtn.textContent = "Eliminar";
        delBtn.onclick = () => doDeleteCashier(c.id, c.username);

        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(delBtn);
        row.appendChild(actionsCell);

        wrap.appendChild(row);
      }
      container.appendChild(wrap);
    };

    if (cajerosRefresh) cajerosRefresh.addEventListener("click", loadCashiers);

    const doEditMerchant = async (id, currentUsername, currentName, currentBranchName, currentSettings) => {
      const name = window.prompt(`Nuevo nombre para el comercio ${currentUsername}:`, currentName || "");
      if (name === null) return;
      const branchName = window.prompt(`Nueva sede fija para ${currentUsername}:`, currentBranchName || "");
      if (branchName === null) return;
      
      const currentS = currentSettings || { pointsPerDollar: 1, minRedeemPoints: 0 };
      const pointsPerDollar = window.prompt(`Puntos por cada 1$ gastado (ej: 1 o 1.5):`, currentS.pointsPerDollar ?? 1);
      if (pointsPerDollar === null) return;
      
      const minRedeemPoints = window.prompt(`Mínimo de puntos para canje:`, currentS.minRedeemPoints ?? 0);
      if (minRedeemPoints === null) return;

      const pwd = window.prompt(`Nueva contraseña para ${currentUsername} (deja en blanco para no cambiarla):`);
      if (pwd === null) return;

      const body = { id };
      body.name = name.trim() || currentName;
      body.branchName = branchName.trim() || currentBranchName;
      if (pwd.trim()) body.password = pwd.trim();
      body.settings = {
        pointsPerDollar: Number(pointsPerDollar) || 1,
        minRedeemPoints: Number(minRedeemPoints) || 0,
        isClosed: true // Forzado por ahora según requerimiento
      };

      try {
        const res = await fetch("/api/admin/merchants", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          alert(data?.error || "Error al actualizar comercio");
          return;
        }
        alert("Comercio actualizado correctamente.");
        loadMerchants();
      } catch {
        alert("Error de red al actualizar comercio.");
      }
    };

    const doDeleteMerchant = async (id, currentUsername) => {
      if (!window.confirm(`¿Estás seguro de que deseas ELIMINAR el comercio "${currentUsername}"? Esta acción no se puede deshacer.`)) return;

      try {
        const res = await fetch("/api/admin/merchants", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          alert(data?.error || "Error al eliminar comercio");
          return;
        }
        alert("Comercio eliminado correctamente.");
        loadMerchants();
      } catch {
        alert("Error de red al eliminar comercio.");
      }
    };

    const loadMerchants = async () => {
      if (!merchantsList) return;
      setResult(merchantsResult, "info", "Cargando comercios...");
      try {
        const data = await apiGet("/api/admin/merchants");
        const list = Array.isArray(data?.merchants) ? data.merchants : [];
        renderMerchants(merchantsList, list);
        setResult(merchantsResult, "", "");
      } catch (err) {
        if (err?.status === 401) {
          doLogout();
          return;
        }
        setResult(merchantsResult, "err", err?.message || "Error al cargar comercios");
      }
    };

    const renderMerchants = (container, list) => {
      if (!container) return;
      container.innerHTML = "";
      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "aTxEmpty";
        empty.textContent = "No hay comercios creados";
        container.appendChild(empty);
        return;
      }

      const wrap = document.createElement("div");
      wrap.className = "aTxTable";

      const head = document.createElement("div");
      head.className = "aTxRow aTxRow--comercios aTxRow--head";
      ["Comercio", "Usuario", "Sede", "Creado", "Último Acceso", "Acción"].forEach((lbl) => {
        const c = document.createElement("div");
        c.className = "aTxCell" + (lbl === "Acción" ? " aTxCell--actions" : "");
        c.textContent = lbl;
        head.appendChild(c);
      });
      wrap.appendChild(head);

      for (const m of list) {
        const row = document.createElement("div");
        row.className = "aTxRow aTxRow--comercios";
        row.style.cursor = "pointer";

        const addCell = (label, text, cls) => {
          const div = document.createElement("div");
          div.className = "aTxCell" + (cls ? ` ${cls}` : "");
          div.setAttribute("data-label", label);
          div.textContent = text || "—";
          row.appendChild(div);
        };

        addCell("Comercio", m.name, "aTxCell--strong");
        addCell("Usuario", m.username);
        addCell("Sede", m.branchName);
        addCell("Creado", m.createdAt ? new Date(m.createdAt).toLocaleDateString("es-VE") : "—");
        addCell(
          "Último Acceso",
          m.lastLogin ? new Date(m.lastLogin).toLocaleString("es-VE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "Nunca"
        );

        const actionsCell = document.createElement("div");
        actionsCell.className = "aTxCell aTxCell--actions";
        actionsCell.style.gap = "6px";

        const editBtn = document.createElement("button");
        editBtn.className = "aTxDelBtn aTxDelBtn--secondary";
        editBtn.textContent = "Editar";
        editBtn.onclick = () => doEditMerchant(m.id, m.username, m.name, m.branchName, m.settings);

        const delBtn = document.createElement("button");
        delBtn.className = "aTxDelBtn";
        delBtn.textContent = "Eliminar";
        delBtn.onclick = () => doDeleteMerchant(m.id, m.username);

        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(delBtn);
        row.appendChild(actionsCell);

        row.addEventListener("click", (e) => {
          if (e.target.closest("button")) return;
          currentTxLimit = 10;
          selectedBranch = m.branchName;
          switchPanel("transacciones");
          loadAllTransactions(m.branchName);
        });

        wrap.appendChild(row);
      }

      container.appendChild(wrap);
    };

    if (merchantsRefresh) merchantsRefresh.addEventListener("click", loadMerchants);
    let currentStatsRange = "day";
    const loadAdminStats = async (range = currentStatsRange) => {
      const loader = document.getElementById("adminStatsLoader");
      if (loader) loader.hidden = false;
      try {
        const data = await apiGet(`/api/admin/stats?range=${encodeURIComponent(range)}`);
        const elUsers = document.getElementById("stUsers");
        const elEarned = document.getElementById("stPtsEarned");
        const elRedeemed = document.getElementById("stPtsRedeemed");
        const elUsersSub = document.getElementById("stUsersSub");
        if (elUsers) {
          elUsers.textContent = String(data.newUsers || 0);
          if (elUsersSub) elUsersSub.textContent = `Registrados en el periodo (Hist\xF3rico: ${data.totalUsers || 0})`;
        }
        if (elEarned) elEarned.textContent = formatPts(data.pointsEarned || 0);
        if (elRedeemed) elRedeemed.textContent = formatPts(data.pointsRedeemed || 0);
        
        const renderBreakdown = (containerId, obj) => {
          const container = document.getElementById(containerId);
          if (!container) return;
          if (!obj || Object.keys(obj).length === 0) {
            container.innerHTML = "<div style='color: rgba(255,255,255,0.4); text-align: center; font-style: italic;'>Sin datos por sede</div>";
            return;
          }
          let html = "";
          for (const [branch, pts] of Object.entries(obj)) {
            html += `<div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: rgba(255,255,255,0.7);">${branch}</span>
              <span style="font-weight: 600; color: #fff;">${formatPts(pts)} pts</span>
            </div>`;
          }
          container.innerHTML = html;
        };

        renderBreakdown("stPtsEarnedBreakdown", data.earnedByBranch);
        renderBreakdown("stPtsRedeemedBreakdown", data.redeemedByBranch);
      } catch (err) {
        if ((err == null ? void 0 : err.status) === 401) {
          doLogout();
          return;
        }
      } finally {
        if (loader) loader.hidden = true;
      }
    };
    const statCardEarned = document.getElementById("statCardEarned");
    if (statCardEarned) {
      statCardEarned.addEventListener("click", () => {
        const bd = document.getElementById("stPtsEarnedBreakdown");
        if (bd) bd.style.display = bd.style.display === "none" ? "block" : "none";
      });
    }
    const statCardRedeemed = document.getElementById("statCardRedeemed");
    if (statCardRedeemed) {
      statCardRedeemed.addEventListener("click", () => {
        const bd = document.getElementById("stPtsRedeemedBreakdown");
        if (bd) bd.style.display = bd.style.display === "none" ? "block" : "none";
      });
    }

    const filterBtns = document.querySelectorAll(".aFilterBtn");
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const r = e.target.getAttribute("data-range") || "all";
        currentStatsRange = r;
        filterBtns.forEach((b) => b.classList.remove("is-active"));
        e.target.classList.add("is-active");
        loadAdminStats(r);
      });
    });
    const initAuthed = (role) => {
      showDash();
      
      if (role === "marketing") {
        // Ocultar paneles no permitidos para marketing
        if (navClientes) navClientes.hidden = true;
        if (navTx) navTx.hidden = true;
        if (navStats) navStats.hidden = true;
        if (navCajeros) navCajeros.hidden = true;
        if (navComercios) navComercios.hidden = true;
        if (navSedes) navSedes.hidden = true;
        if (navReportes) navReportes.hidden = true;
        if (navReferidos) navReferidos.hidden = true;
        
        const mobNavClientes = document.getElementById("aMobNavClientes");
        const mobNavTx = document.getElementById("aMobNavTx");
        const mobNavStats = document.getElementById("aMobNavStats");
        const mobNavCajeros = document.getElementById("aMobNavCajeros");
        const mobNavComercios = document.getElementById("aMobNavComercios");
        const mobNavSedes = document.getElementById("aMobNavSedes");
        const mobNavReportes = document.getElementById("aMobNavReportes");
        const mobNavReferidos = document.getElementById("aMobNavReferidos");
        
        if (mobNavClientes) mobNavClientes.hidden = true;
        if (mobNavTx) mobNavTx.hidden = true;
        if (mobNavStats) mobNavStats.hidden = true;
        if (mobNavCajeros) mobNavCajeros.hidden = true;
        if (mobNavComercios) mobNavComercios.hidden = true;
        if (mobNavSedes) mobNavSedes.hidden = true;
        if (mobNavReportes) mobNavReportes.hidden = true;
        if (mobNavReferidos) mobNavReferidos.hidden = true;
        
        // Hide config functions like reset txs
        if (adminResetTxsBtn) adminResetTxsBtn.hidden = true;
        
        switchPanel("promociones");
        loadPromotionsAdmin();
      } else {
        switchPanel("clientes");
        loadClients();
        if (adminResetTxsBtn) adminResetTxsBtn.hidden = false;
      }
      
      // Ocultar botón de perfil en admin mode si así se requiere
      if (profileButton) profileButton.hidden = true;
    };

    const checkAuth = async () => {
      try {
        const data = await apiGet("/api/admin/me");
        if (Boolean(data?.authenticated)) {
          const role = String(data?.role || "admin").toLowerCase();
          if (role === "cashier") {
            window.location.replace("/admin/qr");
            return;
          }
          if (role === "merchant") {
            window.location.replace("/comercio/qr");
            return;
          }
          initAuthed(role);
        } else {
          // No session → redirect to shared login page
          window.location.replace("/login");
        }
      } catch (err) {
        window.location.replace("/login");
      } finally {
        document.body.classList.add("is-ready");
      }
    };
    checkAuth();
    return;
  }
  syncBalance();
  loadCardData();
  const toggle = () => {
    syncBalance();
    const expanded = card.getAttribute("aria-expanded") === "true";
    setExpanded(!expanded);
  };
  card.addEventListener("contextmenu", (e) => e.preventDefault());
  card.addEventListener("dragstart", (e) => e.preventDefault());
  if ("PointerEvent" in window) {
    const MOVE_PX = 10;
    let pointerDown = false;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let activePointerId = null;
    card.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerDown = true;
      moved = false;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
    });
    card.addEventListener("pointermove", (e) => {
      if (!pointerDown || e.pointerId !== activePointerId) return;
      if (Math.abs(e.clientX - startX) > MOVE_PX || Math.abs(e.clientY - startY) > MOVE_PX) {
        moved = true;
      }
    });
    card.addEventListener("pointerup", (e) => {
      if (!pointerDown || e.pointerId !== activePointerId) return;
      pointerDown = false;
      activePointerId = null;
      if (!moved) toggle();
    });
    card.addEventListener("pointercancel", () => {
      pointerDown = false;
      activePointerId = null;
    });
  } else {
    card.addEventListener("click", toggle);
  }
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
})();
(() => {
  const profileButton = document.getElementById("profileButton");
  const menu = document.getElementById("profileMenu");
  const closeBtn = document.getElementById("profileClose");
  if (!profileButton || !menu) return;
  const setOpen = (open2) => {
    menu.classList.toggle("profileMenu--active", open2);
    menu.setAttribute("aria-hidden", open2 ? "false" : "true");
    profileButton.setAttribute("aria-expanded", open2 ? "true" : "false");
    if (open2) {
      window.setTimeout(() => (closeBtn != null ? closeBtn : profileButton).focus(), 0);
    }
  };
  const close = () => setOpen(false);
  const open = () => setOpen(true);
  profileButton.addEventListener("click", () => {
    const openNow = profileButton.getAttribute("aria-expanded") === "true";
    setOpen(!openNow);
  });
  if (closeBtn) closeBtn.addEventListener("click", close);
  menu.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target instanceof HTMLElement && target.hasAttribute("data-profile-close")) {
      close();
    }
  });
  window.addEventListener("keydown", (e) => {
    if (menu.getAttribute("aria-hidden") === "true") return;
    if (e.key === "Escape") close();
  });
})();
(() => {
  const scanner = document.getElementById("qrScanner");
  const video = document.getElementById("qrVideo");
  const canvas = document.getElementById("qrCanvas");
  const closeBtn = document.getElementById("qrClose");
  const hint = document.getElementById("qrHint");
  const resultEl = document.getElementById("qrResult");
  if (!scanner || !video || !canvas || !qrButton) return;
  let stream = null;
  let scanning = false;
  const ctx = canvas.getContext("2d");
  const scanPopup = (() => {
    try {
      const root = document.createElement("div");
      root.className = "scanPopup";
      root.setAttribute("aria-hidden", "true");
      const backdrop = document.createElement("div");
      backdrop.className = "scanPopup__backdrop";
      const frame = document.createElement("div");
      frame.className = "scanPopup__frame";
      frame.setAttribute("role", "dialog");
      frame.setAttribute("aria-modal", "true");
      frame.setAttribute("aria-label", "Resultado del cobro");
      const icon = document.createElement("div");
      icon.className = "scanPopup__icon";
      icon.setAttribute("aria-hidden", "true");
      const title = document.createElement("div");
      title.className = "scanPopup__title";
      const subtitle = document.createElement("div");
      subtitle.className = "scanPopup__subtitle";
      frame.appendChild(icon);
      frame.appendChild(title);
      frame.appendChild(subtitle);
      root.appendChild(backdrop);
      root.appendChild(frame);
      document.body.appendChild(root);
      const icons = {
        ok: `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        err: `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" aria-hidden="true"><path d="M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M6 6l12 12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`
      };
      let timer = null;
      const close = () => {
        root.classList.remove("scanPopup--show");
        root.setAttribute("aria-hidden", "true");
        if (timer) window.clearTimeout(timer);
        timer = null;
      };
      const show = ({ kind, headline, detail }) => {
        const k = kind === "ok" ? "ok" : "err";
        icon.innerHTML = icons[k];
        icon.classList.toggle("scanPopup__icon--ok", k === "ok");
        icon.classList.toggle("scanPopup__icon--err", k === "err");
        title.textContent = String(headline != null ? headline : "");
        subtitle.textContent = String(detail != null ? detail : "");
        root.classList.add("scanPopup--show");
        root.setAttribute("aria-hidden", "false");
        if (timer) window.clearTimeout(timer);
        const duration = (detail && detail.length > 30) ? 6000 : 2600;
        timer = window.setTimeout(() => {
          close();
        }, duration);
      };
      root.addEventListener("click", close);
      return { show, close };
    } catch {
      return { show: () => {
      }, close: () => {
      } };
    }
  })();
  const confirmPopup = (() => {
    const root = document.createElement("div");
    root.className = "scanPopup";
    root.setAttribute("aria-hidden", "true");
    const backdrop = document.createElement("div");
    backdrop.className = "scanPopup__backdrop";
    const frame = document.createElement("div");
    frame.className = "scanPopup__frame";
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-modal", "true");
    frame.setAttribute("aria-label", "Confirmar cobro");
    const icon = document.createElement("div");
    icon.className = "scanPopup__icon";
    icon.innerHTML = `<svg viewBox="0 0 24 24" width="44" height="44" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.6"/><path d="M12 8v4l3 3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;
    const title = document.createElement("div");
    title.className = "scanPopup__title";
    const subtitle = document.createElement("div");
    subtitle.className = "scanPopup__subtitle";
    const actions = document.createElement("div");
    actions.className = "scanPopup__actions";
    actions.style.display = "flex";
    actions.style.gap = "12px";
    actions.style.marginTop = "24px";
    actions.style.width = "100%";
    const applyBtnStyles = (btn) => {
      btn.style.flex = "1";
      btn.style.padding = "14px";
      btn.style.borderRadius = "14px";
      btn.style.border = "1px solid rgba(255,255,255,0.1)";
      btn.style.background = "rgba(255,255,255,0.05)";
      btn.style.color = "#fff";
      btn.style.fontWeight = "600";
      btn.style.fontSize = "15px";
      btn.style.cursor = "pointer";
    };
    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.textContent = "Cancelar";
    applyBtnStyles(btnCancel);
    const btnAccept = document.createElement("button");
    btnAccept.type = "button";
    btnAccept.textContent = "Aceptar";
    applyBtnStyles(btnAccept);
    btnAccept.style.background = "#a5b4fc";
    btnAccept.style.color = "#1e1b4b";
    btnAccept.style.borderColor = "#a5b4fc";
    actions.appendChild(btnCancel);
    actions.appendChild(btnAccept);
    frame.appendChild(icon);
    frame.appendChild(title);
    frame.appendChild(subtitle);
    frame.appendChild(actions);
    root.appendChild(backdrop);
    root.appendChild(frame);
    document.body.appendChild(root);
    let currentResolve = null;
    const close = (result = false) => {
      root.classList.remove("scanPopup--show");
      root.setAttribute("aria-hidden", "true");
      if (currentResolve) {
        currentResolve(result);
        currentResolve = null;
      }
    };
    const request = ({ points, desc }) => {
      return new Promise((resolve) => {
        console.log("[QR Scanner] Mostrando modal de confirmacion con:", points, "pts. Descripci\xF3n:", desc);
        currentResolve = resolve;
        title.textContent = `Pagar ${points} pts`;
        subtitle.textContent = desc ? `Referencia: ${desc}` : "\xBFConfirmas el pago de puntos?";
        root.classList.add("scanPopup--show");
        root.setAttribute("aria-hidden", "false");
      });
    };
    btnCancel.addEventListener("click", () => close(false));
    btnAccept.addEventListener("click", () => close(true));
    backdrop.addEventListener("click", () => close(false));
    return { request };
  })();
  const getTokenFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      const qp = (url.searchParams.get("token") || url.searchParams.get("t") || "").trim();
      if (qp) return qp;
      const path = url.pathname || "";
      if (path.startsWith("/card/")) {
        return decodeURIComponent(path.slice("/card/".length)).trim();
      }
    } catch {
    }
    return "";
  };
  const syncDisplayedBalance = (balance) => {
    const pointsEl = document.getElementById("points");
    const balanceEl = document.getElementById("clientBalance");
    const n = Number(balance);
    if (!Number.isFinite(n)) return;
    if (pointsEl) pointsEl.textContent = formatPts(n);
    const pointsCashEl = document.getElementById("pointsCash");
    if (pointsCashEl) pointsCashEl.textContent = `\u2248 ${formatPts(n / 100)} $`;
    if (balanceEl) {
      balanceEl.textContent = formatPts(n);
      const detailCashEl = document.getElementById("clientBalanceCash");
      if (detailCashEl) detailCashEl.textContent = `\u2248 ${formatPts(n / 100)} $`;
    }
  };
  const tryParseScannedUrl = (raw) => {
    const text = String(raw != null ? raw : "").trim();
    if (!text) return null;
    try {
      if (text.startsWith("http://") || text.startsWith("https://")) {
        return new URL(text);
      }
      if (/^[a-z0-9-]+\.[a-z]{2,}(\/|\?|$)/i.test(text)) {
        return new URL(`https://${text}`);
      }
      if (text.startsWith("/")) {
        return new URL(text, window.location.origin);
      }
      if (text.startsWith("?") && text.includes("points=") && text.includes("sig=")) {
        return new URL(`/api/pos/redeem${text}`, window.location.origin);
      }
      return new URL(`/${text}`, window.location.origin);
    } catch {
      return null;
    }
  };
  const extractRedeemParams = (raw) => {
    const url = tryParseScannedUrl(raw);
    const text = String(raw != null ? raw : "").trim();
    const fromUrl = (u) => {
      if (!u) return null;
      const pathname = u.pathname || "";
      if (!pathname.endsWith("/api/pos/redeem")) return null;
      const points = u.searchParams.get("points") || "";
      const ts = u.searchParams.get("ts") || "";
      const nonce = u.searchParams.get("nonce") || "";
      const desc = u.searchParams.get("desc") || "";
      const sig = u.searchParams.get("sig") || "";
      if (!points || !ts || !nonce || !sig) return null;
      return { points, ts, nonce, desc, sig, parsedFrom: "url" };
    };
    const direct = fromUrl(url);
    if (direct) return direct;
    if (text.includes("/api/pos/redeem")) {
      try {
        const idx = text.indexOf("/api/pos/redeem");
        const tail = text.slice(idx);
        const u = new URL(tail.startsWith("/") ? tail : `/${tail}`, window.location.origin);
        const p = fromUrl(u);
        if (p) return { ...p, parsedFrom: "tail" };
      } catch {
      }
    }
    return null;
  };
  const redeemIfChargeUrl = async (raw) => {
    const params = extractRedeemParams(raw);
    if (!params) return false;
    const confirmed = await confirmPopup.request({
      points: params.points,
      desc: params.desc
    });
    if (!confirmed) {
      return true;
    }
    const redeemUrl = new URL("/api/pos/redeem", window.location.origin);
    redeemUrl.searchParams.set("points", params.points);
    redeemUrl.searchParams.set("ts", params.ts);
    redeemUrl.searchParams.set("nonce", params.nonce);
    if (params.desc) redeemUrl.searchParams.set("desc", params.desc);
    redeemUrl.searchParams.set("sig", params.sig);
    const token = getTokenFromUrl();
    if (!token) {
      scanPopup.show({ kind: "err", headline: "Rechazada", detail: "Token requerido" });
      return true;
    }
    redeemUrl.searchParams.set("token", token);
    try {
      const res = await fetch(redeemUrl.toString(), { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !(data == null ? void 0 : data.ok)) {
        const msg = (data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`;
        const normalized = String(msg).toLowerCase();
        if (normalized.includes("cerrado") || normalized.includes("cerrados")) {
          scanPopup.show({ kind: "err", headline: "Rechazada", detail: msg });
        } else if (normalized.includes("insufficient balance") || normalized.includes("saldo")) {
          scanPopup.show({ kind: "err", headline: "Rechazada", detail: "Saldo insuficiente" });
        } else if (normalized.includes("expired")) {
          scanPopup.show({ kind: "err", headline: "Rechazada", detail: "QR vencido" });
        } else if (normalized.includes("not pending") || normalized.includes("used")) {
          scanPopup.show({ kind: "err", headline: "Rechazada", detail: "QR ya usado" });
        } else {
          scanPopup.show({ kind: "err", headline: "Rechazada", detail: "Error al cobrar" });
        }
        return true;
      }
      if (typeof data.balance !== "undefined") {
        syncDisplayedBalance(data.balance);
      }
      scanPopup.show({
        kind: "ok",
        headline: "Exitosa",
        detail: `Nuevo saldo: ${typeof data.balance !== "undefined" ? formatPts(data.balance) : "\u2014"}`
      });
      try {
        window.dispatchEvent(new Event("wallet:activity-refresh"));
      } catch {
      }
      return true;
    } catch {
      scanPopup.show({ kind: "err", headline: "Rechazada", detail: "Error de red" });
      return true;
    }
  };
  const stopStream = () => {
    scanning = false;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  };
  const closeScanner = () => {
    stopStream();
    scanner.classList.remove("scanner--active");
    scanner.setAttribute("aria-hidden", "true");
  };
  const startScanLoop = async () => {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width && height) {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);
        try {
          const imageData = ctx.getImageData(0, 0, width, height);
          if (window.jsQR) {
            const qr = window.jsQR(imageData.data, width, height);
            if (qr && qr.data) {
              scanning = false;
              stopStream();
              closeScanner();
              const handled = await redeemIfChargeUrl(qr.data);
              if (!handled) {
                scanPopup.show({ kind: "err", headline: "Rechazada", detail: "QR no v\xE1lido" });
              }
              return;
            }
          }
        } catch {
        }
      }
    }
    if (scanning) {
      window.requestAnimationFrame(() => {
        startScanLoop();
      });
    }
  };
  const openScanner = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      window.alert("Tu navegador no permite usar la c\xE1mara para escanear.");
      return;
    }
    hint.textContent = "Apunta al c\xF3digo QR para escanear";
    resultEl.textContent = "";
    scanner.classList.add("scanner--active");
    scanner.setAttribute("aria-hidden", "false");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }
        }
      });
      video.srcObject = stream;
      await video.play();
      scanning = true;
      window.requestAnimationFrame(startScanLoop);
    } catch (err) {
      closeScanner();
      if (err && err.name === "NotAllowedError") {
        window.alert("No se ha concedido permiso para usar la c\xE1mara.");
      } else {
        window.alert("No se ha podido iniciar la c\xE1mara.");
      }
    }
  };
  qrButton.addEventListener("click", () => {
    openScanner();
  });
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      closeScanner();
    });
  }
})();
(() => {
  const refreshBtn = document.getElementById("activityRefresh");
  const mainList = document.querySelector(".activity__list:not(#historyList)");
  const historyList = document.getElementById("historyList");
  const moreBtn = document.getElementById("activityMoreBtn");
  const historyModal = document.getElementById("historyModal");
  const historyCloseBtn = document.getElementById("historyCloseBtn");
  const historyLoadMoreBtn = document.getElementById("historyLoadMoreBtn");
  const historyLoading = document.getElementById("historyLoading");
  if (!refreshBtn || !mainList) return;
  const getTokenFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      const qp = (url.searchParams.get("token") || url.searchParams.get("t") || "").trim();
      if (qp) return qp;
      const path = url.pathname || "";
      if (path.startsWith("/card/")) {
        return decodeURIComponent(path.slice("/card/".length)).trim();
      }
    } catch {
    }
    return "";
  };
  const iconSvg = {
    credit: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    debit: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
  };
  const formatTime = (iso) => {
    if (!iso) return "\u2014";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "\u2014";
    return d.toLocaleString("es-VE", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };
  const clearList = (targetList) => {
    if (targetList) targetList.innerHTML = "";
  };
  const renderEmpty = (targetList, text) => {
    if (!targetList) return;
    clearList(targetList);
    const li = document.createElement("li");
    li.className = "activity__item";
    li.innerHTML = `<div class="activity__icon"></div><div class="activity__text"><div class="activity__name">${text}</div><div class="activity__time"></div></div><div class="activity__amount"></div>`;
    targetList.appendChild(li);
  };
  const computeDelta = (t) => {
    const before = Number.isFinite(Number(t.balanceBefore)) ? Number(t.balanceBefore) : null;
    const after = Number.isFinite(Number(t.balanceAfter)) ? Number(t.balanceAfter) : null;
    if (before !== null && after !== null) return after - before;
    const pts = Number.isFinite(Number(t.points)) ? Number(t.points) : 0;
    if (String(t.type || "") === "pos_charge") return -Math.abs(pts);
    if (String(t.type || "").includes("credit")) return Math.abs(pts);
    return pts;
  };
  const getTitle = (t, delta) => {
    const desc = String(t.description || "").trim();
    if (desc) return desc;
    const type = String(t.type || "").trim();
    if (type === "pos_charge") return "Pago";
    if (type.includes("credit")) return "Cr\xE9dito";
    if (delta < 0) return "Pago";
    if (delta > 0) return "Cr\xE9dito";
    return "Movimiento";
  };
  const createTxElement = (t) => {
    const delta = computeDelta(t);
    const isNeg = delta < 0;
    const li = document.createElement("li");
    li.className = "activity__item";
    const icon = document.createElement("div");
    icon.className = "activity__icon";
    icon.innerHTML = isNeg ? iconSvg.debit : iconSvg.credit;
    const text = document.createElement("div");
    text.className = "activity__text";
    const name = document.createElement("div");
    name.className = "activity__name";
    name.textContent = getTitle(t, delta);
    const time = document.createElement("div");
    time.className = "activity__time";
    time.textContent = formatTime(t.processedAt || t.createdAt);
    text.appendChild(name);
    text.appendChild(time);
    const amount = document.createElement("div");
    amount.className = `activity__amount${isNeg ? " activity__amount--neg" : ""}`;
    const abs = Math.abs(Number(delta) || 0);
    amount.textContent = `${isNeg ? "-" : "+"}${formatPts(abs)}`;
    li.appendChild(icon);
    li.appendChild(text);
    li.appendChild(amount);
    return li;
  };
  const render = (targetList, transactions, append = false) => {
    if (!targetList) return;
    if (!append) clearList(targetList);
    const txs = Array.isArray(transactions) ? transactions : [];
    if (!txs.length && !append) {
      renderEmpty(targetList, "Sin actividad");
      return;
    }
    for (const t of txs) {
      targetList.appendChild(createTxElement(t));
    }
  };
  let loading = false;
  let lastVisibleTx = null;
  const PAGE_SIZE = 50;

  // Global wallet filter function bound to this scope
  window.walletState.filterActivity = () => {
    const activeId = window.walletState.activeMerchantId;
    let filtered = [];
    if (!activeId) {
      // General card: show only non-merchant transactions
      filtered = window.walletState.allTransactions.filter(t => !t.merchantId);
    } else {
      // Merchant card: show only matching merchant transactions
      filtered = window.walletState.allTransactions.filter(t => t.merchantId === activeId);
    }
    render(mainList, filtered);
    if (historyList) render(historyList, filtered);
  };

  const cargarMasTransacciones = async () => {
    if (loading || !lastVisibleTx) return;
    const token = getTokenFromUrl();
    if (!token) return;
    loading = true;
    if (historyLoadMoreBtn) historyLoadMoreBtn.hidden = true;
    if (historyLoading) historyLoading.hidden = false;
    try {
      const url = `/api/card?mode=activity&token=${encodeURIComponent(token)}&limit=${PAGE_SIZE}&afterDate=${encodeURIComponent(lastVisibleTx.date)}&afterId=${encodeURIComponent(lastVisibleTx.id)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !(data == null ? void 0 : data.ok)) throw new Error((data == null ? void 0 : data.error) || "Error");
      const txs = Array.isArray(data == null ? void 0 : data.transactions) ? data.transactions : [];
      if (txs.length > 0) {
        window.walletState.allTransactions = window.walletState.allTransactions.concat(txs);
        window.walletState.filterActivity();
        const last = txs[txs.length - 1];
        lastVisibleTx = { id: last.id, date: last.processedAt || last.createdAt };
      }
      if (historyLoadMoreBtn) {
        historyLoadMoreBtn.hidden = txs.length < PAGE_SIZE;
      }
    } catch (err) {
      console.error("Error cargando más transacciones:", err);
    } finally {
      loading = false;
      if (historyLoading) historyLoading.hidden = true;
    }
  };
  const loadActivity = async () => {
    if (loading) return;
    const token = getTokenFromUrl();
    if (!token) return;
    loading = true;
    lastVisibleTx = null;
    refreshBtn.disabled = true;
    renderEmpty(mainList, "Cargando...");
    if (historyList) renderEmpty(historyList, "Cargando...");
    if (historyLoadMoreBtn) historyLoadMoreBtn.hidden = true;
    try {
      const res = await fetch(`/api/card?mode=activity&token=${encodeURIComponent(token)}&limit=${PAGE_SIZE}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !(data == null ? void 0 : data.ok)) {
        const msg = (data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`;
        renderEmpty(mainList, msg);
        if (historyList) renderEmpty(historyList, msg);
        return;
      }
      const txs = Array.isArray(data == null ? void 0 : data.transactions) ? data.transactions : [];
      window.walletState.allTransactions = txs;
      window.walletState.filterActivity();
      if (txs.length > 0) {
        const last = txs[txs.length - 1];
        lastVisibleTx = { id: last.id, date: last.processedAt || last.createdAt };
      }
      if (moreBtn) moreBtn.hidden = txs.length < PAGE_SIZE;
      if (historyLoadMoreBtn) historyLoadMoreBtn.hidden = txs.length < PAGE_SIZE;
    } catch {
      renderEmpty(mainList, "Error de red");
      if (historyList) renderEmpty(historyList, "Error de red");
    } finally {
      loading = false;
      refreshBtn.disabled = false;
    }
  };
  if (moreBtn && historyModal && historyCloseBtn) {
    moreBtn.addEventListener("click", () => {
      historyModal.classList.add("historyModal--active");
      historyModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    });
    historyCloseBtn.addEventListener("click", () => {
      historyModal.classList.remove("historyModal--active");
      historyModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    });
  }
  if (historyLoadMoreBtn) {
    historyLoadMoreBtn.addEventListener("click", cargarMasTransacciones);
  }
  refreshBtn.addEventListener("click", () => {
    loadActivity();
    if (typeof window.loadCardData === "function") {
      window.loadCardData();
    }
  });
  window.addEventListener("wallet:activity-refresh", () => {
    loadActivity();
  });
  loadActivity();
})();
const themeColorMeta = document.getElementById("themeColor");
if (themeColorMeta && window.matchMedia) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const applyThemeColor = () => {
    themeColorMeta.setAttribute("content", mq.matches ? "#000000" : "#f6f7fb");
  };
  applyThemeColor();
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", applyThemeColor);
  } else {
    mq.addListener(applyThemeColor);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  const refBtn = document.getElementById("profileReferralsBtn");
  if (refBtn) {
    refBtn.addEventListener("click", async () => {
      let token = "";
      try {
        const url = new URL(window.location.href);
        token = (url.searchParams.get("token") || url.searchParams.get("t") || "").trim();
        if (!token) {
          const path = url.pathname || "";
          if (path.startsWith("/card/")) {
            token = decodeURIComponent(path.slice("/card/".length)).trim();
          }
        }
      } catch(e) {}
      
      if (!token) {
        alert("No se encontró el token de tu tarjeta.");
        return;
      }
      
      const refCode = token.substring(0, 6).toUpperCase();
      const shareUrl = `https://form.vmaspuntos.com?ref=${refCode}`;
      const textToCopy = `Regístrate en V+ Puntos con mi código ${refCode} y obtén beneficios. ${shareUrl}`;
      
      const copyToClipboardFallback = async () => {
        try {
          await navigator.clipboard.writeText(textToCopy);
          alert(`¡Código y enlace copiados al portapapeles!\n\nCompártelo con tus amigos para ganar puntos.`);
        } catch (e) {
          console.error("Error al copiar al portapapeles", e);
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand("copy");
            alert(`¡Código y enlace copiados al portapapeles!\n\nCompártelo con tus amigos para ganar puntos.`);
          } catch (err) {
            alert(`Tu código es: ${refCode}\nEnlace: ${shareUrl}\nCópialo manualmente.`);
          }
          document.body.removeChild(textArea);
        }
      };
      
      try {
        if (navigator.share) {
          await navigator.share({
            title: "¡Únete a V+ Puntos!",
            text: `Regístrate en V+ Puntos con mi código ${refCode} y obtén beneficios.`,
            url: shareUrl
          });
        } else {
          await copyToClipboardFallback();
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("Error al compartir", e);
          await copyToClipboardFallback();
        }
      }
      
      refBtn.innerHTML = `Código: ${refCode}`;
    });
  }
  
  // ==========================================
  // MARKETING & PROMOCIONES LOGIC
  // ==========================================
  
  // Marketing Users Management
  window.loadMarketingUsers = async () => {
    const tbody = document.getElementById("marketingUsersTableBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px; color: rgba(255,255,255,0.5);">Cargando...</td></tr>`;
    try {
      const res = await fetch("/api/admin/marketing-users", { credentials: "include" });
      const users = await res.json();
      if (!res.ok) throw new Error(users.error || "Error al cargar");
      
      if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px; color: rgba(255,255,255,0.5);">No hay usuarios de marketing</td></tr>`;
        return;
      }
      
      tbody.innerHTML = "";
      users.forEach(u => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
        
        tr.innerHTML = `
          <td style="padding: 12px; color: #fff; font-size: 14px;">${u.name || "—"}</td>
          <td style="padding: 12px; color: #fff; font-size: 14px;">${u.username}</td>
          <td style="padding: 12px; text-align: right;">
            <button class="aBtn" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 6px 12px; font-size: 12px; border-radius: 6px; border: none; cursor: pointer;">Eliminar</button>
          </td>
        `;
        
        const delBtn = tr.querySelector("button");
        delBtn.onclick = async () => {
          if (!confirm(`¿Eliminar usuario ${u.username}?`)) return;
          try {
            await fetch(`/api/admin/marketing-users?id=${u.id}`, { method: "DELETE", credentials: "include" });
            loadMarketingUsers();
          } catch (e) {
            alert("Error al eliminar");
          }
        };
        tbody.appendChild(tr);
      });
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px; color: #ef4444;">Error al cargar: ${e.message}</td></tr>`;
    }
  };

  const mktForm = document.getElementById("adminMarketingUserForm");
  if (mktForm) {
    mktForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("mktUserName").value;
      const username = document.getElementById("mktUserUsername").value;
      const password = document.getElementById("mktUserPassword").value;
      const resEl = document.getElementById("mktUserFormResult");
      
      resEl.textContent = "Creando...";
      resEl.style.color = "#06b6d4";
      
      try {
        const res = await fetch("/api/admin/marketing-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, username, password }),
          credentials: "include"
        });
        const data = await res.json();
        if (res.ok) {
          resEl.textContent = "Usuario creado exitosamente.";
          resEl.style.color = "#10b981";
          mktForm.reset();
          loadMarketingUsers();
        } else {
          throw new Error(data.error);
        }
      } catch (err) {
        resEl.textContent = err.message || "Error al crear usuario";
        resEl.style.color = "#ef4444";
      }
    });
  }

  // Promotions Management (Admin/Marketing)
  window.loadPromotionsAdmin = async () => {
    const list = document.getElementById("promotionsListAdmin");
    if (!list) return;
    list.innerHTML = `<div style="color: rgba(255,255,255,0.5);">Cargando...</div>`;
    
    try {
      const res = await fetch("/api/admin/promotions", { credentials: "include" });
      const promos = await res.json();
      
      if (!res.ok) throw new Error(promos.error || "Error al cargar");
      
      if (promos.length === 0) {
        list.innerHTML = `<div style="color: rgba(255,255,255,0.5);">No hay promociones activas.</div>`;
        return;
      }
      
      list.innerHTML = "";
      promos.forEach(p => {
        const card = document.createElement("div");
        card.style.cssText = "background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;";
        
        card.innerHTML = `
          <div style="height: 150px; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <img src="${p.imageBase64}" alt="${p.title}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <div style="padding: 15px; flex: 1; display: flex; flex-direction: column;">
            <h4 style="margin: 0 0 5px 0; color: #fff; font-size: 16px;">${p.title}</h4>
            <p style="margin: 0 0 15px 0; color: rgba(255,255,255,0.6); font-size: 13px; flex: 1;">${p.description || ""}</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #06b6d4; font-weight: bold; font-size: 15px;">${p.pointsCost} Pts</span>
              <button class="aBtn" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer;">Eliminar</button>
            </div>
          </div>
        `;
        
        const delBtn = card.querySelector("button");
        delBtn.onclick = async () => {
          if (!confirm("¿Eliminar esta promoción?")) return;
          try {
            await fetch(`/api/admin/promotions?id=${p.id}`, { method: "DELETE", credentials: "include" });
            loadPromotionsAdmin();
          } catch (e) {
            alert("Error al eliminar");
          }
        };
        list.appendChild(card);
      });
    } catch (e) {
      list.innerHTML = `<div style="color: #ef4444;">Error: ${e.message}</div>`;
    }
  };

  const promoForm = document.getElementById("adminPromotionForm");
  if (promoForm) {
    promoForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("promoTitle").value;
      const desc = document.getElementById("promoDescription").value;
      const points = parseInt(document.getElementById("promoPoints").value, 10);
      const fileInput = document.getElementById("promoImage");
      const resEl = document.getElementById("promoFormResult");
      
      if (!fileInput.files[0]) return;
      
      resEl.textContent = "Procesando imagen...";
      resEl.style.color = "#06b6d4";
      
      const file = fileInput.files[0];
      const reader = new FileReader();
      
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        resEl.textContent = "Subiendo...";
        try {
          const res = await fetch("/api/admin/promotions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              description: desc,
              pointsCost: points,
              imageBase64: base64
            }),
            credentials: "include"
          });
          const data = await res.json();
          if (res.ok) {
            resEl.textContent = "Promoción creada exitosamente.";
            resEl.style.color = "#10b981";
            promoForm.reset();
            loadPromotionsAdmin();
          } else {
            throw new Error(data.error);
          }
        } catch (err) {
          resEl.textContent = err.message || "Error al subir";
          resEl.style.color = "#ef4444";
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Client Promotions Modal Logic
  const profilePromocionesBtn = document.getElementById("profilePromocionesBtn");
  const promotionsListModal = document.getElementById("promotionsListModal");
  const promotionsListClose = document.getElementById("promotionsListClose");
  const promotionsListBackdrop = document.getElementById("promotionsListBackdrop");
  const promotionsListClientContainer = document.getElementById("promotionsListClientContainer");

  const closePromotionsClientModal = () => {
    if (!promotionsListModal) return;
    promotionsListModal.classList.remove("profileMenu--active");
    promotionsListModal.setAttribute("aria-hidden", "true");
  };

  if (profilePromocionesBtn && promotionsListModal && promotionsListClientContainer) {
    profilePromocionesBtn.addEventListener("click", async () => {
      // Cierra el menu principal del perfil si está abierto
      const profileMenu = document.getElementById("profileMenu");
      if (profileMenu && profileMenu.classList.contains("profileMenu--active")) {
        profileMenu.classList.remove("profileMenu--active");
        profileMenu.setAttribute("aria-hidden", "true");
      }

      promotionsListModal.classList.add("profileMenu--active");
      promotionsListModal.setAttribute("aria-hidden", "false");
      promotionsListClientContainer.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.7); padding: 20px;">Cargando promociones...</div>`;

      try {
        const res = await fetch("/api/admin/promotions"); // public GET is allowed
        const promos = await res.json();
        
        if (!res.ok) throw new Error(promos.error);
        
        if (promos.length === 0) {
          promotionsListClientContainer.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.7); padding: 20px;">No hay promociones activas por el momento. ¡Vuelve pronto!</div>`;
          return;
        }

        promotionsListClientContainer.innerHTML = "";
        promos.forEach(p => {
          const item = document.createElement("div");
          item.style.cssText = "background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; overflow: hidden; display: flex; align-items: center; padding: 10px; gap: 15px;";
          
          item.innerHTML = `
            <div style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #000;">
              <img src="${p.imageBase64}" alt="${p.title}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div style="flex: 1; min-width: 0;">
              <h4 style="margin: 0 0 4px 0; color: #fff; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.title}</h4>
              <p style="margin: 0 0 6px 0; color: rgba(255,255,255,0.6); font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.description || ""}</p>
              <div style="color: #f43f5e; font-weight: bold; font-size: 14px;">${p.pointsCost} Puntos</div>
            </div>
          `;
          promotionsListClientContainer.appendChild(item);
        });
        
      } catch (err) {
        promotionsListClientContainer.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px;">Ocurrió un error al cargar las promociones.</div>`;
      }
    });

    if (promotionsListClose) promotionsListClose.addEventListener("click", closePromotionsClientModal);
    if (promotionsListBackdrop) promotionsListBackdrop.addEventListener("click", closePromotionsClientModal);
  }

});
