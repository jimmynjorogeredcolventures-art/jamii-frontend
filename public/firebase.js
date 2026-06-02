console.log("🔥 Firebase Loading...");

/* =====================================================
   FIREBASE CONFIG
===================================================== */

const firebaseConfig = {

  apiKey: "AIzaSyDCnkb5_NATM0WFGMoadE3GLCqDqP-eBqM",

  authDomain: "jamii-313d7.firebaseapp.com",

  projectId: "jamii-313d7",

  storageBucket: "jamii-313d7.firebasestorage.app",

  messagingSenderId: "544989290635",

  appId: "1:544989290635:web:4cbd37480f7bf7dceef48e"

};

/* =====================================================
   SAFE FIREBASE INIT
===================================================== */

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

window.db = firebase.firestore();

console.log("✅ Firebase READY");

/* =====================================================
   CONFIG
===================================================== */

window.CONFIG = {

  AMOUNT_TO_PAY: 1799,

  SUBSCRIPTION_DAYS: 35,

  SUBSCRIPTION_MS:
    35 * 24 * 60 * 60 * 1000,

  JAMII_COUPON_EXPIRY:
    new Date("2026-05-31T23:59:59").getTime()

};

/* =====================================================
   GLOBALS
===================================================== 

window.currentSeller = null;

const AMOUNT_TO_PAY = 1799;

const SUBSCRIPTION_DAYS = 35;

const SUBSCRIPTION_MS =
  SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;

const JAMII_COUPON_EXPIRY =
  new Date("2026-05-31T23:59:59").getTime();

/* =====================================================
   HELPERS
===================================================== */

function val(id) {

  const el = document.getElementById(id);

  return el ? el.value.trim() : "";

}

function setHTML(id, value) {

  const el = document.getElementById(id);

  if (el) {
    el.innerHTML = value;
  }

}

function show(id) {

  const el = document.getElementById(id);

  if (el) {
    el.style.display = "block";
  }

}

function hide(id) {

  const el = document.getElementById(id);

  if (el) {
    el.style.display = "none";
  }

}

function clear(ids) {

  ids.forEach(id => {

    const el = document.getElementById(id);

    if (el) {
      el.value = "";
    }

  });

}

function formatPhone(phone) {

  phone = phone.replace(/\s+/g, "");

  if (phone.startsWith("07")) {
    return "254" + phone.substring(1);
  }

  if (phone.startsWith("+254")) {
    return phone.replace("+", "");
  }

  return phone;

}

console.log("🔥 Jamii Ultra Engine Loaded");