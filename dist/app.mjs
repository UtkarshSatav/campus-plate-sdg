import { cancel, collect, holdMinutes, post, reservationStatus, reserve, seed, stock } from "./state.mjs";

const storageKey = "campus-plate-demo-v1";
const main = document.querySelector("main");
const notice = document.querySelector("#notice");
const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const formatTime = (timestamp) => time.format(timestamp);
let noticeTimeout;
let view;
let contentKey;
let memoryState;
let useBrowserStorage = true;

function readState() {
  if (useBrowserStorage) {
    try {
      const value = localStorage.getItem(storageKey);
      if (value) return JSON.parse(value);
    } catch {
      useBrowserStorage = false;
    }
  }
  memoryState ??= seed();
  return memoryState;
}

function writeState(state) {
  memoryState = state;
  if (!useBrowserStorage) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    useBrowserStorage = false;
  }
}

async function update(change) {
  function commit() {
    const state = readState();
    const result = change(state, Date.now());
    writeState(state);
    return result;
  }
  const result = navigator.locks
    ? await navigator.locks.request(storageKey, commit)
    : commit();
  refresh();
  return result;
}

function html(value) {
  const symbols = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, (character) => symbols[character]);
}

function notify(message) {
  clearTimeout(noticeTimeout);
  notice.textContent = message;
  noticeTimeout = setTimeout(() => { notice.textContent = ""; }, 2800);
}

function studentCards(events, state, now) {
  if (!events.length) return '<p class="empty">There are no open pickups right now.</p>';
  return events.map((event) => {
    const { available } = stock(state, event, now);
    const pass = state.reservations.find((reservation) => (
      reservation.eventId === event.id && ["held", "collected"].includes(reservationStatus(reservation, now))
    ));
    let buttonText = "Reserve a portion";
    if (available === 0) buttonText = "No portions left";
    if (pass) buttonText = pass.status === "collected" ? "Collected" : "Reserved";
    return `
      <article class="card">
        <div class="card-top">
          <span class="pill">${available} left</span>
          <span class="countdown" data-closes="${event.closesAt}"></span>
        </div>
        <div><h3>${html(event.title)}</h3><p>${html(event.meal)}</p></div>
        <div class="details"><strong>${html(event.place)}</strong><span>Pickup until ${formatTime(event.closesAt)}</span></div>
        <button type="button" class="primary" data-action="reserve" data-event="${html(event.id)}" ${pass || available === 0 ? "disabled" : ""}>${buttonText}</button>
      </article>`;
  }).join("");
}

function renderStudent(state, now) {
  const events = state.events.filter((event) => event.closesAt > now)
    .sort((first, second) => first.closesAt - second.closesAt);
  document.querySelector("#listing-count").textContent = `${events.length} ${events.length === 1 ? "pickup" : "pickups"}`;
  document.querySelector("#listings").innerHTML = studentCards(events, state, now);

  const passes = document.querySelector("#passes");
  const active = state.reservations.filter((reservation) => reservationStatus(reservation, now) === "held");
  passes.hidden = active.length === 0;
  passes.innerHTML = active.map((reservation) => {
    const event = state.events.find((candidate) => candidate.id === reservation.eventId);
    return `
      <article class="pass">
        <div>
          <p class="eyebrow">Your pickup pass</p>
          <h3 data-pass="${html(reservation.code)}" tabindex="-1">${html(event.title)}</h3>
          <p>${html(event.place)} · Show your code by ${formatTime(reservation.expiresAt)}.</p>
        </div>
        <div class="pass-actions">
          <strong class="code" aria-label="Pickup code ${html(reservation.code)}">${html(reservation.code)}</strong>
          <button type="button" class="secondary" data-action="cancel" data-code="${html(reservation.code)}">Cancel</button>
        </div>
      </article>`;
  }).join("");
}

function renderOrganizer(state, now) {
  const totals = { posted: 0, reserved: 0, collected: 0 };
  const rows = state.events.map((event) => {
    const { held, collected, available } = stock(state, event, now);
    const open = event.closesAt > now;
    totals.posted += event.quantity;
    totals.reserved += held;
    totals.collected += collected;
    return `
      <article class="posted-row">
        <div>
          <strong>${html(event.title)}</strong>
          <p>${available} ${open ? "available" : "uncollected"} · ${held} reserved · ${collected} collected</p>
        </div>
        <span class="pill${open ? "" : " closed"}">${open ? "Open" : "Closed"}</span>
      </article>`;
  });
  for (const [name, value] of Object.entries(totals)) {
    document.querySelector(`#${name}-total`).textContent = value;
  }
  document.querySelector("#posted-list").innerHTML = rows.join("") || "<p>No pickups posted yet.</p>";
}

function refresh() {
  const now = Date.now();
  const state = readState();
  const open = state.events.filter((event) => event.closesAt > now).length;
  const held = state.reservations.filter((reservation) => reservationStatus(reservation, now) === "held").length;
  const nextKey = JSON.stringify([view, state, open, held]);
  if (contentKey !== nextKey) {
    if (view === "organizer") renderOrganizer(state, now);
    else renderStudent(state, now);
    contentKey = nextKey;
  }
  for (const countdown of document.querySelectorAll("[data-closes]")) {
    const minutes = Math.max(1, Math.ceil((Number(countdown.dataset.closes) - now) / 60_000));
    const label = `Closes in ${minutes} min`;
    if (countdown.textContent !== label) countdown.textContent = label;
  }
}

function navigate(focus = false) {
  const nextView = location.hash === "#organizer" ? "organizer" : "student";
  if (nextView !== view) {
    view = nextView;
    main.replaceChildren(document.querySelector(`#${view}-template`).content.cloneNode(true));
    for (const link of document.querySelectorAll("nav a")) {
      if (link.id === `${view}-link`) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    if (focus) {
      main.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }
  refresh();
}

function verificationResult(message, error = false) {
  const element = document.querySelector("#verification-result");
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  element.classList.toggle("error", error);
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  try {
    if (button.dataset.action === "reserve") {
      const reservation = await update((state, now) => reserve(
        state, button.dataset.event, now, () => crypto.getRandomValues(new Uint8Array(6)),
      ));
      document.querySelector(`[data-pass="${reservation.code}"]`)?.focus();
      notify(`Portion reserved for up to ${holdMinutes} minutes.`);
    } else if (button.dataset.action === "cancel") {
      await update((state, now) => cancel(state, button.dataset.code, now));
      document.querySelector("#board-title")?.scrollIntoView({ block: "nearest" });
      notify("Reservation cancelled. The portion is available again.");
    } else if (button.dataset.action === "reset" && window.confirm("Reset all listings and reservations in this browser?")) {
      await update((state, now) => Object.assign(state, seed(now)));
      document.querySelector("#post-form")?.reset();
      document.querySelector("#verify-form")?.reset();
      const result = document.querySelector("#verification-result");
      if (result) result.hidden = true;
      notify("Demo reset.");
    }
  } catch (error) {
    refresh();
    notify(error.message);
  }
});

main.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const fields = Object.fromEntries(new FormData(form));
  if (form.id === "post-form") {
    try {
      const listing = await update((state, now) => post(state, fields, now, crypto.randomUUID()));
      form.reset();
      notify(`Posted ${listing.quantity} portions for ${listing.title}.`);
    } catch (error) {
      notify(error.message);
    }
  } else if (form.id === "verify-form") {
    try {
      const listing = await update((state, now) => collect(state, fields.code, now));
      form.reset();
      verificationResult(`Pickup confirmed for ${listing.title}. 1 portion collected.`);
    } catch (error) {
      verificationResult(error.message, true);
    }
  }
});

window.addEventListener("hashchange", () => navigate(true));
window.addEventListener("storage", (event) => {
  if (event.key === storageKey || event.key === null) refresh();
});

writeState(readState());
navigate();
setInterval(refresh, 1000);
