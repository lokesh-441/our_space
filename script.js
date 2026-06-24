import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  push,
  onChildAdded
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
const db = getDatabase(app);

const messagesRef = ref(db, "messages");

const messageInput =
document.getElementById("messageInput");

const sendBtn =
document.getElementById("sendBtn");

const messagesDiv =
document.getElementById("messages");

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keypress", e => {

    if(e.key === "Enter"){
        sendMessage();
    }

});

function sendMessage(){

    const text = messageInput.value.trim();

    if(text === "") return;

    push(messagesRef,{
        text:text,
        timestamp:Date.now()
    });

    messageInput.value = "";
}

onChildAdded(messagesRef,(snapshot)=>{

    const data = snapshot.val();

    const div =
    document.createElement("div");

    div.classList.add("message");

    div.textContent = data.text;

    messagesDiv.appendChild(div);

    messagesDiv.scrollTop =
    messagesDiv.scrollHeight;

});