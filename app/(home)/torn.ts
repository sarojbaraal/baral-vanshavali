// A deterministic ragged "torn paper" edge for the band under the hero (same shape on server and client).
export function tornPath(w = 1440, h = 80, base = 38, amp = 16, step = 18, seed = 7): string {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pts: string[] = [`M0 ${h}`, `L0 ${base}`];
  let drift = 0;
  for (let x = step; x < w; x += step) {
    drift = drift * 0.6 + (rnd() - 0.5) * amp;
    pts.push(`L${x} ${(base + drift).toFixed(1)}`);
  }
  pts.push(`L${w} ${base}`, `L${w} ${h}`, "Z");
  return pts.join(" ");
}
