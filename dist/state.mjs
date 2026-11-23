const minute = 60_000;
const durations = [15, 30, 45, 60];
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const holdMinutes = 5;

export function seed(now = Date.now()) {
  const meals = [
    ["design", "Design Society Meetup", "Falafel wraps · Vegetarian", "Arts Building · Studio 3", 8, 30],
    ["robotics", "Robotics Open House", "Paneer sandwiches · Contains dairy and wheat", "Engineering Lab · Front desk", 12, 45],
    ["film", "Campus Film Screening", "Chickpea salads · Plant-based", "Library Annex · Atrium", 6, 60],
  ];
  return {
    events: meals.map(([id, title, meal, place, quantity, minutes]) => ({
      id, title, meal, place, quantity, closesAt: now + minutes * minute,
    })),
    reservations: [],
  };
}

export function reservationStatus(reservation, now) {
  if (reservation.status === "held" && reservation.expiresAt <= now) return "expired";
  return reservation.status;
}

export function stock(state, event, now) {
  let held = 0;
  let collected = 0;
  for (const reservation of state.reservations) {
    if (reservation.eventId !== event.id) continue;
    const status = reservationStatus(reservation, now);
    if (status === "held") held += 1;
    if (status === "collected") collected += 1;
  }
  return { held, collected, available: event.quantity - held - collected };
}

export function post(state, fields, now, id) {
  const title = String(fields.title ?? "").trim();
  const meal = String(fields.meal ?? "").trim();
  const place = String(fields.place ?? "").trim();
  const quantity = Number(fields.quantity);
  const duration = Number(fields.duration);
  if (!title || !meal || !place || title.length > 70 || meal.length > 100 || place.length > 70) {
    throw new Error("Fill in the event name, meal and pickup location.");
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500 || !durations.includes(duration)) {
    throw new Error("Choose 1 to 500 portions and a pickup window.");
  }
  const event = { id, title, meal, place, quantity, closesAt: now + duration * minute };
  state.events.unshift(event);
  return event;
}

function newCode(state, randomBytes) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const bytes = randomBytes();
    const code = Array.from(bytes, (byte) => codeAlphabet[byte % codeAlphabet.length]).join("");
    if (!state.reservations.some((reservation) => reservation.code === code)) return code;
  }
  throw new Error("Could not generate a pickup code. Try again.");
}

export function reserve(state, eventId, now, randomBytes) {
  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event || event.closesAt <= now) throw new Error("This pickup is closed.");
  const alreadyReserved = state.reservations.some((reservation) => (
    reservation.eventId === eventId && ["held", "collected"].includes(reservationStatus(reservation, now))
  ));
  if (alreadyReserved) throw new Error("You already reserved a portion from this event.");
  if (stock(state, event, now).available < 1) throw new Error("All portions are reserved or collected.");

  const reservation = {
    code: newCode(state, randomBytes),
    eventId,
    expiresAt: Math.min(event.closesAt, now + holdMinutes * minute),
    status: "held",
  };
  state.reservations.push(reservation);
  return reservation;
}

export function cancel(state, code, now) {
  const reservation = state.reservations.find((candidate) => candidate.code === code);
  if (!reservation || reservationStatus(reservation, now) !== "held") {
    throw new Error("This reservation is no longer active.");
  }
  reservation.status = "cancelled";
}

export function collect(state, value, now) {
  const code = String(value ?? "").trim().toUpperCase();
  const reservation = state.reservations.find((candidate) => candidate.code === code);
  if (!reservation) throw new Error("Pickup code not found.");
  const event = state.events.find((candidate) => candidate.id === reservation.eventId);
  const status = reservationStatus(reservation, now);
  if (status === "collected") throw new Error("This code has already been used.");
  if (status !== "held" || !event || event.closesAt <= now) {
    throw new Error("This pickup code is no longer active.");
  }
  reservation.status = "collected";
  return event;
}
