// app/utils/reservation.ts
// Pure spec of the availability rule that migration 0043's reserve_stock()
// applies per line, so it has a unit-tested definition independent of the
// SQL. The RPC is authoritative at runtime; this mirrors it exactly:
//
//   available = inventory - (sum of held, unexpired reservation qty)
//   a line fits  <=>  available >= requested
//
// `available` is clamped at 0 for display ("Only 0 available"), matching
// what reserve_stock returns.
export interface Availability {
  available: number; // inventory minus live holds, floored at 0
  fits: boolean; // whether `requested` can still be reserved
}

export function computeAvailability(
  inventory: number,
  heldQty: number,
  requestedQty: number
): Availability {
  const raw = (Number(inventory) || 0) - (Number(heldQty) || 0);
  return {
    available: Math.max(0, raw),
    fits: raw >= (Number(requestedQty) || 0),
  };
}
