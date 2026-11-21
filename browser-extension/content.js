function detectProvider() {
  const host = location.hostname;
  if (host.includes("claude.ai")) return "Claude";
  if (host.includes("chatgpt.com") || host.includes("openai.com")) return "ChatGPT";
  if (host.includes("gemini.google.com")) return "Gemini";
  return "Other";
}

function cleanText(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll("button,svg,nav,textarea,input,[aria-hidden='true']").forEach(el => el.remove());
  return (clone.innerText || clone.textContent || "").trim();
}

function collectMessages() {
  const provider = detectProvider();
  let nodes = [];
  if (provider === "ChatGPT") {
    nodes = [...document.querySelectorAll("[data-message-author-role]")].map(node => ({
      role: node.getAttribute("data-message-author-role") || "message",
      content: cleanText(node)
    }));
  } else if (provider === "Claude") {
    const userNodes = [...document.querySelectorAll('[data-testid="user-message"]')];
    const assistantNodes = [...document.querySelectorAll(".font-claude-message, [data-testid*='assistant-message']")];
    nodes = [...userNodes.map(node => ({ node, role: "user" })), ...assistantNodes.map(node => ({ node, role: "assistant" }))]
      .sort((a,b) => a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
      .map(item => ({ role: item.role, content: cleanText(item.node) }));
  } else if (provider === "Gemini") {
    const userNodes = [...document.querySelectorAll("user-query, .query-text")];
    const assistantNodes = [...document.querySelectorAll("model-response, .response-content, .model-response-text")];
    nodes = [...userNodes.map(node => ({ node, role: "user" })), ...assistantNodes.map(node => ({ node, role: "assistant" }))]
      .sort((a,b) => a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
      .map(item => ({ role: item.role, content: cleanText(item.node) }));
  }
  const seen = new Set();
  return nodes.filter(item => {
    const value = (item.content || "").trim();
    if (!value || seen.has(item.role + ":" + value)) return false;
    seen.add(item.role + ":" + value);
    return true;
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "VIBEVAULT_CAPTURE_PAGE") return;
  try {
    const messages = collectMessages();
    if (!messages.length) {
      sendResponse({ ok: false, error: "No supported conversation messages were found on this page. Make sure the conversation is open and fully loaded." });
      return true;
    }
    const titleNode = document.querySelector("main h1, main h2, [data-testid='conversation-title']");
    const title = (titleNode?.innerText || document.title || "Captured conversation").replace(/\s+/g, " ").trim().slice(0, 180);
    const rawContent = messages.map(item => "## " + item.role.toUpperCase() + "\n\n" + item.content).join("\n\n---\n\n");
    sendResponse({
      ok: true,
      capture: {
        source_ai: detectProvider(),
        title,
        raw_content: rawContent,
        source_url: location.href,
        page_title: document.title,
        message_count: messages.length
      }
    });
  } catch (error) {
    sendResponse({ ok: false, error: error?.message || "Could not read this conversation." });
  }
  return true;
});
