// ============================================================
// Zamzam PWA — push subscription client (NO dependencies, raw Push API)
// Add this file (or inline it) into the Zamzam app. Works on
// iOS 16.4+ Home Screen PWAs, Android Chrome, desktop browsers.
// ============================================================

const PUSH_SERVER = "https://zamzam-push.zamzam-push.workers.dev";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// True only inside the installed Home Screen app on iOS.
// On iOS, push is impossible in a normal Safari tab — show the
// "فعّلي الإشعارات" button only when this is true (or when not iOS).
function isInstalledPwa() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function pushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// MUST be called directly from a tap/click handler.
// iOS WebKit rejects the permission prompt without a user gesture.
// Do NOT call Notification.requestPermission() first — subscribe()
// shows the prompt itself.
export async function enablePushNotifications() {
  if (!pushSupported()) return { status: "unsupported" };

  const reg = await navigator.serviceWorker.ready;
  const res = await fetch(`${PUSH_SERVER}/vapid-public-key`);
  const { publicKey } = await res.json();

  // Throws NotAllowedError if the user declines — catch and show a soft message.
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await fetch(`${PUSH_SERVER}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  return { status: "subscribed" };
}

// Call on EVERY app launch (after SW registration).
// iOS can silently delete subscriptions (silent-push penalty, data
// removal) and never fires pushsubscriptionchange, so re-upload the
// current subscription each launch to keep the server in sync.
export async function resyncPushSubscription() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch(`${PUSH_SERVER}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
  }
}

export async function disablePushNotifications() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch(`${PUSH_SERVER}/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  }
}

window.ZamzamPush = {
  isInstalledPwa: isInstalledPwa,
  pushSupported: pushSupported,
  enable: enablePushNotifications,
  resync: resyncPushSubscription,
  disable: disablePushNotifications
};
/* iOS يمكنه حذف الاشتراك بصمت — إعادة المزامنة عند كل تشغيل */
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(function(){ resyncPushSubscription().catch(function(){}); }, 1500);
} else {
  addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ resyncPushSubscription().catch(function(){}); }, 1500); });
}
