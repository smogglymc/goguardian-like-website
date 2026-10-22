# Classroom Monitor — setup

A consent-based classroom device tool: students install the extension and
**explicitly join your class with a join code** (like Kahoot/Google
Classroom). You only ever see and control students who joined — there's no
way to target a browser you don't know the join code for.

## 1. Firebase project

1. Go to https://console.firebase.google.com → Create project (or reuse the
   project from your school games site if you want everything in one place).
2. **Build → Firestore Database → Create database** (production mode).
3. **Build → Authentication → Sign-in method → Email/Password** → enable it.
4. **Authentication → Users → Add user** — create your own teacher login
   (email + password). You can add more teacher accounts the same way.
5. **Project settings → General → Your apps → Web app** — register a web
   app, copy the `firebaseConfig` object it gives you.
6. **Firestore → Rules** — paste in `firebase/firestore.rules` and publish.

## 2. Configure the extension

Open `extension/config.js` and set:
```js
const FIREBASE_PROJECT_ID = "your-project-id";
```

## 3. Configure the dashboard

Open `dashboard/index.html`, find the `firebaseConfig` object near the
bottom, and paste in the values Firebase gave you in step 1.5.

## 4. Load the extension (for your own computers)

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select the `extension/` folder
4. The extension icon will appear in the toolbar. Click it to join a class.

To push this to multiple computers you manage, you can zip the `extension/`
folder and load it the same way on each machine, or later package it as a
`.crx`/publish it privately to the Chrome Web Store for easier distribution.

## 5. Host the dashboard

`dashboard/index.html` is a single static file — no build step. Host it
however you're hosting your school games site (e.g. your Raspberry Pi +
domain): just drop the file on the server. Open it, sign in with the
teacher account you created in step 1.4.

## 6. Day-to-day use

- **Create a class** → you get a join code.
- Students open the extension popup, enter their name + the join code.
- Once joined, you'll see them appear in the dashboard with their current
  tab, last-seen time, and controls to **Lock** to a URL, **Unlock**,
  **Message**, or **Close tab** — individually or for the whole class.
- A student can always remove the extension or click "Leave class" to stop
  being monitored — this is intentionally consent-based, not a hidden
  takeover tool. If you need enforcement that survives uninstall, that
  requires enrolling devices in Chrome Enterprise/Google Workspace with
  managed policy, which is a different setup (let me know if you want help
  with that path once you have a Workspace domain).

## Notes on the permission set

Only `tabs`, `scripting`, `webNavigation`, `storage`, `alarms`, and
`notifications` are requested — enough to read/redirect the active tab,
enforce a lock, and show messages. The extra permissions in GoGuardian's
manifest (`nativeMessaging`, `management`, `system.cpu`/`system.memory`,
`enterprise.deviceAttributes`, `webRequestBlocking`, etc.) support things
like managed-device enrollment and native-host bridging that this
join-code-based tool doesn't need or use.
