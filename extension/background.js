importScripts("config.js", "firestore.js");

const SYNC_ALARM = "classroom-sync";
const POLL_SECONDS = 10; // how often we push status / check commands while active

// ---------- Join / leave ----------

async function joinClass(name, joinCode) {
  const cls = await fsQueryJoinCode(joinCode.trim().toUpperCase());
  if (!cls) throw new Error("No class found with that code.");

  const classId = cls._path.split("/").pop();
  const student = await fsCreate(`classes/${classId}/students`, {
    name,
    status: "active",
    currentUrl: "",
    currentTitle: "",
    lastSeen: new Date(),
    joinedAt: new Date(),
    commandId: "",
    lockedUrl: ""
  });
  const studentId = student._path.split("/").pop();

  await chrome.storage.local.set({
    joined: true,
    classId,
    className: cls.name || "",
    studentId,
    studentName: name,
    lockedUrl: "",
    lastHandledCommandId: ""
  });

  startSync();
  return cls.name || "your class";
}

async function leaveClass() {
  await chrome.storage.local.clear();
  chrome.alarms.clear(SYNC_ALARM);
}

// ---------- Status + command sync ----------

async function getState() {
  return chrome.storage.local.get([
    "joined", "classId", "studentId", "studentName",
    "lockedUrl", "lastHandledCommandId"
  ]);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

async function pushStatus() {
  const state = await getState();
  if (!state.joined) return;
  const tab = await getActiveTab();
  const docPath = `classes/${state.classId}/students/${state.studentId}`;
  try {
    await fsPatch(docPath, {
      currentUrl: tab?.url || "",
      currentTitle: tab?.title || "",
      status: "active",
      lastSeen: new Date()
    });
  } catch (e) {
    // offline or transient — will retry on next sync tick
  }
}

async function checkCommand() {
  const state = await getState();
  if (!state.joined) return;
  const docPath = `classes/${state.classId}/students/${state.studentId}`;
  let doc;
  try {
    doc = await fsGet(docPath);
  } catch (e) {
    return;
  }
  if (!doc) return;

  const commandId = doc.commandId || "";
  if (commandId && commandId !== state.lastHandledCommandId) {
    await handleCommand(doc.commandType, doc.commandPayload, commandId, state);
  }

  // lockedUrl may change independently of a one-shot command
  if ((doc.lockedUrl || "") !== (state.lockedUrl || "")) {
    await chrome.storage.local.set({ lockedUrl: doc.lockedUrl || "" });
    if (doc.lockedUrl) enforceLock(doc.lockedUrl);
  }
}

async function handleCommand(type, payload, commandId, state) {
  switch (type) {
    case "lock":
      await chrome.storage.local.set({ lockedUrl: payload || "" });
      if (payload) enforceLock(payload);
      break;
    case "unlock":
      await chrome.storage.local.set({ lockedUrl: "" });
      break;
    case "message":
      chrome.notifications.create({
        type: "basic",
        iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        title: "Message from your teacher",
        message: payload || ""
      });
      break;
    case "closeTab":
      await closeOrBlankActiveTab();
      break;
  }
  await chrome.storage.local.set({ lastHandledCommandId: commandId });
}

async function closeOrBlankActiveTab() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const tab = await getActiveTab();
  if (!tab) return;
  if (tabs.length > 1) {
    chrome.tabs.remove(tab.id);
  } else {
    chrome.tabs.update(tab.id, { url: "about:blank" });
  }
}

async function enforceLock(lockedUrl) {
  const tab = await getActiveTab();
  if (tab && tab.url !== lockedUrl) {
    chrome.tabs.update(tab.id, { url: lockedUrl });
  }
}

// ---------- Wiring ----------

function startSync() {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 1 }); // alarm floor is 1 min; onUpdated covers the gaps
  syncTick();
}

async function syncTick() {
  await pushStatus();
  await checkCommand();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) syncTick();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  const state = await getState();
  if (!state.joined) return;
  if (state.lockedUrl && changeInfo.url !== state.lockedUrl) {
    chrome.tabs.update(tabId, { url: state.lockedUrl });
    return;
  }
  pushStatus();
});

chrome.tabs.onActivated.addListener(async () => {
  const state = await getState();
  if (state.joined) pushStatus();
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  if (state.joined) startSync();
});

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getState();
  if (state.joined) startSync();
});

// Messages from popup.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "join") {
        const className = await joinClass(msg.name, msg.joinCode);
        sendResponse({ ok: true, className });
      } else if (msg.type === "leave") {
        await leaveClass();
        sendResponse({ ok: true });
      } else if (msg.type === "getState") {
        sendResponse({ ok: true, state: await getState() });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // async response
});
