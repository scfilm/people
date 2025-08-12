# Event Horizon · 黑洞AI人类终极问题社群 (GitHub Pages + Firebase)

A clean, Apple-inspired, Zhihu-style community to tackle 100+ core human questions.
Bilingual UI (EN/中文). Google Sign-In. Firestore for data. GitHub Pages for static hosting.

> Subtitle / 副标题：**Language isn’t the barrier—thought is! · 语言不是障碍，思想才是！——Dr.Kurt**

## Quick Start (GitHub Pages)
1) Create a Firebase project (enable Firestore + Authentication).
2) Enable Google Sign-In. Create a Web App and copy `firebaseConfig`.
3) Paste config into `auth.js`.
4) Push this folder to a GitHub repo’s `main` branch. Pages → GitHub Actions (workflow included).
5) Open the site → Sign in → Avatar → **Admin / 管理** → **Seed demo data / 导入示例数据**.

## Demo Mode
If Firestore has no data or Firebase isn’t configured, the app **auto-falls back** to local `seed/seed.json` and shows a banner.
Posting / voting are disabled in demo mode.

## Firestore Rules (starter)
See `firestore.rules`. Harden before production.
