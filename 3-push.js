// ============================================================
// Zamzam PWA - push subscription + device registry client (NO dependencies)
// v2: anonymous deviceId + name-only registration (worker contract v34).
// Classic script exposing window.ZamzamPush (the app is not ES modules).
// ============================================================

const PUSH_SERVER = "https://zamzam-push.zamzam-push.workers.dev";
const APP_VERSION = "v36"; // bump with each release

// ---------- device identity ----------
function getDeviceId() {
  let id = localStorage.getItem("zamzam-device-id");
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(36).slice(2));
    localStorage.setItem("zamzam-device-id", id);
  }
  return id;
}

function getDeviceName() {
  return localStorage.getItem("zamzam-device-name") || null;
}

function setDeviceName(name) {
  if (name && name.trim()) localStorage.setItem("zamzam-device-name", name.trim());
  else localStorage.removeItem("zamzam-device-name");
}

// Call on EVERY app open. Server writes at most once per 12h per device.
// Returns {blocked:true} if Mariam blocked this device. Never blocks usage.
async function registerDevice() {
  try {
    const res = await fetch(`${PUSH_SERVER}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        name: getDeviceName(),
        appVersion: APP_VERSION,
      }),
    });
    return await res.json(); // {ok:true,blocked:false} or 403 {ok:false,blocked:true}
  } catch (e) {
    return { ok: false, offline: true };
  }
}

// Call after the person edits their name in Settings.
async function saveDeviceName(name) {
  setDeviceName(name);
  return registerDevice();
}

// ---------- push ----------
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

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

// MUST be called directly from a tap/click handler (iOS user-gesture rule).
async function enablePushNotifications() {
  if (!pushSupported()) return { status: "unsupported" };
  const reg = await navigator.serviceWorker.ready;
  const res = await fetch(`${PUSH_SERVER}/vapid-public-key`);
  const { publicKey } = await res.json();
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const r = await fetch(`${PUSH_SERVER}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...subscription.toJSON(), deviceId: getDeviceId() }),
  });
  if (r.status === 403) return { status: "blocked" };
  return { status: "subscribed" };
}

// Call on every app launch: iOS can silently drop subscriptions.
async function resyncPushSubscription() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch(`${PUSH_SERVER}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sub.toJSON(), deviceId: getDeviceId() }),
    });
  }
}

async function disablePushNotifications() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch(`${PUSH_SERVER}/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint, deviceId: getDeviceId() }),
    });
    await sub.unsubscribe();
  }
}

window.ZamzamPush = {
  getDeviceId, getDeviceName, setDeviceName, saveDeviceName, registerDevice,
  isInstalledPwa, pushSupported,
  enable: enablePushNotifications,
  resync: resyncPushSubscription,
  disable: disablePushNotifications
};

/* iOS can silently delete the subscription - resync on every launch */
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(function(){ resyncPushSubscription().catch(function(){}); }, 1500);
} else {
  addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ resyncPushSubscription().catch(function(){}); }, 1500); });
}
