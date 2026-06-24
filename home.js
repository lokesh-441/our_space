import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const recentChats = document.getElementById("recentChats");
let lastNotificationCount = 0;
let lastSoundPlayedAt = 0;

function playNotificationSound() {
  const now = Date.now();
  if (now - lastSoundPlayedAt < 1500) return;
  lastSoundPlayedAt = now;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.04;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.25);
    oscillator.stop(audioContext.currentTime + 0.3);
    setTimeout(() => audioContext.close(), 400);
  } catch (error) {
    console.error(error);
  }
}

function getInitial(text) {
  return (text || "U").trim().charAt(0).toUpperCase();
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderConversations(items) {
  if (!items.length) {
    recentChats.innerHTML = '<div class="empty-state">No conversations yet. Search for someone to begin.</div>';
    return;
  }

  recentChats.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("button");
    card.className = "conversation-card compact";
    card.innerHTML = `
      <div class="avatar-circle">${getInitial(item.title)}</div>
      <div class="conversation-meta">
        <strong>${item.title}</strong>
        <p>${item.lastMessage || "Start a conversation"}</p>
      </div>
      <span class="timestamp">${item.time}</span>
    `;
    card.addEventListener("click", () => {
      localStorage.setItem("activeChatType", item.type);
      localStorage.setItem("activeChatId", item.id);
      localStorage.setItem("activeChatName", item.title);
      if (item.type === "private") {
        localStorage.setItem("activeChatUserUid", item.otherUserUid || "");
        localStorage.setItem("activeChatUserName", item.otherUserName || item.title);
      }
      window.location.href = "chat.html";
    });
    recentChats.appendChild(card);
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  onSnapshot(query(collection(db, "notifications"), where("receiverUid", "==", user.uid)), (snapshot) => {
    const unread = snapshot.docs.filter((notificationDoc) => !notificationDoc.data().read).length;
    if (unread > lastNotificationCount) {
      playNotificationSound();
      if (window.Notification?.permission === "granted") {
        const latest = snapshot.docs.find((notificationDoc) => !notificationDoc.data().read);
        if (latest) {
          new Notification("Our Space", { body: latest.data().message, tag: latest.id });
        }
      }
    }
    lastNotificationCount = unread;
  });
  if (snap.exists()) {
    const data = snap.data();
    document.getElementById("profileName").textContent = data.name || "Your Name";
    document.getElementById("profileUsername").textContent = `@${data.username || data.name || user.email?.split("@")[0] || "user"}`;
    document.getElementById("profileBio").textContent = data.bio || "A refined social space for private conversations.";
    document.getElementById("friendsCount").textContent = data.friendsCount || 0;
    document.getElementById("heroAvatar").textContent = getInitial(data.name || data.username || "U");
  }

  const privateChatsQuery = query(collection(db, "privateChats"), where("members", "array-contains", user.uid));
  const roomChatsQuery = query(collection(db, "rooms"), where("members", "array-contains", user.uid));

  onSnapshot(privateChatsQuery, (snapshot) => {
    const chats = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const otherUserUid = (data.members || []).find((memberUid) => memberUid !== user.uid) || "";
      chats.push({
        id: docSnap.id,
        type: "private",
        title: data.chatName || "Private chat",
        lastMessage: data.lastMessage || "",
        time: formatTime(data.updatedAt || data.createdAt),
        updatedAt: data.updatedAt || data.createdAt,
        otherUserUid,
        otherUserName: data.chatName || "Private chat"
      });
    });
    onSnapshot(roomChatsQuery, (roomSnapshot) => {
      const rooms = [];
      roomSnapshot.forEach((roomDoc) => {
        const room = roomDoc.data();
        rooms.push({
          id: roomDoc.id,
          type: "room",
          title: room.roomName || "Room",
          lastMessage: room.lastMessage || "",
          time: formatTime(room.updatedAt || room.createdAt),
          updatedAt: room.updatedAt || room.createdAt
        });
      });
      const all = [...chats, ...rooms].sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      renderConversations(all);
    });
  });
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (user) {
    await setDoc(doc(db, "users", user.uid), { online: false, lastSeen: serverTimestamp() }, { merge: true });
  }
  await signOut(auth);
  localStorage.clear();
  window.location.href = "index.html";
});