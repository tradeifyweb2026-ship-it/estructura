/**
 * @param {number} capital
 * @param {number} percent
 * @returns {number | null}
 */
export function calculateRisk(capital, percent) {
  if (!Number.isFinite(capital) || capital <= 0 || !Number.isFinite(percent) || percent <= 0 || percent > 100) return null;
  const value = capital * percent / 100;
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {number} risk
 * @param {number} distance
 * @param {number} pointValue
 * @param {number} step
 * @returns {number | null}
 */
export function calculatePosition(risk, distance, pointValue, step) {
  if (![risk,distance,pointValue,step].every(v => Number.isFinite(v) && v > 0)) return null;
  const raw = risk / (distance * pointValue);
  if (!Number.isFinite(raw) || raw / step > Number.MAX_SAFE_INTEGER) return null;
  // Round down, never round up to a size that exceeds the risk budget.
  let units = Math.floor(raw / step);
  let size = units * step;
  if (size * distance * pointValue > risk) size = Math.max(0, --units) * step;
  return Number.isFinite(size) ? size : null;
}

/**
 * @param {number} entry
 * @param {number} stop
 * @param {number} target
 * @param {string} direction
 * @returns {number | null}
 */
export function calculateRR(entry, stop, target, direction) {
  if (![entry,stop,target].every(v => Number.isFinite(v) && v > 0) || !["long","short"].includes(direction)) return null;
  const sign = direction === "long" ? 1 : -1;
  const loss = (entry - stop) * sign, gain = (target - entry) * sign;
  if (loss <= 0 || gain <= 0) return null;
  const value = gain / loss;
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {number} lossPercent
 * @returns {number | null}
 */
export function calculateRecovery(lossPercent) {
  if (!Number.isFinite(lossPercent) || lossPercent < 0 || lossPercent >= 100) return null;
  return lossPercent / (100 - lossPercent) * 100;
}

/**
 * @param {number} closedPercent
 * @param {number} closedR
 * @param {number} remainingR
 * @returns {number | null}
 */
export function calculatePartials(closedPercent, closedR, remainingR) {
  if (![closedPercent,closedR,remainingR].every(Number.isFinite) || closedPercent < 0 || closedPercent > 100) return null;
  const value = closedPercent / 100 * closedR + (100 - closedPercent) / 100 * remainingR;
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {number} capital
 * @param {number} risk
 * @returns {number|null}
 */
export function riskPercent(capital,risk){if(!Number.isFinite(capital)||capital<=0||!Number.isFinite(risk)||risk<0)return null;const v=risk/capital*100;return Number.isFinite(v)?v:null}

/**
 * @param {number} pnl
 * @param {number} initialRisk
 * @returns {number|null}
 */
export function resultMultiple(pnl,initialRisk){if(!Number.isFinite(pnl)||!Number.isFinite(initialRisk)||initialRisk<=0)return null;const v=pnl/initialRisk;return Number.isFinite(v)?v:null}

/**
 * @param {number} capital
 * @param {number} pnl
 * @returns {number|null}
 */
export function simpleReturn(capital,pnl){if(!Number.isFinite(capital)||capital<=0||!Number.isFinite(pnl))return null;const v=pnl/capital*100;return Number.isFinite(v)?v:null}

/**
 * @param {number} peak
 * @param {number} current
 * @returns {number|null}
 */
export function drawdownPercent(peak,current){if(!Number.isFinite(peak)||peak<=0||!Number.isFinite(current)||current>peak)return null;const v=(peak-current)/peak*100;return Number.isFinite(v)?v:null}

/**
 * @param {number} entry
 * @param {string} direction
 * @param {number} costs
 * @param {number} pointValue
 * @param {number} size
 * @returns {number|null}
 */
export function breakEvenPrice(entry,direction,costs,pointValue,size){if(![entry,pointValue,size].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(costs)||costs<0||!["long","short"].includes(direction))return null;const v=entry+(direction==="long"?1:-1)*costs/(pointValue*size);return Number.isFinite(v)&&v>0?v:null}
