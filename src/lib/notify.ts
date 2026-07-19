"use client";

// Local (not push) notifications as a backup alert for when she's stepped
// away from the screen mid-cook. Free — uses the already-registered service
// worker's showNotification, no push server/VAPID keys needed.

export async function requestNotifyPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // ignore
    }
  }
}

export async function notifyTimerDone(label: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const title = `${label} timer done`;
  const options = { body: "Tap to head back to Subarashii.", tag: `timer-${label}` };

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch {
    // Non-fatal — chime/vibration/on-screen flash still carry the alert.
  }
}
