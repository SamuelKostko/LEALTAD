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

        const showPromoModal = async () => {
          const promoModal = document.getElementById("promoModal");
          const promoImg = document.getElementById("promoModalImage");
          if (!promoModal || !promoImg) return;

          try {
            const res = await fetch('/api/popup-config');
            const config = await res.json().catch(() => ({ type: 'none' }));

            if (config.type === 'none' || !config.type) return;

            let chosenImg = null;
            let onImageClick = null;

            if (config.type === 'custom_image' && config.imageUrl) {
              chosenImg = config.imageUrl;
            } else if (config.type === 'promotion' && config.promotionId) {
              // The backend now returns the image directly in config.imageUrl and the full promo in config.promotion
              if (config.imageUrl) {
                chosenImg = config.imageUrl;
                if (config.promotion) {
                  onImageClick = () => {
                    hidePromo();
                    if (typeof window.showDetailModal === 'function') {
                      window.showDetailModal(config.promotion);
                    }
                  };
                }
              }
            }

            if (!chosenImg) return;

            promoImg.src = chosenImg;
            promoImg.onclick = onImageClick ? onImageClick : null;
            promoImg.style.cursor = onImageClick ? 'pointer' : 'default';

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

          } catch (err) {
            console.error('Error loading popup config', err);
          }
        };

        const runFirstOpenFlow = () => {
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
        };

          // Control del Modal de Teléfono
          if (data.telefono && document.getElementById("phoneModalInput")) {
            document.getElementById("phoneModalInput").value = data.telefono;
          }
          
          if (!data.telefono) {
          const phoneModal = document.getElementById("phoneModal");
          if (phoneModal) {
            setTimeout(() => {
              phoneModal.classList.add("firstOpenModal--active");
              phoneModal.setAttribute("aria-hidden", "false");
            }, 100);

            const saveBtn = document.getElementById("phoneModalSaveBtn");
            const input = document.getElementById("phoneModalInput");

            if (saveBtn && input) {
              saveBtn.onclick = async () => {
                const tel = input.value.trim();
                if (tel.length < 10) {
                  alert("Por favor ingresa un número de teléfono válido.");
                  return;
                }

                if (!confirm(`Confirma tu número: ${tel}`)) {
                  return;
                }
                
                saveBtn.disabled = true;
                saveBtn.textContent = "Guardando...";

                try {
                  const res = await fetch("/api/client/update-phone", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: data.token, telefono: tel })
                  });
                  if (!res.ok) throw new Error("Error al guardar");
                  
                  phoneModal.classList.remove("firstOpenModal--active");
                  phoneModal.setAttribute("aria-hidden", "true");
                  setTimeout(() => {
                    runFirstOpenFlow();
                  }, 300);
                } catch (err) {
                  alert("Error al guardar el teléfono. Intenta nuevamente.");
                  saveBtn.disabled = false;
                  saveBtn.textContent = "Guardar Teléfono";
                }
              };
            }
          } else {
            runFirstOpenFlow();
          }
        } else {
          runFirstOpenFlow();
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
    const panelPendingPayments = document.getElementById("aPanelPendingPayments");
    const panelStats = document.getElementById("aPanelStats");
    
    const navClientes = document.getElementById("aNavClientes");
    const navTx = document.getElementById("aNavTx");
    const navPendingPayments = document.getElementById("aNavPendingPayments");
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
    
    const pendingPaymentsRefresh = document.getElementById("adminPendingPaymentsRefresh");
    const pendingPaymentsList = document.getElementById("adminPendingPaymentsList");
    const pendingPaymentsResult = document.getElementById("adminPendingPaymentsResult");
    
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
    const panelMarketing = document.getElementById("secMarketing");
    const navMarketing = document.getElementById("aNavMarketing");
    const panelStartup = document.getElementById("aPanelStartup");
    const navStartup = document.getElementById("aNavStartup");
    

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
      if (panelPendingPayments) panelPendingPayments.hidden = panel !== "pendientes";
      if (panelStats) panelStats.hidden = panel !== "metricas";
      if (panelCajeros) panelCajeros.hidden = panel !== "cajeros";
      if (panelComercios) panelComercios.hidden = panel !== "comercios";
      if (panelSedes) panelSedes.hidden = panel !== "sedes";
      if (panelReportes) panelReportes.hidden = panel !== "reportes";
      if (panelReferidos) panelReferidos.hidden = panel !== "referidos";
      if (panelMarketing) panelMarketing.hidden = panel !== "marketing";
      if (panelStartup) panelStartup.hidden = panel !== "startup";

      if (navClientes) navClientes.classList.toggle("is-active", panel === "clientes");
      if (navTx) navTx.classList.toggle("is-active", panel === "transacciones");
      if (navPendingPayments) navPendingPayments.classList.toggle("is-active", panel === "pendientes");
      if (navStats) navStats.classList.toggle("is-active", panel === "metricas");
      if (navCajeros) navCajeros.classList.toggle("is-active", panel === "cajeros");
      if (navComercios) navComercios.classList.toggle("is-active", panel === "comercios");
      if (navSedes) navSedes.classList.toggle("is-active", panel === "sedes");
      if (navReportes) navReportes.classList.toggle("is-active", panel === "reportes");
      if (navReferidos) navReferidos.classList.toggle("is-active", panel === "referidos");
      if (navMarketing) navMarketing.classList.toggle("is-active", panel === "marketing");
      if (navStartup) navStartup.classList.toggle("is-active", panel === "startup");

      
      const mobClientes = document.getElementById("aMobNavClientes");
      const mobTx = document.getElementById("aMobNavTx");
      const mobPendingPayments = document.getElementById("aMobNavPendingPayments");
      const mobStats = document.getElementById("aMobNavStats");
      const mobCajeros = document.getElementById("aMobNavCajeros");
      const mobComercios2 = document.getElementById("aMobNavComercios");
      const mobSedes = document.getElementById("aMobNavSedes");
      const mobReportes = document.getElementById("aMobNavReportes");
      const mobReferidos = document.getElementById("aMobNavReferidos");

      if (mobClientes) mobClientes.classList.toggle("is-active", panel === "clientes");
      if (mobTx) mobTx.classList.toggle("is-active", panel === "transacciones");
      if (mobPendingPayments) mobPendingPayments.classList.toggle("is-active", panel === "pendientes");
      if (mobStats) mobStats.classList.toggle("is-active", panel === "metricas");
      if (mobCajeros) mobCajeros.classList.toggle("is-active", panel === "cajeros");
      if (mobComercios2) mobComercios2.classList.toggle("is-active", panel === "comercios");
      if (mobSedes) mobSedes.classList.toggle("is-active", panel === "sedes");
      if (mobReportes) mobReportes.classList.toggle("is-active", panel === "reportes");
      if (mobReferidos) mobReferidos.classList.toggle("is-active", panel === "referidos");

      const main = document.querySelector(".aDash__main");
      if (main) main.scrollTop = 0;
    };
    if (navClientes) navClientes.addEventListener("click", () => switchPanel("clientes"));
    if (navTx) navTx.addEventListener("click", () => {
      switchPanel("transacciones");
      currentTxLimit = 10;
      loadAllTransactions("");
    });
    if (navPendingPayments) navPendingPayments.addEventListener("click", () => {
      switchPanel("pendientes");
      loadPendingPayments();
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
      loadRedeemedPromotions();
    });
    if (navStartup) navStartup.addEventListener("click", () => {
      switchPanel("startup");
      loadAdminPopupConfig();
    });

    const mobNavClientes = document.getElementById("aMobNavClientes");
    const mobNavTx = document.getElementById("aMobNavTx");
    const mobNavStats = document.getElementById("aMobNavStats");
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

        // Actualizamos los datos localmente en lugar de recargar toda la lista (para no perder la búsqueda)
        const updated = allCards.find((c) => c.token === selectedToken);
        if (updated) {
          if (name) updated.name = name;
          if (cedula) updated.cedula = cedula;
          if (email) updated.email = email;
          if (sede !== undefined) updated.sedes = sede;
          selectClient(updated);
        }
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

    const loadPendingPayments = async () => {
      if (!pendingPaymentsList) return;
      pendingPaymentsList.innerHTML = `<div class="aStatLoader">Cargando pagos pendientes...</div>`;
      if (pendingPaymentsResult) pendingPaymentsResult.textContent = "";

      try {
        const data = await apiGet("/api/admin/pending-purchases");
        if (!data || !data.pending) throw new Error("Error obteniendo pagos.");
        
        pendingPaymentsList.innerHTML = "";
        
        if (data.pending.length === 0) {
          pendingPaymentsList.innerHTML = `<div class="aStatLoader" style="color:var(--text-secondary);">No hay pagos pendientes por revisar.</div>`;
          return;
        }

        data.pending.forEach(p => {
          const item = document.createElement("div");
          item.className = "aTxItem";
          item.style.cssText = "display: flex; flex-direction: column; gap: 10px; align-items: stretch;";
          
          const header = document.createElement("div");
          header.style.cssText = "display: flex; justify-content: space-between; align-items: flex-start;";
          header.innerHTML = `
            <div>
              <div class="aTxItem__type">Pago Móvil Ref: <strong style="color:var(--primary);">${p.reference || 'N/A'}</strong></div>
              <div class="aTxItem__date">${new Date(p.createdAt).toLocaleString("es-VE")}</div>
              <div class="aTxItem__desc" style="margin-top: 4px; font-size: 0.85rem;">
                <strong>Cliente:</strong> <span style="color:var(--primary);">${p.clientName || 'Desconocido'}</span> (Tarjeta: ${p.cardNumber})<br>
                <strong>Banco Origen:</strong> ${p.originBank || 'N/A'}<br>
                <strong>Teléfono Origen:</strong> ${p.originPhone || 'N/A'}<br>
                <strong>CI Origen:</strong> ${p.originId || 'N/A'}<br>
                <strong>Monto Bs:</strong> ${p.totalBs || 'N/A'} (Tasa: ${p.rate || 'N/A'})
              </div>
            </div>
            <div class="aTxItem__points" style="color: #10b981;">+${p.amount} pts</div>
          `;

          const actions = document.createElement("div");
          actions.style.cssText = "display: flex; gap: 10px; margin-top: 5px;";
          
          const approveBtn = document.createElement("button");
          approveBtn.className = "aBtn aBtn--primary";
          approveBtn.style.cssText = "padding: 6px 12px; font-size: 0.85rem; flex: 1;";
          approveBtn.textContent = "Aprobar";
          approveBtn.onclick = () => resolvePurchase(p.id, 'approve');

          const rejectBtn = document.createElement("button");
          rejectBtn.className = "aBtn aBtn--danger";
          rejectBtn.style.cssText = "padding: 6px 12px; font-size: 0.85rem; flex: 1;";
          rejectBtn.textContent = "Rechazar";
          rejectBtn.onclick = () => resolvePurchase(p.id, 'reject');

          actions.appendChild(approveBtn);
          actions.appendChild(rejectBtn);

          item.appendChild(header);
          item.appendChild(actions);
          pendingPaymentsList.appendChild(item);
        });

      } catch (err) {
        pendingPaymentsList.innerHTML = `<div class="aStatLoader" style="color:#ef4444;">Error al cargar.</div>`;
      }
    };

    const resolvePurchase = async (id, action) => {
      if (!confirm(`¿Estás seguro de que deseas ${action === 'approve' ? 'aprobar' : 'rechazar'} este pago?`)) return;
      
      try {
        if (pendingPaymentsResult) {
          pendingPaymentsResult.style.color = "var(--text-primary)";
          pendingPaymentsResult.textContent = "Procesando...";
        }
        
        const response = await apiPost("/api/admin/resolve-purchase", { id, action });
        if (response && response.ok) {
          if (pendingPaymentsResult) {
            pendingPaymentsResult.style.color = "#10b981";
            pendingPaymentsResult.textContent = response.message || "Pago procesado.";
          }
          loadPendingPayments();
        } else {
          throw new Error(response.error || "Error al procesar el pago");
        }
      } catch (err) {
        if (pendingPaymentsResult) {
          pendingPaymentsResult.style.color = "#ef4444";
          pendingPaymentsResult.textContent = String(err.message || err);
        }
      }
    };

    if (pendingPaymentsRefresh) {
      pendingPaymentsRefresh.addEventListener("click", loadPendingPayments);
    }


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

    let currentSedesRange = "day";
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

    // ── Popup Config Logic ──────────────────────────────────────────────
    const loadAdminPopupConfig = async () => {
      const typeSelect = document.getElementById("popupType");
      const promoSelect = document.getElementById("popupPromotionSelect");
      const imgPreview = document.getElementById("popupImagePreview");
      
      if (!typeSelect || !promoSelect) return;
      
      try {
        const pRes = await fetch('/api/admin/promotions', { credentials: 'include' });
        if (pRes.ok) {
          const data = await pRes.json();
          promoSelect.innerHTML = (data.promotions || []).map(p => `<option value="${p.id}">${p.title}</option>`).join('');
        }
      } catch (e) { console.error('Error fetching promos for popup config', e); }

      try {
        const res = await fetch('/api/admin/popup-config', { credentials: 'include' });
        const config = await res.json();
        typeSelect.value = config.type || 'none';
        if (config.type === 'promotion' && config.promotionId) {
          promoSelect.value = config.promotionId;
        } else if (config.type === 'custom_image' && config.imageUrl) {
          imgPreview.src = config.imageUrl;
          imgPreview.style.display = 'block';
        }
        typeSelect.dispatchEvent(new Event('change'));
      } catch (err) {
        console.error('Error loading popup config', err);
      }
    };

    const popupType = document.getElementById("popupType");
    if (popupType) {
      popupType.addEventListener('change', (e) => {
        const val = e.target.value;
        document.getElementById('popupPromotionSection').style.display = val === 'promotion' ? 'block' : 'none';
        document.getElementById('popupCustomImageSection').style.display = val === 'custom_image' ? 'block' : 'none';
      });
    }

    const popupCustomImg = document.getElementById("popupCustomImage");
    if (popupCustomImg) {
      popupCustomImg.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const imgPreview = document.getElementById('popupImagePreview');
        if (!file) {
          imgPreview.style.display = 'none';
          return;
        }
        if (file.size > 15 * 1024 * 1024) {
          alert('La imagen excede el límite de 15 MB.');
          e.target.value = '';
          imgPreview.style.display = 'none';
          return;
        }
        
        document.getElementById('popupResult').textContent = 'Procesando imagen...';
        document.getElementById('popupResult').style.color = '#fff';
        
        try {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800;
              let width = img.width;
              let height = img.height;
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              const base64 = canvas.toDataURL('image/jpeg', 0.6);
              imgPreview.src = base64;
              imgPreview.style.display = 'block';
              document.getElementById('popupResult').textContent = '';
            };
          };
        } catch (err) {
          document.getElementById('popupResult').textContent = 'Error procesando imagen';
          document.getElementById('popupResult').style.color = '#ef4444';
        }
      });
    }

    const savePopupBtn = document.getElementById("savePopupConfigBtn");
    if (savePopupBtn) {
      savePopupBtn.addEventListener('click', async () => {
        const resultEl = document.getElementById('popupResult');
        const type = document.getElementById('popupType').value;
        let payload = { type };

        if (type === 'promotion') {
          const pId = document.getElementById('popupPromotionSelect').value;
          if (!pId) {
            resultEl.textContent = 'Selecciona una promoción';
            resultEl.style.color = '#ef4444';
            return;
          }
          payload.promotionId = pId;
        } else if (type === 'custom_image') {
          const imgPreview = document.getElementById('popupImagePreview');
          if (!imgPreview.src || imgPreview.style.display === 'none') {
            resultEl.textContent = 'Sube una imagen';
            resultEl.style.color = '#ef4444';
            return;
          }
          payload.imageUrl = imgPreview.src;
        }

        savePopupBtn.disabled = true;
        resultEl.textContent = 'Guardando...';
        resultEl.style.color = '#fff';

        try {
          const res = await fetch('/api/admin/popup-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al guardar');

          resultEl.textContent = 'Configuración guardada exitosamente';
          resultEl.style.color = '#10b981';
          setTimeout(() => { resultEl.textContent = ''; }, 3000);
        } catch (err) {
          resultEl.textContent = err.message;
          resultEl.style.color = '#ef4444';
        } finally {
          savePopupBtn.disabled = false;
        }
      });
    }

    // Expose loadAdminPopupConfig globally so it can be called from the sidebar
    window.loadAdminPopupConfig = loadAdminPopupConfig;
    const initAuthed = (role) => {
      showDash();
      
      switchPanel("clientes");
      loadClients();
      if (adminResetTxsBtn) adminResetTxsBtn.hidden = false;
      
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
          if (role === "marketing") {
            window.location.replace("/admin/promotions");
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
    const before = t.balanceBefore != null && Number.isFinite(Number(t.balanceBefore)) ? Number(t.balanceBefore) : null;
    const after = t.balanceAfter != null && Number.isFinite(Number(t.balanceAfter)) ? Number(t.balanceAfter) : null;
    if (before !== null && after !== null) return after - before;
    let pts = Number(t.points) || 0;
    if (pts === 0 && t.amount != null) {
      pts = Number(t.amount);
    }
    const type = String(t.type || "");
    if (type === "pos_charge" || type === "transfer_out") return -Math.abs(pts);
    if (type.includes("credit") || type === "transfer_in") return Math.abs(pts);
    return pts;
  };
  const getTitle = (t, delta) => {
    const desc = String(t.description || "").trim();
    if (desc) return desc;
    const type = String(t.type || "").trim();
    if (type === "transfer_out") return `Envío a ${t.recipientName || t.recipientEmail || 'Usuario'}`;
    if (type === "transfer_in") return `Recibido de ${t.senderName || 'Usuario'}`;
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
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: rgba(255,255,255,0.5);">Cargando...</td></tr>`;
    try {
      const res = await fetch("/api/admin/marketing-users", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      
      const usersList = data.marketingUsers || [];
      if (usersList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: rgba(255,255,255,0.5);">No hay usuarios de marketing</td></tr>`;
        return;
      }
      
      tbody.innerHTML = "";
      usersList.forEach(u => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
        
        const statusText = u.isActive !== false ? `<span style="color: #22c55e; font-weight: 600;">Activo</span>` : `<span style="color: #ef4444; font-weight: 600;">Inactivo</span>`;
        const toggleText = u.isActive !== false ? "Desactivar" : "Activar";
        
        tr.innerHTML = `
          <td style="padding: 12px; color: #fff; font-size: 14px;">${u.name || "—"}</td>
          <td style="padding: 12px; color: #fff; font-size: 14px;">${u.username}</td>
          <td style="padding: 12px; color: #fff; font-size: 14px; text-align: center;">${statusText}</td>
          <td style="padding: 12px; text-align: right; display: flex; justify-content: flex-end; gap: 8px;">
            <button class="editBtn" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 6px 12px; font-size: 12px; border-radius: 6px; border: none; cursor: pointer;">Editar</button>
            <button class="toggleBtn" style="background: rgba(168, 162, 158, 0.2); color: #a8a29e; padding: 6px 12px; font-size: 12px; border-radius: 6px; border: none; cursor: pointer;">${toggleText}</button>
            <button class="delBtn" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 6px 12px; font-size: 12px; border-radius: 6px; border: none; cursor: pointer;">Eliminar</button>
          </td>
        `;
        
        tr.querySelector(".editBtn").onclick = () => {
          document.getElementById("editPromoterId").value = u.id;
          document.getElementById("editPromoterName").value = u.name || "";
          document.getElementById("editPromoterModal").style.display = "flex";
          document.getElementById("editPromoterModal").setAttribute("aria-hidden", "false");
          document.getElementById("editPromoterResult").style.display = "none";
        };
        
        tr.querySelector(".toggleBtn").onclick = async () => {
          if (!confirm(`¿${toggleText} el promotor ${u.username}?`)) return;
          try {
            const res = await fetch(`/api/admin/marketing-users`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: u.id, isActive: u.isActive === false }),
              credentials: "include"
            });
            if (!res.ok) throw new Error("Error al cambiar estado");
            loadMarketingUsers();
          } catch (e) {
            alert(e.message);
          }
        };

        tr.querySelector(".delBtn").onclick = async () => {
          if (!confirm(`¿Eliminar usuario ${u.username}?`)) return;
          try {
            const res = await fetch(`/api/admin/marketing-users`, { 
              method: "DELETE", 
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: u.id }),
              credentials: "include" 
            });
            if (!res.ok) throw new Error("Error al eliminar");
            loadMarketingUsers();
          } catch (e) {
            alert(e.message);
          }
        };
        tbody.appendChild(tr);
      });
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">Error al cargar: ${e.message}</td></tr>`;
    }
  };

  const editPromoterModal = document.getElementById("editPromoterModal");
  if (editPromoterModal) {
    document.getElementById("editPromoterCloseBtn").onclick = () => {
      editPromoterModal.style.display = "none";
      editPromoterModal.setAttribute("aria-hidden", "true");
    };
    
    document.getElementById("editPromoterForm").onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById("editPromoterId").value;
      const name = document.getElementById("editPromoterName").value;
      const btn = document.getElementById("editPromoterSubmitBtn");
      const resEl = document.getElementById("editPromoterResult");
      
      btn.disabled = true;
      resEl.style.display = "none";
      
      try {
        const res = await fetch("/api/admin/marketing-users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name }),
          credentials: "include"
        });
        if (!res.ok) throw new Error("Error al guardar cambios");
        
        editPromoterModal.style.display = "none";
        editPromoterModal.setAttribute("aria-hidden", "true");
        loadMarketingUsers();
      } catch (err) {
        resEl.textContent = err.message;
        resEl.className = "aResult aResult--error";
        resEl.style.display = "block";
      } finally {
        btn.disabled = false;
      }
    };
  }

  const mktForm = document.getElementById("adminMarketingUserForm");
  if (mktForm) {
    mktForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("mktUserName").value;
      const email = document.getElementById("mktUserEmail").value;
      const resEl = document.getElementById("mktUserFormResult");
      
      resEl.textContent = "Enviando invitación...";
      resEl.style.color = "#06b6d4";
      
      try {
        const res = await fetch("/api/admin/invite-marketing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email }),
          credentials: "include"
        });
        const data = await res.json();
        if (res.ok) {
          resEl.textContent = "Invitación enviada exitosamente.";
          resEl.style.color = "#10b981";
          mktForm.reset();
        } else {
          throw new Error(data.error);
        }
      } catch (err) {
        resEl.textContent = err.message || "Error al invitar";
        resEl.style.color = "#ef4444";
      }
    });
  }

  // Redeemed Promotions Management
  window.loadRedeemedPromotions = async () => {
    const tbody = document.getElementById("redeemedPromotionsTableBody");
    if (!tbody) return;

    try {
      const res = await fetch("/api/admin/redeemed-promotions", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error fetching redeemed promotions");
      const promotions = data.promotions || [];

      if (promotions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--muted);">No hay promociones canjeadas</td></tr>`;
        return;
      }

      tbody.innerHTML = promotions.map(p => {
        const date = new Date(p.createdAt).toLocaleString('es-ES', { 
          day: '2-digit', month: '2-digit', year: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        });
        const statusText = p.deliveryStatus === 'delivered' ? 'Entregado' : 'Pendiente';
        const statusColor = p.deliveryStatus === 'delivered' ? '#10b981' : '#f59e0b';
        
        return `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 13px; color: #fff;">
            <td style="padding: 12px; font-weight: 600; color: #fff;">#${p.orderNumber || 'N/A'}</td>
            <td style="padding: 12px; color: rgba(255,255,255,0.7);">${date}</td>
            <td style="padding: 12px; color: #fff;">${p.clientName || p.token || 'N/A'}</td>
            <td style="padding: 12px; color: #fff; font-weight: 500;">
              ${String(p.description || '').replace('Canje de promoción: ', '') || 'Promoción'}
            </td>
            <td style="padding: 12px; text-align: center;">
              <span style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; text-transform: uppercase;">
                ${statusText}
              </span>
            </td>
            <td style="padding: 12px; text-align: right;">
              <div style="display: flex; gap: 6px; justify-content: flex-end;">
                ${p.deliveryStatus !== 'delivered' ? `
                  <button class="aBtn" onclick="markRedemptionDelivered('${p.id}')" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); padding: 6px 10px; font-size: 11px; border-radius: 6px; cursor: pointer;">
                    Entregar
                  </button>
                ` : ''}
                <button class="aBtn" onclick="deleteRedemption('${p.id}')" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 6px 10px; font-size: 11px; border-radius: 6px; cursor: pointer;">
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #ef4444;">Error cargando promociones canjeadas: ${err.message}</td></tr>`;
    }
  };

  window.markRedemptionDelivered = async (id) => {
    if (!confirm("¿Marcar esta promoción como entregada al cliente?")) return;
    
    try {
      const res = await fetch("/api/admin/redeemed-promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: 'deliver' }),
        credentials: "include"
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar");
      
      loadRedeemedPromotions();
    } catch (err) {
      alert(err.message);
    }
  };

  window.deleteRedemption = async (id) => {
    const refund = window.confirm("¿Deseas reembolsar los puntos al cliente por esta promoción?");
    const password = window.prompt("Introduce tu CLAVE DE ADMINISTRADOR para confirmar la eliminación:");
    
    if (password === null) return;
    if (!password.trim()) {
      alert("Debes ingresar la clave.");
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/redeemed-promotions?id=${id}&password=${encodeURIComponent(password.trim())}&refund=${refund}`, {
        method: "DELETE",
        credentials: "include"
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar");
      
      alert(data.message || "Promoción eliminada exitosamente.");
      loadRedeemedPromotions();
    } catch (err) {
      alert(err.message);
    }
  };


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
  const promotionsView = document.getElementById("promotionsView");
  const promotionsBackBtn = document.getElementById("promotionsBackBtn");
  const promotionsListClientContainer = document.getElementById("promotionsListClientContainer");

  // Track countdown intervals so we can clear them
  let promoCountdownIntervals = [];

  const closePromotionsView = () => {
    if (!promotionsView) return;
    promoCountdownIntervals.forEach(id => clearInterval(id));
    promoCountdownIntervals = [];
    promotionsView.style.display = "none";
    promotionsView.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  const formatCountdown = (ms) => {
    if (ms <= 0) return { label: "Expirado", cls: "promo-expired" };
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (d > 0) return { label: `⏱ ${d}d ${h}h ${m}m`, cls: d < 2 ? "promo-urgent" : "promo-soon" };
    if (h > 0) return { label: `⏱ ${h}h ${m}m ${s}s`, cls: "promo-urgent" };
    return { label: `⏱ ${m}m ${s}s`, cls: "promo-critical" };
  };

  const renderPromotionCard = (p, container) => {
    const card = document.createElement("div");
    card.setAttribute("role", "button");
    card.style.cssText = [
      "position: relative",
      "background: #111",
      "border: 1px solid rgba(255,255,255,0.05)",
      "border-radius: 20px",
      "overflow: hidden",
      "display: flex",
      "flex-direction: column",
      "transition: transform 0.2s",
      "cursor: pointer",
      "height: 100%"
    ].join(";");

    const hasExpiry = Boolean(p.expiresAt);
    const countdownId = `promo-cd-${p.id}`;

    card.innerHTML = `
      <div style="aspect-ratio: 1 / 1; width: 100%; background: #000; overflow: hidden; border-radius: 20px 20px 0 0;">
        <img src="${p.image}" alt="${p.title}"
          style="width:100%; height:100%; object-fit:cover; display:block; transition: transform 0.4s;"
          loading="lazy"
        />
      </div>
      <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <span style="font-size:15px; font-weight:800; color:#fff; line-height:1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.title}</span>
        
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            ${p.realPrice ? `<span style="color:rgba(255,255,255,0.4); font-weight:600; font-size:11px; text-decoration: line-through;">${Number(p.realPrice).toLocaleString("es-VE")} Pts</span>` : ''}
            <span style="color:#06b6d4; font-weight:800; font-size:14px;">
              ${Number(p.points).toLocaleString("es-VE")} Pts
            </span>
          </div>
          ${hasExpiry ? `<div id="${countdownId}" style="font-size:11px; font-weight:600; letter-spacing:0.02em;"></div>` : ""}
        </div>
      </div>
    `;

    card.addEventListener("click", () => openPromoDetailsModal(p));
    container.appendChild(card);

    if (hasExpiry) {
      const el = document.getElementById(countdownId);
      if (el) {
        const tick = () => {
          const { label, cls } = formatCountdown(new Date(p.expiresAt).getTime() - Date.now());
          el.textContent = label;
          el.style.color = cls === "promo-critical" ? "#ef4444"
            : cls === "promo-urgent" ? "#f59e0b"
            : cls === "promo-soon" ? "#fbbf24"
            : "rgba(255,255,255,0.5)";
        };
        tick();
        promoCountdownIntervals.push(setInterval(tick, 1000));
      }
    }
  };

  let currentSelectedPromo = null;
  const promoDetailsView = document.getElementById("promoDetailsView");
  const pdCloseBtn = document.getElementById("pdCloseBtn");
  const pdRequestBtn = document.getElementById("pdRequestBtn");

  const setPromoResult = (el, type, msg) => {
    if (!el) return;
    el.className = "aResult" + (type ? ` aResult--${type}` : "");
    el.textContent = msg;
  };

  const closePromoDetailsModal = () => {
    if (!promoDetailsView) return;
    promoDetailsView.style.display = "none";
    promoDetailsView.setAttribute("aria-hidden", "true");
    currentSelectedPromo = null;
  };

  if (pdCloseBtn) pdCloseBtn.addEventListener("click", closePromoDetailsModal);

  const pdImageEl = document.getElementById("pdImage");
  if (pdImageEl) {
    pdImageEl.style.cursor = "pointer";
    pdImageEl.addEventListener("click", () => {
      if (!pdImageEl.src) return;
      const promoModal = document.getElementById("promoModal");
      const promoImg = document.getElementById("promoModalImage");
      if (promoModal && promoImg) {
        promoImg.src = pdImageEl.src;
        promoModal.classList.add("promoModal--active");
        promoModal.setAttribute("aria-hidden", "false");
        
        const hidePromo = () => {
          promoModal.classList.remove("promoModal--active");
          promoModal.setAttribute("aria-hidden", "true");
        };
        const closeBtn = document.getElementById("promoModalCloseBtn");
        if (closeBtn) closeBtn.onclick = hidePromo;
        const backdrop = document.getElementById("promoModalBackdrop");
        if (backdrop) backdrop.onclick = hidePromo;
      }
    });
  }

  let currentPromoQty = 1;

  const updateQtyUi = () => {
    const pdQtyValue = document.getElementById("pdQtyValue");
    const pdTotalPoints = document.getElementById("pdTotalPoints");
    const pdTotalPointsContainer = document.getElementById("pdTotalPointsContainer");
    if (pdQtyValue) pdQtyValue.textContent = currentPromoQty;
    if (currentSelectedPromo && pdTotalPoints) {
      const total = (currentSelectedPromo.points || 0) * currentPromoQty;
      pdTotalPoints.textContent = `${total.toLocaleString("es-VE")} Pts`;
      if (pdTotalPointsContainer) {
        pdTotalPointsContainer.style.display = currentPromoQty > 1 ? "block" : "none";
      }
    }
  };

  const openPromoDetailsModal = (p) => {
    try {
      let view = promoDetailsView || document.getElementById("promoDetailsView");
      if (!view) {
        alert("La aplicación se actualizó. Por favor cierra la app por completo y vuelve a abrirla.");
        return;
      }
      currentSelectedPromo = p;
      
      document.getElementById("pdImage").src = p.image || "";
      document.getElementById("pdTitle").textContent = p.title || "Sin título";
      document.getElementById("pdDesc").textContent = p.description || "";
      
      const pointsHtml = p.realPrice ? `<span style="font-size:14px; color:rgba(255,255,255,0.5); text-decoration:line-through; margin-right:6px;">${Number(p.realPrice).toLocaleString("es-VE")} Pts</span>${Number(p.points).toLocaleString("es-VE")} Pts` : `${Number(p.points).toLocaleString("es-VE")} Pts`;
      document.getElementById("pdPoints").innerHTML = pointsHtml;
      
      const unitsEl = document.getElementById("pdUnits");
      if (p.units !== undefined) {
        unitsEl.textContent = `${p.units} ${p.units === 1 ? 'disponible' : 'disponibles'}`;
        unitsEl.style.display = "inline-flex";
        unitsEl.style.color = p.units > 0 ? "#10b981" : "#ef4444";
        unitsEl.style.background = p.units > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)";
        if (p.units <= 0) unitsEl.textContent = "Agotado";
      } else {
        unitsEl.style.display = "none";
      }

      const expiresEl = document.getElementById("pdExpires");
      if (p.expiresAt) {
        const d = new Date(p.expiresAt);
        expiresEl.textContent = `Válido hasta: ${d.toLocaleDateString("es-VE")}`;
        expiresEl.style.display = "inline-flex";
      } else {
        expiresEl.style.display = "none";
      }

      const branchEl = document.getElementById("pdBranch");
      branchEl.style.display = "none";

      const selectContainer = document.getElementById("pdBranchSelectContainer");
      const branchSelect = document.getElementById("pdBranchSelect");
      if (p.branch && selectContainer && branchSelect) {
        const branches = p.branch.split(',').map(b => b.trim().toUpperCase()).filter(b => b);
        if (branches.length > 0) {
          let optionsHtml = `<option value="" disabled selected>SELECCIONE UNA SEDE</option>`;
          branches.forEach(b => {
            optionsHtml += `<option value="${b}">${b}</option>`;
          });
          branchSelect.innerHTML = optionsHtml;
          selectContainer.style.display = "block";
        } else {
          selectContainer.style.display = "none";
        }
      } else if (selectContainer) {
        selectContainer.style.display = "none";
      }
      
      currentPromoQty = 1;
      updateQtyUi();

      setPromoResult(document.getElementById("pdResult"), "", "");
      
      // Reset OTP UI
      document.getElementById("pdOtpContainer").style.display = "none";
      document.getElementById("pdOtpInput").value = "";
      document.getElementById("pdRequestBtn").style.display = "flex";
      
      const pdRequestBtnLocal = document.getElementById("pdRequestBtn");
      if (pdRequestBtnLocal) {
        pdRequestBtnLocal.disabled = p.units <= 0;
        if (p.units <= 0) {
           pdRequestBtnLocal.innerHTML = "Agotada";
           pdRequestBtnLocal.style.opacity = "0.5";
        } else {
           pdRequestBtnLocal.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> COMPRAR`;
           pdRequestBtnLocal.style.opacity = "1";
        }
      }

      view.style.display = "flex";
      view.setAttribute("aria-hidden", "false");
    } catch (err) {
      alert("Error al abrir detalles: " + err.message);
    }
  };

  if (document.getElementById("pdQtyMinus")) {
    document.getElementById("pdQtyMinus").addEventListener("click", () => {
      if (currentPromoQty > 1) {
        currentPromoQty--;
        updateQtyUi();
      }
    });
  }

  if (document.getElementById("pdQtyPlus")) {
    document.getElementById("pdQtyPlus").addEventListener("click", () => {
      if (!currentSelectedPromo) return;
      let maxAllowed = currentSelectedPromo.units || 1;
      if (currentSelectedPromo.maxPerUser && currentSelectedPromo.maxPerUser > 0) {
        maxAllowed = Math.min(maxAllowed, currentSelectedPromo.maxPerUser);
      }
      if (typeof clientDataCache !== 'undefined' && clientDataCache) {
         const clientPoints = clientDataCache.totalPoints || 0;
         const maxAffordable = Math.floor(clientPoints / (currentSelectedPromo.points || 1));
         maxAllowed = Math.min(maxAllowed, maxAffordable);
      }
      if (currentPromoQty < maxAllowed) {
        currentPromoQty++;
        updateQtyUi();
      }
    });
  }

  if (pdRequestBtn) {
    pdRequestBtn.addEventListener("click", async () => {
      if (!currentSelectedPromo) return;
      const resEl = document.getElementById("pdResult");
      
      const selectContainer = document.getElementById("pdBranchSelectContainer");
      const branchSelect = document.getElementById("pdBranchSelect");
      if (selectContainer && selectContainer.style.display !== "none") {
        if (!branchSelect.value) {
          setPromoResult(resEl, "err", "Por favor seleccione una sede de retiro.");
          return;
        }
      }

      const otpContainer = document.getElementById("pdOtpContainer");
      const otpInput = document.getElementById("pdOtpInput");
      
      pdRequestBtn.disabled = true;
      setPromoResult(resEl, "info", "Solicitando código de validación...");
      
      try {
        let tk = new URLSearchParams(window.location.search).get("token") || new URLSearchParams(window.location.search).get("t");
        if (!tk && window.location.pathname.startsWith("/card/")) {
          tk = decodeURIComponent(window.location.pathname.slice(6));
        }
        if (!tk) throw new Error("No se encontró el token de la tarjeta");

        const res = await fetch("/api/client/request-promotion-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: tk,
            promotionId: currentSelectedPromo.id,
            quantity: currentPromoQty
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al solicitar el código");
        
        pdRequestBtn.style.display = "none";
        otpContainer.style.display = "block";
        otpInput.value = "";
        otpInput.focus();
        setPromoResult(resEl, "", "");
        
      } catch (err) {
        let msg = err.message;
        if (msg === "Failed to fetch" || !navigator.onLine) {
          msg = "Sin conexión a internet. Verifica tu red.";
        } else if (msg.includes("NetworkError") || msg.includes("network")) {
          msg = "Problema de red. Verifica tu conexión.";
        }
        setPromoResult(resEl, "err", msg);
        pdRequestBtn.disabled = false;
      }
    });
  }

  const pdOtpInput = document.getElementById("pdOtpInput");
  if (pdOtpInput) {
    pdOtpInput.addEventListener("input", async (e) => {
      const val = e.target.value.trim();
      if (val.length === 6) {
        const resEl = document.getElementById("pdResult");
        const otpContainer = document.getElementById("pdOtpContainer");

        if (!currentSelectedPromo) {
          setPromoResult(resEl, "err", "Promoción no seleccionada");
          return;
        }

        try {
          pdOtpInput.disabled = true;
          setPromoResult(resEl, "info", "Validando compra...");

          let tk = new URLSearchParams(window.location.search).get("token") || new URLSearchParams(window.location.search).get("t");
          if (!tk && window.location.pathname.startsWith("/card/")) {
            tk = decodeURIComponent(window.location.pathname.slice(6));
          }
          if (!tk) throw new Error("No se encontró el token de la tarjeta");

          const res = await fetch("/api/client/request-promotion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: tk,
              promotionId: currentSelectedPromo.id,
              otp: val,
              selectedBranch: document.getElementById("pdBranchSelect")?.value || currentSelectedPromo.branch,
              quantity: currentPromoQty
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Código inválido o expirado");

          setPromoResult(resEl, "ok", `¡Compra exitosa! Orden #${data.orderNumber || ''}. Revisa tu correo.`);
          otpContainer.style.display = "none";
          
          if (typeof clientDataCache !== 'undefined' && clientDataCache) {
            clientDataCache.balance = Math.max(0, (clientDataCache.balance || 0) - currentSelectedPromo.points);
          }
          if (typeof syncBalance === "function") syncBalance();

          setTimeout(() => {
            closePromoDetailsModal();
          }, 3000);

        } catch (err) {
          let msg = err.message;
          if (msg === "Failed to fetch" || !navigator.onLine) {
            msg = "Sin conexión a internet. Verifica tu red.";
          } else if (msg.includes("NetworkError") || msg.includes("network")) {
            msg = "Problema de red. Verifica tu conexión.";
          }
          pdOtpInput.disabled = false;
          pdOtpInput.value = "";
          pdOtpInput.focus();
          setPromoResult(resEl, "err", msg);
        }
      }
    });
  }

  if (profilePromocionesBtn && promotionsView && promotionsListClientContainer) {
    profilePromocionesBtn.addEventListener("click", async () => {
      const profileMenu = document.getElementById("profileMenu");
      if (profileMenu && profileMenu.classList.contains("profileMenu--active")) {
        profileMenu.classList.remove("profileMenu--active");
        profileMenu.setAttribute("aria-hidden", "true");
      }

      document.body.style.overflow = "hidden";
      promotionsView.style.display = "flex";
      promotionsView.setAttribute("aria-hidden", "false");
      promotionsListClientContainer.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.5); padding: 60px 20px; font-size: 1rem;">Cargando promociones...</div>`;

      try {
        const res = await fetch("/api/admin/promotions", { cache: "no-store" });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error);

        const promos = resData.promotions || [];

        if (promos.length === 0) {
          promotionsListClientContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
              <div style="font-size: 48px; margin-bottom: 16px;">🏷️</div>
              <p style="font-size: 16px; font-weight: 700; color: rgba(255,255,255,0.8); margin: 0 0 8px;">Por el momento no hay promociones</p>
              <p style="font-size: 13px; color: rgba(255,255,255,0.4); margin: 0;">¡Vuelve pronto para ver las novedades!</p>
            </div>`;
          return;
        }

        promoCountdownIntervals.forEach(id => clearInterval(id));
        promoCountdownIntervals = [];
        promotionsListClientContainer.innerHTML = "";
        promos.forEach(p => renderPromotionCard(p, promotionsListClientContainer));

      } catch (err) {
        promotionsListClientContainer.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 40px 20px;">Error al cargar las promociones.</div>`;
      }
    });

    if (promotionsBackBtn) promotionsBackBtn.addEventListener("click", closePromotionsView);
  }


  // Lógica para Comprar Puntos (Wizard)
  const profileBuyPointsBtn = document.getElementById("profileBuyPointsBtn");
  const buyPointsView = document.getElementById("buyPointsView");
  const buyPointsBackBtn = document.getElementById("buyPointsBackBtn");
  
  const step1 = document.getElementById("buyPointsStep1");
  const step2 = document.getElementById("buyPointsStep2");
  const step3 = document.getElementById("buyPointsStep3");
  const stepSuccess = document.getElementById("buyPointsStepSuccess");

  const bcvRateDisplay = document.getElementById("bcvRateDisplay");
  
  const buyPointsInputPts = document.getElementById("buyPointsInputPts");
  const buyPointsInputUsd = document.getElementById("buyPointsInputUsd");
  const buyPointsInputBs = document.getElementById("buyPointsInputBs");
  const buyPointsBtnNext1 = document.getElementById("buyPointsBtnNext1");
  
  const buyPointsDisplayTotalBs = document.getElementById("buyPointsDisplayTotalBs");
  const buyPointsBtnNext2 = document.getElementById("buyPointsBtnNext2");
  
  const buyPointsOriginBank = document.getElementById("buyPointsOriginBank");
  const buyPointsOriginPhoneCode = document.getElementById("buyPointsOriginPhoneCode");
  const buyPointsOriginPhoneNum = document.getElementById("buyPointsOriginPhoneNum");
  const buyPointsOriginId = document.getElementById("buyPointsOriginId");
  const buyPointsRef = document.getElementById("buyPointsRef");
  const buyPointsDate = document.getElementById("buyPointsDate");
  const buyPointsSubmitBtn = document.getElementById("buyPointsSubmitBtn");
  const buyPointsBtnDone = document.getElementById("buyPointsBtnDone");

  let currentBcvRate = null;
  let currentTotalBs = 0;
  let currentTotalPts = 0;
  const PTS_PER_USD = 100;

  function resetBuyPointsWizard() {
    step1.style.display = "flex";
    step2.style.display = "none";
    step3.style.display = "none";
    stepSuccess.style.display = "none";
    
    if (buyPointsInputPts) buyPointsInputPts.value = "";
    if (buyPointsInputUsd) buyPointsInputUsd.value = "";
    if (buyPointsInputBs) buyPointsInputBs.value = "";
    
    if (buyPointsOriginBank) buyPointsOriginBank.value = "";
    if (buyPointsOriginPhoneNum) buyPointsOriginPhoneNum.value = "";
    if (buyPointsOriginId) buyPointsOriginId.value = "";
    if (buyPointsRef) buyPointsRef.value = "";
    if (buyPointsDate) buyPointsDate.value = "";
    
    buyPointsBtnNext1.disabled = true;
    buyPointsSubmitBtn.disabled = true;
    buyPointsSubmitBtn.textContent = "Notificar Pago";
  }

  window.showBuyPointsView = function showBuyPointsView() {
    const profileMenu = document.getElementById("profileMenu");
    if (profileMenu) {
      profileMenu.classList.remove("profileMenu--active");
      profileMenu.setAttribute("aria-hidden", "true");
    }
    resetBuyPointsWizard();

        buyPointsView.style.display = "flex";
    buyPointsView.setAttribute("aria-hidden", "false");
    fetchBcvRate();
  }

  function hideBuyPointsView() {
    buyPointsView.style.display = "none";
    buyPointsView.setAttribute("aria-hidden", "true");
  }

  async function fetchBcvRate() {
    try {
      bcvRateDisplay.textContent = "Cargando...";
      const response = await fetch("/api/bcv-rate");
      const data = await response.json();
      if (data && data.rate) {
        currentBcvRate = parseFloat(data.rate);
        bcvRateDisplay.textContent = currentBcvRate.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        bcvRateDisplay.textContent = "Error";
      }
    } catch (err) {
      console.error("Error fetching BCV rate:", err);
      bcvRateDisplay.textContent = "Error";
    }
  }
  
  function handleInputPts() {
    if (!currentBcvRate) return;
    const pts = parseFloat(buyPointsInputPts.value);
    if (isNaN(pts) || pts <= 0) {
      buyPointsInputUsd.value = "";
      buyPointsInputBs.value = "";
      validateBuyPointsStep1();
      return;
    }
    const usd = pts / PTS_PER_USD;
    const bs = usd * currentBcvRate;
    
    buyPointsInputUsd.value = usd.toFixed(2);
    buyPointsInputBs.value = bs.toFixed(2);
    
    currentTotalPts = Math.round(pts);
    currentTotalBs = bs;
    validateBuyPointsStep1();
  }

  function handleInputUsd() {
    if (!currentBcvRate) return;
    const usd = parseFloat(buyPointsInputUsd.value);
    if (isNaN(usd) || usd <= 0) {
      buyPointsInputPts.value = "";
      buyPointsInputBs.value = "";
      validateBuyPointsStep1();
      return;
    }
    const pts = Math.round(usd * PTS_PER_USD);
    const bs = usd * currentBcvRate;
    
    buyPointsInputPts.value = pts;
    buyPointsInputBs.value = bs.toFixed(2);
    
    currentTotalPts = pts;
    currentTotalBs = bs;
    validateBuyPointsStep1();
  }

  function handleInputBs() {
    if (!currentBcvRate) return;
    const bs = parseFloat(buyPointsInputBs.value);
    if (isNaN(bs) || bs <= 0) {
      buyPointsInputPts.value = "";
      buyPointsInputUsd.value = "";
      validateBuyPointsStep1();
      return;
    }
    const usd = bs / currentBcvRate;
    const pts = Math.round(usd * PTS_PER_USD);
    
    buyPointsInputUsd.value = usd.toFixed(2);
    buyPointsInputPts.value = pts;
    
    currentTotalPts = pts;
    currentTotalBs = bs;
    validateBuyPointsStep1();
  }

  function validateBuyPointsStep1() {
    const term1 = document.getElementById("bpvTerm1")?.checked;
    const term2 = document.getElementById("bpvTerm2")?.checked;
    const pts = parseFloat(buyPointsInputPts.value);

    if (term1 && term2 && !isNaN(pts) && pts > 0) {
      buyPointsBtnNext1.disabled = false;
    } else {
      buyPointsBtnNext1.disabled = true;
    }
  }

  function validateBuyPointsStep3() {
    const bank = buyPointsOriginBank.value.trim();
    const phoneNum = buyPointsOriginPhoneNum.value.trim();
    const idNum = buyPointsOriginId.value.trim();
    const ref = buyPointsRef.value.trim();
    const dateVal = buyPointsDate ? buyPointsDate.value : "";
    
    if (bank.length > 2 && phoneNum.length === 7 && idNum.length > 5 && ref.length >= 4 && dateVal !== "") {
      buyPointsSubmitBtn.disabled = false;
    } else {
      buyPointsSubmitBtn.disabled = true;
    }
  }

  if (profileBuyPointsBtn && buyPointsView) {
    profileBuyPointsBtn.addEventListener("click", showBuyPointsView);
    buyPointsBackBtn.addEventListener("click", hideBuyPointsView);
    buyPointsBtnDone.addEventListener("click", hideBuyPointsView);

    if (buyPointsInputPts) buyPointsInputPts.addEventListener("input", handleInputPts);
    if (buyPointsInputUsd) buyPointsInputUsd.addEventListener("input", handleInputUsd);
    if (buyPointsInputBs) buyPointsInputBs.addEventListener("input", handleInputBs);
    
    const bpvDot1 = document.getElementById("bpvDot1");
    const bpvDot2 = document.getElementById("bpvDot2");
    const bpvDot3 = document.getElementById("bpvDot3");

    buyPointsBtnNext1.addEventListener("click", () => {
      if (currentTotalPts <= 0) return;
      buyPointsDisplayTotalBs.textContent = currentTotalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      step1.style.display = "none";
      step2.style.display = "flex";
      if (bpvDot2) bpvDot2.classList.add("bpv__step-dot--active");
    });

    buyPointsBtnNext2.addEventListener("click", async () => {
      const originalText = buyPointsBtnNext2.textContent;
      buyPointsBtnNext2.disabled = true;
      buyPointsBtnNext2.textContent = "Buscando transferencia...";

      try {
        let clientToken = "";
        try {
          const url = new URL(window.location.href);
          clientToken = (url.searchParams.get("token") || url.searchParams.get("t") || "").trim();
          if (!clientToken && url.pathname.startsWith("/card/")) {
            clientToken = decodeURIComponent(url.pathname.slice("/card/".length)).trim();
          }
        } catch(e) {}

        const totalBsText = currentTotalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        const res = await fetch("/api/buy-points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardNumber: clientToken,
            amount: currentTotalPts,
            totalBs: totalBsText,
            autoMatchOnly: true
          })
        });

        const data = await res.json();
        
        if (res.ok && data.success && data.status === 'approved') {
          step2.style.display = "none";
          
          const successTitle = stepSuccess.querySelector(".bpv__success-title");
          const successText = stepSuccess.querySelector(".bpv__success-text");
          if (successTitle && successText) {
            successTitle.textContent = "¡Pago Verificado!";
            successText.textContent = "Tu transferencia fue conciliada automáticamente. Los puntos han sido acreditados.";
          }
          stepSuccess.style.display = "block";
          
          buyPointsBtnNext2.disabled = false;
          buyPointsBtnNext2.textContent = originalText;
          return;
        }
      } catch (e) {
        console.error("AutoMatch error:", e);
      }

      // Si falla, se muestra el formulario del paso 3 sin decir nada, de forma silenciosa
      buyPointsBtnNext2.disabled = false;
      buyPointsBtnNext2.textContent = originalText;
      step2.style.display = "none";
      step3.style.display = "flex";
      if (bpvDot3) bpvDot3.classList.add("bpv__step-dot--active");
    });

    if (buyPointsOriginBank) buyPointsOriginBank.addEventListener("change", validateBuyPointsStep3);
    if (buyPointsOriginPhoneNum) buyPointsOriginPhoneNum.addEventListener("input", validateBuyPointsStep3);
    if (buyPointsOriginId) buyPointsOriginId.addEventListener("input", validateBuyPointsStep3);
    if (buyPointsRef) buyPointsRef.addEventListener("input", validateBuyPointsStep3);
    if (buyPointsDate) buyPointsDate.addEventListener("change", validateBuyPointsStep3);

    const term1 = document.getElementById("bpvTerm1");
    const term2 = document.getElementById("bpvTerm2");
    if (term1) term1.addEventListener("change", validateBuyPointsStep1);
    if (term2) term2.addEventListener("change", validateBuyPointsStep1);

    buyPointsSubmitBtn.addEventListener("click", async () => {
      const amount = currentTotalPts;
      const bank = buyPointsOriginBank.value.trim();
      const phoneNum = buyPointsOriginPhoneNum.value.trim();
      const phoneCode = buyPointsOriginPhoneCode.value;
      const phone = phoneCode + phoneNum;
      const idNum = buyPointsOriginId.value.trim();
      const ref = buyPointsRef.value.trim();
      const dateVal = buyPointsDate ? buyPointsDate.value : "";
      const totalBsText = currentTotalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      if (isNaN(amount) || amount <= 0 || bank.length <= 2 || phoneNum.length !== 7 || idNum.length <= 5 || ref.length < 4 || dateVal === "") return;
      
      buyPointsSubmitBtn.disabled = true;
      buyPointsSubmitBtn.textContent = "Verificando pago en el banco...";

      try {
        const nameEl = document.getElementById("clientName");
        const clientName = nameEl ? nameEl.textContent : "Desconocido";
        
        let clientToken = "";
        try {
          const url = new URL(window.location.href);
          clientToken = (url.searchParams.get("token") || url.searchParams.get("t") || "").trim();
          if (!clientToken && url.pathname.startsWith("/card/")) {
            clientToken = decodeURIComponent(url.pathname.slice("/card/".length)).trim();
          }
        } catch(e) {}

        const res = await fetch("/api/buy-points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardNumber: clientToken,
            clientName: clientName,
            amount,
            totalBs: totalBsText,
            originBank: bank,
            originPhone: phone,
            originId: idNum,
            reference: ref,
            date: dateVal,
            rate: currentBcvRate
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al notificar");

        step3.style.display = "none";
        
        // Update success message based on status
        const successTitle = stepSuccess.querySelector(".bpv__success-title");
        const successText = stepSuccess.querySelector(".bpv__success-text");
        
        if (successTitle && successText) {
          if (data.status === 'approved') {
            successTitle.textContent = "¡Pago Verificado!";
            successText.textContent = "Tu transferencia fue conciliada automáticamente. Los puntos han sido acreditados.";
          } else {
            successTitle.textContent = "¡Pago Reportado!";
            successText.textContent = "Estamos esperando confirmación del banco. Te notificaremos pronto.";
          }
        }

        stepSuccess.style.display = "block";
      } catch (err) {
        console.error(err);
        alert("Ocurrió un error al notificar el pago. Por favor, intenta de nuevo.");
        buyPointsSubmitBtn.disabled = false;
        buyPointsSubmitBtn.textContent = "Notificar Pago";
      }
    });

    // Lógica para botones de copiar (individuales)
    const copyBtns = document.querySelectorAll(".bpv__copy-btn");
    copyBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-copy");
        const el = document.getElementById(targetId);
        if (el) {
          navigator.clipboard.writeText(el.textContent.trim()).then(() => {
            const original = btn.innerHTML;
            btn.textContent = "✓ Copiado";
            btn.style.background = "rgba(16, 185, 129, 0.25)";
            setTimeout(() => {
              btn.innerHTML = original;
              btn.style.background = "";
            }, 2000);
          });
        }
      });
    });

    // Copiar todo
    const copyAllBtn = document.getElementById("copyAllPmBtn");
    if (copyAllBtn) {
      copyAllBtn.addEventListener("click", () => {
        const bank = document.getElementById("pmBank")?.textContent.trim() || "";
        const phone = document.getElementById("pmPhone")?.textContent.trim() || "";
        const id = document.getElementById("pmId")?.textContent.trim() || "";
        const montoStr = currentTotalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const text = `Banco: ${bank}\nTeléfono: ${phone}\nCédula/RIF: ${id}\nMonto: ${montoStr} Bs`;
        navigator.clipboard.writeText(text).then(() => {
          const original = copyAllBtn.innerHTML;
          copyAllBtn.textContent = "✓ ¡Todo copiado!";
          copyAllBtn.style.background = "rgba(16, 185, 129, 0.3)";
          setTimeout(() => {
            copyAllBtn.innerHTML = original;
            copyAllBtn.style.background = "";
          }, 2500);
        });
      });
    }
  }

});
(() => {
  const profileTransferBtn = document.getElementById("profileTransferBtn");
  const modal = document.getElementById("transferModal");
  const closeBtn = document.getElementById("transferCloseBtn");
  const backdrop = document.getElementById("transferModalBackdrop");
  
  if (!profileTransferBtn || !modal) return;

  const steps = {
    1: document.getElementById("transferStep1"),
    2: document.getElementById("transferStep2"),
    3: document.getElementById("transferStep3"),
    4: document.getElementById("transferStep4")
  };

  const state = {
    email: '',
    name: '',
    amount: 0,
    otp: ''
  };

  const getToken = () => {
    let token = '';
    const path = window.location.pathname || "";
    if (path.startsWith("/card/")) {
      token = decodeURIComponent(path.slice("/card/".length)).trim();
    }
    if (!token) {
      const url = new URL(window.location.href);
      token = (url.searchParams.get("token") || url.searchParams.get("t") || "").trim();
    }
    return token;
  };

  const showStep = (stepNumber) => {
    Object.values(steps).forEach(el => {
      if(el) el.style.display = 'none';
    });
    if(steps[stepNumber]) steps[stepNumber].style.display = 'block';
  };

  const openModal = () => {
    // Close profile menu if open
    const menu = document.getElementById("profileMenu");
    if (menu) {
      menu.classList.remove("profileMenu--active");
      menu.setAttribute("aria-hidden", "true");
      const profileTrigger = document.getElementById("profileButton");
      if (profileTrigger) profileTrigger.setAttribute("aria-expanded", "false");
    }

    // Reset state
    state.email = '';
    state.name = '';
    state.amount = 0;
    state.otp = '';
    
    document.getElementById("transferEmailInput").value = '';
    document.getElementById("transferAmountInput").value = '';
    document.getElementById("transferOtpInput").value = '';

    showStep(1);
    
    modal.style.display = 'flex';
    // Small delay to allow display flex to apply before opacity transition
    setTimeout(() => {
      modal.classList.add("transferModal--active");
      modal.setAttribute("aria-hidden", "false");
    }, 10);
  };

  const closeModal = () => {
    modal.classList.remove("transferModal--active");
    modal.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  };

  profileTransferBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);
  
  document.getElementById("transferDoneBtn")?.addEventListener("click", closeModal);

  // --- API Calls ---

  const showLoading = (btnId) => {
    const btn = document.getElementById(btnId);
    if(btn) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Cargando...';
      btn.disabled = true;
    }
  };

  const hideLoading = (btnId) => {
    const btn = document.getElementById(btnId);
    if(btn) {
      btn.textContent = btn.dataset.originalText;
      btn.disabled = false;
    }
  };

  // Step 1: Verify Email
  document.getElementById("transferVerifyEmailBtn")?.addEventListener("click", async () => {
    const emailInput = document.getElementById("transferEmailInput").value.trim();
    if(!emailInput) {
      alert("Por favor ingresa un correo.");
      return;
    }

    showLoading("transferVerifyEmailBtn");
    try {
      const res = await fetch('/api/client/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_email', email: emailInput })
      });
      const data = await res.json();
      
      if(!res.ok) {
        alert(data.error || 'Error al verificar el correo.');
        hideLoading("transferVerifyEmailBtn");
        return;
      }

      state.email = emailInput;
      state.name = data.name;
      
      document.getElementById("transferRecipientName").textContent = state.name;
      document.getElementById("transferAvatarInitials").textContent = state.name ? state.name.substring(0,2).toUpperCase() : '?';
      showStep(2);

    } catch (err) {
      alert('Error de conexión.');
    }
    hideLoading("transferVerifyEmailBtn");
  });

  // Step 2: Request OTP
  document.getElementById("transferRequestBtn")?.addEventListener("click", async () => {
    const amountInput = document.getElementById("transferAmountInput").value;
    const amount = Number(amountInput);

    if(!amount || amount < 1) {
      alert("Por favor ingresa un monto válido (Mínimo 1).");
      return;
    }

    const token = getToken();

    showLoading("transferRequestBtn");
    try {
      const res = await fetch('/api/client/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_otp', token, email: state.email, amount })
      });
      const data = await res.json();
      
      if(!res.ok) {
        alert(data.error || 'Error al solicitar transferencia.');
        hideLoading("transferRequestBtn");
        return;
      }

      state.amount = amount;
      showStep(3);

    } catch (err) {
      alert('Error de conexión.');
    }
    hideLoading("transferRequestBtn");
  });

  document.getElementById("transferBackTo1Btn")?.addEventListener("click", () => showStep(1));

  // Step 3: Confirm Transfer
  document.getElementById("transferConfirmBtn")?.addEventListener("click", async () => {
    const otpInput = document.getElementById("transferOtpInput").value.trim();
    if(!otpInput || otpInput.length !== 6) {
      alert("Por favor ingresa el código de 6 dígitos.");
      return;
    }

    const token = getToken();

    showLoading("transferConfirmBtn");
    try {
      const res = await fetch('/api/client/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', token, otp: otpInput })
      });
      const data = await res.json();
      
      if(!res.ok) {
        alert(data.error || 'Código incorrecto o error al confirmar.');
        hideLoading("transferConfirmBtn");
        return;
      }

      if (data.reference) {
        const refEl = document.getElementById("transferReferenceNumber");
        if (refEl) refEl.textContent = data.reference;
      }
      
      showStep(4);
      
      // Update global balance and refresh UI if possible
      setTimeout(() => {
        if(window.loadClientData && token) {
           window.loadClientData(token);
        }
      }, 1500);

    } catch (err) {
      alert('Error de conexión.');
    }
    hideLoading("transferConfirmBtn");
  });

  document.getElementById("transferBackTo2Btn")?.addEventListener("click", () => showStep(2));
})();


  (() => {
    const btn = document.getElementById("profileUpdatePhoneBtn");
    const modal = document.getElementById("phoneModal");
    const saveBtn = document.getElementById("phoneModalSaveBtn");
    const cancelBtn = document.getElementById("phoneModalCancelBtn");
    const input = document.getElementById("phoneModalInput");
    if (!btn || !modal) return;
    btn.addEventListener("click", () => {
      const menu = document.getElementById("profileMenu");
      if (menu) { menu.classList.remove("profileMenu--active"); menu.setAttribute("aria-hidden", "true"); }
      if (cancelBtn) cancelBtn.style.display = "block";
      modal.classList.add("firstOpenModal--active");
      modal.setAttribute("aria-hidden", "false");
    });
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        modal.classList.remove("firstOpenModal--active");
        modal.setAttribute("aria-hidden", "true");
        if (cancelBtn) cancelBtn.style.display = "none";
      });
    }
    if (saveBtn && input) {
      saveBtn.onclick = async () => {
        const tel = input.value.trim();
        if (tel.length < 10) return alert("Ingresa un número válido.");
        if (!confirm("Confirma tu número: " + tel)) return;
        saveBtn.disabled = true; saveBtn.textContent = "Guardando...";
        try {
          let token = ""; try { const u = new URL(window.location.href); token = (u.searchParams.get("token") || u.searchParams.get("t") || "").trim(); if (!token && u.pathname.startsWith("/card/")) token = decodeURIComponent(u.pathname.slice(6)).trim(); } catch(e){}
          const res = await fetch("/api/client/update-phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token, telefono: tel }) });
          if (!res.ok) throw new Error("Error");
          modal.classList.remove("firstOpenModal--active");
          modal.setAttribute("aria-hidden", "true");
          if (cancelBtn) cancelBtn.style.display = "none";
          saveBtn.disabled = false; saveBtn.textContent = "Guardar Teléfono";
          alert("Teléfono actualizado.");
          if (typeof runFirstOpenFlow === "function") setTimeout(() => runFirstOpenFlow(), 300);
        } catch (err) {
          alert("Error al guardar.");
          saveBtn.disabled = false; saveBtn.textContent = "Guardar Teléfono";
        }
      };
    }
  })();
