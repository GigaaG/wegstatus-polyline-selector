# Wegstatus Polyline Selector

Wegstatus Polyline Selector is een userscript voor de Waze Map Editor (WME). Het zet één of meer geselecteerde wegsegmenten om naar het door Wegstatus gebruikte formaat:

```text
latitude longitude latitude longitude ...
```

## Installatie

Open [`wegstatus-polyline-selector.user.js`](./wegstatus-polyline-selector.user.js) als raw bestand in een userscriptmanager zoals Tampermonkey. Het script werkt op de productie- en beta-omgeving van WME.

## Gebruik

1. Selecteer één of meer segmenten in WME.
2. Controleer de status in het blok **Wegstatus polyline** onderaan het segmentpaneel.
3. Gebruik **Richting omkeren** wanneer begin en einde andersom moeten staan.
4. Klik op **Polyline kopiëren** en plak het resultaat in Wegstatus.

De segmenten hoeven niet in routevolgorde geselecteerd te worden. Het script ordent een verbonden keten of gesloten lus automatisch, draait individuele geometrieën waar nodig om en verwijdert dubbele coördinaten op gedeelde knopen.

De gekopieerde coördinaten staan in `lat lon`-volgorde en worden afgerond op maximaal zes decimalen, zonder overbodige nullen toe te voegen.

Een selectie met losse delen of een vertakking wordt bewust geweigerd. Bij tegenstrijdige eenrichtingssegmenten blijft de polyline doorlopend, maar verschijnt een waarschuwing om de richting extra te controleren.

## Ontwikkeling

Vereist Node.js 20 of nieuwer.

```bash
npm install
npm run check
```

Beschikbare commando's:

- `npm run build` — bundelt `src/main.ts` naar het installeerbare root-userscript.
- `npm run typecheck` — controleert TypeScript en de WME SDK-types.
- `npm test` — voert de unit-, DOM- en buildtests uit.
- `npm run check` — voert typecheck, build en alle tests achter elkaar uit.

Pas de gegenereerde `.user.js` niet handmatig aan. Wijzig de TypeScript-broncode en voer daarna de build uit.

## Handmatige smoke-test

Controleer na een WME-gerelateerde wijziging op zowel `https://beta.waze.com/editor/` als `https://www.waze.com/editor/`:

- geen selectie en een niet-segmentselectie tonen geen bediening;
- één segment toont beide actieve knoppen en kopieert in `lat lon`-volgorde;
- een ongeordende keten wordt doorlopend samengevoegd;
- een gesloten lus sluit exact op het beginpunt;
- omkeren wisselt begin en einde;
- losse delen en vertakkingen tonen een fout en schakelen de knoppen uit;
- een geslaagde kopieeractie toont tijdelijk een bevestiging.
