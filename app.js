(function () {
  "use strict";

  const SUPPORT_EMAIL = "archonic88@gmail.com";
  const STORAGE_LANG_KEY = "archonic_lang";
  const STORAGE_THEME_KEY = "archonic_theme";

  let currentLang = "en";
  let currentTheme = "dark";
  let currentFaqCategory = "all";
  let latestTicketText = "";

  function getInitialLang() {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get("lang");
    if (urlLang === "vi" || urlLang === "en") {
      return urlLang;
    }
    const saved = localStorage.getItem(STORAGE_LANG_KEY);
    if (saved === "vi" || saved === "en") {
      return saved;
    }
    return "en";
  }

  function getInitialTheme() {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
    return "dark";
  }

  function applyLanguage(lang) {
    currentLang = lang === "vi" ? "vi" : "en";
    document.documentElement.setAttribute("data-lang", currentLang);
    document.documentElement.setAttribute("lang", currentLang);
    localStorage.setItem(STORAGE_LANG_KEY, currentLang);

    document.querySelectorAll("[data-en][data-vi]").forEach((el) => {
      const text = currentLang === "vi" ? el.getAttribute("data-vi") : el.getAttribute("data-en");
      if (text !== null) {
        el.textContent = text;
      }
    });

    document.querySelectorAll("[data-placeholder-en][data-placeholder-vi]").forEach((el) => {
      const placeholder =
        currentLang === "vi"
          ? el.getAttribute("data-placeholder-vi")
          : el.getAttribute("data-placeholder-en");
      if (placeholder !== null) {
        el.setAttribute("placeholder", placeholder);
      }
    });

    document.querySelectorAll(".lang-btn[data-set-lang]").forEach((btn) => {
      const isMatch = btn.getAttribute("data-set-lang") === currentLang;
      btn.classList.toggle("active", isMatch);
      btn.setAttribute("aria-pressed", String(isMatch));
    });

    updateThemeButtonLabel();
  }

  function applyTheme(theme) {
    currentTheme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);
    localStorage.setItem(STORAGE_THEME_KEY, currentTheme);
    updateThemeButtonLabel();
  }

  function updateThemeButtonLabel() {
    const themeBtn = document.getElementById("theme-toggle-btn");
    if (!themeBtn) return;

    if (currentTheme === "dark") {
      themeBtn.innerHTML =
        currentLang === "vi"
          ? '<span aria-hidden="true">☀️</span> <span>Giao diện Sáng</span>'
          : '<span aria-hidden="true">☀️</span> <span>Light Mode</span>';
    } else {
      themeBtn.innerHTML =
        currentLang === "vi"
          ? '<span aria-hidden="true">🌙</span> <span>Giao diện Tối</span>'
          : '<span aria-hidden="true">🌙</span> <span>Dark Mode</span>';
    }
  }

  function showToast(messageEn, messageVi) {
    const toast = document.getElementById("site-toast");
    if (!toast) return;
    toast.textContent = currentLang === "vi" ? messageVi : messageEn;
    toast.classList.add("show");
    clearTimeout(window.__archonicToastTimer);
    window.__archonicToastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  function copyTextToClipboard(text, messageEn, messageVi) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => showToast(messageEn, messageVi))
        .catch(() => fallbackCopy(text, messageEn, messageVi));
    } else {
      fallbackCopy(text, messageEn, messageVi);
    }
  }

  function fallbackCopy(text, messageEn, messageVi) {
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    try {
      document.execCommand("copy");
      showToast(messageEn, messageVi);
    } catch (_) {
      // Ignore fallback error
    }
    document.body.removeChild(temp);
  }

  function filterFaqs() {
    const searchInput = document.getElementById("faq-search-input");
    const faqItems = document.querySelectorAll(".faq-item");
    const emptyState = document.getElementById("faq-empty-state");
    if (!faqItems.length) return;

    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    let visibleCount = 0;

    faqItems.forEach((item) => {
      const category = item.getAttribute("data-category") || "general";
      const categoryMatches =
        currentFaqCategory === "all" || category === currentFaqCategory;
      const textContent = item.textContent.toLowerCase();
      const queryMatches = !query || textContent.includes(query);

      if (categoryMatches && queryMatches) {
        item.style.display = "";
        visibleCount += 1;
      } else {
        item.style.display = "none";
      }
    });

    if (emptyState) {
      emptyState.style.display = visibleCount === 0 ? "block" : "none";
    }
  }

  function initFaqControls() {
    const searchInput = document.getElementById("faq-search-input");
    const filterButtons = document.querySelectorAll(".filter-pill[data-filter]");

    if (searchInput) {
      searchInput.addEventListener("input", filterFaqs);
    }

    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        currentFaqCategory = btn.getAttribute("data-filter") || "all";
        filterButtons.forEach((b) => b.classList.toggle("active", b === btn));
        filterFaqs();
      });
    });
  }

  function initSupportForm() {
    const form = document.getElementById("support-form");
    const modal = document.getElementById("ticket-modal");
    const previewEl = document.getElementById("ticket-preview-content");
    const mailtoBtn = document.getElementById("mailto-trigger-btn");
    const copyTicketBtn = document.getElementById("copy-ticket-btn");
    const closeModalBtn = document.getElementById("close-modal-btn");

    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const appName = (document.getElementById("field-app")?.value || "").trim() || "Archonic iOS App / Game";
      const categorySelect = document.getElementById("field-category");
      const categoryOption = categorySelect?.options[categorySelect.selectedIndex];
      const categoryLabel =
        (currentLang === "vi"
          ? categoryOption?.getAttribute("data-vi")
          : categoryOption?.getAttribute("data-en")) ||
        categorySelect?.value ||
        "General Support";
      const userEmail = (document.getElementById("field-email")?.value || "").trim();
      const deviceInfo = (document.getElementById("field-device")?.value || "").trim() || "iPhone / iPad (iOS)";
      const message = (document.getElementById("field-message")?.value || "").trim();

      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const ticketId = `ARC-${new Date().getFullYear()}-${randomCode}`;
      const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

      const subject = `[${ticketId}] ${categoryLabel} - ${appName}`;
      const bodyLines = [
        `Ticket ID: ${ticketId}`,
        `Submitted: ${timestamp}`,
        `App / Game: ${appName}`,
        `Category: ${categoryLabel}`,
        `User Email: ${userEmail}`,
        `Device & iOS Version: ${deviceInfo}`,
        `----------------------------------------`,
        `Message / Details:`,
        message,
        `----------------------------------------`
      ];

      latestTicketText = bodyLines.join("\n");

      if (previewEl) {
        previewEl.textContent = latestTicketText;
      }

      const mailtoUrl =
        `mailto:${SUPPORT_EMAIL}?subject=` +
        encodeURIComponent(subject) +
        `&body=` +
        encodeURIComponent(latestTicketText);

      if (mailtoBtn) {
        mailtoBtn.setAttribute("href", mailtoUrl);
      }

      if (modal) {
        modal.classList.add("open");
      }

      window.location.href = mailtoUrl;
    });

    if (copyTicketBtn) {
      copyTicketBtn.addEventListener("click", () => {
        if (!latestTicketText) return;
        copyTextToClipboard(
          latestTicketText,
          "Support ticket details copied to clipboard!",
          "Đã sao chép toàn bộ nội dung phiếu hỗ trợ!"
        );
      });
    }

    if (closeModalBtn && modal) {
      closeModalBtn.addEventListener("click", () => {
        modal.classList.remove("open");
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.remove("open");
        }
      });
    }
  }

  function initGlobalListeners() {
    document.querySelectorAll(".lang-btn[data-set-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetLang = btn.getAttribute("data-set-lang");
        applyLanguage(targetLang);
      });
    });

    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        applyTheme(currentTheme === "dark" ? "light" : "dark");
      });
    }

    document.querySelectorAll("[data-copy-email]").forEach((btn) => {
      btn.addEventListener("click", () => {
        copyTextToClipboard(
          SUPPORT_EMAIL,
          `Copied ${SUPPORT_EMAIL} to clipboard!`,
          `Đã sao chép địa chỉ ${SUPPORT_EMAIL}!`
        );
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    currentTheme = getInitialTheme();
    currentLang = getInitialLang();
    applyTheme(currentTheme);
    applyLanguage(currentLang);
    initGlobalListeners();
    initFaqControls();
    initSupportForm();
  });
})();
