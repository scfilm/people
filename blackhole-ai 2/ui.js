// ui.js (no static CDN imports)
import { db } from "./auth.js";

export function openModal(html){
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
  modal.innerHTML = `<div class="modal-card">${html}</div>`;
  modal.querySelector("#close-modal")?.addEventListener("click", () => modal.classList.add("hidden"));
}

export function closeModal(){
  document.getElementById("modal").classList.add("hidden");
}

async function loadFS(){
  try{
    return await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  }catch(e){
    return null;
  }
}

export async function seedDemo(){
  if (!db) {
    alert("Firebase unavailable: cannot write to Firestore · 无法连接 Firestore，不能导入数据。");
    return;
  }
  const fs = await loadFS();
  if (!fs) {
    alert("Failed to load Firestore SDK · Firestore SDK 加载失败");
    return;
  }

  // fetch local seed data and write to Firestore
  const resp = await fetch("./seed/seed.json", { cache: "no-store" });
  const seed = await resp.json();

  for (const c of seed.categories) {
    await fs.setDoc(fs.doc(db, "categories", c.slug), c, { merge: true });
  }

  for (const q of seed.questions) {
    const qRef = fs.doc(db, "questions", q.id);
    await fs.setDoc(qRef, {
      id: q.id,
      category: q.category,
      titleEn: q.titleEn,
      titleZh: q.titleZh,
      detailEn: q.detailEn || "",
      detailZh: q.detailZh || "",
      upvotesCount: q.upvotesCount || 0,
      createdBy: "seed",
      createdAt: fs.serverTimestamp()
    }, { merge: true });
    if (q.sampleSolution) {
      const sRef = fs.doc(db, `questions/${q.id}/solutions/${Date.now()}-${Math.random().toString(16).slice(2)}`);
      await fs.setDoc(sRef, {
        id: sRef.id.split("/").pop(),
        contentEn: q.sampleSolution.contentEn,
        contentZh: q.sampleSolution.contentZh,
        upvotesCount: q.sampleSolution.upvotesCount || 0,
        createdBy: "seed",
        createdAt: fs.serverTimestamp()
      }, { merge: true });
    }
  }

  alert("Seed data imported. 刷新页面查看示例数据。");
}
