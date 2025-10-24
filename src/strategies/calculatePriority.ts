/**
 * 🎯 UNIVERSAL PRIORITY FORMULA
 *
 * Priority Range: [0 → 100]
 *
 * Formula:
 * priority = BASE + VALUE_SCORE + DISTANCE_SCORE + URGENCY + SAFETY - PENALTY
 *
 * Components:
 * - BASE: Strategy base priority [0-100]
 * - VALUE_SCORE: Action value [0-30]
 * - DISTANCE_SCORE: Distance factor [-10 to +10]
 * - URGENCY: Time pressure [0-20]
 * - SAFETY: Risk assessment [-20 to +10]
 * - PENALTY: Negative factors [-30 to 0]
 *
 * Final: Clamp to [0, 100]
 */

interface PriorityComponents {
  base: number; // Strategy base [0-100]
  value: number; // Action value [0-30]
  distance: number; // Distance factor [-10, +10]
  urgency: number; // Time pressure [0-20]
  safety: number; // Risk [-20, +10]
  penalty: number; // Negative factors [-30, 0]
}

export function calculatePriority(components: PriorityComponents): number {
  const raw =
    components.base +
    components.value +
    components.distance +
    components.urgency +
    components.safety +
    components.penalty;

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, raw));
}
