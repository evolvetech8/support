# Archonic — Official iOS App & Game Support Portal

A universal, Apple App Store–compliant static website for **Archonic** (`archonic88@gmail.com`). Designed for all iOS and iPadOS utility apps, lifestyle apps, and mobile games published by Archonic.

---

## 📁 Included Pages

| File | App Store Connect Field | Purpose |
| :--- | :--- | :--- |
| [`index.html`](./index.html) | **Support URL** *(Required)* | Interactive Support Center, Quick Self-Service Troubleshooting, Searchable FAQ, and Support/Data Deletion Ticket Generator. |
| [`privacy.html`](./privacy.html) | **Privacy Policy URL** *(Required)* | Universal iOS & Game Privacy Policy covering local-first sandbox data, optional iOS permissions, StoreKit billing, Game Center, ATT, and Data Deletion (Guideline 5.1.1(v)). |
| [`terms.html`](./terms.html) | **Terms of Use (EULA) URL** | End-User License Agreement with Apple Schedule 2 auto-renewing subscription disclosures (Guideline 3.1.2) and virtual goods terms. |
| [`styles.css`](./styles.css) | — | Modern Apple-inspired Studio UI with Light & Dark mode variables and mobile-first responsive layout. |
| [`app.js`](./app.js) | — | Bilingual (`EN` / `VI`) engine, Light/Dark theme switcher, FAQ search/filter, and support ticket generator. |

---

## 🔗 Live Production URLs for App Store Connect

Your support portal is live on **`archonic-landing`** (Vercel) and **GitHub Pages** (`evolvetech8/support`). Copy and paste these URLs directly into **App Store Connect**:

### Primary Vercel URLs (`archonic-studio`)
- **Support URL**: `https://archonic-studio.vercel.app`
- **Privacy Policy URL**: `https://archonic-studio.vercel.app/privacy.html` *(or `https://archonic-studio.vercel.app/privacy`)*
- **Terms of Use (EULA) URL**: `https://archonic-studio.vercel.app/terms.html` *(or `https://archonic-studio.vercel.app/terms`)*

### Backup GitHub Pages URLs (`evolvetech8/support`)
- **Support URL**: `https://evolvetech8.github.io/support/`
- **Privacy Policy URL**: `https://evolvetech8.github.io/support/privacy.html`
- **Terms of Use (EULA) URL**: `https://evolvetech8.github.io/support/terms.html`

> **Tip — Deep-linking Language from Your iOS App:**
> By default, the portal opens in **English** (`?lang=en`) for Apple App Store Reviewers. If your iOS app is set to Vietnamese, you can open `?lang=vi` (e.g., `https://archonic-studio.vercel.app/?lang=vi`) to automatically display Vietnamese.

---

## 🚀 Deploy in 1 Minute (Free Static Hosting)

### Option A: GitHub Pages
1. Create a public GitHub repository (e.g., `archonic-support`).
2. Push the files in this folder (`index.html`, `privacy.html`, `terms.html`, `styles.css`, `app.js`, `README.md`) to the `main` branch.
3. In your GitHub repo, go to **Settings → Pages → Build and deployment**, select **Deploy from a branch (`main` / `/root`)**, and click **Save**.

### Option B: Netlify Drop / Vercel
- **Netlify Drop**: Drag and drop this entire `Support` folder onto [app.netlify.com/drop](https://app.netlify.com/drop) for an instant `https://` URL.
- **Vercel CLI**: Run `npx vercel --prod` inside this directory.
