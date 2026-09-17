import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://gbhjmaxutciiscuwsyxt.supabase.co";
const SUPABASE_KEY = "sb_publishable_LhvyalITqvFRCuyx2jRoSw_m8upcy5K";
const VAPID_PUBLIC_KEY = "BJsqSMgJPoL2wwCa1-lB5nonZ9Fi04TyeaLUAiJsigxBTMi9hSBp5k7F7g2zi-LELcP81bs6SDali5pmqFnBGlw";
const MESSAGE = "Take a few minutes to record the practices you have completed";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const b64ToBytes = value => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
const render = async () => {
  if (location.pathname !== "/settings") return;
  const heading = [...document.querySelectorAll("h1")].find(el => el.textContent?.trim() === "Settings");
  if (!heading || document.getElementById("project-holiness-reminders")) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: existing } = await supabase.from("holiness_reminders").select("enabled,channel,time_of_day,timezone").eq("user_id", user.id).maybeSingle();
  const tz = existing?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  const root = heading.closest("main") || document.body;
  const card = document.createElement("section");
  card.id = "project-holiness-reminders";
  card.className = "mt-6 rounded-3xl border border-[#DDD2C0] bg-white/70 p-7 shadow-sm md:p-9";
  card.innerHTML = `<div class="flex items-start gap-4"><div class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EBE3D0] text-[#8C6D23]">🔔</div><div><p class="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8C6D23]">Daily rhythm</p><h2 class="mt-2 font-serif text-2xl font-bold text-[#31231E]">Daily reminders</h2><p class="mt-2 max-w-2xl text-sm leading-6 text-[#827264]">Choose whether Project Holiness should remind you to record the practices you completed.</p></div></div><div class="mt-7 rounded-2xl border border-[#DDD2C0] bg-[#F5F1E9] p-5"><label class="flex cursor-pointer items-center justify-between gap-4"><span><span class="block text-sm font-bold text-[#31231E]">Send me a daily reminder</span><span class="mt-1 block text-xs text-[#827264]">You can turn this off at any time.</span></span><input id="ph-reminder-enabled" type="checkbox" class="h-5 w-5 accent-[#2D4C3C]"></label><div id="ph-reminder-options" class="mt-5 grid gap-4 sm:grid-cols-2"><label class="block"><span class="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#827264]">Time of day</span><input id="ph-reminder-time" type="time" class="w-full rounded-xl border border-[#DDD2C0] bg-white px-4 py-3 text-sm text-[#31231E]"></label><label class="block"><span class="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#827264]">Notification</span><select id="ph-reminder-channel" class="w-full rounded-xl border border-[#DDD2C0] bg-white px-4 py-3 text-sm text-[#31231E]"><option value="push">Push notification</option><option value="email">Email</option></select></label></div><p id="ph-reminder-note" class="mt-4 text-xs leading-5 text-[#827264]"></p><button id="ph-reminder-save" class="mt-5 inline-flex items-center justify-center rounded-xl bg-[#2D4C3C] px-5 py-3 text-sm font-semibold text-[#F5F1E9] shadow-md">Save reminder settings</button><p id="ph-reminder-status" class="mt-3 text-xs font-medium"></p></div>`;
  const placeholder = root.querySelector(".rounded-3xl.border-dashed");
  (placeholder?.parentElement || root).appendChild(card);
  const enabled = card.querySelector("#ph-reminder-enabled"), time = card.querySelector("#ph-reminder-time"), channel = card.querySelector("#ph-reminder-channel"), note = card.querySelector("#ph-reminder-note"), status = card.querySelector("#ph-reminder-status"), options = card.querySelector("#ph-reminder-options");
  enabled.checked = !!existing?.enabled; time.value = String(existing?.time_of_day || "20:00").slice(0,5); channel.value = existing?.channel || "push";
  const update = () => { options.style.opacity = enabled.checked ? "1" : ".55"; options.style.pointerEvents = enabled.checked ? "auto" : "none"; note.textContent = channel.value === "push" ? "Push notifications require permission on this device. The reminder will use your local time zone." : "Email delivery needs an email provider configured for the project."; };
  enabled.addEventListener("change", update); channel.addEventListener("change", update); update();
  card.querySelector("#ph-reminder-save").addEventListener("click", async () => {
    status.textContent = "Saving…"; status.style.color = "#827264";
    if (enabled.checked && channel.value === "push") {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { status.textContent = "Push notifications are not supported by this browser."; status.style.color = "#DF3B32"; return; }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { status.textContent = "Notification permission was not granted."; status.style.color = "#DF3B32"; return; }
      const registration = await navigator.serviceWorker.register("/reminder-sw.js");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
      const json = subscription.toJSON();
      await supabase.from("holiness_push_subscriptions").upsert({ user_id: user.id, endpoint: subscription.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, updated_at: new Date().toISOString() }, { onConflict: "user_id,endpoint" });
    }
    const { error } = await supabase.from("holiness_reminders").upsert({ user_id: user.id, enabled: enabled.checked, channel: channel.value, time_of_day: `${time.value}:00`, timezone: tz, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    status.textContent = error ? `Could not save: ${error.message}` : "Reminder settings saved."; status.style.color = error ? "#DF3B32" : "#2D4C3C";
  });
};
new MutationObserver(render).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("popstate", () => setTimeout(render, 50));
setInterval(render, 1000);
