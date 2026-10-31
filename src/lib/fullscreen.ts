/**
 * cross-browser & mobile-safe fullscreen helper
 */
export async function requestFullscreenSafe(targetElement?: Element | null): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const doc = document as any;
  const isFs = !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );

  if (isFs) return true;

  const el = (targetElement || document.documentElement) as any;

  // 1. Standard requestFullscreen
  if (el.requestFullscreen) {
    try {
      await el.requestFullscreen();
      return true;
    } catch (e) {
      console.warn('[Fullscreen] standard requestFullscreen failed:', e);
    }
  }

  // 2. WebKit (Safari, iOS Safari, Chrome Mobile)
  if (el.webkitRequestFullscreen) {
    try {
      await el.webkitRequestFullscreen();
      return true;
    } catch (e) {
      console.warn('[Fullscreen] webkitRequestFullscreen failed:', e);
    }
  }

  // 3. Firefox
  if (el.mozRequestFullScreen) {
    try {
      await el.mozRequestFullScreen();
      return true;
    } catch (e) {
      console.warn('[Fullscreen] mozRequestFullScreen failed:', e);
    }
  }

  // 4. IE/Edge legacy
  if (el.msRequestFullscreen) {
    try {
      await el.msRequestFullscreen();
      return true;
    } catch (e) {
      console.warn('[Fullscreen] msRequestFullscreen failed:', e);
    }
  }

  // 5. iOS Safari specific video element fullscreen fallback (if target is HTMLVideoElement)
  if (el && typeof el.webkitEnterFullscreen === 'function') {
    try {
      el.webkitEnterFullscreen();
      return true;
    } catch (e) {
      console.warn('[Fullscreen] webkitEnterFullscreen failed:', e);
    }
  }

  return false;
}

export async function exitFullscreenSafe(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const doc = document as any;
  const isFs = !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );

  if (!isFs) return true;

  if (doc.exitFullscreen) {
    try {
      await doc.exitFullscreen();
      return true;
    } catch (e) {
      console.warn('[Fullscreen] exitFullscreen failed:', e);
    }
  } else if (doc.webkitExitFullscreen) {
    try {
      await doc.webkitExitFullscreen();
      return true;
    } catch (e) {
      console.warn('[Fullscreen] webkitExitFullscreen failed:', e);
    }
  } else if (doc.mozCancelFullScreen) {
    try {
      await doc.mozCancelFullScreen();
      return true;
    } catch (e) {
      console.warn('[Fullscreen] mozCancelFullScreen failed:', e);
    }
  } else if (doc.msExitFullscreen) {
    try {
      await doc.msExitFullscreen();
      return true;
    } catch (e) {
      console.warn('[Fullscreen] msExitFullscreen failed:', e);
    }
  }

  return false;
}

export function isFullscreenActive(): boolean {
  if (typeof window === 'undefined') return false;
  const doc = document as any;
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}
