// Semantic zoom of the family chart: what a card shows depends on how big it is on screen.
//   far  – a plain coloured tile per person (colour = generation): the shape of the whole family
//   mid  – face and a large name, no small print
//   near – the full card
export type Lod = "far" | "mid" | "near";

export const LOD_FAR = 0.28;
export const LOD_MID = 0.5;

export const lodOf = (k: number): Lod => (k < LOD_FAR ? "far" : k < LOD_MID ? "mid" : "near");
