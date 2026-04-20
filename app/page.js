"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";

const API_BASE = "https://4f6xtlx225.execute-api.us-west-2.amazonaws.com/prod";
// WebSocket URL — fill this in after deploying the WebSocket API Gateway
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "";

// ── Icons ─────────────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SkynetLogo() {
  return (
    <div style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 4px", background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 28px rgba(13,148,136,0.5)" }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    </div>
  );
}

// ── localStorage helpers ──────────────────────────────────────────────────────

// --- Inbox (unread notifications) ---
function inboxKey(u) { return `skynet_inbox_${u.toLowerCase()}`; }

function pushToInbox(toUser, convId, fromUser, preview) {
  try {
    const key = inboxKey(toUser);
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const prev = existing.find((e) => e.convId === convId);
    const filtered = existing.filter((e) => e.convId !== convId);
    filtered.unshift({ convId, from: fromUser, preview, ts: Date.now(), count: (prev?.count || 0) + 1 });
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch {}
}

function readInbox(username) {
  try { return JSON.parse(localStorage.getItem(inboxKey(username)) || "[]"); } catch { return []; }
}

function clearInboxEntry(username, convId) {
  try {
    const key = inboxKey(username);
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    localStorage.setItem(key, JSON.stringify(existing.filter((e) => e.convId !== convId)));
  } catch {}
}

// --- Message previews (last message per conversation) ---
function previewKey(convId) { return `skynet_preview_${convId}`; }

function setPreview(convId, sender, text) {
  try { localStorage.setItem(previewKey(convId), JSON.stringify({ sender, text, ts: Date.now() })); } catch {}
}

function getPreview(convId) {
  try { return JSON.parse(localStorage.getItem(previewKey(convId)) || "null"); } catch { return null; }
}

// --- Typing indicator ---
function typingKey(convId) { return `skynet_typing_${convId}`; }

function setTypingIndicator(convId, username) {
  try { localStorage.setItem(typingKey(convId), JSON.stringify({ user: username, ts: Date.now() })); } catch {}
}

function clearTypingIndicator(convId) {
  try { localStorage.removeItem(typingKey(convId)); } catch {}
}

function getTypingUser(convId, myUsername) {
  try {
    const raw = localStorage.getItem(typingKey(convId));
    if (!raw) return null;
    const { user, ts } = JSON.parse(raw);
    if (user === myUsername) return null;          // ignore my own
    if (Date.now() - ts > 4000) return null;       // stale
    return user;
  } catch { return null; }
}

// --- Presence (online/offline) ---
function presenceKey(u) { return `skynet_presence_${u.toLowerCase()}`; }

function heartbeat(username) {
  try { localStorage.setItem(presenceKey(username), JSON.stringify({ ts: Date.now() })); } catch {}
}

function isOnline(username) {
  try {
    const raw = localStorage.getItem(presenceKey(username));
    if (!raw) return false;
    return Date.now() - JSON.parse(raw).ts < 12000; // 12s window
  } catch { return false; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatName(name) {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Avatar({ name, size = 32 }) {
  const colors = ["#0d9488", "#3b82f6", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6"];
  const bg = name ? colors[name.charCodeAt(0) % colors.length] : "#334155";
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 700, color: "#fff", flexShrink: 0, userSelect: "none" }}>
      {name ? name.charAt(0).toUpperCase() : "?"}
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }`}</style>
    </span>
  );
}

// ── Themes ────────────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    bg: "#0f172a",
    sidebar: "#1e293b",
    border: "rgba(148,163,184,0.15)",
    borderFaint: "rgba(148,163,184,0.08)",
    inputBg: "#1e293b",
    text: "#f1f5f9",
    textMuted: "#94a3b8",
    textFaint: "#475569",
    msgTheirs: "#1e293b",
    msgTheirsText: "#e2e8f0",
    msgTheirsBorder: "rgba(148,163,184,0.12)",
    hover: "rgba(148,163,184,0.08)",
    hoverFaint: "rgba(148,163,184,0.05)",
    activeConv: "rgba(13,148,136,0.18)",
    menuBg: "#1e293b",
    headerBg: "rgba(15,23,42,0.85)",
    onlineBorder: "#1e293b",
    signInBg: "linear-gradient(160deg, #0a1628 0%, #0f172a 60%, #0c1a2e 100%)",
    cardBg: "rgba(15,23,42,0.92)",
    cardBorder: "rgba(148,163,184,0.12)",
    summaryBg: "rgba(13,148,136,0.1)",
    summaryBorder: "rgba(13,148,136,0.25)",
    summaryText: "#ccfbf1",
    summaryLabel: "#5eead4",
    convNameActive: "#5eead4",
    convNameUnread: "#f1f5f9",
    convNameRead: "#cbd5e1",
  },
  light: {
    bg: "#fafaf8",
    sidebar: "#f0ede8",
    border: "rgba(0,0,0,0.08)",
    borderFaint: "rgba(0,0,0,0.05)",
    inputBg: "#ffffff",
    text: "#37352f",
    textMuted: "#6b6860",
    textFaint: "#9b9690",
    msgTheirs: "#ffffff",
    msgTheirsText: "#37352f",
    msgTheirsBorder: "rgba(0,0,0,0.06)",
    hover: "rgba(0,0,0,0.05)",
    hoverFaint: "rgba(0,0,0,0.03)",
    activeConv: "rgba(13,148,136,0.1)",
    menuBg: "#ffffff",
    headerBg: "rgba(250,250,248,0.95)",
    onlineBorder: "#f0ede8",
    signInBg: "linear-gradient(160deg, #ede9e3 0%, #fafaf8 60%, #e8e4de 100%)",
    cardBg: "rgba(255,255,255,0.97)",
    cardBorder: "rgba(0,0,0,0.08)",
    summaryBg: "rgba(13,148,136,0.07)",
    summaryBorder: "rgba(13,148,136,0.2)",
    summaryText: "#37352f",
    summaryLabel: "#0d9488",
    convNameActive: "#0d9488",
    convNameUnread: "#37352f",
    convNameRead: "#6b6860",
  },
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Home() {
  const auth = useAuth();

  const [screen, setScreen] = useState("loading");
  const [darkMode, setDarkMode] = useState(false);
  const [username, setUsername] = useState("");
  const [draftUsername, setDraftUsername] = useState("");
  const [savedUser, setSavedUser] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [chatPartner, setChatPartner] = useState("");
  const [openChatInput, setOpenChatInput] = useState("");
  const [activeChatMenu, setActiveChatMenu] = useState(null);
  const [chatMenuPosition, setChatMenuPosition] = useState({ x: 0, y: 0 });

  // Day 1-2 state
  const [unreadCounts, setUnreadCounts] = useState({});
  const [previews, setPreviews] = useState({});
  const [typingUser, setTypingUser] = useState(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [deliveredIds, setDeliveredIds] = useState(new Set());
  const [sending, setSending] = useState(false);

  // Day 5 — Group chat state
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groupLoading, setGroupLoading] = useState(false);

  // ── Cognito / registration state ──────────────────────────────────────────
  const [cognitoEmail, setCognitoEmail] = useState("");
  const [draftPickUsername, setDraftPickUsername] = useState("");
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftDOB, setDraftDOB] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [usernameHint, setUsernameHint] = useState("");

  const bottomRef = useRef(null);
  const menuRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const typingTimerRef = useRef(null);
  const conversationIdRef = useRef(conversationId);
  const usernameRef = useRef(username);
  const wsRef = useRef(null);          // active WebSocket instance
  const wsReadyRef = useRef(false);    // true once WS is open

  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { usernameRef.current = username; }, [username]);

  const buildConversationId = (a, b) =>
    [a.trim().toLowerCase(), b.trim().toLowerCase()].sort().join("__");

  const getOtherUser = (id, me) => {
    if (!id || !me || !id.includes("__")) return "";
    return id.split("__").find((p) => p !== me.trim().toLowerCase()) || "";
  };

  // ── Theme restore (runs once on mount) ────────────────────────────────────

  useEffect(() => {
    const savedTheme = localStorage.getItem("skynet_theme");
    if (savedTheme) setDarkMode(savedTheme === "dark");
  }, []);

  // ── Session init helper ────────────────────────────────────────────────────

  const initSession = (usernameClean) => {
    const existingChats = JSON.parse(localStorage.getItem(`skynet_conversations_${usernameClean}`) || "[]");
    const cachedGroups = JSON.parse(localStorage.getItem(`skynet_groups_${usernameClean}`) || "[]");
    localStorage.setItem("skynet_username", usernameClean);
    setSavedUser(usernameClean);
    setUsername(usernameClean);
    setDraftUsername(usernameClean);
    setConversationId(existingChats[0] || "");
    setConversations(existingChats);
    if (existingChats[0]) setChatPartner(getOtherUser(existingChats[0], usernameClean));
    setMessages([]);
    setSummary("");
    setUnreadCounts({});
    setPreviews({});
    setGroups(cachedGroups);
    setCurrentGroup(null);
    setScreen("chat");
  };

  // ── Cognito auth → profile lookup ──────────────────────────────────────────

  useEffect(() => {
    if (auth.isLoading) return;

    if (!auth.isAuthenticated) {
      // Not signed in yet — show sign-in screen
      setScreen("signin");
      return;
    }

    // Signed in — look up their Skynet profile
    const email = auth.user?.profile?.email;
    if (!email) { setScreen("signin"); return; }

    setCognitoEmail(email);
    setDraftDisplayName(auth.user?.profile?.name || "");
    setProfileLoading(true);

    fetch(`${API_BASE}/auth/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.username) {
          initSession(data.username.toLowerCase());
        } else {
          setScreen("username-picker");
        }
      })
      .catch(() => setScreen("username-picker"))
      .finally(() => setProfileLoading(false));
  }, [auth.isLoading, auth.isAuthenticated]);

  // ── Username availability debounce ─────────────────────────────────────────

  useEffect(() => {
    setUsernameAvailable(null);
    setUsernameHint("");
    if (!draftPickUsername) return;
    if (!/^[a-z0-9_]{3,20}$/.test(draftPickUsername.toLowerCase())) {
      setUsernameHint("3–20 chars, letters / numbers / underscores only");
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const r = await fetch(`${API_BASE}/auth/check-username`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: draftPickUsername.toLowerCase() }),
        });
        const data = await r.json();
        setUsernameAvailable(data.available);
        setUsernameHint(data.available ? "Username is available!" : (data.reason || "Username already taken"));
      } catch {
        setUsernameHint("Couldn't check — try again");
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [draftPickUsername]);

  // ── Close menus on outside click ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
      setActiveChatMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch messages on conversation change ──────────────────────────────────

  useEffect(() => {
    if (!conversationId) return;
    fetchMessages();
  }, [conversationId]);

  // ── WebSocket connection ───────────────────────────────────────────────────

  useEffect(() => {
    if (!username || screen !== "chat" || !WS_BASE) return;

    const url = `${WS_BASE}?username=${encodeURIComponent(username)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    wsReadyRef.current = false;

    ws.onopen = () => {
      wsReadyRef.current = true;
    };

    ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        if (type === "message" && data.conversationId === conversationIdRef.current) {
          // Instant delivery — merge into message list without waiting for poll
          setMessages((prev) => {
            const exists = prev.some((m) => m.messageId === data.messageId);
            if (exists) return prev;
            const normalized = { ...data, senderId: (data.senderId || "").toLowerCase() };
            return [...prev, normalized];
          });
        }
        if (type === "message") {
          // Update sidebar preview + unread for any conversation
          const me = usernameRef.current;
          const convId = data.conversationId;
          const sender = (data.senderId || "").toLowerCase();
          setPreview(convId, sender, data.content);
          setPreviews((prev) => ({ ...prev, [convId]: { sender, text: data.content, ts: Date.now() } }));
          if (sender !== me) {
            setUnreadCounts((prev) => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }));
          }
        }
      } catch {}
    };

    ws.onclose = () => { wsReadyRef.current = false; };
    ws.onerror = () => { wsReadyRef.current = false; };

    return () => {
      ws.close();
      wsRef.current = null;
      wsReadyRef.current = false;
    };
  }, [username, screen]);

  // ── Poll messages (slower when WS is active, fallback otherwise) ───────────

  useEffect(() => {
    if (!conversationId || screen !== "chat") return;
    // Poll at 1.5s always as safety net (WS handles instant delivery)
    const interval = setInterval(fetchMessages, 1500);
    return () => clearInterval(interval);
  }, [conversationId, screen]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]);

  // ── Heartbeat (presence) ───────────────────────────────────────────────────

  useEffect(() => {
    if (!username || screen !== "chat") return;
    heartbeat(username);
    const interval = setInterval(() => heartbeat(usernameRef.current), 5000);
    return () => clearInterval(interval);
  }, [username, screen]);

  // ── Poll presence + typing for current conversation ────────────────────────

  useEffect(() => {
    if (!conversationId || !username || screen !== "chat") return;
    const interval = setInterval(() => {
      const partner = getOtherUser(conversationIdRef.current, usernameRef.current);
      if (partner) setPartnerOnline(isOnline(partner));
      setTypingUser(getTypingUser(conversationIdRef.current, usernameRef.current));
    }, 800);
    return () => clearInterval(interval);
  }, [conversationId, username, screen]);

  // ── Instant typing + presence via storage event ────────────────────────────

  useEffect(() => {
    if (!username || screen !== "chat") return;
    const handler = (e) => {
      const convId = conversationIdRef.current;
      const me = usernameRef.current;
      if (e.key === typingKey(convId)) {
        setTypingUser(getTypingUser(convId, me));
      }
      if (e.key === inboxKey(me)) {
        syncInbox(me);
      }
      const partner = getOtherUser(convId, me);
      if (partner && e.key === presenceKey(partner)) {
        setPartnerOnline(isOnline(partner));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [username, screen]);

  // ── Inbox sync ─────────────────────────────────────────────────────────────

  const syncInbox = (currentUser) => {
    const inbox = readInbox(currentUser);

    // Auto-add unknown convos to sidebar
    setConversations((prev) => {
      const newOnes = inbox.map((e) => e.convId).filter((id) => !prev.includes(id));
      if (newOnes.length === 0) return prev;
      const updated = [...newOnes, ...prev];
      localStorage.setItem(`skynet_conversations_${usernameRef.current}`, JSON.stringify(updated));
      return updated;
    });

    // Update unread counts
    const counts = {};
    inbox.forEach((e) => { counts[e.convId] = e.count || 1; });
    setUnreadCounts(counts);

    // Update previews from inbox
    setPreviews((prev) => {
      const next = { ...prev };
      inbox.forEach((e) => { next[e.convId] = { sender: e.from, text: e.preview, ts: e.ts }; });
      return next;
    });
  };

  useEffect(() => {
    if (!username || screen !== "chat") return;
    syncInbox(username);
    const interval = setInterval(() => syncInbox(usernameRef.current), 2000);
    return () => clearInterval(interval);
  }, [username, screen]);

  // ── Load previews for known conversations on mount ─────────────────────────

  useEffect(() => {
    if (!conversations.length) return;
    setPreviews((prev) => {
      const next = { ...prev };
      conversations.forEach((id) => {
        if (!next[id]) {
          const p = getPreview(id);
          if (p) next[id] = p;
        }
      });
      return next;
    });
  }, [conversations]);

  // ── API calls ──────────────────────────────────────────────────────────────

  const fetchMessages = async () => {
    const convId = conversationIdRef.current;
    const me = usernameRef.current;
    if (!convId) return;
    try {
      const res = await fetch(`${API_BASE}/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId }),
      });
      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data.map((msg) => ({ ...msg, senderId: (msg.senderId || "").trim().toLowerCase() }))
        : [];

      setMessages((prev) => {
        const prevStr = JSON.stringify(prev);
        const nextStr = JSON.stringify(normalized);
        if (prevStr === nextStr) return prev;
        // Mark all server-confirmed messages as delivered
        setDeliveredIds((d) => {
          const next = new Set(d);
          normalized.forEach((m) => { if (m.messageId) next.add(m.messageId); });
          return next;
        });
        return normalized;
      });

      // Update preview for this conversation
      if (normalized.length > 0) {
        const last = normalized[normalized.length - 1];
        setPreview(convId, last.senderId, last.content);
        setPreviews((prev) => ({ ...prev, [convId]: { sender: last.senderId, text: last.content, ts: last.timestamp } }));
      }

      // Mark as read since we're looking at it
      clearInboxEntry(me, convId);
      setUnreadCounts((prev) => { const next = { ...prev }; delete next[convId]; return next; });
    } catch {
      // keep existing messages on error
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || !username || sending) return;
    const content = input.trim();
    const me = username.trim().toLowerCase();
    setInput("");
    setSending(true);
    clearTypingIndicator(conversationId);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    const tempId = `temp-${Date.now()}`;
    const optimistic = { senderId: me, content, timestamp: Date.now(), messageId: tempId };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const payload = { conversationId, senderId: me, content };

      if (wsRef.current && wsReadyRef.current) {
        // Send via WebSocket — server saves to DynamoDB + pushes to recipient
        wsRef.current.send(JSON.stringify({ action: "sendMessage", ...payload }));
      } else {
        // Fallback to HTTP API
        await fetch(`${API_BASE}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      // Update preview locally
      setPreview(conversationId, me, content);
      setPreviews((prev) => ({ ...prev, [conversationId]: { sender: me, text: content, ts: Date.now() } }));

      // Push to other user's localStorage inbox (for sidebar badge)
      const other = getOtherUser(conversationId, me);
      if (other) pushToInbox(other, conversationId, me, content);

      await fetchMessages();
    } catch {
      setMessages((prev) => prev.filter((m) => m.messageId !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file || !conversationId || !username) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "heic" || ext === "heif" || file.type === "image/heic" || file.type === "image/heif") {
      alert("HEIC/HEIF images aren't supported by browsers. Please convert to JPG or PNG first (on iPhone: Settings → Camera → Formats → Most Compatible).");
      return;
    }
    const me = username.trim().toLowerCase();

    // Show a local placeholder while uploading
    const tempId = `temp-${Date.now()}`;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    setMessages((prev) => [...prev, {
      senderId: me, content: `[Uploading ${file.name}…]`,
      timestamp: Date.now(), messageId: tempId, uploading: true,
    }]);

    try {
      // 1. Get presigned upload URL
      const res = await fetch(`${API_BASE}/media/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const { uploadUrl, publicUrl } = await res.json();

      // 2. Upload file directly to S3
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      // 3. Send the public URL as the message content
      const mediaContent = isImage ? `[img]${publicUrl}` : isVideo ? `[vid]${publicUrl}` : `[file]${file.name}|${publicUrl}`;

      const payload = { conversationId, senderId: me, content: mediaContent };
      if (wsRef.current && wsReadyRef.current) {
        wsRef.current.send(JSON.stringify({ action: "sendMessage", ...payload }));
      } else {
        await fetch(`${API_BASE}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }

      const other = getOtherUser(conversationId, me);
      if (other) pushToInbox(other, conversationId, me, `📎 ${file.name}`);

      setMessages((prev) => prev.filter((m) => m.messageId !== tempId));
      await fetchMessages();
    } catch {
      setMessages((prev) => prev.filter((m) => m.messageId !== tempId));
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!conversationId || !username) return;

    setTypingIndicator(conversationId, username);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      clearTypingIndicator(conversationId);
    }, 3000);
  };

  const summarizeConversation = async () => {
    if (messages.length === 0 || summarizing) return;
    setSummarizing(true);
    setSummary("");
    const text = messages.map((m) => `${m.senderId}: ${m.content}`).join("\n");
    try {
      const res = await fetch(`${API_BASE}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "summarize", text }),
      });
      const data = await res.json();
      const summaryText = data?.result || data?.summary || data?.output || data?.message || (typeof data === "string" ? data : "");
      setSummary(summaryText || "Summary could not be generated.");
    } catch {
      setSummary("Failed to summarize the conversation.");
    } finally {
      setSummarizing(false);
    }
  };

  // ── Group API ─────────────────────────────────────────────────────────────

  const fetchGroups = async (user) => {
    try {
      const res = await fetch(`${API_BASE}/group/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user }),
      });
      const data = await res.json();
      // Only update if we got a real array back — don't wipe cache on API errors
      if (Array.isArray(data)) {
        setGroups(data);
        localStorage.setItem(`skynet_groups_${user}`, JSON.stringify(data));
      }
    } catch {}
  };

  const selectGroup = (group) => {
    setConversationId(group.groupId);
    setCurrentGroup(group);
    setChatPartner("");
    setMessages([]);
    setSummary("");
    clearInboxEntry(username, group.groupId);
    setUnreadCounts((prev) => { const next = { ...prev }; delete next[group.groupId]; return next; });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || groupLoading) return;
    setGroupLoading(true);
    try {
      const members = groupMembers.split(",").map((m) => m.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE}/group/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName: groupName.trim(), createdBy: username, members }),
      });
      const data = await res.json();
      if (data.group) {
        setGroups((prev) => {
          const updated = [data.group, ...prev];
          localStorage.setItem(`skynet_groups_${username}`, JSON.stringify(updated));
          return updated;
        });
        selectGroup(data.group);
        setShowCreateGroup(false);
        setGroupName("");
        setGroupMembers("");
      }
    } catch {} finally {
      setGroupLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim() || groupLoading) return;
    setGroupLoading(true);
    try {
      const res = await fetch(`${API_BASE}/group/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: joinCode.trim().toLowerCase(), username }),
      });
      const data = await res.json();
      if (data.group) {
        setGroups((prev) => {
          const exists = prev.find((g) => g.groupId === data.group.groupId);
          const updated = exists ? prev.map((g) => g.groupId === data.group.groupId ? data.group : g) : [data.group, ...prev];
          localStorage.setItem(`skynet_groups_${username}`, JSON.stringify(updated));
          return updated;
        });
        selectGroup(data.group);
        setShowJoinGroup(false);
        setJoinCode("");
      } else {
        alert(data.message || "Group not found. Check the code.");
      }
    } catch {} finally {
      setGroupLoading(false);
    }
  };

  // ── Auth ───────────────────────────────────────────────────────────────────

  // Fetch groups when user logs in
  useEffect(() => {
    if (!username || screen !== "chat") return;
    fetchGroups(username);
  }, [username, screen]);

  // When a WS group message arrives, refresh that group's info if needed
  useEffect(() => {
    if (!username || screen !== "chat" || !groups.length) return;
    const activeGroupIds = new Set(groups.map((g) => g.groupId));
    if (conversationId && conversationId.startsWith("grp_") && !activeGroupIds.has(conversationId)) {
      fetchGroups(username);
    }
  }, [conversationId]);

  const handleRegister = async () => {
    const clean = draftPickUsername.trim().toLowerCase();
    if (!clean || !draftDisplayName.trim() || !draftDOB || !usernameAvailable || registerLoading) return;
    setRegisterLoading(true);
    try {
      const r = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cognitoEmail,
          username: clean,
          name: draftDisplayName.trim(),
          birthdate: draftDOB,
        }),
      });
      const data = await r.json();
      if (data.username) {
        initSession(data.username.toLowerCase());
      } else {
        alert(data.message || "Registration failed. Try a different username.");
      }
    } catch {
      alert("Network error — please try again.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleLogout = () => {
    if (username) clearTypingIndicator(conversationId);
    localStorage.removeItem("skynet_username");
    setUsername(""); setDraftUsername(""); setConversationId("");
    setConversations([]); setMessages([]); setSummary("");
    setChatPartner(""); setOpenChatInput(""); setShowMenu(false);
    setActiveChatMenu(null); setUnreadCounts({}); setPreviews({});
    setCognitoEmail(""); setDraftPickUsername(""); setDraftDisplayName(""); setDraftDOB("");
    setScreen("signin");
    auth.removeUser();
  };

  // ── Conversation management ────────────────────────────────────────────────

  const openDirectChat = (partnerOverride) => {
    const partner = (partnerOverride || openChatInput).trim();
    if (!username.trim() || !partner) return;
    const other = partner.toLowerCase();
    const me = username.trim().toLowerCase();
    if (other === me) return;
    const directId = buildConversationId(me, other);
    const updated = conversations.includes(directId) ? conversations : [directId, ...conversations];
    setConversationId(directId);
    setConversations(updated);
    setChatPartner(other);
    setMessages([]); setSummary(""); setOpenChatInput(""); setShowMenu(false);
    clearInboxEntry(me, directId);
    setUnreadCounts((prev) => { const next = { ...prev }; delete next[directId]; return next; });
    localStorage.setItem(`skynet_conversations_${usernameRef.current}`, JSON.stringify(updated));
  };

  const selectConversation = (id) => {
    const other = getOtherUser(id, username);
    setConversationId(id);
    setSummary("");
    setChatPartner(other || "");
    setCurrentGroup(null);
    clearInboxEntry(username, id);
    setUnreadCounts((prev) => { const next = { ...prev }; delete next[id]; return next; });
    closeChatMenu();
  };

  const clearChat = () => { setMessages([]); setSummary(""); setInput(""); setShowMenu(false); };

  const removeChat = (chatId) => {
    const updated = conversations.filter((id) => id !== chatId);
    setConversations(updated);
    localStorage.setItem(`skynet_conversations_${usernameRef.current}`, JSON.stringify(updated));
    if (conversationId === chatId) {
      const nextId = updated[0] || "";
      setConversationId(nextId);
      setChatPartner(nextId ? getOtherUser(nextId, username) : "");
      setMessages([]); setSummary(""); setInput("");
    }
    closeChatMenu();
  };

  const pinChat = (chatId) => {
    const updated = [chatId, ...conversations.filter((id) => id !== chatId)];
    setConversations(updated);
    localStorage.setItem(`skynet_conversations_${usernameRef.current}`, JSON.stringify(updated));
    closeChatMenu();
  };

  // ── Chat menu ──────────────────────────────────────────────────────────────

  const openChatMenu = (e, chatId) => {
    e.preventDefault(); e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    let x = rect.right - 200, y = rect.bottom + 6;
    if (x < 12) x = 12;
    if (y + 200 > window.innerHeight - 12) y = Math.max(12, window.innerHeight - 212);
    setActiveChatMenu(chatId);
    setChatMenuPosition({ x, y });
  };

  const closeChatMenu = () => setActiveChatMenu(null);

  const t = THEMES[darkMode ? "dark" : "light"];

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("skynet_theme", next ? "dark" : "light");
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING SCREEN
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "loading" || auth.isLoading || profileLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: t.signInBg }}>
        <div style={{ textAlign: "center" }}>
          <SkynetLogo />
          <div style={{ height: 16 }} />
          <div style={{ color: t.textMuted, fontSize: 14 }}>Loading…</div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SIGN-IN SCREEN
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "signin") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 16px", background: t.signInBg }}>
        <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ width: "100%", maxWidth: 400, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 24, padding: 36, backdropFilter: "blur(16px)", boxShadow: darkMode ? "0 32px 80px rgba(0,0,0,0.6)" : "0 32px 80px rgba(0,0,0,0.1)" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <SkynetLogo />
            <div style={{ height: 12 }} />
            <h1 style={{ color: t.text, fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>Skynet</h1>
            <p style={{ color: t.textMuted, fontSize: 13, marginTop: 6 }}>Serverless · Scalable · Secure</p>
          </div>

          {auth.error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#ef4444", fontSize: 13 }}>
              {auth.error.message}
            </div>
          )}

          {/* Sign in with Google */}
          <button
            onClick={() => auth.signinRedirect({ extraQueryParams: { identity_provider: "Google" } })}
            style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontWeight: 600, fontSize: 15, cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxSizing: "border-box" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0d9488"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: t.border }} />
            <span style={{ color: t.textFaint, fontSize: 12 }}>or</span>
            <div style={{ flex: 1, height: 1, background: t.border }} />
          </div>

          {/* Sign in with Email */}
          <button
            onClick={() => auth.signinRedirect()}
            style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 16px rgba(13,148,136,0.35)", boxSizing: "border-box" }}
          >
            Sign in with Email
          </button>

          <p style={{ color: t.textFaint, fontSize: 12, textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
            New here? Click either button to create an account or sign in.
          </p>
        </div>
        <p style={{ color: t.textFaint, fontSize: 12, marginTop: 24 }}>Skynet — Serverless Messaging © 2025</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USERNAME PICKER SCREEN (after first Cognito login, no profile yet)
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "username-picker") {
    const canSubmit = draftPickUsername && draftDisplayName.trim() && draftDOB && usernameAvailable === true && !registerLoading;
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 16px", background: t.signInBg }}>
        <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ width: "100%", maxWidth: 420, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 24, padding: 36, backdropFilter: "blur(16px)", boxShadow: darkMode ? "0 32px 80px rgba(0,0,0,0.6)" : "0 32px 80px rgba(0,0,0,0.1)" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <SkynetLogo />
            <div style={{ height: 12 }} />
            <h1 style={{ color: t.text, fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>Set up your profile</h1>
            <p style={{ color: t.textMuted, fontSize: 13, marginTop: 6 }}>Just a few details to get started</p>
          </div>

          {/* Username */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", color: t.textMuted, fontSize: 12, marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em" }}>USERNAME</label>
            <input
              value={draftPickUsername}
              onChange={(e) => setDraftPickUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              autoFocus
              placeholder="e.g. john_doe"
              maxLength={20}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 12, background: t.inputBg, color: t.text, border: `1px solid ${usernameAvailable === true ? "#22c55e" : usernameAvailable === false ? "#ef4444" : t.border}`, outline: "none", fontSize: 15, boxSizing: "border-box" }}
            />
            {draftPickUsername && (
              <div style={{ marginTop: 5, fontSize: 12, color: usernameAvailable === true ? "#22c55e" : usernameAvailable === false ? "#ef4444" : t.textFaint }}>
                {checkingUsername ? "Checking…" : usernameHint}
              </div>
            )}
          </div>

          {/* Display name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", color: t.textMuted, fontSize: 12, marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em" }}>DISPLAY NAME</label>
            <input
              value={draftDisplayName}
              onChange={(e) => setDraftDisplayName(e.target.value)}
              placeholder="Your full name"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 12, background: t.inputBg, color: t.text, border: `1px solid ${t.border}`, outline: "none", fontSize: 15, boxSizing: "border-box" }}
              onFocus={(e) => (e.target.style.borderColor = "#0d9488")}
              onBlur={(e) => (e.target.style.borderColor = t.border)}
            />
          </div>

          {/* Date of birth */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", color: t.textMuted, fontSize: 12, marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em" }}>DATE OF BIRTH</label>
            <input
              type="date"
              value={draftDOB}
              onChange={(e) => setDraftDOB(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 12, background: t.inputBg, color: t.text, border: `1px solid ${t.border}`, outline: "none", fontSize: 15, boxSizing: "border-box" }}
              onFocus={(e) => (e.target.style.borderColor = "#0d9488")}
              onBlur={(e) => (e.target.style.borderColor = t.border)}
            />
          </div>

          <button
            onClick={handleRegister}
            disabled={!canSubmit}
            style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: canSubmit ? "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" : t.border, color: canSubmit ? "#fff" : t.textFaint, fontWeight: 600, fontSize: 15, cursor: canSubmit ? "pointer" : "default", boxShadow: canSubmit ? "0 4px 16px rgba(13,148,136,0.35)" : "none", transition: "all 0.2s" }}
          >
            {registerLoading ? "Creating account…" : "Create my account"}
          </button>

          <p style={{ color: t.textFaint, fontSize: 11, textAlign: "center", marginTop: 14 }}>Signed in as {cognitoEmail}</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHAT SCREEN
  // ─────────────────────────────────────────────────────────────────────────

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: t.bg }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${t.border}`, background: t.sidebar, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

        {/* Sidebar header */}
        <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <Avatar name={username} size={36} />
              <span style={{ position: "absolute", bottom: 1, right: 1, width: 9, height: 9, borderRadius: "50%", background: "#22c55e", border: `2px solid ${t.sidebar}` }} />
            </div>
            <div>
              <div style={{ color: t.text, fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                {formatName(username)}
                {totalUnread > 0 && (
                  <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: "50%", minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </div>
              <div style={{ color: "#22c55e", fontSize: 11, fontWeight: 500 }}>Online</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Theme toggle */}
            <button onClick={toggleTheme} title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: t.textMuted, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.hover; e.currentTarget.style.color = t.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = t.textMuted; }}>
              {darkMode ? "☀️" : "🌙"}
            </button>

            <div style={{ position: "relative" }} ref={menuRef}>
              <button onClick={() => setShowMenu((p) => !p)} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: t.textMuted, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = t.hover; e.currentTarget.style.color = t.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = t.textMuted; }}>
                ⋮
              </button>
              {showMenu && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 160, background: t.menuBg, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden", boxShadow: darkMode ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)", zIndex: 50 }}>
                  {[{ label: "Clear Chat", action: clearChat, color: t.text }, { label: "Logout", action: handleLogout, color: "#f87171" }].map(({ label, action, color }) => (
                    <button key={label} onClick={action} style={{ display: "block", width: "100%", padding: "11px 16px", textAlign: "left", background: "transparent", border: "none", color, fontSize: 14, cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = t.hover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New DM input */}
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${t.borderFaint}` }}>
          <div style={{ color: t.textFaint, fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: "0.05em" }}>NEW DIRECT MESSAGE</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={openChatInput}
              onChange={(e) => setOpenChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") openDirectChat(); }}
              placeholder="Enter username…"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: t.inputBg, color: t.text, border: `1px solid ${t.border}`, outline: "none", fontSize: 13 }}
              onFocus={(e) => (e.target.style.borderColor = "#0d9488")}
              onBlur={(e) => (e.target.style.borderColor = t.border)}
            />
            <button onClick={() => openDirectChat()} style={{ padding: "8px 14px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>Go</button>
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversations.length === 0 ? (
            <div style={{ padding: 20, color: t.textFaint, fontSize: 13, textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>💬</div>No chats yet.<br />Start a DM above.
            </div>
          ) : conversations.map((id, index) => {
            const other = getOtherUser(id, username);
            const isActive = id === conversationId;
            const count = unreadCounts[id] || 0;
            const preview = previews[id];
            const partnerIsOnline = other ? isOnline(other) : false;

            return (
              <div key={id}
                onClick={() => selectConversation(id)}
                onContextMenu={(e) => openChatMenu(e, id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: `1px solid ${t.borderFaint}`, cursor: "pointer", background: isActive ? t.activeConv : "transparent", borderLeft: isActive ? "2px solid #0d9488" : "2px solid transparent", transition: "background 0.15s" }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = t.hoverFaint; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Avatar with online dot */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Avatar name={other || "?"} size={40} />
                  {partnerIsOnline && (
                    <span style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: "50%", background: "#22c55e", border: `2px solid ${t.sidebar}` }} />
                  )}
                </div>

                {/* Text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                    <div style={{ color: isActive ? t.convNameActive : count > 0 ? t.convNameUnread : t.convNameRead, fontWeight: count > 0 ? 700 : 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {other ? formatName(other) : `Chat ${conversations.length - index}`}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {preview?.ts && <span style={{ color: t.textFaint, fontSize: 10 }}>{formatTime(preview.ts)}</span>}
                      {count > 0 && (
                        <span style={{ background: "#0d9488", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: "50%", minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ color: count > 0 ? t.textMuted : t.textFaint, fontSize: 12, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: count > 0 ? 500 : 400 }}>
                    {preview
                      ? `${preview.sender === username ? "You" : formatName(preview.sender)}: ${preview.text}`
                      : other ? `@${other}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Groups section ──────────────────────────────────────────── */}
        <div style={{ borderTop: `1px solid ${t.border}` }}>
          <div style={{ padding: "10px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ color: t.textFaint, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" }}>GROUPS</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setShowJoinGroup(true); setShowCreateGroup(false); }}
                style={{ fontSize: 11, color: "#0d9488", background: "transparent", border: "1px solid rgba(13,148,136,0.3)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}>
                Join
              </button>
              <button onClick={() => { setShowCreateGroup(true); setShowJoinGroup(false); }}
                style={{ fontSize: 11, color: "#fff", background: "linear-gradient(135deg,#0d9488,#0f766e)", border: "none", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}>
                + New
              </button>
            </div>
          </div>

          {/* Create group form */}
          {showCreateGroup && (
            <div style={{ padding: "0 14px 12px" }}>
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: t.inputBg, color: t.text, border: "1px solid rgba(13,148,136,0.4)", outline: "none", fontSize: 13, marginBottom: 6, boxSizing: "border-box" }} />
              <input value={groupMembers} onChange={(e) => setGroupMembers(e.target.value)} placeholder="Add members (comma separated)"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: t.inputBg, color: t.text, border: `1px solid ${t.border}`, outline: "none", fontSize: 13, marginBottom: 6, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleCreateGroup} disabled={groupLoading}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, background: "linear-gradient(135deg,#0d9488,#0f766e)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  {groupLoading ? "Creating…" : "Create"}
                </button>
                <button onClick={() => { setShowCreateGroup(false); setGroupName(""); setGroupMembers(""); }}
                  style={{ padding: "7px 12px", borderRadius: 8, background: "transparent", color: t.textMuted, border: `1px solid ${t.border}`, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Join group form */}
          {showJoinGroup && (
            <div style={{ padding: "0 14px 12px" }}>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleJoinGroup(); }}
                placeholder="Enter group code (e.g. grp_abc123)"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: t.inputBg, color: t.text, border: "1px solid rgba(13,148,136,0.4)", outline: "none", fontSize: 13, marginBottom: 6, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleJoinGroup} disabled={groupLoading}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, background: "linear-gradient(135deg,#0d9488,#0f766e)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  {groupLoading ? "Joining…" : "Join"}
                </button>
                <button onClick={() => { setShowJoinGroup(false); setJoinCode(""); }}
                  style={{ padding: "7px 12px", borderRadius: 8, background: "transparent", color: t.textMuted, border: `1px solid ${t.border}`, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Group list */}
          {groups.length === 0 ? (
            <div style={{ padding: "6px 14px 12px", color: t.textFaint, fontSize: 12 }}>No groups yet. Create or join one.</div>
          ) : groups.map((group) => {
            const isActive = conversationId === group.groupId;
            const count = unreadCounts[group.groupId] || 0;
            return (
              <div key={group.groupId} onClick={() => selectGroup(group)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: `1px solid ${t.borderFaint}`, cursor: "pointer", background: isActive ? t.activeConv : "transparent", borderLeft: isActive ? "2px solid #0d9488" : "2px solid transparent" }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = t.hoverFaint; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                {/* Group icon */}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#0d9488,#0f766e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  #
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ color: isActive ? t.convNameActive : t.convNameRead, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {group.name}
                    </div>
                    {count > 0 && (
                      <span style={{ background: "#0d9488", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: "50%", minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                        {count}
                      </span>
                    )}
                  </div>
                  <div style={{ color: t.textFaint, fontSize: 11, marginTop: 1 }}>
                    {group.members?.length || 0} members · <span style={{ color: t.textFaint, userSelect: "all" }}>{group.groupId}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "10px 14px", borderTop: `1px solid ${t.borderFaint}` }}>
          <div style={{ color: t.textFaint, fontSize: 11, textAlign: "center" }}>Demo: open two tabs, sign in as different users</div>
        </div>
      </div>

      {/* ── Main chat area ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

        {/* Chat header */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: t.headerBg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {currentGroup ? (
              <>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#0d9488,#0f766e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff" }}>#</div>
                <div>
                  <div style={{ color: t.text, fontWeight: 700, fontSize: 16 }}>{currentGroup.name}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>
                    {currentGroup.members?.join(", ")} · <span style={{ color: t.textFaint }}>{currentGroup.groupId}</span>
                  </div>
                </div>
              </>
            ) : chatPartner ? (
              <>
                <div style={{ position: "relative" }}>
                  <Avatar name={chatPartner} size={38} />
                  {partnerOnline && <span style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: "50%", background: "#22c55e", border: `2px solid ${t.bg}` }} />}
                </div>
                <div>
                  <div style={{ color: t.text, fontWeight: 700, fontSize: 16 }}>{formatName(chatPartner)}</div>
                  <div style={{ fontSize: 12, color: typingUser ? "#22c55e" : partnerOnline ? "#22c55e" : t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                    {typingUser ? (
                      <><TypingDots /><span>typing…</span></>
                    ) : partnerOnline ? "Active now" : "Offline"}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: t.textMuted, fontSize: 15 }}>{conversationId ? "Conversation" : "Select or start a chat"}</div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {currentGroup && (
              <button onClick={summarizeConversation} disabled={summarizing || messages.length === 0}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: t.summaryBg, border: `1px solid ${t.summaryBorder}`, color: t.summaryLabel, fontSize: 13, fontWeight: 600, cursor: messages.length === 0 ? "not-allowed" : "pointer", opacity: messages.length === 0 ? 0.4 : 1 }}
                onMouseEnter={(e) => { if (messages.length > 0) e.currentTarget.style.opacity = "0.8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = messages.length === 0 ? "0.4" : "1"; }}>
                <SparkleIcon />{summarizing ? "Summarizing…" : "AI Summary"}
              </button>
            )}
            <div style={{ color: t.textMuted, fontSize: 13 }}>{formatName(username)}</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}
          onScroll={(e) => {
            const el = e.currentTarget;
            isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }}>
          {!conversationId ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: t.textFaint }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>No conversation selected</div>
              <div style={{ fontSize: 13 }}>Start a DM from the sidebar.</div>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: t.textFaint }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
              <div style={{ fontSize: 15, color: t.textMuted, fontWeight: 600, marginBottom: 4 }}>
                {chatPartner ? `Start chatting with ${formatName(chatPartner)}` : "Send the first message"}
              </div>
              <div style={{ fontSize: 13 }}>Messages are stored in DynamoDB.</div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const sender = (msg.senderId || "").trim().toLowerCase();
              const isMine = sender === username.trim().toLowerCase();
              const prevMsg = messages[i - 1];
              const nextMsg = messages[i + 1];
              const isGrouped = prevMsg && prevMsg.senderId === sender;
              const isLastInGroup = !nextMsg || nextMsg.senderId !== sender;
              const isTemp = msg.messageId?.startsWith("temp-");
              const isDelivered = deliveredIds.has(msg.messageId);

              return (
                <div key={msg.messageId || i} style={{ display: "flex", flexDirection: isMine ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, marginBottom: isGrouped ? 3 : 12 }}>
                  {/* Avatar spacer for received messages */}
                  {!isMine && (
                    <div style={{ flexShrink: 0 }}>
                      {isLastInGroup ? <Avatar name={sender} size={28} /> : <div style={{ width: 28 }} />}
                    </div>
                  )}

                  <div style={{ maxWidth: "65%" }}>
                    {!isMine && !isGrouped && (
                      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 3, paddingLeft: 4 }}>{formatName(sender)}</div>
                    )}

                    <div style={{ borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px", overflow: "hidden", background: isMine ? "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" : t.msgTheirs, border: isMine ? "1px solid rgba(13,148,136,0.3)" : `1px solid ${t.msgTheirsBorder}`, boxShadow: isMine ? "0 4px 16px rgba(13,148,136,0.25)" : darkMode ? "0 2px 8px rgba(0,0,0,0.2)" : "0 1px 4px rgba(0,0,0,0.08)", opacity: isTemp ? 0.7 : 1 }}>
                      {msg.content?.startsWith("[img]") ? (
                        <img src={msg.content.slice(5)} alt="media" style={{ maxWidth: 280, maxHeight: 220, display: "block", borderRadius: "inherit" }} />
                      ) : msg.content?.startsWith("[vid]") ? (
                        <video src={msg.content.slice(5)} controls style={{ maxWidth: 280, display: "block", borderRadius: "inherit" }} />
                      ) : msg.content?.startsWith("[file]") ? (
                        (() => {
                          const [name, url] = msg.content.slice(6).split("|");
                          return (
                            <a href={url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", color: isMine ? "#fff" : t.msgTheirsText, textDecoration: "none" }}>
                              <span style={{ fontSize: 22 }}>📎</span>
                              <span style={{ fontSize: 13, textDecoration: "underline" }}>{name}</span>
                            </a>
                          );
                        })()
                      ) : (
                        <div style={{ padding: "10px 14px", fontSize: 14, lineHeight: 1.5, color: isMine ? "#fff" : t.msgTheirsText }}>
                          {msg.content}
                        </div>
                      )}
                    </div>

                    {/* Timestamp + delivery status */}
                    {isLastInGroup && (
                      <div style={{ fontSize: 10, color: t.textFaint, marginTop: 3, display: "flex", alignItems: "center", gap: 4, justifyContent: isMine ? "flex-end" : "flex-start", paddingLeft: isMine ? 0 : 4, paddingRight: isMine ? 4 : 0 }}>
                        {msg.timestamp && <span>{formatTime(msg.timestamp)}</span>}
                        {isMine && (
                          <span style={{ color: isDelivered ? "#0d9488" : t.textFaint, fontSize: 12 }}>
                            {isTemp ? "○" : isDelivered ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* AI Summary */}
        {summary && (
          <div style={{ margin: "0 20px 12px", padding: "14px 18px", borderRadius: 16, background: t.summaryBg, border: `1px solid ${t.summaryBorder}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.summaryLabel, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              <SparkleIcon />AI Summary
            </div>
            <p style={{ color: t.summaryText, fontSize: 14, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{summary}</p>
          </div>
        )}

        {/* Message input */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${t.border}`, background: t.headerBg }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Hidden file input */}
            <input type="file" id="file-upload" accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip"
              style={{ display: "none" }}
              onChange={(e) => { if (e.target.files[0]) { handleFileUpload(e.target.files[0]); e.target.value = ""; } }}
            />
            {/* Attachment button */}
            <button onClick={() => document.getElementById("file-upload").click()}
              disabled={!conversationId}
              title="Attach file"
              style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${t.border}`, background: t.inputBg, color: t.textMuted, cursor: conversationId ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: conversationId ? 1 : 0.4 }}
              onMouseEnter={(e) => { if (conversationId) { e.currentTarget.style.borderColor = "#0d9488"; e.currentTarget.style.color = "#0d9488"; }}}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
              disabled={!conversationId}
              placeholder={conversationId ? "Type a message…" : "Select a conversation to start chatting"}
              style={{ flex: 1, padding: "12px 16px", borderRadius: 14, background: t.inputBg, color: t.text, border: `1px solid ${t.border}`, outline: "none", fontSize: 14, opacity: conversationId ? 1 : 0.5 }}
              onFocus={(e) => (e.target.style.borderColor = "#0d9488")}
              onBlur={(e) => (e.target.style.borderColor = t.border)}
            />
            <button onClick={sendMessage} disabled={!conversationId || !input.trim() || sending}
              style={{ padding: "12px 18px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "#fff", cursor: conversationId && input.trim() && !sending ? "pointer" : "not-allowed", opacity: conversationId && input.trim() && !sending ? 1 : 0.45, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 14, boxShadow: "0 4px 12px rgba(13,148,136,0.3)" }}>
              <SendIcon />{sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Context menu ──────────────────────────────────────────────────── */}
      {activeChatMenu && (
        <div style={{ position: "fixed", zIndex: 100, left: chatMenuPosition.x, top: chatMenuPosition.y, width: 200, background: t.menuBg, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden", boxShadow: darkMode ? "0 16px 48px rgba(0,0,0,0.6)" : "0 8px 32px rgba(0,0,0,0.12)" }}>
          {[
            { label: "Open chat", color: t.text, action: () => selectConversation(activeChatMenu) },
            { label: "Pin to top", color: t.text, action: () => pinChat(activeChatMenu) },
            { label: "Delete chat", color: "#f87171", action: () => removeChat(activeChatMenu) },
          ].map(({ label, color, action }) => (
            <button key={label} onClick={action} style={{ display: "block", width: "100%", padding: "11px 16px", textAlign: "left", background: "transparent", border: "none", color, fontSize: 14, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
