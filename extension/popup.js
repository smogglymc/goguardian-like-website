async function render() {
  const { ok, state } = await chrome.runtime.sendMessage({ type: "getState" });
  const joinView = document.getElementById("joinView");
  const joinedView = document.getElementById("joinedView");
  if (ok && state.joined) {
    joinView.style.display = "none";
    joinedView.style.display = "block";
    document.getElementById("status").textContent =
      `Joined as ${state.studentName} — ${state.className}. Your teacher can see your current tab while this is on.`;
  } else {
    joinView.style.display = "block";
    joinedView.style.display = "none";
  }
}

document.getElementById("joinBtn").addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim();
  const joinCode = document.getElementById("joinCode").value.trim();
  const errorEl = document.getElementById("error");
  errorEl.textContent = "";
  if (!name || !joinCode) {
    errorEl.textContent = "Enter your name and the class code.";
    return;
  }
  const res = await chrome.runtime.sendMessage({ type: "join", name, joinCode });
  if (res.ok) {
    render();
  } else {
    errorEl.textContent = res.error || "Couldn't join. Check the code.";
  }
});

document.getElementById("leaveBtn").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "leave" });
  render();
});

render();
