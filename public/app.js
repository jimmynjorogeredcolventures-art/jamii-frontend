console.log("🔥 Jamii Ultra Engine Loaded");





firebase.initializeApp(firebaseConfig);

window.db = firebase.firestore();

console.log("🔥 Firebase READY");


/* =====================================================
   HELPERS
===================================================== */

function el(id) {
  return document.getElementById(id);
}

function val(id) {

  const e = el(id);

  return e ? e.value.trim() : "";

}

function set(id, value = "") {

  const e = el(id);

  if (e) e.value = value;

}

function clear(ids) {

  ids.forEach(id => set(id));

}

function daysRemaining(dateString) {

  if (!dateString) return 0;

  const paidDate = new Date(dateString);

  const expiry = new Date(
    paidDate.getTime() + (35 * 24 * 60 * 60 * 1000)
  );

  const diff = expiry - new Date();

  return Math.max(
    0,
    Math.ceil(diff / (1000 * 60 * 60 * 24))
  );

}

/* =====================================================
   STATE (ONLY ONCE — FIXED)
===================================================== */

window.currentSeller = null;
window.currentBuyer = null;

console.log("🔥 Jamii App Loaded");


/* =====================================================
   CONFIG (ROBUST SINGLE SOURCE OF TRUTH)
===================================================== */

const SUBSCRIPTION_DAYS = 35;
const SUBSCRIPTION_AMOUNT = 20;

/* ensure CONFIG exists */
window.CONFIG = window.CONFIG ?? {};

/* prevent overwrite of existing valid config */
if (typeof window.CONFIG.COUPON_EXPIRY !== "number") {

  const expiry = new Date("2026-06-14T10:30:00+03:00").getTime();

  window.CONFIG.COUPON_EXPIRY = Number.isFinite(expiry)
    ? expiry
    : Date.now() + 86400000; // fallback 1 day safety
}

window.CONFIG.AMOUNT_TO_PAY = SUBSCRIPTION_AMOUNT;
window.CONFIG.SUBSCRIPTION_DAYS = SUBSCRIPTION_DAYS;



/* =====================================================
   SELLER REGISTER
===================================================== */

window.sellerRegister = async function () {

  if (!db) return alert("Firebase Not Ready");

  const password = val("s_password");
  const confirm = val("s_confirm_password");

  if (
    !val("s_name") ||
    !val("s_business") ||
    !val("s_contact") ||
    !password ||
    !confirm
  ) {
    return alert("⚠️ Fill All Required Fields");
  }

  if (password.length < 6) {
    return alert("⚠️ Password Must Be 6+ Characters");
  }

  if (password !== confirm) {
    return alert("⚠️ Passwords Do Not Match");
  }

  try {

    const existing = await db.collection("sellers")
      .where("contact", "==", val("s_contact"))
      .get();

    if (!existing.empty) {
      return alert("⚠️ Contact Already Registered");
    }

    await db.collection("sellers").add({

      name: val("s_name"),
      business: val("s_business"),
      branch: val("s_branch"),
      category: val("s_category"),
      county: val("s_county"),
      place: val("s_place"),
      routes: val("s_routes"),
      contact: val("s_contact"),
      password,

      createdAt: firebase.firestore.FieldValue.serverTimestamp(),

      paid: false,
      locked: false,
      requiresPayment: true,

      subscriptionType: "None",
      expiresAt: null,
      paidAt: null,
      couponUsed: false,
      lastLogin: null

    });

    clear([
      "s_name","s_business","s_branch","s_category",
      "s_county","s_place","s_routes","s_contact",
      "s_password","s_confirm_password"
    ]);

    alert("✅ Seller Registered Successfully");

  } catch (e) {
    console.log(e);
    alert("❌ Registration Failed");
  }

};


/* =====================================================
   SELLER LOGIN 1
===================================================== */

window.sellerLogin1 = async function () {

  try {

    const sellerName = val("s_login_name");
    const sellerPass = val("s_login_pass");

    if (!sellerName || !sellerPass) {
      return alert("⚠️ Enter Login Details");
    }

    const snap = await db.collection("sellers")
      .where("name", "==", sellerName)
      .where("password", "==", sellerPass)
      .get();

    if (snap.empty) {
      return alert("❌ Invalid Login");
    }

    snap.forEach(doc => {
      window.currentSeller = { id: doc.id, ...doc.data() };
    });

    if (currentSeller.locked) {
      window.currentSeller = null;
      return alert("⛔ Account Locked");
    }

    const now = new Date();
    const formatted =
      `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()} - ${now.toLocaleTimeString()}`;

    await db.collection("sellers")
      .doc(currentSeller.id)
      .update({ lastLogin: formatted });

    show("paymentSection");
    renderPaymentSection();

    alert("✅ Login Step 1 Successful");

  } catch (e) {
    console.log(e);
    alert("❌ Login Failed");
  }

};


/* =====================================================
   PAYMENT UI (FIXED + SAFE COUPON LOGIC)
===================================================== */

window.renderPaymentSection = function () {

  const el = document.getElementById("paymentSection");
  if (!el) return;

  const now = Date.now();

  // 🔥 SAFE CONFIG ACCESS (CRITICAL FIX)
  const couponExpiry = window.CONFIG?.COUPON_EXPIRY;

  const couponActive =
    typeof couponExpiry === "number" && now < couponExpiry;

  el.innerHTML = `
  <div style="max-width:450px;margin:20px auto;background:#fff;padding:25px;border-radius:20px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.15);">

    <h2>🚀 Seller Subscription</h2>

    <div style="font-size:42px;font-weight:bold;color:#009688;margin:15px 0;">
      KES ${SUBSCRIPTION_AMOUNT}
    </div>

    <p>${SUBSCRIPTION_DAYS} Days Access</p>

    ${
      couponActive
        ? `<button onclick="activateJamiiCoupon()" 
            style="width:100%;padding:12px;margin-bottom:10px;
            background:orange;border:none;border-radius:10px;
            color:#fff;font-weight:bold;">
            🎟 Use Free Coupon
          </button>`
        : `<p style="color:red;font-weight:bold;">⛔ Coupon Expired</p>`
    }

    <input id="stkPhone" placeholder="2547XXXXXXXX"
  style="
    width:100%;
    padding:14px;
    border:2px solid #009688;
    border-radius:10px;
    font-size:16px;
    background:#fff;
    color:#000;
    outline:none;
  "
/>

    <button id="payBtn" onclick="sellerPay()"
      style="width:100%;padding:15px;margin-top:15px;
      background:#009688;color:#fff;border:none;
      border-radius:10px;font-weight:bold;">
      💳 Pay Now
    </button>

    <div id="paymentStatus"></div>

  </div>`;
};



/* =====================================================
   PAYMENT ENGINE (35 DAYS PER SELLER)
===================================================== */

window.sellerPay = async function () {

  try {

    if (!currentSeller) return alert("⚠️ Login First");

    let phone = formatPhone(val("stkPhone"));

    if (!phone.startsWith("254")) {
      return alert("⚠️ Use 2547XXXXXXXX");
    }

    const btn = document.getElementById("payBtn");
    const status = document.getElementById("paymentStatus");

    btn.disabled = true;
    btn.innerHTML = "⏳ Processing...";
    status.innerHTML = "Preparing payment...";

    const res = await fetch("https://stk-backend-8m70.onrender.com/stkpush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerId: currentSeller.id,
        phone,
        amount: SUBSCRIPTION_AMOUNT
      })
    });

    const data = await res.json();

    if (!data.success) throw new Error("Payment failed");

    localStorage.setItem("pendingPaymentSeller", currentSeller.id);

    window.location.href = data.authorization_url;

    checkPaymentAndRedirect();

  } catch (e) {

    console.log(e);

    alert("❌ Payment Error");
  }
};



/* =====================================================
   PAYMENT CHECK LOOP
===================================================== */

async function checkPaymentAndRedirect() {

  const sellerId = localStorage.getItem("pendingPaymentSeller");
  if (!sellerId) return;

  try {

    const doc = await db.collection("sellers").doc(sellerId).get();
    if (!doc.exists) return;

    const seller = doc.data();

    if (!seller?.paid) {
      setTimeout(checkPaymentAndRedirect, 4000);
      return;
    }

    /* =====================================================
       💳 PAYMENT → 35 DAY SUBSCRIPTION
    ===================================================== */

    const now = Date.now();
    const expiry = now + (SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

    await db.collection("sellers").doc(sellerId).update({
      subscriptionType: "PAID",
      paidAt: now,
      expiresAt: expiry,
      paid: true,
      locked: false,
      requiresPayment: false
    });

    seller.expiresAt = expiry;

    localStorage.removeItem("pendingPaymentSeller");

    window.currentSeller = {
      id: doc.id,
      ...seller,
      expiresAt: expiry
    };

    const status = document.getElementById("paymentStatus");
    if (status) status.innerHTML = "🎉 Payment Successful!";

    setTimeout(() => {
      showSellerDashboard?.();
    }, 1000);

  } catch (e) {
    console.log(e);
    setTimeout(checkPaymentAndRedirect, 5000);
  }
}

/* =====================================================
   COUPON SYSTEM (GLOBAL FIXED EXPIRY - SAFE VERSION)
===================================================== */

window.activateJamiiCoupon = async function () {

  try {

    if (!currentSeller) return alert("Login first");

    const now = Date.now();

    // ✅ SAFE CONFIG CHECK (IMPORTANT FIX)
    const couponExpiry = window.CONFIG?.COUPON_EXPIRY;

    if (!couponExpiry) {
      console.log("CONFIG ERROR: Missing coupon expiry");
      return alert("System error. Try again later.");
    }

    // GLOBAL COUPON CHECK
    if (now >= couponExpiry) {
      return alert("⛔ Coupon expired for everyone");
    }

    // UPDATE FIRESTORE
    await db.collection("sellers").doc(currentSeller.id).update({
      paid: true,
      locked: false,
      requiresPayment: false,
      subscriptionType: "COUPON",
      paidAt: now,
      expiresAt: couponExpiry
    });

    // 🔥 IMPORTANT: update local state safely
    currentSeller = {
      ...currentSeller,
      paid: true,
      subscriptionType: "COUPON",
      expiresAt: couponExpiry
    };

    alert("🎟 Coupon activated");

    // 🔥 IMPORTANT: revalidate access properly
    await sellerLogin2();

  } catch (e) {
    console.log("Coupon error:", e);
    alert("❌ Coupon activation failed");
  }
};




/* =====================================================
   COUPON SYSTEM (GLOBAL FIXED EXPIRY)
===================================================== 

window.activateJamiiCoupon = async function () {

  try {

    if (!currentSeller) return alert("Login first");

    const now = Date.now();

    // GLOBAL COUPON CHECK
    if (now > window.CONFIG.JAMII_COUPON_EXPIRY) {
      return alert("⛔ Coupon expired for everyone");
    }

    await db.collection("sellers").doc(currentSeller.id).update({
      paid: true,
      locked: false,
      requiresPayment: false,
      subscriptionType: "COUPON",
      paidAt: now,
      expiresAt: window.CONFIG.JAMII_COUPON_EXPIRY
    });

    currentSeller.expiresAt = window.CONFIG.JAMII_COUPON_EXPIRY;

    alert("🎟 Coupon activated");

    sellerLogin2();

  } catch (e) {
    console.log(e);
  }
};


/* =====================================================
   ACCESS CHECK (DASHBOARD LOCK LOGIC)
===================================================== */

async function checkSellerAccess(seller) {

  const now = Date.now();

  if (!seller.expiresAt) return false;

  if (now > seller.expiresAt) {

    await db.collection("sellers").doc(seller.id).update({
      paid: false,
      locked: true,
      requiresPayment: true
    });

    return false;
  }

  return true;
}

/* =====================================================
   LOGIN 2 (FINAL GATE)
===================================================== */

window.sellerLogin2 = async function () {

  try {

    if (!currentSeller) return alert("⚠️ Login First");

    const doc = await db.collection("sellers")
      .doc(currentSeller.id)
      .get();

    const seller = { id: doc.id, ...doc.data() };

    const access = await checkSellerAccess(seller);

    if (!access || !seller.paid) {
      showRenewPopup();
      return;
    }

    window.currentSeller = seller;

    alert("🚀 Dashboard Opened");

    showSellerDashboard?.();

  } catch (e) {
    console.log(e);
  }
};


/* =====================================================
   RENEW POPUP
===================================================== */

window.showRenewPopup = function () {

  if (document.getElementById("renewPopup")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div id="renewPopup" style="position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:999999;">
      <div style="width:90%;max-width:420px;background:#fff;padding:25px;border-radius:20px;text-align:center;">

        <h2>🔁 Renew Subscription</h2>

        <div style="font-size:40px;color:#009688;font-weight:bold;margin:15px 0;">
          KES ${SUBSCRIPTION_AMOUNT}
        </div>

        <p>${SUBSCRIPTION_DAYS} Days Access</p>

        <input id="stkPhone" placeholder="2547XXXXXXXX"
          style="width:100%;padding:14px;border:1px solid #ddd;border-radius:10px;" />

        <button onclick="sellerPay()"
          style="width:100%;padding:15px;margin-top:15px;background:#009688;color:#fff;border:none;border-radius:10px;font-weight:bold;">
          🔄 Renew Now
        </button>

      </div>
    </div>
  `);
};


/* =====================================================
   COUNTDOWN
===================================================== */

function startJamiiCountdown() {

  const el = document.getElementById("jamiiCountdown");
  if (!el) return;

  setInterval(() => {

    if (!currentSeller?.expiresAt) return;

    const diff = currentSeller.expiresAt - Date.now();

    if (diff <= 0) {
      el.innerHTML = "⛔ Expired";
      return;
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff / 3600000) % 24);
    const m = Math.floor((diff / 60000) % 60);
    const s = Math.floor((diff / 1000) % 60);

    el.innerHTML = `⏳ ${d}d ${h}h ${m}m ${s}s`;

  }, 1000);
}



/* =====================================================
   SELLER DASHBOARD
===================================================== */

async function showSellerDashboard() {
  const orders = await db.collection("orders")
    .where("seller", "==", currentSeller.name)
    .get();

  const orderCount = orders.size;

  const remain =
  daysRemaining(currentSeller.paidAt);

  el("sellerDash").innerHTML = `

  <div class="dash ultra">

    <div class="dash-scroll">

      <!-- =========================================
           TOP
      ========================================== -->

      <div class="dash-top">

        <h1>
        🌙 ${currentSeller.business}
        </h1>

        <p>
        👤 ${currentSeller.name}
        </p>

        <p>
        📍 ${currentSeller.place || "Unknown"}
        </p>

      </div>


      <!-- =========================================
           STATS
      ========================================== -->

      <div class="stats-grid">

        <div class="stat-card">

          <h3>
          ${orderCount}
          </h3>

          <span>
          Total Orders
          </span>

        </div>

        <div class="stat-card">

          <h3>
          ${remain}
          </h3>

          <span>
          Days Remaining
          </span>

        </div>

        <div class="stat-card">

          <h3>
          ${currentSeller.paid
          ? "ACTIVE"
          : "INACTIVE"}
          </h3>

          <span>
          Subscription
          </span>

        </div>

      </div>



<!-- =========================================
     SUBSCRIPTION + COUPON COUNTDOWN
========================================== -->

<div class="stats-grid">

  <div class="stat-card">

    <h3 id="subCountdown">--</h3>

    <span>
    Subscription Time Left
    </span>

  </div>

  <div class="stat-card">

    <h3 id="couponCountdown">--</h3>

    <span>
    Coupon Expiry
    </span>

  </div>

</div>




      <!-- =========================================
           ANALYTICS
      ========================================== -->

      <div class="chart-box">

        <h2>
        📊 Seller Analytics
        </h2>

        <div class="admin-chart">

          <div class="bar"
          style="
          height:${Math.min(orderCount * 25,250)}px
          ">
          </div>

        </div>

      </div>


      <!-- =========================================
           STORE SETUP
      ========================================== -->

      <div class="premium-box seller-market-box">

        <h2>
        🏪 Store Setup
        </h2>

        <input
        id="s_payment_method"
        class="money-input"
        placeholder="💳 Payment Method
Example:
Lipa Na Mpesa / Send Money / Bank"

        value="${currentSeller.paymentMethod || ""}">

        <input
        id="s_payment_number"
        class="money-input"
        placeholder="📱 Till / Paybill / Phone Number"

        value="${currentSeller.paymentNumber || ""}">

        <textarea
        id="s_inventory"
        class="luxury-textarea inventory-textarea"
        placeholder="📦 List ALL Products / Services...

UNGA EXE - 2KG - Ksh 180 - Qty 50
UNGA AJAB - 1KG - Ksh 95 - Qty 100
CEMENT - Ksh 780 - Qty 40
PAINTING SERVICE - Ksh 3000
PLUMBING - Ksh 1500

">${currentSeller.inventory || ""}</textarea>

        <button
        class="save-market-btn"
        onclick="saveSellerMarket()">

        💾 Save Store Setup

        </button>

      </div>



<!-- New -->

<div class="premium-box">

  <h2>📢 Jamii AI Broadcast</h2>

  <textarea id="broadcastText"
  placeholder="Write message to all users..."></textarea>

  <button onclick="sendBroadcast()">
    🚀 Send Broadcast
  </button>

</div>



      <!-- =========================================
           ALL ORDERS
      ========================================== -->

      <div class="premium-box">

        <h2>
        📦 Incoming Orders
        </h2>

        <div id="sellerOrders">

        Loading Orders...

        </div>

      </div>


      <!-- =========================================
           PAID ORDERS
      ========================================== -->

      <div class="premium-box">

        <h2>
        💰 Paid Orders
        </h2>

        <div id="paidOrders">

        Loading...

        </div>

      </div>


      <!-- =========================================
           DEBT ORDERS
      ========================================== -->

      <div class="premium-box">

        <h2>
        🧾 Debt Orders
        </h2>

        <div id="debtOrders">

        Loading...

        </div>

      </div>



<!-- =========================================
           NOTEPAD SECTION
      ========================================== -->

      <div class="premium-box">

        <h2>
        📝 Financial & Customer Notepad
        </h2>

        <div class="note-form">

          <input
          type="text"
          id="noteTitle"
          placeholder="Customer / Expense / Income">

          <textarea
          id="noteContent"
          class="luxury-textarea inventory-textarea"
          placeholder="Write financial or customer records here..."></textarea>

          <button onclick="saveNote()">
          💾 Save Note
          </button>

        </div>

        <div id="sellerNotes">
        Loading Notes...
        </div>

      </div>

<!-- =========================================
     MODULE HOOKS (FIXED POSITION)
========================================= -->

<div id="sellerModuleHook"></div>
<div id="aiModuleHook"></div>
<div id="aiAnalytics"></div>

    </div>
  </div>
  `;

  // =====================================================
  // CORE LOADERS (DO NOT DUPLICATE THESE)
  // =====================================================

  loadSellerOrders();
  loadSellerNotes();
  startDashboardCountdowns();
  startSubscriptionEngine();

  // =====================================================
  // MODULE INITIALIZERS (IMPORTANT)
  // =====================================================

attachModulesToDashboard();
}



/* =====================================================
   SELLER ORDERS (FIXED + OPTIMIZED)
===================================================== */

let isRenderingOrders = false;
const ORDER_LIMIT = 30;

async function loadSellerOrders() {

  if (!currentSeller) return;
  if (isRenderingOrders) return;

  isRenderingOrders = true;

  try {

    const snap = await db.collection("orders")
      .where("seller", "==", currentSeller.name)
      .limit(ORDER_LIMIT)
      .get();

    const docs = snap.docs;

    let html = "";
    let paidHTML = "";
    let debtHTML = "";

    for (let i = 0; i < docs.length; i++) {

      const d = docs[i].data();

      // HIDE seller deleted orders
      if(d.sellerDeleted === true) continue;

      const total = Number(d.totalAmount || 0);
      const paid = Number(d.amountPaid || 0);
      const debt = Number(d.totalDebt || 0);

      const card = `
      <div class="nice-order ultra-order">

        <div class="order-top">

          <h3>
          🛒 ${d.buyer || "Unknown Buyer"}
          </h3>

          <span class="debt-badge ${debt > 0 ? 'debt-on' : 'debt-clear'}">
            ${debt > 0 ? 'DEBT' : 'CLEARED'}
          </span>

        </div>

        <p>🏪 Shop: ${d.buyerShop || "No Shop"}</p>
        <p>📞 ${d.buyerContact || "No Contact"}</p>
        <p>📦 ${d.items || "No Items"}</p>
        <p>📊 Quantity: ${d.totalItems || 0}</p>
        <p>🛣️ ${d.route || "-"}</p>
        <p>📅 ${d.day || "-"}</p>

        <div class="money-box">

          <div class="money-card">
            <span>💰 Total</span>
            <h4>Ksh ${total}</h4>
          </div>

          <div class="money-card">
            <span>💵 Paid</span>
            <h4>Ksh ${paid}</h4>
          </div>

          <div class="money-card">
            <span>🧾 Debt</span>
            <h4 style="color:${debt > 0 ? '#ff4d6d' : '#00ff99'}">
              Ksh ${debt}
            </h4>
          </div>

        </div>

       <button class="delete-btn"
onclick="deleteSellerOrder('${docs[i].id}')">
🗑 Delete Order
</button>
          
          
        

      </div>
      `;

      html += card;

      if (debt > 0) {
        debtHTML += card;
      } else {
        paidHTML += card;
      }
    }

    requestAnimationFrame(() => {
      el("sellerOrders").innerHTML = html || "No Orders Yet";
      el("paidOrders").innerHTML = paidHTML || "No Paid Orders";
      el("debtOrders").innerHTML = debtHTML || "No Debt Orders";
    });

  } catch (e) {
    console.log("Order Load Error:", e);
  }

  isRenderingOrders = false;
}




/* new*/ 
let dashboardIntervals = {
  sub: null,
  coupon: null
};

function startDashboardCountdowns() {

  /* =========================================
     CLEAR OLD INTERVALS (IMPORTANT FIX)
  ========================================== */

  if (dashboardIntervals.sub) clearInterval(dashboardIntervals.sub);
  if (dashboardIntervals.coupon) clearInterval(dashboardIntervals.coupon);

  /* =========================================
     SUBSCRIPTION COUNTDOWN (per seller)
  ========================================== */

  dashboardIntervals.sub = setInterval(() => {

    const el1 = document.getElementById("subCountdown");
    if (!el1 || !currentSeller?.expiresAt) return;

    const diff = currentSeller.expiresAt - Date.now();

    if (diff <= 0) {
      el1.innerHTML = "⛔ Expired";
      return;
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);

    el1.innerHTML = `${d}d ${h}h`;

  }, 1000);


  /* =========================================
     COUPON COUNTDOWN (global)
  ========================================== */

  dashboardIntervals.coupon = setInterval(() => {

    const el2 = document.getElementById("couponCountdown");
    if (!el2) return;

    const expiry = window.CONFIG?.COUPON_EXPIRY;
    if (!expiry) return;

    const diff = expiry - Date.now();

    if (diff <= 0) {
      el2.innerHTML = "⛔ Expired";
      return;
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);

    el2.innerHTML = `${d}d ${h}h ${m}m`;

  }, 1000);
}



function startSubscriptionEngine() {

  setInterval(async () => {

    if (!currentSeller?.expiresAt) return;

    const now = Date.now();
    const diff = currentSeller.expiresAt - now;

    const el = document.getElementById("subCountdown");

    if (!el) return;

    /* =========================================
       EXPIRED → AUTO LOCK
    ========================================== */

    if (diff <= 0) {

      el.innerHTML = "⛔ Expired";

      try {
        await db.collection("sellers")
          .doc(currentSeller.id)
          .update({
            locked: true,
            paid: false,
            requiresPayment: true
          });
      } catch (e) {
        console.log(e);
      }

      // FORCE LOGIC STATE UPDATE
      currentSeller.locked = true;

      // optional: force UI update
      return;
    }

    /* =========================================
       ACTIVE → SHOW LIVE COUNTDOWN
    ========================================== */

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);

    el.innerHTML = `${d}d ${h}h ${m}m`;

  }, 1000);
}




/* =====================================================
   SAVE SELLER MARKET
   (FIXED REAL SOLD LOGIC - RELIABLE VERSION)
===================================================== */

function normalize(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

window.saveSellerMarket = async function () {

  try {

    if (!currentSeller || !db) {
      alert("❌ Seller not loaded");
      return;
    }

    const inventoryText = val("s_inventory");

    const sellerRef =
      db.collection("sellers")
      .doc(currentSeller.id);

    /* =========================================
       1. GET CURRENT SELLER DATA (SOURCE OF TRUTH)
    ========================================== */

    const sellerSnap = await sellerRef.get();
    const sellerData = sellerSnap.data() || {};

    /* THIS is the ONLY stable previous snapshot */
    const previousSnapshot =
      sellerData.stockSnapshot || {};

    /* =========================================
       2. PARSE CURRENT INVENTORY
    ========================================== */

    const newItems = parseInventory(inventoryText);

    let inventoryStats = {};
    let newSnapshot = {};

    /* =========================================
       3. COMPARE OLD VS NEW
    ========================================== */

    newItems.forEach(item => {

      const productName = (item.name || "Unnamed").trim();
      const key = normalize(productName);

      const currentQty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;

      const previousQty =
        previousSnapshot[key]?.qty ?? currentQty;

      /* =========================================
         SOLD LOGIC (CORRECT DIRECTION)
      ========================================== */

      let sold = 0;

      if (previousSnapshot[key]) {
        sold = previousQty - currentQty;
      }

      if (sold < 0) sold = 0;

      const estimatedProfit = sold * price;
      const stockValue = currentQty * price;

      inventoryStats[key] = {
        productName,
        price,
        previousQty,
        currentQty,
        sold,
        estimatedProfit,
        stockValue
      };

      /* =========================================
         UPDATE SNAPSHOT FOR NEXT SAVE
      ========================================== */

      newSnapshot[key] = {
        qty: currentQty
      };

    });

    /* =========================================
       4. SAVE SELLER DATA
    ========================================== */

    await sellerRef.set({

      inventory: inventoryText,
      inventoryStats,
      stockSnapshot: newSnapshot,

      updatedAt:
        firebase.firestore.FieldValue.serverTimestamp()

    }, { merge: true });

    alert("✅ Saved Successfully");

  } catch (e) {
    console.log("SAVE ERROR:", e);
    alert("❌ Failed To Save Store");
  }
};


/* =====================================================
   DELETE ORDER (SELLER SIDE ONLY)
===================================================== */

window.deleteSellerOrder = async function(id) {

  const ask = confirm("Delete this order?");

  if(!ask) return;

  try {

    await db.collection("orders")
    .doc(id)
    .update({

      sellerDeleted: true

    });

    alert("🗑 Order Removed");

    loadSellerOrders();

  } catch(e){

    console.log(e);

    alert("❌ Failed To Delete Order");

  }

}




/* =====================================================
   SAVE NOTE
===================================================== */

async function saveNote() {

  if (!db)
  return alert("Firebase Not Ready");

  const title =
  el("noteTitle").value;

  const content =
  el("noteContent").value;

  if (!title || !content) {

    return alert("⚠️ Fill all fields");

  }

  await db.collection("sellerNotes")
  .add({

    seller:
    currentSeller.name,

    title,

    content,

    createdAt:
    Date.now()

  });

  el("noteTitle").value = "";

  el("noteContent").value = "";

  loadSellerNotes();

}




/* =====================================================
   LOAD NOTES
===================================================== */

async function loadSellerNotes() {

  const snap =
  await db.collection("sellerNotes")
  .where("seller", "==", currentSeller.name)
  .get();

  let html = "";

  const notes = [];

  snap.forEach(doc => {

    notes.push({

      id: doc.id,

      ...doc.data()

    });

  });

  notes.sort((a,b)=>
  b.createdAt - a.createdAt);

  notes.forEach(n => {

    html += `

    <div class="note-card">

      <h3>
      🗒 ${n.title}
      </h3>

      <p>
      ${n.content}
      </p>

      <small>

      🕒
      ${new Date(n.createdAt)
      .toLocaleString()}

      </small>

      <div class="note-actions">

        <button onclick="
        editNote(
        '${n.id}',
        '${encodeURIComponent(n.title)}',
        '${encodeURIComponent(n.content)}'
        )">

        ✏️ Edit

        </button>

        <button onclick="
        deleteNote('${n.id}')
        ">

        🗑 Delete

        </button>

      </div>

    </div>

    `;

  });

  el("sellerNotes").innerHTML =
  html || "No Notes Yet";

}


/* =====================================================
   EDIT NOTE
===================================================== */

async function editNote(
id,
title,
content
) {

  const newTitle =
  prompt(
  "Edit Title",
  decodeURIComponent(title)
  );

  const newContent =
  prompt(
  "Edit Content",
  decodeURIComponent(content)
  );

  if (!newTitle || !newContent)
  return;

  await db.collection("sellerNotes")
  .doc(id)
  .update({

    title:newTitle,

    content:newContent

  });

  loadSellerNotes();

}


/* =====================================================
   DELETE NOTE
===================================================== */

async function deleteNote(id) {

  if (!confirm(
  "Delete this note?"
  )) return;

  await db.collection("sellerNotes")
  .doc(id)
  .delete();

  loadSellerNotes();

}



/* =====================================================
   BUYER REGISTER
===================================================== */

window.buyerRegister = async function () {

  if (!db) return alert("Firebase Not Ready");

  if (
    !val("b_name") ||
    !val("b_shop") ||
    !val("b_contact") ||
    !val("b_password")
  ) {

    return alert("⚠️ Fill All Fields");

  }

  try {

    await db.collection("buyers").add({

      name: val("b_name"),

      shop: val("b_shop"),

      county: val("b_county"),

      place: val("b_place"),

      contact: val("b_contact"),

      password: val("b_password"),

      created: new Date().toLocaleString(),

      lastLogin: null

    });

    clear([
      "b_name",
      "b_shop",
      "b_county",
      "b_place",
      "b_contact",
      "b_password"
    ]);

    alert("✅ Buyer Registered");

  } catch (e) {

    console.log(e);

    alert("❌ Registration Failed");

  }

};

/* =====================================================
   BUYER LOGIN
===================================================== */

window.buyerLogin = async function () {

  try {

    const snap = await db.collection("buyers")
      .where("name", "==", val("b_login_name"))
      .where("password", "==", val("b_login_pass"))
      .get();

    if (snap.empty) {

      return alert("❌ Invalid Login");

    }

    snap.forEach(doc => {

      currentBuyer = {
        id: doc.id,
        ...doc.data()
      };

    });

    await db.collection("buyers")
      .doc(currentBuyer.id)
      .update({

        lastLogin: new Date().toLocaleString()

      });

    clear([
      "b_login_name",
      "b_login_pass"
    ]);

    alert("✅ Login Successful");

    showBuyerDashboard();

  } catch (e) {

    console.log(e);

    alert("❌ Login Failed");

  }

};



/* =====================================================
   BUYER DASHBOARD
===================================================== */

async function showBuyerDashboard() {

  try {

    const snap = await db.collection("sellers")
    .where("paid", "==", true)
    .where("locked", "==", false)
    .get();

    let sellerHTML = "";

    snap.forEach(doc => {

      const d = doc.data();

      sellerHTML += `

      <div class="seller-card"

      data-ai="
      ${(d.business || "").toLowerCase()}
      ${(d.name || "").toLowerCase()}
      ${(d.contact || "").toLowerCase()}
      ${(d.place || "").toLowerCase()}
      ${(d.routes || "").toLowerCase()}
      ${(d.inventory || "").toLowerCase()}
      ${(d.paymentMethod || "").toLowerCase()}
      ${(d.paymentNumber || "").toLowerCase()}
      ">

        <!-- =========================================
             SELLER TOP
        ========================================== -->

        <div class="seller-top">

          <h3>
          🏪 ${d.business || "Business"}
          </h3>

          <span class="verified-badge">
          VERIFIED
          </span>

        </div>

        <p>
        👤 ${d.name || "Unknown Seller"}
        </p>

        <p>
        📞 ${d.contact || "No Contact"}
        </p>

        <p>
        📍 ${d.place || "Unknown Location"}
        </p>

        <p>
        🛣️ Routes:
        ${d.routes || "Not Set"}
        </p>

        <!-- =========================================
             PAYMENT DETAILS
        ========================================== -->

        <div class="payment-box">

          <p class="seller-pay">
          💳 ${d.paymentMethod || "Not Set"}
          </p>

          <p class="seller-number">
          📱 ${d.paymentNumber || ""}
          </p>

        </div>

        <!-- =========================================
             INVENTORY
        ========================================== -->

        <div class="inventory-box">

          ${(d.inventory || "No Products Listed")
          .replace(/\n/g,"<br>")}

        </div>

        <!-- =========================================
             SELECT SELLER
        ========================================== -->

        <button class="select-btn"

        onclick="selectSeller(
        '${doc.id}',
        '${(d.name || "").replace(/'/g,"\\'")}',
        '${(d.contact || "").replace(/'/g,"\\'")}',
        '${(d.routes || "").replace(/'/g,"\\'")}',
        this
        )">

        ✅ Select Seller

        </button>

      </div>

      `;

    });

    el("buyerDash").innerHTML = `

    <div class="dash ultra">

      <div class="dash-scroll">

        <!-- =========================================
             TOP SECTION
        ========================================== -->

        <h1>
        🛍️ Welcome ${currentBuyer.name || "Buyer"}
        </h1>

        <div class="stats-grid">

          <div class="stat-card">

            <h3>
            ${currentBuyer.shop || "No Shop"}
            </h3>

            <span>
            Shop
            </span>

          </div>

          <div class="stat-card">

            <h3>
            ${currentBuyer.place || "Unknown"}
            </h3>

            <span>
            Location
            </span>

          </div>

        </div>

        <!-- =========================================
             AI SEARCH
        ========================================== -->

        <div class="premium-box">

          <h2>
          🔍 AI Seller Search
          </h2>

          <div class="seller-search-wrap">

            <input
            type="text"
            id="sellerSearch"
            placeholder="Search sellers, products, county, contacts..."
            oninput="aiSellerSearch()">

          </div>

          <button class="reset-search-btn"
          onclick="resetSellerSearch()">

          🔄 Reset Sellers

          </button>

        </div>

        <!-- =========================================
             AVAILABLE SELLERS
        ========================================== -->

        <div class="premium-box">

          <h2>
          🏪 Available Sellers
          </h2>

          <div class="seller-grid"
          id="sellerGrid">

          ${sellerHTML || "No Sellers Available"}

          </div>

        </div>

        <!-- =========================================
             CREATE ORDER
        ========================================== -->

        <div class="premium-box"
        id="orderSection">

          <h2>
          📦 Create Order
          </h2>

          <input
          id="o_seller"
          placeholder="🏪 Seller Name">

          <input
          id="o_contact"
          placeholder="📞 Seller Contact">

          <textarea
          id="o_items"
          class="luxury-textarea"
          placeholder="✨ Enter Items To Order...

UNGA EXE - 10
Bread - 5
Sugar - 2 Bags"></textarea>

          <input
          id="o_route"
          placeholder="🛣️ Delivery Route">

          <input
          id="o_day"
          placeholder="📅 Delivery Day">

          <!-- =========================================
               FINANCIAL SECTION
          ========================================== -->

          <div class="finance-box">

            <h3 class="finance-title">
            💰 Financial Details
            </h3>

            <input
            type="number"
            id="o_total_items"
            class="money-input"
            placeholder="📦 Total Quantity">

            <input
            type="number"
            id="totalAmount"
            class="money-input"
            placeholder="💰 Total Cost"
            oninput="calculateDebt()">

            <input
            type="number"
            id="amountPaid"
            class="money-input"
            placeholder="💵 Amount Paid"
            oninput="calculateDebt()">

            <input
            type="number"
            id="totalDebt"
            class="money-input debt-input"
            placeholder="🧾 Remaining Debt"
            readonly>

          </div>

          <button class="send-order-btn"
          onclick="createOrder()">

          🚀 Send Order

          </button>

        </div>

        <!-- =========================================
             BUYER ORDERS
        ========================================== -->



<!-- =========================================
     JAMII AI NOTIFICATIONS
========================================== -->

<div class="premium-box">

  <h2>
  🔔 Jamii AI Notifications
  </h2>

  <div id="notificationList">

  Loading notifications...

  </div>

</div>



        <div class="premium-box">

          <h2>
          📋 Your Orders
          </h2>

          <div id="orderList">

          Loading Orders...

          </div>

        </div>

      </div>

    </div>

    `;

    loadBuyerOrders();
    loadBuyerNotifications();
    listenBroadcasts();
    



} catch (e) {

  console.log("Buyer dashboard warning:", e);

}

}



/* =====================================================
   LOAD BUYER NOTIFICATIONS
===================================================== */

async function loadBuyerNotifications() {

  try {

    const snap = await db.collection("broadcasts")
    .orderBy("created", "desc")
    .get();

    let html = "";

    snap.forEach(doc => {

      const d = doc.data();

      html += `

      <div class="notif-card" style="
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:18px;
      padding:15px;
      margin-bottom:15px;
      backdrop-filter:blur(10px);
      ">

        <div class="notif-top" style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        margin-bottom:10px;
        ">

          <h4 style="
          margin:0;
          color:#00ff99;
          font-size:16px;
          ">

          📢 ${d.senderName || "System"}

          </h4>

          <button
          onclick="deleteNotification('${doc.id}')"
          style="
          background:#ff4d6d;
          color:white;
          border:none;
          padding:8px 14px;
          border-radius:12px;
          font-size:13px;
          font-weight:bold;
          cursor:pointer;
          ">

          🗑 Delete

          </button>

        </div>

        <p style="
        color:white;
        line-height:1.6;
        margin-bottom:10px;
        ">

        ${d.message || ""}

        </p>

        <small style="
        color:#aaa;
        ">

        🕒 ${d.created || ""}

        </small>

      </div>

      `;

    });

    el("notificationList").innerHTML =
    html || `
    <div style="
    color:#aaa;
    text-align:center;
    padding:20px;
    ">
    No notifications
    </div>
    `;

  } catch(e){

    console.log(e);

    el("notificationList").innerHTML =
    `
    <div style="
    color:#ff4d6d;
    text-align:center;
    padding:20px;
    ">
    ❌ Failed To Load Notifications
    </div>
    `;

  }

}




/* =====================================================
   DELETE NOTIFICATION
===================================================== */

window.deleteNotification = async function(id){

  try{

    const ask =
    confirm("Delete notification?");

    if(!ask) return;

    await db.collection("broadcasts")
    .doc(id)
    .delete();

    loadBuyerNotifications();

  }catch(e){

    console.log(e);

    alert("❌ Failed To Delete");

  }

}
  

/* Rest Function no slag */


window.aiSellerSearch = function () {

  const input =
    (el("sellerSearch")?.value || "")
      .toLowerCase()
      .trim();

  const grid = el("sellerGrid");

  const cards =
    [...document.querySelectorAll(".seller-card")];





  /* =========================================
     AI RANKING
  ========================================== */

  const ranked = cards.map(card => {

    const data =
    card.getAttribute("data-ai");

    let score = 0;

    /* EXACT MATCH */

    if(data.includes(input)){

      score += 100;

    }

    /* WORD MATCH */

    const words =
    input.split(" ");

    words.forEach(word => {

      if(data.includes(word)){

        score += 20;

      }

      /* LETTER AI */

      for(let i = 0; i < word.length; i++){

        if(data.includes(word[i])){

          score += 1;

        }

      }

    });

    return {

      card,
      score

    };

  });

  /* =========================================
     SORT BEST MATCH
  ========================================== */

  ranked.sort((a,b) => b.score - a.score);

  /* =========================================
     DISPLAY RESULTS
  ========================================== */

  ranked.forEach(item => {

    if(item.score > 0){

      item.card.style.display = "block";

      grid.appendChild(item.card);

    }

    else{

      item.card.style.display = "none";

    }

  });

}


/* =====================================================
   SELECT SELLER
===================================================== */

window.selectSeller = function(

  id,
  seller,
  contact,
  route,
  btn

){

  /* =========================================
     AUTO FILL ORDER
  ========================================== */

  set("o_seller", seller);

  set("o_contact", contact);

  set("o_route", route);

  /* =========================================
     GET SELECTED CARD
  ========================================== */

  const selectedCard =
  btn.closest(".seller-card");

  const cards =
  document.querySelectorAll(".seller-card");

  /* =========================================
     HIDE OTHER SELLERS
  ========================================== */

  cards.forEach(card => {

    if(card !== selectedCard){

      card.style.display = "none";

    }

  });

  /* =========================================
     HIGHLIGHT CARD
  ========================================== */

  selectedCard.style.border =
  "2px solid #00ff99";

  selectedCard.style.boxShadow =
  "0 0 25px rgba(0,255,153,0.3)";

  /* =========================================
     SCROLL TO ORDER
  ========================================== */

  el("orderSection")
  .scrollIntoView({

    behavior:"smooth"

  });

}


/* =====================================================
   RESET SELLERS
===================================================== */

window.resetSellerSearch = function(){

  const cards =
  document.querySelectorAll(".seller-card");

  cards.forEach(card => {

    card.style.display = "block";

    card.style.border = "none";

    card.style.boxShadow = "none";

  });

  set("sellerSearch","");

}


/* =====================================================
   CREATE ORDER
===================================================== */

window.createOrder = async function () {

  try {

    if (
      !val("o_seller") ||
      !val("o_contact") ||
      !val("o_items") ||
      !val("o_route") ||
      !val("o_day") ||
      !val("totalAmount")
    ) {

      return alert("⚠️ Fill All Required Fields");

    }

    /* =========================================
       MONEY
    ========================================== */

    const totalAmount =
    Number(val("totalAmount")) || 0;

    const amountPaid =
    Number(val("amountPaid")) || 0;

    const totalDebt =
    totalAmount - amountPaid;

    /* =========================================
       SAVE ORDER
    ========================================== */

    await db.collection("orders").add({

      seller:
      val("o_seller"),

      sellerContact:
      val("o_contact"),

      buyer:
      currentBuyer.name,

      buyerShop:
      currentBuyer.shop,

      buyerContact:
      currentBuyer.contact,

      items:
      val("o_items"),

      route:
      val("o_route"),

      day:
      val("o_day"),

      totalItems:
      Number(val("o_total_items")) || 0,

      totalAmount,

      amountPaid,

      totalDebt:
      totalDebt < 0 ? 0 : totalDebt,

      status:
      totalDebt > 0
      ? "PENDING"
      : "CLEARED",

      created:
      new Date().toLocaleString()

    });

    /* =========================================
       CLEAR INPUTS
    ========================================== */

    clear([
      "o_seller",
      "o_contact",
      "o_items",
      "o_route",
      "o_day",
      "o_total_items",
      "totalAmount",
      "amountPaid",
      "totalDebt"
    ]);

    alert("📦 Order Sent Successfully");

    loadBuyerOrders();

  } catch (e) {

    console.log(e);

    alert("❌ Failed To Create Order");

  }

}


/* =====================================================
   LOAD BUYER ORDERS
===================================================== */

async function loadBuyerOrders() {

  try {

    const snap = await db.collection("orders")
    .where("buyer", "==", currentBuyer.name)
    .get();

    let html = "";

    snap.forEach(doc => {

      const d = doc.data();
      
            // HIDE deleted orders from buyer side
      if(d.buyerDeleted === true) return;


      const total =
      Number(d.totalAmount || 0);

      const paid =
      Number(d.amountPaid || 0);

      const debt =
      Number(d.totalDebt || 0);

      html += `

      <div class="nice-order ultra-order">

        <div class="order-top">

          <h3>
          🏪 ${d.seller || "Seller"}
          </h3>

          <span class="
          debt-badge
          ${debt > 0
          ? 'debt-on'
          : 'debt-clear'}
          ">

          ${debt > 0
          ? 'PENDING'
          : 'CLEARED'}

          </span>

        </div>

        <p>
        📞 ${d.sellerContact || ""}
        </p>

        <p>
        📦 ${d.items || "No Items"}
        </p>

        <p>
        📊 Quantity:
        ${d.totalItems || 0}
        </p>

        <p>
        🛣️ ${d.route || ""}
        </p>

        <p>
        📅 ${d.day || ""}
        </p>

        <!-- =========================================
             MONEY BOX
        ========================================== -->

        <div class="money-box">

          <div class="money-card">

            <span>
            💰 Total
            </span>

            <h4>
            Ksh ${total}
            </h4>

          </div>

          <div class="money-card">

            <span>
            💵 Paid
            </span>

            <h4>
            Ksh ${paid}
            </h4>

          </div>

          <div class="money-card">

            <span>
            🧾 Debt
            </span>

            <h4 style="
            color:${debt > 0
            ? '#ff4d6d'
            : '#00ff99'};
            ">

            Ksh ${debt}

            </h4>

          </div>

        </div>

        <button class="delete-btn"
        onclick="deleteOrder('${doc.id}')">

        🗑 Delete Order

        </button>

      </div>

      `;

    });

    el("orderList").innerHTML =
    html || "No Orders Yet";

  } catch (e) {

    console.log(e);

    el("orderList").innerHTML =
    "❌ Failed To Load Orders";

  }

}


/* =====================================================
   AUTO CALCULATE DEBT
===================================================== */

window.calculateDebt = function(){

  const total =
  Number(val("totalAmount")) || 0;

  const paid =
  Number(val("amountPaid")) || 0;

  const debt =
  total - paid;

  set(
    "totalDebt",
    debt < 0 ? 0 : debt
  );

}



/* =====================================================
   DELETE ORDER (BUYER SIDE ONLY)
===================================================== */

window.deleteOrder = async function(id) {

  const ask = confirm("Delete this order?");

  if(!ask) return;

  try {

    await db.collection("orders")
    .doc(id)
    .update({

      buyerDeleted: true

    });

    alert("🗑 Order Removed From Your Side");

    loadBuyerOrders();

  } catch(e){

    console.log(e);

    alert("❌ Failed To Delete Order");

  }

}


/* =====================================================
   ADMIN LOGIN (FAST + REFRESH SAFE)
===================================================== */

window.adminLogin = async function () {
  try {

    if (val("admin_pass") !== "jimmy@rose") {
      return alert("❌ Wrong Password");
    }

    const dash = document.getElementById("adminDash");
    if (!dash) return;

    dash.innerHTML = "⏳ Loading dashboard...";

    const [sellersSnap, buyersSnap, ordersSnap] = await Promise.all([
      db.collection("sellers").get(),
      db.collection("buyers").get(),
      db.collection("orders").get()
    ]);

    renderAdminUI(sellersSnap, buyersSnap, ordersSnap);

  } catch (e) {
    console.log("ADMIN LOGIN ERROR:", e);
    alert("❌ Failed to load admin dashboard");
  }
};


/* =====================================================
   RENDER UI (SEPARATED FOR SPEED)
===================================================== */

function renderAdminUI(sellersSnap, buyersSnap, ordersSnap) {

  const dash = document.getElementById("adminDash");
  if (!dash) return;

  let sellersHTML = "";
  let buyersHTML = "";

  sellersSnap.forEach(doc => {
    const d = doc.data();

    sellersHTML += `
      <div class="admin-card" id="seller-${doc.id}">
        <h3>👤 ${d.name || "No Name"}</h3>

        <p>📞 ${d.contact || "-"}</p>

        <p>🕒 Last Login: ${d.lastLogin || "Never"}</p>

        <p>⏳ ${daysRemaining(d.paidAt)} Days Left</p>

        <p class="status-${doc.id}">
          🔒 ${d.locked ? "LOCKED" : "ACTIVE"}
        </p>

        <button onclick="deleteSeller('${doc.id}')">Delete</button>
        <button onclick="lockSeller('${doc.id}')">Lock</button>
        <button onclick="unlockSeller('${doc.id}')">Unlock</button>
      </div>
    `;
  });

  buyersSnap.forEach(doc => {
    const d = doc.data();

    buyersHTML += `
      <div class="admin-card" id="buyer-${doc.id}">
        <h3>🛍️ ${d.name || "No Name"}</h3>

        <p>📞 ${d.contact || "-"}</p>

        <p>🏪 ${d.shop || "No Shop"}</p>

        <p>🕒 Last Login: ${d.lastLogin || "Never"}</p>

        <button onclick="deleteBuyer('${doc.id}')">Delete</button>
      </div>
    `;
  });

  dash.innerHTML = `
    <div class="dash ultra">
      <div class="dash-scroll">

        <h1>🔐 Admin Dashboard</h1>

        <div class="stats-grid">
          <div class="stat-card">
            <h3>${sellersSnap.size}</h3>
            <span>Total Sellers</span>
          </div>

          <div class="stat-card">
            <h3>${buyersSnap.size}</h3>
            <span>Total Buyers</span>
          </div>

          <div class="stat-card">
            <h3>${ordersSnap.size}</h3>
            <span>Total Orders</span>
          </div>
        </div>

        <div class="premium-box">
          <h2>👨‍💼 Manage Sellers</h2>
          <div class="admin-grid">${sellersHTML}</div>
        </div>

        <div class="premium-box">
          <h2>🛒 Manage Buyers</h2>
          <div class="admin-grid">${buyersHTML}</div>
        </div>

      </div>
    </div>
  `;
}


/* =====================================================
   ADMIN ACTIONS (LIVE UI UPDATE - NO RELOAD)
===================================================== */

window.deleteSeller = async function (id) {
  try {
    await db.collection("sellers").doc(id).delete();

    document.getElementById(`seller-${id}`)?.remove();
    alert("✅ Seller Deleted");

  } catch (e) {
    console.log(e);
    alert("❌ Failed to delete seller");
  }
};


window.lockSeller = async function (id) {
  try {
    await db.collection("sellers").doc(id).update({
      locked: true
    });

    const el = document.querySelector(`#seller-${id} .status-${id}`);
    if (el) el.innerHTML = "🔒 LOCKED";

    alert("🔒 Seller Locked");

  } catch (e) {
    console.log(e);
    alert("❌ Failed to lock seller");
  }
};


window.unlockSeller = async function (id) {
  try {
    await db.collection("sellers").doc(id).update({
      locked: false
    });

    const el = document.querySelector(`#seller-${id} .status-${id}`);
    if (el) el.innerHTML = "🔓 ACTIVE";

    alert("🔓 Seller Unlocked");

  } catch (e) {
    console.log(e);
    alert("❌ Failed to unlock seller");
  }
};


/* =====================================================
   BUYER ACTION (FIXED DUPLICATE REMOVED)
===================================================== */

window.deleteBuyer = async function (id) {
  try {
    await db.collection("buyers").doc(id).delete();

    document.getElementById(`buyer-${id}`)?.remove();
    alert("✅ Buyer Deleted");

  } catch (e) {
    console.log(e);
    alert("❌ Failed to delete buyer");
  }
};


/* =====================================================
   SELLER + AI MODULES (FULL FIXED VERSION)
===================================================== */

function extendSellerDashboard() {

  const hook =
    document.getElementById("sellerModuleHook");

  if (!hook || !currentSeller || !db) return;

  hook.innerHTML = `
    <div class="premium-box">

      <h2>📦 Seller Products Module</h2>

      <button onclick="addSellerProduct()">
        ➕ Add Product
      </button>

      <div id="sellerProducts">
        Loading products...
      </div>

    </div>
  `;

  loadSellerProducts();
}



/* =====================================================
   AI DASHBOARD CONTROLLER (FIXED)
===================================================== */

function attachAIToDashboard() {

  const hook =
    document.getElementById("aiModuleHook");

  if (!hook || !currentSeller || !db) return;

  hook.innerHTML = `
    <div class="premium-box">

      <h2>🤖 Jamii AI Module</h2>

      <!-- BUSINESS AI -->
      <div id="aiAnalytics">
        Loading business analytics...
      </div>

      <hr>

      <!-- INVENTORY AI -->
      <div id="inventoryAI">
        Loading inventory analysis...
      </div>

    </div>
  `;

  /* =========================================
     RUN BOTH AI ENGINES
  ========================================== */

  generateSellerAnalytics();
  generateInventoryAI();

}


/* =====================================================
   REAL AI ANALYTICS ENGINE (FIXED + SAFE + STABLE)
===================================================== */

async function generateSellerAnalytics() {

  try {

    /* =========================================
       SAFETY CHECKS
    ========================================== */

    if (!currentSeller || !db) return;

    const box =
      document.getElementById("aiAnalytics");

    if (!box) return;

    /* =========================================
       LOADING STATE
    ========================================== */

    box.innerHTML = `
      <div class="nice-order">
        ⏳ Loading business analytics...
      </div>
    `;

    /* =========================================
       FETCH ORDERS
    ========================================== */

    const ordersSnap =
      await db.collection("orders")
      .where("seller", "==", currentSeller.name)
      .get();

    if (!ordersSnap || ordersSnap.empty) {

      box.innerHTML = `
        <div class="nice-order">
          📊 No orders found yet
        </div>
      `;

      return;

    }

    /* =========================================
       CALCULATIONS
    ========================================== */

    let totalOrders = 0;
    let totalDebt = 0;
    let totalPaid = 0;
    let totalSales = 0;

    let buyers = new Set();

    ordersSnap.forEach(doc => {

      const d = doc.data() || {};

      totalOrders++;

      if (d.buyer) buyers.add(d.buyer);

      const total = Number(d.totalAmount) || 0;
      const paid = Number(d.amountPaid) || 0;

      const debt =
        Number(d.totalDebt) || (total - paid);

      totalSales += total;
      totalPaid += paid;
      totalDebt += debt;

    });

    /* =========================================
       METRICS
    ========================================== */

    const profit = totalPaid - totalDebt;

    const growthPrediction = totalOrders * 1.35;

    const performance =
      totalOrders > 20 ? "🔥 HIGH" :
      totalOrders > 10 ? "⚡ GOOD" :
      "🟡 LOW";

    /* =========================================
       RENDER UI
    ========================================== */

    box.innerHTML = `
      <div style="display:grid; gap:10px">

        <h2>🧠 AI Business Insight</h2>

        <p>📦 Total Orders: <b>${totalOrders}</b></p>

        <p>👥 Unique Buyers: <b>${buyers.size}</b></p>

        <hr>

        <p>💰 Total Sales: <b>KES ${totalSales}</b></p>

        <p>💵 Total Paid: <b>KES ${totalPaid}</b></p>

        <p>🧾 Total Debt: <b>KES ${totalDebt}</b></p>

        <p>📈 Profit Estimate: <b>KES ${profit}</b></p>

        <hr>

        <p>📊 Growth Prediction: <b>${growthPrediction.toFixed(0)}</b></p>

        <p>⚡ Performance: <b>${performance}</b></p>

      </div>
    `;

  } catch (e) {

    console.log("BUSINESS AI ERROR:", e);

    const box =
      document.getElementById("aiAnalytics");

    if (box) {

      box.innerHTML = `
        <div class="nice-order">
          ❌ Failed to load business analytics
        </div>
      `;

    }

  }
}


/* =====================================================
   COMPLETE INVENTORY AI SYSTEM
   (LEDGER + ALERTS + MOBILE UI + CLEAN ENGINE)
===================================================== */

/* ================================
   GLOBALS
================================ */

let inventoryAIUnsub = null;
let inventoryAIRenderTimer = null;

/* ================================
   HELPERS
================================ */

function normalizeKey(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function parseInventory(text) {

  const lines = (text || "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const items = [];

  lines.forEach(line => {

    const qtyMatch = line.match(/qty\s*[:\-]?\s*(\d+)/i);
    const priceMatch = line.match(/ksh\s*[:\-]?\s*(\d+)|kes\s*[:\-]?\s*(\d+)|(\d+)\s*ksh|(\d+)\s*kes/i);

    const qty = qtyMatch ? Number(qtyMatch[1]) : 0;
    const price =
      priceMatch
        ? Number(priceMatch[1] || priceMatch[2] || priceMatch[3] || priceMatch[4])
        : 0;

    const name = line
      .replace(/qty\s*[:\-]?\s*\d+/i, "")
      .replace(/ksh|kes/ig, "")
      .replace(/[0-9]/g, "")
      .replace(/[:\-]/g, "")
      .trim();

    if (name) {
      items.push({ name, qty, price });
    }
  });

  return items;
}

/* ================================
   STOCK ALERTS
================================ */

function checkStockAlerts(items) {

  let alerts = [];

  items.forEach(item => {

    const qty = Number(item.qty) || 0;

    if (qty <= 5 && qty > 0) {
      alerts.push(`⚠ Low stock: ${item.name} (${qty})`);
    }

    if (qty === 0) {
      alerts.push(`🚨 OUT OF STOCK: ${item.name}`);
    }

  });

  return alerts;
}

/* ================================
   DAILY LEDGER
================================ */

async function saveDailyLedger(inventoryStats) {

  try {

    if (!currentSeller || !db) return;

    const today = new Date().toISOString().split("T")[0];

    let totalProfit = 0;
    let totalStock = 0;
    let totalUnits = 0;

    Object.values(inventoryStats || {}).forEach(item => {

      totalProfit += item.stockValue || 0;
      totalStock += item.stockValue || 0;
      totalUnits += item.qty || 0;

    });

    await db.collection("daily_ledger")
      .doc(currentSeller.id)
      .collection("days")
      .doc(today)
      .set({

        date: today,
        sellerId: currentSeller.id,
        totalProfit,
        totalStock,
        totalUnits,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()

      }, { merge: true });

  } catch (e) {
    console.log("LEDGER ERROR:", e);
  }
}

/* ================================
   MAIN INVENTORY ENGINE
================================ */

window.generateInventoryAI = function () {

  try {

    if (!currentSeller || !db) return;

    const box = document.getElementById("inventoryAI");
    if (!box) return;

    if (inventoryAIUnsub) inventoryAIUnsub();

    box.innerHTML = `
      <div style="padding:10px">⏳ Loading Inventory AI...</div>
    `;

    inventoryAIUnsub =
      db.collection("sellers")
      .doc(currentSeller.id)
      .onSnapshot((snap) => {

        clearTimeout(inventoryAIRenderTimer);

        inventoryAIRenderTimer = setTimeout(async () => {

          const seller = snap.data() || {};
          const inventoryText = seller.inventory || "";

          const items = parseInventory(inventoryText);

          let totalProducts = 0;
          let totalUnits = 0;
          let totalStockValue = 0;

          let alertsHTML = "";
          let html = "";

          const inventoryStats = {};

          /* ================================
             ALERTS
          ================================ */

          const alerts = checkStockAlerts(items);

          if (alerts.length) {
            alertsHTML = alerts.map(a =>
              `<div style="color:orange;font-weight:600">${a}</div>`
            ).join("");
          }

          /* ================================
             PROCESS ITEMS
          ================================ */

          items.forEach(item => {

            const name = item.name || "Unnamed Product";
            const key = normalizeKey(name);

            const qty = Number(item.qty) || 0;
            const price = Number(item.price) || 0;

            const stockValue = qty * price;

            totalProducts++;
            totalUnits += qty;
            totalStockValue += stockValue;

            inventoryStats[key] = {
              name,
              qty,
              price,
              stockValue
            };

            html += `
              <div style="
                background:#111;
                color:#fff;
                padding:12px;
                border-radius:10px;
                margin-bottom:10px;
              ">
                <h3>📦 ${name}</h3>
                <p>💰 Price: KES ${price}</p>
                <p>📊 Qty: ${qty}</p>
                <p>💵 Stock Value: KES ${stockValue}</p>
              </div>
            `;
          });

          /* ================================
             SAVE LEDGER
          ================================ */

          await saveDailyLedger(inventoryStats);

          /* ================================
             UI (RESPONSIVE CLEAN DASHBOARD)
          ================================ */

          box.innerHTML = `
            <div style="
              padding:10px;
              max-width:100%;
              box-sizing:border-box;
              font-family:Arial;
            ">

              <h2>📦 Inventory AI Engine</h2>

              <div style="
                display:grid;
                grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
                gap:10px;
                margin-bottom:15px;
              ">

                <div style="background:#000;color:#fff;padding:10px;border-radius:10px;text-align:center">
                  📦 Products<br><b>${totalProducts}</b>
                </div>

                <div style="background:#000;color:#fff;padding:10px;border-radius:10px;text-align:center">
                  📊 Units<br><b>${totalUnits}</b>
                </div>

                <div style="background:#000;color:#fff;padding:10px;border-radius:10px;text-align:center">
                  💰 Stock Value<br><b>KES ${totalStockValue}</b>
                </div>

                <div style="background:#000;color:#fff;padding:10px;border-radius:10px;text-align:center">
                  📈 Profit<br><b>KES ${totalStockValue}</b>
                </div>

              </div>

              <div style="margin:10px 0;padding:10px;background:#111;border-left:3px solid orange;">
                ${alertsHTML}
              </div>

              <hr>

              <div>
                ${html}
              </div>

            </div>
          `;

        }, 150);

      });

  } catch (e) {
    console.log("AI ERROR:", e);
  }
};




/* =====================================================
   SAFE PRODUCT LOADER (FIXED)
===================================================== */


async function loadSellerProducts() {

  try {

    if (!currentSeller || !db) return;

    const snap = await db.collection("products")
      .where("sellerId", "==", currentSeller.id)
      .get();

    let html = "";

    snap.forEach(doc => {

      const p = doc.data();

      html += `
        <div class="nice-order">

          <h3>
            📦 ${p.name || "Unnamed Product"}
          </h3>

          <p>
            💰 KES ${p.price || 0}
          </p>

          <p>
            ${p.description || ""}
          </p>

        </div>
      `;

    });

    const box =
      document.getElementById("sellerProducts");

    if (box) {

      box.innerHTML =
        html || "<p>No products yet</p>";

    }

  } catch(e) {

    console.log(
      "LOAD PRODUCTS ERROR:",
      e
    );

  }

}




/* =====================================================
   SMART INVENTORY PARSER
   (FINAL FIXED VERSION)
===================================================== */

function parseInventory(text = "") {

  try {

    /* =========================================
       CLEAN LINES
    ========================================== */

    const lines = text
      .split("\n")
      .map(line => line.trim())
      .filter(line => line);

    let items = [];

    /* =========================================
       LOOP LINES
    ========================================== */

    lines.forEach(line => {

      /* =========================================
         EXTRACT QUANTITY
         Example:
         qty 50
      ========================================== */

      const qtyMatch =
        line.match(/qty\s*[:\-]?\s*(\d+)/i);

      const qty =
        qtyMatch
        ? Number(qtyMatch[1])
        : 0;

      /* =========================================
         EXTRACT PRICE
         Example:
         KES 1680
      ========================================== */

      const priceMatch =
        line.match(/kes\s*[:\-]?\s*([\d,]+)/i);

      const price =
        priceMatch
        ? Number(
            priceMatch[1]
            .replace(/,/g, "")
          )
        : 0;

      /* =========================================
         CLEAN PRODUCT NAME
      ========================================== */

      const name = line

        .replace(/qty\s*[:\-]?\s*\d+/ig, "")

        .replace(/kes\s*[:\-]?\s*[\d,]+/ig, "")

        .replace(/\s+/g, " ")

        .trim();

      /* =========================================
         SAVE ITEM
      ========================================== */

      if (name) {

        items.push({

          name: name,

          qty: qty,

          price: price
        });
      }

    });

    return items;

  } catch (e) {

    console.log(
      "PARSE INVENTORY ERROR:",
      e
    );

    return [];
  }
}



/* =====================================================
   STOCK MOVEMENT ANALYZER (FIXED + RELIABLE)
===================================================== */

async function analyzeStockMovement() {

  try {

    const snap = await db.collection("inventory_history")
      .where("sellerId", "==", currentSeller.id)
      .orderBy("createdAt") // FIXED (was "created")
      .get();

    let previousMap = {};

    let movement = {};

    snap.forEach(doc => {

      const data = doc.data();

      if (!data.inventory) return;

      const currentItems =
        parseInventory(data.inventory);

      let currentMap = {};

      /* =========================================
         BUILD CURRENT MAP
      ========================================== */

      currentItems.forEach(item => {

        const name =
          (item.name || "")
          .trim()
          .toLowerCase();

        currentMap[name] = {
          qty: Number(item.qty) || 0
        };
      });

      /* =========================================
         COMPARE WITH PREVIOUS SNAPSHOT
      ========================================== */

      Object.keys(currentMap).forEach(name => {

        const currentQty =
          currentMap[name].qty;

        const previousQty =
          previousMap[name]?.qty ?? currentQty;

        const sold =
          previousQty - currentQty;

        if (sold > 0) {

          movement[name] =
            (movement[name] || 0)
            + sold;
        }

      });

      /* =========================================
         UPDATE SNAPSHOT
      ========================================== */

      previousMap = currentMap;

    });

    return movement;

  } catch (e) {

    console.log(
      "STOCK ANALYZER ERROR:",
      e
    );

    return {};
  }
}



/* BROADCAST GLOBALL*/

window.sendBroadcast = async function () {

  try {

    const msg = val("broadcastText");

    if (!msg) {
      return alert("⚠️ Write a message first");
    }

    await db.collection("broadcasts").add({

      message: msg,
      senderName: currentSeller?.name || currentBuyer?.name || "Admin",
      created: new Date().toISOString()

    });

    set("broadcastText", "");

    alert("📢 Sent to all users");

  } catch (e) {

    console.log(e);
    alert("❌ Failed to send");
  }

};



/* =====================================================
   DASHBOARD CONNECTOR (CALL THIS AFTER LOAD)
===================================================== */

function attachModulesToDashboard() {

  setTimeout(() => {

    extendSellerDashboard();
    attachAIToDashboard();
    generateInventoryAI();

  }, 100);
}
