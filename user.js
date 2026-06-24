import {
 auth,
 db
} from "./firebase.js";

import {
 doc,
 getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const roomId =
localStorage.getItem("roomId");

const userList =
document.getElementById("userList");

document
.getElementById("backBtn")
.addEventListener("click",()=>{

 window.location.href =
 "chat.html";

});

loadMembers();

async function loadMembers(){

 if(!roomId) return;

 const roomSnap =
 await getDoc(
   doc(db,"rooms",roomId)
 );

 if(!roomSnap.exists()) return;

 const room =
 roomSnap.data();

 userList.innerHTML = "";

 room.members.forEach((uid)=>{

   const div =
   document.createElement("div");

   div.className =
   "member-card";

   div.innerHTML = `

      <div class="member-avatar">
        👤
      </div>

      <div>
        ${uid}
      </div>

   `;

   userList.appendChild(div);

 });

}