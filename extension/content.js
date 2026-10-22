// Lightweight — just makes an active lock visually obvious on the page,
// in case navigation enforcement in background.js hasn't redirected yet.
chrome.storage.local.get(["lockedUrl"], ({ lockedUrl }) => {
  if (lockedUrl && !location.href.startsWith(lockedUrl)) {
    document.title = "Locked by teacher";
  }
});
