# Pickleball Match Randomizer

A small React + Vite app for generating randomized pickleball doubles matchups while minimizing repeat pairings.

## Features

- Add and remove players
- Generate a doubles round with two-player teams
- Record win/loss results for each match
- Automatically group winners against winners and losers against losers for the next round
- Persist players and round history in browser `localStorage`

## Project structure

- `src/App.tsx` — main user interface
- `src/utils/pairing.ts` — pairing algorithm and storage helpers
- `src/styles.css` — basic styling

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

## Notes

- If you don't have Node.js installed in this environment, install it first from [nodejs.org](https://nodejs.org/).
- The app stores players and rounds locally in the browser, so data persists between refreshes.
