import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  getDocs,
  updateDoc,
  setDoc,
  serverTimestamp,
  increment,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const searchInput = document.getElementById("searchInput");
const results = document.getElementById("results");
const statusNote = document.getElementById("statusNote");

let currentUser = null;
let currentUserDoc = null;
let allUsers = [];
let friendships = [];
let requests = [];
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

function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

function normalizeSearchValue(value) {
  return (value || "").toString().trim().toLowerCase().replace(/^@/, "");
}

function getDisplayName(user) {
  return user?.name || user?.username || user?.displayName || user?.email || "User";
}

function getUsernameValue(user) {
  return user?.username || user?.name || user?.displayName || user?.email || "user";
}

function getFriendUids(uid) {
  if (!uid || !currentUser) return [];
  const seen = new Set();
  return friendships
    .filter((item) => item.status === "accepted" && (item.userA === uid || item.userB === uid))
    .map((item) => (item.userA === uid ? item.userB : item.userA))
    .filter((friendUid) => {
      if (!friendUid || seen.has(friendUid)) return false;
      seen.add(friendUid);
      return true;
    });
}

function getRelationshipStatus(targetUid) {
  if (!currentUser || !targetUid) return "none";
  const friendMatch = friendships.find(
    (item) => item.status === "accepted" && ((item.userA === currentUser.uid && item.userB === targetUid) || (item.userA === targetUid && item.userB === currentUser.uid))
  );
  if (friendMatch) return "friends";

  const removedMatch = friendships.find(
    (item) => item.status === "removed" && ((item.userA === currentUser.uid && item.userB === targetUid) || (item.userA === targetUid && item.userB === currentUser.uid))
  );
  if (removedMatch) return "none";

  const requestMatch = requests.find(
    (item) =>
      item.status === "pending" &&
      ((item.senderUid === currentUser.uid && item.receiverUid === targetUid) || (item.senderUid === targetUid && item.receiverUid === currentUser.uid))
  );
  if (!requestMatch) return "none";
  return requestMatch.senderUid === currentUser.uid ? "requested" : "pending";
}

function getMutualFriends(targetUid) {
  if (!currentUser || !targetUid) return 0;
  const currentFriends = new Set(getFriendUids(currentUser.uid));
  const targetFriends = new Set(getFriendUids(targetUid));
  let mutual = 0;
  currentFriends.forEach((friendUid) => {
    if (targetFriends.has(friendUid)) mutual += 1;
  });
  return mutual;
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

function renderResults() {
  const term = normalizeSearchValue(searchInput.value);
  results.innerHTML = "";

  if (!term) {
    results.innerHTML = '<div class="empty-state">Type a username to discover people.</div>';
    return;
  }

  const filtered = allUsers.filter((user) => {
    const userUid = user.uid || user.id;
    if (userUid === currentUser?.uid) return false;
    const haystack = [
      user.username,
      user.name,
      user.displayName,
      user.email,
      user.uid,
      user.id
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  if (!filtered.length) {
    results.innerHTML = '<div class="empty-state">No matches yet.</div>';
    return;
  }

  filtered.forEach((user) => {
    const statusValue = getRelationshipStatus(user.uid);
    const card = document.createElement("article");
    card.className = "user-card";
    const displayName = getDisplayName(user);
    const usernameValue = getUsernameValue(user);
    card.innerHTML = `
      <div class="user-top">
        <div class="avatar-circle">${getInitial(displayName)}</div>
        <div class="user-info">
          <h4>${displayName}</h4>
          <p>@${usernameValue}</p>
          <p class="muted">${getMutualFriends(user.uid)} mutual friends</p>
        </div>
      </div>
      <div class="user-actions">
        ${renderButton(statusValue, user)}
      </div>
    `;
    results.appendChild(card);
  });
}

function renderButton(statusValue, user) {
  if (statusValue === "friends") {
    return `<button class="ghost-btn full" data-action="message" data-user='${JSON.stringify(user)}'>Message</button>`;
  }
  if (statusValue === "pending") {
    return `<div class="user-actions"><button class="primary-btn compact" data-action="accept" data-user='${JSON.stringify(user)}'>Accept</button><button class="ghost-btn compact" data-action="decline" data-user='${JSON.stringify(user)}'>Decline</button></div>`;
  }
  if (statusValue === "requested") {
    return `<button class="ghost-btn full" data-action="cancel" data-user='${JSON.stringify(user)}'>Cancel</button>`;
  }
  return `<button class="primary-btn compact" data-action="add" data-user='${JSON.stringify(user)}'>Add Friend</button>`;
}

async function createNotification(receiverUid, message, extra = {}) {
  await addDoc(collection(db, "notifications"), {
    receiverUid,
    message,
    read: false,
    createdAt: serverTimestamp(),
    ...extra
  });
}

async function ensureCurrentUserProfile() {
  if (!currentUser) return;

  if (!currentUserDoc) {
    const fallbackName = currentUser.displayName || currentUser.email?.split("@")[0] || "user";
    currentUserDoc = {
      uid: currentUser.uid,
      username: fallbackName.toLowerCase(),
      name: fallbackName,
      email: currentUser.email,
      bio: "",
      followersCount: 0,
      followingCount: 0,
      friendsCount: 0,
      online: true,
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
  }

  await setDoc(doc(db, "users", currentUser.uid), currentUserDoc, { merge: true });
}

async function handleFriendAction(action, user) {
  if (!currentUser) {
    statusNote.textContent = "Please sign in again to continue.";
    return;
  }

  try {
    await ensureCurrentUserProfile();

    if (action === "add") {
      const alreadyFriends = friendships.some(
        (item) => item.status === "accepted" && ((item.userA === currentUser.uid && item.userB === user.uid) || (item.userA === user.uid && item.userB === currentUser.uid))
      );
      const removedFriendship = friendships.find(
        (item) => item.status === "removed" && ((item.userA === currentUser.uid && item.userB === user.uid) || (item.userA === user.uid && item.userB === currentUser.uid))
      );
      if (removedFriendship) {
        await setDoc(doc(db, "friends", removedFriendship.id), {
          status: "removed",
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      if (alreadyFriends) {
        statusNote.textContent = "You are already friends.";
        return;
      }

      const existingRequest = requests.find(
        (item) =>
          ((item.senderUid === currentUser.uid && item.receiverUid === user.uid) ||
            (item.senderUid === user.uid && item.receiverUid === currentUser.uid)) &&
          (item.status === "pending" || item.status === "accepted")
      );

      if (existingRequest?.status === "accepted") {
        statusNote.textContent = "You are already friends.";
        return;
      }

      if (existingRequest?.status === "pending") {
        await deleteDoc(doc(db, "friendRequests", existingRequest.id));
      }

      const requestKey = `${currentUser.uid}_${user.uid}`;
      await setDoc(doc(db, "friendRequests", requestKey), {
        senderUid: currentUser.uid,
        senderUsername: currentUserDoc?.username || currentUser.displayName || currentUser.email?.split("@")[0] || "user",
        receiverUid: user.uid,
        receiverUsername: getUsernameValue(user),
        status: "pending",
        createdAt: serverTimestamp()
      });
      await createNotification(user.uid, `${currentUserDoc?.username || currentUser.displayName || "Someone"} sent you a friend request.`, {
        type: "friend_request",
        requestId: requestKey,
        senderUid: currentUser.uid,
        senderName: currentUserDoc?.username || currentUser.displayName || currentUser.email?.split("@")[0] || "user"
      });
      statusNote.textContent = "Friend request sent.";
      return;
    }

    const requestMatch = requests.find(
      (item) =>
        item.status === "pending" &&
        ((item.senderUid === currentUser.uid && item.receiverUid === user.uid) || (item.senderUid === user.uid && item.receiverUid === currentUser.uid))
    );

    if (!requestMatch) {
      statusNote.textContent = "No pending request was found.";
      return;
    }

    if (action === "cancel" || action === "decline") {
      await deleteDoc(doc(db, "friendRequests", requestMatch.id));
      await markRelatedNotificationsAsRead(requestMatch.id, requestMatch.senderUid, requestMatch.receiverUid);
      statusNote.textContent = action === "cancel" ? "Request cancelled." : "Request declined.";
    }

    if (action === "accept") {
      await updateDoc(doc(db, "friendRequests", requestMatch.id), { status: "accepted" });
      const friendshipId = [currentUser.uid, user.uid].sort().join("_");
      const existingFriendship = await getDoc(doc(db, "friends", friendshipId));
      if (!existingFriendship.exists() || existingFriendship.data().status !== "accepted") {
        await setDoc(doc(db, "friends", friendshipId), {
          userA: currentUser.uid,
          userB: user.uid,
          status: "accepted",
          createdAt: serverTimestamp()
        }, { merge: true });
        await updateDoc(doc(db, "users", currentUser.uid), { friendsCount: increment(1) });
        await updateDoc(doc(db, "users", user.uid), { friendsCount: increment(1) });
      }
      await markRelatedNotificationsAsRead(requestMatch.id, requestMatch.senderUid, requestMatch.receiverUid);
      await createNotification(user.uid, `${currentUserDoc?.username || currentUser.displayName || "Someone"} accepted your request.`, {
        type: "friend_accepted",
        senderUid: currentUser.uid,
        senderName: currentUserDoc?.username || currentUser.displayName || currentUser.email?.split("@")[0] || "user"
      });
      statusNote.textContent = "Friend request accepted.";
    }

    if (action === "message") {
      const chatId = [currentUser.uid, user.uid].sort().join("_");
      await setDoc(doc(db, "privateChats", chatId), {
        chatId,
        members: [currentUser.uid, user.uid],
        chatName: user.name || user.username || "Private chat",
        lastMessage: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      localStorage.setItem("activeChatType", "private");
      localStorage.setItem("activeChatId", chatId);
      localStorage.setItem("activeChatName", user.name || user.username || "Private chat");
      localStorage.setItem("activeChatUserUid", user.uid);
      localStorage.setItem("activeChatUserName", user.username || user.name || "Friend");
      window.location.href = "chat.html";
    }
  } catch (error) {
    console.error("Friend action failed:", error);
    statusNote.textContent = "Something went wrong while updating the friend request.";
  }
}

results.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.getAttribute("data-action");
  const user = JSON.parse(button.getAttribute("data-user"));
  handleFriendAction(action, user);
});

searchInput.addEventListener("input", renderResults);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
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
  const profileSnap = await getDoc(doc(db, "users", user.uid));
  if (profileSnap.exists()) {
    currentUserDoc = profileSnap.data();
  } else {
    const fallbackName = user.displayName || user.email?.split("@")[0] || "user";
    currentUserDoc = {
      uid: user.uid,
      username: fallbackName.toLowerCase(),
      name: fallbackName,
      email: user.email,
      bio: "",
      followersCount: 0,
      followingCount: 0,
      friendsCount: 0,
      online: true,
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "users", user.uid), currentUserDoc, { merge: true });
  }

  onSnapshot(collection(db, "users"), (snapshot) => {
    allUsers = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      uid: docSnap.data().uid || docSnap.id,
      ...docSnap.data()
    }));
    renderResults();
  });

  onSnapshot(collection(db, "friends"), (snapshot) => {
    friendships = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    renderResults();
  });

  onSnapshot(collection(db, "friendRequests"), (snapshot) => {
    requests = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    renderResults();
  });
});