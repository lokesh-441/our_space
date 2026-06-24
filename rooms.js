import { auth, db } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const status = document.getElementById("status");
let currentUser = null;

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
});

document.getElementById("createRoomBtn").addEventListener("click", async () => {
  const roomName = document.getElementById("roomName").value.trim();
  const password = document.getElementById("createPassword").value.trim();

  if (!roomName || !password) {
    status.textContent = "Please fill all fields.";
    return;
  }

  try {
    const roomId = generateRoomId();
    await setDoc(doc(db, "rooms", roomId), {
      roomId,
      roomName,
      password,
      createdBy: currentUser.uid,
      createdByName: currentUser.displayName || "User",
      createdAt: serverTimestamp(),
      members: [currentUser.uid],
      description: "Premium group room"
    });

    localStorage.setItem("roomId", roomId);
    document.getElementById("generatedRoomId").textContent = roomId;
    document.getElementById("roomCreated").style.display = "block";
    status.textContent = "Room created successfully.";
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
  }
});

document.getElementById("copyRoomBtn").addEventListener("click", async () => {
  const roomId = document.getElementById("generatedRoomId").textContent;
  try {
    await navigator.clipboard.writeText(roomId);
    status.textContent = "Room code copied.";
  } catch {
    status.textContent = "Copy failed.";
  }
});

document.getElementById("enterRoomBtn").addEventListener("click", () => {
  window.location.href = "chat.html";
});

document.getElementById("joinRoomBtn").addEventListener("click", async () => {
  const roomId = document.getElementById("roomId").value.trim().toUpperCase();
  const password = document.getElementById("joinPassword").value.trim();

  if (!roomId || !password) {
    status.textContent = "Please fill all fields.";
    return;
  }

  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) {
      status.textContent = "Room not found.";
      return;
    }
    const room = roomSnap.data();
    if (room.password !== password) {
      status.textContent = "Wrong password.";
      return;
    }
    await updateDoc(roomRef, { members: arrayUnion(currentUser.uid) });
    localStorage.setItem("roomId", roomId);
    status.textContent = "Joining room...";
    setTimeout(() => { window.location.href = "chat.html"; }, 400);
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
  }
});