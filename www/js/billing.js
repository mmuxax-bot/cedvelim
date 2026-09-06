/* billing.js
 * ------------------------------------------------------------------
 * VACIB (oxu!):
 * Google Play-dən HƏQİQİ ödəniş almaq üçün bu fayl TƏK BAŞINA kifayət
 * etmir. Lazım olanlar:
 *   1) Google Play Console-da qeydiyyatdan keçmiş, imzalanmış tətbiq
 *      (aşağıdakı android/ qovluğundan APK/AAB yığılıb Play Console-a
 *      yüklənməlidir — bu, İNTERNET tələb edən və Google hesabı ilə
 *      edilən bir addımdır, mən bunu sənin əvəzinə edə bilmərəm).
 *   2) Play Console-da "Abunəliklər / Məhsullar" bölməsində yaradılmış
 *      real məhsul ID-ləri (aşağıda PRODUCT_ID sahəsinə yazılmalıdır).
 *   3) Bir native plugin: tövsiyə — "cordova-plugin-purchase" (v13+),
 *      Capacitor 6 ilə uyğun işləyir:
 *        npm install cordova-plugin-purchase
 *        npx cap sync android
 *   4) Alışın SAXTA olmadığını yoxlamaq üçün öz backend-in (kiçik bir
 *      server, məs. Cloud Functions) Google Play Developer API ilə
 *      purchaseToken-i təsdiqləməlidir. Bunu tək tərəfli, yalnız
 *      telefon daxilində, tam etibarlı şəkildə etmək mümkün deyil —
 *      əks halda hər kəs APK-nı dəyişib "premium=true" yaza bilər.
 *
 * Aşağıdakı kod bu inteqrasiya üçün TƏMİZ bir interfeys verir və
 * plugin qoşulana qədər lokal "test rejimi" ilə işləyir ki, tətbiqin
 * qalan hissəsini rahat inkişaf etdirə biləsən.
 * ------------------------------------------------------------------
 */

const Billing = {
  PRODUCT_ID: "cedvelim_premium_yearly", // Play Console-dakı real ID ilə əvəz et

  ready: false,
  store: null,

  async init() {
    // Native "cordova-plugin-purchase" quraşdırılıbsa, `window.CdvPurchase` mövcud olur.
    if (window.CdvPurchase) {
      this.store = window.CdvPurchase.store;
      const { ProductType, Platform } = window.CdvPurchase;

      this.store.register({
        id: this.PRODUCT_ID,
        type: ProductType.PAID_SUBSCRIPTION,
        platform: Platform.GOOGLE_PLAY
      });

      this.store.when().approved(async (transaction) => {
        // TODO: purchaseToken-i öz serverinə göndər və Google Play
        // Developer API ilə təsdiqlət, YALNIZ ondan sonra `finish()` çağır
        // və Premium-u aktiv et. Server olmadan bura etibar etmə.
        const verified = await this.verifyOnServer(transaction);
        if (verified) {
          Store.setPremium(true);
          transaction.finish();
        }
      });

      this.store.when().productUpdated(() => {});
      await this.store.initialize([Platform.GOOGLE_PLAY]);
      this.ready = true;
    } else {
      console.info("[billing] Native ödəniş plugini tapılmadı — test rejimi aktivdir.");
      this.ready = false;
    }
  },

  async verifyOnServer(transaction) {
    // Nümunə (öz backend URL-ini əlavə et):
    // const res = await fetch("https://sənin-serverin/verify-purchase", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     purchaseToken: transaction.transactionId,
    //     productId: this.PRODUCT_ID
    //   })
    // });
    // const data = await res.json();
    // return data.valid === true;
    console.warn("[billing] verifyOnServer stub-dur — real serverlə əvəz et.");
    return false;
  },

  async buy() {
    if (this.store) {
      const offer = this.store.get(this.PRODUCT_ID)?.getOffer();
      if (offer) return offer.order();
      throw new Error("Məhsul Play Console-da tapılmadı.");
    }
    // Test rejimi: yalnız cihazda, real ödəniş YOXDUR.
    const ok = confirm(
      "Test rejimi: real Google Play ödənişi qoşulmayıb.\n" +
      "Premium-u bu cihazda sınaq üçün aktiv etmək istəyirsən?"
    );
    if (ok) Store.setPremium(true);
    return ok;
  },

  async restore() {
    if (this.store) {
      return this.store.restorePurchases();
    }
    alert("Test rejimində bərpa ediləcək əvvəlki alış yoxdur.");
  }
};
