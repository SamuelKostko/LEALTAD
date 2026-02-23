/* PWA: SW register */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Intentionally silent: avoid noisy UI for a design-only PWA.
    });
  });
}

/* PWA install prompt capture (Chrome/Edge/Android/desktop) */
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

/* CTA glow on tap/click (works reliably on iOS) */
const qrButton = document.getElementById("qrButton");
if (qrButton) {
  const pulse = () => {
    qrButton.classList.remove("is-glowing");
    // Force reflow so repeated taps retrigger the transition.
    void qrButton.offsetWidth;
    qrButton.classList.add("is-glowing");
    window.setTimeout(() => qrButton.classList.remove("is-glowing"), 320);
  };

  qrButton.addEventListener("click", pulse);
  qrButton.addEventListener("touchend", pulse, { passive: true });
}

/* Client card details reveal (tap card to show name/id/balance) */
(() => {
  const card = document.getElementById("clientCard");
  if (!card) return;

  const details = document.getElementById("cardDetails");
  const pointsEl = document.getElementById("points");
  const balanceEl = document.getElementById("clientBalance");
  const nameEl = document.getElementById("clientName");
  const idEl = document.getElementById("clientId");

  const CLIENT = {
    name: "SAMUEL KOSTKO",
    id: "V-30547862"
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
      }, 5000);
    }
  };

  const syncBalance = () => {
    if (!balanceEl) return;
    const raw = pointsEl?.textContent ?? "0";
    balanceEl.textContent = raw.replace(/\s+/g, "").trim() || "0";
  };

  if (nameEl) nameEl.textContent = CLIENT.name;
  if (idEl) idEl.textContent = CLIENT.id;

  syncBalance();

  const toggle = () => {
    syncBalance();
    const expanded = card.getAttribute("aria-expanded") === "true";
    setExpanded(!expanded);
  };

  // Prevent long-press context menu (e.g., save image) and drag behaviors.
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
    // Fallback
    card.addEventListener("click", toggle);
  }
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
})();

/* Profile menu modal + install recommendation */
(() => {
  const profileButton = document.getElementById("profileButton");
  const menu = document.getElementById("profileMenu");
  const closeBtn = document.getElementById("profileClose");
  const installBtn = document.getElementById("installPwa");
  const hint = document.getElementById("installHint");

  if (!profileButton || !menu) return;

  const isStandalone = () => {
    // iOS Safari uses navigator.standalone
    const iosStandalone = typeof navigator.standalone === "boolean" && navigator.standalone;
    const displayModeStandalone =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    return Boolean(iosStandalone || displayModeStandalone);
  };

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

  const INSTALL_NUDGE_KEY = "wallet.installNudgeSeen";
  const hasSeenInstallNudge = () => {
    try {
      return localStorage.getItem(INSTALL_NUDGE_KEY) === "1";
    } catch {
      return false;
    }
  };

  const markInstallNudgeSeen = () => {
    try {
      localStorage.setItem(INSTALL_NUDGE_KEY, "1");
    } catch {
      // Ignore.
    }
  };

  let lastFocus = null;

  const setOpen = (open) => {
    menu.classList.toggle("profileMenu--active", open);
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    profileButton.setAttribute("aria-expanded", open ? "true" : "false");

    if (open) {
      lastFocus = document.activeElement;
      if (hint) hint.textContent = "";
      window.setTimeout(() => (closeBtn ?? installBtn ?? profileButton).focus(), 0);
    } else {
      const target = lastFocus instanceof HTMLElement ? lastFocus : profileButton;
      window.setTimeout(() => target.focus(), 0);
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

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (isStandalone()) {
        if (hint) hint.textContent = "Ya estás usando la app instalada.";
        return;
      }

      if (deferredInstallPrompt) {
        try {
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
        } catch {
          // Ignore.
        } finally {
          deferredInstallPrompt = null;
          close();
        }
        return;
      }

      // No native prompt available (common on iOS).
      if (!hint) return;
      if (isIOS()) {
        hint.textContent = "En iPhone/iPad: Compartir → “Añadir a pantalla de inicio”.";
      } else {
        hint.textContent = "En Chrome/Edge: menú del navegador → “Instalar app”.";
      }
    });
  }

  // First-visit nudge: show only the native install confirmation when possible.
  // Browsers require a user gesture to show the install prompt.
  const onFirstUserGesture = async () => {
    if (hasSeenInstallNudge() || isStandalone()) return;
    markInstallNudgeSeen();

    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
      } catch {
        // Ignore.
      } finally {
        deferredInstallPrompt = null;
      }
      return;
    }

    // No native prompt available (common on iOS): show instructions in our modal.
    open();
    if (hint) {
      hint.textContent = isIOS()
        ? "En iPhone/iPad: Compartir → “Añadir a pantalla de inicio”."
        : "En Chrome/Edge: menú del navegador → “Instalar app”.";
    }
  };

  // Use pointerup so it feels like a normal click/tap.
  window.addEventListener(
    "pointerup",
    () => {
      onFirstUserGesture();
    },
    { once: true }
  );
})();

/* QR Scanner: open camera and decode QR codes */
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

  const startScanLoop = () => {
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
              resultEl.textContent = qr.data;
              hint.textContent = "Código detectado";
              // Cerrar automáticamente tras un breve momento
              window.setTimeout(closeScanner, 1200);
              return;
            }
          }
        } catch {
          // Ignorar errores de lectura de frame
        }
      }
    }

    if (scanning) {
      window.requestAnimationFrame(startScanLoop);
    }
  };

  const openScanner = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      window.alert("Tu navegador no permite usar la cámara para escanear.");
      return;
    }

    hint.textContent = "Apunta al código QR para escanear";
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
        window.alert("No se ha concedido permiso para usar la cámara.");
      } else {
        window.alert("No se ha podido iniciar la cámara.");
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

/* Activity refresh button */
(() => {
  const refreshBtn = document.getElementById("activityRefresh");
  if (!refreshBtn) return;
  refreshBtn.addEventListener("click", () => {
    window.location.reload();
  });
})();

/* Match system light/dark and keep theme-color in sync */
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
