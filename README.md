# Daily Ledger

A habit tracker: a calendar that turns green/orange/red based on how much of the
day's list you finished, editable tasks with notes, repeating tasks (daily /
weekly / monthly), custom categories, and progress charts. Installable as a
PWA. Signs in with Google and syncs across devices via Firestore; works fine
signed out too (stored locally in that case).

## Local development

```bash
npm install
npm run dev
```

## Deploying

Pushing to `main` builds the app and deploys it to GitHub Pages automatically
via `.github/workflows/deploy.yml`. In the repo's **Settings → Pages**, set
**Source** to "GitHub Actions" once, and it'll deploy on every push after that.

## Firebase setup (one-time, in the Firebase console)

1. **Authentication → Sign-in method** → enable Google.
2. **Authentication → Settings → Authorized domains** → add
   `<your-username>.github.io`.
3. **Firestore Database** → create it if you haven't (production mode).
4. **Firestore → Rules** → paste in the contents of `firestore.rules` from
   this repo, so each signed-in user can only read/write their own data.

The Firebase config lives in `src/firebase.js`. It's a public client config
(not a secret) — this is standard for Firebase web apps; access control is
enforced by the Firestore rules above, not by hiding the config.
