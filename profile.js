import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  increment,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const nameInput =
document.getElementById("name");

const bioInput =
document.getElementById("bio");

const status =
document.getElementById("status");
const friendsList = document.getElementById("friendsList");
const displayNameHeading = document.getElementById("displayName");
const profileTag = document.getElementById("profileTag");
const avatarPreview = document.getElementById("avatarPreview");
const friendsCountBadge = document.getElementById("friendsCount");
const followersCountBadge = document.getElementById("followersCount");
const followingCountBadge = document.getElementById("followingCount");

let currentUser = null;

async function clearFriendRequestsBetweenUsers(friendUid) {
    if (!currentUser || !friendUid) return;
    const requestSnapshot = await getDocs(collection(db, "friendRequests"));
    const pendingMatches = requestSnapshot.docs.filter((requestDoc) => {
        const data = requestDoc.data();
        return (data.senderUid === currentUser.uid && data.receiverUid === friendUid) ||
            (data.senderUid === friendUid && data.receiverUid === currentUser.uid);
    });
    await Promise.all(pendingMatches.map((requestDoc) => deleteDoc(requestDoc.ref)));
}

async function unfriendFriend(friendUid) {
    if (!currentUser || !friendUid) return;

    try {
        const friendshipId = [currentUser.uid, friendUid].sort().join("_");
        await setDoc(doc(db, "friends", friendshipId), {
            userA: currentUser.uid,
            userB: friendUid,
            status: "removed",
            updatedAt: serverTimestamp()
        }, { merge: true });
        await updateDoc(doc(db, "users", currentUser.uid), { friendsCount: increment(-1) });
        await updateDoc(doc(db, "users", friendUid), { friendsCount: increment(-1) });
        await clearFriendRequestsBetweenUsers(friendUid);

        const card = friendsList.querySelector(`.friend-item [data-friend-uid="${friendUid}"]`)?.closest(".friend-item");
        if (card) {
            card.remove();
        }

        if (!friendsList.querySelector(".friend-item")) {
            friendsList.innerHTML = '<div class="empty-state">You have no friends yet. Add someone from search.</div>';
        }
    } catch (error) {
        console.error(error);
    }
}

/* Load User */

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    try {

        const userRef =
        doc(db, "users", user.uid);

        const userSnap =
        await getDoc(userRef);

        if (userSnap.exists()) {

            const data =
            userSnap.data();

            nameInput.value =
            data.name || "";

            bioInput.value =
            data.bio || "";

            displayNameHeading.textContent =
            data.name || user.displayName || "Your profile";

            profileTag.textContent =
            `@${data.username || data.name || user.email?.split("@")[0] || "user"}`;

            avatarPreview.textContent =
            (data.name || data.username || user.email || "U").charAt(0).toUpperCase();

            friendsCountBadge.textContent =
            data.friendsCount || 0;
            followersCountBadge.textContent =
            data.followersCount || 0;
            followingCountBadge.textContent =
            data.followingCount || 0;
        }

    }
    catch(error){

        console.error(error);

    }

    onSnapshot(collection(db, "friends"), async (snapshot) => {
        const acceptedFriends = snapshot.docs
            .filter((friendSnap) => {
                const data = friendSnap.data();
                return data.status === "accepted" && (data.userA === user.uid || data.userB === user.uid);
            })
            .map((friendSnap) => ({ id: friendSnap.id, ...friendSnap.data() }))
            .reduce((accumulator, friend) => {
                const otherUid = friend.userA === user.uid ? friend.userB : friend.userA;
                const existing = accumulator.find((item) => item.otherUid === otherUid);
                if (existing) return accumulator;
                accumulator.push({ ...friend, otherUid });
                return accumulator;
            }, []);

        const friendsWithProfiles = await Promise.all(
            acceptedFriends.map(async (friend) => {
                const otherUid = friend.otherUid;
                const profileSnap = await getDoc(doc(db, "users", otherUid));
                const profile = profileSnap.exists() ? profileSnap.data() : {};
                return {
                    ...friend,
                    otherUid,
                    displayName: profile.name || profile.username || otherUid
                };
            })
        );

        if (!friendsWithProfiles.length) {
            friendsList.innerHTML = '<div class="empty-state">You have no friends yet. Add someone from search.</div>';
            return;
        }

        friendsList.innerHTML = "";
        friendsWithProfiles.forEach((friend) => {
            const card = document.createElement("article");
            card.className = "friend-item";
            card.innerHTML = `
                <div class="friend-left">
                    <div class="avatar-circle">${(friend.displayName || "U").charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="friend-name">${friend.displayName || "Friend"}</div>
                        <div class="friend-status">Connected</div>
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="message-friend-btn" data-action="message" data-friend-uid="${friend.otherUid}" data-friend-name="${friend.displayName || "Friend"}">Message</button>
                    <button class="ghost-btn danger" data-action="unfriend" data-friend-uid="${friend.otherUid}" data-friend-name="${friend.displayName || "Friend"}">Unfriend</button>
                </div>
            `;
            friendsList.appendChild(card);
        });
    });

});

/* Save Profile */

document
.getElementById("saveBtn")
.addEventListener("click", async () => {

    try {

        const name =
        nameInput.value.trim();

        const bio =
        bioInput.value.trim();

        await updateProfile(
            currentUser,
            {
                displayName:name
            }
        );

        await setDoc(
            doc(db,"users",currentUser.uid),
            {
                uid:currentUser.uid,
                email:currentUser.email,
                name:name,
                bio:bio,
                updatedAt:serverTimestamp()
            },
            {
                merge:true
            }
        );

        status.innerText =
        "Profile Saved Successfully";

    }
    catch(error){

        console.error(error);

        status.innerText =
        error.message;

    }

});

friendsList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-friend-uid]");
    if (!button) return;

    const action = button.getAttribute("data-action");
    const friendUid = button.getAttribute("data-friend-uid");
    const friendName = button.getAttribute("data-friend-name");

    if (action === "unfriend") {
        await unfriendFriend(friendUid);
        return;
    }

    localStorage.setItem("activeChatType", "private");
    localStorage.setItem("activeChatId", `${[currentUser.uid, friendUid].sort().join("_")}`);
    localStorage.setItem("activeChatName", friendName);
    localStorage.setItem("activeChatUserUid", friendUid);
    localStorage.setItem("activeChatUserName", friendName);
    window.location.href = "chat.html";
});

/* Back */

document
.getElementById("backBtn")
.addEventListener("click", () => {

    window.location.href =
    "home.html";

});

/* Logout */

document
.getElementById("logoutBtn")
.addEventListener("click", async () => {

    try {

        await signOut(auth);

        localStorage.clear();

        window.location.href =
        "index.html";

    }
    catch(error){

        console.error(error);

    }

});