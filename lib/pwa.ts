'use client'

export const forceReloadPwa = async () => {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) {
    window.location.reload()
    return
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  } catch (error) {
    console.warn('Service worker unregister failed:', error)
  }

  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
    } catch (error) {
      console.warn('Cache cleanup failed:', error)
    }
  }

  window.location.reload()
}

