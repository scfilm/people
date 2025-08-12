// app.js (no static CDN imports; seed fallback ready)
import { db } from "./auth.js";
import { requireAuth } from "./auth.js";

let DEMO_MODE = false;
let SEED = null;

async function loadSeed(){
  if (SEED) return SEED;
  try{
    const resp = await fetch("./seed/seed.json", { cache: "no-store" });
    if (resp.ok) {
      SEED = await resp.json();
      return SEED;
    }
  }catch(e){ /* ignore */ }
  return null;
}

function setDemoMode(on){
  DEMO_MODE = !!on;
  const root = document.getElementById("app");
  const old = document.getElementById("demo-banner");
  if (old) old.remove();
  if (on) {
    const banner = document.createElement("div");
    banner.id = "demo-banner";
    banner.className = "footer";
    banner.innerHTML = `<div class="badge">Demo Data · 演示模式</div> 数据来自本地 seed/seed.json。要启用完整社群功能，请在 auth.js 配置 Firebase 并导入种子。`;
    root.prepend(banner);
  }
}

async function FS(){
  try{
    return await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  }catch(e){
    return null;
  }
}

// Simple hash router
window.addEventListener("hashchange", () => route(location.hash));
window.addEventListener("DOMContentLoaded", () => {
  route(location.hash);
  document.getElementById("q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const v = e.target.value.trim();
      if (v) location.hash = `#/search/${encodeURIComponent(v)}`;
    }
  });
});

async function route(hash){
  if (!hash || hash === "#/" || hash === "") return renderHome();
  const parts = hash.replace(/^#\//,"").split("/");
  const page = parts[0];
  if (page === "category") {
    const slug = parts[1];
    return renderCategory(slug);
  } else if (page === "question") {
    const id = parts[1];
    return renderQuestion(id);
  } else if (page === "search") {
    const q = decodeURIComponent(parts.slice(1).join("/"));
    return renderSearch(q);
  } else {
    return renderHome();
  }
}

// Helpers
function el(tag, attrs={}, children=[]){
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  });
  children.forEach(c => node.append(c));
  return node;
}
function fallback(txt, alt){ return (txt && String(txt).trim()) ? txt : alt; }

// ---------- Home ----------
async function renderHome(){
  const root = document.getElementById("app");
  root.innerHTML = "";
  const tpl = document.getElementById("tpl-home").content.cloneNode(true);
  root.append(tpl);

  let ok = false;
  try { ok = await renderHomeFromFirestore(); } catch(e){ ok = false; }
  if (!ok) await renderHomeFromSeed();
}

async function renderHomeFromFirestore(){
  if (!db) return false;
  const fs = await FS(); if (!fs) return false;

  const catGrid = document.getElementById("cat-grid");
  const catsSnap = await fs.getDocs(fs.query(fs.collection(db, "categories")));
  const cats = [];
  catsSnap.forEach(d => cats.push(d.data()));
  cats.sort((a,b) => (a.order||0) - (b.order||0));
  for (const c of cats) {
    const card = el("a", {class:"cat-card", href:`#/category/${c.slug}`}, [
      el("div",{class:"row-title"},[`${c.titleEn} · ${c.titleZh}`]),
      el("div",{class:"row-sub"},["Tap to view top questions · 点击查看热门问题"]),
    ]);
    catGrid.append(card);
  }

  const car = document.getElementById("top-carousel");
  const qSnap = await fs.getDocs(fs.query(fs.collection(db, "questions")));
  const arr = [];
  qSnap.forEach(d => arr.push(d.data()));
  arr.sort((a,b) => (b.upvotesCount||0) - (a.upvotesCount||0));

  for (const q of arr.slice(0, 12)) {
    const solutions = await getTopSolutionsForQuestion(q.id, 1);
    const topSol = solutions[0];
    const card = el("a", {class:"card", href:`#/question/${q.id}`}, [
      el("h3",{class:"title"},[`${q.titleEn}`]),
      el("p",{class:"subtitle"},[`${fallback(q.titleZh,"")}`]),
      el("div",{class:"line"},[
        el("span",{},["👍 ", String(q.upvotesCount||0)]),
        el("span",{},["·"]),
        el("span",{},[q.category])
      ]),
      el("div",{class:"line"},[
        el("span",{},["Top solution: "]),
        el("span",{},[ topSol ? (topSol.contentEn || topSol.contentZh || "—") : "No solution yet · 暂无方案" ])
      ]),
    ]);
    car.append(card);
  }
  return true;
}

async function renderHomeFromSeed(){
  const seed = await loadSeed();
  if (!seed) return;
  setDemoMode(true);

  const catGrid = document.getElementById("cat-grid");
  const cats = [...seed.categories].sort((a,b) => (a.order||0) - (b.order||0));
  for (const c of cats) {
    const card = el("a", {class:"cat-card", href:`#/category/${c.slug}`}, [
      el("div",{class:"row-title"},[`${c.titleEn} · ${c.titleZh}`]),
      el("div",{class:"row-sub"},["Tap to view top questions · 点击查看热门问题"]),
    ]);
    catGrid.append(card);
  }

  const car = document.getElementById("top-carousel");
  const arr = [...seed.questions].sort((a,b) => (b.upvotesCount||0) - (a.upvotesCount||0));
  for (const q of arr.slice(0,12)) {
    const topSol = q.sampleSolution || null;
    const card = el("a", {class:"card", href:`#/question/${q.id}`}, [
      el("h3",{class:"title"},[`${q.titleEn}`]),
      el("p",{class:"subtitle"},[`${fallback(q.titleZh,"")}`]),
      el("div",{class:"line"},[
        el("span",{},["👍 ", String(q.upvotesCount||0)]),
        el("span",{},["·"]),
        el("span",{},[q.category])
      ]),
      el("div",{class:"line"},[
        el("span",{},["Top solution: "]),
        el("span",{},[ topSol ? (topSol.contentEn || topSol.contentZh || "—") : "No solution yet · 暂无方案" ])
      ]),
    ]);
    car.append(card);
  }
}

// ---------- Category ----------
async function renderCategory(slug){
  const root = document.getElementById("app");
  root.innerHTML = "";
  const tpl = document.getElementById("tpl-category").content.cloneNode(true);
  root.append(tpl);
  document.querySelector("[data-back]").onclick = () => history.back();

  let ok = false;
  try{ ok = await renderCategoryFromFirestore(slug); }catch(e){ ok = false; }
  if (!ok) await renderCategoryFromSeed(slug);
}

async function renderCategoryFromFirestore(slug){
  if (!db) return false;
  const fs = await FS(); if (!fs) return false;
  const catDoc = await fs.getDoc(fs.doc(db,"categories", slug));
  if (!catDoc.exists()) return false;
  const cat = catDoc.data();
  document.getElementById("cat-title").textContent = `${cat.titleEn} · ${cat.titleZh}`;

  const list = document.getElementById("question-list");
  const qSnap = await fs.getDocs(fs.query(fs.collection(db,"questions")));
  const qs = [];
  qSnap.forEach(d => { if (d.data().category === slug) qs.push(d.data()); });
  qs.sort((a,b) => (b.upvotesCount||0) - (a.upvotesCount||0));
  if (qs.length === 0) return false;
  for (const q of qs) list.append(renderQuestionRow(q));
  return true;
}

async function renderCategoryFromSeed(slug){
  const seed = await loadSeed();
  if (!seed) return;
  setDemoMode(true);
  const cat = seed.categories.find(c => c.slug === slug) || { titleEn: slug, titleZh: "" };
  document.getElementById("cat-title").textContent = `${cat.titleEn} · ${cat.titleZh}`;

  const list = document.getElementById("question-list");
  const qs = seed.questions.filter(q => q.category === slug).sort((a,b)=> (b.upvotesCount||0)-(a.upvotesCount||0));
  if (qs.length === 0) list.append(el("div",{class:"row-sub"},["No data · 暂无数据"]));
  for (const q of qs) list.append(renderQuestionRow(q));
}

function renderQuestionRow(q){
  const row = el("div",{class:"row-card"});
  const head = el("div",{class:"row-head"});
  head.append(el("a",{class:"row-title linklike", href:`#/question/${q.id}`},[ `${q.titleEn}` ]));
  head.append(el("span",{class:"kv"},[ `👍 ${q.upvotesCount||0}` ]));
  row.append(head);
  row.append(el("div",{class:"row-sub"},[ `${fallback(q.titleZh,"")}` ]));
  return row;
}

// ---------- Question ----------
async function renderQuestion(id){
  const root = document.getElementById("app");
  root.innerHTML = "";
  const tpl = document.getElementById("tpl-question").content.cloneNode(true);
  root.append(tpl);
  document.querySelector("[data-back]").onclick = () => history.back();

  let ok = false;
  try{ ok = await renderQuestionFromFirestore(id); }catch(e){ ok = false; }
  if (!ok) await renderQuestionFromSeed(id);

  if (DEMO_MODE) {
    const up = document.getElementById("q-upvote");
    const add = document.getElementById("add-solution");
    if (up) up.disabled = true;
    if (add) add.disabled = true;
    if (up) up.title = "Demo mode · 演示模式下禁用此操作";
    if (add) add.title = "Demo mode · 演示模式下禁用此操作";
  }
}

async function renderQuestionFromFirestore(id){
  if (!db) return false;
  const fs = await FS(); if (!fs) return false;
  const qDoc = await fs.getDoc(fs.doc(db,"questions", id));
  if (!qDoc.exists()) return false;
  const q = qDoc.data();
  document.getElementById("question-title").textContent = `${q.titleEn} · ${fallback(q.titleZh,"")}`;
  document.getElementById("question-meta").textContent = `Category: ${q.category}`;
  document.getElementById("q-votes").textContent = String(q.upvotesCount||0);
  document.getElementById("q-upvote").onclick = async () => { await upvoteQuestion(id); };
  await renderSolutions(id);
  document.getElementById("add-solution").onclick = () => openSolutionModal(id);
  return true;
}

async function renderQuestionFromSeed(id){
  const seed = await loadSeed();
  if (!seed) return;
  setDemoMode(true);
  const q = seed.questions.find(x => x.id === id);
  if (!q) {
    document.getElementById("app").innerHTML = "<p>Question not found · 未找到该问题</p>";
    return;
  }
  document.getElementById("question-title").textContent = `${q.titleEn} · ${fallback(q.titleZh,"")}`;
  document.getElementById("question-meta").textContent = `Category: ${q.category}`;
  document.getElementById("q-votes").textContent = String(q.upvotesCount||0);

  const list = document.getElementById("solution-list");
  list.innerHTML = "";
  if (q.sampleSolution) {
    const s = q.sampleSolution;
    const row = document.createElement("div");
    row.className = "row-card";
    row.innerHTML = `
      <div class="row-head">
        <h4 class="row-title" style="margin:0;">${s.contentEn}</h4>
        <div class="kv">👍 ${s.upvotesCount||0}</div>
      </div>
      <div class="row-sub">${s.contentZh||""}</div>
    `;
    list.append(row);
  } else {
    list.append(el("div",{class:"row-sub"},["No solution yet · 暂无方案"]));
  }
}

// Solutions (Firestore only)
async function renderSolutions(questionId){
  const list = document.getElementById("solution-list");
  list.innerHTML = "";
  if (!db) { list.append(el("div",{class:"row-sub"},["No solution yet · 暂无方案"])); return; }
  const fs = await FS(); if (!fs) { list.append(el("div",{class:"row-sub"},["No solution yet · 暂无方案"])); return; }
  const sSnap = await fs.getDocs(fs.collection(fs.doc(db,"questions", questionId), "solutions"));
  const arr = [];
  sSnap.forEach(d => arr.push(d.data()));
  arr.sort((a,b) => (b.upvotesCount||0) - (a.upvotesCount||0));
  for (const s of arr) {
    const row = document.createElement("div");
    row.className = "row-card";
    row.innerHTML = `
      <div class="row-head">
        <h4 class="row-title" style="margin:0;">${s.contentEn}</h4>
        <div class="kv">👍 ${s.upvotesCount||0}</div>
      </div>
      <div class="row-sub">${s.contentZh||""}</div>
      <div class="vote-row">
        <button class="btn pill" data-upvote="${s.id}">👍 Upvote · 点赞</button>
      </div>
    `;
    row.querySelector(`[data-upvote="${s.id}"]`).onclick = async () => { await upvoteSolution(questionId, s.id); };
    list.append(row);
  }
}

async function getTopSolutionsForQuestion(questionId, n=1){
  if (!db) return [];
  const fs = await FS(); if (!fs) return [];
  const sSnap = await fs.getDocs(fs.collection(fs.doc(db,"questions", questionId), "solutions"));
  const arr = []; sSnap.forEach(d => arr.push(d.data()));
  arr.sort((a,b) => (b.upvotesCount||0) - (a.upvotesCount||0));
  return arr.slice(0,n);
}

// Ask / Solution modals (disabled in demo mode)
async function openAskModal(slug){
  if (DEMO_MODE) { alert("Demo mode: posting disabled · 演示模式下不可发帖"); return; }
  await requireAuth();
  const html = `
    <h3>Ask a Question · 发布问题</h3>
    <div class="form-row">
      <input id="titleEn" placeholder="Title (English) · 标题（英文）"/>
    </div>
    <div class="form-row">
      <input id="titleZh" placeholder="标题（中文，选填）"/>
    </div>
    <div class="form-row">
      <textarea id="detailEn" rows="3" placeholder="Detail (English) · 详情（英文）"></textarea>
    </div>
    <div class="form-row">
      <textarea id="detailZh" rows="3" placeholder="详情（中文，选填）"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn outline" id="close-modal">Close · 关闭</button>
      <button class="btn" id="submit-btn">Submit · 提交</button>
    </div>
  `;
  const { openModal, closeModal } = await import("./ui.js");
  openModal(html);
  document.getElementById("submit-btn").onclick = async () => {
    const titleEn = document.getElementById("titleEn").value.trim();
    const titleZh = document.getElementById("titleZh").value.trim();
    const detailEn = document.getElementById("detailEn").value.trim();
    const detailZh = document.getElementById("detailZh").value.trim();
    if (!titleEn) return alert("Title (English) required · 需要英文标题");
    const fs = await FS(); if (!fs) return alert("Firestore unavailable");
    const id = `${slug}-${Date.now()}`;
    await fs.setDoc(fs.doc(db, "questions", id), {
      id, category: slug, titleEn, titleZh, detailEn, detailZh,
      upvotesCount: 0, createdAt: (fs.serverTimestamp ? fs.serverTimestamp() : new Date()), createdBy: "web"
    });
    closeModal();
    location.hash = `#/category/${slug}`;
  };
}

async function openSolutionModal(questionId){
  if (DEMO_MODE) { alert("Demo mode: posting disabled · 演示模式下不可发帖"); return; }
  await requireAuth();
  const html = `
    <h3>Add a Solution · 添加解决方案</h3>
    <div class="form-row">
      <textarea id="contentEn" rows="3" placeholder="Solution (English) · 方案（英文）"></textarea>
    </div>
    <div class="form-row">
      <textarea id="contentZh" rows="3" placeholder="方案（中文，选填）"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn outline" id="close-modal">Close · 关闭</button>
      <button class="btn" id="submit-solution">Submit · 提交</button>
    </div>
  `;
  const { openModal, closeModal } = await import("./ui.js");
  openModal(html);
  document.getElementById("submit-solution").onclick = async () => {
    const contentEn = document.getElementById("contentEn").value.trim();
    const contentZh = document.getElementById("contentZh").value.trim();
    if (!contentEn) return alert("Solution (English) required · 需要英文方案");
    const fs = await FS(); if (!fs) return alert("Firestore unavailable");
    const sRefId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await fs.setDoc(fs.doc(db, `questions/${questionId}/solutions/${sRefId}`), {
      id: sRefId, contentEn, contentZh, upvotesCount: 0, createdAt: (fs.serverTimestamp ? fs.serverTimestamp() : new Date()), createdBy: "web"
    });
    document.getElementById("modal").classList.add("hidden");
    await renderSolutions(questionId);
  };
}

// Upvote logic (idempotent per user)
async function upvoteQuestion(questionId){
  if (DEMO_MODE) { alert("Demo mode: upvote disabled · 演示模式下不可点赞"); return; }
  const fs = await FS(); if (!fs) return alert("Firestore unavailable");
  const user = await requireAuth();
  const qRef = fs.doc(db, "questions", questionId);
  const voteRef = fs.doc(fs.collection(qRef, "votes"), user.uid);
  const vs = await fs.getDoc(voteRef);
  if (vs.exists()) { alert("Already upvoted · 已点过赞"); return; }
  await fs.setDoc(voteRef, { uid: user.uid, createdAt: Date.now() });
  const qSnap = await fs.getDoc(qRef);
  const curr = (qSnap.exists() ? (qSnap.data().upvotesCount || 0) : 0) + 1;
  await fs.updateDoc(qRef, { upvotesCount: curr });
  document.getElementById("q-votes").textContent = String(curr);
}

async function upvoteSolution(questionId, solutionId){
  if (DEMO_MODE) { alert("Demo mode: upvote disabled · 演示模式下不可点赞"); return; }
  const fs = await FS(); if (!fs) return alert("Firestore unavailable");
  const user = await requireAuth();
  const sRef = fs.doc(db, `questions/${questionId}/solutions/${solutionId}`);
  const voteRef = fs.doc(fs.collection(sRef, "votes"), user.uid);
  if ((await fs.getDoc(voteRef)).exists()) { alert("Already upvoted · 已点过赞"); return; }
  await fs.setDoc(voteRef, { uid: user.uid, createdAt: Date.now() });
  const sSnap = await fs.getDoc(sRef);
  const curr = (sSnap.exists() ? (sSnap.data().upvotesCount || 0) : 0) + 1;
  await fs.updateDoc(sRef, { upvotesCount: curr });
  await renderSolutions(questionId);
}

// Very simple search (client side demo: substring)
async function renderSearch(text){
  const root = document.getElementById("app");
  root.innerHTML = "";
  const sec = document.createElement("section");
  const title = document.createElement("h2");
  title.textContent = `Search · 搜索 ：${text}`;
  sec.append(title);
  const list = document.createElement("div");
  list.className = "list";
  sec.append(list);
  root.append(sec);

  let arr = [];
  try{
    if (db) {
      const fs = await FS();
      if (fs) {
        const snap = await fs.getDocs(fs.query(fs.collection(db,"questions")));
        snap.forEach(d => arr.push(d.data()));
      }
    }
  }catch(e){ /* ignore */ }
  if (arr.length === 0) {
    const seed = await loadSeed();
    if (seed) { setDemoMode(true); arr = seed.questions.slice(); }
  }
  const t = text.toLowerCase();
  const hits = arr.filter(q => (q.titleEn||"").toLowerCase().includes(t) || (q.titleZh||"").includes(text)).slice(0,80);
  if (hits.length === 0) list.append(el("div",{class:"row-sub"},["No results · 暂无结果"]));
  for (const q of hits) list.append(renderQuestionRow(q));
}
