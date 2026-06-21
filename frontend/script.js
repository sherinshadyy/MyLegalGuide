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
    initHomeLawyerFilters();
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
    if(guardAdminPage()){
      loadAdminPanel();
      applyDashboardHash();
      if(!location.hash) showSection('adminOverview');
    }
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
    slotBuilderIntro:"Pick a date and time, then add slots. Clients will choose from your list when booking.",
    slotPickDate:"Date", slotPickTime:"Time", slotAddOne:"Add slot", slotQuickAdd:"Quick add for selected date:",
    slotMorning:"Morning (9–12)", slotAfternoon:"Afternoon (2–5)", slotListEmpty:"No slots added yet. Add at least one so clients can book.",
    slotDuplicate:"This slot is already in your list", slotPast:"Choose a future date and time", slotNeedDate:"Pick a date first",
    slotNeedTime:"Pick a time", slotAdded:"Slot added", chooseAvailableSlot:"Choose available slot",
    oneSlotPerLine:"One slot per line", saveAvailability:"Save availability", uploadDocs:"Upload documents",
    lawyersPageTitle:"Find a Lawyer", lawyersPageSub:"Search verified lawyers, filter by specialty, gender, and fee, then book a consultation.",
    filterSpecialty:"Specialty", filterGender:"Gender", allSpecialties:"All specialties", anyGender:"Any",
    minFee:"Min. lawyer fee from (EGP)", maxFee:"Max. lawyer fee up to (EGP)", applyFilters:"Apply filters", resetFilters:"Reset",
    lawyerProfilePageTitle:"Lawyer profile", backToLawyers:"← Back to lawyers", phoneLabelProfile:"Phone",
    experienceLabel:"Experience", locationLabel:"Location", consultationDurationLabel:"Consultation duration",
    bookingOptionsLabel:"Booking options", meetingOnline:"Online meeting", meetingInPerson:"In-person meeting",
    meetingTypeLabel:"Meeting type", pickTime:"Pick a time", notProvided:"Not provided", yearsExp:"years",
    minutesShort:"min", noBookingOptions:"No meeting types listed yet",
    loadingLawyers:"Loading lawyers...", noLawyersAvailable:"No lawyers available yet.", bookConsultation:"Book consultation", close:"Close",
    adminTitle:"Admin Control Center", adminSub:"Review lawyers who saved their profile or price range and are waiting to go live on the public lawyers page.",
    adminOverview:"Dashboard", adminOverviewDesc:"Platform overview and quick access to every admin task.", adminQuickAccess:"Quick access",
    adminNavOverview:"Overview", adminNavReview:"Review", adminNavAccounts:"Accounts", adminNavCommunication:"Communication", adminNavSystem:"System",
    adminNavGroup:"Administration", adminPendingDesc:"Review new lawyer profiles and approve or reject them before they appear publicly.",
    adminLawyersTitle:"Lawyers", adminLawyersDesc:"All lawyer accounts — approval status, suspension, and profile management.",
    adminClientsTitle:"Clients", adminClientsDesc:"Client accounts only — separate from lawyer profiles.",
    adminContactsDesc:"Messages sent through the site contact form.", adminActionsDesc:"Audit trail of approvals, rejections, and account changes.",
    adminStatPending:"Pending approvals", adminStatLawyers:"Registered lawyers", adminStatClients:"Client accounts", adminStatUnread:"Unread messages",
    adminSearchLawyers:"Search lawyers by name or email…", adminSearchClients:"Search clients by name or email…",
    adminContactsTitle:"Contact form messages", adminContactsEmpty:"No contact messages yet.", adminMarkRead:"Mark read", adminRead:"Read", adminUnread:"Unread",
    pendingApprovals:"Pending approvals", usersLawyers:"Users & Lawyers", recentActions:"Activity log",
    adminNoPending:"No lawyers awaiting approval. When a lawyer saves their profile or price range, they will appear here.",
    adminNoActions:"No admin actions recorded yet.", adminNoLawyers:"No lawyer accounts yet.", adminNoClients:"No client accounts yet.",
    adminDocuments:"Documents", adminNone:"None", adminJoined:"Joined", adminApprovalStatus:"Approval", adminAccountStatus:"Account",
    adminRecentActivity:"Recent activity",
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
    openSlot:"open slot", openSlots:"open slots", browseAllLawyers:"Browse all lawyers",
    findLawyerTitle:"Find a Lawyer",
    browseLawyersPreview:"Filter by specialty, gender, and consultation fee to find the right lawyer.",
    filterLocation:"Location", filterExperience:"Experience", comingSoon:"Coming soon",
    filtersComingSoon:"More filters coming soon — location, years of experience, and client ratings.",
    bookTitle:"Book a Consultation", chatBtn:"Chat", noLawyersMatch:"No lawyers match your filters. Try resetting filters.",
    genderNotSpecified:"Gender not specified", availableSlots:"available time slot(s)", remove:"Remove",
    suspend:"Suspend", delete:"Delete", approve:"Approve", sending:"Sending…", openDashboard:"Open Dashboard",
    lawyerWorkspace:"Lawyer Workspace", lawyerWorkspaceSub:"Manage your availability, documents, client requests, and appointment chats from your dashboard.",
    voiceInput:"Voice input", voiceStop:"Stop listening", voiceListening:"Listening…", voiceTranscribing:"Transcribing…",
    voiceServerFallback:"Server voice busy — using browser microphone…",
    voiceNotSupported:"Voice input is not supported in this browser yet.", voiceError:"Voice input failed. Try again or type your message.",
    voiceListeningHint:"Speak now — click the mic again when finished.",
    voiceModelLoading:"Loading Egyptian voice model — please wait…",
    voiceModelNotReady:"Voice model is still loading. Make sure the RAG API is running, wait about a minute, then try again.",
    voiceServerRequired:"Accurate Egyptian voice needs the RAG API running (backend/start-rag.ps1).",
    voiceTooShort:"Recording too short — speak for at least 2 seconds, then click the mic to stop.",
    chatUploadDocument:"Upload document", chatUploadFormats:"TXT or PDF · scanned documents supported",
    publicProfileDetailsTitle:"Public profile details (clients see these)", officeLocation:"Office location",
    yearsExperience:"Years of experience", bookingOptionsClients:"Booking options (clients choose when booking)",
    phoneExamplePh:"e.g. 01012345678", yearsExperiencePh:"e.g. 12",
    locationPh:"City, district, or address clients should know", shortDescPh:"Brief headline for listings",
    practiceDetailsPh:"Services, languages, office details…", feeMinPh:"Min", feeMaxPh:"Max",
    selectDuration:"— Select duration —", credentials:"Credentials", certificateUrl:"Certificate URL",
    addLink:"Add link", uploadFiles:"Upload files", maxFilesHint:"Max 3 files, 2MB each.",
    noDocuments:"No documents yet.", noMessagesYet:"No messages yet. Start the conversation.",
    chatWith:"Chat with", loadingProfile:"Loading…", viewDoc:"(view)", viewImage:"(view image)",
    enterDocumentFirst:"Enter a document first", selectApptFirst:"Select an appointment first",
    typeMessageToast:"Type a message",
    previewPublicProfile:"Preview your public profile",
    accountEditHint:"Edit public phone, location, and experience in the section above. Change login email in Settings."
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
    slotBuilderIntro:"اختر التاريخ والوقت ثم أضف المواعيد. سيختار العملاء من قائمتك عند الحجز.",
    slotPickDate:"التاريخ", slotPickTime:"الوقت", slotAddOne:"إضافة موعد", slotQuickAdd:"إضافة سريعة للتاريخ المحدد:",
    slotMorning:"صباحاً (9–12)", slotAfternoon:"بعد الظهر (2–5)", slotListEmpty:"لم تُضف مواعيد بعد. أضف موعداً واحداً على الأقل ليتمكن العملاء من الحجز.",
    slotDuplicate:"هذا الموعد موجود بالفعل", slotPast:"اختر تاريخاً ووقتاً في المستقبل", slotNeedDate:"اختر التاريخ أولاً",
    slotNeedTime:"اختر الوقت", slotAdded:"تمت إضافة الموعد", chooseAvailableSlot:"اختر موعداً متاحاً",
    oneSlotPerLine:"موعد واحد في كل سطر", saveAvailability:"حفظ المواعيد", uploadDocs:"رفع مستندات",
    lawyersPageTitle:"ابحث عن محامي", lawyersPageSub:"ابحث عن محامين معتمدين، وفلتر حسب التخصص والجنس والرسوم، ثم احجز استشارة.",
    filterSpecialty:"التخصص", filterGender:"الجنس", allSpecialties:"كل التخصصات", anyGender:"أي",
    minFee:"أقل رسوم (جنيه)", maxFee:"أقصى رسوم (جنيه)", applyFilters:"تطبيق الفلاتر", resetFilters:"إعادة تعيين",
    lawyerProfilePageTitle:"ملف المحامي", backToLawyers:"← العودة للمحامين", phoneLabelProfile:"الهاتف",
    experienceLabel:"الخبرة", locationLabel:"الموقع", consultationDurationLabel:"مدة الاستشارة",
    bookingOptionsLabel:"خيارات الحجز", meetingOnline:"اجتماع عبر الإنترنت", meetingInPerson:"اجتماع حضوري",
    meetingTypeLabel:"نوع الاجتماع", pickTime:"اختر الموعد", notProvided:"غير متوفر", yearsExp:"سنة",
    minutesShort:"دقيقة", noBookingOptions:"لم يُحدد نوع الاجتماع بعد",
    loadingLawyers:"جاري تحميل المحامين...", noLawyersAvailable:"لا يوجد محامون متاحون بعد.", bookConsultation:"حجز استشارة", close:"إغلاق",
    adminTitle:"مركز تحكم الإدارة", adminSub:"راجع المحامين الذين حفظوا ملفهم أو نطاق السعر وبانتظار النشر على صفحة المحامين.",
    adminOverview:"لوحة التحكم", adminOverviewDesc:"نظرة عامة على المنصة ووصول سريع لكل مهام الإدارة.", adminQuickAccess:"وصول سريع",
    adminNavOverview:"نظرة عامة", adminNavReview:"المراجعة", adminNavAccounts:"الحسابات", adminNavCommunication:"التواصل", adminNavSystem:"النظام",
    adminNavGroup:"الإدارة", adminPendingDesc:"راجع ملفات المحامين الجدد واعتمدها أو ارفضها قبل ظهورها للجمهور.",
    adminLawyersTitle:"المحامون", adminLawyersDesc:"جميع حسابات المحامين — حالة الموافقة والتعليق وإدارة الملف.",
    adminClientsTitle:"العملاء", adminClientsDesc:"حسابات العملاء فقط — منفصلة عن ملفات المحامين.",
    adminContactsDesc:"الرسائل المرسلة عبر نموذج التواصل في الموقع.", adminActionsDesc:"سجل الموافقات والرفض وتغييرات الحسابات.",
    adminStatPending:"موافقات معلقة", adminStatLawyers:"محامون مسجلون", adminStatClients:"حسابات العملاء", adminStatUnread:"رسائل غير مقروءة",
    adminSearchLawyers:"ابحث عن محامٍ بالاسم أو البريد…", adminSearchClients:"ابحث عن عميل بالاسم أو البريد…",
    adminContactsTitle:"رسائل نموذج التواصل", adminContactsEmpty:"لا توجد رسائل تواصل بعد.", adminMarkRead:"تعليم كمقروء", adminRead:"مقروء", adminUnread:"غير مقروء",
    pendingApprovals:"موافقات معلقة", usersLawyers:"المستخدمون والمحامون", recentActions:"سجل النشاط",
    adminNoPending:"لا يوجد محامون بانتظار الموافقة. عند حفظ المحامي لملفه أو نطاق السعر سيظهر هنا.",
    adminNoActions:"لا توجد إجراءات إدارية بعد.", adminNoLawyers:"لا توجد حسابات محامين بعد.", adminNoClients:"لا توجد حسابات عملاء بعد.",
    adminDocuments:"المستندات", adminNone:"لا يوجد", adminJoined:"تاريخ التسجيل", adminApprovalStatus:"الموافقة", adminAccountStatus:"الحساب",
    adminRecentActivity:"آخر النشاط",
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
    openSlot:"موعد متاح", openSlots:"مواعيد متاحة", browseAllLawyers:"تصفح كل المحامين",
    findLawyerTitle:"ابحث عن محامي",
    browseLawyersPreview:"فلتر حسب التخصص والجنس ورسوم الاستشارة للعثور على المحامي المناسب.",
    filterLocation:"الموقع", filterExperience:"الخبرة", comingSoon:"قريباً",
    filtersComingSoon:"المزيد من الفلاتر قريباً — الموقع، سنوات الخبرة، وتقييمات العملاء.",
    bookTitle:"حجز استشارة", chatBtn:"محادثة", noLawyersMatch:"لا يوجد محامون مطابقون. جرّب إعادة تعيين الفلاتر.",
    genderNotSpecified:"الجنس غير محدد", availableSlots:"موعد/مواعيد متاحة", remove:"إزالة",
    suspend:"إيقاف", delete:"حذف", approve:"اعتماد", sending:"جاري الإرسال…", openDashboard:"فتح لوحة التحكم",
    lawyerWorkspace:"مساحة المحامي", lawyerWorkspaceSub:"أدر مواعيدك ومستنداتك وطلبات العملاء ومحادثات المواعيد من لوحة التحكم.",
    voiceInput:"إدخال صوتي", voiceStop:"إيقاف الاستماع", voiceListening:"جاري الاستماع…", voiceTranscribing:"جاري التحويل إلى نص…",
    voiceServerFallback:"الصوت من الخادم مشغول — سيتم استخدام الميكروفون من المتصفح…",
    voiceNotSupported:"الإدخال الصوتي غير مدعوم في هذا المتصفح بعد.", voiceError:"فشل الإدخال الصوتي. حاول مرة أخرى أو اكتب رسالتك.",
    voiceListeningHint:"تحدث الآن — اضغط الميكروفون مرة أخرى عند الانتهاء.",
    voiceModelLoading:"جاري تحميل نموذج الصوت المصري — انتظر قليلاً…",
    voiceModelNotReady:"نموذج الصوت ما زال يُحمّل. تأكد أن خادم RAG يعمل، انتظر دقيقة، ثم حاول مرة أخرى.",
    voiceServerRequired:"للتعرف الدقيق على العامية المصرية يجب تشغيل خادم RAG (backend/start-rag.ps1).",
    voiceTooShort:"التسجيل قصير جداً — تحدث لمدة ثانيتين على الأقل ثم اضغط الميكروفون للإيقاف.",
    chatUploadDocument:"رفع مستند", chatUploadFormats:"TXT أو PDF · المسح الضوئي مدعوم",
    publicProfileDetailsTitle:"تفاصيل الملف العام (يراها العملاء)", officeLocation:"موقع المكتب",
    yearsExperience:"سنوات الخبرة", bookingOptionsClients:"خيارات الحجز (يختارها العميل عند الحجز)",
    phoneExamplePh:"مثال: 01012345678", yearsExperiencePh:"مثال: 12",
    locationPh:"المدينة أو المنطقة أو العنوان الذي يجب أن يعرفه العملاء", shortDescPh:"عنوان مختصر للقوائم",
    practiceDetailsPh:"الخدمات واللغات وتفاصيل المكتب…", feeMinPh:"الحد الأدنى", feeMaxPh:"الحد الأقصى",
    selectDuration:"— اختر المدة —", credentials:"المستندات والشهادات", certificateUrl:"رابط الشهادة",
    addLink:"إضافة رابط", uploadFiles:"رفع ملفات", maxFilesHint:"حد أقصى 3 ملفات، 2MB لكل ملف.",
    noDocuments:"لا توجد مستندات بعد.", noMessagesYet:"لا رسائل بعد. ابدأ المحادثة.",
    chatWith:"محادثة مع", loadingProfile:"جاري التحميل…", viewDoc:"(عرض)", viewImage:"(عرض الصورة)",
    enterDocumentFirst:"أدخل مستنداً أولاً", selectApptFirst:"اختر موعداً أولاً",
    typeMessageToast:"اكتب رسالة",
    previewPublicProfile:"معاينة ملفك العام",
    accountEditHint:"عدّل الهاتف والموقع والخبرة في القسم أعلاه. غيّر بريد تسجيل الدخول من الإعدادات."
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

function populateConsultationDurationSelect(sel){
  if(!sel) return;
  const cur = sel.value;
  const mins = [15, 30, 45, 60, 90, 120];
  sel.innerHTML = `<option value="">${escapeHtml(t('selectDuration'))}</option>` +
    mins.map(m => `<option value="${m}">${m} ${escapeHtml(t('minutesShort'))}</option>`).join('');
  if(cur) sel.value = cur;
}

let currentLang="en";
let currentChatBookingId = '';
let currentChatPartnerName = '';
let lawyerDocumentsCache = [];
let lawyerSlotsCache = [];
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
    body.availabilitySlots = lawyerSlotsCache.slice();
    body.availability = lawyerSlotsCache.join('\n');
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

function initHomeLawyerFilters(){
  const specialtySel = document.getElementById('filterSpecialty');
  if(!specialtySel || !document.getElementById('lawyersPreview')) return;
  populateSpecialtySelect(specialtySel, true);
  fetch(apiUrl('/api/lawyers/meta')).then(r=>r.json()).then(res=>{
    if(res.ok && Array.isArray(res.specialties) && res.specialties.length){
      PERSONAL_STATUS_SPECIALTIES.length = 0;
      res.specialties.forEach(s=>PERSONAL_STATUS_SPECIALTIES.push(s));
      populateSpecialtySelect(specialtySel, true);
    }
  }).catch(()=>{});
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
  const preview = document.getElementById('lawyersPreview');
  if(!grid && !preview) return;
  if(grid) grid.innerHTML = `<p class="lawyers-empty">${escapeHtml(t('loadingLawyers'))}</p>`;
  if(preview) preview.innerHTML = `<p class="lawyers-empty">${escapeHtml(t('loadingLawyers'))}</p>`;
  fetchLawyersList(buildLawyerFiltersQuery()).then(lawyers=>{
    if(grid) renderLawyersInto(grid, lawyers, { canBook: !isLawyerOrAdmin() });
    if(preview){
      const list = lawyers.slice(0, 3);
      renderLawyersInto(preview, list, { compact: true, canBook: !isLawyerOrAdmin() });
    }
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
    ? `<ul class="lawyer-profile-slot-list">${slots.map(s => `<li>${escapeHtml(formatSlotLabel(s))}</li>`).join('')}</ul>`
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
  populateConsultationDurationSelect(document.getElementById('profileConsultationDuration'));
  renderLawyerRejectionNotice();
  refreshDynamicTranslations();
  if(document.getElementById('lawyerSlotsList')) renderLawyerSlotsList();
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
    const activeSection = (location.hash || '').replace('#', '').trim() || 'adminOverview';
    updateAdminSectionHeader(activeSection);
  }
  const bookTitle = document.getElementById('bookingTitle');
  if(bookTitle) bookTitle.textContent = t('bookTitle');
  const bookSubmit = document.getElementById('bookSubmit');
  if(bookSubmit && !bookSubmit.disabled) bookSubmit.textContent = t('confirm');
  const chatLabel = document.getElementById('chatPartnerLabel');
  if(chatLabel){
    if(currentChatBookingId && currentChatPartnerName){
      chatLabel.textContent = `${t('chatWith')} ${currentChatPartnerName}`;
    } else if(!currentChatBookingId){
      chatLabel.textContent = t('chooseConversation');
    }
  }
  if(document.getElementById('appointmentChatBody') && currentChatBookingId) loadAppointmentMessages();
  if(document.getElementById('documentsList')) renderLawyerDocuments();
  const u = getCurrentUserObj();
  if(document.getElementById('profileInfo') && u) renderAccountProfileInfo(u);
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
  conv.messages = aiChatHistory.map(m => {
    const row = { role: m.role, content: m.content };
    if(m.documentText) row.documentText = m.documentText;
    if(m.documentTitle) row.documentTitle = m.documentTitle;
    return row;
  });
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

function sanitizeDownloadFilename(title, fallback){
  const base = String(title || fallback || 'document')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'document';
  return base;
}

function triggerFileDownload(blob, filename){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

function formatDocInline(text){
  let s = escapeHtml(String(text || ''));
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[(.+?)\]/g, '<span class="doc-placeholder">[$1]</span>');
  return s;
}

function parseLegalDocumentBodyToHtml(text){
  const lines = String(text || '').split(/\r?\n/);
  const parts = [];
  let inList = false;

  function closeList(){
    if(inList){ parts.push('</ul>'); inList = false; }
  }

  for(const line of lines){
    const trimmed = line.trim();
    if(!trimmed){
      closeList();
      parts.push('<p class="doc-spacer">&nbsp;</p>');
      continue;
    }
    const sectionHeading = trimmed.match(/^\*\*(.+)\*\*$/);
    if(sectionHeading){
      closeList();
      parts.push(`<h2 class="doc-section">${escapeHtml(sectionHeading[1])}</h2>`);
      continue;
    }
    if(/^(?:البند\s*)?\(?\d+\)?[\.\)\-–:]\s*/.test(trimmed) || /^المادة\s*(?:رقم\s*)?\(?\d+\)?/.test(trimmed)){
      closeList();
      parts.push(`<p class="doc-clause">${formatDocInline(trimmed)}</p>`);
      continue;
    }
    if(/^[•\-–]\s+/.test(trimmed)){
      if(!inList){ parts.push('<ul class="doc-ul">'); inList = true; }
      parts.push(`<li class="doc-li">${formatDocInline(trimmed.replace(/^[•\-–]\s+/, ''))}</li>`);
      continue;
    }
    if(/^_{3,}$/.test(trimmed) || /^-{3,}$/.test(trimmed)){
      closeList();
      parts.push('<hr class="doc-hr" />');
      continue;
    }
    closeList();
    parts.push(`<p class="doc-p">${formatDocInline(trimmed)}</p>`);
  }
  closeList();
  return parts.join('\n');
}

function buildLegalDocumentWordHtml(documentTitle, documentText){
  const title = escapeHtml(String(documentTitle || 'مسودة قانونية').trim());
  const bodyHtml = parseLegalDocumentBodyToHtml(documentText);
  const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="MyLegalGuide">
<title>${title}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 2.5cm 2cm 2.5cm 2cm; }
  body {
    font-family: 'Traditional Arabic', 'Arial', 'Tahoma', sans-serif;
    font-size: 14pt;
    line-height: 1.9;
    direction: rtl;
    text-align: right;
    color: #1a1a1a;
    margin: 0;
    padding: 24px 32px;
  }
  .doc-header { text-align: center; margin-bottom: 28px; border-bottom: 2px solid #2c5282; padding-bottom: 18px; }
  .doc-kicker { font-size: 11pt; color: #4a5568; letter-spacing: 0.5px; margin-bottom: 8px; }
  .doc-title { font-size: 22pt; font-weight: bold; color: #1a365d; margin: 8px 0 6px; }
  .doc-meta { font-size: 11pt; color: #718096; }
  .doc-body { margin-top: 8px; }
  .doc-section {
    font-size: 15pt;
    font-weight: bold;
    color: #2c5282;
    margin: 22px 0 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid #cbd5e0;
  }
  .doc-p { margin: 0 0 10px; text-align: justify; text-justify: inter-word; }
  .doc-clause {
    margin: 0 0 12px;
    padding-right: 14px;
    text-align: justify;
    border-right: 3px solid #e2e8f0;
  }
  .doc-ul { margin: 6px 0 14px; padding-right: 28px; }
  .doc-li { margin-bottom: 6px; text-align: justify; }
  .doc-placeholder {
    background: #fff8e6;
    border-bottom: 1px dashed #d69e2e;
    padding: 0 4px;
    color: #744210;
  }
  .doc-spacer { margin: 0; height: 6px; line-height: 6px; }
  .doc-hr { border: none; border-top: 1px solid #e2e8f0; margin: 18px 0; }
  .doc-footer {
    margin-top: 32px;
    padding-top: 14px;
    border-top: 1px solid #e2e8f0;
    font-size: 10pt;
    color: #718096;
    text-align: center;
    font-style: italic;
  }
  .sig-table { width: 100%; margin-top: 24px; border-collapse: collapse; }
  .sig-table td { width: 50%; vertical-align: top; padding: 12px 8px; text-align: center; }
  .sig-line { display: block; margin-top: 48px; border-top: 1px solid #333; width: 80%; margin-left: auto; margin-right: auto; }
</style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-kicker">جمهورية مصر العربية — مسودة قانونية</div>
    <h1 class="doc-title">${title}</h1>
    <div class="doc-meta">تاريخ الإعداد: ${escapeHtml(today)}</div>
  </div>
  <div class="doc-body">
    ${bodyHtml}
  </div>
  <div class="doc-footer">
    تم إنشاء هذه المسودة بواسطة MyLegalGuide للأغراض الإرشادية فقط — يُرجى مراجعتها من محامٍ مرخص قبل التوقيع أو الاستخدام الرسمي.
  </div>
</body>
</html>`;
}

function downloadGeneratedDocument(documentText, documentTitle, format){
  const title = sanitizeDownloadFilename(documentTitle, 'legal_document');
  const text = String(documentText || '');
  if(!text.trim()) return;
  if(format === 'doc'){
    const html = buildLegalDocumentWordHtml(documentTitle, text);
    triggerFileDownload(new Blob(['\ufeff', html], { type: 'application/msword' }), title + '.doc');
  } else {
    const plain = text
      .replace(/^\*\*(.+)\*\*$/gm, '\n═══ $1 ═══\n')
      .replace(/^$/gm, '');
    triggerFileDownload(new Blob(['\ufeff', plain], { type: 'text/plain;charset=utf-8' }), title + '.txt');
  }
}

function attachDocumentDownloadBar(bubble, documentText, documentTitle){
  if(!documentText || !bubble) return;
  const bar = document.createElement('div');
  bar.className = 'chat-doc-download';
  const docBtn = document.createElement('button');
  docBtn.type = 'button';
  docBtn.className = 'chat-doc-btn primary';
  docBtn.textContent = currentLang === 'ar' ? '⬇ تحميل Word' : '⬇ Download Word';
  docBtn.onclick = () => downloadGeneratedDocument(documentText, documentTitle, 'doc');
  const txtBtn = document.createElement('button');
  txtBtn.type = 'button';
  txtBtn.className = 'chat-doc-btn';
  txtBtn.textContent = currentLang === 'ar' ? '⬇ تحميل نص' : '⬇ Download TXT';
  txtBtn.onclick = () => downloadGeneratedDocument(documentText, documentTitle, 'txt');
  bar.appendChild(docBtn);
  bar.appendChild(txtBtn);
  bubble.appendChild(bar);
}

function fillChatBubble(bubble, content, docMeta){
  if(!bubble) return;
  bubble.classList.remove('loading');
  bubble.innerHTML = formatChatHtml(content);
  if(docMeta && docMeta.documentText){
    attachDocumentDownloadBar(bubble, docMeta.documentText, docMeta.documentTitle);
  }
}

function mapStoredChatMessage(m){
  return {
    role: m.role,
    content: m.content,
    documentText: m.documentText || null,
    documentTitle: m.documentTitle || null,
  };
}

function appendChatMessage(role, content, extraClass, docMeta){
  const body = document.getElementById('chatBody');
  if(!body) return null;
  const row = document.createElement('div');
  row.className = 'chat-row ' + (role === 'user' ? 'user' : 'bot');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + role + (extraClass ? ' ' + extraClass : '');
  if(role === 'bot') fillChatBubble(bubble, content, docMeta);
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
      ? '🤖 مرحباً! اسألني أي سؤال قانوني مصري.\n\n• نفس المحادثة = متابعة الأسئلة\n• اكتب «صيغة عقد زواج» أو «اكتب نموذج إيجار» لإنشاء مسودة قابلة للتحميل\n• 📎 = رفع عقد (TXT أو PDF — حتى الممسوح ضوئياً)\n• ⤢ = تصغير/تكبير النافذة\n\nملاحظة: معلومات عامة وليست استشارة من محامٍ مرخص.'
      : '🤖 Ask an Egyptian legal question.\n\n• Same chat = follow-ups\n• Ask e.g. «write a marriage contract» to generate a downloadable draft\n• 📎 = upload contract (TXT/PDF, scans OK)\n• ⤢ = resize window\n\nNote: general info only, not licensed legal advice.';
    appendChatMessage('bot', welcome);
    return;
  }
  (messages || []).forEach(m => {
    const role = m.role === 'user' ? 'user' : 'bot';
    const docMeta = m.documentText ? { documentText: m.documentText, documentTitle: m.documentTitle } : null;
    appendChatMessage(role, m.content || '', '', docMeta);
  });
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
  aiChatHistory = (conv.messages || []).map(mapStoredChatMessage);
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
      if(conv) aiChatHistory = (conv.messages || []).map(mapStoredChatMessage);
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

function syncChatFullscreenState(){
  const chat = document.getElementById('chatbot');
  if(!chat) return;
  const full = !chat.classList.contains('hidden') && chat.classList.contains('expanded');
  document.body.classList.toggle('chat-fullscreen', full);
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
  } else {
    chat.classList.remove("expanded");
  }
  syncChatFullscreenState();
}

function toggleChatExpand(){
  const chat = document.getElementById("chatbot");
  if(!chat) return;
  chat.classList.toggle("expanded");
  syncChatFullscreenState();
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
    const docMeta = data.documentText
      ? { documentText: data.documentText, documentTitle: data.documentTitle || (currentLang === 'ar' ? 'مسودة قانونية' : 'Legal draft') }
      : null;
    fillChatBubble(loadingBubble, reply, docMeta);
    const assistantMsg = { role: 'assistant', content: reply };
    if(docMeta){
      assistantMsg.documentText = docMeta.documentText;
      assistantMsg.documentTitle = docMeta.documentTitle;
    }
    aiChatHistory.push(assistantMsg);
    if(data.conversationId){
      currentAiConversationId = data.conversationId;
      let conv = getCurrentAiConversation();
      if(!conv){
        conv = { id: data.conversationId, title: data.title || 'محادثة', messages: [], updatedAt: new Date().toISOString() };
        aiConversationsStore.unshift(conv);
      }
      conv.messages = aiChatHistory.map(m => {
        const row = { role: m.role, content: m.content };
        if(m.documentText) row.documentText = m.documentText;
        if(m.documentTitle) row.documentTitle = m.documentTitle;
        return row;
      });
      if(data.title) conv.title = data.title;
      conv.updatedAt = new Date().toISOString();
    } else {
      const conv = getCurrentAiConversation();
      if(conv){
        const userCount = (conv.messages || []).filter(m => m.role === 'user').length;
        if(userCount <= 1) conv.title = text.length > 42 ? text.slice(0, 42) + '…' : text;
        conv.messages = aiChatHistory.map(m => {
          const row = { role: m.role, content: m.content };
          if(m.documentText) row.documentText = m.documentText;
          if(m.documentTitle) row.documentTitle = m.documentTitle;
          return row;
        });
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

/** Canonical slot key: "YYYY-MM-DD HH:MM" */
function canonicalSlotKey(date, time){
  const d = String(date || '').trim();
  const st = String(time || '').trim();
  const tm = st.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  const normTime = tm ? `${String(parseInt(tm[1], 10)).padStart(2, '0')}:${tm[2]}` : st;
  return `${d} ${normTime}`.trim();
}

function normalizeLawyerSlotsArray(slots){
  const seen = new Set();
  const out = [];
  expandAvailabilitySlots(slots).forEach(raw=>{
    const p = parseLawyerSlot(raw);
    const key = (p.date && p.time) ? canonicalSlotKey(p.date, p.time) : String(raw || '').trim();
    if(key && !seen.has(key)){
      seen.add(key);
      out.push(key);
    }
  });
  return out.sort((a, b) => a.localeCompare(b));
}

function formatSlotLabel(canonical){
  const day = formatSlotDayOnly(canonical);
  const time = formatSlotTimeOnly(canonical);
  if(!day || !time) return String(canonical || '');
  if(currentLang === 'ar') return `${day} — ${time}`;
  return `${day} · ${time}`;
}

function formatSlotDayOnly(canonical){
  const p = parseLawyerSlot(canonical);
  if(!p.date) return '';
  const locale = currentLang === 'ar' ? 'ar-EG' : 'en-US';
  const d = new Date(`${p.date}T12:00:00`);
  if(Number.isNaN(d.getTime())) return p.date;
  return d.toLocaleDateString(locale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatSlotTimeOnly(canonical){
  const p = parseLawyerSlot(canonical);
  if(!p.date || !p.time) return '';
  const locale = currentLang === 'ar' ? 'ar-EG' : 'en-US';
  const d = new Date(`${p.date}T${p.time}:00`);
  if(Number.isNaN(d.getTime())) return p.time;
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}

function initLawyerSlotPicker(){
  const dateInput = document.getElementById('slotPickerDate');
  if(!dateInput) return;
  const today = new Date();
  const min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  dateInput.min = min;
  if(!dateInput.value || dateInput.value < min) dateInput.value = min;
}

function setLawyerSlotsFromUser(u){
  const fromSlots = Array.isArray(u && u.availabilitySlots) ? u.availabilitySlots : [];
  const fromText = String((u && u.availability) || '').split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean);
  lawyerSlotsCache = normalizeLawyerSlotsArray(fromSlots.length ? fromSlots : fromText);
  renderLawyerSlotsList();
}

function renderLawyerSlotsList(){
  const list = document.getElementById('lawyerSlotsList');
  const empty = document.getElementById('lawyerSlotsEmpty');
  if(!list) return;
  if(!lawyerSlotsCache.length){
    list.innerHTML = '';
    if(empty) empty.classList.remove('hidden');
    return;
  }
  if(empty) empty.classList.add('hidden');

  const byDate = {};
  lawyerSlotsCache.forEach(key=>{
    const p = parseLawyerSlot(key);
    const day = p.date || key.split(' ')[0] || 'Other';
    if(!byDate[day]) byDate[day] = [];
    byDate[day].push(key);
  });

  const days = Object.keys(byDate).sort();
  list.innerHTML = days.map(day=>{
    const chips = byDate[day].map(key=>{
      const idx = lawyerSlotsCache.indexOf(key);
      return `
      <span class="lawyer-slot-chip">
        <span class="lawyer-slot-chip-time">${escapeHtml(formatSlotTimeOnly(key))}</span>
        <button type="button" class="lawyer-slot-chip-remove" onclick="removeLawyerSlotByIndex(${idx})" aria-label="${escapeHtml(t('remove'))}">×</button>
      </span>`;
    }).join('');
    const dayLabel = formatSlotDayOnly(byDate[day][0]);
    return `<div class="lawyer-slot-day-group">
      <div class="lawyer-slot-day-label">${escapeHtml(dayLabel)}</div>
      <div class="lawyer-slot-day-chips">${chips}</div>
    </div>`;
  }).join('');
}

function getSlotPickerDateValue(){
  const dateInput = document.getElementById('slotPickerDate');
  return dateInput ? String(dateInput.value || '').trim() : '';
}

function addLawyerSlotKey(date, time, opts){
  const silent = !!(opts && opts.silent);
  const key = canonicalSlotKey(date, time);
  if(!key || key.length < 12){ if(!silent) toast(t('slotNeedTime')); return false; }
  const slotDate = new Date(`${date}T${time}:00`);
  if(Number.isNaN(slotDate.getTime())){ if(!silent) toast(t('slotNeedTime')); return false; }
  if(slotDate.getTime() < Date.now() - 60000){ if(!silent) toast(t('slotPast')); return false; }
  if(lawyerSlotsCache.includes(key)){ if(!silent) toast(t('slotDuplicate')); return false; }
  lawyerSlotsCache.push(key);
  lawyerSlotsCache.sort((a, b) => a.localeCompare(b));
  if(!silent){
    renderLawyerSlotsList();
    toast(t('slotAdded'));
  }
  return true;
}

function addLawyerSlotFromPicker(){
  const date = getSlotPickerDateValue();
  const timeInput = document.getElementById('slotPickerTime');
  const time = timeInput ? String(timeInput.value || '').trim().slice(0, 5) : '';
  if(!date){ toast(t('slotNeedDate')); return; }
  if(!time){ toast(t('slotNeedTime')); return; }
  addLawyerSlotKey(date, time);
}

function addLawyerQuickSlots(period){
  const date = getSlotPickerDateValue();
  if(!date){ toast(t('slotNeedDate')); return; }
  const times = period === 'morning'
    ? ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00']
    : ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];
  let added = 0;
  times.forEach(tm=>{ if(addLawyerSlotKey(date, tm, { silent: true })) added++; });
  renderLawyerSlotsList();
  if(added) toast(t('slotAdded'));
  else toast(t('slotDuplicate'));
}

function removeLawyerSlotByIndex(index){
  if(index < 0 || index >= lawyerSlotsCache.length) return;
  lawyerSlotsCache.splice(index, 1);
  renderLawyerSlotsList();
}

function removeLawyerSlot(key){
  removeLawyerSlotByIndex(lawyerSlotsCache.indexOf(key));
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
  const slotList = normalizeLawyerSlotsArray(slots);
  slotSelect.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = t('chooseAvailableSlot');
  slotSelect.appendChild(ph);
  slotList.forEach((key)=>{
    const o = document.createElement('option');
    o.value = key;
    o.textContent = formatSlotLabel(key);
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

function refreshChatBookingsOnly(){
  const token = localStorage.getItem('lg_token');
  if(!token) return Promise.resolve();
  return fetch(apiUrl('/api/bookings'), { headers: { 'Authorization': 'Bearer ' + token } })
    .then(r => r.json())
    .then(res => {
      if(!res.ok) return;
      chatBookingsCache = Array.isArray(res.bookings) ? res.bookings : [];
      computeUnreadFromBookings(chatBookingsCache);
      renderChatConversations();
    })
    .catch(() => {});
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
  const stayOnChat = (location.hash || '').replace('#', '').trim() === 'appointmentChat' && !!currentChatBookingId;
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
    if(stayOnChat){
      showSection('appointmentChat');
      loadAppointmentMessages();
    } else if(!location.hash) {
      showSection('appointments');
    }
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
      const stayOnChat = (location.hash || '').replace('#', '').trim() === 'appointmentChat' && !!currentChatBookingId;
      applyDashboardHash();
      if(stayOnChat){
        showSection('appointmentChat');
        loadAppointmentMessages();
      } else if(!location.hash) {
        showSection('lawyerBookings');
      }
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
      btn.textContent = btn.dataset.prevText || t('savePractice');
    }
  }
}

function formatAccountRole(role){
  const r = String(role || '').toLowerCase();
  if(r.startsWith('law')) return t('lawyer');
  if(r.startsWith('admin')) return 'Admin';
  return t('client');
}

function renderAccountProfileInfo(u){
  const info = document.getElementById('profileInfo');
  if(!info || !u) return;
  const statusLine = isLawyerRole(u.role) && u.lawyerStatus
    ? `<p><strong>${escapeHtml(t('status'))}:</strong> ${escapeHtml(u.lawyerStatus)}</p>` : '';
  const feedbackLine = isLawyerRole(u.role) && String(u.rejectionReason || '').trim()
    ? `<p><strong>${escapeHtml(t('rejectedHint'))}</strong> ${escapeHtml(u.rejectionReason)}</p>` : '';
  const profileLink = isLawyerRole(u.role) && u.email
    ? `<p style="margin-top:10px"><a href="${escapeHtml(lawyerProfilePageUrl(u.email))}" target="_blank" rel="noopener">${escapeHtml(t('previewPublicProfile'))}</a></p>`
    : '';
  info.innerHTML = `<p><strong>${escapeHtml(t('role'))}:</strong> ${escapeHtml(formatAccountRole(u.role))}</p>${statusLine}${feedbackLine}<p><strong>${escapeHtml(t('emailLabel'))}:</strong> ${escapeHtml(u.email || '-')}</p><p><strong>${escapeHtml(t('phoneLabel'))}:</strong> ${escapeHtml(u.phone || '-')}</p><p style="font-size:13px;margin-top:8px">${escapeHtml(t('accountEditHint'))}</p>${profileLink}`;
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
    renderAccountProfileInfo(u);
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
  const documentsList = document.getElementById('documentsList');
  if(!token || !documentsList) return;

  initLawyerSlotPicker();

  fetch(apiUrl('/api/me'), { headers: { 'Authorization': 'Bearer ' + token }})
  .then(r=>r.json())
  .then(res=>{
    if(!res.ok || !res.user) return;
    setLawyerSlotsFromUser(res.user);
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
        setLawyerSlotsFromUser(res.user);
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
  if(!doc){ toast(t('enterDocumentFirst')); return }
  lawyerDocumentsCache.push(doc);
  if(input) input.value = '';
  renderLawyerDocuments();
  saveLawyerProfile();
}

function renderLawyerDocuments(){
  const list = document.getElementById('documentsList');
  if(!list) return;
  if(!lawyerDocumentsCache.length){
    list.innerHTML = `<span>${escapeHtml(t('noDocuments'))}</span>`;
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
        const viewLabel = isImg ? t('viewImage') : t('viewDoc');
        content = `<button type="button" class="admin-doc-view-btn" style="font-size:inherit;padding:2px 8px" onclick="openLawyerDocumentPreview(${i})">${escapeHtml(fileName)} ${escapeHtml(viewLabel)}</button>`;
      }
    }
    return `<div style="margin-bottom:6px"><span>${content}</span> <button type="button" onclick="removeLawyerDocument(${i})">${escapeHtml(t('remove'))}</button></div>`;
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

  const query = document.getElementById('filterSpecialty') ? buildLawyerFiltersQuery() : '';
  fetchLawyersList(query).then(lawyers=>{
    if(!lawyers.length){
      container.innerHTML = `<p class="lawyers-empty">${escapeHtml(preview ? t('noLawyersMatch') : t('noLawyersAvailable'))}</p>`;
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
    appointmentChat: 'chatNavBtn',
    adminOverview: 'adminOverviewNavBtn',
    adminPending: 'adminPendingNavBtn',
    adminLawyers: 'adminLawyersNavBtn',
    adminClients: 'adminClientsNavBtn',
    adminContacts: 'adminContactsNavBtn',
    adminActions: 'adminActionsNavBtn'
  };
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn=>btn.classList.remove('active'));
  const activeId = map[id];
  if(activeId){
    const btn = document.getElementById(activeId);
    if(btn) btn.classList.add('active');
  }
  updateAdminSectionHeader(id);
  if(window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  const hashId = String(id || '').trim();
  if(hashId && document.getElementById(hashId)){
    const nextHash = '#' + hashId;
    if(location.hash !== nextHash){
      try { history.replaceState(null, '', nextHash); } catch(_e){ location.hash = hashId; }
    }
  }
}

const ADMIN_SECTION_META = {
  adminOverview: { titleKey: 'adminOverview', subKey: 'adminOverviewDesc' },
  adminPending: { titleKey: 'pendingApprovals', subKey: 'adminPendingDesc' },
  adminLawyers: { titleKey: 'adminLawyersTitle', subKey: 'adminLawyersDesc' },
  adminClients: { titleKey: 'adminClientsTitle', subKey: 'adminClientsDesc' },
  adminContacts: { titleKey: 'adminContactsTitle', subKey: 'adminContactsDesc' },
  adminActions: { titleKey: 'recentActions', subKey: 'adminActionsDesc' }
};

function updateAdminSectionHeader(sectionId){
  if(!document.body || document.body.dataset.page !== 'admin') return;
  const meta = ADMIN_SECTION_META[sectionId];
  if(!meta) return;
  const title = document.getElementById('adminPageTitle');
  const sub = document.getElementById('adminPageSub');
  if(title) title.textContent = t(meta.titleKey);
  if(sub) sub.textContent = t(meta.subKey);
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
  if(label) label.innerText = `${t('chatWith')} ${currentChatPartnerName}`;
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
    body.innerText = t('noMessagesYet');
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
  if(!token || !currentChatBookingId){ toast(t('selectApptFirst')); return }
  if(!text){ toast(t('typeMessageToast')); return }
  fetch(apiUrl(`/api/book/${currentChatBookingId}/message`), {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ text })
  })
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){
      if(input) input.value = '';
      refreshChatBookingsOnly().then(() => {
        showSection('appointmentChat');
        loadAppointmentMessages();
      });
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

function isAdminLawyerAccount(user){
  return String((user && user.role) || '').toLowerCase().startsWith('law');
}

function isAdminClientAccount(user){
  const role = String((user && user.role) || '').toLowerCase();
  return !role.startsWith('law') && !role.startsWith('admin');
}

function adminFormatJoined(iso){
  if(!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch(_e){
    return String(iso);
  }
}

function adminStatusPill(label, tone){
  return `<span class="admin-pill admin-pill--${tone}">${escapeHtml(label)}</span>`;
}

function adminAccountCell(user){
  const name = escapeHtml(user.name || '—');
  const email = escapeHtml(user.email || '');
  return `<div class="admin-account-cell"><strong>${name}</strong><span>${email}</span></div>`;
}

function adminUserMatchesQuery(user, query){
  const q = String(query || '').trim().toLowerCase();
  if(!q) return true;
  return String(user.name || '').toLowerCase().includes(q) || String(user.email || '').toLowerCase().includes(q);
}

function adminLawyerStatusTone(status){
  const st = String(status || '').toLowerCase();
  if(st === 'approved') return 'success';
  if(st === 'pending') return 'warning';
  if(st === 'rejected') return 'danger';
  return 'neutral';
}

function adminAccountTone(isActive){
  return isActive !== false ? 'success' : 'danger';
}

function adminLawyerActions(user){
  const st = String(user.lawyerStatus || '').toLowerCase();
  const email = escapeJs(user.email);
  return `<div class="admin-table-actions">${st === 'pending' ? `<button type="button" class="admin-btn-sm admin-btn-approve" onclick="approveLawyer('${email}')">${escapeHtml(t('approve'))}</button><button type="button" class="admin-btn-sm admin-btn-danger" onclick="rejectLawyer('${email}')">${escapeHtml(t('rejectLawyer'))}</button>` : ''}<button type="button" class="admin-btn-sm admin-btn-muted" onclick="toggleUserActive('${email}')">${escapeHtml(t('suspend'))}</button><button type="button" class="admin-btn-sm admin-btn-danger" onclick="deleteUserSoft('${email}')">${escapeHtml(t('delete'))}</button></div>`;
}

function adminClientActions(user){
  const email = escapeJs(user.email);
  return `<div class="admin-table-actions"><button type="button" class="admin-btn-sm admin-btn-muted" onclick="toggleUserActive('${email}')">${escapeHtml(t('suspend'))}</button><button type="button" class="admin-btn-sm admin-btn-danger" onclick="deleteUserSoft('${email}')">${escapeHtml(t('delete'))}</button></div>`;
}

let adminUsersCache = [];
let adminActionsCache = [];

function updateAdminStats(apps, users, contacts){
  const allUsers = (users && users.ok && Array.isArray(users.users)) ? users.users : [];
  adminUsersCache = allUsers;
  const pendingCount = (apps && apps.ok && Array.isArray(apps.applications)) ? apps.applications.length : 0;
  const lawyerCount = allUsers.filter(u => isAdminLawyerAccount(u) && !u.deletedAt).length;
  const clientCount = allUsers.filter(u => isAdminClientAccount(u) && !u.deletedAt).length;
  const contactList = (contacts && contacts.ok && Array.isArray(contacts.contacts)) ? contacts.contacts : [];
  const unreadCount = contactList.filter(c => !c.isRead).length;

  function setBadge(id, count, muted){
    const badge = document.getElementById(id);
    if(!badge) return;
    if(count > 0){
      badge.textContent = String(count);
      badge.classList.remove('hidden');
      badge.classList.toggle('admin-nav-badge--muted', !!muted);
    } else {
      badge.classList.add('hidden');
    }
  }

  setBadge('adminPendingBadge', pendingCount, false);
  setBadge('adminContactsUnreadBadge', unreadCount, false);
  setBadge('adminLawyersCountBadge', lawyerCount, true);
  setBadge('adminClientsCountBadge', clientCount, true);

  const stats = {
    adminStatPending: pendingCount,
    adminStatLawyers: lawyerCount,
    adminStatClients: clientCount,
    adminStatUnread: unreadCount,
    adminQuickPending: pendingCount,
    adminQuickLawyers: lawyerCount,
    adminQuickClients: clientCount,
    adminQuickUnread: unreadCount
  };
  Object.keys(stats).forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = String(stats[id]);
  });
}

function renderAdminOverviewRecent(){
  const box = document.getElementById('adminOverviewRecent');
  if(!box) return;
  const actions = Array.isArray(adminActionsCache) ? adminActionsCache.slice(0, 5) : [];
  if(!actions.length){
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `<h3 class="admin-overview-recent-title">${escapeHtml(t('adminRecentActivity'))}</h3>` + actions.map(a=>`<div class="admin-action-item admin-action-item--compact"><span class="admin-action-type">${escapeHtml(a.action || '')}</span><span class="admin-action-target">${escapeHtml(a.targetEmail || '')}</span><span class="admin-action-meta">${escapeHtml(a.at || '')}</span></div>`).join('');
}

function loadAdminPanel(){
  if(!guardAdminPage()) return;
  const pendingBox = document.getElementById('adminPendingLawyers');
  const lawyersBox = document.getElementById('adminLawyersTable');
  const clientsBox = document.getElementById('adminClientsTable');
  const actionsBox = document.getElementById('adminActionsLog');
  const contactsBox = document.getElementById('adminContactsTable');
  if(pendingBox) pendingBox.innerText = 'Loading pending applications…';
  if(lawyersBox) lawyersBox.innerText = 'Loading lawyers…';
  if(clientsBox) clientsBox.innerText = 'Loading clients…';
  if(actionsBox) actionsBox.innerText = 'Loading actions…';
  if(contactsBox) contactsBox.innerText = 'Loading messages…';

  Promise.all([
    fetch(apiUrl('/api/admin/lawyer-applications'), { headers: apiAuthHeaders() }).then(r=>r.json()),
    fetch(apiUrl('/api/admin/users'), { headers: apiAuthHeaders() }).then(r=>r.json()),
    fetch(apiUrl('/api/admin/actions'), { headers: apiAuthHeaders() }).then(r=>r.json()),
    fetch(apiUrl('/api/admin/contacts'), { headers: apiAuthHeaders() }).then(r=>r.json())
  ])
  .then(([apps, users, actions, contacts])=>{
    adminActionsCache = (actions && actions.ok && Array.isArray(actions.actions)) ? actions.actions : [];
    renderAdminPending(apps);
    renderAdminLawyers(users);
    renderAdminClients(users);
    renderAdminActions(actions);
    renderAdminContacts(contacts);
    updateAdminStats(apps, users, contacts);
    renderAdminOverviewRecent();
    if(window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  })
  .catch(()=>{
    toast('Failed to load admin panel');
    if(pendingBox) pendingBox.innerText = 'Could not load. Check that you are logged in as admin and the server is running.';
  });
}

function filterAdminLawyers(query){
  renderAdminLawyers({ ok: true, users: adminUsersCache }, query);
}

function filterAdminClients(query){
  renderAdminClients({ ok: true, users: adminUsersCache }, query);
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
  if(!res.ok){ box.innerHTML = `<p class="admin-empty-msg" style="color:#991b1b">${escapeHtml(res.error || 'Failed to load applications')}</p>`; return; }
  const apps = Array.isArray(res.applications) ? res.applications : [];
  registerAdminDocumentsForApps(apps);
  if(!apps.length){
    box.innerHTML = `<p class="admin-empty-msg">${escapeHtml(t('adminNoPending'))}</p>`;
    return;
  }
  box.innerHTML = `<div class="admin-pending-list">${apps.map(a=>{
    const fees = formatPriceRange({ feeMin: a.feeMin, feeMax: a.feeMax });
    const pic = a.profilePic
      ? lawyerAvatarHtml({ name: a.name, profilePic: a.profilePic }, 'admin')
      : `<div class="lawyer-avatar lawyer-avatar--admin">${escapeHtml(lawyerInitials(a.name))}</div>`;
    const docs = (Array.isArray(a.documents) && a.documents.length)
      ? a.documents.map((d, di)=>renderAdminDocument(d, a.email, di)).join('')
      : `<span class="dash-muted-text">${escapeHtml(t('adminNone'))}</span>`;
    return `<div class="admin-pending-card">
      <div class="admin-pending-card-inner">
        ${pic}
        <div style="flex:1;min-width:220px">
          <div style="font-weight:700;font-size:16px">${escapeHtml(a.name)}</div>
          <div class="dash-muted-text" style="font-size:13px;margin-top:2px">${escapeHtml(a.email)}${a.phone ? ' · ' + escapeHtml(a.phone) : ''}</div>
          <dl class="admin-pending-meta">
            <div><dt>${escapeHtml(t('specialty'))}</dt><dd>${escapeHtml(a.specialty || '-')}</dd></div>
            <div><dt>${escapeHtml(t('priceRange'))}</dt><dd>${escapeHtml(fees)}</dd></div>
            ${a.gender ? `<div><dt>${escapeHtml(t('genderShown'))}</dt><dd>${escapeHtml(a.gender)}</dd></div>` : ''}
          </dl>
          ${a.description ? `<div class="admin-pending-summary"><strong>${escapeHtml(t('shortDesc'))}:</strong> ${escapeHtml(a.description)}</div>` : ''}
          ${a.practiceDetails ? `<div class="admin-pending-practice"><strong>${escapeHtml(t('practiceDetails'))}:</strong> ${escapeHtml(a.practiceDetails)}</div>` : ''}
          <div class="admin-pending-docs"><strong>${escapeHtml(t('adminDocuments'))}:</strong> ${docs}</div>
          <div class="admin-pending-actions">
            <button type="button" onclick="approveLawyer('${escapeJs(a.email)}')">${escapeHtml(t('approveLawyer'))}</button>
            <button type="button" class="admin-btn-danger" onclick="rejectLawyer('${escapeJs(a.email)}')">${escapeHtml(t('rejectLawyer'))}</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
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

function renderAdminLawyers(res, query){
  const box = document.getElementById('adminLawyersTable');
  if(!box) return;
  if(!res.ok){ box.innerHTML = `<p class="admin-empty-msg" style="color:#991b1b">${escapeHtml(res.error || 'Failed')}</p>`; return; }
  const lawyers = (Array.isArray(res.users) ? res.users : []).filter(isAdminLawyerAccount).filter(u=>adminUserMatchesQuery(u, query));
  if(!lawyers.length){
    box.innerHTML = `<p class="admin-empty-msg">${escapeHtml(query ? (currentLang === 'ar' ? 'لا توجد نتائج.' : 'No matching lawyers.') : t('adminNoLawyers'))}</p>`;
    return;
  }
  const header = `<div class="admin-table admin-table--lawyers"><div class="admin-table-head"><div>${currentLang === 'ar' ? 'المحامي' : 'Lawyer'}</div><div>${escapeHtml(t('adminApprovalStatus'))}</div><div>${escapeHtml(t('adminAccountStatus'))}</div><div>${escapeHtml(t('adminJoined'))}</div><div>${currentLang === 'ar' ? 'إجراءات' : 'Actions'}</div></div>`;
  box.innerHTML = header + lawyers.map(u=>{
    const st = String(u.lawyerStatus || '').toLowerCase() || '—';
    const statusLabel = st === 'approved' ? (currentLang === 'ar' ? 'معتمد' : 'Approved') : (st === 'pending' ? t('statusPending') : (st === 'rejected' ? (currentLang === 'ar' ? 'مرفوض' : 'Rejected') : st));
    const rowClass = `admin-table-row${st === 'pending' ? ' admin-table-row--pending' : ''}${u.deletedAt ? ' admin-table-row--deleted' : ''}`;
    const accountLabel = u.isActive !== false ? (currentLang === 'ar' ? 'نشط' : 'Active') : (currentLang === 'ar' ? 'موقوف' : 'Suspended');
    return `<div class="${rowClass}"><div>${adminAccountCell(u)}${u.deletedAt ? ` <span class="admin-pill admin-pill--danger">${escapeHtml(currentLang === 'ar' ? 'محذوف' : 'Deleted')}</span>` : ''}</div><div>${adminStatusPill(statusLabel, adminLawyerStatusTone(st))}</div><div>${adminStatusPill(accountLabel, adminAccountTone(u.isActive))}</div><div class="dash-muted-text">${escapeHtml(adminFormatJoined(u.createdAt))}</div><div>${u.deletedAt ? '' : adminLawyerActions(u)}</div></div>`;
  }).join('') + '</div>';
}

function renderAdminClients(res, query){
  const box = document.getElementById('adminClientsTable');
  if(!box) return;
  if(!res.ok){ box.innerHTML = `<p class="admin-empty-msg" style="color:#991b1b">${escapeHtml(res.error || 'Failed')}</p>`; return; }
  const clients = (Array.isArray(res.users) ? res.users : []).filter(isAdminClientAccount).filter(u=>adminUserMatchesQuery(u, query));
  if(!clients.length){
    box.innerHTML = `<p class="admin-empty-msg">${escapeHtml(query ? (currentLang === 'ar' ? 'لا توجد نتائج.' : 'No matching clients.') : t('adminNoClients'))}</p>`;
    return;
  }
  const header = `<div class="admin-table admin-table--clients"><div class="admin-table-head"><div>${currentLang === 'ar' ? 'العميل' : 'Client'}</div><div>${escapeHtml(t('adminAccountStatus'))}</div><div>${escapeHtml(t('adminJoined'))}</div><div>${currentLang === 'ar' ? 'إجراءات' : 'Actions'}</div></div>`;
  box.innerHTML = header + clients.map(u=>{
    const rowClass = `admin-table-row${u.deletedAt ? ' admin-table-row--deleted' : ''}`;
    const accountLabel = u.isActive !== false ? (currentLang === 'ar' ? 'نشط' : 'Active') : (currentLang === 'ar' ? 'موقوف' : 'Suspended');
    return `<div class="${rowClass}"><div>${adminAccountCell(u)}${u.deletedAt ? ` <span class="admin-pill admin-pill--danger">${escapeHtml(currentLang === 'ar' ? 'محذوف' : 'Deleted')}</span>` : ''}</div><div>${adminStatusPill(accountLabel, adminAccountTone(u.isActive))}</div><div class="dash-muted-text">${escapeHtml(adminFormatJoined(u.createdAt))}</div><div>${u.deletedAt ? '' : adminClientActions(u)}</div></div>`;
  }).join('') + '</div>';
}

function renderAdminActions(res){
  const box = document.getElementById('adminActionsLog');
  if(!box) return;
  if(!res.ok){ box.innerHTML = `<p class="admin-empty-msg" style="color:#991b1b">${escapeHtml(res.error || 'Failed')}</p>`; return; }
  const actions = Array.isArray(res.actions) ? res.actions : [];
  if(!actions.length){ box.innerHTML = `<p class="admin-empty-msg">${escapeHtml(t('adminNoActions'))}</p>`; return; }
  box.innerHTML = actions.slice(0, 80).map(a=>`<div class="admin-action-item"><span class="admin-action-type">${escapeHtml(a.action || '')}</span><span class="admin-action-target">${escapeHtml(a.targetEmail || '')}</span><span class="admin-action-meta">${escapeHtml(currentLang === 'ar' ? 'بواسطة' : 'by')} ${escapeHtml(a.adminEmail || '')} · ${escapeHtml(a.at || '')}</span></div>`).join('');
}

function renderAdminContacts(data){
  const box = document.getElementById('adminContactsTable');
  if(!box) return;
  const list = (data && data.ok && Array.isArray(data.contacts)) ? data.contacts : [];
  if(!list.length){
    box.innerHTML = `<p class="admin-empty-msg">${escapeHtml(t('adminContactsEmpty'))}</p>`;
    return;
  }
  const header = `<div class="admin-table admin-table--contacts"><div class="admin-table-head"><div>${currentLang === 'ar' ? 'الاسم' : 'Name'}</div><div>${currentLang === 'ar' ? 'البريد' : 'Email'}</div><div>${currentLang === 'ar' ? 'الرسالة' : 'Message'}</div><div>${currentLang === 'ar' ? 'التاريخ' : 'Date'}</div><div>${currentLang === 'ar' ? 'الحالة' : 'Status'}</div></div>`;
  box.innerHTML = header + list.map(c => {
    const dateLabel = c.createdAt ? new Date(c.createdAt).toLocaleString(currentLang === 'ar' ? 'ar-EG' : undefined) : '';
    const status = c.isRead ? t('adminRead') : t('adminUnread');
    const rowClass = `admin-table-row${c.isRead ? '' : ' admin-table-row--unread'}`;
    const msg = escapeHtml(c.message || '').replace(/\n/g, '<br>');
    const statusClass = c.isRead ? 'admin-pill admin-pill--neutral' : 'admin-pill admin-pill--warning';
    const markBtn = c.isRead ? '' : `<button type="button" class="admin-btn-sm admin-btn-muted" onclick="markAdminContactRead(${Number(c.id)})">${escapeHtml(t('adminMarkRead'))}</button>`;
    return `<div class="${rowClass}"><div>${escapeHtml(c.name || '')}</div><div><a href="mailto:${escapeHtml(c.email || '')}">${escapeHtml(c.email || '')}</a></div><div class="admin-contact-msg">${msg}</div><div class="dash-muted-text" style="font-size:12px">${escapeHtml(dateLabel)}</div><div><span class="${statusClass}">${escapeHtml(status)}</span> ${markBtn}</div></div>`;
  }).join('') + '</div>';
}

function markAdminContactRead(id){
  fetch(apiUrl(`/api/admin/contacts/${encodeURIComponent(id)}/read`), {
    method: 'PATCH',
    headers: apiAuthHeaders()
  })
  .then(r => r.json())
  .then(data => {
    if(!data.ok) throw new Error(data.error || 'Failed');
    loadAdminPanel();
  })
  .catch(() => toast(currentLang === 'ar' ? 'تعذر تحديث الرسالة' : 'Could not update message'));
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
