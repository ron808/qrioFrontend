import { ImageResponse } from "next/og";
import { markSvg } from "@/lib/logo";

/**
 * The picture a shared link shows (WhatsApp, iMessage, Slack, X): the logo
 * on dotted paper with the tagline. The two fonts come from Google Fonts at
 * build time; if that fails the picture still draws in the default font.
 */

export const alt = "Qrio: quiz yourself on anything";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TAGLINE = "quiz yourself on anything";
const DOTS =
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">` +
  `<pattern id="d" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="2.4" fill="#d6d1c5"/></pattern>` +
  `<rect width="1200" height="630" fill="url(#d)"/></svg>`;

async function googleFont(family: string, text: string): Promise<ArrayBuffer> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`)).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error(`No font file for ${family}`);
  return (await fetch(url)).arrayBuffer();
}

export default async function OpenGraphImage() {
  const fonts = await Promise.all([
    googleFont("Permanent+Marker", "Qrio").then((data) => ({ name: "Permanent Marker", data })),
    googleFont("Caveat:wght@700", TAGLINE).then((data) => ({ name: "Caveat", data, weight: 700 as const })),
  ]).catch(() => []);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1eee6",
          color: "#1b1a17",
        }}
      >
        <img src={`data:image/svg+xml;base64,${btoa(DOTS)}`} width={1200} height={630} alt="" style={{ position: "absolute", top: 0, left: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          <img src={`data:image/svg+xml;base64,${btoa(markSvg())}`} width={250} height={250} alt="" />
          <div style={{ display: "flex", fontFamily: "Permanent Marker", fontSize: 210, lineHeight: 1 }}>Qrio</div>
        </div>
        <div style={{ display: "flex", marginTop: 34, fontFamily: "Caveat", fontWeight: 700, fontSize: 76, color: "#4a4740" }}>
          {TAGLINE}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
