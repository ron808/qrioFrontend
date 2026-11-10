# qrioFrontend

Next.js frontend for Qrio, the AI quiz game: solo "Lone Wolf" play, real-time multiplayer rooms, accounts and local stats.

The backend lives in [qrioBackend](../qrioBackend), next to this folder. To run both, go there and run:

```bash
npm run dev:all
```

Then open http://localhost:3000.

To run only the frontend against a backend that's already running:

```bash
npm install
npm run dev
```

During development the frontend calls the backend on the same host it was loaded from, at port 8081 (`NEXT_PUBLIC_API_PORT` changes the port). So `localhost:3000` talks to `localhost:8081`, and a phone opening `192.168.x.x:3000` talks to `192.168.x.x:8081`. Production builds use `NEXT_PUBLIC_API_URL`, or the Render backend if it isn't set ([lib/api.ts](lib/api.ts)).

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on 0.0.0.0:3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |

## Design system

The look is "a quiz on paper that marks itself". Keep new screens inside it:

- **Colour.** Paper, ink and one highlighter yellow (`--hl`, with dark text on it), all defined as tokens in [app/globals.css](app/globals.css). Dark mode (`.dark`) is true black paper with white ink; shadows there are dark grey, since nothing is darker than black. Yellow means the main action or what you picked. Green and red only ever mean right and wrong. Use the token utilities (`bg-card`, `text-ink-muted`, `bg-hl`, `text-good` …), not raw hex or Tailwind palette colours.
- **Type.** `font-heading` (heavy Nunito) for headings and all numbers, `font-hand` (Caveat) for short handwritten notes, `font-marker` (Permanent Marker) only for the logo and one-word verdicts. Never set digits in the marker font: its "1" reads as a slash.
- **Logo.** The sticker Q: a bold Q on a tilted highlighter sticker with a hard shadow, next to the marker wordmark. Its shape lives once in [lib/logo.ts](lib/logo.ts) and draws the `<Logo>`, the share picture, the page-transition cover, the iPhone icon and the link preview. [app/icon.svg](app/icon.svg) (the browser tab icon) is a written-out copy, so change both together.
- **Surfaces.** `sketch-card` and `sketch-inset` give the 2px ink outline and hard offset shadow. Buttons are `sketch-btn-accent` (the one main action), `sketch-btn-dark` or `sketch-btn-light`. They live in the `components` layer, so Tailwind utilities on the same element win.
- **Marks.** [Marks.tsx](app/components/Marks.tsx) has the marker loop, highlighter, underline and arrow. [GameUI.tsx](app/components/GameUI.tsx) adds the rubber `Stamp`. They mark something (an answer, a score, the one word that matters); they aren't decoration.
- **Shared pieces.** Game screens use [GameUI.tsx](app/components/GameUI.tsx) (option rows, timer, progress, question sheet, verdict bar). Set-up forms use [QuizSettings.tsx](app/components/QuizSettings.tsx), and dialogs use [Modal.tsx](app/components/Modal.tsx).
- **Motion.** One easing curve (`EASE` in [lib/motion.ts](lib/motion.ts), `--ease` in CSS), short durations. Hover effects are for mouse pointers only, and touch gets the press state.
- **The dotted paper.** [DotField.tsx](app/components/DotField.tsx) draws the background dots on a canvas. They drift; scrolling glitches them like a dropped signal (hard shake, torn bands, a red/cyan split), scaled to scroll speed; they calm down while the page changes under the bubble cover ([PageTransition.tsx](app/components/PageTransition.tsx)); and tapping the bare paper sends a ripple. Call `pulseDots()` / `pulseFrom(el)` from [lib/pulse.ts](lib/pulse.ts) for a ripple (green for right; red with the glitch shake for wrong). With reduced motion the plain CSS dots stay.
- **Personality.** Every question carries commentary from the backend (`explanation`, `fact`, `quip_right`, `quip_wrong`, `option_notes`), shown in the verdict bar and under the struck-out option. All other copy with a voice (headlines, stamps, titles, teacher's comments, loading lines) lives in [lib/fun.ts](lib/fun.ts). Tease the question, never the player.
- **Sound.** [lib/sound.ts](lib/sound.ts) synthesizes the effects (no audio files) and owns the mute switch (`SoundToggle`). Keep sounds short and quiet.
- **Layout.** Check every screen at 320px wide. Responsive grids need a `grid-cols-1` base, or a wide input can push the page sideways.
