# Morgen Geschäft — Project Tree

Dokumen ini dibuat otomatis untuk membantu memantau perubahan struktur project.

- Terakhir diperbarui: `2026-08-29T11:51:16.072Z`
- Jumlah file yang dipantau: **342**
- Jumlah folder yang ditampilkan: **56**
- Folder runtime, dependency, build, backup, log, upload, cache, serta file rahasia `.env` tidak ditampilkan.
- Folder `frontend/photos` diringkas pada tree, tetapi seluruh file gambarnya tetap dipantau oleh snapshot.

## Struktur project

```text
Morgen Geschaft Project/
├── .github/
│   ├── workflows/
│   │   └── ci.yml
│   └── dependabot.yml
├── assets/
│   └── logo.webp
├── backend/
│   ├── config/
│   │   └── ecosystem.config.cjs
│   ├── scripts/
│   │   ├── admin-claims.js
│   │   ├── admin-mfa.js
│   │   ├── biteship-setup.js
│   │   ├── firestore-backup-json.js
│   │   └── firestore-restore-emulator.mjs
│   ├── src/
│   │   ├── config/
│   │   │   ├── contentSecurityPolicy.js
│   │   │   └── firebaseAdmin.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── rateLimiter.js
│   │   │   └── sslRedirect.js
│   │   ├── routes/
│   │   │   ├── admin.js
│   │   │   ├── analytics.js
│   │   │   ├── biteshipWebhook.js
│   │   │   ├── chat.js
│   │   │   ├── checkout.js
│   │   │   ├── customerAccount.js
│   │   │   ├── customerAuth.js
│   │   │   ├── featureFlags.js
│   │   │   ├── flashSales.js
│   │   │   ├── health.js
│   │   │   ├── orders.js
│   │   │   ├── products.js
│   │   │   ├── promotions.js
│   │   │   ├── publicContent.js
│   │   │   ├── returns.js
│   │   │   ├── seo.js
│   │   │   └── shipping.js
│   │   ├── services/
│   │   │   ├── email/
│   │   │   │   ├── invoiceEmail.js
│   │   │   │   └── invoicePdf.js
│   │   │   ├── abandonedCart.js
│   │   │   ├── biteshipWebhook.js
│   │   │   ├── biteshipWebhookUtils.js
│   │   │   ├── email.js
│   │   │   ├── featureFlags.js
│   │   │   ├── flashSales.js
│   │   │   ├── funnelAnalytics.js
│   │   │   ├── gesaKnowledge.js
│   │   │   ├── gesaPrompt.js
│   │   │   ├── imageCdn.js
│   │   │   ├── logger.js
│   │   │   ├── loyalty.js
│   │   │   ├── midtrans.js
│   │   │   ├── notifications.js
│   │   │   ├── orders.js
│   │   │   ├── photoModeration.js
│   │   │   ├── pricing.js
│   │   │   ├── redis.js
│   │   │   ├── returnRequests.js
│   │   │   ├── sentry.js
│   │   │   ├── shipping.js
│   │   │   ├── shippingQuote.js
│   │   │   ├── stockAlert.js
│   │   │   └── whatsapp.js
│   │   ├── utils/
│   │   │   ├── customerSecurity.js
│   │   │   ├── imageType.js
│   │   │   ├── index.js
│   │   │   ├── security.js
│   │   │   └── webhookIp.js
│   │   └── server.js
│   ├── tests/
│   │   ├── checkout.test.js
│   │   ├── cloudinary.test.js
│   │   ├── contentSecurityPolicy.test.js
│   │   ├── customer-security.test.js
│   │   ├── flashSales.test.js
│   │   ├── publicContent.test.js
│   │   ├── regression.test.js
│   │   ├── returns.test.js
│   │   ├── security-logic.test.js
│   │   ├── security.test.js
│   │   ├── shipping.test.js
│   │   ├── smtp.test.js
│   │   └── unit.test.js
│   ├── .env.example
│   ├── .gitignore
│   ├── app.js
│   ├── package-lock.json
│   └── package.json
├── docs/
│   ├── frontend/
│   ├── infrastructure/
│   └── README.md
├── firebase/
│   ├── firestore.indexes.json
│   └── firestore.rules
├── frontend/
│   ├── config/
│   │   ├── postcss.config.js
│   │   ├── tailwind.config.js
│   │   └── vite.config.js
│   ├── e2e/
│   │   └── checkout.spec.js
│   ├── photos/ (25 files)
│   ├── public/
│   │   ├── hero/
│   │   │   ├── product-6-640.webp
│   │   │   ├── product-6-960.webp
│   │   │   ├── product-55-640.webp
│   │   │   ├── product-55-960.webp
│   │   │   ├── product-80-640.webp
│   │   │   └── product-80-960.webp
│   │   ├── icons/
│   │   │   ├── icon-192.png
│   │   │   └── icon-512.png
│   │   ├── marketplace-icons/
│   │   │   └── shopee.webp
│   │   ├── photos/
│   │   │   └── thumbs/
│   │   │       ├── product-1-320.webp
│   │   │       ├── product-1-640.webp
│   │   │       ├── product-1-960.webp
│   │   │       ├── product-3-320.webp
│   │   │       ├── product-3-640.webp
│   │   │       ├── product-3-960.webp
│   │   │       ├── product-6-320.webp
│   │   │       ├── product-6-640.webp
│   │   │       ├── product-6-960.webp
│   │   │       ├── product-12-320.webp
│   │   │       ├── product-12-640.webp
│   │   │       ├── product-12-960.webp
│   │   │       ├── product-15-320.webp
│   │   │       ├── product-15-640.webp
│   │   │       ├── product-15-960.webp
│   │   │       ├── product-17-320.webp
│   │   │       ├── product-17-640.webp
│   │   │       ├── product-17-960.webp
│   │   │       ├── product-26-320.webp
│   │   │       ├── product-26-640.webp
│   │   │       ├── product-26-960.webp
│   │   │       ├── product-36-320.webp
│   │   │       ├── product-36-640.webp
│   │   │       ├── product-36-960.webp
│   │   │       ├── product-42-320.webp
│   │   │       ├── product-42-640.webp
│   │   │       ├── product-42-960.webp
│   │   │       ├── product-43-320.webp
│   │   │       ├── product-43-640.webp
│   │   │       ├── product-43-960.webp
│   │   │       ├── product-55-320.webp
│   │   │       ├── product-55-640.webp
│   │   │       ├── product-55-960.webp
│   │   │       ├── product-60-320.webp
│   │   │       ├── product-60-640.webp
│   │   │       ├── product-60-960.webp
│   │   │       ├── product-68-320.webp
│   │   │       ├── product-68-640.webp
│   │   │       ├── product-68-960.webp
│   │   │       ├── product-71-320.webp
│   │   │       ├── product-71-640.webp
│   │   │       ├── product-71-960.webp
│   │   │       ├── product-75-320.webp
│   │   │       ├── product-75-640.webp
│   │   │       ├── product-75-960.webp
│   │   │       ├── product-79-320.webp
│   │   │       ├── product-79-640.webp
│   │   │       ├── product-79-960.webp
│   │   │       ├── product-80-320.webp
│   │   │       ├── product-80-640.webp
│   │   │       ├── product-80-960.webp
│   │   │       ├── product-83-320.webp
│   │   │       ├── product-83-640.webp
│   │   │       ├── product-83-960.webp
│   │   │       ├── product-85-320.webp
│   │   │       ├── product-85-640.webp
│   │   │       └── product-85-960.webp
│   │   ├── android-chrome-192x192.png
│   │   ├── android-chrome-512x512.png
│   │   ├── apple-touch-icon.png
│   │   ├── favicon-16x16.png
│   │   ├── favicon-32x32.png
│   │   ├── manifest.json
│   │   ├── maskot-88.webp
│   │   ├── maskot-full-144.webp
│   │   ├── maskot-full.png
│   │   ├── maskot.png
│   │   ├── robots.txt
│   │   └── service-worker.js
│   ├── scripts/
│   │   ├── convert-webp.js
│   │   └── generate-favicons.js
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── DesktopNav.jsx
│   │   │   │   ├── MobileDrawer.jsx
│   │   │   │   ├── NotificationPanel.jsx
│   │   │   │   ├── StandaloneStoreFooter.jsx
│   │   │   │   ├── StoreFooter.jsx
│   │   │   │   └── StoreHeader.jsx
│   │   │   └── shared/
│   │   │       ├── ErrorBoundaries.jsx
│   │   │       ├── LanguageSwitcher.jsx
│   │   │       ├── Media.jsx
│   │   │       ├── PrivacyNotice.jsx
│   │   │       ├── Skeletons.jsx
│   │   │       └── Transitions.jsx
│   │   ├── config/
│   │   │   ├── constants.js
│   │   │   └── seedData.js
│   │   ├── features/
│   │   │   ├── admin/
│   │   │   │   ├── AdminBlogTab.jsx
│   │   │   │   ├── AdminDashboardTab.jsx
│   │   │   │   ├── AdminFlashSalesTab.jsx
│   │   │   │   ├── AdminOrdersTab.jsx
│   │   │   │   ├── AdminPanel.jsx
│   │   │   │   ├── AdminPushTab.jsx
│   │   │   │   ├── AdminReturnsTab.jsx
│   │   │   │   ├── AdminReviewsTab.jsx
│   │   │   │   ├── adminShared.jsx
│   │   │   │   ├── adminShared.test.jsx
│   │   │   │   ├── AdminShippingTab.jsx
│   │   │   │   ├── AdminStockNotifyTab.jsx
│   │   │   │   └── adminUtils.js
│   │   │   ├── auth/
│   │   │   │   ├── CustomerAccountModal.jsx
│   │   │   │   └── LoginModal.jsx
│   │   │   ├── blog/
│   │   │   │   ├── Blog.jsx
│   │   │   │   └── BlogEditorialCard.jsx
│   │   │   ├── cart/
│   │   │   │   └── Cart.jsx
│   │   │   ├── catalog/
│   │   │   │   └── Catalog.jsx
│   │   │   ├── checkout/
│   │   │   │   └── CheckoutModal.jsx
│   │   │   ├── flashSale/
│   │   │   │   ├── FlashSale.css
│   │   │   │   ├── FlashSaleBanner.jsx
│   │   │   │   ├── FlashSaleBanner.test.jsx
│   │   │   │   ├── flashSaleUtils.js
│   │   │   │   └── flashSaleUtils.test.js
│   │   │   ├── home/
│   │   │   │   ├── HeroSection.restore.test.jsx
│   │   │   │   ├── HomeContent.jsx
│   │   │   │   └── HomeSections.jsx
│   │   │   ├── orders/
│   │   │   │   ├── ReturnRequestPanel.jsx
│   │   │   │   ├── ReturnRequestPanel.test.jsx
│   │   │   │   ├── returnUtils.js
│   │   │   │   ├── returnUtils.test.js
│   │   │   │   └── TrackOrderSection.jsx
│   │   │   ├── reviews/
│   │   │   │   └── Reviews.jsx
│   │   │   └── skinQuiz/
│   │   │       ├── SkinQuizBanner.jsx
│   │   │       ├── skinQuizData.js
│   │   │       ├── skinQuizEngine.js
│   │   │       ├── skinQuizEngine.test.js
│   │   │       ├── SkinQuizPage.css
│   │   │       ├── SkinQuizPage.jsx
│   │   │       └── SkinQuizPage.test.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useCart.js
│   │   │   ├── useFeatureFlags.js
│   │   │   ├── useFirestoreData.js
│   │   │   ├── useFlashSale.js
│   │   │   ├── useLocalStorage.js
│   │   │   ├── useModalAccessibility.js
│   │   │   ├── useNotifications.js
│   │   │   ├── usePageMeta.js
│   │   │   ├── usePageRouteTransition.js
│   │   │   ├── usePaymentCountdown.js
│   │   │   ├── useStorefrontEffects.js
│   │   │   └── useStorefrontNavigation.js
│   │   ├── i18n/
│   │   │   ├── locale.js
│   │   │   ├── locale.test.js
│   │   │   └── LocaleContext.jsx
│   │   ├── pages/
│   │   │   └── StaticPages.jsx
│   │   ├── services/
│   │   │   ├── analytics.js
│   │   │   ├── analytics.test.js
│   │   │   ├── apiClient.js
│   │   │   ├── customerAuth.js
│   │   │   ├── errorMonitoring.js
│   │   │   ├── firebase.js
│   │   │   ├── firebaseAuth.js
│   │   │   ├── firebaseAuth.test.js
│   │   │   ├── firebaseCore.js
│   │   │   ├── heroExperiment.js
│   │   │   ├── heroExperiment.test.js
│   │   │   ├── publicContent.js
│   │   │   ├── publicContent.test.js
│   │   │   └── pushNotifications.js
│   │   ├── styles/
│   │   │   ├── animations.js
│   │   │   └── appStyles.js
│   │   ├── utils/
│   │   │   ├── blog.jsx
│   │   │   ├── general.js
│   │   │   ├── general.test.js
│   │   │   ├── loyalty.js
│   │   │   ├── loyalty.test.js
│   │   │   ├── midtrans.js
│   │   │   ├── navigation.js
│   │   │   ├── notificationInbox.js
│   │   │   ├── notificationInbox.test.js
│   │   │   ├── paymentStorage.js
│   │   │   ├── paymentStorage.test.js
│   │   │   ├── referral.js
│   │   │   └── referral.test.js
│   │   ├── App.jsx
│   │   ├── GesaChat.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── playwright.config.js
│   └── vitest.config.js
├── infra/
│   ├── nginx/
│   └── scripts/
│       ├── firestore-backup.ps1
│       ├── firestore-backup.sh
│       ├── local-health-check.ps1
│       ├── pm2-resurrect.cmd
│       ├── register-external-backup-task.ps1
│       ├── register-firestore-backup-task.ps1
│       ├── register-local-health-monitor-task.ps1
│       ├── run-firestore-backup-hidden.vbs
│       ├── run-firestore-backup.ps1
│       ├── run-health-monitor-hidden.vbs
│       └── sync-backup-to-external.ps1
├── scripts/
│   ├── audit-sensitive-files.mjs
│   ├── cleanup-project-structure.mjs
│   ├── create-public-update.ps1
│   ├── generate-project-tree.mjs
│   ├── prepare-rumahweb-deploy.mjs
│   ├── remove-cloudinary-config.ps1
│   ├── remove-sensitive-backups.mjs
│   ├── reset-local-dev.ps1
│   ├── reset-local-frontend.ps1
│   ├── restart-pm2-backend.ps1
│   ├── scan-production-log.mjs
│   ├── synthetic-storefront.mjs
│   ├── verify-local-api.mjs
│   ├── verify-production.mjs
│   └── verify-public-content-routes.mjs
├── .firebaserc
├── .gitattributes
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── .project-tree.json
├── eslint.config.mjs
├── firebase.json
├── LICENSE
├── package-lock.json
├── package.json
├── PROJECT_TREE.md
└── README.md
```

## Memperbarui tree

Jalankan dari folder utama project:

```powershell
npm run tree
```

## Mengecek perubahan

```powershell
npm run tree:check
```

Tanda hasil pengecekan:

- `+` file baru
- `-` file dihapus
- `~` isi file berubah

> Folder foto tetap berada di `frontend/photos` karena jalur tersebut masih digunakan oleh aplikasi dan proses build.
