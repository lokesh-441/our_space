import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const status = document.getElementById("status");
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const forgotBtn = document.getElementById("forgotPasswordBtn");

function setBusy(button, text) {
  button.disabled = true;
  button.textContent = text;
}

function resetBusy(button, text) {
  button.disabled = false;
  button.textContent = text;
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "home.html";
  }
});

async function ensureUserProfile(user, username) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      username,
      name: username,
      email: user.email,
      bio: "",
      followersCount: 0,
      followingCount: 0,
      friendsCount: 0,
      online: true,
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

signupBtn.addEventListener("click", async () => {
  const username = usernameInput.value.trim().toLowerCase();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !email || !password) {
    status.textContent = "Please fill all fields.";
    return;
  }

  try {
    setBusy(signupBtn, "Creating...");
    const existingQuery = query(collection(db, "users"), where("username", "==", username));
    const existing = await getDocs(existingQuery);

    if (!existing.empty) {
      status.textContent = "That username is already taken.";
      resetBusy(signupBtn, "Create Account");
      return;
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, { displayName: username });
    await ensureUserProfile(user, username);

    localStorage.setItem("username", username);
    status.textContent = "Account ready. Redirecting...";
    setTimeout(() => {
      window.location.href = "home.html";
    }, 700);
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
    resetBusy(signupBtn, "Create Account");
  }
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    status.textContent = "Please enter your email and password.";
    return;
  }

  try {
    setBusy(loginBtn, "Signing in...");
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await ensureUserProfile(user, (user.displayName || user.email || "user").toLowerCase());
    localStorage.setItem("username", user.displayName || user.email || "user");
    status.textContent = "Welcome back.";
    setTimeout(() => {
      window.location.href = "home.html";
    }, 700);
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
    resetBusy(loginBtn, "Login");
  }
});

forgotBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    status.textContent = "Please enter your email to receive the reset link.";
    return;
  }

  try {
    setBusy(forgotBtn, "Sending...");
    await sendPasswordResetEmail(auth, email);
    status.textContent = "Password reset email sent. Check your inbox.";
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
  } finally {
    resetBusy(forgotBtn, "Forgot password?");
  }
});