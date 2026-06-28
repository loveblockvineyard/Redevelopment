# Vineyard Ops — offline PWA

An installable web app (PWA) for the vineyard: spray plan (kanban + grid), timesheets, and hazard reporting. It works **offline** — operators can open it with no signal, log work and hazards in the field, and everything syncs automatically once they're back in coverage. Data is stored on each phone and synced through **Firebase Firestore**.

Same app and features as before; the difference is it now runs as a real app outside Claude, with offline support.

---

## What you need (once)

- **Node.js 18+** on your computer (to build): https://nodejs.org
- A **Google account** (for Firebase — free Spark plan is enough).

---

## 1. Create the Firebase project (~5 min)

1. Go to https://console.firebase.google.com → **Add project**. Name it (e.g. *vineyard-ops*). Google Analytics is optional.
2. In the project, click the **web icon `</>`** ("Add app to get started"). Give it a nickname, **don't** tick Hosting yet, click **Register app**.
3. It shows a `firebaseConfig = { ... }` block. **Copy those values** into **`src/firebase.js`**, replacing the `PASTE_…` placeholders.
4. Left menu → **Build → Firestore Database → Create database** → start in **Production mode** → pick a location (e.g. `australia-southeast1`).
5. Left menu → **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**

That's it for the console — the security rules deploy automatically in step 3 below.

---

## 2. Build and deploy

In a terminal, from this folder:

```bash
npm install                      # install dependencies
npm install -g firebase-tools    # the Firebase CLI (one time)
firebase login                   # opens a browser to sign in
firebase use --add               # pick the project you just created
npm run build                    # builds into dist/
firebase deploy                  # deploys the app + Firestore rules
```

When it finishes it prints a **Hosting URL** like `https://vineyard-ops.web.app`. That's your app.

To push later changes: `npm run build && firebase deploy`.

> Want to try it before deploying? `npm run dev` runs it locally at the URL it prints. (Firebase still needs to be configured in step 1 for it to load data.)

---

## 3. Put it on the phones

On each operator's (and your) phone, open the Hosting URL **once while on wifi/data**, then:

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** menu (⋮) → **Install app** / **Add to Home screen**.

It now has its own icon and opens full-screen like a normal app. After that first online launch it works **offline**.

---

## Signing in

- Manager console: code **0000**
- Sample operator: code **1234**

Change these and add your real operators in **Manager → Setup** (the first thing I'd do is change the manager code). Operators added there sign in with their own codes.

---

## How offline works

- Firestore keeps a **local copy on the device** and serves reads from it when there's no signal.
- Anything logged offline (timesheets, hazards, spray changes) is **queued and synced** when the connection returns — operators can work offline for hours.
- A bar appears at the bottom when the device is offline so people know they're not connected; their data is still being saved.
- **First launch on each phone needs a connection once** (to download the app and sign in). After that it's offline-capable.
- The manager sees synced entries after a **Refresh** on each screen (the buttons are there for that).

## Hazard email alerts

Set the **Webhook URL** and **Notify email** in **Setup** (Google Apps Script — see `notify-AppsScript.gs`). When a hazard is submitted **with a connection**, the manager is emailed within seconds. A hazard submitted **offline** is saved and appears in the console once it syncs; the email goes out only if there's a connection at submit time. If you want a guaranteed email even for hazards entered offline (sent the moment they sync), that needs a small Firebase Cloud Function — ask and I'll add it (requires the Blaze plan).

---

## Spray rounds, mixes & the chemical shed

**Operator tanks.** In **Setup → Operator sprayer tanks**, set each operator's tank size (Jason 3000 L, Simon 2000 L by default). Full-tank amounts scale to whoever's lane a card sits in, and re-scale automatically if you drag a block from one operator to the other.

**Chemical shed (Shed tab).** Load every product with its unit, concentration, per-100 L rate, current stock and a minimum. Anything at or below its minimum is flagged red and listed at the top; if you've set the webhook, a reorder email goes out when stock crosses the minimum.

**Round mix.** On the Spray page, open **Round mix** and pick the products + per-100 L amounts for the round. Every card then shows the mix two ways — **per 100 L** and **full tank** for that operator's sprayer.

**Percentage done.** The Spray page shows how much of the area is sprayed, weighted by block hectares (set in **Setup → Blocks**), updating as operators tick blocks done. It reads 100% when every block is done.

**Export & stock deduction.** **Export round** (Spray page) writes an Excel file: every block with its area, water rate, volume and per-product quantities, plus a product-usage summary and the mix sheet. When the round is finished, **Deduct round from stock** (Shed tab) subtracts each product's total used (label rate × area × water rate) from your shed stock and fires the low-stock alert if needed. Loading a new spray plan with **Replace** starts the next round.

---

## Notes

- **Security:** access inside the app is by operator/manager code. Anonymous Auth stops random visitors from reading the database directly, but anyone with the link and a code can use the app. For a private crew behind a non-obvious URL this is fine; to lock it down further, enable **Firebase App Check**.
- **Data model:** stored in a `kv` collection — config in one doc, the spray board in one doc, and each operator's timesheets/hazards in their own doc. Over a long season an operator's history grows; you can clear old entries from the app or archive in the Firebase console.
- **Cost:** the free Spark plan comfortably covers a vineyard crew.
- The first download is ~1.2 MB (cached once); after that loads are instant and offline.
