/* ═══════════════════════════════════════════════════════════
   Travel AI — script.js
   Handles: OpenRouter API calls, chat UI, textarea resize,
            sidebar toggle, quick-start chips, new chat reset.
   ═══════════════════════════════════════════════════════════ */

// ── ① PASTE YOUR OPENROUTER API KEY HERE ──────────────────
const API_KEY = "PASTE_YOUR_API_KEY_HERE";
// ──────────────────────────────────────────────────────────

const MODEL    = "openai/gpt-oss-120b:free";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// System prompt that defines the AI's persona
const SYSTEM_PROMPT = `You are a friendly, knowledgeable travel assistant called Travel AI.
Help users with:
- Destination recommendations and itinerary planning
- Visa requirements and travel documents
- Budget tips and cost estimates
- Hotel, hostel, and accommodation advice
- Flights, trains, ferries, and local transportation
- Local cuisine, restaurants, and food culture
- Attractions, sightseeing, and off-the-beaten-path gems
- Safety tips, travel insurance, and health precautions
- Best time to visit, weather, and packing tips
- Cultural etiquette and local customs

Always be warm, practical, and specific. When listing things, use clear formatting.
If you don't know something, say so honestly and suggest where the user can find accurate info.`;

// ── DOM references ─────────────────────────────────────────
const chatWindow    = document.getElementById("chatWindow");
const messagesEl    = document.getElementById("messages");
const userInput     = document.getElementById("userInput");
const sendBtn       = document.getElementById("sendBtn");
const emptyState    = document.getElementById("emptyState");
const newChatBtn    = document.getElementById("newChatBtn");
const topbarNew     = document.getElementById("topbarNew");
const menuToggle    = document.getElementById("menuToggle");
const sidebar       = document.querySelector(".sidebar");
const overlay       = document.getElementById("sidebarOverlay");
const starterList   = document.getElementById("starterList");

// ── Conversation history (sent to API each time) ───────────
let history = []; // [{role: "user"|"assistant", content: "..."}]
let isLoading = false;

/* ═══════════════════════════════════════════════════════════
   API — Send messages to OpenRouter
   ═══════════════════════════════════════════════════════════ */
async function callOpenRouter(messages) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
      "HTTP-Referer": window.location.href,   // required by OpenRouter
      "X-Title": "Travel AI"                 // shows in your OpenRouter dashboard
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    // Parse error details if available
    let errMsg = `API error ${response.status}`;
    try {
      const errData = await response.json();
      errMsg = errData?.error?.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response. Please try again.";
}

/* ═══════════════════════════════════════════════════════════
   UI — Render helpers
   ═══════════════════════════════════════════════════════════ */

/** Hide the empty welcome state once the first message is sent */
function hideEmptyState() {
  if (emptyState) {
    emptyState.style.display = "none";
  }
}

/** Append a message bubble to the chat */
function appendMessage(role, text) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  if (role === "ai") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "🌍";
    row.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  // Convert markdown-ish line breaks to readable text (basic formatting)
  bubble.textContent = text;
  row.appendChild(bubble);

  messagesEl.appendChild(row);
  scrollToBottom();
  return bubble;
}

/** Show the typing/loading dots */
function showTyping() {
  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  indicator.id = "typingIndicator";

  const avatar = document.createElement("div");
  avatar.className = "typing-avatar";
  avatar.textContent = "🌍";

  const dots = document.createElement("div");
  dots.className = "typing-dots";
  dots.innerHTML = "<span></span><span></span><span></span>";

  indicator.appendChild(avatar);
  indicator.appendChild(dots);
  messagesEl.appendChild(indicator);
  scrollToBottom();
}

/** Remove the typing indicator */
function hideTyping() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) indicator.remove();
}

/** Show an inline error message */
function showError(message) {
  const el = document.createElement("div");
  el.className = "error-bubble";
  el.textContent = `⚠️ ${message}`;
  messagesEl.appendChild(el);
  scrollToBottom();
}

/** Scroll the chat window to the latest message */
function scrollToBottom() {
  chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: "smooth" });
}

/* ═══════════════════════════════════════════════════════════
   Core — Send a message
   ═══════════════════════════════════════════════════════════ */
async function sendMessage(text) {
  text = text.trim();
  if (!text || isLoading) return;

  // Guard: API key not set
  if (API_KEY === "PASTE_YOUR_API_KEY_HERE") {
    hideEmptyState();
    appendMessage("user", text);
    showError("Please open script.js and paste your OpenRouter API key into the API_KEY variable at the top of the file.");
    return;
  }

  isLoading = true;
  sendBtn.disabled = true;
  userInput.value = "";
  autoResize();

  // Show user bubble
  hideEmptyState();
  appendMessage("user", text);

  // Add to history
  history.push({ role: "user", content: text });

  // Show typing indicator
  showTyping();

  try {
    const aiText = await callOpenRouter(history);
    hideTyping();
    appendMessage("ai", aiText);
    history.push({ role: "assistant", content: aiText });
  } catch (err) {
    hideTyping();
    showError(err.message || "Something went wrong. Please check your API key and try again.");
    // Remove the last user message from history so user can retry
    history.pop();
  } finally {
    isLoading = false;
    sendBtn.disabled = userInput.value.trim().length === 0;
    userInput.focus();
  }
}

/* ═══════════════════════════════════════════════════════════
   UI — Textarea auto-resize
   ═══════════════════════════════════════════════════════════ */
function autoResize() {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 180) + "px";
}

/* ═══════════════════════════════════════════════════════════
   UI — Reset / new chat
   ═══════════════════════════════════════════════════════════ */
function resetChat() {
  history = [];
  messagesEl.innerHTML = "";
  if (emptyState) emptyState.style.display = "";
  userInput.value = "";
  autoResize();
  sendBtn.disabled = true;
  userInput.focus();
}

/* ═══════════════════════════════════════════════════════════
   UI — Sidebar (mobile)
   ═══════════════════════════════════════════════════════════ */
function openSidebar() {
  sidebar.classList.add("open");
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("active");
  document.body.style.overflow = "";
}

/* ═══════════════════════════════════════════════════════════
   Event listeners
   ═══════════════════════════════════════════════════════════ */

// Input field: enable/disable send button, auto-resize
userInput.addEventListener("input", () => {
  autoResize();
  sendBtn.disabled = userInput.value.trim().length === 0 || isLoading;
});

// Enter = send (Shift+Enter = new line)
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage(userInput.value);
  }
});

// Send button click
sendBtn.addEventListener("click", () => {
  if (!sendBtn.disabled) sendMessage(userInput.value);
});

// New chat buttons
newChatBtn.addEventListener("click", () => {
  resetChat();
  closeSidebar();
});

topbarNew.addEventListener("click", () => {
  resetChat();
});

// Mobile menu toggle
menuToggle.addEventListener("click", openSidebar);
overlay.addEventListener("click", closeSidebar);

// Quick-start chips in the empty state
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip) {
    const prompt = chip.getAttribute("data-prompt");
    if (prompt) sendMessage(prompt);
  }
});

// Sidebar starter items
starterList.addEventListener("click", (e) => {
  const item = e.target.closest(".starter-item");
  if (item) {
    const prompt = item.getAttribute("data-prompt");
    if (prompt) {
      closeSidebar();
      sendMessage(prompt);
    }
  }
});

// ── Init ───────────────────────────────────────────────────
userInput.focus();
