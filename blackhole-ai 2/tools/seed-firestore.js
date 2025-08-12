// tools/seed-firestore.js
import fs from 'fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function run(){
  const raw = fs.readFileSync(new URL('../seed/seed.json', import.meta.url), 'utf-8');
  const seed = JSON.parse(raw);
  for (const c of seed.categories) {
    await db.doc(`categories/${c.slug}`).set(c, { merge: true });
    console.log('Category:', c.slug);
  }
  for (const q of seed.questions) {
    const qRef = db.doc(`questions/${q.id}`);
    await qRef.set({
      id: q.id, category: q.category, titleEn: q.titleEn, titleZh: q.titleZh,
      detailEn: q.detailEn || '', detailZh: q.detailZh || '', upvotesCount: q.upvotesCount || 0, createdBy: 'seed'
    }, { merge: true });
    if (q.sampleSolution) {
      const sRef = qRef.collection('solutions').doc();
      await sRef.set({
        id: sRef.id, contentEn: q.sampleSolution.contentEn, contentZh: q.sampleSolution.contentZh,
        upvotesCount: q.sampleSolution.upvotesCount || 0, createdBy: 'seed'
      }, { merge: true });
    }
    console.log('Question:', q.id);
  }
  console.log('Seeding complete.');
}
run().catch(e=>{ console.error(e); process.exit(1); });
