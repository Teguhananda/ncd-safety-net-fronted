import { useEffect, useState } from "react";

/**
 * usePortalPwa.js — VERSI DISEDERHANAKAN. Sebelumnya hook ini juga
 * mengganti <link rel="manifest"> lewat JavaScript — ternyata itu TIDAK
 * diandalkan Safari iOS saat "Add to Home Screen" (Safari tetap memakai
 * manifest yang tertanam statis di HTML saat load), jadi bagian itu
 * dihapus. Manifest & meta tag iOS sekarang tertanam statis langsung di
 * portal.html (lihat file itu) — jauh lebih andal.
 *
 * Hook ini sekarang HANYA mengurus: (1) registrasi service worker offline,
 * (2) menangkap event install Android/Chrome untuk tombol custom,
 * (3) deteksi status standalone/iOS untuk teks bantuan yang tepat.
 */
export function usePortalPwa() {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
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
