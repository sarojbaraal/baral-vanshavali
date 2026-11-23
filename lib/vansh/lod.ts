// Semantic zoom of the family chart: what a card shows depends on the zoom (the % in the toolbar).
//   0–10 %   far   – a plain coloured tile per person (colour = generation): the shape of the whole family
//   10–30 %  name  – the name only
//   30–50 %  face  – photo and first name
//   50 %+    near  – the full card
export type Lod = "far" | "name" | "face" | "near";

export const LOD_FAR = 0.1;
export const LOD_NAME = 0.3;
export const LOD_FACE = 0.5;

export const lodOf = (k: number): Lod => (k < LOD_FAR ? "far" : k < LOD_NAME ? "name" : k < LOD_FACE ? "face" : "near");
