/* =========================================================
   ANONYBOX — SCRIPT COMPLET
   Firebase Realtime Database + Authentification anonyme
   ========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    set,
    get,
    remove,
    push,
    onValue
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";


/* =========================================================
   CONFIGURATION FIREBASE
   ========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyAGrCghSoJf7ULhi1ZiR1qeYmt4bE63a3M",
    authDomain: "prjt-78fef.firebaseapp.com",
    databaseURL: "https://prjt-78fef-default-rtdb.firebaseio.com",
    projectId: "prjt-78fef",
    storageBucket: "prjt-78fef.firebasestorage.app",
    messagingSenderId: "502581952099",
    appId: "1:502581952099:web:2ae7c0912d073f3b11c256"
};


/* =========================================================
   VARIABLES
   ========================================================= */

let app = null;
let auth = null;
let db = null;

let firebaseAvailable = false;
let firebaseAuthReady = false;
let firebaseAuthError = null;

let currentUser = null;
let currentGroupCode = null;
let currentGroupName = null;

let messagesListener = null;
let groupsListener = null;

let authReadyPromise = null;
let authReadyResolve = null;


/* =========================================================
   INITIALISATION FIREBASE
   ========================================================= */

try {

    app = initializeApp(firebaseConfig);

    auth = getAuth(app);

    db = getDatabase(app);

    firebaseAvailable = true;

    console.log("Firebase initialisé.");

} catch (error) {

    console.error("Erreur initialisation Firebase :", error);

    firebaseAvailable = false;
}


/* =========================================================
   OUTILS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


function toast(message, icon = "✓") {

    let box = document.querySelector(".anony-toast");

    if (!box) {

        box = document.createElement("div");

        box.className = "anony-toast";

        document.body.appendChild(box);
    }

    box.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span>${escapeHTML(message)}</span>
    `;

    box.classList.add("show");

    clearTimeout(box._timer);

    box._timer = setTimeout(() => {
        box.classList.remove("show");
    }, 3000);
}


function escapeHTML(text) {

    if (text === null || text === undefined) {
        return "";
    }

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function createLocalUser() {

    let uid = localStorage.getItem("anonybox_local_uid");

    if (!uid) {

        uid =
            "local_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 10);

        localStorage.setItem(
            "anonybox_local_uid",
            uid
        );
    }

    return {
        uid,
        isLocal: true
    };
}


/* =========================================================
   AUTHENTIFICATION FIREBASE
   ========================================================= */

function createAuthPromise() {

    authReadyPromise = new Promise(resolve => {
        authReadyResolve = resolve;
    });

    return authReadyPromise;
}


createAuthPromise();


if (firebaseAvailable && auth) {

    onAuthStateChanged(auth, user => {

        console.log(
            "État Firebase Auth :",
            user ? user.uid : "aucun utilisateur"
        );

        if (user) {

            currentUser = user;

            firebaseAuthReady = true;

            firebaseAuthError = null;

            window.anonyboxReady = true;

            if (authReadyResolve) {
                authReadyResolve(user);
                authReadyResolve = null;
            }

            console.log(
                "✅ Firebase connecté :",
                user.uid
            );

            loadUnreadMessages();

            renderSavedGroups();

            loadGroups();

            loadProfile();

        } else {

            firebaseAuthReady = false;

            console.log(
                "Firebase : aucun utilisateur connecté."
            );
        }

    });


    signInAnonymously(auth)

        .then(result => {

            console.log(
                "✅ Connexion anonyme demandée."
            );

            console.log(
                "UID temporaire :",
                result.user.uid
            );

        })

        .catch(error => {

            firebaseAuthReady = false;

            firebaseAuthError = error;

            console.error(
                "❌ Firebase Auth"
            );

            console.error(
                "Code :",
                error.code
            );

            console.error(
                "Message :",
                error.message
            );

            currentUser = createLocalUser();

            window.anonyboxReady = true;

            loadUnreadMessages();

            renderSavedGroups();

            loadProfile();

            let message =
                "Connexion Firebase impossible.";

            if (
                error.code ===
                "auth/operation-not-allowed"
            ) {

                message =
                    "Active la connexion Anonyme dans Firebase.";

            } else if (
                error.code ===
                "auth/network-request-failed"
            ) {

                message =
                    "Internet ou connexion Firebase indisponible.";

            } else if (
                error.code ===
                "auth/too-many-requests"
            ) {

                message =
                    "Trop de tentatives Firebase. Réessaie plus tard.";

            } else if (
                error.code
            ) {

                message =
                    "Firebase : " +
                    error.code;
            }

            toast(message, "!");

        });

} else {

    currentUser = createLocalUser();

    window.anonyboxReady = true;

    loadUnreadMessages();

    renderSavedGroups();

    loadProfile();

    console.log(
        "Mode local : Firebase non initialisé."
    );
}


/* =========================================================
   ATTENDRE FIREBASE
   ========================================================= */

async function waitForFirebaseAuth(timeout = 10000) {

    if (
        firebaseAuthReady &&
        currentUser &&
        !currentUser.isLocal
    ) {

        return true;
    }

    if (
        !firebaseAvailable ||
        !auth
    ) {

        return false;
    }

    if (firebaseAuthError) {

        return false;
    }

    return new Promise(resolve => {

        let finished = false;

        const timer = setTimeout(() => {

            if (!finished) {

                finished = true;

                resolve(false);
            }

        }, timeout);

        const check = setInterval(() => {

            if (
                firebaseAuthReady &&
                currentUser &&
                !currentUser.isLocal
            ) {

                if (!finished) {

                    finished = true;

                    clearTimeout(timer);

                    clearInterval(check);

                    resolve(true);
                }
            }

            if (firebaseAuthError) {

                if (!finished) {

                    finished = true;

                    clearTimeout(timer);

                    clearInterval(check);

                    resolve(false);
                }
            }

        }, 100);

    });
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function hideAllScreens() {

    document
        .querySelectorAll(".screen, .page, section[data-screen]")
        .forEach(element => {

            element.classList.remove(
                "active",
                "show"
            );

        });
}


function showHome() {

    hideAllScreens();

    const home =
        $("homeScreen") ||
        $("home") ||
        document.querySelector(
            '[data-screen="home"]'
        );

    if (home) {

        home.classList.add("active");

        home.classList.add("show");
    }

    currentGroupCode = null;

    currentGroupName = null;
}


function showScreen(id) {

    hideAllScreens();

    const screen = $(id);

    if (screen) {

        screen.classList.add("active");

        screen.classList.add("show");
    }
}


/* =========================================================
   GROUPES SAUVEGARDÉS
   ========================================================= */

function getSavedGroups() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "anonybox_groups"
            )
        ) || [];

    } catch {

        return [];
    }
}


function saveGroups(groups) {

    localStorage.setItem(
        "anonybox_groups",
        JSON.stringify(groups)
    );
}


function saveGroup(code, name = "Groupe") {

    code = String(code).toUpperCase();

    let groups = getSavedGroups();

    const existing =
        groups.find(
            group => group.code === code
        );

    if (existing) {

        existing.name = name || existing.name;

    } else {

        groups.unshift({
            code,
            name: name || "Groupe",
            joinedAt: Date.now()
        });
    }

    saveGroups(groups);

    renderSavedGroups();
}


function removeSavedGroup(code) {

    code = String(code).toUpperCase();

    let groups =
        getSavedGroups().filter(
            group => group.code !== code
        );

    saveGroups(groups);

    renderSavedGroups();
}


/* =========================================================
   AFFICHER LES GROUPES
   ========================================================= */

function renderSavedGroups() {

    const groups =
        getSavedGroups();

    const container =
        $("groupsList") ||
        $("savedGroups") ||
        document.querySelector(
            ".groups-list"
        );

    if (!container) {
        return;
    }

    if (!groups.length) {

        container.innerHTML = `
            <div class="empty-groups">
                <div>👻</div>
                <p>Aucun groupe pour le moment.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = groups
        .map(group => `

            <div
                class="group-card"
                data-code="${escapeHTML(group.code)}"
            >

                <div
                    class="group-card-content"
                    onclick="window.openSavedGroup('${escapeHTML(group.code)}')"
                >

                    <div class="group-avatar">
                        👻
                    </div>

                    <div class="group-info">

                        <strong>
                            ${escapeHTML(
                                group.name ||
                                "Groupe"
                            )}
                        </strong>

                        <small>
                            ${escapeHTML(
                                group.code
                            )}
                        </small>

                    </div>

                </div>

            </div>

        `)
        .join("");
}


window.openSavedGroup = async function(code) {

    code =
        String(code)
            .trim()
            .toUpperCase();

    const groups =
        getSavedGroups();

    const group =
        groups.find(
            item => item.code === code
        );

    if (group) {

        await openGroup(
            code,
            group.name
        );

    } else {

        await joinGroup(code);
    }
};


/* =========================================================
   CRÉER UN GROUPE
   ========================================================= */

function generateGroupCode() {

    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let code = "";

    for (let i = 0; i < 6; i++) {

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


async function createGroup() {

    const name =
        prompt(
            "Nom du groupe :"
        );

    if (name === null) {
        return;
    }

    const cleanName =
        name.trim() || "Groupe AnonyBoX";

    toast(
        "Connexion à Firebase...",
        "⏳"
    );

    const ready =
        await waitForFirebaseAuth();

    if (!ready) {

        toast(
            getFirebaseErrorMessage(),
            "!"
        );

        console.error(
            "Création impossible : Firebase Auth non disponible."
        );

        return;
    }

    let code =
        generateGroupCode();

    try {

        while (
            (
                await get(
                    ref(
                        db,
                        `groups/${code}`
                    )
                )
            ).exists()
        ) {

            code =
                generateGroupCode();
        }


        await set(
            ref(
                db,
                `groups/${code}`
            ),
            {
                name: cleanName,

                createdAt:
                    Date.now(),

                owner:
                    currentUser.uid,

                members: {
                    [currentUser.uid]: true
                }
            }
        );


        await set(
            ref(
                db,
                `groupCodes/${code}`
            ),
            {
                code,

                name: cleanName,

                createdAt:
                    Date.now()
            }
        );


        saveGroup(
            code,
            cleanName
        );


        toast(
            "Groupe créé !",
            "✓"
        );


        await openGroup(
            code,
            cleanName
        );


    } catch (error) {

        console.error(
            "Erreur création groupe :",
            error
        );

        toast(
            firebaseReadableError(
                error
            ),
            "!"
        );
    }
}


/* =========================================================
   REJOINDRE UN GROUPE
   ========================================================= */

async function joinGroup(providedCode = null) {

    let code =
        providedCode;

    if (!code) {

        code =
            prompt(
                "Entre le code du groupe :"
            );
    }

    if (code === null) {
        return;
    }

    code =
        String(code)
            .trim()
            .toUpperCase();


    if (!code) {

        toast(
            "Entre un code de groupe.",
            "!"
        );

        return;
    }


    if (
        !/^[A-Z0-9]{4,12}$/.test(code)
    ) {

        toast(
            "Code de groupe invalide.",
            "!"
        );

        return;
    }


    toast(
        "Connexion à Firebase...",
        "⏳"
    );


    const ready =
        await waitForFirebaseAuth();


    if (!ready) {

        toast(
            getFirebaseErrorMessage(),
            "!"
        );

        return;
    }


    try {

        console.log(
            "Recherche du groupe :",
            `groups/${code}`
        );


        const groupSnapshot =
            await get(
                ref(
                    db,
                    `groups/${code}`
                )
            );


        if (!groupSnapshot.exists()) {

            toast(
                "Ce groupe n'existe pas.",
                "!"
            );

            console.warn(
                "Groupe introuvable :",
                code
            );

            return;
        }


        const groupData =
            groupSnapshot.val() || {};


        const groupName =
            groupData.name ||
            "Groupe AnonyBoX";


        await set(
            ref(
                db,
                `groups/${code}/members/${currentUser.uid}`
            ),
            true
        );


        saveGroup(
            code,
            groupName
        );


        toast(
            "Groupe rejoint !",
            "✓"
        );


        await openGroup(
            code,
            groupName
        );


    } catch (error) {

        console.error(
            "Erreur rejoindre groupe :",
            error
        );

        toast(
            firebaseReadableError(
                error
            ),
            "!"
        );
    }
}


/* =========================================================
   OUVRIR UN GROUPE
   ========================================================= */

async function openGroup(
    code,
    name = "Groupe AnonyBoX"
) {

    currentGroupCode =
        String(code)
            .trim()
            .toUpperCase();

    currentGroupName =
        name || "Groupe AnonyBoX";


    const codeElements =
        document.querySelectorAll(
            "[data-group-code]"
        );

    codeElements.forEach(element => {

        element.textContent =
            currentGroupCode;
    });


    const nameElements =
        document.querySelectorAll(
            "[data-group-name]"
        );

    nameElements.forEach(element => {

        element.textContent =
            currentGroupName;
    });


    const title =
        $("chatGroupName") ||
        $("groupName") ||
        document.querySelector(
            ".chat-group-name"
        );

    if (title) {

        title.textContent =
            currentGroupName;
    }


    const codeDisplay =
        $("chatGroupCode") ||
        $("groupCode");

    if (codeDisplay) {

        codeDisplay.textContent =
            currentGroupCode;
    }


    showScreen(
        "chatScreen"
    );


    if (
        !document.getElementById(
            "chatScreen"
        )
    ) {

        showScreen("chat");

    }


    loadMessages(
        currentGroupCode
    );


    loadGroupInfo(
        currentGroupCode
    );
}


/* =========================================================
   MESSAGES
   ========================================================= */

function getLocalMessages(code) {

    try {

        return JSON.parse(
            localStorage.getItem(
                `anonybox_messages_${code}`
            )
        ) || [];

    } catch {

        return [];
    }
}


function saveLocalMessages(
    code,
    messages
) {

    localStorage.setItem(
        `anonybox_messages_${code}`,
        JSON.stringify(messages)
    );
}


function renderMessages(messages) {

    const container =
        $("messagesContainer") ||
        $("messages") ||
        document.querySelector(
            ".messages-container"
        );


    if (!container) {
        return;
    }


    if (!messages.length) {

        container.innerHTML = `
            <div class="empty-messages">
                <div class="empty-icon">
                    👻
                </div>
                <p>
                    Aucun message pour le moment.
                </p>
                <small>
                    Commence la conversation.
                </small>
            </div>
        `;

        return;
    }


    container.innerHTML =
        messages
            .sort(
                (a, b) =>
                    (a.timestamp || 0) -
                    (b.timestamp || 0)
            )
            .map(message => {

                const mine =
                    currentUser &&
                    message.uid ===
                    currentUser.uid;


                const time =
                    formatTime(
                        message.timestamp
                    );


                return `

                    <div
                        class="message-row ${mine ? "mine" : "other"}"
                    >

                        <div
                            class="message-bubble"
                        >

                            <div
                                class="message-text"
                            >
                                ${formatMessage(
                                    message.text
                                )}
                            </div>

                            <div
                                class="message-time"
                            >
                                ${time}
                            </div>

                        </div>

                    </div>

                `;

            })
            .join("");


    container.scrollTop =
        container.scrollHeight;
}


function formatMessage(text) {

    return escapeHTML(
        text || ""
    ).replace(
        /\n/g,
        "<br>"
    );
}


function formatTime(timestamp) {

    if (!timestamp) {
        return "";
    }

    const date =
        new Date(timestamp);

    return date.toLocaleTimeString(
        "fr-FR",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* =========================================================
   CHARGER LES MESSAGES
   ========================================================= */

function loadMessages(code) {

    if (!code) {
        return;
    }


    if (messagesListener) {

        try {
            messagesListener();
        } catch {}

        messagesListener = null;
    }


    const local =
        getLocalMessages(code);


    renderMessages(local);


    if (
        !firebaseAvailable ||
        !firebaseAuthReady ||
        !currentUser ||
        currentUser.isLocal
    ) {

        return;
    }


    const messagesRef =
        ref(
            db,
            `messages/${code}`
        );


    messagesListener =
        onValue(
            messagesRef,
            snapshot => {

                const data =
                    snapshot.val();


                if (!data) {

                    renderMessages([]);

                    return;
                }


                const messages =
                    Object.entries(data)
                        .map(
                            ([id, value]) => ({
                                id,
                                ...value
                            })
                        );


                saveLocalMessages(
                    code,
                    messages
                );


                renderMessages(
                    messages
                );

            },

            error => {

                console.error(
                    "Erreur écoute messages :",
                    error
                );

            }
        );
}


/* =========================================================
   ENVOYER UN MESSAGE
   ========================================================= */

async function sendMessage() {

    const input =
        $("messageInput") ||
        $("chatInput") ||
        document.querySelector(
            'textarea[name="message"], input[name="message"]'
        );


    if (!input) {

        console.warn(
            "Champ message introuvable."
        );

        return;
    }


    const text =
        input.value.trim();


    if (!text) {
        return;
    }


    if (!currentGroupCode) {

        toast(
            "Aucun groupe ouvert.",
            "!"
        );

        return;
    }


    const message = {

        text,

        uid:
            currentUser?.uid ||
            createLocalUser().uid,

        timestamp:
            Date.now()

    };


    input.value = "";


    if (
        firebaseAvailable &&
        firebaseAuthReady &&
        currentUser &&
        !currentUser.isLocal
    ) {

        try {

            const messagesRef =
                ref(
                    db,
                    `messages/${currentGroupCode}`
                );


            await push(
                messagesRef,
                message
            );


            return;

        } catch (error) {

            console.error(
                "Firebase message error :",
                error
            );

            toast(
                "Message non envoyé.",
                "!"
            );

            input.value = text;

            return;
        }
    }


    const messages =
        getLocalMessages(
            currentGroupCode
        );


    messages.push(message);


    saveLocalMessages(
        currentGroupCode,
        messages
    );


    renderMessages(
        messages
    );
}


/* =========================================================
   GROUPES FIREBASE
   ========================================================= */

function loadGroups() {

    if (
        !firebaseAvailable ||
        !firebaseAuthReady ||
        !currentUser ||
        currentUser.isLocal
    ) {

        return;
    }


    if (groupsListener) {

        try {
            groupsListener();
        } catch {}

        groupsListener = null;
    }


    const groupsRef =
        ref(db, "groups");


    groupsListener =
        onValue(
            groupsRef,
            snapshot => {

                const data =
                    snapshot.val();


                if (!data) {
                    return;
                }


                const myGroups = [];


                Object.entries(data)
                    .forEach(
                        ([code, group]) => {

                            if (
                                group &&
                                group.members &&
                                group.members[
                                    currentUser.uid
                                ]
                            ) {

                                myGroups.push({

                                    code,

                                    name:
                                        group.name ||
                                        "Groupe AnonyBoX",

                                    joinedAt:
                                        group.createdAt ||
                                        Date.now()

                                });
                            }

                        }
                    );


                if (myGroups.length) {

                    saveGroups(
                        myGroups
                    );

                    renderSavedGroups();
                }

            },

            error => {

                console.error(
                    "Erreur groupes :",
                    error
                );
            }
        );
}


/* =========================================================
   INFORMATIONS DU GROUPE
   ========================================================= */

async function loadGroupInfo(code) {

    if (
        !firebaseAvailable ||
        !firebaseAuthReady ||
        !db
    ) {

        return;
    }


    try {

        const snapshot =
            await get(
                ref(
                    db,
                    `groups/${code}`
                )
            );


        if (!snapshot.exists()) {
            return;
        }


        const group =
            snapshot.val();


        const name =
            group.name ||
            "Groupe AnonyBoX";


        currentGroupName =
            name;


        document
            .querySelectorAll(
                "[data-group-name]"
            )
            .forEach(
                element => {
                    element.textContent =
                        name;
                }
            );


        const members =
            group.members
                ? Object.keys(
                    group.members
                ).length
                : 0;


        document
            .querySelectorAll(
                "[data-members-count]"
            )
            .forEach(
                element => {
                    element.textContent =
                        members;
                }
            );


    } catch (error) {

        console.error(
            "Erreur infos groupe :",
            error
        );
    }
}


/* =========================================================
   QUITTER UN GROUPE
   ========================================================= */

async function leaveCurrentGroup() {

    if (!currentGroupCode) {
        return;
    }


    const code =
        currentGroupCode;


    if (
        firebaseAvailable &&
        firebaseAuthReady &&
        currentUser &&
        !currentUser.isLocal
    ) {

        try {

            await remove(
                ref(
                    db,
                    `groups/${code}/members/${currentUser.uid}`
                )
            );

        } catch (error) {

            console.error(
                "Erreur quitter groupe :",
                error
            );

            toast(
                firebaseReadableError(
                    error
                ),
                "!"
            );

            return;
        }
    }


    removeSavedGroup(
        code
    );


    if (messagesListener) {

        try {
            messagesListener();
        } catch {}

        messagesListener = null;
    }


    currentGroupCode = null;

    currentGroupName = null;


    toast(
        "Tu as quitté le groupe.",
        "✓"
    );


    showHome();
}


/* =========================================================
   SUPPRIMER UN GROUPE
   ========================================================= */

async function deleteCurrentGroup() {

    if (!currentGroupCode) {
        return;
    }


    const confirmed =
        confirm(
            "Supprimer définitivement ce groupe ?"
        );


    if (!confirmed) {
        return;
    }


    const code =
        currentGroupCode;


    if (
        firebaseAvailable &&
        firebaseAuthReady &&
        currentUser &&
        !currentUser.isLocal
    ) {

        try {

            const groupSnapshot =
                await get(
                    ref(
                        db,
                        `groups/${code}`
                    )
                );


            if (
                groupSnapshot.exists()
            ) {

                const group =
                    groupSnapshot.val();


                if (
                    group.owner &&
                    group.owner !==
                    currentUser.uid
                ) {

                    toast(
                        "Seul le créateur peut supprimer ce groupe.",
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


        } catch (error) {

            console.error(
                "Erreur suppression groupe :",
                error
            );

            toast(
                firebaseReadableError(
                    error
                ),
                "!"
            );

            return;
        }
    }


    removeSavedGroup(
        code
    );


    localStorage.removeItem(
        `anonybox_messages_${code}`
    );


    currentGroupCode = null;

    currentGroupName = null;


    toast(
        "Groupe supprimé.",
        "✓"
    );


    showHome();
}


/* =========================================================
   COPIER LE CODE
   ========================================================= */

async function copyGroupCode() {

    if (!currentGroupCode) {
        return;
    }


    try {

        await navigator.clipboard.writeText(
            currentGroupCode
        );


        toast(
            "Code copié !",
            "✓"
        );

    } catch {

        toast(
            "Impossible de copier le code.",
            "!"
        );
    }
}


/* =========================================================
   PROFIL
   ========================================================= */

function loadProfile() {

    const uidElement =
        $("profileUid") ||
        $("userUid");


    if (
        uidElement &&
        currentUser
    ) {

        uidElement.textContent =
            currentUser.uid;
    }
}


/* =========================================================
   MESSAGES NON LUS
   ========================================================= */

function loadUnreadMessages() {

    const unread =
        parseInt(
            localStorage.getItem(
                "anonybox_unread"
            ) || "0",
            10
        );


    updateUnreadBadge(
        unread
    );
}


function updateUnreadBadge(count) {

    document
        .querySelectorAll(
            ".unread-badge"
        )
        .forEach(
            badge => {

                badge.textContent =
                    count > 99
                        ? "99+"
                        : count;

                badge.style.display =
                    count > 0
                        ? "flex"
                        : "none";
            }
        );
}


/* =========================================================
   ERREURS FIREBASE
   ========================================================= */

function getFirebaseErrorMessage() {

    if (!firebaseAvailable) {

        return "Firebase n'est pas initialisé.";
    }


    if (firebaseAuthError) {

        return firebaseReadableError(
            firebaseAuthError
        );
    }


    if (!firebaseAuthReady) {

        return "Connexion Firebase non disponible.";
    }


    return "Erreur Firebase inconnue.";
}


function firebaseReadableError(error) {

    if (!error) {

        return "Erreur inconnue.";
    }


    console.error(
        "Firebase error code:",
        error.code
    );

    console.error(
        "Firebase error message:",
        error.message
    );


    switch (error.code) {

        case "auth/operation-not-allowed":

            return "Connexion anonyme désactivée dans Firebase.";

        case "auth/network-request-failed":

            return "Connexion Internet/Firebase impossible.";

        case "auth/too-many-requests":

            return "Trop de tentatives. Réessaie plus tard.";

        case "auth/invalid-api-key":

            return "Clé API Firebase incorrecte.";

        case "auth/app-not-authorized":

            return "Cette application n'est pas autorisée par Firebase.";

        case "PERMISSION_DENIED":

            return "Firebase refuse l'accès. Vérifie les règles.";

        case "permission_denied":

            return "Firebase refuse l'accès. Vérifie les règles.";

        case "PERMISSION_DENIED: Permission denied":

            return "Permission Firebase refusée.";

        default:

            return (
                "Erreur Firebase : " +
                (
                    error.code ||
                    error.message ||
                    "inconnue"
                )
            );
    }
}


/* =========================================================
   ÉVÉNEMENTS
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        renderSavedGroups();

        loadUnreadMessages();


        const sendButton =
            $("sendMessageBtn") ||
            $("sendBtn") ||
            document.querySelector(
                ".send-message-btn"
            );


        if (sendButton) {

            sendButton.addEventListener(
                "click",
                sendMessage
            );
        }


        const messageInput =
            $("messageInput") ||
            $("chatInput");


        if (messageInput) {

            messageInput.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter" &&
                        !event.shiftKey
                    ) {

                        event.preventDefault();

                        sendMessage();
                    }

                }
            );
        }


        const createButtons =
            document.querySelectorAll(
                "[data-create-group]"
            );


        createButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    createGroup
                );
            }
        );


        const joinButtons =
            document.querySelectorAll(
                "[data-join-group]"
            );


        joinButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => joinGroup()
                );
            }
        );


        const homeButtons =
            document.querySelectorAll(
                "[data-home]"
            );


        homeButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    showHome
                );
            }
        );


        const copyButtons =
            document.querySelectorAll(
                "[data-copy-code]"
            );


        copyButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    copyGroupCode
                );
            }
        );


        const leaveButtons =
            document.querySelectorAll(
                "[data-leave-group]"
            );


        leaveButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    leaveCurrentGroup
                );
            }
        );


        const deleteButtons =
            document.querySelectorAll(
                "[data-delete-group]"
            );


        deleteButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    deleteCurrentGroup
                );
            }
        );


        showHome();

    }
);


/* =========================================================
   FONCTIONS ACCESSIBLES DEPUIS HTML
   ========================================================= */

window.createGroup =
    createGroup;

window.joinGroup =
    joinGroup;

window.sendMessage =
    sendMessage;

window.showHome =
    showHome;

window.leaveCurrentGroup =
    leaveCurrentGroup;

window.deleteCurrentGroup =
    deleteCurrentGroup;

window.copyGroupCode =
    copyGroupCode;

window.openGroup =
    openGroup;


/* =========================================================
   DÉMARRAGE
   ========================================================= */

console.log(
    "👻 AnonyBoX démarré — Firebase version corrigée"
);

console.log(
    "Firebase disponible :",
    firebaseAvailable
);
