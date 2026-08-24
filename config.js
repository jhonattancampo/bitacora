/* =========================================================
   config.js — Claves de tu proyecto Firebase
   ---------------------------------------------------------
   Pegá acá el objeto que te da Firebase en:
   Consola → ⚙ Configuración del proyecto → Tus apps → Web
   Mientras esté vacío, la app funciona igual pero sin cuenta
   ni sincronización: los datos quedan solo en el dispositivo.

   Estas claves NO son secretas: identifican al proyecto.
   Lo que protege tus datos son las reglas de Firestore
   (archivo firestore.rules) + el login.
   ========================================================= */
window.FIREBASE_CONFIG = {
  apiKey: "PEGA_TU_API_KEY",
  authDomain: "PEGA_TU_PROYECTO.firebaseapp.com",
  projectId: "PEGA_TU_PROYECTO",
  storageBucket: "PEGA_TU_PROYECTO.firebasestorage.app",
  messagingSenderId: "PEGA_TU_SENDER_ID",
  appId: "PEGA_TU_APP_ID",

  // Versión del SDK de Firebase que se carga desde el CDN de Google
  sdkVersion: "12.17.1"
};
