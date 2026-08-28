/* =========================================================
   ANONYBOX — SCRIPT.JS
   VERSION AVEC SAUVEGARDE LOCALE DES GROUPES
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
  apiKey: "AIzaSyAGrCghSoJf7ULhi1Zi1RqeYmt4bE63a3M",
  authDomain: "prjt-78fef.firebaseapp.com",
  databaseURL: "https://prjt-78fef-default-rtdb.firebaseio.com",
  projectId: "prjt-78fef",
  storageBucket: "prjt-78fef.firebasestorage.app",
  messagingSenderId: "502581952099",
  appId: "1:502581952099:web:2ae7c0912d073f3b11c256"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);


/* =========================================================
   ÉTAT
========================================================= */

let currentUser = null;
let currentGroupCode = null;
let currentGroup = null;

let messagesUnsubscribe = null;
let groupsUnsubscribe = null;

let confirmationCallback = null;


/* =========================================================
   OUTILS
========================================================= */

const $ = id => document.getElementById(id);


/* =========================================================
   TOAST
========================================================= */

function toast(message, icon = "✓") {

  const box = $("toast");

  if (!box) {
    console.log(message);
    return;
  }

  const messageBox = $("toast-message");
  const iconBox = $("toast-icon");

  if (messageBox)
    messageBox.textContent = message;

  if (iconBox)
    iconBox.textContent = icon;

  box.style.display = "flex";

  clearTimeout(window.anonyToast);

  window.anonyToast = setTimeout(() => {

    box.style.display = "none";

  }, 2500);
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
   ========================================================
   SAUVEGARDE LOCALE DES GROUPES
   ========================================================
========================================================= */


/*
   Tous les groupes sauvegardés sur ce téléphone
   sont placés ici.

   Exemple :

   anonybox_groups_UID
*/


function getGroupsStorageKey() {

  if (!currentUser)
    return null;

  return `anonybox_groups_${currentUser.uid}`;
}


/* ---------------------------------------------------------
   RÉCUPÉRER LES GROUPES LOCAUX
--------------------------------------------------------- */

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

    if (!Array.isArray(groups))
      return [];

    return groups;

  } catch (error) {

    console.error(
      "Erreur lecture groupes locaux :",
      error
    );

    return [];
  }
}


/* ---------------------------------------------------------
   SAUVEGARDER TOUS LES GROUPES
--------------------------------------------------------- */

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
      "Erreur sauvegarde locale :",
      error
    );

  }
}


/* ---------------------------------------------------------
   AJOUTER / METTRE À JOUR UN GROUPE
--------------------------------------------------------- */

function saveLocalGroup(group) {

  if (!currentUser || !group?.code)
    return;

  const groups =
    getLocalGroups();

  const index =
    groups.findIndex(
      item =>
        item &&
        item.code === group.code
    );


  /*
     On s'assure que le groupe possède
     bien les informations nécessaires.
  */

  const cleanGroup = {

    code:
      group.code,

    name:
      group.name || "Groupe",

    creator:
      group.creator || "",

    createdAt:
      group.createdAt || Date.now(),

    members:
      group.members || {
        [currentUser.uid]: true
      }

  };


  if (index >= 0) {

    groups[index] = {
      ...groups[index],
      ...cleanGroup
    };

  } else {

    groups.push(cleanGroup);

  }


  saveLocalGroups(groups);

  console.log(
    "Groupe sauvegardé localement :",
    cleanGroup.code
  );
}


/* ---------------------------------------------------------
   SUPPRIMER UN GROUPE DE LA SAUVEGARDE LOCALE
--------------------------------------------------------- */

function removeLocalGroup(code) {

  if (!code)
    return;

  const groups =
    getLocalGroups();

  const filtered =
    groups.filter(
      group =>
        group &&
        group.code !== code
    );

  saveLocalGroups(filtered);

  console.log(
    "Groupe retiré de la sauvegarde locale :",
    code
  );
}


/* ---------------------------------------------------------
   FUSION FIREBASE + LOCAL
--------------------------------------------------------- */

function mergeGroups(firebaseGroups) {

  const localGroups =
    getLocalGroups();


  const map =
    new Map();


  /*
     Les groupes Firebase passent en premier.
  */

  firebaseGroups.forEach(group => {

    if (
      group &&
      group.code
    ) {

      map.set(
        group.code,
        group
      );

    }

  });


  /*
     Ajouter les groupes locaux
     qui ne sont pas encore dans Firebase.
  */

  localGroups.forEach(group => {

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

  });


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


/* ---------------------------------------------------------
   NETTOYER LES GROUPES LOCAUX
--------------------------------------------------------- */

function cleanLocalGroups(firebaseGroups) {

  const firebaseCodes =
    new Set(
      firebaseGroups.map(
        group => group.code
      )
    );


  const localGroups =
    getLocalGroups();


  /*
     On garde les groupes locaux qui ne sont pas
     encore visibles dans Firebase.

     Cela évite de supprimer immédiatement
     un groupe pendant une coupure réseau.
  */

  const cleaned =
    localGroups.filter(
      group =>
        group &&
        group.code
    );


  /*
     Supprimer les doublons.
  */

  const unique =
    [];


  const seen =
    new Set();


  cleaned.forEach(group => {

    if (
      !seen.has(group.code)
    ) {

      seen.add(group.code);

      unique.push(group);

    }

  });


  saveLocalGroups(unique);
}


/* =========================================================
   NAVIGATION
========================================================= */

function hideMainScreens() {

  [
    "home-screen",
    "groups-screen",
    "profile-screen"
  ].forEach(id => {

    const element =
      $(id);

    if (element) {

      element.style.display =
        "none";

    }

  });
}


function activateNav(id) {

  document
    .querySelectorAll(
      ".bottom-nav button"
    )
    .forEach(button => {

      button.classList.remove(
        "nav-active"
      );

    });

  $(id)?.classList.add(
    "nav-active"
  );
}


function showHome() {

  hideMainScreens();

  const home =
    $("home-screen");

  if (home) {

    home.style.display =
      "block";

  }

  activateNav(
    "home-nav"
  );

  renderSavedGroups();
}


function showGroups() {

  hideMainScreens();

  const screen =
    $("groups-screen");

  if (screen) {

    screen.style.display =
      "block";

  }

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

  if (screen) {

    screen.style.display =
      "block";

  }

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

  if (!currentUser) {

    toast(
      "Connexion en cours...",
      "⏳"
    );

    return;
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


    if (snapshot.exists()) {

      toast(
        "Impossible de générer un code",
        "!"
      );

      return;
    }


    const now =
      Date.now();


    const group = {

      code:
        code,

      name:
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
       =====================================================
       ÉTAPE 1
       SAUVEGARDE LOCALE IMMÉDIATE
       =====================================================
    */

    saveLocalGroup(
      group
    );


    /*
       =====================================================
       ÉTAPE 2
       SAUVEGARDE FIREBASE
       =====================================================
    */

    await set(

      ref(
        db,
        `groups/${code}`
      ),

      {
        name:
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


    /*
       État courant
    */

    currentGroupCode =
      code;


    currentGroup =
      group;


    /*
       Affichage immédiat
    */

    renderSavedGroups();


    toast(
      "Groupe créé et sauvegardé",
      "✓"
    );


    /*
       Ouvrir le groupe
    */

    openGroup(
      code,
      group
    );


  } catch (error) {

    console.error(
      "ERREUR CRÉATION GROUPE :",
      error
    );


    /*
       Le groupe a peut-être déjà été sauvegardé
       localement avant l'erreur Firebase.
    */

    renderSavedGroups();


    toast(
      "Groupe sauvegardé sur l'appareil",
      "✓"
    );


    /*
       Si Firebase refuse l'écriture,
       on informe quand même dans la console.
    */

    console.error(
      "Firebase n'a pas accepté la création :",
      error
    );

  }

}


/* =========================================================
   REJOINDRE UN GROUPE
========================================================= */

async function joinGroup() {

  if (!currentUser) {

    toast(
      "Connexion en cours...",
      "⏳"
    );

    return;
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


  try {

    const groupRef =
      ref(
        db,
        `groups/${code}`
      );


    const snapshot =
      await get(
        groupRef
      );


    if (!snapshot.exists()) {

      /*
         Vérifier quand même
         dans la sauvegarde locale.
      */

      const localGroups =
        getLocalGroups();


      const localGroup =
        localGroups.find(
          group =>
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

        return;

      }


      toast(
        "Groupe introuvable",
        "!"
      );

      return;
    }


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

      code:
        code,

      name:
        group.name || "Groupe",

      creator:
        group.creator || "",

      createdAt:
        group.createdAt || Date.now(),

      members:
        group.members

    };


    /*
       Sauvegarde locale
    */

    saveLocalGroup(
      localGroup
    );


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


  } catch (error) {

    console.error(
      "ERREUR REJOINDRE :",
      error
    );


    /*
       Si le groupe existe déjà localement,
       on peut quand même l'ouvrir.
    */

    const localGroups =
      getLocalGroups();


    const localGroup =
      localGroups.find(
        group =>
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
        "Groupe ouvert hors connexion",
        "📱"
      );


      return;
    }


    toast(
      "Erreur : " +
      (error.code || "inconnue"),
      "!"
    );

  }

}


/* =========================================================
   CHARGER GROUPES FIREBASE
========================================================= */

function loadGroups() {

  if (!currentUser)
    return;


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

              firebaseGroups.push({

                code:
                  code,

                ...group

              });


              /*
                 Synchroniser avec le téléphone.
              */

              saveLocalGroup({

                code:
                  code,

                ...group

              });

            }

          }
        );


        /*
           Nettoyage des groupes locaux
        */

        cleanLocalGroups(
          firebaseGroups
        );


        /*
           Fusionner Firebase + local
        */

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
          "ERREUR GROUPES FIREBASE :",
          error
        );


        /*
           Firebase indisponible :
           utiliser les groupes locaux.
        */

        renderSavedGroups();

      }

    );
}


/* =========================================================
   RENDU DEPUIS LA SAUVEGARDE LOCALE
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
   AFFICHER GROUPES
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
          💬
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


      item.className =
        "group-card whatsapp-group";


      item.innerHTML = `

        <div class="group-avatar">
          👻
        </div>

        <div class="group-details">

          <div class="group-name">
            ${escapeHTML(
              group.name ||
              "Groupe"
            )}
          </div>

          <div class="group-last-message">
            Groupe privé
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
          💬
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


        item.className =
          "group-card whatsapp-group";


        item.innerHTML = `

          <div class="group-avatar">
            👻
          </div>

          <div class="group-details">

            <div class="group-name">
              ${escapeHTML(
                group.name ||
                "Groupe"
              )}
            </div>

            <div class="group-last-message">
              Discussion
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


  /*
     Si le groupe vient d'être ouvert,
     on le sauvegarde encore une fois.
  */

  if (
    group &&
    currentUser
  ) {

    saveLocalGroup({

      code:
        code,

      ...group

    });

  }


  currentGroupCode =
    code;


  currentGroup =
    group || {};


  hideMainScreens();


  closeMenu();

  closeInfo();


  const title =
    $("chat-title");


  if (title) {

    title.textContent =
      group?.name ||
      "Groupe";

  }


  const status =
    $("chat-status");


  if (status) {

    status.textContent =
      "Groupe privé";

  }


  const infoName =
    $("info-group-name");


  if (infoName) {

    infoName.textContent =
      group?.name ||
      "Groupe";

  }


  const infoCode =
    $("info-group-code");


  if (infoCode) {

    infoCode.textContent =
      code;

  }


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


  if (!page) {

    toast(
      "chat-page introuvable",
      "!"
    );

    return;
  }


  /*
     PAGE PLEIN ÉCRAN
  */

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


  page.style.left =
    "0";


  page.style.top =
    "0";


  page.style.right =
    "0";


  page.style.bottom =
    "0";


  page.style.width =
    "100vw";


  page.style.height =
    "100vh";


  page.style.zIndex =
    "99999";


  document.body.classList.add(
    "chat-open"
  );


  listenMessages(
    code
  );


  const input =
    $("message-input");


  if (input) {

    setTimeout(
      () => {

        input.focus();

      },
      100
    );

  }
}


/* =========================================================
   RETOUR
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
   MENU 3 POINTS
========================================================= */

function toggleMenu() {

  const menu =
    $("chat-menu");


  if (!menu)
    return;


  if (
    menu.style.display ===
      "block" ||
    menu.style.display ===
      "flex"
  ) {

    menu.style.display =
      "none";

  } else {

    menu.style.display =
      "block";

  }
}


function closeMenu() {

  const menu =
    $("chat-menu");


  if (menu) {

    menu.style.display =
      "none";

  }
}


/* =========================================================
   INFORMATIONS
========================================================= */

function openInfo() {

  closeMenu();


  const panel =
    $("group-info-panel");


  if (panel) {

    panel.style.display =
      "block";

  }
}


function closeInfo() {

  const panel =
    $("group-info-panel");


  if (panel) {

    panel.style.display =
      "none";

  }
}


function updateMemberCount(
  group
) {

  const members =
    group?.members || {};


  const count =
    Object.keys(
      members
    ).length;


  const element =
    $("info-member-count");


  if (element) {

    element.textContent =
      count;

  }
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

    if (
      confirm(message)
    ) {

      callback();

    }

    return;
  }


  const titleBox =
    $("confirm-title");


  const messageBox =
    $("confirm-message");


  if (titleBox)
    titleBox.textContent =
      title;


  if (messageBox)
    messageBox.textContent =
      message;


  confirmationCallback =
    callback;


  overlay.style.display =
    "flex";
}


function closeConfirmation() {

  const overlay =
    $("confirm-overlay");


  if (overlay) {

    overlay.style.display =
      "none";

  }


  confirmationCallback =
    null;
}


/* =========================================================
   QUITTER GROUPE
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


  if (
    !code ||
    !currentUser
  )
    return;


  try {

    /*
       Firebase
    */

    await remove(

      ref(
        db,
        `groups/${code}/members/${currentUser.uid}`
      )

    );


    /*
       Sauvegarde locale
    */

    removeLocalGroup(
      code
    );


    toast(
      "Groupe quitté",
      "✓"
    );


    closeChat();


  } catch (error) {

    console.error(
      "Erreur quitter groupe :",
      error
    );


    /*
       Même si Firebase est momentanément
       indisponible, on retire le groupe
       de l'affichage local.
    */

    removeLocalGroup(
      code
    );


    toast(
      "Groupe retiré de l'appareil",
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


  if (
    !code ||
    !currentUser
  )
    return;


  try {

    const snapshot =
      await get(

        ref(
          db,
          `groups/${code}`
        )

      );


    if (!snapshot.exists()) {

      removeLocalGroup(
        code
      );


      toast(
        "Groupe supprimé",
        "✓"
      );


      closeChat();

      return;
    }


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


    /*
       SUPPRESSION LOCALE
    */

    removeLocalGroup(
      code
    );


    toast(
      "Groupe supprimé",
      "✓"
    );


    closeChat();


  } catch (error) {

    console.error(
      "Erreur suppression :",
      error
    );


    /*
       Ne pas prétendre que Firebase a supprimé
       le groupe si l'opération a échoué.
    */

    toast(
      "Erreur de suppression Firebase",
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
   MESSAGES
========================================================= */

function listenMessages(
  code
) {

  stopMessages();


  const messagesRef =
    ref(
      db,
      `messages/${code}`
    );


  messagesUnsubscribe =
    onValue(

      messagesRef,

      snapshot => {

        renderMessages(
          snapshot.val() || {}
        );

      },

      error => {

        console.error(
          "Messages :",
          error
        );


        toast(
          "Erreur des messages",
          "!"
        );

      }

    );
}


/* =========================================================
   STOP MESSAGES
========================================================= */

function stopMessages() {

  if (
    messagesUnsubscribe
  ) {

    messagesUnsubscribe();

    messagesUnsubscribe =
      null;

  }
}


/* =========================================================
   AFFICHER MESSAGES
========================================================= */

function renderMessages(
  data
) {

  const container =
    $("messages");


  if (!container)
    return;


  container.innerHTML =
    "";


  const entries =
    Object.entries(
      data
    );


  entries.sort(
    ([, a], [, b]) =>
      (a.timestamp || 0) -
      (b.timestamp || 0)
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


      wrapper.className =
        "message-item";


      const author =
        document.createElement(
          "small"
        );


      author.textContent =
        message.name ||
        "Anonyme";


      const bubble =
        document.createElement(
          "div"
        );


      bubble.className =
        "message-bubble";


      bubble.textContent =
        message.text ||
        "";


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


  container.scrollTop =
    container.scrollHeight;
}


/* =========================================================
   ENVOYER MESSAGE
========================================================= */

async function sendMessage() {

  if (!currentUser) {

    toast(
      "Connexion en cours...",
      "⏳"
    );

    return;
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


  try {

    const messageRef =
      push(

        ref(
          db,
          `messages/${currentGroupCode}`
        )

      );


    const name =
      localStorage.getItem(
        "anonybox_username"
      ) ||
      "Anonyme";


    await set(

      messageRef,

      {

        text:
          text,

        name:
          name,

        uid:
          currentUser.uid,

        timestamp:
          Date.now()

      }

    );


    input.value =
      "";


    input.focus();


  } catch (error) {

    console.error(
      "Message :",
      error
    );


    toast(
      "Message non envoyé",
      "!"
    );

  }
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


/* =========================================================
   RETOUR CHAT
========================================================= */

$("chat-back-button")
  ?.addEventListener(
    "click",
    closeChat
  );


/* =========================================================
   MENU 3 POINTS
========================================================= */

$("chat-menu-button")
  ?.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      toggleMenu();

    }
  );


/* =========================================================
   INFO
========================================================= */

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


/* =========================================================
   COPIER
========================================================= */

$("menu-copy-code")
  ?.addEventListener(
    "click",
    copyCode
  );


/* =========================================================
   QUITTER
========================================================= */

$("menu-leave-group")
  ?.addEventListener(
    "click",
    askLeave
  );


/* =========================================================
   SUPPRIMER
========================================================= */

$("menu-delete-group")
  ?.addEventListener(
    "click",
    askDelete
  );


/* =========================================================
   CONFIRMATION ANNULER
========================================================= */

$("confirm-cancel")
  ?.addEventListener(
    "click",
    closeConfirmation
  );


/* =========================================================
   CONFIRMATION OK
========================================================= */

$("confirm-ok")
  ?.addEventListener(

    "click",

    async () => {

      const callback =
        confirmationCallback;


      closeConfirmation();


      if (callback) {

        await callback();

      }

    }

  );


/* =========================================================
   ENVOYER MESSAGE
========================================================= */

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
   FERMER MENU EN DEHORS
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

onAuthStateChanged(

  auth,

  user => {

    if (user) {

      currentUser =
        user;


      window.anonyboxReady =
        true;


      console.log(
        "Firebase connecté :",
        user.uid
      );


      /*
         Afficher immédiatement
         les groupes sauvegardés.
      */

      renderSavedGroups();


      loadGroups();

      loadProfile();


    } else {

      currentUser =
        null;


      window.anonyboxReady =
        false;

    }

  }

);


/* =========================================================
   CONNEXION ANONYME
========================================================= */

signInAnonymously(
  auth
)

.then(
  () => {

    console.log(
      "Connexion anonyme réussie"
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
       Les groupes locaux restent
       disponibles même si Firebase
       rencontre momentanément un problème.
    */

    toast(
      "Mode local activé",
      "📱"
    );


    renderSavedGroups();

  }
);


/* =========================================================
   DÉMARRAGE
========================================================= */

showHome();


console.log(
  "AnonyBoX démarré — sauvegarde locale activée"
);