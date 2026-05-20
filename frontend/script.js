/* ========= Smooth Scroll ========= */
function scrollToSection(id){
  document.getElementById(id).scrollIntoView({behavior:'smooth'});
}

function getApiBase(){
  if(window.location.protocol === 'file:') return 'http://localhost:3000';
  const port = String(window.location.port || '');
  if(port === '3000') return '';
  return 'http://localhost:3000';
}

function apiUrl(path){
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}


/* ========= Theme ========= */
function toggleTheme(){
  document.body.classList.toggle("dark");
  localStorage.setItem("theme",
    document.body.classList.contains("dark")?"dark":"light");
}

window.onload = () => {
  if(localStorage.getItem("theme")==="dark"){
    document.body.classList.add("dark");
  }
  setLanguage(localStorage.getItem("lang") || "en");
  initAiChatInput();
  initAiVoiceInput();
  initAiChatSystem();
  ensureLawyerReviewModal();
  initPageData();
  updateAuthMenu();
};

function getPostLoginHref(user){
  const role = String((user && user.role) || getCurrentRole() || '').toLowerCase();
  if(role.startsWith('admin')) return 'admin.html';
  if(role.startsWith('law')) return 'lawyer-dashboard.html';
  return 'index.html';
}

function redirectAuthenticatedToDashboard(){
  const token = localStorage.getItem('lg_token');
  if(!token) return;
  if(document.body.dataset.dash || document.body.dataset.page === 'admin') return;
  if(document.getElementById('loginBox') || document.getElementById('signupBox')) return;
  const mustRedirect = document.body.dataset.requiresAuth === 'true'
    || document.body.dataset.redirectDash === 'true';
  if(!mustRedirect) return;
  window.location.replace(getPostLoginHref());
}

function initPageData(){
  const requiresAuth = document.body && document.body.dataset && document.body.dataset.requiresAuth === 'true';
  const token = localStorage.getItem('lg_token');
  if(requiresAuth && !token){
    window.location.href = 'auth.html';
    return;
  }
  redirectAuthenticatedToDashboard();
  preloadClientBookingsIfLoggedIn();

  // Load dynamic lawyers preview on home / index.
  if(document.getElementById('lawyers') || document.getElementById('lawyersPreview')){
    applyRoleHomeView();
    loadLawyers();
    updateAuthMenu();
  }
  const dashType = document.body && document.body.dataset && document.body.dataset.dash;
  if(dashType === 'user'){
    if(guardDashboardRole('user')){
      loadUserDashboard();
      startDashboardPolling();
    }
  } else if(dashType === 'lawyer'){
    if(guardDashboardRole('lawyer')){
      loadLawyerDashboard();
      startDashboardPolling();
    }
  }
  if(document.body && document.body.dataset.page === 'admin'){
    if(guardAdminPage()) loadAdminPanel();
  }
  if(document.getElementById('signupRole')){
    onSignupRoleChange();
  }
  if(document.body && document.body.dataset.page === 'lawyers'){
    initLawyersPage();
    updateAuthMenu();
  }
  if(document.body && document.body.dataset.page === 'lawyer-profile'){
    initLawyerProfilePage();
    updateAuthMenu();
  }
}

function getCurrentUserObj(){
  try{
    return JSON.parse(localStorage.getItem('lg_user_obj') || 'null');
  } catch(_e){
    return null;
  }
}

function getCurrentRole(){
  const u = getCurrentUserObj();
  return String((u && u.role) || '').toLowerCase();
}

function isLawyerOrAdmin(){
  const role = getCurrentRole();
  return role.startsWith('law') || role.startsWith('admin');
}

function applyRoleHomeView(){
  const banner = document.getElementById('lawyerHomeBanner');
  if(!banner) return;
  if(isLawyerOrAdmin()){
    banner.classList.remove('hidden');
    const title = banner.querySelector('[data-i18n="lawyerWorkspace"]');
    const sub = banner.querySelector('[data-i18n="lawyerWorkspaceSub"]');
    const btn = document.getElementById('lawyerDashOpenBtn');
    if(title) title.textContent = t('lawyerWorkspace');
    if(sub) sub.textContent = t('lawyerWorkspaceSub');
    if(btn){
      btn.textContent = t('openDashboard');
      btn.onclick = ()=>{ window.location.href = getDashboardHref(); };
    }
  } else {
    banner.classList.add('hidden');
  }
}

function apiAuthHeaders(){
  const token = localStorage.getItem('lg_token') || '';
  return { 'Authorization': 'Bearer ' + token };
}

function toggleAccountMenu(){
  const menu = document.getElementById('accountMenu');
  if(!menu) return;
  menu.classList.toggle('hidden');
}

/* ===== Hero background (rotation disabled) ===== */
function initHeroRotation(){
  return;
}


/* ========= Language ========= */
const dict = {
  en:{
    home:"Home", lawyers:"Lawyers", contact:"Contact", login:"Login", signup:"Sign Up", dashboard:"Dashboard", logout:"Logout",
    heroTitle:"Legal Help Made Simple", heroText:"Connect with lawyers or ask our AI assistant instantly", explore:"Explore",
    contactTitle:"Contact", send:"Send", searchPlaceholder:"Search lawyers or ask...", searchButton:"Search",
    searchNoResults:"No lawyers found — opening AI assistant...",
    authLoginTab:"Login", authSignupTab:"Sign Up", authEmailPlaceholder:"Email", authPasswordPlaceholder:"Password",
    authLoginIdentifierPlaceholder:"Email or phone number", authLoginBtn:"Login", authFullNamePlaceholder:"Full Name",
    authPhonePlaceholder:"Phone number", authRoleUser:"User", authRoleLawyer:"Lawyer",
    authDocsPlaceholder:"For lawyers only: add document links (ID, certificate, license), one per line",
    authOrUploadFiles:"Or upload files", authUploadHint:"You can upload ID / certificate / license files (max 3 files, 2MB each).",
    authCreateAccountBtn:"Create Account", authBackHome:"← Home",
    authLawyerSignupHint:"Create your account first. After signup, complete specialty, fees, practice details, and availability in your lawyer dashboard.",
    authLawyerDocsTitle:"Credentials",
    authLawyerDocsRequired:"Lawyers must add at least one credential (document link or uploaded file).",
    authLawyerDocsRequiredHint:"Required: at least one document link or file (max 3 files, 2MB each).",
    navBrowseSite:"Browse site", navAppointments:"Appointments", navProfile:"Profile", navSettings:"Settings", navChat:"Chat",
    navClientRequests:"Client Requests", navAvailability:"Availability", navLogout:"Logout", client:"Client", lawyer:"Lawyer",
    userDashTitle:"My Dashboard", userDashSub:"Book lawyers, manage appointments, and message your lawyer.",
    myAppointments:"My Appointments", noAppointments:"No appointments yet.", browseLawyersLink:"Browse lawyers",
    browseLawyersHint:"to book a consultation.", myProfile:"My Profile", myProfileSub:"Your account details.",
    personalInfo:"Personal info", displayName:"Display name", saveName:"Save name", accountSummary:"Account summary",
    appointmentChat:"Appointment Chat", conversations:"Conversations", chooseConversation:"Choose a conversation.",
    typeMessage:"Type your message…", sendBtn:"Send", settingsTitle:"Settings", contactInfo:"Contact",
    emailLabel:"Email", phoneLabel:"Phone", saveContact:"Save contact", passwordTitle:"Password",
    currentPassword:"Current password", newPassword:"New password", confirmPassword:"Confirm new password",
    changePassword:"Change password", appearance:"Appearance", toggleTheme:"Toggle theme",
    lawyerDashTitle:"Lawyer Dashboard", lawyerDashSub:"Manage clients, your public profile, and availability.",
    pendingApproval:"Your account is awaiting admin approval. Complete your public profile below — clients will see it once approved.",
    rejectedTitle:"Application needs changes", rejectedHint:"Please update your profile and save again. Admin feedback:",
    rejectedNoFeedback:"No written feedback was saved for this rejection. Contact support or update your profile and resubmit.",
    clientBookings:"Client Bookings", noBookings:"No bookings yet.", lawyerProfile:"Lawyer Profile",
    lawyerProfileSub:"What clients see on the lawyers page.", photoName:"Photo & name", profilePhoto:"Profile photo",
    uploadPhoto:"Upload photo", publicPractice:"Public practice info", pendingHint:"Pending approval — info saves now and goes live after approval.",
    specialty:"Specialty", genderShown:"Gender (shown to clients)", preferNotSay:"Prefer not to say", genderMale:"Male", genderFemale:"Female",
    shortDesc:"Short description", practiceDetails:"Practice details", priceRange:"Price range (EGP per session)",
    savePractice:"Save practice info", saveBasicInfo:"Save contact & location", savePublicDetails:"Save public profile details",
    publicDetailsHint:"Phone, location, experience, consultation length, and meeting types publish immediately — no admin approval.",
    basicInfoHint:"Updates here go live immediately — no admin approval needed.",
    practiceApprovalHint:"Changes to specialty, description, or fees require admin approval before clients see them.",
    profilePhonePublic:"Phone (shown to clients)", availabilityDocs:"Availability & Documents", availabilitySlots:"Availability slots",
    oneSlotPerLine:"One slot per line", saveAvailability:"Save availability", uploadDocs:"Upload documents",
    lawyersPageTitle:"Personal Status Lawyers", lawyersPageSub:"Browse approved specialists, filter by specialty, gender, and consultation fee, then book a time that fits you.",
    filterSpecialty:"Specialty", filterGender:"Gender", allSpecialties:"All specialties", anyGender:"Any",
    minFee:"Min. lawyer fee from (EGP)", maxFee:"Max. lawyer fee up to (EGP)", applyFilters:"Apply filters", resetFilters:"Reset",
    lawyerProfilePageTitle:"Lawyer profile", backToLawyers:"← Back to lawyers", phoneLabelProfile:"Phone",
    experienceLabel:"Experience", locationLabel:"Location", consultationDurationLabel:"Consultation duration",
    bookingOptionsLabel:"Booking options", meetingOnline:"Online meeting", meetingInPerson:"In-person meeting",
    meetingTypeLabel:"Meeting type", pickTime:"Pick a time", notProvided:"Not provided", yearsExp:"years",
    minutesShort:"min", noBookingOptions:"No meeting types listed yet",
    loadingLawyers:"Loading lawyers...", noLawyersAvailable:"No lawyers available yet.", bookConsultation:"Book consultation", close:"Close",
    adminTitle:"Admin Control Center", adminSub:"Review lawyers who saved their profile or price range and are waiting to go live on the public lawyers page.",
    pendingApprovals:"Pending lawyer approvals", usersLawyers:"Users & Lawyers", recentActions:"Recent Admin Actions",
    siteHome:"Site home", approveLawyer:"Approve lawyer", rejectLawyer:"Reject", unread:"Unread",
    status:"Status", role:"Role", feeOnRequest:"Fee on request", confirm:"Confirm", cancel:"Cancel", cancelAppt:"Cancel appointment",
    statusPending:"Pending", statusAccepted:"Confirmed", statusCancelled:"Cancelled", statusDeclined:"Declined",
    apptCancelledOne:"Appointment cancelled", apptCancelledMany:"{count} appointments cancelled. Latest: {details}",
    apptCancelledToast:"Appointment cancelled",
    onDate:"on", atTime:"at",
    genderLabel:"Gender", priceRangeLabel:"Price range", summary:"Summary", documents:"Documents", none:"None",
    viewProfile:"View profile", book:"Book", noSlotsYet:"No slots yet", noDescription:"No description yet.",
    profileAvailability:"Availability", clientReviews:"Client reviews", noReviewsYet:"No reviews yet",
    reviewLawyer:"Rate lawyer", editReview:"Edit review", yourRating:"Your rating", reviewComment:"Your review (optional)",
    reviewPromptTitle:"Rate your lawyer", reviewPromptReady:"You have confirmed consultations ready to rate.",
    reviewPromptHint:"Book a consultation and wait for your lawyer to confirm it. Then you can leave a star rating here.",
    submitReview:"Submit review", reviewSaved:"Thank you! Your review was saved.", reviewsCount:"reviews",
    rateStars:"Rate", outOf5:"out of 5",
    openSlot:"open slot", openSlots:"open slots", browseAllLawyers:"Browse all lawyers", browseLawyersPreview:"Browse specialists by specialty, gender, and consultation fee.",
    bookTitle:"Book a Consultation", chatBtn:"Chat", noLawyersMatch:"No lawyers match your filters. Try resetting filters.",
    genderNotSpecified:"Gender not specified", availableSlots:"available time slot(s)", remove:"Remove",
    suspend:"Suspend", delete:"Delete", approve:"Approve", sending:"Sending…", openDashboard:"Open Dashboard",
    lawyerWorkspace:"Lawyer Workspace", lawyerWorkspaceSub:"Manage your availability, documents, client requests, and appointment chats from your dashboard.",
    voiceInput:"Voice input", voiceStop:"Stop listening", voiceListening:"Listening…",
    voiceNotSupported:"Voice input is not supported in this browser yet.", voiceError:"Voice input failed. Try again or type your message."
  },
  ar:{
    home:"الرئيسية", lawyers:"المحامون", contact:"تواصل", login:"تسجيل الدخول", signup:"إنشاء حساب", dashboard:"لوحة التحكم", logout:"تسجيل الخروج",
    heroTitle:"المساعدة القانونية أصبحت أسهل", heroText:"تواصل مع المحامين أو اسأل المساعد الذكي فوراً", explore:"استكشف",
    contactTitle:"اتصل بنا", send:"إرسال", searchPlaceholder:"ابحث عن محامين أو اسأل...", searchButton:"بحث",
    searchNoResults:"لم يتم العثور على محامين — فتح المساعد الذكي...",
    authLoginTab:"تسجيل الدخول", authSignupTab:"إنشاء حساب", authEmailPlaceholder:"البريد الإلكتروني", authPasswordPlaceholder:"كلمة المرور",
    authLoginIdentifierPlaceholder:"البريد الإلكتروني أو رقم الهاتف", authLoginBtn:"تسجيل الدخول", authFullNamePlaceholder:"الاسم الكامل",
    authPhonePlaceholder:"رقم الهاتف", authRoleUser:"مستخدم", authRoleLawyer:"محامٍ",
    authDocsPlaceholder:"للمحامين فقط: أضف روابط المستندات (الهوية، الشهادة، الترخيص) كل سطر على حدة",
    authOrUploadFiles:"أو ارفع ملفات", authUploadHint:"يمكنك رفع الهوية/الشهادة/الترخيص (حد أقصى 3 ملفات، 2MB لكل ملف).",
    authCreateAccountBtn:"إنشاء الحساب", authBackHome:"← الرئيسية",
    authLawyerSignupHint:"أنشئ حسابك أولاً. بعد التسجيل، أكمل التخصص والرسوم وتفاصيل الممارسة والمواعيد من لوحة المحامي.",
    authLawyerDocsTitle:"المستندات",
    authLawyerDocsRequired:"يجب على المحامين إضافة مستند واحد على الأقل (رابط أو ملف).",
    authLawyerDocsRequiredHint:"مطلوب: رابط مستند واحد على الأقل أو ملف (حد أقصى 3 ملفات، 2MB لكل ملف).",
    navBrowseSite:"تصفح الموقع", navAppointments:"المواعيد", navProfile:"الملف الشخصي", navSettings:"الإعدادات", navChat:"المحادثات",
    navClientRequests:"طلبات العملاء", navAvailability:"المواعيد المتاحة", navLogout:"تسجيل الخروج", client:"عميل", lawyer:"محامٍ",
    userDashTitle:"لوحة التحكم", userDashSub:"احجز محامين، وأدر مواعيدك، وتواصل مع محاميك.",
    myAppointments:"مواعيدي", noAppointments:"لا توجد مواعيد بعد.", browseLawyersLink:"تصفح المحامين",
    browseLawyersHint:"لحجز استشارة.", myProfile:"ملفي الشخصي", myProfileSub:"تفاصيل حسابك.",
    personalInfo:"المعلومات الشخصية", displayName:"اسم العرض", saveName:"حفظ الاسم", accountSummary:"ملخص الحساب",
    appointmentChat:"محادثة الموعد", conversations:"المحادثات", chooseConversation:"اختر محادثة.",
    typeMessage:"اكتب رسالتك…", sendBtn:"إرسال", settingsTitle:"الإعدادات", contactInfo:"التواصل",
    emailLabel:"البريد الإلكتروني", phoneLabel:"الهاتف", saveContact:"حفظ التواصل", passwordTitle:"كلمة المرور",
    currentPassword:"كلمة المرور الحالية", newPassword:"كلمة المرور الجديدة", confirmPassword:"تأكيد كلمة المرور",
    changePassword:"تغيير كلمة المرور", appearance:"المظهر", toggleTheme:"تبديل السمة",
    lawyerDashTitle:"لوحة المحامي", lawyerDashSub:"أدر العملاء وملفك العام ومواعيدك.",
    pendingApproval:"حسابك بانتظار موافقة الإدارة. أكمل ملفك العام أدناه — سيظهر للعملاء بعد الموافقة.",
    rejectedTitle:"الطلب يحتاج تعديلات", rejectedHint:"حدّث ملفك واحفظ مرة أخرى. ملاحظات الإدارة:",
    rejectedNoFeedback:"لم تُحفظ ملاحظات مكتوبة لهذا الرفض. تواصل مع الدعم أو حدّث ملفك وأعد الإرسال.",
    clientBookings:"حجوزات العملاء", noBookings:"لا توجد حجوزات بعد.", lawyerProfile:"ملف المحامي",
    lawyerProfileSub:"ما يراه العملاء في صفحة المحامين.", photoName:"الصورة والاسم", profilePhoto:"صورة الملف",
    uploadPhoto:"رفع صورة", publicPractice:"معلومات الممارسة العامة",
    pendingHint:"بانتظار الموافقة — يُحفظ الآن ويُنشر بعد الموافقة.",
    specialty:"التخصص", genderShown:"الجنس (يظهر للعملاء)", preferNotSay:"أفضل عدم الإفصاح", genderMale:"ذكر", genderFemale:"أنثى",
    shortDesc:"وصف مختصر", practiceDetails:"تفاصيل الممارسة", priceRange:"نطاق السعر (جنيه للجلسة)",
    savePractice:"حفظ معلومات الممارسة", saveBasicInfo:"حفظ التواصل والموقع", savePublicDetails:"حفظ تفاصيل الملف العام",
    publicDetailsHint:"الهاتف والموقع والخبرة ومدة الاستشارة ونوع الاجتماع يُنشر فوراً دون موافقة الإدارة.",
    basicInfoHint:"يُنشر فوراً دون موافقة الإدارة.",
    practiceApprovalHint:"تغيير التخصص أو الوصف أو الرسوم يحتاج موافقة الإدارة.",
    profilePhonePublic:"الهاتف (يظهر للعملاء)", availabilityDocs:"المواعيد والمستندات", availabilitySlots:"مواعيد متاحة",
    oneSlotPerLine:"موعد واحد في كل سطر", saveAvailability:"حفظ المواعيد", uploadDocs:"رفع مستندات",
    lawyersPageTitle:"محامو الأحوال الشخصية", lawyersPageSub:"تصفح المحامين المعتمدين، وفلتر حسب التخصص والجنس والرسوم، ثم احجز موعداً يناسبك.",
    filterSpecialty:"التخصص", filterGender:"الجنس", allSpecialties:"كل التخصصات", anyGender:"أي",
    minFee:"أقل رسوم (جنيه)", maxFee:"أقصى رسوم (جنيه)", applyFilters:"تطبيق الفلاتر", resetFilters:"إعادة تعيين",
    lawyerProfilePageTitle:"ملف المحامي", backToLawyers:"← العودة للمحامين", phoneLabelProfile:"الهاتف",
    experienceLabel:"الخبرة", locationLabel:"الموقع", consultationDurationLabel:"مدة الاستشارة",
    bookingOptionsLabel:"خيارات الحجز", meetingOnline:"اجتماع عبر الإنترنت", meetingInPerson:"اجتماع حضوري",
    meetingTypeLabel:"نوع الاجتماع", pickTime:"اختر الموعد", notProvided:"غير متوفر", yearsExp:"سنة",
    minutesShort:"دقيقة", noBookingOptions:"لم يُحدد نوع الاجتماع بعد",
    loadingLawyers:"جاري تحميل المحامين...", noLawyersAvailable:"لا يوجد محامون متاحون بعد.", bookConsultation:"حجز استشارة", close:"إغلاق",
    adminTitle:"مركز تحكم الإدارة", adminSub:"راجع المحامين الذين حفظوا ملفهم أو نطاق السعر وبانتظار النشر على صفحة المحامين.",
    pendingApprovals:"موافقات المحامين المعلقة", usersLawyers:"المستخدمون والمحامون", recentActions:"آخر إجراءات الإدارة",
    siteHome:"الموقع", approveLawyer:"اعتماد المحامي", rejectLawyer:"رفض", unread:"غير مقروء",
    status:"الحالة", role:"الدور", feeOnRequest:"الرسوم عند الطلب", confirm:"تأكيد", cancel:"إلغاء", cancelAppt:"إلغاء الموعد",
    statusPending:"قيد الانتظار", statusAccepted:"مؤكد", statusCancelled:"ملغى", statusDeclined:"مرفوض",
    apptCancelledOne:"تم إلغاء الموعد", apptCancelledMany:"تم إلغاء {count} مواعيد. الأحدث: {details}",
    apptCancelledToast:"تم إلغاء الموعد",
    onDate:"في", atTime:"الساعة",
    genderLabel:"الجنس", priceRangeLabel:"نطاق السعر", summary:"ملخص", documents:"المستندات", none:"لا يوجد",
    viewProfile:"عرض الملف", book:"حجز", noSlotsYet:"لا مواعيد بعد", noDescription:"لا يوجد وصف بعد.",
    profileAvailability:"المواعيد المتاحة", clientReviews:"تقييمات العملاء", noReviewsYet:"لا توجد تقييمات بعد",
    reviewLawyer:"قيّم المحامي", editReview:"تعديل التقييم", yourRating:"تقييمك", reviewComment:"تعليقك (اختياري)",
    reviewPromptTitle:"قيّم محاميك", reviewPromptReady:"لديك استشارات مؤكدة جاهزة للتقييم.",
    reviewPromptHint:"احجز استشارة وانتظر تأكيد المحامي. بعدها يمكنك ترك تقييم بالنجوم هنا.",
    submitReview:"إرسال التقييم", reviewSaved:"شكراً! تم حفظ تقييمك.", reviewsCount:"تقييم",
    rateStars:"تقييم", outOf5:"من 5",
    openSlot:"موعد متاح", openSlots:"مواعيد متاحة", browseAllLawyers:"تصفح كل المحامين", browseLawyersPreview:"تصفح المتخصصين حسب التخصص والجنس ورسوم الاستشارة.",
    bookTitle:"حجز استشارة", chatBtn:"محادثة", noLawyersMatch:"لا يوجد محامون مطابقون. جرّب إعادة تعيين الفلاتر.",
    genderNotSpecified:"الجنس غير محدد", availableSlots:"موعد/مواعيد متاحة", remove:"إزالة",
    suspend:"إيقاف", delete:"حذف", approve:"اعتماد", sending:"جاري الإرسال…", openDashboard:"فتح لوحة التحكم",
    lawyerWorkspace:"مساحة المحامي", lawyerWorkspaceSub:"أدر مواعيدك ومستنداتك وطلبات العملاء ومحادثات المواعيد من لوحة التحكم.",
    voiceInput:"إدخال صوتي", voiceStop:"إيقاف الاستماع", voiceListening:"جاري الاستماع…",
    voiceNotSupported:"الإدخال الصوتي غير مدعوم في هذا المتصفح بعد.", voiceError:"فشل الإدخال الصوتي. حاول مرة أخرى أو اكتب رسالتك."
  }
};

const SPECIALTY_I18N = {
  'Divorce & Separation': { ar: 'الطلاق والانفصال' },
  'Child Custody': { ar: 'حضانة الأطفال' },
  'Alimony & Maintenance': { ar: 'النفقة والإعالة' },
  'Marriage & Engagement': { ar: 'الزواج والخطوبة' },
  'Inheritance & Estate': { ar: 'الميراث والتركات' },
  'General Personal Status': { ar: 'الأحوال الشخصية العامة' }
};

function t(key){
  return (dict[currentLang] && dict[currentLang][key]) || dict.en[key] || key;
}

function translateSpecialtyName(name){
  const n = String(name || '');
  if(currentLang !== 'ar') return n;
  return (SPECIALTY_I18N[n] && SPECIALTY_I18N[n].ar) || n;
}

let currentLang="en";
let currentChatBookingId = '';
let currentChatPartnerName = '';
let lawyerDocumentsCache = [];
let lawyersCache = [];
let lawyerProfilePageTarget = null;

const PERSONAL_STATUS_SPECIALTIES = [
  'Divorce & Separation',
  'Child Custody',
  'Alimony & Maintenance',
  'Marriage & Engagement',
  'Inheritance & Estate',
  'General Personal Status'
];

function lawyerInitials(name){
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function lawyerAvatarHtml(lawyer, size){
  const pic = lawyer && lawyer.profilePic;
  const name = (lawyer && lawyer.name) || t('lawyer');
  const sizeMod = size === 'sm' ? ' lawyer-avatar--sm'
    : (size === 'lg' ? ' lawyer-avatar--lg'
    : (size === 'admin' ? ' lawyer-avatar--admin' : ''));
  const inner = pic
    ? `<img src="${escapeHtml(pic)}" alt="${escapeHtml(name)}">`
    : escapeHtml(lawyerInitials(name));
  return `<div class="lawyer-avatar${sizeMod}">${inner}</div>`;
}

function renderLawyerRatingStars(avg, count, sizeClass, opts){
  const average = Number(avg) || 0;
  const n = Number(count) || 0;
  const mod = sizeClass ? ` lawyer-rating--${sizeClass}` : '';
  const hideCount = opts && opts.hideCount;
  if(!n && !hideCount){
    return `<div class="lawyer-rating lawyer-rating--empty${mod}" aria-hidden="true">${escapeHtml(t('noReviewsYet'))}</div>`;
  }
  if(hideCount){
    const r = Math.min(5, Math.max(1, Math.round(average)));
    let starsHtml = '';
    for(let i = 1; i <= 5; i++){
      starsHtml += `<span class="star ${i <= r ? 'star--full' : 'star--empty'}" aria-hidden="true">${i <= r ? '★' : '☆'}</span>`;
    }
    return `<span class="lawyer-rating lawyer-rating--inline${mod}">${starsHtml}</span>`;
  }
  const full = Math.floor(average);
  const half = average - full >= 0.35 && full < 5;
  let starsHtml = '';
  for(let i = 1; i <= 5; i++){
    if(i <= full) starsHtml += '<span class="star star--full" aria-hidden="true">★</span>';
    else if(i === full + 1 && half) starsHtml += '<span class="star star--half" aria-hidden="true">★</span>';
    else starsHtml += '<span class="star star--empty" aria-hidden="true">☆</span>';
  }
  const label = `${average} ${t('outOf5')}, ${n} ${t('reviewsCount')}`;
  return `<div class="lawyer-rating${mod}" role="img" aria-label="${escapeHtml(label)}">
    <span class="lawyer-rating-stars">${starsHtml}</span>
    <span class="lawyer-rating-value">${escapeHtml(String(average))}</span>
    <span class="lawyer-rating-count">(${escapeHtml(String(n))})</span>
  </div>`;
}

function lawyerAvatarWithRating(lawyer, size){
  const showRating = size !== 'sm';
  const ratingHtml = showRating
    ? renderLawyerRatingStars(lawyer.ratingAverage, lawyer.ratingCount, size === 'lg' ? 'lg' : '')
    : '';
  return `<div class="lawyer-avatar-block">${lawyerAvatarHtml(lawyer, size)}${ratingHtml}</div>`;
}

function ensureLawyerReviewModal(){
  if(document.getElementById('lawyerReviewModal')) return;
  const modal = document.createElement('div');
  modal.id = 'lawyerReviewModal';
  modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="modal-content lawyer-review-modal-content">
      <h3 id="lawyerReviewModalTitle">${escapeHtml(t('reviewLawyer'))}</h3>
      <p id="lawyerReviewModalSub" class="lawyer-review-modal-sub"></p>
      <div class="lawyer-review-stars-input" id="lawyerReviewStarsInput" role="group" aria-label="${escapeHtml(t('yourRating'))}">
        ${[1,2,3,4,5].map(n=>`<button type="button" class="review-star-btn" data-rating="${n}" onclick="setReviewStar(${n})" aria-label="${n} ${escapeHtml(t('rateStars'))}">☆</button>`).join('')}
      </div>
      <label for="lawyerReviewComment" class="lawyer-review-label">${escapeHtml(t('reviewComment'))}</label>
      <textarea id="lawyerReviewComment" rows="3" maxlength="2000" style="width:100%;margin:0 0 12px"></textarea>
      <div class="lawyer-review-modal-actions">
        <button type="button" class="full-btn" onclick="submitLawyerReview()">${escapeHtml(t('submitReview'))}</button>
        <button type="button" class="lawyer-review-cancel-btn" onclick="closeLawyerReviewModal()">${escapeHtml(t('close'))}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

let lawyerReviewDraft = { lawyerEmail: '', lawyerName: '', bookingId: '', rating: 0 };

function setReviewStar(n){
  lawyerReviewDraft.rating = n;
  document.querySelectorAll('#lawyerReviewStarsInput .review-star-btn').forEach(btn=>{
    const r = Number(btn.dataset.rating);
    btn.textContent = r <= n ? '★' : '☆';
    btn.classList.toggle('review-star-btn--active', r <= n);
  });
}

function openLawyerReviewModal(lawyerEmail, lawyerName, bookingId, existingRating){
  ensureLawyerReviewModal();
  lawyerReviewDraft = {
    lawyerEmail: String(lawyerEmail || '').toLowerCase(),
    lawyerName: lawyerName || '',
    bookingId: bookingId || '',
    rating: Number(existingRating) || 0
  };
  const modal = document.getElementById('lawyerReviewModal');
  const title = document.getElementById('lawyerReviewModalTitle');
  const sub = document.getElementById('lawyerReviewModalSub');
  const comment = document.getElementById('lawyerReviewComment');
  if(title) title.textContent = existingRating ? t('editReview') : t('reviewLawyer');
  if(sub) sub.textContent = lawyerName ? `${t('lawyer')}: ${lawyerName}` : '';
  if(comment) comment.value = '';
  setReviewStar(lawyerReviewDraft.rating || 0);
  if(modal) modal.classList.remove('hidden');
}

function closeLawyerReviewModal(){
  const modal = document.getElementById('lawyerReviewModal');
  if(modal) modal.classList.add('hidden');
  lawyerReviewDraft = { lawyerEmail: '', lawyerName: '', bookingId: '', rating: 0 };
}

async function submitLawyerReview(){
  const token = localStorage.getItem('lg_token');
  if(!token){ toast('Please log in to leave a review'); window.location.href = 'auth.html'; return; }
  if(!lawyerReviewDraft.lawyerEmail){ toast('Lawyer not found'); return; }
  const rating = lawyerReviewDraft.rating;
  if(!rating || rating < 1 || rating > 5){ toast(currentLang === 'ar' ? 'اختر من 1 إلى 5 نجوم' : 'Choose a rating from 1 to 5 stars'); return; }
  const comment = (document.getElementById('lawyerReviewComment') || {}).value || '';
  try{
    const response = await fetch(apiUrl('/api/lawyers/' + encodeURIComponent(lawyerReviewDraft.lawyerEmail) + '/reviews'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ rating, comment, bookingId: lawyerReviewDraft.bookingId })
    });
    const res = await parseApiResponse(response);
    if(res.ok){
      toast(t('reviewSaved'));
      closeLawyerReviewModal();
      const cached = lawyersCache.find(l => (l.email || '').toLowerCase() === lawyerReviewDraft.lawyerEmail);
      if(cached && res.stats){
        cached.ratingAverage = res.stats.ratingAverage;
        cached.ratingCount = res.stats.ratingCount;
      }
      if(document.getElementById('lawyersDirectory')) applyLawyerFilters();
      if(document.getElementById('lawyersPreview')) loadLawyers();
      reloadCurrentDashboard();
    } else {
      toast(res.error || 'Could not save review');
    }
  } catch(err){
    toast(err && err.message ? err.message : 'Network error');
  }
}

function fetchLawyerReviews(email){
  return fetch(apiUrl('/api/lawyers/' + encodeURIComponent(email) + '/reviews'))
    .then(r=>r.json())
    .then(res=> (res.ok ? res : { stats: { ratingAverage: 0, ratingCount: 0 }, reviews: [] }))
    .catch(()=>({ stats: { ratingAverage: 0, ratingCount: 0 }, reviews: [] }));
}

function renderLawyerReviewsList(reviews){
  if(!reviews || !reviews.length){
    return `<p class="lawyer-profile-section-text lawyer-profile-section-text--muted">${escapeHtml(t('noReviewsYet'))}</p>`;
  }
  return `<ul class="lawyer-reviews-list">${reviews.slice(0, 10).map(r=>`
    <li class="lawyer-review-item">
      <div class="lawyer-review-item-head">
        ${renderLawyerRatingStars(r.rating, 1, 'inline', { hideCount: true })}
        <strong>${escapeHtml(r.userName || 'Client')}</strong>
      </div>
      ${r.comment ? `<p class="lawyer-review-item-text">${escapeHtml(r.comment)}</p>` : ''}
    </li>`).join('')}</ul>`;
}

function formatBookingStatus(status){
  const k = String(status || 'pending').toLowerCase();
  if(k === 'accepted') return t('statusAccepted');
  if(k === 'cancelled') return t('statusCancelled');
  if(k === 'declined') return t('statusDeclined');
  return t('statusPending');
}

function formatCancelledAppointmentDetail(b){
  const who = b.lawyer || b.name || t('lawyer');
  return `${who} ${t('onDate')} ${b.date || '-'} ${t('atTime')} ${b.time || '-'}`;
}

function updateAppointmentStatusMsg(bookings){
  const statusMsg = document.getElementById('appointmentStatusMsg');
  if(!statusMsg) return;
  const cancelled = (bookings || []).filter(b => (b.status || '').toLowerCase() === 'cancelled');
  if(!cancelled.length){
    statusMsg.classList.add('hidden');
    statusMsg.textContent = '';
    return;
  }
  const latest = cancelled.slice(-3).reverse();
  const details = latest.map(formatCancelledAppointmentDetail).join(' | ');
  statusMsg.textContent = cancelled.length === 1
    ? `${t('apptCancelledOne')}: ${details}`
    : t('apptCancelledMany').replace('{count}', String(cancelled.length)).replace('{details}', details);
  statusMsg.classList.remove('hidden');
}

function joinAppointmentCards(cards){
  return cards.filter(Boolean).join('<div class="appointment-divider" role="separator"></div>');
}

function formatLawyerGender(g){
  const v = String(g || '').toLowerCase();
  if(v === 'male') return t('genderMale');
  if(v === 'female') return t('genderFemale');
  return '';
}

function formatPriceRange(lawyer){
  const lo = Number(lawyer && (lawyer.feeMin != null ? lawyer.feeMin : lawyer.consultationFee));
  const hi = Number(lawyer && lawyer.feeMax);
  const min = Number.isFinite(lo) && lo >= 0 ? Math.round(lo) : null;
  const max = Number.isFinite(hi) && hi >= 0 ? Math.round(hi) : null;
  if(min !== null && max !== null && max > min) return `${min} – ${max} EGP`;
  if(min !== null) return `From ${min} EGP`;
  if(max !== null) return `Up to ${max} EGP`;
  return t('feeOnRequest');
}

function formatYearsExperience(years){
  const y = parseInt(years, 10);
  if(!Number.isFinite(y) || y < 0) return '';
  if(currentLang === 'ar') return `${y} ${y === 1 ? 'سنة' : 'سنوات'}`;
  return `${y} ${y === 1 ? 'year' : t('yearsExp')}`;
}

function formatConsultationDuration(minutes){
  const m = parseInt(minutes, 10);
  if(!Number.isFinite(m) || m <= 0) return '';
  if(currentLang === 'ar') return `${m} ${t('minutesShort')}`;
  return `${m} ${t('minutesShort')}`;
}

function formatMeetingType(type){
  const v = String(type || '').toLowerCase();
  if(v === 'online') return t('meetingOnline');
  if(v === 'in_person') return t('meetingInPerson');
  return '';
}

function formatBookingOptionsList(opts){
  const list = Array.isArray(opts) ? opts : [];
  return list.map(formatMeetingType).filter(Boolean);
}

function lawyerProfilePageUrl(email){
  return `lawyer-profile.html?email=${encodeURIComponent(String(email || '').trim().toLowerCase())}`;
}

function formatConsultationFee(fee){
  return formatPriceRange({ feeMin: fee, feeMax: null });
}

function syncLocalUser(user){
  if(!user) return;
  const prev = getCurrentUserObj() || {};
  const merged = {
    ...prev,
    ...user,
    email: user.email || prev.email,
    name: user.name || prev.name,
    role: user.role || prev.role,
    phone: user.phone !== undefined ? user.phone : prev.phone,
    location: user.location !== undefined ? user.location : prev.location,
    yearsOfExperience: user.yearsOfExperience !== undefined ? user.yearsOfExperience : prev.yearsOfExperience,
    consultationDuration: user.consultationDuration !== undefined ? user.consultationDuration : prev.consultationDuration,
    bookingOptions: user.bookingOptions !== undefined ? user.bookingOptions : prev.bookingOptions,
    lawyerStatus: user.lawyerStatus !== undefined ? user.lawyerStatus : prev.lawyerStatus,
    rejectionReason: user.rejectionReason !== undefined ? user.rejectionReason : prev.rejectionReason
  };
  if(merged.email) localStorage.setItem('lg_user', merged.email);
  localStorage.setItem('lg_user_obj', JSON.stringify(merged));
}

function patchLawyerInCacheFromUser(u){
  if(!u || !u.email) return;
  const key = String(u.email).toLowerCase();
  const patch = {
    email: u.email,
    name: u.name,
    phone: u.phone || '',
    location: u.location || '',
    yearsOfExperience: u.yearsOfExperience != null ? u.yearsOfExperience : null,
    consultationDuration: u.consultationDuration != null ? u.consultationDuration : null,
    bookingOptions: Array.isArray(u.bookingOptions) ? u.bookingOptions : [],
    specialty: u.specialty,
    description: u.description,
    practiceDetails: u.practiceDetails,
    gender: u.gender,
    feeMin: u.feeMin,
    feeMax: u.feeMax,
    availabilitySlots: u.availabilitySlots
  };
  const idx = lawyersCache.findIndex(l => (l.email || '').toLowerCase() === key);
  if(idx >= 0) lawyersCache[idx] = { ...lawyersCache[idx], ...patch };
}

function collectLawyerPublicMetaFromForm(includeAvailability){
  const expRaw = String((document.getElementById('profileLawyerExperience') || {}).value || '').trim();
  const durationRaw = String((document.getElementById('profileConsultationDuration') || {}).value || '').trim();
  const bookingOptions = [];
  if((document.getElementById('profileBookingOnline') || {}).checked) bookingOptions.push('online');
  if((document.getElementById('profileBookingInPerson') || {}).checked) bookingOptions.push('in_person');
  const body = {
    phone: ((document.getElementById('profileLawyerPhone') || {}).value || '').trim(),
    location: ((document.getElementById('profileLawyerLocation') || {}).value || '').trim(),
    yearsOfExperience: expRaw === '' ? '' : parseInt(expRaw, 10),
    consultationDuration: durationRaw ? parseInt(durationRaw, 10) : '',
    bookingOptions
  };
  if(includeAvailability){
    const availability = (document.getElementById('availabilityInput') || {}).value || '';
    body.availability = availability;
    body.availabilitySlots = availability.split(/[,;\n\r]+/).map(s=>s.trim()).filter(Boolean);
    body.documents = lawyerDocumentsCache;
  }
  return body;
}

function validateLawyerPublicForm(){
  const expRaw = String((document.getElementById('profileLawyerExperience') || {}).value || '').trim();
  if(expRaw !== ''){
    const y = parseInt(expRaw, 10);
    if(!Number.isFinite(y) || y < 0 || y > 80){
      toast('Years of experience must be a number between 0 and 80');
      return false;
    }
  }
  return true;
}

function showServerOutdatedNotice(show){
  const box = document.getElementById('serverOutdatedNotice');
  if(!box) return;
  box.classList.toggle('hidden', !show);
}

function checkServerProfileFields(){
  return fetch(apiUrl('/api/health'))
    .then(r=>r.json())
    .then(res=>{
      const ok = res && res.ok && res.profileFieldsVersion >= 2;
      showServerOutdatedNotice(!ok);
      return ok;
    })
    .catch(()=>{
      showServerOutdatedNotice(true);
      return false;
    });
}

async function putLawyerProfile(body){
  const token = localStorage.getItem('lg_token');
  if(!token) throw new Error('Not authenticated');
  const response = await fetch(apiUrl('/api/lawyer/profile'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body)
  });
  return parseApiResponse(response);
}

function getDashboardHref(){
  const role = getCurrentRole();
  if(role.startsWith('admin')) return 'admin.html';
  if(role.startsWith('law')) return 'lawyer-dashboard.html';
  return 'user-dashboard.html';
}

function updateAuthMenu(){
  const loginLink = document.getElementById('loginNavLink');
  const signupLink = document.getElementById('signupNavLink');
  const dashLink = document.getElementById('navDashboardLink');
  const logoutLink = document.getElementById('navLogoutLink');
  const accountWrap = document.getElementById('accountMenuWrap');
  const token = localStorage.getItem('lg_token');
  const isLoggedIn = !!token;

  if(loginLink){
    if(isLoggedIn) loginLink.classList.add('hidden');
    else loginLink.classList.remove('hidden');
  }
  if(signupLink){
    if(isLoggedIn) signupLink.classList.add('hidden');
    else signupLink.classList.remove('hidden');
  }
  if(dashLink){
    if(isLoggedIn){
      dashLink.classList.remove('hidden');
      dashLink.href = getDashboardHref();
      dashLink.textContent = t('dashboard');
    } else {
      dashLink.classList.add('hidden');
    }
  }
  if(logoutLink){
    if(isLoggedIn){
      logoutLink.classList.remove('hidden');
      logoutLink.textContent = t('logout');
    } else {
      logoutLink.classList.add('hidden');
    }
  }
  if(accountWrap){
    if(isLoggedIn) accountWrap.classList.remove('hidden');
    else accountWrap.classList.add('hidden');
  }
}

function guardDashboardRole(expected){
  const token = localStorage.getItem('lg_token');
  if(!token){
    window.location.href = 'auth.html';
    return false;
  }
  const role = getCurrentRole();
  if(expected === 'user'){
    if(role.startsWith('admin')){ window.location.href = 'admin.html'; return false; }
    if(role.startsWith('law')){ window.location.href = 'lawyer-dashboard.html'; return false; }
  }
  if(expected === 'lawyer'){
    if(role.startsWith('admin')){ window.location.href = 'admin.html'; return false; }
    if(!role.startsWith('law')){ window.location.href = 'user-dashboard.html'; return false; }
  }
  return true;
}

function applyDashboardHash(){
  const id = (location.hash || '').replace('#','').trim();
  if(!id || !document.getElementById(id)) return;
  showSection(id);
}

function reloadCurrentDashboard(){
  const dash = document.body && document.body.dataset && document.body.dataset.dash;
  if(dash === 'user') loadUserDashboard();
  else if(dash === 'lawyer') loadLawyerDashboard();
  else if(document.getElementById('userAppointmentsList')) loadUserDashboard();
  else if(document.getElementById('lawyerBookingsList')) loadLawyerDashboard();
}

function isLawyerRole(role){
  return String(role || '').toLowerCase().startsWith('law');
}

function populateSpecialtySelect(selectEl, includeAll){
  if(!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = '';
  if(includeAll){
    const o = document.createElement('option');
    o.value = '';
    o.textContent = t('allSpecialties');
    selectEl.appendChild(o);
  }
  PERSONAL_STATUS_SPECIALTIES.forEach(s=>{
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = translateSpecialtyName(s);
    selectEl.appendChild(opt);
  });
  if(current) selectEl.value = current;
}

function renderLawyerCard(l, options){
  const compact = options && options.compact;
  const canBook = options && options.canBook;
  const slots = Array.isArray(l.availabilitySlots) ? l.availabilitySlots.length : 0;
  const genderLabel = formatLawyerGender(l.gender);
  const desc = escapeHtml((l.description || '').trim() || (l.practiceDetails || '').trim().slice(0, 120) || t('noDescription'));
  const fee = formatPriceRange(l);
  const slotsLabel = slots ? `${slots} ${slots === 1 ? t('openSlot') : t('openSlots')}` : t('noSlotsYet');
  const bookBtn = canBook && slots
    ? `<button type="button" class="book-btn" onclick="openBookingWithEmail('${escapeJs(l.name)}','${escapeJs(l.email)}')">${escapeHtml(t('book'))}</button>`
    : (canBook ? `<button type="button" disabled title="${escapeHtml(t('noSlotsYet'))}">${escapeHtml(t('book'))}</button>` : '');
  const expLabel = l.yearsOfExperience != null ? formatYearsExperience(l.yearsOfExperience) : '';
  const locBrief = (l.location || '').trim();
  const briefMeta = (expLabel || locBrief)
    ? `<div class="lawyer-card-brief-meta">${expLabel ? `<span>${escapeHtml(expLabel)}</span>` : ''}${locBrief ? `<span>📍 ${escapeHtml(locBrief)}</span>` : ''}</div>`
    : '';
  const viewBtn = `<a href="${escapeHtml(lawyerProfilePageUrl(l.email))}" class="lawyer-view-profile-link" style="background:#E4D9CC;color:#2C2419;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:999px;font-weight:600;font-size:14px;flex:1;min-width:100px">${escapeHtml(t('viewProfile'))}</a>`;

  return `
    <article class="lawyer-card-pro ${compact ? 'lawyer-card-compact' : ''}">
      <div class="lawyer-card-head">
        ${lawyerAvatarWithRating(l)}
        <div class="lawyer-card-meta">
          <h3>${escapeHtml(l.name)}</h3>
          <div class="lawyer-card-tags">
            <span class="lawyer-tag">${escapeHtml(translateSpecialtyName(l.specialty || 'General Personal Status'))}</span>
            ${genderLabel ? `<span class="lawyer-tag">${escapeHtml(genderLabel)}</span>` : ''}
          </div>
          ${briefMeta}
        </div>
      </div>
      ${compact ? '' : `<p class="lawyer-card-desc">${desc}</p>`}
      <div class="lawyer-card-foot">
        <span class="lawyer-fee">${escapeHtml(fee)}</span>
        <span class="lawyer-slots-hint">${escapeHtml(slotsLabel)}</span>
      </div>
      <div class="lawyer-card-actions">
        ${viewBtn}
        ${bookBtn}
      </div>
    </article>
  `;
}

function buildLawyerFiltersQuery(){
  const specialty = ((document.getElementById('filterSpecialty') || {}).value || '').trim();
  const gender = ((document.getElementById('filterGender') || {}).value || '').trim();
  const minPrice = ((document.getElementById('filterMinPrice') || {}).value || '').trim();
  const maxPrice = ((document.getElementById('filterMaxPrice') || {}).value || '').trim();
  const q = new URLSearchParams();
  if(specialty) q.set('specialty', specialty);
  if(gender) q.set('gender', gender);
  if(minPrice) q.set('minPrice', minPrice);
  if(maxPrice) q.set('maxPrice', maxPrice);
  const s = q.toString();
  return s ? `?${s}` : '';
}

function fetchLawyersList(query){
  return fetch(apiUrl('/api/lawyers' + (query || '')))
    .then(r=>r.json())
    .then(res=>{
      if(!res.ok || !Array.isArray(res.lawyers)) return [];
      lawyersCache = res.lawyers;
      return res.lawyers;
    })
    .catch(()=>[]);
}

function renderLawyersInto(container, lawyers, options){
  if(!container) return;
  const canBook = options && options.canBook;
  if(!lawyers.length){
    container.innerHTML = `<p class="lawyers-empty">${escapeHtml(t('noLawyersMatch'))}</p>`;
    return;
  }
  container.innerHTML = lawyers.map(l => renderLawyerCard(l, { compact: options && options.compact, canBook })).join('');
}

function initLawyersPage(){
  const specialtySel = document.getElementById('filterSpecialty');
  populateSpecialtySelect(specialtySel, true);
  checkServerProfileFields();
  fetch(apiUrl('/api/lawyers/meta')).then(r=>r.json()).then(res=>{
    if(res.ok && Array.isArray(res.specialties) && res.specialties.length){
      PERSONAL_STATUS_SPECIALTIES.length = 0;
      res.specialties.forEach(s=>PERSONAL_STATUS_SPECIALTIES.push(s));
      populateSpecialtySelect(specialtySel, true);
    }
  }).catch(()=>{});
  applyLawyerFilters();
}

function applyLawyerFilters(){
  const grid = document.getElementById('lawyersDirectory');
  if(!grid) return;
  grid.innerHTML = `<p class="lawyers-empty">${escapeHtml(t('loadingLawyers'))}</p>`;
  fetchLawyersList(buildLawyerFiltersQuery()).then(lawyers=>{
    renderLawyersInto(grid, lawyers, { canBook: !isLawyerOrAdmin() });
  });
}

function resetLawyerFilters(){
  ['filterSpecialty','filterGender','filterMinPrice','filterMaxPrice'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  applyLawyerFilters();
}

function renderLawyerProfilePage(l){
  const slots = Array.isArray(l.availabilitySlots) ? l.availabilitySlots : [];
  const desc = String(l.description || '').trim();
  const practice = String(l.practiceDetails || '').trim();
  const gender = formatLawyerGender(l.gender) || t('genderNotSpecified');
  const fee = formatPriceRange(l);
  const specialty = translateSpecialtyName(l.specialty || 'General Personal Status');
  const phone = String(l.phone || '').trim();
  const location = String(l.location || '').trim();
  const exp = l.yearsOfExperience != null ? formatYearsExperience(l.yearsOfExperience) : '';
  const duration = l.consultationDuration ? formatConsultationDuration(l.consultationDuration) : '';
  const bookingOpts = formatBookingOptionsList(l.bookingOptions);
  const slotsLabel = slots.length
    ? `${slots.length} ${slots.length === 1 ? t('openSlot') : t('openSlots')}`
    : t('noSlotsYet');
  const brief = desc || practice.slice(0, 200) || t('noDescription');
  const notProvided = t('notProvided');

  const stat = (label, value, isHtml) => `
    <div class="lawyer-profile-page-stat">
      <dt>${escapeHtml(label)}</dt>
      <dd>${isHtml ? value : escapeHtml(value || notProvided)}</dd>
    </div>`;

  const phoneCell = phone
    ? `<a href="tel:${encodeURIComponent(phone.replace(/\s/g, ''))}">${escapeHtml(phone)}</a>`
    : notProvided;

  const bookingList = bookingOpts.length
    ? `<ul class="lawyer-profile-page-options">${bookingOpts.map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ul>`
    : `<p>${escapeHtml(t('noBookingOptions'))}</p>`;

  const slotList = slots.length
    ? `<ul class="lawyer-profile-slot-list">${slots.map(s => `<li>${escapeHtml(String(s))}</li>`).join('')}</ul>`
    : `<p class="lawyer-profile-section-text--muted">${escapeHtml(t('noSlotsYet'))}</p>`;

  const practiceBlock = practice && practice !== desc
    ? `<section class="lawyer-profile-page-block"><h2>${escapeHtml(t('practiceDetails'))}</h2><p>${escapeHtml(practice)}</p></section>`
    : '';

  const reviewsSection = l._reviewsHtml
    ? `<section class="lawyer-profile-page-block"><h2>${escapeHtml(t('clientReviews'))}</h2>${l._reviewsHtml}</section>`
    : '';

  const canBook = slots.length && !isLawyerOrAdmin();
  const reviewBtnId = 'lawyerPageReviewBtn';

  return `
    <article class="lawyer-profile-page-card">
      <header class="lawyer-profile-page-hero">
        ${lawyerAvatarWithRating(l, 'lg')}
        <div>
          <h1 class="lawyer-profile-page-title">${escapeHtml(l.name || t('lawyer'))}</h1>
          <p class="lawyer-profile-page-sub">${escapeHtml(specialty)} · ${escapeHtml(gender)}</p>
          <p class="lawyer-profile-page-brief">${escapeHtml(brief)}</p>
        </div>
      </header>
      <div class="lawyer-profile-page-body">
        <dl class="lawyer-profile-page-grid">
          ${stat(t('phoneLabelProfile'), phoneCell, true)}
          ${stat(t('experienceLabel'), exp || notProvided)}
          ${stat(t('consultationDurationLabel'), duration || notProvided)}
          ${stat(t('locationLabel'), location || notProvided)}
          ${stat(t('priceRangeLabel'), fee)}
          ${stat(t('profileAvailability'), slotsLabel)}
        </dl>
        <section class="lawyer-profile-page-block">
          <h2>${escapeHtml(t('bookingOptionsLabel'))}</h2>
          ${bookingList}
        </section>
        ${desc ? `<section class="lawyer-profile-page-block"><h2>${escapeHtml(t('shortDesc'))}</h2><p>${escapeHtml(desc)}</p></section>` : ''}
        ${practiceBlock}
        <section class="lawyer-profile-page-block">
          <h2>${escapeHtml(t('profileAvailability'))}</h2>
          ${slotList}
        </section>
        ${reviewsSection}
        <div class="lawyer-profile-page-actions">
          <button type="button" id="${reviewBtnId}" class="hidden appointment-btn appointment-btn--review">${escapeHtml(t('reviewLawyer'))}</button>
          <button type="button" id="lawyerPageBookBtn" class="full-btn" ${canBook ? '' : 'disabled'}>${escapeHtml(t('bookConsultation'))}</button>
        </div>
      </div>
    </article>`;
}

let lawyerProfilePageToken = 0;

function viewLawyerProfile(email){
  window.location.href = lawyerProfilePageUrl(email);
}

function initLawyerProfilePage(){
  const root = document.getElementById('lawyerProfilePageRoot');
  if(!root) return;
  const params = new URLSearchParams(window.location.search);
  const emailKey = String(params.get('email') || '').trim().toLowerCase();
  if(!emailKey){
    root.innerHTML = `<p class="lawyers-empty">${escapeHtml(t('noLawyersMatch'))}</p>`;
    return;
  }
  const openToken = ++lawyerProfilePageToken;
  root.innerHTML = `<p class="lawyers-empty">${escapeHtml(t('loadingLawyers'))}</p>`;

  const profileHeaders = {};
  const token = localStorage.getItem('lg_token');
  if(token) profileHeaders.Authorization = 'Bearer ' + token;
  const lawyerReq = fetch(apiUrl('/api/lawyers/' + encodeURIComponent(emailKey)), { headers: profileHeaders })
    .then(r => r.json())
    .catch(() => ({ ok: false }));
  const reviewsReq = fetchLawyerReviews(emailKey);

  Promise.all([lawyerReq, reviewsReq])
  .then(([lawRes, revRes])=>{
    if(openToken !== lawyerProfilePageToken) return;
    if(!lawRes.ok || !lawRes.lawyer){
      root.innerHTML = `<p class="lawyers-empty">${escapeHtml(lawRes.error || 'Lawyer not found')}</p>`;
      return;
    }
    const l = lawRes.lawyer;
    if(revRes.stats){
      l.ratingAverage = revRes.stats.ratingAverage;
      l.ratingCount = revRes.stats.ratingCount;
    }
    l._reviewsHtml = renderLawyerReviewsList(revRes.reviews || []);
    lawyerProfilePageTarget = l;
    root.innerHTML = renderLawyerProfilePage(l);
    document.title = `${l.name || 'Lawyer'} | LegalGuide`;
    const bookBtn = document.getElementById('lawyerPageBookBtn');
    if(bookBtn){
      bookBtn.onclick = () => openBookingWithEmail(l.name, l.email);
    }
    updateLawyerProfilePageReviewBtn(l);
    preloadClientBookingsIfLoggedIn().then(()=>{
      if(openToken !== lawyerProfilePageToken || !lawyerProfilePageTarget) return;
      if((lawyerProfilePageTarget.email || '').toLowerCase() === emailKey){
        updateLawyerProfilePageReviewBtn(lawyerProfilePageTarget);
      }
    });
  })
  .catch(()=>{
    root.innerHTML = `<p class="lawyers-empty">${escapeHtml(t('noLawyersMatch'))}</p>`;
  });
}

function closeLawyerProfileModal(){}

function showBookingLawyerCard(lawyer){
  const card = document.getElementById('bookingLawyerCard');
  if(!card || !lawyer) return;
  card.classList.remove('hidden');
  card.innerHTML = `
    ${lawyerAvatarWithRating(lawyer, 'sm')}
    <div>
      <div style="font-weight:700">${escapeHtml(lawyer.name)}</div>
      <div style="font-size:13px;color:#6B5E50">${escapeHtml(lawyer.specialty || '')}${lawyer.gender ? ' · ' + escapeHtml(formatLawyerGender(lawyer.gender)) : ''}</div>
      <div style="font-size:13px;font-weight:600;color:#6B5344;margin-top:2px">${escapeHtml(formatPriceRange(lawyer))}</div>
    </div>
  `;
}

function hideBookingLawyerCard(){
  const card = document.getElementById('bookingLawyerCard');
  if(card){ card.classList.add('hidden'); card.innerHTML = ''; }
}

function findLawyerInCache(email){
  return lawyersCache.find(l => String(l.email || '').toLowerCase() === String(email || '').toLowerCase());
}

function lawyerFromBooking(b){
  if(!b) return null;
  const cached = findLawyerInCache(b.lawyerEmail);
  return {
    name: b.lawyer,
    email: b.lawyerEmail,
    profilePic: b.lawyerProfilePic || '',
    specialty: b.lawyerSpecialty || '',
    gender: b.lawyerGender || '',
    consultationFee: b.lawyerConsultationFee,
    ratingAverage: cached ? cached.ratingAverage : 0,
    ratingCount: cached ? cached.ratingCount : 0
  };
}

function renderAppointmentActions(buttons){
  const html = (buttons || []).filter(Boolean).join('');
  if(!html) return '';
  return `<div class="appointment-actions">${html}</div>`;
}

let clientBookingsPreloadPromise = null;

function preloadClientBookingsIfLoggedIn(){
  const token = localStorage.getItem('lg_token');
  const role = String(getCurrentRole() || '').toLowerCase();
  if(!token || role.startsWith('law') || role.startsWith('admin')) return Promise.resolve();
  if(clientBookingsPreloadPromise) return clientBookingsPreloadPromise;
  clientBookingsPreloadPromise = fetch(apiUrl('/api/bookings'), {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(r => r.json())
    .then(res => {
      if(res.ok) chatBookingsCache = res.bookings || [];
    })
    .catch(() => {});
  return clientBookingsPreloadPromise;
}

function getReviewableBookings(bookings){
  return (bookings || []).filter(b =>
    (b.status || '').toLowerCase() === 'accepted' && b.canReview !== false
  );
}

function renderUserReviewPrompt(bookings){
  const el = document.getElementById('userReviewPrompt');
  if(!el) return;
  const reviewable = getReviewableBookings(bookings);
  if(!reviewable.length){
    el.innerHTML = `<div class="review-prompt-box review-prompt-box--info">
      <h3 class="review-prompt-title">${escapeHtml(t('reviewPromptTitle'))}</h3>
      <p class="review-prompt-hint">${escapeHtml(t('reviewPromptHint'))}</p>
    </div>`;
    return;
  }
  const items = reviewable.map(b => {
    const label = b.hasReview ? t('editReview') : t('reviewLawyer');
    return `<div class="review-prompt-item">
      <span class="review-prompt-item-label">${escapeHtml(b.lawyer)} — ${escapeHtml(b.date)} ${escapeHtml(b.time)}</span>
      <button type="button" class="appointment-btn appointment-btn--review" onclick="openLawyerReviewModal('${escapeJs(b.lawyerEmail)}','${escapeJs(b.lawyer)}','${escapeJs(b.id)}',${b.userReviewRating || 0})">${escapeHtml(label)}</button>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="review-prompt-box">
    <h3 class="review-prompt-title">${escapeHtml(t('reviewPromptTitle'))}</h3>
    <p class="review-prompt-hint">${escapeHtml(t('reviewPromptReady'))}</p>
    <div class="review-prompt-list">${items}</div>
  </div>`;
}

function getReviewableBookingForLawyer(email){
  const target = String(email || '').toLowerCase();
  return (chatBookingsCache || []).find(b =>
    (b.lawyerEmail || '').toLowerCase() === target &&
    (b.status || '').toLowerCase() === 'accepted'
  ) || null;
}

function updateLawyerProfilePageReviewBtn(lawyer){
  const btn = document.getElementById('lawyerPageReviewBtn');
  if(!btn || !lawyer) return;
  const role = String(getCurrentRole() || '').toLowerCase();
  if(!localStorage.getItem('lg_token') || role.startsWith('law') || role.startsWith('admin')){
    btn.classList.add('hidden');
    return;
  }
  const booking = getReviewableBookingForLawyer(lawyer.email);
  if(!booking){
    btn.classList.add('hidden');
    return;
  }
  btn.classList.remove('hidden');
  btn.textContent = booking.hasReview ? t('editReview') : t('reviewLawyer');
  btn.onclick = () => {
    openLawyerReviewModal(lawyer.email, lawyer.name, booking.id, booking.userReviewRating || 0);
  };
}

function renderUserBookingCard(b){
  const lawyer = lawyerFromBooking(b);
  const sub = [lawyer.specialty, formatLawyerGender(lawyer.gender)].filter(Boolean).join(' · ');
  const st = String(b.status || 'pending').toLowerCase();
  const statusClass = st === 'cancelled' ? ' appointment-status--cancelled' : (st === 'accepted' ? ' appointment-status--accepted' : '');
  const actionBtns = [
    `<button type="button" class="appointment-btn appointment-btn--chat" onclick="openAppointmentChat('${b.id}','${escapeJs(b.lawyer)}')">${escapeHtml(t('chatBtn'))}</button>`
  ];
  if(st === 'pending' || st === 'accepted'){
    actionBtns.push(`<button type="button" class="appointment-btn appointment-btn--cancel" onclick="cancelBooking('${b.id}')">${escapeHtml(t('cancelAppt'))}</button>`);
  }
  if(b.canReview){
    const reviewLabel = b.hasReview ? t('editReview') : t('reviewLawyer');
    actionBtns.push(`<button type="button" class="appointment-btn appointment-btn--review" onclick="openLawyerReviewModal('${escapeJs(b.lawyerEmail)}','${escapeJs(b.lawyer)}','${escapeJs(b.id)}',${b.userReviewRating || 0})">${escapeHtml(reviewLabel)}</button>`);
  }
  return `<article class="appointment-card booking-item">
    <div class="appointment-card-inner">
      ${lawyerAvatarWithRating(lawyer, 'sm')}
      <div class="appointment-card-body">
        <strong>${escapeHtml(b.lawyer)}</strong> — ${escapeHtml(b.date)} ${escapeHtml(b.time)}
        ${sub ? `<div class="appointment-meta">${escapeHtml(sub)}</div>` : ''}
        ${b.note ? `<div class="appointment-note">${escapeHtml(b.note)}</div>` : ''}
        <div class="appointment-status${statusClass}">${escapeHtml(t('status'))}: ${escapeHtml(formatBookingStatus(b.status))}</div>
        ${renderAppointmentActions(actionBtns)}
      </div>
    </div>
  </article>`;
}

function renderLawyerBookingCard(b){
  const st = String(b.status || 'pending').toLowerCase();
  const statusClass = st === 'cancelled' ? ' appointment-status--cancelled' : (st === 'accepted' ? ' appointment-status--accepted' : '');
  const actionBtns = [
    `<button type="button" class="appointment-btn appointment-btn--chat" onclick="openAppointmentChat('${b.id}','${escapeJs(b.name)}')">${escapeHtml(t('chatBtn'))}</button>`
  ];
  if(st === 'pending'){
    actionBtns.push(`<button type="button" class="appointment-btn appointment-btn--confirm" onclick="acceptBooking('${b.id}')">${escapeHtml(t('confirm'))}</button>`);
    actionBtns.push(`<button type="button" class="appointment-btn appointment-btn--cancel" onclick="cancelByLawyer('${b.id}')">${escapeHtml(t('cancel'))}</button>`);
  }
  return `<article class="appointment-card booking-item">
    <div class="appointment-card-inner">
      <div class="appointment-card-body appointment-card-body--full">
        <strong>${escapeHtml(b.name)}</strong> (${escapeHtml(b.email)}) — ${escapeHtml(b.date)} ${escapeHtml(b.time)}
        ${b.note ? `<div class="appointment-note">${escapeHtml(b.note)}</div>` : ''}
        <div class="appointment-status${statusClass}">${escapeHtml(t('status'))}: ${escapeHtml(formatBookingStatus(b.status))}</div>
        ${renderAppointmentActions(actionBtns)}
      </div>
    </div>
  </article>`;
}

function updateChatPartnerCard(lawyerOrBooking){
  const card = document.getElementById('chatPartnerCard');
  if(!card) return;
  let lawyer = null;
  if(lawyerOrBooking && lawyerOrBooking.profilePic !== undefined){
    lawyer = lawyerOrBooking;
  } else if(lawyerOrBooking && lawyerOrBooking.lawyerEmail){
    lawyer = {
      name: lawyerOrBooking.lawyer,
      profilePic: lawyerOrBooking.lawyerProfilePic || '',
      specialty: lawyerOrBooking.lawyerSpecialty || '',
      gender: lawyerOrBooking.lawyerGender || '',
      consultationFee: lawyerOrBooking.lawyerConsultationFee
    };
  }
  if(!lawyer || !lawyer.name){
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  card.innerHTML = `
    ${lawyerAvatarHtml(lawyer)}
    <div>
      <div style="font-weight:700">${escapeHtml(lawyer.name)}</div>
      <div style="font-size:13px;color:#6B5E50">${escapeHtml(lawyer.specialty || '')}</div>
    </div>
  `;
}
let currentUserEmail = '';
let chatBookingsCache = [];
let chatUnreadMap = {};
let chatUnreadLastNotified = {};
let dashboardPollTimer = null;
let currentConversationKey = '';
let aiChatHistory = [];
let aiChatSending = false;
let aiConversationsStore = [];
let currentAiConversationId = null;
const AI_GUEST_STORAGE_KEY = 'lg_ai_guest_conversations';

function toggleLang(){
  setLanguage(currentLang==="en"?"ar":"en");
}

function setLanguage(lang){
  currentLang=lang;
  localStorage.setItem("lang",lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-key]').forEach(el=>{
    const val = dict[lang][el.dataset.key];
    if(val == null) return;
    if(el.tagName === 'OPTION') el.textContent = val;
    else el.textContent = val;
  });

  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.getAttribute('data-i18n');
    const val = dict[lang][key];
    if(val == null) return;
    if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){
      if(el.hasAttribute('placeholder')) el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });

  document.querySelectorAll('[data-i18n-label]').forEach(el=>{
    const key = el.getAttribute('data-i18n-label');
    const val = dict[lang][key];
    if(val != null) el.textContent = val;
  });

  const s = document.getElementById('searchInput');
  const sb = document.getElementById('searchBtn');
  if(s) s.placeholder = dict[lang].searchPlaceholder || '';
  if(sb) sb.innerText = dict[lang].searchButton || '';

  document.querySelectorAll('[data-placeholder-key]').forEach(el=>{
    const key = el.getAttribute('data-placeholder-key');
    if(key && dict[lang][key]) el.setAttribute('placeholder', dict[lang][key]);
  });

  if(document.body.dataset.titleKey && dict[lang][document.body.dataset.titleKey]){
    document.title = dict[lang][document.body.dataset.titleKey];
  }

  document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const genderSel = document.getElementById('profileLawyerGender');
  if(genderSel){
    const opts = genderSel.querySelectorAll('option');
    if(opts[0]) opts[0].textContent = t('preferNotSay');
    if(opts[1]) opts[1].textContent = t('genderMale');
    if(opts[2]) opts[2].textContent = t('genderFemale');
  }
  const filterGender = document.getElementById('filterGender');
  if(filterGender){
    const opts = filterGender.querySelectorAll('option');
    if(opts[0]) opts[0].textContent = t('anyGender');
    if(opts[1]) opts[1].textContent = t('genderMale');
    if(opts[2]) opts[2].textContent = t('genderFemale');
  }
  ['filterSpecialty', 'profileLawyerSpecialty', 'signupSpecialty'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) populateSpecialtySelect(el, id === 'filterSpecialty');
  });
  renderLawyerRejectionNotice();
  refreshDynamicTranslations();
  if(typeof AiVoiceInput !== 'undefined') AiVoiceInput.refreshLabels();
}

function refreshDynamicTranslations(){
  if(document.getElementById('lawyersDirectory')){
    const grid = document.getElementById('lawyersDirectory');
    if(grid && grid.querySelector('.lawyer-card-pro')) applyLawyerFilters();
  }
  if(document.getElementById('lawyersPreview')){
    loadLawyers();
  }
  if(document.getElementById('userAppointmentsList') || document.getElementById('lawyerBookingsList')){
    if(chatBookingsCache.length){
      updateAppointmentStatusMsg(chatBookingsCache);
      renderUserReviewPrompt(chatBookingsCache);
      const userList = document.getElementById('userAppointmentsList');
      if(userList){
        const active = chatBookingsCache.filter(b => (b.status || '').toLowerCase() !== 'cancelled');
        if(!active.length) userList.innerHTML = `<p class="appointments-empty">${escapeHtml(t('noAppointments'))}</p>`;
        else userList.innerHTML = joinAppointmentCards(active.map(b => renderUserBookingCard(b)));
      }
      const lawyerList = document.getElementById('lawyerBookingsList');
      if(lawyerList && lawyerList.closest('[data-dash="lawyer"]')){
        if(!chatBookingsCache.length) lawyerList.innerHTML = `<p class="appointments-empty">${escapeHtml(t('noBookings'))}</p>`;
        else lawyerList.innerHTML = joinAppointmentCards(chatBookingsCache.map(b => renderLawyerBookingCard(b)));
      }
    } else {
      reloadCurrentDashboard();
    }
  }
  if(document.getElementById('adminPendingLawyers') && getCurrentRole().startsWith('admin')){
    loadAdminPanel();
  }
  const bookTitle = document.getElementById('bookingTitle');
  if(bookTitle) bookTitle.textContent = t('bookTitle');
  const bookSubmit = document.getElementById('bookSubmit');
  if(bookSubmit && !bookSubmit.disabled) bookSubmit.textContent = t('confirm');
}

/* ===== Search (filter lawyers or send to AI) ===== */
function performSearch(){
  const q = (document.getElementById('searchInput')||{}).value || '';
  const query = q.trim();
  if(!query) return;

  // Try to match lawyer cards by name or specialty
  const cards = Array.from(document.querySelectorAll('#lawyers .card'));
  const matches = cards.filter(c => {
    const text = (c.innerText||'').toLowerCase();
    return text.includes(query.toLowerCase());
  });

  // clear previous highlights
  document.querySelectorAll('#lawyers .card').forEach(c=>c.classList.remove('highlight'));

  if(matches.length>0){
    // highlight and scroll to first
    matches.forEach(c=>c.classList.add('highlight'));
    matches[0].scrollIntoView({behavior:'smooth', block:'center'});
  } else {
    // no local result: open chat and send as AI inquiry
    toast(dict[currentLang].searchNoResults || 'No results');
    // open chat and send query
    const chat = document.getElementById('chatbot');
    const body = document.getElementById('chatBody');
    const input = document.getElementById('chatInput');
    if(chat.classList.contains('hidden')) chat.classList.remove('hidden');
    if(input){ input.value = query; input.focus(); }
    // reuse sendMsg to send
    sendMsg();
  }
}


/* ========= AI Chat (multi-conversation + memory) ========= */
function isAiChatLoggedIn(){ return !!localStorage.getItem('lg_token'); }
function aiChatHeaders(){
  const h = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('lg_token');
  if(token) h.Authorization = 'Bearer ' + token;
  return h;
}
function loadGuestAiStore(){
  try{ return JSON.parse(localStorage.getItem(AI_GUEST_STORAGE_KEY) || '{"conversations":[],"currentId":null}'); }
  catch(_e){ return { conversations: [], currentId: null }; }
}
function saveGuestAiStore(store){ localStorage.setItem(AI_GUEST_STORAGE_KEY, JSON.stringify(store)); }
function newLocalConversationId(){ return 'g' + Date.now() + Math.random().toString(36).slice(2, 6); }
function getCurrentAiConversation(){ return aiConversationsStore.find(c => c.id === currentAiConversationId) || null; }
function persistCurrentAiMessages(){
  const conv = getCurrentAiConversation();
  if(!conv) return;
  conv.messages = aiChatHistory.map(m => ({ role: m.role, content: m.content }));
  conv.updatedAt = new Date().toISOString();
  if(!isAiChatLoggedIn()){
    const store = loadGuestAiStore();
    store.conversations = aiConversationsStore;
    store.currentId = currentAiConversationId;
    saveGuestAiStore(store);
  }
}
function renderAiConversationList(){
  const list = document.getElementById('chatConversationList');
  if(!list) return;
  if(!aiConversationsStore.length){
    list.innerHTML = `<div style="font-size:11px;color:#9A8B78;padding:6px">${currentLang === 'ar' ? 'لا محادثات' : 'No chats'}</div>`;
    return;
  }
  list.innerHTML = aiConversationsStore.map(c=>{
    const title = escapeHtml(c.title || (currentLang === 'ar' ? 'محادثة' : 'Chat'));
    const active = c.id === currentAiConversationId ? ' active' : '';
    return `<button type="button" class="chat-conv-item${active}" onclick="selectAiConversation('${escapeJs(c.id)}')" title="${title}">${title}</button>`;
  }).join('');
}

function formatChatHtml(text){
  const safe = escapeHtml(String(text || ''));
  return safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function appendChatMessage(role, content, extraClass){
  const body = document.getElementById('chatBody');
  if(!body) return null;
  const row = document.createElement('div');
  row.className = 'chat-row ' + (role === 'user' ? 'user' : 'bot');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + role + (extraClass ? ' ' + extraClass : '');
  if(role === 'bot') bubble.innerHTML = formatChatHtml(content);
  else bubble.innerText = content;
  row.appendChild(bubble);
  body.appendChild(row);
  body.scrollTop = body.scrollHeight;
  return bubble;
}

function renderAiChatBody(messages, showWelcome){
  const body = document.getElementById('chatBody');
  if(!body) return;
  body.innerHTML = '';
  if(showWelcome && (!messages || !messages.length)){
    const welcome = currentLang === 'ar'
      ? '🤖 مرحباً! اسألني أي سؤال قانوني مصري.\n\n• نفس المحادثة = متابعة الأسئلة\n• 📎 = رفع عقد (TXT أو PDF — حتى الممسوح ضوئياً)\n• ⤢ = تصغير/تكبير النافذة\n\nملاحظة: معلومات عامة وليست استشارة من محامٍ مرخص.'
      : '🤖 Ask an Egyptian legal question.\n\n• Same chat = follow-ups\n• 📎 = upload contract (TXT/PDF, scans OK)\n• ⤢ = resize window\n\nNote: general info only, not licensed legal advice.';
    appendChatMessage('bot', welcome);
    return;
  }
  (messages || []).forEach(m => appendChatMessage(m.role === 'user' ? 'user' : 'bot', m.content || ''));
}

function updateChatTitleLabel(){
  const label = document.getElementById('chatTitleLabel');
  const conv = getCurrentAiConversation();
  if(label) label.innerText = (conv && conv.title) ? conv.title : (currentLang === 'ar' ? 'المساعد القانوني' : 'AI Assistant');
}
function selectAiConversation(id){
  const conv = aiConversationsStore.find(c => c.id === id);
  if(!conv) return;
  currentAiConversationId = id;
  aiChatHistory = (conv.messages || []).map(m => ({ role: m.role, content: m.content }));
  renderAiChatBody(aiChatHistory, true);
  renderAiConversationList();
  updateChatTitleLabel();
}
async function loadAiConversations(){
  if(isAiChatLoggedIn()){
    try{
      const res = await fetch(apiUrl('/api/ai/conversations'), { headers: aiChatHeaders() });
      const data = await res.json();
      if(data.ok && Array.isArray(data.conversations)){
        aiConversationsStore = data.conversations.map(c => ({ id: c.id, title: c.title, messages: [], updatedAt: c.updatedAt, createdAt: c.createdAt }));
        for(const c of aiConversationsStore){
          try{
            const detail = await fetch(apiUrl('/api/ai/conversations/' + encodeURIComponent(c.id)), { headers: aiChatHeaders() });
            const full = await detail.json();
            if(full.ok && full.conversation) c.messages = full.conversation.messages || [];
          }catch(_e){}
        }
      }
    }catch(_e){ aiConversationsStore = []; }
  } else {
    const store = loadGuestAiStore();
    aiConversationsStore = Array.isArray(store.conversations) ? store.conversations : [];
    currentAiConversationId = store.currentId || null;
    if(currentAiConversationId){
      const conv = getCurrentAiConversation();
      if(conv) aiChatHistory = (conv.messages || []).map(m => ({ role: m.role, content: m.content }));
    }
  }
  renderAiConversationList();
  updateChatTitleLabel();
}
async function newAiConversation(){
  if(isAiChatLoggedIn()){
    try{
      const res = await fetch(apiUrl('/api/ai/conversations'), { method: 'POST', headers: aiChatHeaders() });
      const data = await res.json();
      if(data.ok && data.conversation){
        aiConversationsStore.unshift({ id: data.conversation.id, title: data.conversation.title, messages: [], updatedAt: data.conversation.updatedAt, createdAt: data.conversation.createdAt });
        selectAiConversation(data.conversation.id);
        return;
      }
    }catch(_e){}
  }
  const id = newLocalConversationId();
  const now = new Date().toISOString();
  const conv = { id, title: currentLang === 'ar' ? 'محادثة جديدة' : 'New chat', messages: [], createdAt: now, updatedAt: now };
  aiConversationsStore.unshift(conv);
  selectAiConversation(id);
  if(!isAiChatLoggedIn()){ const store = loadGuestAiStore(); store.conversations = aiConversationsStore; store.currentId = id; saveGuestAiStore(store); }
}
async function ensureAiConversation(){
  if(currentAiConversationId && getCurrentAiConversation()) return;
  if(aiConversationsStore.length){ selectAiConversation(aiConversationsStore[0].id); return; }
  await newAiConversation();
}
async function initAiChatSystem(){
  await loadAiConversations();
  if(!currentAiConversationId && aiConversationsStore.length) selectAiConversation(aiConversationsStore[0].id);
}

function initAiVoiceInput(){
  if(typeof AiVoiceInput !== 'undefined'){
    AiVoiceInput.init();
    AiVoiceInput.refreshLabels();
  }
}

function toggleChat(){
  const chat = document.getElementById("chatbot");
  if(!chat) return;
  const opening = chat.classList.contains("hidden");
  if(!opening && typeof stopAiVoiceInput === 'function') stopAiVoiceInput();
  chat.classList.toggle("hidden");
  if(opening){
    chat.classList.add("expanded");
    ensureAiConversation().then(()=> renderAiChatBody(aiChatHistory, true));
  }
}

function toggleChatExpand(){
  const chat = document.getElementById("chatbot");
  if(!chat) return;
  chat.classList.toggle("expanded");
}

function initAiChatInput(){
  const input = document.getElementById('chatInput');
  if(!input || input.dataset.aiBound === '1') return;
  input.dataset.aiBound = '1';
  input.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      sendMsg();
    }
  });
}

function readFileAsText(file){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=> resolve(String(fr.result || ''));
    fr.onerror = ()=> reject(new Error('Could not read file'));
    fr.readAsText(file, 'UTF-8');
  });
}

function readFileAsBase64(file){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>{
      const r = String(fr.result || '');
      const b64 = r.includes(',') ? r.split(',')[1] : r;
      resolve(b64);
    };
    fr.onerror = ()=> reject(new Error('Could not read file'));
    fr.readAsDataURL(file);
  });
}

async function uploadLegalDocument(ev){
  const input = ev.target;
  const file = input && input.files && input.files[0];
  if(!file) return;
  input.value = '';

  const maxMb = 5;
  if(file.size > maxMb * 1024 * 1024){
    toast(currentLang === 'ar' ? `الحد الأقصى ${maxMb}MB` : `Max ${maxMb}MB`);
    return;
  }

  await ensureAiConversation();
  if(aiChatSending) return;

  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isTxt = file.type === 'text/plain' || /\.txt$/i.test(file.name);
  if(!isPdf && !isTxt){
    toast(currentLang === 'ar'
      ? 'الملف لازم يكون PDF أو TXT فقط (مش Word).'
      : 'Only PDF or TXT files are supported (not Word).');
    return;
  }
  const label = (currentLang === 'ar' ? '📎 رفع: ' : '📎 Upload: ') + file.name;
  appendChatMessage('user', label);

  aiChatSending = true;
  const loadMsg = isPdf
    ? (currentLang === 'ar'
      ? 'جاري قراءة الوثيقة… لو PDF ممسوح ممكن ياخد دقيقة أو اتنين.'
      : 'Reading document… scanned PDFs may take 1–2 minutes.')
    : (currentLang === 'ar' ? 'جاري قراءة الوثيقة...' : 'Reading document...');
  const loadingBubble = appendChatMessage('bot', loadMsg, 'loading');

  try{
    let text = '';
    let pdfBase64 = '';
    if(isPdf){
      pdfBase64 = await readFileAsBase64(file);
    } else {
      text = await readFileAsText(file);
    }

    const payload = {
      text,
      pdfBase64,
      filename: file.name,
      jurisdiction: 'مصر',
      history: aiChatHistory,
      conversationId: isAiChatLoggedIn() ? currentAiConversationId : undefined,
    };

    const res = await fetch(apiUrl('/api/chat/analyze-document'), {
      method: 'POST',
      headers: aiChatHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok){
      if(res.status === 404){
        throw new Error(currentLang === 'ar'
          ? 'خدمة تحليل الوثائق غير متاحة. أعد تشغيل السيرفر (start-all.bat).'
          : 'Document analysis unavailable. Restart the server (start-all.bat).');
      }
      if(res.status === 413){
        throw new Error(currentLang === 'ar' ? 'الملف كبير جداً. جرّب ملف أصغر (أقل من 4MB).' : 'File too large. Try under 4MB.');
      }
      const detail = data.detail;
      const detailStr = typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map(d => d.msg || d).join('; ') : '';
      const errMsg = (detailStr && detailStr.length > 30) ? detailStr
        : (data.reply || data.error || detailStr || `Upload failed (${res.status})`);
      throw new Error(errMsg.replace(/^تعذر تحليل الوثيقة:\s*/i, ''));
    }

    const reply = data.reply || '';
    loadingBubble.classList.remove('loading');
    loadingBubble.innerHTML = formatChatHtml(reply);

    aiChatHistory.push({ role: 'user', content: label });
    aiChatHistory.push({ role: 'assistant', content: reply });

    if(data.conversationId){
      currentAiConversationId = data.conversationId;
      let conv = getCurrentAiConversation();
      if(!conv){
        conv = { id: data.conversationId, title: data.title || file.name, messages: [], updatedAt: new Date().toISOString() };
        aiConversationsStore.unshift(conv);
      }
      conv.messages = aiChatHistory.map(m => ({ role: m.role, content: m.content }));
      conv.title = data.title || ('وثيقة: ' + file.name.slice(0, 28));
    } else {
      persistCurrentAiMessages();
      const conv = getCurrentAiConversation();
      if(conv) conv.title = 'وثيقة: ' + file.name.slice(0, 28);
    }
    renderAiConversationList();
    updateChatTitleLabel();
  } catch(err){
    loadingBubble.classList.remove('loading');
    loadingBubble.innerHTML = formatChatHtml((currentLang === 'ar' ? 'خطأ: ' : 'Error: ') + (err.message || err));
  } finally {
    aiChatSending = false;
    const body = document.getElementById('chatBody');
    if(body) body.scrollTop = body.scrollHeight;
  }
}

async function sendMsg(){
  if(typeof stopAiVoiceInput === 'function') stopAiVoiceInput();
  const input = document.getElementById("chatInput");
  const body = document.getElementById("chatBody");
  if(!input || !body || aiChatSending) return;

  const text = input.value.trim();
  if(!text) return;

  await ensureAiConversation();

  aiChatSending = true;
  input.disabled = true;

  appendChatMessage('user', text);
  const loadingBubble = appendChatMessage('bot', currentLang === 'ar' ? 'جاري التفكير...' : 'AI is typing...', 'loading');

  aiChatHistory.push({ role: 'user', content: text });
  persistCurrentAiMessages();

  const payload = { message: text, history: aiChatHistory.slice(0, -1), conversationId: isAiChatLoggedIn() ? currentAiConversationId : undefined };

  fetch(apiUrl('/api/chat'), {
    method: 'POST',
    headers: aiChatHeaders(),
    body: JSON.stringify(payload)
  })
  .then(async (r)=>{
    const data = await r.json().catch(() => ({}));
    if(!r.ok){
      throw new Error(data.reply || data.error || `Request failed (${r.status})`);
    }
    return data;
  })
  .then(data=>{
    const reply = data.reply || data.error || (currentLang === 'ar' ? 'لا توجد إجابة' : 'No response');
    loadingBubble.classList.remove('loading');
    loadingBubble.innerHTML = formatChatHtml(reply);
    aiChatHistory.push({ role: 'assistant', content: reply });
    if(data.conversationId){
      currentAiConversationId = data.conversationId;
      let conv = getCurrentAiConversation();
      if(!conv){
        conv = { id: data.conversationId, title: data.title || 'محادثة', messages: [], updatedAt: new Date().toISOString() };
        aiConversationsStore.unshift(conv);
      }
      conv.messages = aiChatHistory.map(m => ({ role: m.role, content: m.content }));
      if(data.title) conv.title = data.title;
      conv.updatedAt = new Date().toISOString();
    } else {
      const conv = getCurrentAiConversation();
      if(conv){
        const userCount = (conv.messages || []).filter(m => m.role === 'user').length;
        if(userCount <= 1) conv.title = text.length > 42 ? text.slice(0, 42) + '…' : text;
        conv.messages = aiChatHistory.map(m => ({ role: m.role, content: m.content }));
        persistCurrentAiMessages();
      }
    }
    renderAiConversationList();
    updateChatTitleLabel();
    body.scrollTop = body.scrollHeight;
  })
  .catch(err=>{
    loadingBubble.classList.remove('loading');
    loadingBubble.innerHTML = formatChatHtml((currentLang === 'ar' ? 'خطأ: ' : 'Error: ') + (err.message || err));
    aiChatHistory.pop();
    persistCurrentAiMessages();
  })
  .finally(()=>{
    input.value = '';
    input.disabled = false;
    aiChatSending = false;
    input.focus();
  });
}

/* ===== Contact handling ===== */
function sendContact(){
  const name = document.getElementById('contactName').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const message = document.getElementById('contactMessage').value.trim();
  const btn = document.getElementById('contactSend');

  if(!name || !email || !message){ toast('Please fill all fields'); return }

  btn.disabled = true; btn.innerText = t('sending');

  fetch(apiUrl('/api/contact'),{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name,email,message}) })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){ toast('Message sent'); document.getElementById('contactName').value=''; document.getElementById('contactEmail').value=''; document.getElementById('contactMessage').value=''; }
    else toast(res.error||'Failed');
  })
  .catch(e=>toast('Error sending'))
  .finally(()=>{ btn.disabled=false; btn.innerText=t('send'); });
}

/* ===== Booking modal ===== */
// booking modal is opened by the later function which enforces auth

function closeBooking(){
  const modal = document.getElementById('bookingModal');
  if(modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
  hideBookingLawyerCard();
  const meetingWrap = document.getElementById('bookMeetingTypeWrap');
  const meetingSelect = document.getElementById('bookMeetingType');
  if(meetingWrap) meetingWrap.classList.add('hidden');
  if(meetingSelect) meetingSelect.innerHTML = '';
}

/** Split lawyer availability entries from API (handles commas, semicolons, newlines inside one cell). */
function expandAvailabilitySlots(slots){
  const out = [];
  (Array.isArray(slots) ? slots : []).forEach(entry=>{
    String(entry || '').split(/[,;\n\r]+/).forEach(part=>{
      const t = part.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
      if(t) out.push(t);
    });
  });
  return out;
}

/** Parse slot strings lawyers/users enter: "YYYY-MM-DD HH:MM", ISO "YYYY-MM-DDTHH:MM", comma-separated, etc. */
function parseLawyerSlot(raw){
  let s = String(raw || '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\uFEFF/g, '');
  s = s.replace(/(\d{4})\/(\d{2})\/(\d{2})/g, '$1-$2-$3');
  s = s.replace(/,/g, ' ').replace(/\s*T\s*/i, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  let m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
  if(!m){
    m = s.match(/^(\d{4}-\d{2}-\d{2})(\d{2}:\d{2}(?::\d{2})?)$/);
    if(m){
      s = `${m[1]} ${m[2]}`;
      m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    }
  }
  if(!m) return { date: '', time: '' };

  let timePart = m[2].trim();
  let tm = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if(!tm){
    const alt = timePart.match(/^(\d{1,2})\s*:\s*(\d{2})(?::(\d{2}))?\s*$/);
    if(alt) tm = alt;
  }
  if(!tm){
    const hhmm = timePart.match(/^(\d{1,2})\s+(\d{2})(?:\s+(\d{2}))?$/);
    if(hhmm){
      tm = [ '', hhmm[1], hhmm[2], hhmm[3] ];
    }
  }
  if(!tm || !tm[1] || !tm[2]){
    return { date: m[1], time: '' };
  }
  const hh = String(parseInt(tm[1], 10)).padStart(2, '0');
  const mm = tm[2];
  return { date: m[1], time: `${hh}:${mm}` };
}

function fillBookingMeetingTypes(lawyer){
  const wrap = document.getElementById('bookMeetingTypeWrap');
  const select = document.getElementById('bookMeetingType');
  if(!wrap || !select) return;
  const opts = normalizeClientBookingOptions(lawyer && lawyer.bookingOptions);
  select.innerHTML = '';
  if(!opts.length){
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  if(opts.length > 1){
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = t('meetingTypeLabel');
    select.appendChild(ph);
  }
  opts.forEach(key=>{
    const o = document.createElement('option');
    o.value = key;
    o.textContent = formatMeetingType(key);
    select.appendChild(o);
  });
  if(opts.length === 1) select.value = opts[0];
}

function normalizeClientBookingOptions(opts){
  if(!Array.isArray(opts)) return [];
  const allowed = ['online', 'in_person'];
  return opts.map(o => String(o || '').trim().toLowerCase()).filter(o => allowed.includes(o));
}

function submitBooking(){
  const btn = document.getElementById('bookSubmit');
  const lawyer = btn.dataset.lawyer;
  const lawyerEmail = btn.dataset.lawyerEmail;
  const slotSelect = document.getElementById('bookSlot');
  const meetingSelect = document.getElementById('bookMeetingType');
  const note = document.getElementById('bookNote').value.trim();
  let sel = slotSelect ? String(slotSelect.value || '').trim() : '';
  sel = sel.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  if(!lawyer){ toast('Missing lawyer'); return }
  if(sel === ''){ toast('Please choose one of the lawyer’s available times'); return }

  const meetingWrap = document.getElementById('bookMeetingTypeWrap');
  let meetingType = meetingSelect ? String(meetingSelect.value || '').trim() : '';
  if(meetingWrap && !meetingWrap.classList.contains('hidden') && !meetingType){
    toast(t('meetingTypeLabel') + ' — ' + (currentLang === 'ar' ? 'مطلوب' : 'required'));
    return;
  }

  let slotRaw = sel;

  let { date: finalDate, time: finalTime } = parseLawyerSlot(slotRaw);
  if(!finalDate || !finalTime){
    const opt = slotSelect && slotSelect.selectedOptions && slotSelect.selectedOptions[0];
    const label = opt ? String(opt.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim() : '';
    if(label && label !== 'Choose available slot'){
      slotRaw = label;
      const again = parseLawyerSlot(label);
      finalDate = again.date;
      finalTime = again.time;
    }
  }
  if(!finalDate || !finalTime){
    const short = slotRaw.length > 70 ? slotRaw.slice(0, 70) + '…' : slotRaw;
    toast(`Could not read that time. Use this shape: 2026-05-01 10:00 (24h). Your choice was: "${short}"`);
    return;
  }

  const token = localStorage.getItem('lg_token');
  if(!token){ toast('Please log in to book'); setTimeout(()=> window.location.href='auth.html', 700); return }

  btn.disabled = true; btn.innerText = 'Booking...';

  const payload = { lawyer, lawyerEmail, date: finalDate, time: finalTime, note };
  if(meetingType) payload.meetingType = meetingType;

  fetch(apiUrl('/api/book'),{
    method: 'POST',
    headers: {'Content-Type':'application/json', 'Authorization': 'Bearer ' + token},
    body: JSON.stringify(payload)
  })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){
      toast('Successfully requested an appointment');
      closeBooking();
      if(document.getElementById('userAppointmentsList') || document.getElementById('lawyerBookingsList')){
        reloadCurrentDashboard();
      }
    }
    else toast(res.error||'Booking failed');
  })
  .catch(()=>toast('Network error'))
  .finally(()=>{ btn.disabled=false; btn.innerText=t('confirm'); });
}


// Ensure booking requires login
function openBooking(lawyer){
  if(isLawyerOrAdmin()){
    toast('Lawyers cannot book appointments.');
    return;
  }
  const current = localStorage.getItem('lg_user');
  if(!current){
    toast('Please log in to book');
    setTimeout(()=> window.location.href = 'auth.html', 700);
    return;
  }

  hideBookingLawyerCard();
  document.getElementById('bookingModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  const sel = document.getElementById('selectedLawyer');
  if(sel){ sel.classList.remove('hidden'); sel.innerText = 'Lawyer: ' + lawyer; }
  document.getElementById('bookerName').value='';
  document.getElementById('bookerEmail').value='';
  const slot = document.getElementById('bookSlot');
  if(slot){
    slot.innerHTML = '';
  }
  document.getElementById('bookNote').value='';
  document.getElementById('bookSubmit').dataset.lawyer = lawyer;
  document.getElementById('bookSubmit').dataset.lawyerEmail = '';
}

function openBookingWithEmail(lawyer, lawyerEmail){
  if(isLawyerOrAdmin()) return;
  let selectedLawyer = findLawyerInCache(lawyerEmail);
  const ensureLawyer = ()=>{
    const slots = Array.isArray(selectedLawyer && selectedLawyer.availabilitySlots) ? selectedLawyer.availabilitySlots : [];
    if(!slots.length){
      toast('This lawyer has not added available times yet.');
      return;
    }
    openBooking(lawyer);
    if(selectedLawyer){
      showBookingLawyerCard(selectedLawyer);
      fillBookingMeetingTypes(selectedLawyer);
    }
    const sel = document.getElementById('selectedLawyer');
    if(sel) sel.classList.add('hidden');
    const submit = document.getElementById('bookSubmit');
    if(submit){
      submit.dataset.lawyer = lawyer;
      submit.dataset.lawyerEmail = lawyerEmail || '';
    }
    fillBookingSlots(slots);
  };
  if(selectedLawyer){ ensureLawyer(); return; }
  fetch(apiUrl('/api/lawyers/' + encodeURIComponent(lawyerEmail)))
    .then(r=>r.json())
    .then(res=>{
      if(res.ok && res.lawyer){
        selectedLawyer = res.lawyer;
        if(!lawyersCache.find(l=>l.email === res.lawyer.email)) lawyersCache.push(res.lawyer);
        ensureLawyer();
      } else toast('Lawyer not found');
    })
    .catch(()=>toast('Network error'));
}

function fillBookingSlots(slots){
  const slotSelect = document.getElementById('bookSlot');
  if(!slotSelect) return;
  const slotList = expandAvailabilitySlots(slots);
  slotSelect.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = 'Choose available slot';
  slotSelect.appendChild(ph);
  slotList.forEach((slotStr)=>{
    const clean = slotStr.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
    if(!clean) return;
    const o = document.createElement('option');
    o.value = clean;
    o.textContent = clean;
    slotSelect.appendChild(o);
  });
}

/* ===== Microinteraction: button ripple ===== */
document.addEventListener('pointerdown', function(e){
  const btn = e.target.closest('.book-btn');
  if(!btn) return;
  btn.classList.remove('ripple');
  // force reflow
  void btn.offsetWidth;
  btn.classList.add('ripple');
});

/* ===== Navbar mobile toggle ===== */
function toggleNav(){
  const links = document.getElementById('navLinks');
  const search = document.querySelector('.nav-search');
  const btn = document.getElementById('navToggle');
  if(!links || !btn) return;
  const open = links.classList.toggle('mobile-open');
  if(search) search.classList.toggle('mobile-open', open);
  btn.setAttribute('aria-expanded', open);
}

// Close mobile nav on Escape
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    const links = document.getElementById('navLinks');
    const btn = document.getElementById('navToggle');
    if(links && links.classList.contains('mobile-open')){
      links.classList.remove('mobile-open');
      const search = document.querySelector('.nav-search');
      if(search) search.classList.remove('mobile-open');
      if(btn) btn.setAttribute('aria-expanded','false');
    }
  }
});


/* ========= Auth Tabs ========= */
function setAuthTab(active){
  const loginTab = document.getElementById('loginTabBtn');
  const signupTab = document.getElementById('signupTabBtn');
  if(loginTab) loginTab.classList.toggle('active', active === 'login');
  if(signupTab) signupTab.classList.toggle('active', active === 'signup');
}

function showLogin(){
  const loginBox = document.getElementById('loginBox');
  const signupBox = document.getElementById('signupBox');
  if(loginBox) loginBox.classList.remove('hidden');
  if(signupBox){
    signupBox.classList.add('hidden');
    signupBox.classList.remove('auth-signup-panel--lawyer');
  }
  setAuthTab('login');
}

function showSignup(){
  const loginBox = document.getElementById('loginBox');
  const signupBox = document.getElementById('signupBox');
  if(signupBox) signupBox.classList.remove('hidden');
  if(loginBox) loginBox.classList.add('hidden');
  setAuthTab('signup');
  onSignupRoleChange();
}

function onSignupRoleChange(){
  const role = ((document.getElementById('signupRole') || {}).value || '').toLowerCase();
  const docsBox = document.getElementById('lawyerDocsBox');
  const signupPanel = document.getElementById('signupBox');
  if(!docsBox) return;
  if(role.startsWith('law')){
    docsBox.classList.remove('hidden');
    if(signupPanel) signupPanel.classList.add('auth-signup-panel--lawyer');
  } else {
    docsBox.classList.add('hidden');
    if(signupPanel) signupPanel.classList.remove('auth-signup-panel--lawyer');
  }
}

function readFileAsDataUrl(file){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>resolve(String(fr.result || ''));
    fr.onerror = ()=>reject(new Error('File read failed'));
    fr.readAsDataURL(file);
  });
}

/** Resize/compress image so upload stays small and under server limits */
async function imageFileToCompressedDataUrl(file, maxDim = 480, quality = 0.82){
  const raw = await readFileAsDataUrl(file);
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=>{
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      const scale = Math.min(1, maxDim / Math.max(w, h, 1));
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if(!ctx){ resolve(raw); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try{
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out.length < raw.length ? out : raw);
      } catch(_e){
        resolve(raw);
      }
    };
    img.onerror = ()=>reject(new Error('Could not read image'));
    img.src = raw;
  });
}

async function parseApiResponse(response){
  const text = await response.text();
  if(!text){
    if(response.status === 404) throw new Error('API not found. Restart the server (npm start in frontend folder).');
    throw new Error(`Empty response (${response.status})`);
  }
  try{
    return JSON.parse(text);
  } catch(_e){
    if(response.status === 404) throw new Error('API not found. Restart the server (npm start in frontend folder).');
    throw new Error(`Server returned invalid response (${response.status})`);
  }
}

async function filesToDocumentPayload(fileInputId, maxFiles = 3, maxMb = 2){
  const input = document.getElementById(fileInputId);
  if(!input || !input.files || !input.files.length) return [];
  const files = Array.from(input.files).slice(0, maxFiles);
  const out = [];
  for(const f of files){
    if(f.size > maxMb * 1024 * 1024){
      toast(`"${f.name}" is larger than ${maxMb}MB and was skipped`);
      continue;
    }
    const data = await readFileAsDataUrl(f);
    out.push(`file:${f.name}|${data}`);
  }
  return out;
}

// Simple client-side signup/login using localStorage (for demo only)
async function signup(){
  const name = (document.getElementById('signupName')||{}).value || '';
  const email = (document.getElementById('signupEmail')||{}).value || '';
  const phone = (document.getElementById('signupPhone')||{}).value || '';
  const password = (document.getElementById('signupPassword')||{}).value || '';
  const role = (document.getElementById('signupRole')||{}).value || 'User';
  const docsRaw = (document.getElementById('signupDocuments')||{}).value || '';
  const textDocuments = docsRaw.split(/[\n\r]+/).map(s=>s.trim()).filter(Boolean);
  const fileDocuments = await filesToDocumentPayload('signupDocumentFiles', 3, 2);
  const documents = [...textDocuments, ...fileDocuments].slice(0, 30);

  if(!name.trim() || !email.trim() || !phone.trim() || !password){ toast('Please fill name, email, phone, and password'); return }

  if(String(role).toLowerCase().startsWith('law') && !documents.length){
    toast(t('authLawyerDocsRequired'));
    return;
  }

  const payload = { name, email, phone, password, role, documents };

  fetch(apiUrl('/api/signup'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok && res.token){
      localStorage.setItem('lg_token', res.token);
      syncLocalUser(res.user);
      toast('Account created');
      window.location.replace(getPostLoginHref(res.user));
    } else {
      toast(res.error || 'Signup failed');
    }
  })
  .catch(()=>toast('Network error. Make sure backend is running on localhost:3000'));
}

function login(){
  const identifier = (document.getElementById('loginEmail')||{}).value || '';
  const password = (document.getElementById('loginPassword')||{}).value || '';
  if(!identifier.trim() || !password){ toast('Enter email or phone and password'); return }

  fetch(apiUrl('/api/login'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: identifier, password }) })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok && res.token){
      localStorage.setItem('lg_token', res.token);
      syncLocalUser(res.user);
      toast('Logged in');
      window.location.replace(getPostLoginHref(res.user));
    } else {
      toast(res.error || 'Login failed');
    }
  })
  .catch(()=>toast('Network error. Make sure backend is running on localhost:3000'));
}

function initDashboardSession(){
  const userObj = getCurrentUserObj();
  currentUserEmail = String((userObj && userObj.email) || localStorage.getItem('lg_user') || '').toLowerCase();
  chatUnreadMap = {};
  updateChatNavBadge();
  loadAccountProfile();
  loadAccountSettings();
}

function loadBookingsIntoDashboard(onDone){
  const token = localStorage.getItem('lg_token');
  if(!token) return;
  fetch(apiUrl('/api/bookings'), { headers: { 'Authorization': 'Bearer ' + token }})
  .then(r=>r.json())
  .then(res=>{
    if(!res.ok){ toast(res.error||'Could not load bookings'); return; }
    chatBookingsCache = Array.isArray(res.bookings) ? res.bookings : [];
    computeUnreadFromBookings(chatBookingsCache);
    renderChatConversations();
    if(onDone) onDone(res);
  })
  .catch(()=>{ toast('Network error loading dashboard'); });
}

function loadUserDashboard(){
  const token = localStorage.getItem('lg_token');
  if(!token){ window.location.href = 'auth.html'; return; }
  initDashboardSession();
  loadBookingsIntoDashboard((res)=>{
    const list = document.getElementById('userAppointmentsList');
    const bookings = res.bookings || [];
    updateAppointmentStatusMsg(bookings);
    renderUserReviewPrompt(bookings);
    if(list){
      const active = bookings.filter(b => (b.status || '').toLowerCase() !== 'cancelled');
      if(!active.length) list.innerHTML = `<p class="appointments-empty">${escapeHtml(t('noAppointments'))}</p>`;
      else list.innerHTML = joinAppointmentCards(active.map(b => renderUserBookingCard(b)));
    }
    applyDashboardHash();
    if(!location.hash) showSection('appointments');
  });
}

function fetchCurrentUserFromApi(){
  const token = localStorage.getItem('lg_token');
  if(!token) return Promise.resolve(null);
  return fetch(apiUrl('/api/me'), { headers: { 'Authorization': 'Bearer ' + token } })
    .then(r=>r.json())
    .then(res=>{
      if(!res.ok || !res.user) return null;
      syncLocalUser(res.user);
      return res.user;
    })
    .catch(()=>null);
}

function loadLawyerDashboard(){
  const token = localStorage.getItem('lg_token');
  if(!token){ window.location.href = 'auth.html'; return; }
  initDashboardSession();
  checkServerProfileFields();

  fetchCurrentUserFromApi().then(userObj=>{
    const u = userObj || getCurrentUserObj();
    const lawyerStatus = String((u && u.lawyerStatus) || '').toLowerCase();
    const pendingNotice = document.getElementById('pendingLawyerNotice');
    const bookingsPanel = document.getElementById('lawyerBookings');
    const isPending = lawyerStatus === 'pending';
    const isRejected = lawyerStatus === 'rejected';

    if(isPending || isRejected){
      if(pendingNotice) pendingNotice.classList.toggle('hidden', isRejected);
      if(bookingsPanel) bookingsPanel.classList.add('hidden');
      renderLawyerRejectionNotice();
      loadLawyerPracticeInProfile();
      applyDashboardHash();
      if(!location.hash) showSection('profile');
      return;
    }

    if(pendingNotice) pendingNotice.classList.add('hidden');
    if(bookingsPanel) bookingsPanel.classList.remove('hidden');

    loadLawyerPracticeInProfile();
    loadLawyerProfile();

    loadBookingsIntoDashboard((res)=>{
      const list = document.getElementById('lawyerBookingsList');
      if(list){
        if(!res.bookings || !res.bookings.length) list.innerHTML = `<p class="appointments-empty">${escapeHtml(t('noBookings'))}</p>`;
        else list.innerHTML = joinAppointmentCards(res.bookings.map(b => renderLawyerBookingCard(b)));
      }
      applyDashboardHash();
      if(!location.hash) showSection('lawyerBookings');
    });
  });
}

function startDashboardPolling(){
  if(dashboardPollTimer) return;
  dashboardPollTimer = setInterval(()=>{
    // Lightweight polling for unread updates without forcing UI section changes.
    const token = localStorage.getItem('lg_token');
    if(!token) return;
    fetch(apiUrl('/api/bookings'), { headers: { 'Authorization': 'Bearer ' + token }})
    .then(r=>r.json())
    .then(res=>{
      if(!res.ok) return;
      const bookings = Array.isArray(res.bookings) ? res.bookings : [];
      chatBookingsCache = bookings;
      const prev = { ...chatUnreadMap };
      computeUnreadFromBookings(bookings);
      maybeNotifyUnread(prev);
      renderChatConversations();
      if(currentChatBookingId){
        const exists = bookings.some(b=>b.id===currentChatBookingId);
        if(exists) loadAppointmentMessages();
      }
    })
    .catch(()=>{});
  }, 10000);
}

function readStateKey(){
  return `lg_chat_read_${currentUserEmail || 'anon'}`;
}

function getReadState(){
  try{
    return JSON.parse(localStorage.getItem(readStateKey()) || '{}');
  } catch(_e){
    return {};
  }
}

function setReadState(state){
  localStorage.setItem(readStateKey(), JSON.stringify(state));
}

function markConversationRead(bookingId){
  if(!bookingId) return;
  const state = getReadState();
  state[bookingId] = new Date().toISOString();
  setReadState(state);
  chatUnreadMap[bookingId] = 0;
  renderChatConversations();
}

function getConversationKey(booking){
  const role = getCurrentRole();
  if(role.startsWith('law') || role.startsWith('admin')){
    return `client:${String(booking.email || '').toLowerCase()}`;
  }
  return `lawyer:${String(booking.lawyerEmail || '').toLowerCase()}`;
}

function buildConversationBuckets(bookings){
  const map = new Map();
  bookings.forEach(b=>{
    const key = getConversationKey(b);
    const unread = chatUnreadMap[b.id] || 0;
    if(!map.has(key)){
      map.set(key, {
        key,
        partnerName: getConversationPartnerName(b),
        bookingIds: [b.id],
        primaryBookingId: b.id,
        latestAt: b.createdAt || '',
        date: b.date || '',
        time: b.time || '',
        unread
      });
      return;
    }
    const x = map.get(key);
    x.bookingIds.push(b.id);
    x.unread += unread;
    const currentAt = String(b.createdAt || '');
    if(currentAt > String(x.latestAt || '')){
      x.primaryBookingId = b.id;
      x.latestAt = currentAt;
      x.date = b.date || x.date;
      x.time = b.time || x.time;
      x.partnerName = getConversationPartnerName(b) || x.partnerName;
    }
  });
  return Array.from(map.values()).sort((a,b)=> String(b.latestAt || '').localeCompare(String(a.latestAt || '')));
}

function markConversationKeyRead(conversationKey){
  const state = getReadState();
  chatBookingsCache.forEach(b=>{
    if(getConversationKey(b) === conversationKey){
      state[b.id] = new Date().toISOString();
      chatUnreadMap[b.id] = 0;
    }
  });
  setReadState(state);
  renderChatConversations();
}

function computeUnreadFromBookings(bookings){
  const state = getReadState();
  const next = {};
  bookings.forEach(b=>{
    const lastRead = String(state[b.id] || '');
    const msgs = Array.isArray(b.messages) ? b.messages : [];
    const unread = msgs.filter(m=>{
      const sender = String(m.senderEmail || '').toLowerCase();
      const at = String(m.at || '');
      return sender && sender !== currentUserEmail && (!lastRead || at > lastRead);
    }).length;
    next[b.id] = unread;
  });
  chatUnreadMap = next;
}

function maybeNotifyUnread(prevMap){
  const role = getCurrentRole();
  chatBookingsCache.forEach(b=>{
    const unread = chatUnreadMap[b.id] || 0;
    const prev = prevMap[b.id] || 0;
    if(unread > prev){
      const partner = role.startsWith('law') || role.startsWith('admin') ? b.name : b.lawyer;
      const key = `${b.id}:${unread}`;
      if(chatUnreadLastNotified[key]) return;
      chatUnreadLastNotified[key] = true;
      toast(`New unread message from ${partner || 'conversation'}`);
    }
  });
}

function getConversationPartnerName(booking){
  const role = getCurrentRole();
  if(role.startsWith('law') || role.startsWith('admin')) return booking.name || booking.email || 'Client';
  return booking.lawyer || booking.lawyerEmail || 'Lawyer';
}

function renderChatConversations(){
  const list = document.getElementById('chatConversationsList');
  updateChatNavBadge();
  if(!list) return;
  const dark = document.body.classList.contains('dark');
  const rowBg = dark ? '#1A1612' : '#FAF7F2';
  const rowBgActive = dark ? '#9A7B4F' : '#E8DFD0';
  const nameColor = dark ? '#F5EFE6' : '#2C2419';
  const subColor = dark ? '#E4D9CC' : '#6B5E50';
  if(!chatBookingsCache.length){
    list.innerHTML = `<div style="padding:10px;color:${subColor}">${escapeHtml(t('chooseConversation'))}</div>`;
    updateChatNavBadge();
    return;
  }
  const buckets = buildConversationBuckets(chatBookingsCache);
  if(!buckets.length){
    list.innerHTML = `<div style="padding:10px;color:${subColor}">${escapeHtml(t('chooseConversation'))}</div>`;
    updateChatNavBadge();
    return;
  }
  const role = getCurrentRole();
  const showLawyerPic = !role.startsWith('law') && !role.startsWith('admin');
  list.innerHTML = buckets.map(c=>{
    const partner = escapeHtml(c.partnerName || 'Conversation');
    const unread = c.unread || 0;
    const isActive = currentConversationKey === c.key;
    const booking = chatBookingsCache.find(b=>b.id === c.primaryBookingId);
    const avatar = showLawyerPic && booking ? lawyerAvatarHtml(lawyerFromBooking(booking), 'sm') : '';
    return `<button type="button" onclick="openAppointmentChat('${c.primaryBookingId}','${escapeJs(c.partnerName || 'Conversation')}')" style="display:block;width:100%;text-align:left;padding:10px;border:0;border-radius:8px;margin-bottom:6px;background:${isActive ? rowBgActive : rowBg};cursor:pointer"><div class="chat-conv-row">${avatar}<div style="flex:1;min-width:0"><div style="font-weight:600;color:${nameColor}">${partner}</div><div style="font-size:12px;color:${subColor}">${escapeHtml((c.date || '') + ' ' + (c.time || ''))}</div>${unread>0?`<div style=\"font-size:12px;color:#dc2626;font-weight:700\">${escapeHtml(t('unread'))}: ${unread}</div>`:''}</div></div></button>`;
  }).join('');
}

function updateChatNavBadge(){
  const badge = document.getElementById('chatUnreadBadge');
  if(!badge) return;
  const buckets = buildConversationBuckets(chatBookingsCache || []);
  const totalUnread = buckets.reduce((sum, c)=> sum + (Number(c.unread) || 0), 0);
  if(totalUnread > 0){
    badge.innerText = String(totalUnread > 99 ? '99+' : totalUnread);
    badge.classList.remove('hidden');
  } else {
    badge.innerText = '';
    badge.classList.add('hidden');
  }
}

function fillLawyerPracticeForm(u){
  const specialty = document.getElementById('profileLawyerSpecialty');
  const gender = document.getElementById('profileLawyerGender');
  const desc = document.getElementById('profileLawyerDescription');
  const details = document.getElementById('profileLawyerDetails');
  const feeMin = document.getElementById('profileLawyerFeeMin');
  const feeMax = document.getElementById('profileLawyerFeeMax');
  const experience = document.getElementById('profileLawyerExperience');
  const location = document.getElementById('profileLawyerLocation');
  const phone = document.getElementById('profileLawyerPhone');
  if(specialty) specialty.value = u.specialty || 'General Personal Status';
  if(gender) gender.value = u.gender || '';
  if(desc) desc.value = u.description || '';
  if(details) details.value = u.practiceDetails || '';
  if(experience) experience.value = u.yearsOfExperience != null ? String(u.yearsOfExperience) : '';
  if(location) location.value = u.location || '';
  if(phone) phone.value = u.phone || '';
  if(feeMin) feeMin.value = (u.feeMin != null ? u.feeMin : u.consultationFee) != null ? String(u.feeMin != null ? u.feeMin : u.consultationFee) : '';
  if(feeMax) feeMax.value = u.feeMax != null ? String(u.feeMax) : '';
}

async function saveLawyerPublicDetails(){
  const token = localStorage.getItem('lg_token');
  if(!token){ toast('Not authenticated'); return; }
  if(!validateLawyerPublicForm()) return;

  const btn = document.querySelector('[onclick="saveLawyerPublicDetails()"]');
  if(btn){ btn.disabled = true; btn.dataset.prevText = btn.textContent; btn.textContent = 'Saving…'; }

  try{
    const res = await putLawyerProfile(collectLawyerPublicMetaFromForm(false));
    if(res.ok){
      if(res.user){
        syncLocalUser(res.user);
        patchLawyerInCacheFromUser(res.user);
        fillLawyerPracticeForm(res.user);
        fillLawyerAvailabilityForm(res.user);
      }
      const email = String((res.user && res.user.email) || getCurrentUserObj()?.email || '').toLowerCase();
      if(email){
        fetch(apiUrl('/api/lawyers/' + encodeURIComponent(email)), {
          headers: { Authorization: 'Bearer ' + token }
        })
          .then(r => r.json())
          .then(pub => {
            if(pub.ok && pub.lawyer){
              const idx = lawyersCache.findIndex(l => (l.email || '').toLowerCase() === email);
              if(idx >= 0) lawyersCache[idx] = { ...lawyersCache[idx], ...pub.lawyer };
            }
          })
          .catch(()=>{});
      }
      toast('Public profile details saved — clients can see them now');
      if(document.getElementById('lawyersDirectory')) applyLawyerFilters();
    } else {
      toast(res.error || 'Failed to save');
    }
  } catch(e){
    const msg = (e && e.message) || '';
    if(msg.includes('API not found') || msg.includes('invalid response')){
      toast('Server needs a restart. Stop it, run npm start in the frontend folder, then try again.');
    } else {
      toast(msg || 'Network error');
    }
  } finally {
    if(btn){
      btn.disabled = false;
      btn.textContent = btn.dataset.prevText || t('savePublicDetails');
    }
  }
}

async function saveLawyerBasicInfo(){
  return saveLawyerPublicDetails();
}

function fillLawyerAvailabilityForm(u){
  const duration = document.getElementById('profileConsultationDuration');
  const online = document.getElementById('profileBookingOnline');
  const inPerson = document.getElementById('profileBookingInPerson');
  const opts = normalizeClientBookingOptions(u.bookingOptions);
  if(duration) duration.value = u.consultationDuration ? String(u.consultationDuration) : '';
  if(online) online.checked = opts.includes('online');
  if(inPerson) inPerson.checked = opts.includes('in_person');
}

function renderLawyerRejectionNotice(){
  const box = document.getElementById('lawyerRejectedNotice');
  if(!box) return;
  const u = getCurrentUserObj();
  const st = String((u && u.lawyerStatus) || '').toLowerCase();
  const reason = String((u && u.rejectionReason) || '').trim();
  const show = st === 'rejected' || (st === 'pending' && reason);
  if(!show){
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  const feedbackText = reason ? escapeHtml(reason) : escapeHtml(t('rejectedNoFeedback'));
  box.classList.remove('hidden');
  box.innerHTML = `
    <p class="lawyer-rejection-title">${escapeHtml(t('rejectedTitle'))}</p>
    <p class="lawyer-rejection-hint">${escapeHtml(t('rejectedHint'))}</p>
    <p class="lawyer-rejection-feedback">${feedbackText}</p>`;
}

function loadLawyerPracticeInProfile(){
  const token = localStorage.getItem('lg_token');
  const spec = document.getElementById('profileLawyerSpecialty');
  if(!token || !spec) return;
  const u = getCurrentUserObj();
  populateSpecialtySelect(spec, false);
  renderLawyerRejectionNotice();
  const hint = document.getElementById('lawyerApprovalHint');
  const status = String((u && u.lawyerStatus) || '').toLowerCase();
  if(hint){
    if(status && status !== 'approved') hint.classList.remove('hidden');
    else hint.classList.add('hidden');
  }
  fetch(apiUrl('/api/me'), { headers: { 'Authorization': 'Bearer ' + token }})
  .then(r=>r.json())
  .then(res=>{
    if(!res.ok || !res.user) return;
    syncLocalUser(res.user);
    fillLawyerPracticeForm(res.user);
    fillLawyerAvailabilityForm(res.user);
    renderLawyerRejectionNotice();
  })
  .catch(()=>{});
}

async function saveLawyerPracticeFromProfile(){
  const token = localStorage.getItem('lg_token');
  if(!token){ toast('Not authenticated'); return; }
  const feeMinRaw = String((document.getElementById('profileLawyerFeeMin') || {}).value || '').trim();
  const feeMaxRaw = String((document.getElementById('profileLawyerFeeMax') || {}).value || '').trim();
  const body = {
    specialty: ((document.getElementById('profileLawyerSpecialty') || {}).value || '').trim(),
    description: ((document.getElementById('profileLawyerDescription') || {}).value || '').trim(),
    practiceDetails: ((document.getElementById('profileLawyerDetails') || {}).value || '').trim(),
    gender: ((document.getElementById('profileLawyerGender') || {}).value || '').trim(),
    ...collectLawyerPublicMetaFromForm(false)
  };
  if(feeMinRaw !== '') body.feeMin = Number(feeMinRaw);
  if(feeMaxRaw !== '') body.feeMax = Number(feeMaxRaw);

  const btn = document.querySelector('[onclick="saveLawyerPracticeFromProfile()"]');
  if(btn){ btn.disabled = true; btn.dataset.prevText = btn.textContent; btn.textContent = 'Saving…'; }

  try{
    const response = await fetch(apiUrl('/api/lawyer/profile'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body)
    });
    const res = await parseApiResponse(response);
    if(res.ok){
      if(res.user){
        syncLocalUser(res.user);
        patchLawyerInCacheFromUser(res.user);
        fillLawyerPracticeForm(res.user);
        fillLawyerAvailabilityForm(res.user);
      }
      renderLawyerRejectionNotice();
      const status = String((res.user && res.user.lawyerStatus) || '').toLowerCase();
      if(status === 'approved'){
        toast('Profile saved — visible to clients');
      } else {
        toast('Profile submitted — waiting for admin approval');
      }
      loadAccountProfile();
      reloadCurrentDashboard();
    } else {
      toast(res.error || 'Failed to save');
    }
  } catch(e){
    const msg = (e && e.message) || '';
    if(msg.includes('Failed to fetch') || msg.includes('NetworkError')){
      toast('Cannot reach server. Run npm start in the frontend folder, then open http://localhost:3000/lawyer-dashboard.html');
    } else {
      toast(msg || 'Network error');
    }
  } finally {
    if(btn){
      btn.disabled = false;
      btn.textContent = btn.dataset.prevText || 'Save practice info';
    }
  }
}

function loadAccountProfile(){
  const token = localStorage.getItem('lg_token');
  if(!token) return;
  fetch(apiUrl('/api/me'), { headers: { 'Authorization': 'Bearer ' + token }})
  .then(r=>r.json())
  .then(res=>{
    if(!res.ok || !res.user) return;
    const u = res.user;
    syncLocalUser(u);
    const info = document.getElementById('profileInfo');
    if(info){
      const statusLine = isLawyerRole(u.role) && u.lawyerStatus
        ? `<p><strong>Status:</strong> ${escapeHtml(u.lawyerStatus)}</p>` : '';
      const feedbackLine = isLawyerRole(u.role) && String(u.rejectionReason || '').trim()
        ? `<p><strong>${escapeHtml(t('rejectedHint'))}</strong> ${escapeHtml(u.rejectionReason)}</p>` : '';
      const profileLink = isLawyerRole(u.role) && u.email
        ? `<p style="margin-top:10px"><a href="${escapeHtml(lawyerProfilePageUrl(u.email))}" target="_blank" rel="noopener">Preview your public profile</a></p>`
        : '';
      info.innerHTML = `<p><strong>Role:</strong> ${escapeHtml(u.role || 'User')}</p>${statusLine}${feedbackLine}<p><strong>Email:</strong> ${escapeHtml(u.email || '-')}</p><p><strong>Phone:</strong> ${escapeHtml(u.phone || '-')}</p><p style="font-size:13px;margin-top:8px">Edit public phone, location, and experience in the section above. Change login email in Settings.</p>${profileLink}`;
    }
    const nameInput = document.getElementById('accountNameInput');
    if(nameInput) nameInput.value = u.name || '';
    const photoBox = document.getElementById('accountProfilePhotoBox');
    const preview = document.getElementById('accountProfilePreview');
    if(photoBox){
      if(isLawyerRole(u.role)) photoBox.classList.remove('hidden');
      else photoBox.classList.add('hidden');
    }
    if(preview){
      if(u.profilePic){
        preview.src = u.profilePic;
        preview.classList.remove('hidden');
      } else {
        preview.classList.add('hidden');
      }
    }
    if(isLawyerRole(u.role)) loadLawyerPracticeInProfile();
  })
  .catch(()=>{});
}

function loadAccountSettings(){
  const token = localStorage.getItem('lg_token');
  if(!token || !document.getElementById('settingsEmailInput')) return;
  fetch(apiUrl('/api/me'), { headers: { 'Authorization': 'Bearer ' + token }})
  .then(r=>r.json())
  .then(res=>{
    if(!res.ok || !res.user) return;
    const emailEl = document.getElementById('settingsEmailInput');
    const phoneEl = document.getElementById('settingsPhoneInput');
    if(emailEl) emailEl.value = res.user.email || '';
    if(phoneEl) phoneEl.value = res.user.phone || '';
  })
  .catch(()=>{});
}

function saveAccountProfile(){
  const token = localStorage.getItem('lg_token');
  const name = ((document.getElementById('accountNameInput') || {}).value || '').trim();
  if(!token){ toast('Not authenticated'); return; }
  if(!name){ toast('Name is required'); return; }
  fetch(apiUrl('/api/account/profile'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ name })
  })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){
      syncLocalUser(res.user);
      loadAccountProfile();
      toast('Profile saved');
    } else toast(res.error || 'Failed to save');
  })
  .catch(()=>toast('Network error'));
}

async function uploadAccountProfilePicture(){
  const input = document.getElementById('accountProfilePicFile');
  if(!input || !input.files || !input.files[0]){
    toast('Choose a photo first');
    return;
  }
  const file = input.files[0];
  if(!file.type.startsWith('image/')){
    toast('Please choose an image file');
    return;
  }
  if(file.size > 5 * 1024 * 1024){
    toast('Image must be 5MB or smaller');
    return;
  }
  const token = localStorage.getItem('lg_token');
  if(!token){ toast('Not authenticated'); return; }
  let data;
  try{
    data = await imageFileToCompressedDataUrl(file);
  } catch(e){
    toast(e.message || 'Could not process image');
    return;
  }
  try{
    const response = await fetch(apiUrl('/api/account/profile'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ profilePic: data })
    });
    const res = await parseApiResponse(response);
    if(res.ok){
      syncLocalUser(res.user);
      const preview = document.getElementById('accountProfilePreview');
      if(preview){
        preview.src = res.user && res.user.profilePic ? res.user.profilePic : data;
        preview.classList.remove('hidden');
      }
      input.value = '';
      toast('Profile photo saved');
    } else {
      toast(res.error || 'Upload failed');
    }
  } catch(e){
    toast(e.message || 'Network error — is the server running on localhost:3000?');
  }
}

function saveAccountContact(){
  const token = localStorage.getItem('lg_token');
  const email = ((document.getElementById('settingsEmailInput') || {}).value || '').trim();
  const phone = ((document.getElementById('settingsPhoneInput') || {}).value || '').trim();
  if(!token){ toast('Not authenticated'); return; }
  fetch(apiUrl('/api/account/contact'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ email, phone })
  })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){
      if(res.token) localStorage.setItem('lg_token', res.token);
      syncLocalUser(res.user);
      currentUserEmail = String(res.user.email || '').toLowerCase();
      loadAccountProfile();
      toast('Contact details updated');
    } else toast(res.error || 'Failed to update');
  })
  .catch(()=>toast('Network error'));
}

function changeAccountPassword(){
  const token = localStorage.getItem('lg_token');
  const currentPassword = ((document.getElementById('settingsCurrentPassword') || {}).value || '');
  const newPassword = ((document.getElementById('settingsNewPassword') || {}).value || '');
  const confirm = ((document.getElementById('settingsConfirmPassword') || {}).value || '');
  if(!token){ toast('Not authenticated'); return; }
  if(!currentPassword || !newPassword){ toast('Enter current and new password'); return; }
  if(newPassword !== confirm){ toast('New passwords do not match'); return; }
  fetch(apiUrl('/api/account/password'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ currentPassword, newPassword })
  })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){
      ['settingsCurrentPassword','settingsNewPassword','settingsConfirmPassword'].forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.value = '';
      });
      toast('Password changed');
    } else toast(res.error || 'Failed to change password');
  })
  .catch(()=>toast('Network error'));
}

function loadLawyerProfile(){
  const token = localStorage.getItem('lg_token');
  const availability = document.getElementById('availabilityInput');
  const documentsList = document.getElementById('documentsList');
  if(!token || !availability || !documentsList) return;

  fetch(apiUrl('/api/me'), { headers: { 'Authorization': 'Bearer ' + token }})
  .then(r=>r.json())
  .then(res=>{
    if(!res.ok || !res.user) return;
    availability.value = res.user.availability || '';
    fillLawyerAvailabilityForm(res.user);
    lawyerDocumentsCache = Array.isArray(res.user.documents) ? res.user.documents : [];
    renderLawyerDocuments();
  })
  .catch(()=>{});
}

async function saveLawyerProfile(){
  const token = localStorage.getItem('lg_token');
  if(!token){ toast('Not authenticated'); return }

  const btn = document.querySelector('[onclick="saveLawyerProfile()"]');
  if(btn){ btn.disabled = true; btn.dataset.prevText = btn.textContent; btn.textContent = 'Saving…'; }

  try{
    const res = await putLawyerProfile(collectLawyerPublicMetaFromForm(true));
    if(res.ok){
      if(res.user){
        syncLocalUser(res.user);
        patchLawyerInCacheFromUser(res.user);
        fillLawyerAvailabilityForm(res.user);
      }
      toast('Availability saved');
    } else {
      toast(res.error || 'Failed to update');
    }
  } catch(e){
    toast(e.message || 'Network error');
  } finally {
    if(btn){
      btn.disabled = false;
      btn.textContent = btn.dataset.prevText || t('saveAvailability');
    }
  }
}

function addLawyerDocument(){
  const input = document.getElementById('documentInput');
  const value = (input || {}).value || '';
  const doc = value.trim();
  if(!doc){ toast('Enter a document first'); return }
  lawyerDocumentsCache.push(doc);
  if(input) input.value = '';
  renderLawyerDocuments();
  saveLawyerProfile();
}

function renderLawyerDocuments(){
  const list = document.getElementById('documentsList');
  if(!list) return;
  if(!lawyerDocumentsCache.length){
    list.innerText = 'No documents yet.';
    return;
  }
  list.innerHTML = lawyerDocumentsCache.map((d, i)=>{
    const raw = String(d || '');
    let content = escapeHtml(raw);
    if(raw.startsWith('file:') && raw.includes('|')){
      const pipeIdx = raw.indexOf('|');
      const fileName = raw.slice(5, pipeIdx) || 'uploaded-file';
      const data = raw.slice(pipeIdx + 1);
      if(data.startsWith('data:')){
        const parsed = parseLawyerDocument(raw);
        const isImg = parsed && parsed.isImage;
        content = `<button type="button" class="admin-doc-view-btn" style="font-size:inherit;padding:2px 8px" onclick="openLawyerDocumentPreview(${i})">${escapeHtml(fileName)}${isImg ? ' (view image)' : ' (view)'}</button>`;
      }
    }
    return `<div style="margin-bottom:6px"><span>${content}</span> <button type="button" onclick="removeLawyerDocument(${i})">Remove</button></div>`;
  }).join('');
}

function removeLawyerDocument(index){
  lawyerDocumentsCache = lawyerDocumentsCache.filter((_, i)=>i!==index);
  renderLawyerDocuments();
  saveLawyerProfile();
}

async function uploadLawyerDocuments(){
  const files = await filesToDocumentPayload('lawyerDocumentFiles', 3, 2);
  if(!files.length){ toast('No valid files selected'); return; }
  lawyerDocumentsCache.push(...files);
  lawyerDocumentsCache = lawyerDocumentsCache.slice(0, 30);
  renderLawyerDocuments();
  saveLawyerProfile();
  const input = document.getElementById('lawyerDocumentFiles');
  if(input) input.value = '';
}

function loadLawyers(){
  const preview = document.getElementById('lawyersPreview');
  const legacyGrid = document.querySelector('#lawyers .grid');
  const container = preview || legacyGrid;
  if(!container) return;

  fetchLawyersList('').then(lawyers=>{
    if(!lawyers.length){
      container.innerHTML = `<p class="lawyers-empty">${escapeHtml(t('noLawyersAvailable'))}</p>`;
      return;
    }
    const list = preview ? lawyers.slice(0, 3) : lawyers;
    renderLawyersInto(container, list, { compact: !!preview, canBook: !isLawyerOrAdmin() });
  });
}

function escapeHtml(value){
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeJs(value){
  return String(value || '')
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'");
}

/* ========= Dashboard ========= */
function showSection(id){
  document.querySelectorAll(".dash-box").forEach(b=>b.classList.add("hidden"));
  const panel = document.getElementById(id);
  if(panel) panel.classList.remove("hidden");

  const map = {
    appointments: 'appointmentsNavBtn',
    profile: 'profileNavBtn',
    settings: 'settingsNavBtn',
    lawyerBookings: 'lawyerBookingsNavBtn',
    lawyerProfile: 'lawyerProfileNavBtn',
    appointmentChat: 'chatNavBtn'
  };
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn=>btn.classList.remove('active'));
  const activeId = map[id];
  if(activeId){
    const btn = document.getElementById(activeId);
    if(btn) btn.classList.add('active');
  }
}

function logout(){
  localStorage.removeItem('lg_token');
  localStorage.removeItem('lg_user');
  localStorage.removeItem('lg_user_obj');
  const accountMenu = document.getElementById('accountMenu');
  if(accountMenu) accountMenu.classList.add('hidden');
  updateAuthMenu();
  window.location.href="index.html";
}

document.addEventListener('click', (e)=>{
  const wrap = document.getElementById('accountMenuWrap');
  const menu = document.getElementById('accountMenu');
  if(!wrap || !menu) return;
  if(menu.classList.contains('hidden')) return;
  if(!wrap.contains(e.target)) menu.classList.add('hidden');
});

function acceptBooking(id){
  const token = localStorage.getItem('lg_token');
  if(!token){ toast('Not authenticated'); return }
  fetch(apiUrl(`/api/book/${id}/accept`), { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){ toast('Booking accepted'); reloadCurrentDashboard(); }
    else toast(res.error||'Failed');
  })
  .catch(()=>toast('Network error'));
}

function declineBooking(id){
  const token = localStorage.getItem('lg_token');
  if(!token){ toast('Not authenticated'); return }
  fetch(apiUrl(`/api/book/${id}/decline`), { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){ toast('Booking declined'); reloadCurrentDashboard(); }
    else toast(res.error||'Failed');
  })
  .catch(()=>toast('Network error'));
}

function cancelByLawyer(id){
  const token = localStorage.getItem('lg_token');
  if(!token){ toast('Not authenticated'); return }
  fetch(apiUrl(`/api/book/${id}/cancel-by-lawyer`), { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){ toast(t('apptCancelledToast')); reloadCurrentDashboard(); }
    else toast(res.error||'Failed');
  })
  .catch(()=>toast('Network error'));
}

function cancelBooking(id){
  const token = localStorage.getItem('lg_token');
  if(!token){ toast('Not authenticated'); return }
  fetch(apiUrl(`/api/book/${id}/cancel`), { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){ toast(t('apptCancelledToast')); reloadCurrentDashboard(); }
    else toast(res.error||'Failed');
  })
  .catch(()=>toast('Network error'));
}

function openAppointmentChat(bookingId, partnerName){
  const booking = chatBookingsCache.find(b=>b.id===bookingId);
  currentConversationKey = booking ? getConversationKey(booking) : '';
  const buckets = buildConversationBuckets(chatBookingsCache);
  const conv = buckets.find(c=>c.key===currentConversationKey);
  currentChatBookingId = conv ? conv.primaryBookingId : bookingId;
  currentChatPartnerName = (conv && conv.partnerName) || partnerName || 'Client';
  const label = document.getElementById('chatPartnerLabel');
  if(label) label.innerText = `Chat with ${currentChatPartnerName}`;
  const role = getCurrentRole();
  if(!role.startsWith('law') && !role.startsWith('admin')){
    const active = chatBookingsCache.find(b=>b.id===currentChatBookingId) || booking;
    updateChatPartnerCard(active);
  } else {
    updateChatPartnerCard(null);
  }
  if(currentConversationKey) markConversationKeyRead(currentConversationKey);
  else markConversationRead(bookingId);
  showSection('appointmentChat');
  loadAppointmentMessages();
}

function loadAppointmentMessages(){
  const token = localStorage.getItem('lg_token');
  const body = document.getElementById('appointmentChatBody');
  if(!token || !body || !currentChatBookingId) return;
  const dark = document.body.classList.contains('dark');
  const bubbleMine = dark ? '#9A7B4F' : '#E8DFD0';
  const bubbleOther = dark ? '#1A1612' : '#FFFCF7';
  const nameColor = dark ? '#F5EFE6' : '#2C2419';
  const msgColor = dark ? '#F5EFE6' : '#2C2419';
  const metaColor = dark ? '#E4D9CC' : '#6B5E50';
  const borderColor = dark ? 'rgba(180,160,140,.28)' : '#E4D9CC';
  const source = currentConversationKey
    ? chatBookingsCache.filter(b=>getConversationKey(b)===currentConversationKey)
    : chatBookingsCache.filter(b=>b.id===currentChatBookingId);
  const messages = source
    .flatMap(b => (Array.isArray(b.messages) ? b.messages : []))
    .sort((a,b)=> String(a.at || '').localeCompare(String(b.at || '')));
  if(!messages.length){
    body.innerText = 'No messages yet. Start the conversation.';
    return;
  }
  body.innerHTML = messages.map(m=>{
    const mine = String(m.senderEmail || '').toLowerCase() === currentUserEmail;
    return `<div style="display:flex;justify-content:${mine ? 'flex-end' : 'flex-start'};margin-bottom:8px"><div style="max-width:76%;padding:8px 10px;border-radius:10px;background:${mine ? bubbleMine : bubbleOther};border:1px solid ${borderColor}"><div style="font-size:12px;font-weight:600;color:${nameColor}">${escapeHtml(m.senderName || m.senderEmail || 'User')}</div><div style="color:${msgColor}">${escapeHtml(m.text || '')}</div><div style="font-size:11px;color:${metaColor};margin-top:4px">${escapeHtml(m.at || '')}</div></div></div>`;
  }).join('');
  body.scrollTop = body.scrollHeight;
  if(currentConversationKey) markConversationKeyRead(currentConversationKey);
  else markConversationRead(currentChatBookingId);
}

function sendAppointmentMessage(){
  const token = localStorage.getItem('lg_token');
  const input = document.getElementById('appointmentChatInput');
  const text = ((input || {}).value || '').trim();
  if(!token || !currentChatBookingId){ toast('Select an appointment first'); return }
  if(!text){ toast('Type a message'); return }
  fetch(apiUrl(`/api/book/${currentChatBookingId}/message`), {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ text })
  })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){
      if(input) input.value = '';
      reloadCurrentDashboard();
      loadAppointmentMessages();
    } else {
      toast(res.error || 'Failed to send');
    }
  })
  .catch(()=>toast('Network error'));
}

// ---------------- Admin Panel ----------------
function guardAdminPage(){
  const token = localStorage.getItem('lg_token');
  if(!token){
    window.location.href = 'auth.html';
    return false;
  }
  const role = getCurrentRole();
  if(!role.startsWith('admin')){
    toast('Admin access only');
    setTimeout(()=> window.location.href = 'index.html', 600);
    return false;
  }
  return true;
}

function loadAdminPanel(){
  if(!guardAdminPage()) return;
  const pendingBox = document.getElementById('adminPendingLawyers');
  const usersBox = document.getElementById('adminUsersTable');
  const actionsBox = document.getElementById('adminActionsLog');
  if(pendingBox) pendingBox.innerText = 'Loading pending applications…';
  if(usersBox) usersBox.innerText = 'Loading users…';
  if(actionsBox) actionsBox.innerText = 'Loading actions…';

  Promise.all([
    fetch(apiUrl('/api/admin/lawyer-applications'), { headers: apiAuthHeaders() }).then(r=>r.json()),
    fetch(apiUrl('/api/admin/users'), { headers: apiAuthHeaders() }).then(r=>r.json()),
    fetch(apiUrl('/api/admin/actions'), { headers: apiAuthHeaders() }).then(r=>r.json())
  ])
  .then(([apps, users, actions])=>{
    renderAdminPending(apps);
    renderAdminUsers(users);
    renderAdminActions(actions);
    const count = (apps.ok && Array.isArray(apps.applications)) ? apps.applications.length : 0;
    const badge = document.getElementById('adminPendingBadge');
    if(badge){
      if(count > 0){
        badge.textContent = String(count);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  })
  .catch(()=>{
    toast('Failed to load admin panel');
    if(pendingBox) pendingBox.innerText = 'Could not load. Check that you are logged in as admin and the server is running.';
  });
}

let adminDocumentCache = {};

function parseLawyerDocument(raw){
  const s = String(raw || '').trim();
  if(!s) return null;
  if(s.startsWith('file:')){
    const pipeIdx = s.indexOf('|');
    if(pipeIdx > 5){
      const name = s.slice(5, pipeIdx) || 'document';
      const data = s.slice(pipeIdx + 1);
      if(data.startsWith('data:')){
        const mime = ((data.match(/^data:([^;,]+)/i) || [])[1] || '').toLowerCase();
        return {
          name,
          data,
          mime,
          isDataUrl: true,
          isImage: mime.startsWith('image/'),
          isPdf: mime === 'application/pdf'
        };
      }
    }
  }
  if(/^https?:\/\//i.test(s)){
    return {
      name: s.length > 48 ? s.slice(0, 45) + '…' : s,
      data: s,
      mime: '',
      isLink: true,
      isImage: /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(s)
    };
  }
  return { name: 'Document link', data: s, mime: '', isText: true };
}

function adminDocumentKey(email, index){
  return `${String(email || '').toLowerCase()}-${index}`;
}

function registerAdminDocumentsForApps(apps){
  adminDocumentCache = {};
  (apps || []).forEach(a=>{
    (Array.isArray(a.documents) ? a.documents : []).forEach((d, i)=>{
      const parsed = parseLawyerDocument(d);
      if(parsed) adminDocumentCache[adminDocumentKey(a.email, i)] = parsed;
    });
  });
}

function ensureAdminDocumentModal(){
  let modal = document.getElementById('adminDocumentModal');
  if(modal) return modal;
  modal = document.createElement('div');
  modal.id = 'adminDocumentModal';
  modal.className = 'admin-document-modal hidden';
  modal.innerHTML = `
    <div class="admin-document-backdrop" onclick="closeAdminDocument()"></div>
    <div class="admin-document-panel" role="dialog" aria-modal="true" aria-labelledby="adminDocumentTitle">
      <div class="admin-document-header">
        <strong id="adminDocumentTitle"></strong>
        <button type="button" class="admin-document-close" onclick="closeAdminDocument()" aria-label="Close">&times;</button>
      </div>
      <div id="adminDocumentBody" class="admin-document-body"></div>
      <div class="admin-document-footer">
        <a id="adminDocumentDownload" class="admin-document-download hidden" href="#" download>Download</a>
        <button type="button" onclick="closeAdminDocument()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

function openAdminDocument(key){
  const doc = adminDocumentCache[key];
  if(!doc){ toast('Document not found'); return; }
  const modal = ensureAdminDocumentModal();
  const title = document.getElementById('adminDocumentTitle');
  const body = document.getElementById('adminDocumentBody');
  const download = document.getElementById('adminDocumentDownload');
  if(title) title.textContent = doc.name || 'Document';
  if(body){
    body.innerHTML = '';
    if(doc.isDataUrl && doc.isImage){
      const img = document.createElement('img');
      img.src = doc.data;
      img.alt = doc.name || 'Uploaded image';
      img.className = 'admin-document-image';
      body.appendChild(img);
    } else if(doc.isDataUrl && (doc.isPdf || doc.mime.startsWith('text/'))){
      const frame = document.createElement('iframe');
      frame.src = doc.data;
      frame.className = 'admin-document-frame';
      frame.title = doc.name || 'Document';
      body.appendChild(frame);
    } else if(doc.isDataUrl){
      const frame = document.createElement('iframe');
      frame.src = doc.data;
      frame.className = 'admin-document-frame';
      body.appendChild(frame);
    } else if(doc.isLink && doc.isImage){
      const img = document.createElement('img');
      img.src = doc.data;
      img.alt = doc.name || 'Image';
      img.className = 'admin-document-image';
      body.appendChild(img);
    } else if(doc.isLink){
      const link = document.createElement('a');
      link.href = doc.data;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = doc.data;
      body.appendChild(link);
    } else {
      body.textContent = doc.data || '';
    }
  }
  if(download){
    if(doc.isDataUrl || doc.isLink){
      download.href = doc.data;
      download.download = doc.name || 'document';
      download.classList.remove('hidden');
    } else {
      download.classList.add('hidden');
    }
  }
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAdminDocument(){
  const modal = document.getElementById('adminDocumentModal');
  if(modal) modal.classList.add('hidden');
  const body = document.getElementById('adminDocumentBody');
  if(body) body.innerHTML = '';
  document.body.style.overflow = '';
}

function openLawyerDocumentPreview(index){
  const parsed = parseLawyerDocument(lawyerDocumentsCache[index]);
  if(!parsed){ toast('Cannot open document'); return; }
  const key = `__lawyer_preview_${index}`;
  adminDocumentCache[key] = parsed;
  openAdminDocument(key);
}

function renderAdminPending(res){
  const box = document.getElementById('adminPendingLawyers');
  if(!box) return;
  if(!res.ok){ box.innerHTML = `<p style="color:#991b1b">${escapeHtml(res.error || 'Failed to load applications')}</p>`; return; }
  const apps = Array.isArray(res.applications) ? res.applications : [];
  registerAdminDocumentsForApps(apps);
  if(!apps.length){
    box.innerHTML = `<p style="color:#6B5E50;margin:0">${escapeHtml(currentLang === 'ar' ? 'لا يوجد محامون بانتظار الموافقة. عند حفظ المحامي لملفه أو نطاق السعر سيظهر هنا.' : 'No lawyers awaiting approval. When a lawyer saves their profile or price range, they will appear here.')}</p>`;
    return;
  }
  box.innerHTML = apps.map(a=>{
    const fees = formatPriceRange({ feeMin: a.feeMin, feeMax: a.feeMax });
    const pic = a.profilePic
      ? lawyerAvatarHtml({ name: a.name, profilePic: a.profilePic }, 'admin')
      : `<div class="lawyer-avatar lawyer-avatar--admin">${escapeHtml(lawyerInitials(a.name))}</div>`;
    return `<div class="admin-pending-card">
      <div class="admin-pending-card-inner">
        ${pic}
        <div style="flex:1;min-width:200px">
          <div style="font-weight:700;font-size:16px">${escapeHtml(a.name)}</div>
          <div style="font-size:13px;color:#6B5E50">${escapeHtml(a.email)}${a.phone ? ' · ' + escapeHtml(a.phone) : ''}</div>
          <div style="margin-top:8px;font-size:14px;line-height:1.5">
            <div><strong>Specialty:</strong> ${escapeHtml(a.specialty || '-')}</div>
            <div><strong>Price range:</strong> ${escapeHtml(fees)}</div>
            ${a.gender ? `<div><strong>Gender:</strong> ${escapeHtml(a.gender)}</div>` : ''}
            ${a.description ? `<div style="margin-top:6px"><strong>Summary:</strong> ${escapeHtml(a.description)}</div>` : ''}
            ${a.practiceDetails ? `<div style="margin-top:4px"><strong>Practice details:</strong> ${escapeHtml(a.practiceDetails)}</div>` : ''}
          </div>
          <div style="margin-top:8px;font-size:13px"><strong>Documents:</strong> ${(Array.isArray(a.documents) && a.documents.length) ? a.documents.map((d, di)=>renderAdminDocument(d, a.email, di)).join('') : 'None'}</div>
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" onclick="approveLawyer('${escapeJs(a.email)}')">${escapeHtml(t('approveLawyer'))}</button>
            <button type="button" onclick="rejectLawyer('${escapeJs(a.email)}')" style="background:#fef2f2;color:#991b1b;border:1px solid #fecaca">${escapeHtml(t('rejectLawyer'))}</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderAdminDocument(doc, email, index){
  const parsed = parseLawyerDocument(doc);
  const key = adminDocumentKey(email, index);
  if(parsed && (parsed.isDataUrl || (parsed.isLink && parsed.isImage))){
    const action = parsed.isImage ? 'View image' : (parsed.isPdf ? 'View PDF' : 'View file');
    return `<div class="admin-doc-row"><button type="button" class="admin-doc-view-btn" onclick="openAdminDocument('${escapeJs(key)}')">📎 ${escapeHtml(parsed.name)} <span class="admin-doc-action">(${escapeHtml(action)})</span></button></div>`;
  }
  if(parsed && parsed.isLink){
    return `<div class="admin-doc-row"><a href="${escapeHtml(parsed.data)}" target="_blank" rel="noopener">🔗 ${escapeHtml(parsed.name)}</a></div>`;
  }
  return `<div class="admin-doc-row">${escapeHtml(String(doc || ''))}</div>`;
}

function renderAdminUsers(res){
  const box = document.getElementById('adminUsersTable');
  if(!box) return;
  if(!res.ok){ box.innerText = res.error || 'Failed'; return; }
  const users = Array.isArray(res.users) ? res.users : [];
  const header = `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;font-weight:700;padding:8px 0;border-bottom:2px solid #E4D9CC;font-size:13px"><div>Email</div><div>Role</div><div>Lawyer status</div><div>Account</div><div>Actions</div></div>`;
  box.innerHTML = header + users.map(u=>{
    const st = String(u.lawyerStatus || '').toLowerCase();
    const statusStyle = st === 'pending' ? 'color:#9A7B4F;font-weight:700' : (st === 'rejected' ? 'color:#991b1b' : 'color:#4A3F32');
    const rowBg = st === 'pending' ? 'background:#FAF3E8' : '';
    return `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:center;border-bottom:1px solid #E4D9CC;padding:8px 0;${rowBg}"><div>${escapeHtml(u.email)} ${u.deletedAt ? '<span style="color:#dc2626">(deleted)</span>' : ''}</div><div>${escapeHtml(u.role || '-')}</div><div style="${statusStyle}">${escapeHtml(u.lawyerStatus || '-')}</div><div>${u.isActive ? 'active' : 'suspended'}</div><div>${u.role && String(u.role).toLowerCase().startsWith('admin') ? '' : `${st === 'pending' ? `<button type="button" onclick="approveLawyer('${escapeJs(u.email)}')">${escapeHtml(t('approve'))}</button> ` : ''}<button type="button" onclick="toggleUserActive('${escapeJs(u.email)}')">${escapeHtml(t('suspend'))}</button> <button type="button" onclick="deleteUserSoft('${escapeJs(u.email)}')">${escapeHtml(t('delete'))}</button>`}</div></div>`;
  }).join('');
}

function renderAdminActions(res){
  const box = document.getElementById('adminActionsLog');
  if(!box) return;
  if(!res.ok){ box.innerText = res.error || 'Failed'; return; }
  const actions = Array.isArray(res.actions) ? res.actions : [];
  if(!actions.length){ box.innerText = 'No actions yet.'; return; }
  box.innerHTML = actions.slice(0, 80).map(a=>`<div style="padding:6px 0;border-bottom:1px solid #E4D9CC"><strong>${escapeHtml(a.action || '')}</strong> — ${escapeHtml(a.targetEmail || '')} <span style="color:#6B5E50">by ${escapeHtml(a.adminEmail || '')} at ${escapeHtml(a.at || '')}</span></div>`).join('');
}

function approveLawyer(email){
  fetch(apiUrl(`/api/admin/lawyers/${encodeURIComponent(email)}/approve`), { method:'POST', headers: apiAuthHeaders() })
  .then(r=>r.json()).then(res=>{ if(res.ok){ toast('Lawyer approved'); loadAdminPanel(); } else toast(res.error||'Failed'); })
  .catch(()=>toast('Network error'));
}

function rejectLawyer(email){
  const reason = prompt('Rejection reason (required — the lawyer will see this):');
  if(reason === null) return;
  const trimmed = String(reason).trim();
  if(!trimmed){ toast('Rejection reason is required'); return; }
  fetch(apiUrl(`/api/admin/lawyers/${encodeURIComponent(email)}/reject`), { method:'POST', headers: { ...apiAuthHeaders(), 'Content-Type':'application/json' }, body: JSON.stringify({ reason: trimmed }) })
  .then(r=>r.json()).then(res=>{ if(res.ok){ toast('Lawyer rejected — they can read your feedback on their dashboard'); loadAdminPanel(); } else toast(res.error||'Failed'); })
  .catch(()=>toast('Network error'));
}

function toggleUserActive(email){
  fetch(apiUrl(`/api/admin/users/${encodeURIComponent(email)}/toggle-active`), { method:'POST', headers: apiAuthHeaders() })
  .then(r=>r.json()).then(res=>{ if(res.ok){ toast('User status updated'); loadAdminPanel(); } else toast(res.error||'Failed'); })
  .catch(()=>toast('Network error'));
}

function deleteUserSoft(email){
  if(!confirm('Soft delete this account?')) return;
  fetch(apiUrl(`/api/admin/users/${encodeURIComponent(email)}`), { method:'DELETE', headers: apiAuthHeaders() })
  .then(r=>r.json()).then(res=>{ if(res.ok){ toast('User deleted'); loadAdminPanel(); } else toast(res.error||'Failed'); })
  .catch(()=>toast('Network error'));
}


/* ========= Toast (extra polish) ========= */
function toast(msg){
  const t=document.createElement("div");
  t.innerText=msg;
  t.style.position="fixed";
  t.style.top="20px";
  t.style.right="20px";
  t.style.background="#22c55e";
  t.style.color="white";
  t.style.padding="10px 16px";
  t.style.borderRadius="10px";

  document.body.appendChild(t);

  setTimeout(()=>t.remove(),2000);
}


/* Activate icons */
setTimeout(()=>{ if(window.lucide) lucide.createIcons(); },100);
