import { auth, db } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const roomId = localStorage.getItem("activeChatId") || localStorage.getItem("roomId");
const chatType = localStorage.getItem("activeChatType") || "room";
const roomTitle = document.getElementById("roomTitle");
const messagesContainer = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const backBtn = document.getElementById("backBtn");
const profileBtn = document.getElementById("profileBtn");
const logoutBtn = document.getElementById("logoutBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const unfriendBtn = document.getElementById("unfriendBtn");
const emojiBtn = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");
const typingIndicator = document.getElementById("typingIndicator");
const roomAvatar = document.getElementById("roomAvatar");

let currentUser = null;
let activeRoom = null;
let lastSoundPlayedAt = 0;
let typingTimer = null;

async function ensureNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

function getInitial(text) {
  return (text || "U").trim().charAt(0).toUpperCase();
}

async function updateTypingStatus(isTyping) {
  if (!roomId || !currentUser || chatType !== "private") return;
  const typingRef = doc(db, "privateChats", roomId);
  await setDoc(typingRef, {
    typingUserUid: isTyping ? currentUser.uid : null,
    typingUpdatedAt: serverTimestamp()
  }, { merge: true });
}

function handleTypingInput() {
  if (chatType !== "private") return;
  if (typingTimer) clearTimeout(typingTimer);
  updateTypingStatus(true);
  typingTimer = setTimeout(() => updateTypingStatus(false), 1200);
}

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

async function createMessageNotification(receiverUid, senderUid, senderName, message, chatId) {
  if (!receiverUid || !chatId) return;
  playNotificationSound();
  await setDoc(doc(collection(db, "notifications")), {
    receiverUid,
    message: `New message from ${senderName || "a friend"}: ${message}`,
    read: false,
    createdAt: serverTimestamp(),
    type: "message",
    senderUid,
    senderName: senderName || "Friend",
    chatId
  });
  if (window.Notification?.permission === "granted") {
    new Notification(senderName || "New message", {
      body: message,
      tag: chatId
    });
  }
}

async function markChatNotificationsAsRead(chatId) {
  if (!chatId) return;
  const snapshot = await getDocs(collection(db, "notifications"));
  const updates = snapshot.docs
    .filter((notificationDoc) => {
      const data = notificationDoc.data();
      return data.type === "message" && data.chatId === chatId;
    })
    .map((notificationDoc) => updateDoc(notificationDoc.ref, { read: true }));
  await Promise.all(updates);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  await ensureNotificationPermission();
  if (!roomId) {
    window.location.href = "rooms.html";
    return;
  }
  await loadContext();
  listenMessages();
});

async function loadContext() {
  try {
    if (chatType === "private") {
      const otherUserUid = localStorage.getItem("activeChatUserUid");
      const otherUserName = localStorage.getItem("activeChatUserName") || "Direct chat";
      if (roomId && otherUserUid) {
        await setDoc(doc(db, "privateChats", roomId), {
          chatId: roomId,
          members: [currentUser.uid, otherUserUid],
          chatName: otherUserName,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      roomTitle.textContent = otherUserName;
      roomAvatar.textContent = getInitial(otherUserName);
      const otherProfileSnap = await getDoc(doc(db, "users", otherUserUid));
      const otherProfile = otherProfileSnap.exists() ? otherProfileSnap.data() : {};
      typingIndicator.textContent = otherProfile.online ? "Online now" : "Active recently";
      await markChatNotificationsAsRead(roomId);
      return;
    }

    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) {
      window.location.href = "rooms.html";
      return;
    }
    activeRoom = roomSnap.data();
    roomTitle.textContent = activeRoom.roomName || "Room";
    roomAvatar.textContent = getInitial(activeRoom.roomName || "R");
    typingIndicator.textContent = `${activeRoom.members?.length || 1} members`;
  } catch (error) {
    console.error(error);
  }
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  try {
    if (chatType === "private") {
      const otherUserUid = localStorage.getItem("activeChatUserUid");
      const chatRef = doc(db, "privateChats", roomId);
      await setDoc(chatRef, {
        chatId: roomId,
        members: [currentUser.uid, otherUserUid],
        chatName: localStorage.getItem("activeChatName") || "Private chat",
        lastMessage: text,
        updatedAt: serverTimestamp()
      }, { merge: true });
      await addDoc(collection(db, "privateChats", roomId, "messages"), {
        text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || localStorage.getItem("username") || "User",
        timestamp: serverTimestamp()
      });
      if (otherUserUid) {
        await createMessageNotification(otherUserUid, currentUser.uid, currentUser.displayName || "Someone", text, roomId);
      }
    } else {
      await addDoc(collection(db, "rooms", roomId, "messages"), {
        text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || localStorage.getItem("username") || "User",
        timestamp: serverTimestamp()
      });
      await updateDoc(doc(db, "rooms", roomId), { lastMessage: text, updatedAt: serverTimestamp() });
    }
    messageInput.value = "";
  } catch (error) {
    console.error(error);
  }
}

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (event) => { if (event.key === "Enter") sendMessage(); });
messageInput.addEventListener("input", handleTypingInput);
messageInput.addEventListener("focus", () => handleTypingInput());
messageInput.addEventListener("blur", () => updateTypingStatus(false));

function listenMessages() {
  const messagesPath = chatType === "private"
    ? collection(db, "privateChats", roomId, "messages")
    : collection(db, "rooms", roomId, "messages");

  const q = query(messagesPath, orderBy("timestamp"));
  onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const messageDiv = document.createElement("div");
      messageDiv.className = `message ${msg.senderId === currentUser.uid ? "me" : "other"}`;

      const time = msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      messageDiv.innerHTML = `
        <div class="message-top">
          <div class="avatar-circle small">${getInitial(msg.senderName || "U")}</div>
          <span class="msg-name">${msg.senderName || "User"}</span>
        </div>
        <div class="msg-text">${msg.text}</div>
        <div class="msg-time">${time}</div>
      `;
      messagesContainer.appendChild(messageDiv);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  if (chatType === "private") {
    onSnapshot(doc(db, "privateChats", roomId), (chatSnap) => {
      const chatData = chatSnap.data() || {};
      const typingUserUid = chatData.typingUserUid;
      if (typingUserUid && typingUserUid !== currentUser?.uid) {
        const otherName = localStorage.getItem("activeChatUserName") || "Friend";
        typingIndicator.textContent = `${otherName} is typing…`;
      } else {
        typingIndicator.textContent = "Direct chat";
      }
    });
  }
}

async function clearChatHistory() {
  if (!roomId || chatType !== "private") return;
  const chatRef = doc(db, "privateChats", roomId);
  await setDoc(chatRef, { lastMessage: "", updatedAt: serverTimestamp() }, { merge: true });
  const messagesRef = collection(db, "privateChats", roomId, "messages");
  const snapshot = await getDocs(messagesRef);
  const deletePromises = snapshot.docs.map((messageDoc) => deleteDoc(messageDoc.ref));
  await Promise.all(deletePromises);
  messageInput.value = "";
  messagesContainer.innerHTML = '<div class="empty-state">Chat cleared.</div>';
}

async function unfriendUser() {
  if (!roomId || chatType !== "private") return;
  const otherUserUid = localStorage.getItem("activeChatUserUid");
  if (!otherUserUid) return;
  const friendshipId = [currentUser.uid, otherUserUid].sort().join("_");
  await updateDoc(doc(db, "friends", friendshipId), { status: "removed" });
  await updateDoc(doc(db, "users", currentUser.uid), { friendsCount: increment(-1) });
  await updateDoc(doc(db, "users", otherUserUid), { friendsCount: increment(-1) });
  localStorage.removeItem("activeChatId");
  localStorage.removeItem("activeChatType");
  localStorage.removeItem("activeChatName");
  localStorage.removeItem("activeChatUserUid");
  localStorage.removeItem("activeChatUserName");
  window.location.href = "profile.html";
}

backBtn?.addEventListener("click", () => { window.location.href = "rooms.html"; });
profileBtn?.addEventListener("click", () => { window.location.href = "profile.html"; });
clearChatBtn?.addEventListener("click", clearChatHistory);
unfriendBtn?.addEventListener("click", unfriendUser);
logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    localStorage.clear();
    window.location.href = "index.html";
  } catch (error) {
    console.error(error);
  }
});

emojiBtn?.addEventListener("click", () => {
  emojiPicker.style.display = emojiPicker.style.display === "none" ? "block" : "none";
});

emojiPicker?.addEventListener("emoji-click", (event) => {
  messageInput.value += event.detail.unicode;
  messageInput.focus();
});