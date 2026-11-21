const $ = id => document.getElementById(id);
let activeTab = null;
let detectedProvider = "Other";

function showStatus(message, error = false) {
  $("status").textContent = message;
  $("status").className = error ? "error" : "";
}
function providerFor(url = "") {
  if (url.includes("claude.ai")) return "Claude";
  if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) return "ChatGPT";
  if (url.includes("gemini.google.com")) return "Gemini";
  return "Other";
}
async function loadSettings() {
  const values = await chrome.storage.local.get(["supabaseUrl","anonKey","captureToken"]);
  $("supabaseUrl").value = values.supabaseUrl || "";
  $("anonKey").value = values.anonKey || "";
  $("captureToken").value = values.captureToken || "";
}
$("settingsToggle").addEventListener("click", async () => {
  $("settingsSection").hidden = !$("settingsSection").hidden;
  $("captureSection").hidden = !$("settingsSection").hidden;
  if (!$("settingsSection").hidden) await loadSettings();
});
$("saveSettings").addEventListener("click", async () => {
  const supabaseUrl = $("supabaseUrl").value.trim().replace(/\/$/,"");
  const anonKey = $("anonKey").value.trim();
  const captureToken = $("captureToken").value.trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) || !anonKey || !captureToken.startsWith("vv_capture_")) {
    showStatus("Enter a valid Supabase URL, public anon key and VibeVault capture token.", true); return;
  }
  await chrome.storage.local.set({ supabaseUrl, anonKey, captureToken });
  showStatus("Connection saved on this browser.");
});
$("captureButton").addEventListener("click", async () => {
  $("captureButton").disabled = true;
  showStatus("Reading the open conversation…");
  try {
    const response = await chrome.tabs.sendMessage(activeTab.id, { type: "VIBEVAULT_CAPTURE_PAGE" });
    if (!response?.ok) throw new Error(response?.error || "Could not read this page.");
    const config = await chrome.storage.local.get(["supabaseUrl","anonKey","captureToken"]);
    if (!config.supabaseUrl || !config.anonKey || !config.captureToken) {
      $("settingsSection").hidden = false; $("captureSection").hidden = true;
      await loadSettings();
      throw new Error("Connect VibeVault first using Settings above.");
    }
    showStatus("Sending securely to your VibeVault Import Inbox…");
    const result = await fetch(config.supabaseUrl + "/functions/v1/capture-conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": config.anonKey, "Authorization": "Bearer " + config.captureToken },
      body: JSON.stringify(response.capture)
    });
    const payload = await result.json().catch(() => ({}));
    if (!result.ok) throw new Error(payload.error || "Capture could not be saved.");
    showStatus("Saved to your VibeVault Import Inbox. Open VibeVault to assign it to a project.");
  } catch (error) {
    showStatus(error.message || "Capture failed. Open the AI conversation and try again.", true);
  } finally { $("captureButton").disabled = false; }
});
(async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tabs[0];
  detectedProvider = providerFor(activeTab?.url || "");
  $("providerName").textContent = detectedProvider === "Other" ? "Unsupported page" : detectedProvider + " conversation";
  $("providerIcon").textContent = detectedProvider === "Other" ? "!" : "●";
  $("pageStatus").textContent = detectedProvider === "Other" ? "Supported: ChatGPT, Claude and Gemini." : "Capture the conversation currently open in this tab.";
  if (detectedProvider === "Other") $("captureButton").disabled = true;
  await loadSettings();
})();
