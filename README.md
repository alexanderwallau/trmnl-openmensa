# trmnl-openmensa

A TRMNL plugin that shows what's on the canteen menu today, from any
[OpenMensa](https://openmensa.org)-compatible feed.

Closed today? The plugin marks the screen as skipped so your playlist moves on to the
next plugin instead of showing an empty menu.

## Deploy to Cloudflare Workers

Requires Node.js 22+ and a Cloudflare account.

```sh
npm ci
```

Deploy the shared Worker:

```sh
npx wrangler login
npm run deploy
```

The Worker serves today's transformed menu as JSON at
`https://trmnl-openmensa.<your-subdomain>.workers.dev/?feed_url=<encoded-feed-url>`.
Each user chooses their upstream feed in the TRMNL UI; one Worker can serve different
canteens without redeployment. Requests without `feed_url` use `vars.FEED_URL` in
`wrangler.jsonc` as a default. Invalid feed URLs return HTTP 400. Upstream failures return HTTP 502
so a broken feed is not reported as a closed canteen.

For local development, run `npm run dev` and open `http://localhost:8787/`.
You can override the feed locally with `FEED_URL="https://..."` in `.dev.vars`.
Check the deployment bundle without publishing with `npm run deploy -- --dry-run`.
See the [Wrangler configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Install in TRMNL

Run `npm run build` to create `dist/import.zip` for import into TRMNL. Building
requires the `zip` command and packages the settings and all five Liquid files
for use with the Worker.

TRMNL → Plugins → Private Plugin → New. Set the strategy to **Polling**, then paste the
files from this repo into the matching fields:

| File | Where it goes |
|---|---|
| `settings.yml` | polling URL + custom fields (form builder) |
| `shared.liquid` | shared markup |
| `full.liquid`, `half_horizontal.liquid`, `half_vertical.liquid`, `quadrant.liquid` | the four views |

**Worker URL** defaults to the deployed shared Worker. If you deploy your own, enter
its root URL (without query parameters). Set **Feed URL** to your preferred canteen's
OpenMensa JSON or XML feed. Anyone using the
plugin can change **Feed URL** in the UI to switch canteens. The polling URL encodes
the feed URL before passing it to the Worker.

When sharing a recipe with your own Worker, change the **Worker URL** field's `default` in `settings.yml`
to your deployed URL so other users only need to choose their feed.

Leave the transform / "edit data" field empty (remove the old transform when migrating);
the Worker already runs `transform.js`. Diet, price, language, and display options
still run in the Liquid views. For existing installations, update the form fields
and polling URL from `settings.yml`, move the old **Feed URL** value to **Worker URL**,
and enter the upstream canteen URL in **Feed URL**.

To use TRMNL without a Worker, set the polling URL to `{{ feed_url }}` and
paste `transform.js` into the transform / "edit data" field as before.

## Feed

Set **Feed URL** in the plugin UI to anything that serves today's menu in OpenMensa's shape:

- `https://openmensa.org/api/v2/canteens/<id>/meals` — days with meals, for any canteen
  listed on openmensa.org (find the id via `https://openmensa.org/api/v2/canteens`)
- an [OpenMensa Feed v2](https://doc.openmensa.org/feed/v2/) XML document
- `.../days/<date>/meals` also works, but pins the plugin to that one date

**CAMPO and the other Studierendenwerk Bonn canteens are not on openmensa.org.** To use
them, publish a feed yourself — [`bonn-mensa`](https://github.com/alexanderwallau/bonn-mensa)
writes one with `mensa --mensa CAMPO --xml campo.xml` — host that file anywhere TRMNL can
reach it, and enter its URL in **Feed URL**.

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
npm test
```

Covers both feed shapes, the price roles, diet/gluten classification, closed days,
and Worker requests with real XML parsing and simulated upstream failures.

## Known limits

- Today is resolved in UTC inside the transform, so between midnight and 02:00 CET the
  plugin can still show yesterday until the next poll.
- One day only. No week view.
