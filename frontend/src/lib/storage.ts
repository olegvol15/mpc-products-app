/**
 * There is no auth in this drop, so a reservation is only ever tied to the
 * browser that made it. Persisting the id lets a buyer reload the page (or come
 * back later) without silently losing the unit they are holding.
 */
const key = (productId: string) => `mpc:reservation:${productId}`;

export const rememberReservation = (productId: string, reservationId: string) =>
  localStorage.setItem(key(productId), reservationId);

export const recallReservation = (productId: string): string | null =>
  localStorage.getItem(key(productId));

export const forgetReservation = (productId: string) =>
  localStorage.removeItem(key(productId));
