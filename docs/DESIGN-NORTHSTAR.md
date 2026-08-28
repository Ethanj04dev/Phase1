# Design north star

The reference points are not other fitness apps. They are the instruments
operators actually trust: dive computers, altimeters, mission planning tools.
Quiet, legible, zero decoration, every mark meaningful. Strava, Nike and
Garmin are consumer social products; SOFLETE and Mountain Tactical are content
subscriptions with an app wrapper. The open position is a **selection
instrument**: a calibrated gauge of the gap between an athlete and a known
standard. Every design decision serves that reading.

The trap is tactical costume — camo, stencils, drill-sergeant voice. That is
what larping looks like, and it is banned by the brief. An instrument does not
shout; it is simply never wrong about what it shows.

## The signature: the honest gauge

Every competitor draws a complete ring. Ours does not. The readiness gauge
draws only the measured portion of the arc — an athlete at 73% coverage sees
73% of an instrument, with the unmeasured remainder as a faint ticked gap.
Measuring a new domain visibly completes the gauge.

Nobody else can copy this, because nobody else's scoring model distinguishes
unmeasured from zero. It turns the honesty architecture into the brand mark,
and it makes "measure yourself honestly" the action the interface visibly
rewards.

Extensions of the same idea:

- **Provenance glyphs.** Verified = solid mark plus source. Unverified =
  hollow mark plus "Verification required". One pair, used everywhere, read
  like a calibration sticker.
- **Gaps in the event's own units.** "1:30 to go on the 500m swim" is
  trainable; "82%" is not. Lead with the gap, big and tabular.

## Surfaces: machined, not flat

Near-black layers separated by light rather than by lines.

- Cards carry a 1px top-edge highlight (`rgba(255,255,255,~0.05)`) — a
  machined edge catching light, which is how physical instruments read.
- The background carries a near-invisible noise grain (2–3% opacity, ground
  only, never on cards). The difference between "dark mode" and "anodized".
- At most one phosphor glow per screen, on the active data stroke (gauge arc,
  trend line). Never on text. Instrument phosphor, not neon.
- Card borders stay: on a near-black ground an edge is what makes a surface a
  surface. A contrast test enforces visibility.

## Colour: three jobs, no moonlighting

Already law, restated: white is the primary action and the hero number. Blue
is signal — progress, selection, identity — and never the primary button.
Green/amber/red are status only, and status is never colour alone. Nothing is
decorated.

## Type: Plex stays, the scale gets braver

IBM Plex earns its keep: engineering voice, three related subfamilies, six
weights under 1MB. The lever is scale contrast, not a new font. One number per
screen gets the display treatment (~88–96pt condensed bold, tabular);
everything else stays small. Mono is data only — dates, splits, ids. Uppercase
happens only where the string itself is uppercase.

## Motion: a small vocabulary, used everywhere

Motion explains state change; it never decorates. On the UI thread via
Reanimated, per the architecture rules.

1. **Gauge draw-in** — the arc sweeps to the score once on entry.
2. **Press scale** — 0.97, spring release, on every pressable surface.
3. **State settle** — a logged set or marked milestone settles with a short
   spring and a single haptic tick (haptics only on meaningful state change).
4. **Screen transitions stay stock.** Custom transitions are where mid-tier
   devices drop frames; the 60fps budget is spent on the vocabulary above.

No count-up numbers until they can run off the UI thread: an animated
setState loop is banned by the architecture rules, and the rule wins.

## Features that serve the thesis

Ranked, all inside MVP scope:

1. Honest gauge as the hero of Today and Target.
2. Countdown anchoring — the ship-date milestone drives "N weeks out" framing.
3. Test-day mode — assessment day as an event: protocol on screen, big
   timestamp-derived stopwatch, enter-as-you-go.
4. Evidence drill-down — every number tappable to its arithmetic: verdict →
   contributors → computation. Three tiers, deliberate taps between them.
5. Water-confidence safety surfaced on the session itself (step 9 carry-over).

Restraint is a feature: no feed, no leaderboards, no AI-coach theatre, no
streak shaming. The streak already refuses to accuse; that is a design
position, not a gap.

## The order of work

Foundation first — tokens, Card, Button, rows, grain — so every screen
improves at once. Then the gauge and the hero screens. Then test-day mode and
evidence drill-down. Validate the surface treatment on the physical iPhone
early: grain and glow are judged on an OLED, not in a browser.
