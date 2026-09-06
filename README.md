# trmnl-openmensa

A TRMNL plugin that shows what's on the canteen menu today, from any
[OpenMensa](https://openmensa.org)-compatible feed.

Closed today? The plugin marks the screen as skipped so your playlist moves on to the
next plugin instead of showing an empty menu.

## Install

TRMNL → Plugins → Private Plugin → New. Set the strategy to **Polling**, then paste the
files from this repo into the matching fields:

| File | Where it goes |
|---|---|
| `settings.yml` | polling URL + custom fields (form builder) |
| `transform.js` | transform / "edit data" (default runtime, no network needed) |
| `shared.liquid` | shared markup |
| `full.liquid`, `half_horizontal.liquid`, `half_vertical.liquid`, `quadrant.liquid` | the four views |

## Feed

Set **Feed URL** to anything that serves today's menu in OpenMensa's shape:

- `https://openmensa.org/api/v2/canteens/<id>/meals` — days with meals, for any canteen
  listed on openmensa.org (find the id via `https://openmensa.org/api/v2/canteens`)
- an [OpenMensa Feed v2](https://doc.openmensa.org/feed/v2/) XML document
- `.../days/<date>/meals` also works, but pins the plugin to that one date

**CAMPO and the other Studierendenwerk Bonn canteens are not on openmensa.org.** To use
them, publish a feed yourself — [`bonn-mensa`](https://github.com/alexanderwallau/bonn-mensa)
writes one with `mensa --mensa CAMPO --xml campo.xml` — host that file anywhere TRMNL can
reach it, and point Feed URL at it.

## Options

The plugin's custom fields mirror the `bonn-mensa` CLI flags:

| Field | CLI equivalent | Default |
|---|---|---|
| Diet | `--vegan` / `--vegetarian` | All |
| Gluten free only | `--glutenfree` | off |
| Price | `--price {Student,Staff,Guest}` | Student |
| Language | `--lang {de,en}` | de |
| Show all allergens | `--show-all-allergens` | off (vegan-relevant ones only) |
| Show additives | `--show-additives` | off |
| No colors | `--no-colors` | off |

`--vegan` and `--vegetarian` are one dropdown instead of two checkboxes — as flags they're
mutually exclusive anyway. Language switches the plugin's own labels; meal names come from
the feed in whatever language it publishes.

Colors are diet badges in green/blue, which fall back to greyscale automatically on
monochrome devices. **No colors** forces outline badges everywhere.

## How meals are classified

OpenMensa feeds have no vegan/vegetarian flag, so `transform.js` derives one the way
`bonn-mensa` does: the meal's category and name are checked for a `vegan`/`vegetarisch`
tag, otherwise the published allergen notes decide (meat or fish → not vegetarian, plus
milk, egg or honey → not vegan; gluten grains → not gluten free). A canteen that publishes
no allergens will look vegan and gluten free. Both German and English notes are recognised.

Additives are the notes that start with a digit or name a class of additive
(colouring, preservative, sweetener, ...); everything else counts as an allergen.

## Skipping

When the canteen is closed — the day is missing from the feed, marked `closed`, or has no
meals left after your filters — `shared.liquid` emits
`window.TRMNL_SKIP_DISPLAY = true`, and TRMNL skips the screen in your playlist. If it's
the only plugin in the playlist you'll still see it, so the views also render a plain
"Heute geschlossen" / "Closed today" state.

## Tests

```
node test_transform.js
```

Covers both feed shapes, the price roles, diet/gluten classification and every path that
ends in "closed".

## Known limits

- Today is resolved in UTC inside the transform, so between midnight and 02:00 CET the
  plugin can still show yesterday until the next poll.
- One day only. No week view.
