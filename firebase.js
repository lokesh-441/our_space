// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA274audtsng13a51f3xmTBCKT45ogXjEE",
  authDomain: "our-space-chat-182ad.firebaseapp.com",
  databaseURL: "https://our-space-chat-182ad-default-rtdb.firebaseio.com/",
  projectId: "our-space-chat-182ad",
  storageBucket: "our-space-chat-182ad.firebasestorage.app",
  messagingSenderId: "393001092767",
  appId: "1:393001092767:web:08070ba6fbf90afb7e04aa"
};

const app = initializeApp(firebaseConfig);

// Services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export
export {
  app,
  auth,
  db,
  storage
};