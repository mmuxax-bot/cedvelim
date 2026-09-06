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

## 🚀 Yalnız telefon (Termux) ilə APK yığmaq

Telefonda Android SDK + Gradle-i birbaşa Termux-da işlətmək çox vaxt
yaddaş/uyğunluq problemləri ilə nəticələnir (Termux-un öz kitabxana
sistemi Android SDK-nın gözlədiyi ilə tam uyğun deyil). Ona görə **ən
etibarlı yol — real yığma işini GitHub-un pulsuz serverlərinə
həvalə etməkdir**: sən yalnız kodu göndərirsən, APK-nı server yığır,
sən onu brauzerdən endirirsən. Bu ZIP-ə artıq lazımi fayl
(`.github/workflows/android.yml`) əlavə olunub.

### A yolu (tövsiyə olunur): GitHub Actions ilə serverdə yığma

1. **GitHub hesabı yarat** (pulsuzdur): telefon brauzerində
   github.com → Sign up.
2. **Boş repo yarat**: github.com/new → ad ver (məs. `cedvelim`) →
   "Create repository". Private/Public fərq etməz.
3. Termux-da:
   ```bash
   pkg update && pkg upgrade
   pkg install git openssh gh

   # ZIP-i Termux-a köçürüb aç (məs. Yükləmələr qovluğundan)
   cd ~/storage/downloads   # əgər `termux-setup-storage` işlətmisənsə
   unzip cedvel-app.zip
   cd cedvel-app
   git init
   git add .
   git commit -m "İlk versiya"
   ```
4. **GitHub ilə qoşul** (ən asan yol — `gh` aləti ilə):
   ```bash
   gh auth login
   # sual-cavabları izlə: GitHub.com → HTTPS → brauzerdə kodu təsdiqlə

   gh repo create cedvelim --source=. --public --push
   # (private istəsən --public əvəzinə --private yaz)
   ```
5. Brauzerdə repo səhifənə keç → **Actions** tabı → "Android APK yığ"
   iş axını avtomatik başlayacaq (əgər başlamasa, "Run workflow"
   düyməsinə bas). 5–10 dəqiqə gözlə.
6. Tamamlananda həmin işin (workflow run) səhifəsində aşağıda
   **Artifacts** bölməsində `cedvelim-debug-apk` görünəcək — üstünə
   bas, ZIP endiriləcək, içində `app-debug.apk` var.
7. Telefonda APK-nı aç → quraşdırmağa icazə ver (ilk dəfə "Naməlum
   mənbələrdən quraşdırma" sualı çıxacaq, təsdiqlə) → tətbiq quraşdırılır.

Kodda hər dəyişiklik etdikdən sonra sadəcə:
```bash
git add . && git commit -m "dəyişiklik" && git push
```
— hər push yeni APK yığacaq.

### B yolu (ehtiyat variant): tam yerli Termux + Ubuntu (proot-distro)

Bu yol daha ağır və yavaşdır, yalnız internetin yoxdursa və ya
GitHub-a etibar etmək istəmirsənsə seç:
```bash
pkg install proot-distro
proot-distro install ubuntu
proot-distro login ubuntu
# Ubuntu daxilində:
apt update && apt install -y openjdk-17-jdk unzip wget nodejs npm
# Android SDK command-line tools-u əl ilə endir və qur (developer.android.com/studio#command-tools)
# sonra layihə qovluğunda: npm install && npx cap add android && npx cap sync android
# cd android && ./gradlew assembleDebug
```
Bu yolda Android SDK-nı əl ilə (`sdkmanager` ilə) quraşdırmaq və
`local.properties`-də SDK yolunu göstərmək lazımdır — addımlar uzun
və cihazdan asılı olaraq dəyişə bilər, ona görə A yolunu tövsiyə edirəm.

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
