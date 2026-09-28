# Maintenance Log

A mobile-first app for logging maintenance jobs. Every record has a branch number, what work was
done, what parts were used, and a timestamp that defaults to the current time but can be changed.
Records are stored as a real `records.csv` file on the server, and you can download either the whole
log or just the jobs between two times.

The same code runs as a website on Vercel and as an Android app.

## How it works

Vercel's filesystem is read-only, so the CSV cannot live next to the code. It is stored in Vercel
Blob instead, which keeps it a genuine `.csv` file that the API reads and rewrites on every change.

```
React app (browser or APK)  ->  /api/records, /api/export  ->  Vercel Blob (records.csv)
```

The Android app bundles the same React build and calls the deployed API over HTTPS, so changing data
or API behaviour takes effect immediately without reinstalling. Only UI changes need a new APK.

## Project layout

| Path | What it does |
| --- | --- |
| `api/records.ts` | List, create, update and delete records |
| `api/export.ts` | Builds the CSV download, optionally limited to a time range |
| `api/_lib/records.ts` | CSV parsing and serialising, sorting, range filtering |
| `api/_lib/store.ts` | Reads and rewrites the blob, with retry on concurrent writes |
| `api/_lib/http.ts` | Passcode check, CORS, JSON helpers |
| `src/` | The React app |
| `android/` | Capacitor Android project, built by GitHub Actions |

## Setting it up

### 1. Push to GitHub

Create a repository and push this folder to it.

### 2. Deploy on Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new). It will detect Vite on its own.
2. In the project, open **Storage** and create a **Blob** store, connecting it to this project. That
   adds `BLOB_READ_WRITE_TOKEN` automatically.
3. Under **Settings > Environment Variables**, add `APP_PASSCODE` and set it to whatever passcode you
   want to use. Without it every request is rejected, which is deliberate.
4. Redeploy so the new variables take effect.

Open the deployed URL, enter the passcode, and log your first job.

### 3. Build the Android app

1. In the GitHub repository, go to **Settings > Secrets and variables > Actions > Variables** and add
   a variable named `API_BASE` set to your Vercel URL, for example
   `https://maintenance-log.vercel.app`. The workflow fails with a clear message if this is missing,
   because the APK would otherwise have no server to talk to.
2. Go to **Actions > Android APK > Run workflow**.
3. When it finishes, download the `maintenance-log-apk` artifact and unzip it.
4. Copy `app-debug.apk` to your phone and open it. Android will ask you to allow installing from
   this source the first time.

The APK is signed with the standard Android debug key, which is fine for installing it yourself and
avoids keeping a keystore in GitHub. If you later want a release-signed build, generate a keystore,
add it plus its passwords as repository secrets, and switch the workflow to `assembleRelease`.

## Working on it locally

```bash
npm install
npm run dev      # UI only, at http://localhost:5173
npm test         # CSV round-trip tests
npm run lint
npm run build
```

`npm run dev` serves the React app but not the API, so the record list will fail to load. To run both
together against your real Blob store:

```bash
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```

After changing anything under `src/`, refresh the Android project with:

```bash
npm run android:sync
```

## Things worth knowing

- **Downloads behave differently on the phone.** In a browser the CSV downloads normally. Inside the
  app a cross-origin download link does nothing, so the file is written to app storage and passed to
  the Android share sheet, letting you save it to Drive, Files, email, or anywhere else.
- **Exports open cleanly in Excel.** They carry a UTF-8 byte order mark and are ordered oldest first,
  which reads better as a report than the newest-first list in the app.
- **Concurrent edits are safe.** Each write checks the file has not changed since it was read, and
  retries if it has, so having the app open on two devices will not silently lose an edit.
- **Timestamps are stored in UTC** and shown in your device's local time.
- **The whole CSV is rewritten on every change.** This stays comfortable into the thousands of
  records. Well past that, moving to a database with CSV export would be the next step.
- **It needs a signal.** There is no offline queue; records are saved straight to the server.
