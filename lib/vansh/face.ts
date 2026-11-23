// Which picture a person gets in a drawn chart: their own photo, else the site's default avatar (the newest SVG the admin
// uploaded), else nothing (the chart then draws the first letter). `photos` holds data URLs for self-contained downloads
// (see loadPhotos: person ids and "__M" / "__F"); without it the public URLs are used, fine for screens and print windows.
import type { VPerson } from "./types";
import { siteAvatarFor, type SiteAvatars } from "./avatars";

export interface FaceOpts {
  photos?: Record<string, string>;
  avatars?: SiteAvatars;
}

export function faceSrc(p: VPerson, o: FaceOpts): string | undefined {
  if (!p.is_locked) {
    const own = o.photos?.[p.id] || (o.photos ? undefined : p.photo_url || undefined);
    if (own) return own;
  }
  return o.photos?.["__" + (p.gender === "F" ? "F" : "M")] || siteAvatarFor(p, o.avatars);
}
