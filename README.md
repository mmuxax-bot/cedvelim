# Cədvəlim — Dərs Cədvəli Tətbiqi

Bu ZIP-də tam işlək bir **veb tətbiq** (HTML/CSS/JS) və onu **Capacitor**
vasitəsilə Android APK-ya çevirmək üçün lazım olan konfiqurasiya var.

## ⚠️ Vacib — mənim tərəfimdən nə hazırlanıb, nə yox

Mən bu mühitdə **internetə çıxışım olmadığı** üçün (`npm install`,
`gradle build`, Android SDK yükləmə mümkün deyil) sənin əvəzinə hazır
**.apk faylını** yığa bilmirəm. Bunun əvəzinə:

✅ Hazırdır:
- Tətbiqin bütün funksional kodu (aşağıdakı bütün siyahı) — tam işlək,
  brauzerdə birbaşa açıb sına bilərsən (`www/index.html`).
- Capacitor konfiqurasiyası (`capacitor.config.json`, `package.json`).
- Google Play Billing üçün **inteqrasiya nöqtəsi** (`www/js/billing.js`)
  — amma real ödəniş yalnız aşağıdakı addımları özün (və ya mənimlə
  addım-addım Termux-da) etdikdən sonra işləyəcək.

❌ Mənim yarada bilmədiyim (bunlar həmişə insan tərəfindən, öz Google
hesabınla edilməli olan addımlardır):
- Google Play Console-da tətbiq qeydiyyatı və imzalanmış APK/AAB yükləmə.
- Real Premium məhsul ID-lərinin yaradılması.
- Alışları təsdiqləyən server (purchaseToken yoxlaması) — bunsuz
  "Premium" düyməsini hər kəs APK-nı dəyişərək saxta aktivləşdirə bilər,
  ona görə bunu qəsdən "test rejimi" kimi buraxmışam.

## 📁 Struktur

```
cedvel-app/
├── package.json
├── capacitor.config.json
├── README.md
└── www/                  ← bütün tətbiq kodu burada
    ├── index.html
    ├── manifest.json
    ├── css/style.css
    ├── js/store.js        (məlumat, localStorage, JSON/CSV)
    ├── js/billing.js       (Premium/Google Play inteqrasiyası)
    ├── js/app.js           (UI məntiqi)
    └── icons/icon.svg
```

## ✅ Daxil olan funksiyalar

- Həftəlik / günlük görünüş, gün tabları
- Dərs əlavə et / redaktə et / sil
- Başlanğıc–bitmə saatı, müəllim, otaq, rəngli kateqoriya, qeydlər
- Axtarış (fənn, müəllim, otaq, qeyd üzrə)
- Dark mode
- Avtomatik yadda saxlama (hər dəyişiklik `localStorage`-a yazılır)
- JSON ehtiyat nüsxə / bərpa (fayl kimi endirilir)
- CSV ixrac (Excel-də açıla bilər)
- Bir neçə cədvəl (pulsuz versiyada 2 ədəd, Premium-da sonsuz)
- Dərs xatırlatmaları (Capacitor `local-notifications` pluginı ilə,
  yalnız APK daxilində işləyir — brauzer önizləməsində yox)
- Tam offline işləmə (internet tələb etmir, xarici CDN-dən heç nə
  yüklənmir)
- Premium/Google Play Billing üçün hazır struktur (yuxarıya bax)

## 🚀 Termux-da APK-ya çevirmə addımları

Termux-da bunları ardıcıl icra et (internet və bir neçə GB yaddaş
lazımdır — Android SDK ağırdır):

```bash
pkg update && pkg upgrade
pkg install nodejs-lts openjdk-17 git

# ZIP-i açdığın qovluğa keç
cd cedvel-app
npm install

# Android platformasını əlavə et
npx cap add android
npx cap sync android

# Android SDK/Gradle Termux-da tam qurulmalıdır (bax: termux-android-sdk
# layihələri, məs. "termux-adb", "gradle" paketi) — ya da daha rahatı:
# `android/` qovluğunu kompüterdəki Android Studio-ya köçür və
# oradan "Build > Build APK" et.

cd android
./gradlew assembleDebug
# Nəticə: android/app/build/outputs/apk/debug/app-debug.apk
```

**Tövsiyə:** Termux-da Android Gradle build-i tez-tez yaddaş/SDK
problemləri ilə qarşılaşır. Ən sürətli və etibarlı yol — bu ZIP-i
kompüterə (Windows/Mac/Linux) köçürüb, pulsuz **Android Studio**
qurub, `npx cap open android` ilə açıb "Build APK" düyməsinə basmaqdır.

## 💳 Real Google Play Premium üçün növbəti addımlar

1. `npm install cordova-plugin-purchase && npx cap sync android`
2. Google Play Console-da tətbiqi yarat, imzala, ən azı "Daxili sınaq"
   trekinə yüklə.
3. Play Console → Monetizasiya → Abunəliklər bölməsində
   `cedvelim_premium_yearly` (və ya öz seçdiyin) ID ilə məhsul yarat.
4. `www/js/billing.js` içindəki `PRODUCT_ID`-i həmin ID ilə uyğunlaşdır.
5. Kiçik bir backend (Cloud Functions, Vercel və s.) yaz ki,
   `purchaseToken`-i Google Play Developer API ilə yoxlasın — yalnız
   bundan sonra `verifyOnServer()` funksiyasını real cavabla doldur.

Bu addımlar Google hesabı və (adətən) developer haqqı ($25, birdəfəlik)
tələb edir — mən bunları sənin adından edə bilmərəm.

## 🔎 İndi necə sınaya bilərsən

ZIP-i açıb `www/index.html` faylını istənilən telefon/kompüter
brauzerində aç — bütün funksiyalar (Premium alışı istisna olmaqla, o da
"test rejimi"ndə simulyasiya olunur) dərhal işləyəcək.
