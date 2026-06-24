import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const container = document.getElementById("notificationList");
const unreadBadge = document.getElementById("unreadBadge");
let currentUser = null;
let lastUnreadCount = 0;
let lastSoundPlayedAt = 0;

function getDisplayName(user) {
  return user?.displayName || user?.email?.split("@")[0] || "Someone";
}

async function ensureNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
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

async function markRelatedNotificationsAsRead(requestId, senderUid, receiverUid) {
  if (!requestId && !senderUid && !receiverUid) return;
  const snapshot = await getDocs(collection(db, "notifications"));
  const updates = snapshot.docs
    .filter((notificationDoc) => {
      const data = notificationDoc.data();
      if (requestId && data.requestId === requestId) return true;
      if (data.type !== "friend_request") return false;
      return (data.senderUid === senderUid && data.receiverUid === receiverUid) ||
        (data.senderUid === receiverUid && data.receiverUid === senderUid);
    })
    .map((notificationDoc) => updateDoc(notificationDoc.ref, { read: true, processed: true }));
  await Promise.all(updates);
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  await ensureNotificationPermission();
  const q = query(collection(db, "notifications"), where("receiverUid", "==", user.uid));
  onSnapshot(q, (snapshot) => {
    const items = [];
    let unread = 0;
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.read) unread += 1;
      items.push({ id: docSnap.id, ...data });
    });

    unreadBadge.textContent = unread;
    if (unread > lastUnreadCount) {
      playNotificationSound();
      const latestItem = items.find((item) => !item.read);
      if (window.Notification?.permission === "granted" && latestItem) {
        new Notification("Our Space", {
          body: latestItem.message,
          tag: latestItem.id
        });
      }
    }
    lastUnreadCount = unread;
    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = '<div class="empty-state">You are all caught up.</div>';
      return;
    }

    items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = `notification-card ${item.read ? "" : "unread"}`;
      const showActions = item.type === "friend_request" && !item.read && !item.processed;
      const actions = showActions
        ? `<div class="request-actions">
            <button class="accept-btn" data-action="accept" data-id="${item.id}" data-request-id="${item.requestId || ""}" data-sender-uid="${item.senderUid || ""}">Accept</button>
            <button class="reject-btn" data-action="decline" data-id="${item.id}" data-request-id="${item.requestId || ""}">Decline</button>
          </div>`
        : `<button class="ghost-btn compact" data-action="read" data-id="${item.id}">${item.read ? "Handled" : "Seen"}</button>`;
      card.innerHTML = `
        <div>
          <strong>${item.message}</strong>
          <p class="muted">${item.read ? "Seen" : "New"}</p>
        </div>
        ${actions}
      `;
      container.appendChild(card);
    });
  });
});

container.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;

  const notificationId = button.getAttribute("data-id");
  const action = button.getAttribute("data-action") || "read";

  if (action === "read") {
    await updateDoc(doc(db, "notifications", notificationId), { read: true });
    return;
  }

  if (!currentUser) return;

  const requestId = button.getAttribute("data-request-id");
  const senderUid = button.getAttribute("data-sender-uid");
  const currentProfileSnap = await getDoc(doc(db, "users", currentUser.uid));
  const currentProfile = currentProfileSnap.exists() ? currentProfileSnap.data() : {};

  if (action === "accept" && requestId && senderUid) {
    await updateDoc(doc(db, "friendRequests", requestId), { status: "accepted" });
    const friendshipId = [currentUser.uid, senderUid].sort().join("_");
    const existingFriendship = await getDoc(doc(db, "friends", friendshipId));
    if (!existingFriendship.exists() || existingFriendship.data().status !== "accepted") {
      await setDoc(doc(db, "friends", friendshipId), {
        userA: currentUser.uid,
        userB: senderUid,
        status: "accepted",
        createdAt: serverTimestamp()
      }, { merge: true });
      await updateDoc(doc(db, "users", currentUser.uid), { friendsCount: increment(1) });
      await updateDoc(doc(db, "users", senderUid), { friendsCount: increment(1) });
    }
    await setDoc(doc(db, "privateChats", friendshipId), {
      chatId: friendshipId,
      members: [currentUser.uid, senderUid],
      chatName: currentProfile.name || currentProfile.username || "Private chat",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    await markRelatedNotificationsAsRead(requestId, senderUid, currentUser.uid);
    await setDoc(doc(db, "notifications", notificationId), { read: true, processed: true }, { merge: true });
    await addDoc(collection(db, "notifications"), {
      receiverUid: senderUid,
      message: `${currentProfile.name || currentProfile.username || getDisplayName(currentUser)} accepted your request.`,
      read: false,
      createdAt: serverTimestamp(),
      type: "friend_accepted",
      senderUid: currentUser.uid,
      senderName: currentProfile.name || currentProfile.username || getDisplayName(currentUser)
    });
  }

  if (action === "decline" && requestId) {
    await updateDoc(doc(db, "friendRequests", requestId), { status: "declined" });
    await markRelatedNotificationsAsRead(requestId, senderUid, currentUser.uid);
    await setDoc(doc(db, "notifications", notificationId), { read: true, processed: true }, { merge: true });
  }
});