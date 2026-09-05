import { useEffect, useState } from "react";

/**
 * usePortalPwa.js — dipanggil di PortalLogin.jsx & PortalHome.jsx SAJA.
 * Mengganti <link rel="manifest"> jadi manifest-portal.json (bukan
 * manifest.json staff) supaya kalau pasien "Tambah ke Layar Utama" dari
 * halaman /portal, ikon yang terbuat langsung mengarah ke /portal —
 * bukan ke halaman login staff.
 *
 * Tidak mengubah apapun di halaman staff — link manifest dikembalikan ke
 * default saat komponen ini unmount (misalnya kalau nanti ada navigasi
 * balik ke halaman staff dalam 1 tab yang sama).
 */
export function usePortalPwa() {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Ganti manifest ke versi portal
    let manifestLink = document.querySelector('link[rel="manifest"]');
    const originalHref = manifestLink ? manifestLink.getAttribute("href") : "/manifest.json";
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.setAttribute("href", "/manifest-portal.json");

    // 2. Meta tag khusus iOS (Safari tidak baca manifest.json untuk sebagian besar hal ini)
    const metaTags = [
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "My NCD Safety" },
      { name: "theme-color", content: "#0f6d5c" },
    ];
    const addedMetaTags = [];
    metaTags.forEach(({ name, content }) => {
      const tag = document.createElement("meta");
      tag.name = name;
      tag.content = content;
      document.head.appendChild(tag);
      addedMetaTags.push(tag);
    });

    let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
    const iconAlreadyExisted = !!appleTouchIcon;
    if (!appleTouchIcon) {
      appleTouchIcon = document.createElement("link");
      appleTouchIcon.rel = "apple-touch-icon";
      appleTouchIcon.href = "/logos/app-logo.png";
      document.head.appendChild(appleTouchIcon);
    }

    // 3. Daftarkan service worker (offline sederhana)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // 4. Deteksi apakah sudah terinstal (dibuka sebagai standalone app)
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true);

    // 5. Deteksi iOS (Safari tidak punya beforeinstallprompt sama sekali)
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    // 6. Tangkap event install Android/Chrome untuk tombol custom
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      manifestLink.setAttribute("href", originalHref);
      addedMetaTags.forEach((tag) => tag.remove());
      if (!iconAlreadyExisted) appleTouchIcon.remove();
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const promptInstall = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  };

  return { canInstall: !!installPromptEvent, promptInstall, isStandalone, isIOS };
}
