# Game List

Persoonlijke game-tracker (à la GameTrack), gericht op Nintendo. Mobiele PWA die offline werkt.
Gebouwd met Vite, Tailwind CSS v4 en vite-plugin-pwa. Packagemanager: yarn.

## Tabs
- **Home**: overzicht, afteller voor aangekondigde games, nu aan het spelen, binnenkort op Nintendo, hoogste cijfers.
- **Bibliotheek**: tegels per lijst (Speel ik, Nog spelen, Wishlist, Uitgespeeld, Interessant, Gestopt), Alle games,
  en bladeren op platform, serie en genre.
  **Wat heb ik gespeeld?**: veeg per franchise door games (rechts = gespeeld → Uitgespeeld, links = niet), met ongedaan maken.
- **Ontdek** (verrekijker): zoeken in ~17.000 Nintendo-games (offline), franchise-mappen, binnenkort.
- **Meer**: binnenkort, handmatig toevoegen, statistieken, back-up.

Per game: info-pagina met releasedatum, platforms, ontwikkelaar, uitgever, genre, Nederlandse omschrijving,
trailer (YouTube in een popup), cijfer 0–10, eigen platform, datums en notities
(WYSIWYG met Tiptap: kopjes, lijsten en afvinklijstjes om je voortgang bij te houden).

## Lokaal draaien
```bash
yarn install
yarn dev            # zoekt offline + via Wikipedia
npx netlify-cli dev # idem, plus IGDB als TWITCH_* in een .env-bestand staan
```

## Offline gamelijst bijwerken
`public/data/games.json` komt uit Wikidata/Wikipedia en staat in de repo. Bijwerken (nieuwe releases):
```bash
yarn data   # duurt 5–30 minuten; Wikipedia remt het tempo af
```
Daarna committen en deployen. De app neemt de lijst mee in de offline-cache.

## Critici-score en speeltijd
Het gameprofiel toont de critici-score (IGDB, gemiddelde van recensies) en de speeltijd volgens spelers
(verhaal / + extra's / 100%). De app haalt die live op via `/api/game`; `public/data/extras.json` is de
offline reserve en zit in de offline-cache. Bijwerken:
```bash
yarn extras   # ~1 minuut, met TWITCH_* in .env
```

## Gegevensbronnen
- **Wikidata / Wikipedia** (CC BY-SA): gamelijst, platforms, datums, franchises, omschrijvingen, covers.
- **MyMemory**: automatische vertaling naar het Nederlands als er geen Nederlandse Wikipedia-pagina is (gratis, met daglimiet).
- **YouTube** (youtube-nocookie.com): trailers, als Wikidata een video-ID heeft of je zelf een link plakt.
- **IGDB** (optioneel): betere zoekresultaten. Maak een app aan op https://dev.twitch.tv/console en zet in Netlify
  `TWITCH_CLIENT_ID` en `TWITCH_CLIENT_SECRET` onder *Environment variables*. De sleutels blijven op de server
  (`netlify/functions/search.mjs`).

## Deployen op Netlify
Koppel de repo in Netlify. `netlify.toml` regelt de rest: build `yarn build`, publish `dist`, functions `netlify/functions`.

## Opslag
Alles staat in `localStorage` op je telefoon, covers in de offline-cache. Er is geen account of sync:
maak via **Meer → Back-up** af en toe een back-up.
