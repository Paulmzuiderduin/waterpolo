# Mobile App Framework (Capacitor)

This project now includes a Capacitor framework for iOS and Android.

## Included
- `capacitor.config.json`
- Native projects:
  - `ios/`
  - `android/`
- npm scripts:
  - `npm run mobile:build` -> build web + sync native assets
  - `npm run mobile:sync` -> sync native assets/plugins
  - `npm run mobile:copy` -> build web + copy assets
  - `npm run mobile:add:ios`
  - `npm run mobile:add:android`
  - `npm run mobile:open:ios`
  - `npm run mobile:open:android`

## First-time setup
1. Install Xcode (iOS) and/or Android Studio (Android).
2. Run:
   - `npm install`
   - `npm run mobile:build`
3. Open native project:
   - iOS: `npm run mobile:open:ios`
   - Android: `npm run mobile:open:android`

## Daily workflow
1. Make web changes.
2. Run `npm run mobile:build`.
3. Rebuild/run from Xcode or Android Studio.

## Notes
- Auth/data uses the same Supabase backend as web.
- A user logging into mobile and scoring a match will see the same data on web.
