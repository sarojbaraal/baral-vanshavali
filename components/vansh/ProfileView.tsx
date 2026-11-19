"use client";
// "प्रोफाईल" tab: the signed-in person's own page. (Full life-sheet and printable chart are added on top of this.)
import React from "react";
import { useVansh } from "./VanshContext";
import { Avatar } from "./ui";
import { MineView } from "./RequestViews";

export default function ProfileView() {
  const { me, g, pick } = useVansh();
  const p = me?.position_person_id ? g.byId[me.position_person_id] : undefined;
  return (
    <div className="prof">
      <section className="card">
        {p ? (
          <div className="prof-head">
            <span className="prof-av"><Avatar g={p.gender} photo={p.photo_url} /></span>
            <div>
              <h2>{p.name}</h2>
              <p className="mut">{[p.occupation, p.organization, p.address].filter(Boolean).join(" · ") || "थप विवरण राखिएको छैन"}</p>
              <button className="ghost" onClick={() => pick(p.id)}>विवरण हेर्ने / सच्याउने</button>
            </div>
          </div>
        ) : (
          <p>वंशवृक्षमा आफ्नो स्थान छानेपछि तपाईंको प्रोफाईल यहाँ देखिन्छ।</p>
        )}
      </section>
      <h3 className="prof-h">मेरा अनुरोध</h3>
      <MineView />
    </div>
  );
}
