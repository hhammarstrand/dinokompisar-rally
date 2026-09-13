# Kvar tills det är ett spel (inte en demo)

Befintlig kod i `src/` är en motor-skiss. Den får **inte** raderas. Bygg ovanpå.

Hugo: det här är inte beta. Det ska kännas som ett barnspel man vill köra igen.

## Vad som är fel nu

- Karts är ellipser, inte Dino/Rex/Stega/Laga
- Banorna är färgklumpar (oval/wiggle/åttor), inte grottan/skogen/molntoppen
- Ingen nedräkning, ingen mini-karta, inga synliga items på banan
- HUD är en svart textruta
- Menyerna ser ut som ett admin-UI
- Inga ljud
- Touch är osynlig (dela skärmen, inga knappar)
- Mode 7-golvet saknar kantlinjer, start/mål, dekoration

## Mål för “spel”

1. Man känner igen karaktärerna från Dinokompisar
2. Tre banor ser ut som tre platser
3. Ett race har start (3-2-1), varv, plats, mål
4. Fungerar på telefon med knappar på skärmen
5. `npm test` och `npm run build` gröna
6. Inga Mario-namn/assets, inga vuxenteman

## Karaktärer (lås)

- Dino: grön, liten, rund, glada ögon
- Rex: röd-orange ung T-Rex, pyttelika armar
- Stega: blå, taggar på ryggen
- Laga: stor brun T-Rex

Barnboks-flat, pastell, inte fotorealistiskt.

## Får inte

- Radera physics/track-API
- Byta till Three.js
- Påstå klart utan att ha kört `npm test` och `npm run build`
