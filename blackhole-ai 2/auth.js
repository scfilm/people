// auth.js (China-friendly dynamic loader)
// Dynamically load Firebase SDK; if blocked or not configured, fall back to "demo auth" (no login).

export let app = null;
export let auth = null;
export let db = null;
export let currentUser = null;

// Admin emails that can access seeding tool
export const ALLOWED_ADMINS = [ "you@example.com" ];

// ---- Utilities ----
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function withTimeout(p, ms=2500){
  return Promise.race([ p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)) ]);
}
async function tryImport(url){
  try{ return await withTimeout(import(url), 3500); } catch(e){ return null; }
}
async function loadFirebaseSdk(){
  // Try gstatic first (official ESM)
  const appMod = await tryImport("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const authMod = await tryImport("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const fsMod = await tryImport("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  if (appMod && authMod && fsMod) return { appMod, authMod, fsMod };
  return null; // give up; we'll enter demo mode
}

// ---- UI areas ----
const authArea = document.getElementById("auth-area");
function setAuthArea(html){ if (authArea) authArea.innerHTML = html; }

function renderDemoAuth(reason=""){
  const note = reason ? `<span class="badge" title="${reason}">Demo</span>` : `<span class="badge">Demo</span>`;
  setAuthArea(`
    ${note}
    <div class="badge">Sign-in disabled · 登录不可用</div>
  `);
}

function renderSignedOut(sdk, provider){
  setAuthArea(`<button class="btn pill" id="signin-btn">Sign in with Google · 使用 Google 登录</button>`);
  const btn = document.getElementById("signin-btn");
  btn?.addEventListener("click", async () => {
    try{
      await sdk.authMod.signInWithPopup(auth, provider);
    }catch(e){
      alert("Sign-in failed: " + (e?.message || e));
    }
  });
}

function renderSignedIn(user, isAdmin){
  setAuthArea(`
    <div class="badge" title="${user.email||""}">
      <img src="${user.photoURL||""}" alt="" style="width:18px;height:18px;border-radius:50%"/>
      <span>${user.displayName || user.email}</span>
      ${isAdmin ? '<span class="badge">Admin</span>' : ''}
    </div>
    <div class="dropdown">
      <button class="btn pill" id="profile-btn">⋯</button>
    </div>
  `);
  const btn = document.getElementById("profile-btn");
  btn?.addEventListener("click", () => openProfileMenu(isAdmin));
}

function openProfileMenu(isAdmin){
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
  modal.innerHTML = `
    <div class="modal-card">
      <h3>Account · 账户</h3>
      <div class="form-row">
        <div class="badge">
          <img src="${currentUser?.photoURL||""}" style="width:20px;height:20px;border-radius:50%"/>
          <span>${currentUser?.displayName || currentUser?.email || "Guest"}</span>
        </div>
      </div>
      <div class="form-actions" style="justify-content: space-between;">
        <div>
          ${isAdmin ? '<button class="btn" id="seed-btn">Seed demo data · 导入示例数据</button>' : ''}
        </div>
        <div>
          <button class="btn outline" id="close-modal">Close · 关闭</button>
          <button class="btn" id="signout-btn">Sign out · 退出</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("close-modal").onclick = () => modal.classList.add("hidden");
  document.getElementById("signout-btn").onclick = async () => {
    try{
      const sdk = window.__FB_SDK__;
      if (sdk && auth) await sdk.authMod.signOut(auth);
    }catch(e){ /* ignore */ }
  };
  if (isAdmin) {
    document.getElementById("seed-btn").onclick = async () => {
      modal.classList.add("hidden");
      const { seedDemo } = await import("./ui.js");
      await seedDemo();
    };
  }
}

// ---- Init ----
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

(async function init(){
  // Try SDK
  const sdk = await loadFirebaseSdk();
  if (!sdk) {
    renderDemoAuth("SDK blocked/unavailable");
    return;
  }
  window.__FB_SDK__ = sdk; // expose for other modules if needed

  // If not configured, stay in demo auth
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    renderDemoAuth("Not configured");
    return;
  }

  // Initialize
  try{
    app = sdk.appMod.initializeApp(firebaseConfig);
    auth = sdk.authMod.getAuth(app);
    db = sdk.fsMod.getFirestore(app);

    const provider = new sdk.authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    sdk.authMod.onAuthStateChanged(auth, async (user) => {
      currentUser = user || null;
      if (!user) {
        renderSignedOut(sdk, provider);
      } else {
        // ensure user doc exists
        try{
          const ref = sdk.fsMod.doc(db, "users", user.uid);
          const snap = await sdk.fsMod.getDoc(ref);
          if (!snap.exists()) {
            await sdk.fsMod.setDoc(ref, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || "",
              photoURL: user.photoURL || "",
              createdAt: sdk.fsMod.serverTimestamp()
            });
          }
        }catch(e){ /* ignore */ }
        renderSignedIn(user, ALLOWED_ADMINS.includes(user.email));
      }
    });
  }catch(e){
    renderDemoAuth("Init failed");
  }
})();

export async function requireAuth(){
  if (!auth) throw new Error("Please sign in with Google first · 请先使用 Google 登录");
  return new Promise((resolve, reject) => {
    const sdk = window.__FB_SDK__;
    if (!sdk) return reject(new Error("Auth not ready"));
    const unsub = sdk.authMod.onAuthStateChanged(auth, (u) => {
      unsub();
      if (u) resolve(u);
      else reject(new Error("Please sign in with Google first · 请先使用 Google 登录"));
    });
  });
}
