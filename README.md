# Creator Fest 2026 — Live Voting Site

A simple, free, standalone voting website for the **Cre8 Movement** and **Cre8 Sound**
audience-voting competitions. Attendees log in with their phone number and
split their voting points across finalists; organisers manage everything
from a separate admin page.

- `index.html` — attendee voting page
- `admin.html` — admin panel (voter import, finalists, open/close voting, live results)
- `firestore.rules` — database security rules (deploy these in Firebase, see below)
- `firebase-config.js` — where you paste your Firebase project's keys and set your admin code

No server, no hosting cost — everything runs in the browser, backed by a
free Firebase project. You only need to do the one-time setup below.

---

## 1. Create a free Firebase project

1. Go to <https://console.firebase.google.com> and sign in with any Google account.
2. Click **Add project**, give it a name (e.g. `creatorfest2026`), and finish the wizard (you can skip Google Analytics).

## 2. Turn on Firestore (the database)

1. In the left sidebar, click **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** (we'll paste our own security rules in step 5).
4. Pick a location close to Malaysia (e.g. `asia-southeast1`) and click **Enable**.

## 3. Turn on Anonymous Authentication

This lets the app quietly identify a browser session without any sign-up,
password, or SMS cost to you.

1. In the left sidebar, click **Build → Authentication**.
2. Click **Get started**.
3. Under the **Sign-in method** tab, click **Anonymous**, toggle it **Enable**, and **Save**.

## 4. Create a Web App and get your config

1. In the left sidebar, click the gear icon → **Project settings**.
2. Scroll to **Your apps**, click the **</>** (Web) icon.
3. Give it a nickname (e.g. `voting-site`) and click **Register app**. You do *not* need Firebase Hosting here.
4. You'll see a code block with a `firebaseConfig = { apiKey: "...", ... }` object. Copy those values.
5. Open **`firebase-config.js`** in this folder and paste your real values in place of every `"REPLACE_ME"` in the `firebaseConfig` object.

## 5. Set your admin code

1. Pick a code only your committee knows (e.g. `CF2026ADMIN`).
2. In **`firebase-config.js`**, set `ADMIN_CODE` to that code.
3. Open **`firestore.rules`** in this folder and set the `ADMIN_CODE()` function's return value to the **exact same code**.
4. In the Firebase Console, go to **Firestore Database → Rules** tab, delete everything there, paste in the entire contents of `firestore.rules`, and click **Publish**.

If the two codes (in `firebase-config.js` and `firestore.rules`) ever get out of
sync, admin login will simply fail with "Incorrect admin code" — just fix
whichever one is wrong and re-publish the rules.

## 6. Put the site online (GitHub Pages)

1. Create a new GitHub repository and push this whole folder to it (make sure `firebase-config.js` has your real values filled in before you push, not the placeholders).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`, then **Save**.
4. After a minute, GitHub shows your live URL, e.g. `https://yourusername.github.io/your-repo-name/`.
   - The attendee voting page is that URL directly (loads `index.html`).
   - The admin panel is that URL + `admin.html`, e.g. `https://yourusername.github.io/your-repo-name/admin.html`. Keep this link only with your committee.

That's it — no servers to run, no ongoing cost for an event this size (Firebase's free tier is generous and this app is well within it).

---

## 7. Using it on event day

**Before the event — import your attendees:**

1. Open the admin page and enter your admin code.
2. Go to the **Voters** tab.
3. Paste one line per attendee: `phone,points` — e.g.:
   ```
   012-345 6789,10
   0198765432,5
   ```
   - `points` is each attendee's total voting points (their free base points, plus anything extra they purchased — add those together before importing).
   - Importing a phone number that already exists overwrites their points with the new value, so you can re-import a corrected list safely.
   - Points are fixed once imported — there's no "top up" feature for an attendee who already has a points balance; to change their points, re-import that line with the new total.

**Add your finalists:**

1. Go to the **Finalists** tab.
2. Under each competition, type a finalist's name and number, click **Add**. Repeat for all finalists in both competitions.
3. You can edit a name/number and click **Save**, or **Delete** a finalist, at any time — even while voting is open.

**Start and stop voting:**

1. Go to the **Voting status** tab.
2. Click **Start voting** for a competition when you're ready for attendees to vote; click **End voting** when you want to stop (e.g. right before you announce winners).
3. You can start/stop each competition independently, at any time of your choosing.

**Watch results live:**

- The **Results** tab updates in real time as votes come in — no refresh needed.

**What attendees see:**

1. They open the site link and type the phone number they registered with.
2. They see their points balance and can open either competition (once you've started voting for it).
3. They split their points across as many finalists as they like using the +/- steppers, then tap **Submit my vote**.
4. Once submitted, a vote is final — it cannot be edited or resubmitted, by them or by you.

---

## Notes on how it works (for your own reference)

- **No real passwords or SMS codes are used anywhere.** "Logging in" with a phone number just looks up that number in a list you imported — there's no verification that the person entering it owns that number. This matches a casual community-event voting flow, not a bank-grade one.
- The "admin code" gates all admin actions (importing voters, editing finalists, opening/closing voting) at the database level, not just in the page — so it can't be bypassed by a technically savvy attendee poking around in their browser's developer tools.
- Votes, once submitted, cannot be changed or deleted by anyone (including admin) through the app, by design — this is enforced in `firestore.rules`, not just in the interface.
