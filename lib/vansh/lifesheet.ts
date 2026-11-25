// The printable "वंश परिचय पत्र": an artistic A4 sheet with photo, facts and biography, and (page 2) the family tree painted as a wall mural.
// It opens in a new window; the person prints it or saves it as a PDF from the browser's print dialog.
import type { Fact } from "./profileFacts";
import { BASIS, IDENTITY } from "./intro";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export interface SheetInput {
  name: string;
  photoUrl?: string | null;
  initial: string;
  /** "A → B → C" oldest first */
  line: string[];
  facts: Fact[];
  bio: string;
  bioAi: boolean;
  /** lineage SVG markup (page 1; left out when the mural below is given) */
  chart: string;
  /** the family tree painted as a wall mural: printed on its own second page */
  mural?: string;
  today: string;
  /** born into the बराल line: only then the shared gotra / ved / pravar are printed */
  baral: boolean;
}

const COMMON_KEYS = ["गोत्र", "वेद", "प्रवर"];

export function lifeSheetHtml(s: SheetInput): string {
  const common = IDENTITY.filter((x) => COMMON_KEYS.includes(x.k))
    .map((x) => `<li><b>${esc(x.k)}</b> ${esc(x.v)} <i>${esc(BASIS[x.b].l)}</i></li>`)
    .join("");
  const bio = s.bio
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join("");
  const face = s.photoUrl
    ? `<img src="${esc(s.photoUrl)}" alt="" />`
    : `<span class="ini">${esc(s.initial)}</span>`;
  return `<!doctype html><html lang="ne"><head><meta charset="utf-8"><title>${esc(s.name)} — वंश परिचय पत्र</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 0 }
* { box-sizing: border-box }
html { background: #d9d3c2 }
body { margin: 0; font-family: "Noto Serif Devanagari", "Tiro Devanagari Hindi", Georgia, serif; color: #2b2a20; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.bar { position: sticky; top: 0; z-index: 5; display: flex; gap: .8rem; align-items: center; justify-content: center; padding: .6rem; background: #313d24; color: #efe9d9; font-size: 14px }
.bar button { padding: .45rem 1.1rem; border: 0; border-radius: 8px; background: #d9b36a; color: #2b2a20; font: inherit; font-weight: 700; cursor: pointer }
.sheet { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 11mm; background: #f7f1e3; position: relative; box-shadow: 0 6px 30px rgba(0,0,0,.25) }
.frame { min-height: calc(297mm - 22mm); border: 1.6px solid #b58a42; outline: 1px solid #b58a42; outline-offset: -6px; padding: 10mm 11mm 8mm; position: relative; display: flex; flex-direction: column }
.corner { position: absolute; width: 14mm; height: 14mm; border: 2px solid #b58a42 }
.c1 { top: 3mm; left: 3mm; border-right: 0; border-bottom: 0 } .c2 { top: 3mm; right: 3mm; border-left: 0; border-bottom: 0 }
.c3 { bottom: 3mm; left: 3mm; border-right: 0; border-top: 0 } .c4 { bottom: 3mm; right: 3mm; border-left: 0; border-top: 0 }
.kicker { text-align: center; color: #7d5a1e; font-size: 12.5px; letter-spacing: .04em }
.rule { display: flex; align-items: center; gap: 8px; margin: 6px auto 10px; width: 60%; color: #b58a42 }
.rule::before, .rule::after { content: ""; flex: 1; border-top: 1.4px solid #b58a42 }
.rule i { width: 8px; height: 8px; background: #b58a42; transform: rotate(45deg) }
h1 { margin: 0; text-align: center; font-size: 30px; line-height: 1.3; color: #313d24; font-weight: 800 }
.line { text-align: center; margin: 4px 0 12px; font-size: 12.5px; color: #6b6a5c }
.top { display: grid; grid-template-columns: 38mm 1fr; gap: 8mm; align-items: center; margin-bottom: 8mm }
.ph { width: 38mm; height: 38mm; border-radius: 50%; overflow: hidden; border: 3px solid #d9b36a; background: #313d24; display: grid; place-items: center; box-shadow: 0 0 0 5px #f7f1e3, 0 0 0 6.4px #b58a42 }
.ph img { width: 100%; height: 100%; object-fit: cover }
.ini { font-size: 54px; font-weight: 800; color: #d9b36a }
dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; font-size: 13px }
dt { color: #7d5a1e; font-weight: 700 } dd { margin: 0 }
h2 { margin: 0 0 4px; font-size: 15px; color: #313d24; display: flex; align-items: center; gap: 8px }
h2::after { content: ""; flex: 1; border-top: 1px solid rgba(181,138,66,.6) }
.bio p { margin: 0 0 7px; font-size: 13.3px; line-height: 1.85; text-align: justify; text-indent: 1.2em }
.bio small { display: block; color: #7d5a1e; font-size: 10.5px; margin-top: 2px }
.chart { margin-top: 7mm; break-inside: avoid }
.chart svg { display: block; width: 100%; height: auto; max-height: 100mm }
.frame2 { padding: 5mm 6mm 4mm }
.mural { flex: 1; display: grid; place-items: center; min-height: 0 }
.mural svg { display: block; width: 100%; height: auto; max-height: 246mm; border-radius: 3mm }
.foot { margin-top: auto; padding-top: 6mm }
.common { margin: 0; padding: 0; list-style: none; font-size: 11.5px; line-height: 1.7; color: #47463a }
.common i { color: #7d5a1e; font-style: normal; font-size: 10px; margin-left: 4px }
.stamp { margin-top: 5px; display: flex; justify-content: space-between; color: #6b6a5c; font-size: 10.5px }
@media print { html { background: none } .bar { display: none } .sheet { margin: 0; box-shadow: none; width: 210mm; height: 297mm; min-height: 0; overflow: hidden; page-break-after: always } .sheet:last-of-type { page-break-after: auto } }
</style></head><body>
<div class="bar"><span>A4 पाना तयार छ</span><button onclick="window.print()">प्रिन्ट / PDF सेभ गर्नुहोस्</button></div>
<div class="sheet"><div class="frame"><i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i>
<div class="kicker">बराल वंशावली · वंश परिचय पत्र</div><div class="rule"><i></i></div>
<h1>${esc(s.name)}</h1>
${s.line.length > 1 ? `<div class="line">${esc(s.line.join(" → "))}</div>` : `<div class="line">&nbsp;</div>`}
<div class="top"><div class="ph">${face}</div><dl>${s.facts.map((f) => `<dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd>`).join("")}</dl></div>
${bio ? `<div class="bio"><h2>जीवनी</h2>${bio}${s.bioAi ? "<small>यो जीवनी रेकर्डमा भएका तथ्यबाट लेखेको हो।</small>" : ""}</div>` : ""}
${s.mural ? "" : `<div class="chart"><h2>हजुरबुबादेखिको वंशवृक्ष</h2>${s.chart}</div>`}
<div class="foot">${s.baral ? `<h2>साझा वंश-जानकारी</h2><ul class="common">${common}</ul>` : ""}<div class="stamp"><span>vanshavali.sarojbaral.com.np</span><span>${esc(s.today)}</span></div></div>
</div></div>
${s.mural ? `<div class="sheet"><div class="frame frame2"><i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i><div class="mural">${s.mural}</div><div class="stamp"><span>${esc(s.name)} · वंशवृक्ष</span><span>${esc(s.today)}</span></div></div></div>` : ""}
</body></html>`;
}

/** Opens the sheet in a new window (call from a click handler so it is not blocked). */
export function openLifeSheet(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
