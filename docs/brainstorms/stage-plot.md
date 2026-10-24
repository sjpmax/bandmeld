# Brainstorm handoff: Stage plot builder

Read this once at the start of the brainstorm, then let the skill drive. The repo's `band snap PRD.md` and `README.md` cover the broader product.

## Why this exists

The sound engineer at a DIY venue wants a top-down diagram of where every musician and piece of gear will be on stage — mic positions, monitor wedges, DI boxes, cab placements. A one-page PDF handles this today (we already have `bands.tech_rider_url` for that), but a native builder would let the band assemble + update the plot inside BandSnap, render it responsively on the public EPK, and keep it in sync with roster changes (new drummer joins → their position appears).

**The feature is for the tech rider path, not a replacement for the whole rider.** Signal lists, backline requirements, hospitality — those probably stay in the PDF (or get their own UI later). Scope this to the diagram.

## Open design forks (the brainstorm's agenda)

Prioritized loosely. The skill should push on these in roughly this order.

1. **Who edits.** Admin-only, or each member drags their own position on? The second ties into `band_members.role_in_band` nicely but makes the plot never-finished (half the band hasn't logged in).
2. **Gear library.** Fixed icon set (drum kit, bass cab, guitar cab, mic stand, monitor wedge, DI, keyboard, mic, cable…) or user-added shapes with custom labels? Fixed is faster to ship, custom is more honest about how varied gear is.
3. **Canvas model.** Grid-snap or free-form coords? Fixed stage dimensions (one-size rectangle) or band-adjustable (depth / width)? What about weird stages — in-the-round, corner, outdoor festival wedge?
4. **Crowd anchor.** The initial mockup labels "Crowd" at the bottom edge. Fixed orientation (always bottom), or flippable so bands with corner stages can rotate? Does it matter to the venue PDF export?
5. **Output.** Inline SVG on the public EPK, exportable PNG/PDF for printed rider pages, or both? Venue engineers often want the printed version — they'll annotate it with pencil.
6. **Mobile.** Touch drag-drop MVP or edit-on-desktop / view-on-mobile only? Touch adds real complexity but musicians live on their phones.
7. **Signal flow.** Just gear placement, or also an input list (ch 1: kick, ch 2: snare…)? Separate feature or same model? Venues want both, but shipping together bloats scope.

Each of these has a cheap-to-explore and expensive-to-rebuild dynamic — exactly the brainstorm's job.

## Relevant schema (so the brainstorm doesn't invent what's there)

- `bands.tech_rider_url` — current PDF upload; the feature's neighbor.
- `band_members.role_in_band` — free-text ("Lead vocals", "Guitar", "Drums"); could pin each member's icon on the plot.
- `band_members.is_admin` — the right edit-permission check.
- Storage bucket `band-assets` with convention `{band_id}/{logo|press|rider|epk}/`. If the plot exports PNG/PDF, a `plot/` subfolder fits. The bucket's `allowed_mime_types` includes image types + PDF — may need to extend if we export SVG.
- Public EPK (`app/bands/[slug]/page.tsx`) is the obvious render target.
- Phase 2 Bill Builder (not yet built) will produce a venue pitch package — stage plot should slot into that package naturally.

## Explicit non-goals for the first version

- Scale-accurate stage dimensions (venue sound guys don't need millimeter precision).
- 3D or elevation data.
- Full input / signal routing — defer unless it falls out naturally.
- Multi-stage touring configs. One plot per band is fine.

## How to kick off

In a fresh session:

```
/superpowers:brainstorming stage plot builder for the tech rider — see docs/brainstorms/stage-plot.md
```

Mention your drag-and-drop idea and the "Crowd at bottom" sketch so the brainstorm has your initial lean to react to. Let it push back.
