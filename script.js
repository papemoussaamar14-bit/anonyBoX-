/* =========================================================
   ANONYBOX — SCRIPT.JS
   VERSION STABLE
   Firebase + mode local de secours
   Groupes + messages + notifications + heures
========================================================= */

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  push,
  onValue
} from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";


/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAGrCghSoJf7ULhi1ZiR1qeYmt4bE63a3M",
  authDomain: "prjt-78fef.firebaseapp.com",
  databaseURL:
    "https://prjt-78fef-default-rtdb.firebaseio.com",
  projectId: "prjt-78fef",
  storageBucket:
    "prjt-78fef.firebasestorage.app",
  messagingSenderId: "502581952099",
  appId:
    "1:502581952099:web:2ae7c0912d073f3b11c256"
};


/* =========================================================
   INITIALISATION FIREBASE
========================================================= */

let app = null;
let auth = null;
let db = null;

let firebaseAvailable = false;
let firebaseAuthReady = false;


/*
   Initialisation protégée.
*/

try {

  app = initializeApp(firebaseConfig);

  auth = getAuth(app);

  db = getDatabase(app);

  firebaseAvailable = true;

  console.log("Firebase initialisé.");

} catch (error) {

  console.error(
    "Firebase indisponible :",
    error
  );

  firebaseAvailable = false;
}


/* =========================================================
   ÉTAT
========================================================= */

let currentUser = null;

let currentGroupCode = null;

let currentGroup = null;

let messagesUnsubscribe = null;

let groupsUnsubscribe = null;

let confirmationCallback = null;

let unreadMessages = {};


/*
   Utilisateur local de secours.

   Il permet à l'application de fonctionner
   même si Firebase Auth est indisponible.
*/

function createLocalUser() {

  let localUid =
    localStorage.getItem(
      "anonybox_local_uid"
    );

  if (!localUid) {

    localUid =
      "local_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2, 10);

    localStorage.setItem(
      "anonybox_local_uid",
      localUid
    );
  }


  return {
    uid: localUid,
    isLocal: true
  };
}


/* =========================================================
   OUTIL DOM
========================================================= */

const $ =
  id =>
    document.getElementById(id);


/* =========================================================
   TOAST
========================================================= */

function toast(
  message,
  icon = "✓"
) {

  const box =
    $("toast");

  if (!box) {

    console.log(message);

    return;
  }


  const messageBox =
    $("toast-message");

  const iconBox =
    $("toast-icon");


  if (messageBox)
    messageBox.textContent =
      message;


  if (iconBox)
    iconBox.textContent =
      icon;


  box.style.display =
    "flex";


  clearTimeout(
    window.anonyToast
  );


  window.anonyToast =
    setTimeout(
      () => {

        box.style.display =
          "none";

      },
      2500
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

  const div =
    document.createElement("div");

  div.textContent =
    String(value ?? "");

  return div.innerHTML;
}


/* =========================================================
   STOCKAGE GROUPES
========================================================= */

function getGroupsStorageKey() {

  if (!currentUser)
    return null;

  return (
    "anonybox_groups_" +
    currentUser.uid
  );
}


function getLocalGroups() {

  const key =
    getGroupsStorageKey();

  if (!key)
    return [];


  try {

    const saved =
      localStorage.getItem(key);

    if (!saved)
      return [];


    const groups =
      JSON.parse(saved);


    return Array.isArray(groups)
      ? groups
      : [];

  } catch (error) {

    console.error(
      "Lecture groupes :",
      error
    );

    return [];
  }
}


function saveLocalGroups(groups) {

  const key =
    getGroupsStorageKey();

  if (!key)
    return;


  try {

    localStorage.setItem(
      key,
      JSON.stringify(groups)
    );

  } catch (error) {

    console.error(
      "Sauvegarde groupes :",
      error
    );
  }
}


function saveLocalGroup(group) {

  if (
    !currentUser ||
    !group?.code
  )
    return;


  const groups =
    getLocalGroups();


  const index =
    groups.findIndex(
      item =>
        item &&
        item.code ===
          group.code
    );


  const cleanGroup = {

    code:
      group.code,

    name:
      group.name ||
      "Groupe",

    creator:
      group.creator ||
      currentUser.uid,

    createdAt:
      group.createdAt ||
      Date.now(),

    members:
      group.members ||
      {
        [currentUser.uid]: true
      }

  };


  if (index >= 0) {

    groups[index] = {
      ...groups[index],
      ...cleanGroup
    };

  } else {

    groups.push(
      cleanGroup
    );

  }


  saveLocalGroups(
    groups
  );
}


function removeLocalGroup(code) {

  if (!code)
    return;


  const groups =
    getLocalGroups();


  saveLocalGroups(
    groups.filter(
      group =>
        group &&
        group.code !== code
    )
  );
}


/* =========================================================
   MESSAGES NON LUS
========================================================= */

function getUnreadStorageKey() {

  if (!currentUser)
    return null;

  return (
    "anonybox_unread_" +
    currentUser.uid
  );
}


function loadUnreadMessages() {

  const key =
    getUnreadStorageKey();

  if (!key) {

    unreadMessages = {};

    return;
  }


  try {

    const data =
      localStorage.getItem(key);

    unreadMessages =
      data
        ? JSON.parse(data)
        : {};


    if (
      typeof unreadMessages !==
      "object" ||
      unreadMessages === null
    ) {

      unreadMessages = {};

    }

  } catch {

    unreadMessages = {};
  }
}


function saveUnreadMessages() {

  const key =
    getUnreadStorageKey();

  if (!key)
    return;


  localStorage.setItem(
    key,
    JSON.stringify(
      unreadMessages
    )
  );
}


function getLastReadKey(code) {

  if (
    !currentUser ||
    !code
  )
    return null;


  return (
    "anonybox_read_" +
    currentUser.uid +
    "_" +
    code
  );
}


function getLastRead(code) {

  const key =
    getLastReadKey(code);

  if (!key)
    return 0;


  return Number(
    localStorage.getItem(key) || 0
  );
}


function setLastRead(
  code,
  timestamp
) {

  const key =
    getLastReadKey(code);

  if (!key)
    return;


  localStorage.setItem(
    key,
    String(
      timestamp ||
      Date.now()
    )
  );


  unreadMessages[code] =
    false;


  saveUnreadMessages();

  updateGroupDisplays();
}


function markGroupUnread(code) {

  if (!code)
    return;


  unreadMessages[code] =
    true;


  saveUnreadMessages();

  updateGroupDisplays();
}


function isGroupUnread(code) {

  return (
    unreadMessages[code] === true
  );
}


/* =========================================================
   FUSION GROUPES
========================================================= */

function mergeGroups(
  firebaseGroups
) {

  const localGroups =
    getLocalGroups();


  const map =
    new Map();


  firebaseGroups.forEach(
    group => {

      if (
        group &&
        group.code
      ) {

        map.set(
          group.code,
          group
        );

      }

    }
  );


  localGroups.forEach(
    group => {

      if (
        group &&
        group.code &&
        !map.has(group.code)
      ) {

        map.set(
          group.code,
          group
        );

      }

    }
  );


  const merged =
    Array.from(
      map.values()
    );


  merged.sort(
    (a, b) =>
      (b.createdAt || 0) -
      (a.createdAt || 0)
  );


  return merged;
}


/* =========================================================
   NAVIGATION
========================================================= */

function hideMainScreens() {

  [
    "home-screen",
    "groups-screen",
    "profile-screen"
  ].forEach(
    id => {

      const element =
        $(id);

      if (element)
        element.style.display =
          "none";

    }
  );
}


function activateNav(id) {

  document
    .querySelectorAll(
      ".bottom-nav button"
    )
    .forEach(
      button =>
        button.classList.remove(
          "nav-active"
        )
    );


  $(id)?.classList.add(
    "nav-active"
  );
}


function showHome() {

  hideMainScreens();


  const home =
    $("home-screen");


  if (home)
    home.style.display =
      "block";


  activateNav(
    "home-nav"
  );


  renderSavedGroups();
}


function showGroups() {

  hideMainScreens();


  const screen =
    $("groups-screen");


  if (screen)
    screen.style.display =
      "block";


  activateNav(
    "groups-nav"
  );


  renderSavedGroups();

  loadGroups();
}


function showProfile() {

  hideMainScreens();


  const screen =
    $("profile-screen");


  if (screen)
    screen.style.display =
      "block";


  activateNav(
    "profile-nav"
  );


  loadProfile();
}


/* =========================================================
   PROFIL
========================================================= */

function loadProfile() {

  const input =
    $("profile-name");

  if (!input)
    return;


  input.value =
    localStorage.getItem(
      "anonybox_username"
    ) || "";
}


function saveProfile() {

  const input =
    $("profile-name");

  if (!input)
    return;


  const name =
    input.value.trim();


  if (!name) {

    toast(
      "Entre un pseudo",
      "!"
    );

    return;
  }


  localStorage.setItem(
    "anonybox_username",
    name
  );


  toast(
    "Profil enregistré",
    "✓"
  );
}


/* =========================================================
   CODE GROUPE
========================================================= */

function generateCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


  let code = "";


  for (
    let i = 0;
    i < 6;
    i++
  ) {

    code +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];

  }


  return code;
}


/* =========================================================
   CRÉER GROUPE
========================================================= */

async function createGroup() {

  /*
     Cette fois, on ne bloque plus
     l'utilisateur si Firebase n'est
     pas connecté.
  */

  if (!currentUser) {

    currentUser =
      createLocalUser();

    loadUnreadMessages();
  }


  const nameInput =
    prompt(
      "Nom du groupe :"
    );


  if (nameInput === null)
    return;


  const name =
    nameInput.trim();


  if (!name) {

    toast(
      "Entre un nom de groupe",
      "!"
    );

    return;
  }


  try {

    toast(
      "Création du groupe...",
      "⏳"
    );


    let code =
      generateCode();


    /*
       Vérification Firebase seulement
       si Firebase est réellement disponible.
    */

    if (
      firebaseAvailable &&
      firebaseAuthReady &&
      db &&
      !currentUser.isLocal
    ) {

      let snapshot =
        await get(
          ref(
            db,
            `groups/${code}`
          )
        );


      let attempts = 0;


      while (
        snapshot.exists() &&
        attempts < 20
      ) {

        code =
          generateCode();


        snapshot =
          await get(
            ref(
              db,
              `groups/${code}`
            )
          );


        attempts++;
      }

    }


    const now =
      Date.now();


    const group = {

      code,

      name,

      creator:
        currentUser.uid,

      createdAt:
        now,

      members: {

        [currentUser.uid]:
          true

      }

    };


    /*
       Toujours sauvegarder localement.
    */

    saveLocalGroup(
      group
    );


    /*
       Synchronisation Firebase
       si disponible.
    */

    if (
      firebaseAvailable &&
      firebaseAuthReady &&
      db &&
      !currentUser.isLocal
    ) {

      await set(

        ref(
          db,
          `groups/${code}`
        ),

        {
          name,

          creator:
            currentUser.uid,

          createdAt:
            now,

          members: {

            [currentUser.uid]:
              true

          }

        }

      );


      await set(

        ref(
          db,
          `groupCodes/${code}`
        ),

        {
          groupCode:
            code,

          createdBy:
            currentUser.uid,

          createdAt:
            now
        }

      );

    }


    currentGroupCode =
      code;

    currentGroup =
      group;


    renderSavedGroups();


    toast(
      firebaseAvailable &&
      firebaseAuthReady &&
      !currentUser.isLocal
        ? "Groupe créé"
        : "Groupe créé sur cet appareil",
      "✓"
    );


    openGroup(
      code,
      group
    );


  } catch (error) {

    console.error(
      "Création groupe :",
      error
    );


    toast(
      "Groupe créé localement",
      "📱"
    );

  }
}


/* =========================================================
   REJOINDRE GROUPE
========================================================= */

async function joinGroup() {

  if (!currentUser) {

    currentUser =
      createLocalUser();

    loadUnreadMessages();
  }


  const input =
    prompt(
      "Code du groupe :"
    );


  if (input === null)
    return;


  const code =
    input
      .trim()
      .toUpperCase();


  if (!code) {

    toast(
      "Entre un code",
      "!"
    );

    return;
  }


  /*
     Mode Firebase.
  */

  if (
    firebaseAvailable &&
    firebaseAuthReady &&
    db &&
    !currentUser.isLocal
  ) {

    try {

      const snapshot =
        await get(
          ref(
            db,
            `groups/${code}`
          )
        );


      if (snapshot.exists()) {

        const group =
          snapshot.val();


        await set(

          ref(
            db,
            `groups/${code}/members/${currentUser.uid}`
          ),

          true

        );


        group.members =
          group.members || {};


        group.members[
          currentUser.uid
        ] = true;


        const localGroup = {

          code,

          name:
            group.name ||
            "Groupe",

          creator:
            group.creator ||
            "",

          createdAt:
            group.createdAt ||
            Date.now(),

          members:
            group.members

        };


        saveLocalGroup(
          localGroup
        );


        unreadMessages[code] =
          false;


        saveUnreadMessages();


        currentGroupCode =
          code;

        currentGroup =
          localGroup;


        renderSavedGroups();


        toast(
          "Groupe rejoint",
          "✓"
        );


        openGroup(
          code,
          localGroup
        );


        return;
      }

    } catch (error) {

      console.error(
        "Erreur Firebase join :",
        error
      );

    }

  }


  /*
     Recherche locale.
  */

  const localGroups =
    getLocalGroups();


  const localGroup =
    localGroups.find(
      group =>
        group &&
        group.code === code
    );


  if (localGroup) {

    currentGroupCode =
      code;

    currentGroup =
      localGroup;


    openGroup(
      code,
      localGroup
    );


    toast(
      "Groupe ouvert",
      "✓"
    );


    return;
  }


  toast(
    "Groupe introuvable",
    "!"
  );
}


/* =========================================================
   CHARGER GROUPES FIREBASE
========================================================= */

function loadGroups() {

  /*
     Si Firebase n'est pas prêt,
     on utilise directement le stockage local.
  */

  if (
    !currentUser ||
    !firebaseAvailable ||
    !firebaseAuthReady ||
    !db ||
    currentUser.isLocal
  ) {

    renderSavedGroups();

    return;
  }


  if (groupsUnsubscribe) {

    groupsUnsubscribe();

    groupsUnsubscribe =
      null;
  }


  const groupsRef =
    ref(
      db,
      "groups"
    );


  groupsUnsubscribe =
    onValue(

      groupsRef,

      snapshot => {

        const data =
          snapshot.val() || {};


        const firebaseGroups =
          [];


        Object.entries(
          data
        ).forEach(
          ([code, group]) => {

            if (
              group &&
              group.members &&
              group.members[
                currentUser.uid
              ] === true
            ) {

              const completeGroup = {

                code,

                ...group

              };


              firebaseGroups.push(
                completeGroup
              );


              saveLocalGroup(
                completeGroup
              );

            }

          }
        );


        const allGroups =
          mergeGroups(
            firebaseGroups
          );


        renderGroups(
          allGroups
        );


        renderHomeGroups(
          allGroups
        );

      },

      error => {

        console.error(
          "Firebase groupes :",
          error
        );


        renderSavedGroups();

      }

    );
}


/* =========================================================
   GROUPES LOCAUX
========================================================= */

function renderSavedGroups() {

  const groups =
    getLocalGroups();


  renderGroups(
    groups
  );


  renderHomeGroups(
    groups
  );
}


/* =========================================================
   BADGE
========================================================= */

function getGroupUnreadHTML(code) {

  if (
    !isGroupUnread(code)
  )
    return "";


  return `
    <span
      class="group-unread-dot"
      aria-label="Nouveaux messages"
    ></span>
  `;
}


/* =========================================================
   RENDU GROUPES
========================================================= */

function renderGroups(groups) {

  const list =
    $("groups-list");


  if (!list)
    return;


  list.innerHTML =
    "";


  if (
    !groups ||
    groups.length === 0
  ) {

    list.innerHTML = `

      <div class="empty-groups">

        <div class="empty-icon">
          👻
        </div>

        <h3>
          Aucun groupe
        </h3>

        <p>
          Crée ou rejoins un groupe.
        </p>

      </div>

    `;

    return;
  }


  groups.forEach(
    group => {

      const item =
        document.createElement(
          "div"
        );


      const unread =
        isGroupUnread(
          group.code
        );


      item.className =
        "group-card" +
        (
          unread
            ? " has-unread"
            : ""
        );


      item.innerHTML = `

        <div class="group-avatar">

          👻

          ${getGroupUnreadHTML(
            group.code
          )}

        </div>

        <div class="group-details">

          <div class="group-name">

            ${escapeHTML(
              group.name ||
              "Groupe"
            )}

          </div>

          <div class="group-last-message">

            ${
              unread
                ? "Nouveau message"
                : "Groupe privé"
            }

          </div>

        </div>

        <div class="group-arrow">
          ›
        </div>

      `;


      item.addEventListener(
        "click",
        () => {

          openGroup(
            group.code,
            group
          );

        }
      );


      list.appendChild(
        item
      );

    }
  );
}


/* =========================================================
   GROUPES ACCUEIL
========================================================= */

function renderHomeGroups(groups) {

  const list =
    $("home-groups-list");


  if (!list)
    return;


  list.innerHTML =
    "";


  if (
    !groups ||
    groups.length === 0
  ) {

    list.innerHTML = `

      <div class="empty-groups">

        <div class="empty-icon">
          👻
        </div>

        <h3>
          Aucun groupe
        </h3>

        <p>
          Tes discussions apparaîtront ici.
        </p>

      </div>

    `;

    return;
  }


  groups
    .slice(0, 5)
    .forEach(
      group => {

        const item =
          document.createElement(
            "div"
          );


        const unread =
          isGroupUnread(
            group.code
          );


        item.className =
          "group-card" +
          (
            unread
              ? " has-unread"
              : ""
          );


        item.innerHTML = `

          <div class="group-avatar">

            👻

            ${getGroupUnreadHTML(
              group.code
            )}

          </div>

          <div class="group-details">

            <div class="group-name">

              ${escapeHTML(
                group.name ||
                "Groupe"
              )}

            </div>

            <div class="group-last-message">

              ${
                unread
                  ? "Nouveau message"
                  : "Discussion"
              }

            </div>

          </div>

          <div class="group-arrow">
            ›
          </div>

        `;


        item.addEventListener(
          "click",
          () => {

            openGroup(
              group.code,
              group
            );

          }
        );


        list.appendChild(
          item
        );

      }
    );
}


/* =========================================================
   ACTUALISER
========================================================= */

function updateGroupDisplays() {

  const groups =
    getLocalGroups();


  renderGroups(
    groups
  );


  renderHomeGroups(
    groups
  );
}


/* =========================================================
   OUVRIR GROUPE
========================================================= */

function openGroup(
  code,
  group
) {

  if (!code) {

    toast(
      "Groupe invalide",
      "!"
    );

    return;
  }


  if (group)
    saveLocalGroup({
      code,
      ...group
    });


  currentGroupCode =
    code;


  currentGroup =
    group || {};


  unreadMessages[code] =
    false;


  saveUnreadMessages();


  hideMainScreens();

  closeMenu();

  closeInfo();


  $("chat-title").textContent =
    group?.name ||
    "Groupe";


  $("chat-status").textContent =
    "Groupe privé";


  $("info-group-name").textContent =
    group?.name ||
    "Groupe";


  $("info-group-code").textContent =
    code;


  updateMemberCount(
    group
  );


  const deleteButton =
    $("menu-delete-group");


  if (deleteButton) {

    deleteButton.style.display =
      group?.creator ===
      currentUser?.uid
        ? "flex"
        : "none";

  }


  const page =
    $("chat-page");


  if (!page)
    return;


  page.classList.add(
    "active"
  );


  page.setAttribute(
    "aria-hidden",
    "false"
  );


  page.style.display =
    "flex";

  page.style.visibility =
    "visible";

  page.style.opacity =
    "1";

  page.style.transform =
    "translateX(0)";

  page.style.position =
    "fixed";

  page.style.inset =
    "0";

  page.style.width =
    "100vw";

  page.style.height =
    "100dvh";

  page.style.zIndex =
    "99999";


  document.body.classList.add(
    "chat-open"
  );


  listenMessages(
    code
  );
}


/* =========================================================
   RETOUR CHAT
========================================================= */

function closeChat() {

  const page =
    $("chat-page");


  if (page) {

    page.classList.remove(
      "active"
    );


    page.style.display =
      "none";


    page.style.visibility =
      "hidden";


    page.style.opacity =
      "0";


    page.setAttribute(
      "aria-hidden",
      "true"
    );

  }


  document.body.classList.remove(
    "chat-open"
  );


  closeMenu();

  closeInfo();

  stopMessages();


  currentGroupCode =
    null;


  currentGroup =
    null;


  showGroups();
}


/* =========================================================
   MENU
========================================================= */

function toggleMenu() {

  const menu =
    $("chat-menu");

  if (!menu)
    return;


  const visible =
    menu.style.display === "block" ||
    menu.style.display === "flex";


  menu.style.display =
    visible
      ? "none"
      : "block";
}


function closeMenu() {

  const menu =
    $("chat-menu");

  if (menu)
    menu.style.display =
      "none";
}


/* =========================================================
   INFORMATIONS
========================================================= */

function openInfo() {

  closeMenu();


  const panel =
    $("group-info-panel");


  if (panel)
    panel.style.display =
      "block";
}


function closeInfo() {

  const panel =
    $("group-info-panel");


  if (panel)
    panel.style.display =
      "none";
}


function updateMemberCount(group) {

  const members =
    group?.members ||
    {};


  const count =
    Object.keys(
      members
    ).length;


  const element =
    $("info-member-count");


  if (element)
    element.textContent =
      count;
}


/* =========================================================
   CONFIRMATION
========================================================= */

function askConfirmation(
  title,
  message,
  callback
) {

  const overlay =
    $("confirm-overlay");


  if (!overlay) {

    if (confirm(message))
      callback();

    return;
  }


  $("confirm-title").textContent =
    title;


  $("confirm-message").textContent =
    message;


  confirmationCallback =
    callback;


  overlay.style.display =
    "flex";
}


function closeConfirmation() {

  const overlay =
    $("confirm-overlay");


  if (overlay)
    overlay.style.display =
      "none";


  confirmationCallback =
    null;
}


/* =========================================================
   QUITTER
========================================================= */

function askLeave() {

  if (!currentGroupCode)
    return;


  askConfirmation(

    "Quitter le groupe ?",

    "Veux-tu vraiment quitter ce groupe ?",

    async () => {

      await leaveGroup();

    }

  );
}


async function leaveGroup() {

  const code =
    currentGroupCode;


  if (!code)
    return;


  try {

    if (
      firebaseAvailable &&
      firebaseAuthReady &&
      db &&
      currentUser &&
      !currentUser.isLocal
    ) {

      await remove(

        ref(
          db,
          `groups/${code}/members/${currentUser.uid}`
        )

      );

    }


    removeLocalGroup(
      code
    );


    unreadMessages[code] =
      false;


    saveUnreadMessages();


    toast(
      "Groupe quitté",
      "✓"
    );


    closeChat();


  } catch (error) {

    console.error(
      "Quitter groupe :",
      error
    );


    removeLocalGroup(
      code
    );


    toast(
      "Groupe retiré",
      "✓"
    );


    closeChat();
  }
}


/* =========================================================
   SUPPRIMER GROUPE
========================================================= */

function askDelete() {

  if (!currentGroupCode)
    return;


  askConfirmation(

    "Supprimer le groupe ?",

    "Le groupe et ses messages seront supprimés.",

    async () => {

      await deleteGroup();

    }

  );
}


async function deleteGroup() {

  const code =
    currentGroupCode;


  if (!code)
    return;


  try {

    if (
      firebaseAvailable &&
      firebaseAuthReady &&
      db &&
      currentUser &&
      !currentUser.isLocal
    ) {

      const snapshot =
        await get(
          ref(
            db,
            `groups/${code}`
          )
        );


      if (
        snapshot.exists()
      ) {

        const group =
          snapshot.val();


        if (
          group.creator !==
          currentUser.uid
        ) {

          toast(
            "Seul le créateur peut supprimer",
            "!"
          );

          return;
        }

      }


      await remove(
        ref(
          db,
          `groups/${code}`
        )
      );


      await remove(
        ref(
          db,
          `groupCodes/${code}`
        )
      );


      await remove(
        ref(
          db,
          `messages/${code}`
        )
      );

    }


    removeLocalGroup(
      code
    );


    unreadMessages[code] =
      false;


    saveUnreadMessages();


    toast(
      "Groupe supprimé",
      "✓"
    );


    closeChat();


  } catch (error) {

    console.error(
      "Suppression :",
      error
    );


    toast(
      "Erreur de suppression",
      "!"
    );
  }
}


/* =========================================================
   COPIER CODE
========================================================= */

async function copyCode() {

  closeMenu();


  if (!currentGroupCode)
    return;


  try {

    await navigator.clipboard.writeText(
      currentGroupCode
    );


    toast(
      "Code copié",
      "✓"
    );

  } catch {

    toast(
      "Code : " +
      currentGroupCode,
      "🔑"
    );
  }
}


/* =========================================================
   HEURE
========================================================= */

function formatMessageTime(timestamp) {

  if (!timestamp)
    return "";


  return new Date(
    timestamp
  ).toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


/* =========================================================
   MESSAGES
========================================================= */

function listenMessages(code) {

  stopMessages();


  /*
     Firebase uniquement si connecté.
  */

  if (
    !firebaseAvailable ||
    !firebaseAuthReady ||
    !db ||
    currentUser?.isLocal
  ) {

    renderLocalMessages(
      code
    );

    return;
  }


  const messagesRef =
    ref(
      db,
      `messages/${code}`
    );


  messagesUnsubscribe =
    onValue(

      messagesRef,

      snapshot => {

        const data =
          snapshot.val() || {};


        processUnreadMessages(
          code,
          data
        );


        renderMessages(
          data
        );

      },

      error => {

        console.error(
          "Messages Firebase :",
          error
        );


        renderLocalMessages(
          code
        );

      }

    );
}


/* =========================================================
   MESSAGES LOCAUX
========================================================= */

function getLocalMessagesKey(code) {

  if (!currentUser)
    return null;


  return (
    "anonybox_messages_" +
    currentUser.uid +
    "_" +
    code
  );
}


function getLocalMessages(code) {

  const key =
    getLocalMessagesKey(code);

  if (!key)
    return {};


  try {

    return JSON.parse(
      localStorage.getItem(key) ||
      "{}"
    );

  } catch {

    return {};
  }
}


function saveLocalMessages(
  code,
  messages
) {

  const key =
    getLocalMessagesKey(code);

  if (!key)
    return;


  localStorage.setItem(
    key,
    JSON.stringify(messages)
  );
}


function renderLocalMessages(code) {

  renderMessages(
    getLocalMessages(code)
  );
}


/* =========================================================
   NON LUS
========================================================= */

function processUnreadMessages(
  code,
  data
) {

  const entries =
    Object.entries(
      data || {}
    );


  if (
    entries.length === 0
  )
    return;


  let newestTimestamp =
    0;


  let hasUnread =
    false;


  const lastRead =
    getLastRead(code);


  entries.forEach(
    ([id, message]) => {

      const timestamp =
        Number(
          message?.timestamp || 0
        );


      if (
        timestamp >
        newestTimestamp
      ) {

        newestTimestamp =
          timestamp;

      }


      if (
        message?.uid !==
          currentUser?.uid &&
        timestamp >
          lastRead
      ) {

        hasUnread =
          true;

      }

    }
  );


  if (
    currentGroupCode ===
    code
  ) {

    if (
      newestTimestamp >
      0
    ) {

      setLastRead(
        code,
        newestTimestamp
      );

    }

    return;
  }


  if (hasUnread)
    markGroupUnread(
      code
    );
}


/* =========================================================
   ARRÊTER MESSAGES
========================================================= */

function stopMessages() {

  if (messagesUnsubscribe) {

    messagesUnsubscribe();

    messagesUnsubscribe =
      null;
  }
}


/* =========================================================
   AFFICHER MESSAGES
========================================================= */

function renderMessages(data) {

  const container =
    $("messages");


  if (!container)
    return;


  container.innerHTML =
    "";


  const entries =
    Object.entries(
      data || {}
    );


  entries.sort(
    ([idA, messageA], [idB, messageB]) => {

      const a =
        Number(
          messageA?.timestamp || 0
        );


      const b =
        Number(
          messageB?.timestamp || 0
        );


      if (a !== b)
        return a - b;


      return idA.localeCompare(
        idB
      );

    }
  );


  if (
    entries.length === 0
  ) {

    container.innerHTML = `

      <div class="chat-welcome">

        <div>
          👻
        </div>

        <h3>
          Bienvenue dans le groupe
        </h3>

        <p>
          Aucun message pour le moment.
        </p>

      </div>

    `;

    return;
  }


  entries.forEach(
    ([id, message]) => {

      const wrapper =
        document.createElement(
          "div"
        );


      const isMine =
        message?.uid ===
        currentUser?.uid;


      wrapper.className =
        "message-item" +
        (
          isMine
            ? " mine"
            : ""
        );


      const author =
        document.createElement(
          "small"
        );


      author.textContent =
        isMine
          ? "Vous"
          : (
              message?.name ||
              "Anonyme"
            );


      const bubble =
        document.createElement(
          "div"
        );


      bubble.className =
        "message-bubble";


      const text =
        document.createElement(
          "span"
        );


      text.textContent =
        message?.text ||
        "";


      bubble.appendChild(
        text
      );


      const time =
        document.createElement(
          "span"
        );


      time.className =
        "message-time";


      time.textContent =
        formatMessageTime(
          message?.timestamp
        );


      bubble.appendChild(
        time
      );


      wrapper.appendChild(
        author
      );


      wrapper.appendChild(
        bubble
      );


      container.appendChild(
        wrapper
      );

    }
  );


  requestAnimationFrame(
    () => {

      container.scrollTop =
        container.scrollHeight;

    }
  );
}


/* =========================================================
   ENVOYER MESSAGE
========================================================= */

async function sendMessage() {

  /*
     Ne plus afficher "Connexion en cours".
  */

  if (!currentUser) {

    currentUser =
      createLocalUser();

    loadUnreadMessages();
  }


  if (!currentGroupCode) {

    toast(
      "Aucun groupe ouvert",
      "!"
    );

    return;
  }


  const input =
    $("message-input");


  if (!input)
    return;


  const text =
    input.value.trim();


  if (!text)
    return;


  input.value = "";


  const timestamp =
    Date.now();


  const name =
    localStorage.getItem(
      "anonybox_username"
    ) ||
    "Anonyme";


  /*
     Firebase.
  */

  if (
    firebaseAvailable &&
    firebaseAuthReady &&
    db &&
    !currentUser.isLocal
  ) {

    try {

      const messageRef =
        push(
          ref(
            db,
            `messages/${currentGroupCode}`
          )
        );


      await set(
        messageRef,
        {
          text,

          name,

          uid:
            currentUser.uid,

          timestamp
        }
      );


      setLastRead(
        currentGroupCode,
        timestamp
      );


      return;

    } catch (error) {

      console.error(
        "Firebase message :",
        error
      );

    }

  }


  /*
     Mode local.
  */

  const messages =
    getLocalMessages(
      currentGroupCode
    );


  const id =
    "local_" +
    timestamp +
    "_" +
    Math.random()
      .toString(36)
      .substring(2, 7);


  messages[id] = {

    text,

    name,

    uid:
      currentUser.uid,

    timestamp

  };


  saveLocalMessages(
    currentGroupCode,
    messages
  );


  renderMessages(
    messages
  );


  setLastRead(
    currentGroupCode,
    timestamp
  );
}


/* =========================================================
   ÉVÉNEMENTS
========================================================= */

$("create-group-button")
  ?.addEventListener(
    "click",
    createGroup
  );


$("new-group-button")
  ?.addEventListener(
    "click",
    createGroup
  );


$("join-button")
  ?.addEventListener(
    "click",
    joinGroup
  );


$("see-groups-button")
  ?.addEventListener(
    "click",
    showGroups
  );


$("profile-button")
  ?.addEventListener(
    "click",
    showProfile
  );


$("home-nav")
  ?.addEventListener(
    "click",
    showHome
  );


$("groups-nav")
  ?.addEventListener(
    "click",
    showGroups
  );


$("profile-nav")
  ?.addEventListener(
    "click",
    showProfile
  );


$("save-profile")
  ?.addEventListener(
    "click",
    saveProfile
  );


$("chat-back-button")
  ?.addEventListener(
    "click",
    closeChat
  );


$("chat-menu-button")
  ?.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      toggleMenu();

    }
  );


$("menu-group-info")
  ?.addEventListener(
    "click",
    openInfo
  );


$("group-info-close")
  ?.addEventListener(
    "click",
    closeInfo
  );


$("menu-copy-code")
  ?.addEventListener(
    "click",
    copyCode
  );


$("menu-leave-group")
  ?.addEventListener(
    "click",
    askLeave
  );


$("menu-delete-group")
  ?.addEventListener(
    "click",
    askDelete
  );


$("confirm-cancel")
  ?.addEventListener(
    "click",
    closeConfirmation
  );


$("confirm-ok")
  ?.addEventListener(
    "click",
    async () => {

      const callback =
        confirmationCallback;


      closeConfirmation();


      if (callback)
        await callback();

    }
  );


$("send-button")
  ?.addEventListener(
    "click",
    sendMessage
  );


$("message-input")
  ?.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        sendMessage();

      }

    }
  );


/* =========================================================
   MENU EXTÉRIEUR
========================================================= */

document.addEventListener(
  "click",
  event => {

    const menu =
      $("chat-menu");

    const button =
      $("chat-menu-button");


    if (
      menu &&
      button &&
      menu.style.display !==
        "none" &&
      !menu.contains(
        event.target
      ) &&
      !button.contains(
        event.target
      )
    ) {

      closeMenu();

    }

  }
);


/* =========================================================
   ESC
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Escape"
    ) {

      closeMenu();

      closeInfo();

      closeConfirmation();

    }

  }
);


/* =========================================================
   FIREBASE AUTH
========================================================= */

if (
  firebaseAvailable &&
  auth
) {

  onAuthStateChanged(
    auth,
    user => {

      if (user) {

        currentUser =
          user;

        firebaseAuthReady =
          true;


        window.anonyboxReady =
          true;


        console.log(
          "Firebase connecté :",
          user.uid
        );


        loadUnreadMessages();

        renderSavedGroups();

        loadGroups();

        loadProfile();


      } else {

        /*
           Pas d'utilisateur Firebase :
           on passe automatiquement en local.
        */

        if (!currentUser) {

          currentUser =
            createLocalUser();

        }


        firebaseAuthReady =
          false;


        window.anonyboxReady =
          true;


        loadUnreadMessages();

        renderSavedGroups();

        loadProfile();


        console.log(
          "Mode local activé."
        );

      }

    }
  );


  /*
     Connexion anonyme.
  */

  signInAnonymously(
    auth
  )

  .then(
    () => {

      console.log(
        "Connexion anonyme demandée."
      );

    }
  )

  .catch(
    error => {

      console.error(
        "Firebase Auth :",
        error
      );


      /*
         IMPORTANT :
         on ne bloque plus l'application.
      */

      firebaseAuthReady =
        false;


      currentUser =
        createLocalUser();


      window.anonyboxReady =
        true;


      loadUnreadMessages();

      renderSavedGroups();

      loadProfile();


      toast(
        "Mode hors connexion activé",
        "📱"
      );

    }
  );

} else {

  /*
     Firebase complètement indisponible.
  */

  currentUser =
    createLocalUser();


  window.anonyboxReady =
    true;


  loadUnreadMessages();

  renderSavedGroups();

  loadProfile();


  console.log(
    "AnonyBoX fonctionne en mode local."
  );
}


/* =========================================================
   DÉMARRAGE IMMÉDIAT
========================================================= */

showHome();


console.log(
  "AnonyBoX démarré — version stable"
);
