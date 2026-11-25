import { numberText } from "./journal.ts";

/** Geometría compartida de la curva de resultados (PDF y tarjeta de imagen). Pura y sin DOM. */

function niceStep(span: number) {
  const coarse = Math.max(span, 0.0001);
  const base = 10 ** Math.floor(Math.log10(coarse));
  return ([1, 2, 2.5, 5, 10].find((step) => step >= coarse / base) ?? 10) * base;
}

export type CurveGeometry = {
  line: string; area: string; zeroY: number; lastX: number; lastY: number;
  ticks: { y: number; label: string; zero: boolean }[]; left: number; right: number;
};

export function curveGeometry(values: number[], width: number, height: number, pad = { left: 38, right: 10, top: 10, bottom: 10 }): CurveGeometry {
  const low = Math.min(0, ...values), high = Math.max(0, ...values);
  const step = niceStep((high - low || 1) / 3);
  const min = Math.floor(low / step) * step;
  let max = Math.ceil(high / step) * step;
  if (max - min < step) max = min + step;
  const count = Math.max(values.length - 1, 1);
  const x = (index: number) => pad.left + index / count * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (max - value) / (max - min) * (height - pad.top - pad.bottom);
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`);
  const ticks: CurveGeometry["ticks"] = [];
  for (let tick = min; tick <= max + step / 1e6; tick += step) {
    const clean = Math.abs(tick) < step / 1e6 ? 0 : tick;
    ticks.push({ y: y(clean), label: clean === 0 ? "0" : numberText(clean), zero: clean === 0 });
  }
  return {
    line: points.join(" "), area: `${x(0).toFixed(1)},${y(0).toFixed(1)} ${points.join(" ")} ${x(values.length - 1).toFixed(1)},${y(0).toFixed(1)}`,
    zeroY: y(0), lastX: x(values.length - 1), lastY: y(values[values.length - 1] ?? 0), ticks, left: pad.left, right: width - pad.right,
  };
}
