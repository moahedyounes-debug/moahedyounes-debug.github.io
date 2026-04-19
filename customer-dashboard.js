/* ============================================================
   customer-dashboard.js — RH Car Wash
   تم إصلاح: column indexes، parseVisit، parseBooking، formatDateTime
   ============================================================ */

/* ============================================================
   INIT
   ============================================================ */
let CUSTOMER = JSON.parse(localStorage.getItem("customer") || "null");
let PHONE    = CUSTOMER ? String(CUSTOMER.phone).replace(/'/g, "") : null;

if (!CUSTOMER || !PHONE) {
  window.location.href = "customer-home.html";
}

window.onload = async function () {
  await loadCustomerFromAPI();
  loadCustomerInfoFromLocal();
  await Promise.all([
    loadCars(),
    loadLastVisit(),
    loadBookings()
  ]);
  await loadLevelSystem();
  await loadWalletLinks();
};

/* ============================================================
   جلب بيانات العميل من API
   ============================================================ */
async function loadCustomerFromAPI() {
  const res = await apiGetCustomerByPhone(PHONE);
  if (!res.success) return;

  const c = parseCustomer(res.customer);
  CUSTOMER = {
    name:        c.name,
    phone:       c.phone || PHONE,
    membership:  c.membership,
    city:        c.city,
    last_visit:  c.last_visit,
    visit_count: c.visit_count,
    points:      c.points,
    level:       c.level,
    free_wash:   c.free_wash,
    subscription:c.subscription,
  };
  localStorage.setItem("customer", JSON.stringify(CUSTOMER));
}

/* ============================================================
   عرض بيانات العميل
   ============================================================ */
function loadCustomerInfoFromLocal() {
  const el = id => document.getElementById(id);

  safe(el("name"),       CUSTOMER.name);
  safe(el("phone"),      String(CUSTOMER.phone).replace(/'/g,""));
  safe(el("membership"), String(CUSTOMER.membership));
  safe(el("city"),       CUSTOMER.city || "—");
  safe(el("points"),     Number(CUSTOMER.points || 0).toLocaleString("ar-SA"));
  safe(el("freeWash"),   CUSTOMER.free_wash > 0 ? `${CUSTOMER.free_wash} غسلة مجانية ✅` : "لا يوجد");
}

function safe(el, val) {
  if (el) el.innerText = val || "—";
}

/* ============================================================
   مستويات النقاط — من شيت Level
   ============================================================ */
async function loadLevelSystem() {
  const points = Number(CUSTOMER.points || 0);
  const res = await apiGetLevels();

  let levels = [];
  if (res.success && res.levels && res.levels.length) {
    levels = res.levels.map(r => ({
      level: r[0],
      from:  Number(r[1]),
      to:    (r[2] === "" || r[2] === null || r[2] === undefined) ? null : Number(r[2])
    }));
  } else {
    // fallback
    levels = [
      { level:"Bronze",   from:0,    to:499  },
      { level:"Silver",   from:500,  to:1499 },
      { level:"Gold",     from:1500, to:3999 },
      { level:"Platinum", from:4000, to:7999 },
      { level:"VIP",      from:8000, to:null },
    ];
  }

  const current = levels.find(l => {
    if (l.to === null) return points >= l.from;
    return points >= l.from && points <= l.to;
  });

  const levelEl   = document.getElementById("level");
  const progressEl = document.getElementById("progress");
  const nextLevelEl = document.getElementById("nextLevelText");

  if (!current) {
    safe(levelEl, "—");
    return;
  }

  safe(levelEl, current.level);

  let progress = 0, nextText = "";
  if (current.to === null) {
    progress = 100;
    nextText  = "أنت في أعلى مستوى 🎉";
  } else {
    const range   = current.to - current.from;
    progress  = ((points - current.from) / range) * 100;
    const remaining = current.to - points;
    const nextLevel = levels.find(l => l.from > current.from);
    nextText  = `متبقي ${remaining.toLocaleString("ar-SA")} نقطة للوصول إلى ${nextLevel ? nextLevel.level : "المستوى التالي"}`;
  }

  if (progressEl) progressEl.style.width = Math.min(100, Math.max(0, progress)) + "%";
  if (nextLevelEl) nextLevelEl.innerText = nextText;
}

/* ============================================================
   سيارات العميل
   ============================================================ */
async function loadCars() {
  const box = document.getElementById("carsBox");
  if (!box) return;

  const res = await apiGetCarsByPhone(PHONE);
  if (!res.success) {
    box.innerHTML = "خطأ في قراءة البيانات.";
    return;
  }

  const cars = (res.cars || []).map(c => parseCar(c.data || c));

  if (!cars.length) {
    box.innerHTML = "لا توجد سيارات مسجلة.";
    return;
  }

  box.classList.remove("empty");
  box.innerHTML = cars.map(c => `
    <div class="car-card">
      <div class="car-img">🚗</div>
      <div class="car-info">
        <div><b>${c.car || "—"}</b></div>
        <div>الحجم: ${c.size || "—"}</div>
        <div>اللوحة: ${c.plate_numbers} ${c.plate_letters}</div>
        <div>رقم العضوية: <span style="color:#0D47A1">${c.membership}</span></div>
      </div>
    </div>
  `).join("");
}

/* ============================================================
   آخر زيارة — إصلاح column indexes
   ============================================================ */
async function loadLastVisit() {
  const box = document.getElementById("lastVisitBox");
  if (!box) return;

  const res = await apiGetVisitsByMembership(CUSTOMER.membership);
  if (!res.success || !res.visits || !res.visits.length) {
    box.innerHTML = "لا توجد زيارات.";
    return;
  }

  // الزيارات الأحدث في النهاية — نأخذ آخر عنصر
  const lastRow = res.visits[res.visits.length - 1].data || res.visits[res.visits.length - 1];
  const v = parseVisit(lastRow);
  const dt = formatCheckIn(v.check_in);

  box.classList.remove("empty");
  box.innerHTML = `
    <div style="font-size:14px;line-height:1.8">
      <div>🔧 الخدمة: <b>${v.service || "—"}</b></div>
      <div>💰 السعر: <b>${v.price ? v.price.toLocaleString("ar-SA") + " ريال" : "—"}</b></div>
      <div>⭐ النقاط: <b>+${v.points}</b></div>
      <div>🏢 الفرع: <b>${v.branch || "—"}</b></div>
      <div>📅 التاريخ: <b>${dt.date || "—"}</b></div>
      <div>⏰ الوقت: <b>${dt.time || "—"}</b></div>
      <div>💳 الدفع: <b>${v.pay_method || "—"}</b></div>
    </div>
  `;
}

/* ============================================================
   الحجوزات — إصلاح column indexes
   ============================================================ */
async function loadBookings() {
  const box = document.getElementById("bookingsBox");
  if (!box) return;

  const res = await apiGetBookingsByPhone(PHONE);
  if (!res.success || !res.bookings || !res.bookings.length) {
    box.innerHTML = "لا توجد حجوزات.";
    return;
  }

  const bookings = (res.bookings || []).map(b => parseBooking(b.data || b));

  // ترتيب تنازلي حسب التاريخ
  bookings.sort((a, b) => {
    const dA = new Date((a.date || "") + " " + (a.time || ""));
    const dB = new Date((b.date || "") + " " + (b.time || ""));
    return dB - dA;
  });

  const last = bookings[0];
  const dt = formatDateTime(last.date, last.time);

  box.classList.remove("empty");
  box.innerHTML = `
    <div style="font-size:14px;margin-bottom:6px;color:#90CAF9">${bookings.length} حجز مسجل</div>
    <div style="font-size:14px;line-height:1.9">
      <div><b>${dt.day || ""}</b></div>
      <div>📅 التاريخ: <b>${dt.date || last.date}</b></div>
      <div>⏰ الوقت: <b>${dt.time || last.time}</b></div>
      <div>🔧 الخدمة: <b>${last.service}</b></div>
      <div>🔘 الحالة: <b>${last.status}</b></div>
    </div>
  `;
}

/* ============================================================
   Wallet Links
   ============================================================ */
async function loadWalletLinks() {
  if (!CUSTOMER.phone) return;
  await apiCreatePassForCustomerByPhone(CUSTOMER.phone).catch(() => {});

  const res = await apiGetPassLinksByPhone(CUSTOMER.phone);
  if (!res.success) return;

  const apple  = res.appleWallet;
  const google = res.googleWallet;

  const container = document.getElementById("wallet-buttons");
  const appleBtn  = document.getElementById("apple-wallet-btn");
  const googleBtn = document.getElementById("google-wallet-btn");

  if (!container) return;

  if (apple  && appleBtn)  { appleBtn.href  = apple;  appleBtn.style.display  = "inline-block"; }
  if (google && googleBtn) { googleBtn.href = google; googleBtn.style.display = "inline-block"; }
  if (apple || google) container.style.display = "block";
}

/* ============================================================
   واتساب
   ============================================================ */
async function contactWhatsApp() {
  let msg = "مرحباً مغسلة رغوة الهجين%0A";
  const res = await apiGetCustomerByPhone(PHONE);
  if (res.success) {
    const c = parseCustomer(res.customer);
    msg += "الاسم: " + c.name + "%0A" +
           "رقم العضوية: " + c.membership + "%0A" +
           "المستوى: " + c.level + "%0A" +
           "النقاط: " + c.points;
  } else {
    msg += "رقم الجوال: " + PHONE;
  }
  window.location.href = "https://wa.me/966582007063?text=" + msg;
}

/* ============================================================
   تسجيل خروج
   ============================================================ */
function logout() {
  localStorage.removeItem("customer");
  window.location.href = "customer-home.html";
}
