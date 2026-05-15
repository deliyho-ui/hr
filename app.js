import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  getMultiFactorResolver,
  multiFactor,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyANQKxhDx-UXJzjnab7ptPRx4-HjWkdLow",
  authDomain: "hr-ai-50d43.firebaseapp.com",
  projectId: "hr-ai-50d43",
  storageBucket: "hr-ai-50d43.firebasestorage.app",
  messagingSenderId: "456360383598",
  appId: "1:456360383598:web:5d7b1dbef18532041b827f",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const els = {
  loginView: document.querySelector("#loginView"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  loginStatus: document.querySelector("#loginStatus"),
  mfaSetupForm: document.querySelector("#mfaSetupForm"),
  totpQrImage: document.querySelector("#totpQrImage"),
  totpSecretKey: document.querySelector("#totpSecretKey"),
  totpSetupCode: document.querySelector("#totpSetupCode"),
  totpSetupStatus: document.querySelector("#totpSetupStatus"),
  cancelTotpSetupButton: document.querySelector("#cancelTotpSetupButton"),
  mfaVerifyForm: document.querySelector("#mfaVerifyForm"),
  totpSignInCode: document.querySelector("#totpSignInCode"),
  totpSignInStatus: document.querySelector("#totpSignInStatus"),
  cancelTotpSignInButton: document.querySelector("#cancelTotpSignInButton"),
  appShell: document.querySelector("#appShell"),
  userDisplayName: document.querySelector("#userDisplayName"),
  userRole: document.querySelector("#userRole"),
  userEmail: document.querySelector("#userEmail"),
  logoutButton: document.querySelector("#logoutButton"),
  refreshButton: document.querySelector("#refreshButton"),
  addCandidateButton: document.querySelector("#addCandidateButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  navButtons: [...document.querySelectorAll("[data-route]")],
  viewTitle: document.querySelector("#viewTitle"),
  kpiTotal: document.querySelector("#kpiTotal"),
  kpiGreen: document.querySelector("#kpiGreen"),
  kpiManual: document.querySelector("#kpiManual"),
  kpiMissingAi: document.querySelector("#kpiMissingAi"),
  kpiStars: document.querySelector("#kpiStars"),
  tableTitle: document.querySelector("#tableTitle"),
  tableSubtitle: document.querySelector("#tableSubtitle"),
  candidateRows: document.querySelector("#candidateRows"),
  emptyState: document.querySelector("#emptyState"),
  searchInput: document.querySelector("#searchInput"),
  colorFilter: document.querySelector("#colorFilter"),
  detailEmpty: document.querySelector("#detailEmpty"),
  detailContent: document.querySelector("#detailContent"),
  detailTitle: document.querySelector("#detailTitle"),
  detailMeta: document.querySelector("#detailMeta"),
  detailBadge: document.querySelector("#detailBadge"),
  aiAlert: document.querySelector("#aiAlert"),
  aiSummary: document.querySelector("#aiSummary"),
  aiRecommendation: document.querySelector("#aiRecommendation"),
  aiStrengths: document.querySelector("#aiStrengths"),
  aiRisks: document.querySelector("#aiRisks"),
  aiQuestions: document.querySelector("#aiQuestions"),
  detailBackground: document.querySelector("#detailBackground"),
  detailLicense: document.querySelector("#detailLicense"),
  detailMotivation: document.querySelector("#detailMotivation"),
  detailExperience: document.querySelector("#detailExperience"),
  manualClassification: document.querySelector("#manualClassification"),
  processStage: document.querySelector("#processStage"),
  recruiterNote: document.querySelector("#recruiterNote"),
  toggleStarButton: document.querySelector("#toggleStarButton"),
  analyzeCandidateButton: document.querySelector("#analyzeCandidateButton"),
  saveCandidateButton: document.querySelector("#saveCandidateButton"),
  saveStatus: document.querySelector("#saveStatus"),
  openCvButton: document.querySelector("#openCvButton"),
  deleteCandidateButton: document.querySelector("#deleteCandidateButton"),
  stageBar: document.querySelector("#stageBar"),
  historyList: document.querySelector("#historyList"),
  settingsPanel: document.querySelector("#settingsPanel"),
  profileForm: document.querySelector("#profileForm"),
  profileDisplayName: document.querySelector("#profileDisplayName"),
  profileRole: document.querySelector("#profileRole"),
  profileEmail: document.querySelector("#profileEmail"),
  profileStatus: document.querySelector("#profileStatus"),
  screeningSettingsForm: document.querySelector("#screeningSettingsForm"),
  greenThreshold: document.querySelector("#greenThreshold"),
  orangeThreshold: document.querySelector("#orangeThreshold"),
  licenseRequirement: document.querySelector("#licenseRequirement"),
  screeningPrompt: document.querySelector("#screeningPrompt"),
  successProfile: document.querySelector("#successProfile"),
  screeningSettingsStatus: document.querySelector("#screeningSettingsStatus"),
  auditList: document.querySelector("#auditList"),
  addCandidateModal: document.querySelector("#addCandidateModal"),
  addCandidateForm: document.querySelector("#addCandidateForm"),
  closeAddModalButton: document.querySelector("#closeAddModalButton"),
  cancelAddCandidateButton: document.querySelector("#cancelAddCandidateButton"),
  addCandidateStatus: document.querySelector("#addCandidateStatus"),
};

const labels = {
  green: "ירוק",
  orange: "כתום",
  gray: "אפור",
  red: "אדום",
};

const AI_CLIENT_TIMEOUT_MS = 65000;
const AI_PENDING_STALE_MS = 2 * 60 * 1000;

const stageLabels = {
  submitted: "הוגש",
  screened: "סינון",
  phone: "שיחה",
  physical: "פיזי",
  interview: "ראיון",
  decision: "החלטה",
};

const state = {
  route: "dashboard",
  candidates: [],
  auditLogs: [],
  recruiterProfile: null,
  selectedId: null,
  unsubscribe: null,
  auditUnsubscribe: null,
  mfaResolver: null,
  totpSecret: null,
};

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(els.loginStatus, "");

  try {
    await signInWithEmailAndPassword(auth, els.loginEmail.value.trim(), els.loginPassword.value);
  } catch (error) {
    if (error.code === "auth/multi-factor-auth-required") {
      state.mfaResolver = getMultiFactorResolver(auth, error);
      showAuthCard("verify");
      return;
    }
    setStatus(els.loginStatus, "פרטי התחברות שגויים או משתמש לא מורשה.", true);
  }
});

els.logoutButton.addEventListener("click", () => signOut(auth));
els.profileForm.addEventListener("submit", saveRecruiterProfile);
els.screeningSettingsForm.addEventListener("submit", saveScreeningSettings);
els.exportCsvButton.addEventListener("click", exportCandidatesCsv);
els.mfaSetupForm.addEventListener("submit", completeTotpEnrollment);
els.mfaVerifyForm.addEventListener("submit", completeTotpSignIn);
els.cancelTotpSetupButton.addEventListener("click", () => signOut(auth));
els.cancelTotpSignInButton.addEventListener("click", resetToLogin);
els.refreshButton.addEventListener("click", () => render());
els.searchInput.addEventListener("input", render);
els.colorFilter.addEventListener("change", render);
els.saveCandidateButton.addEventListener("click", saveCandidateUpdate);
els.toggleStarButton.addEventListener("click", toggleSelectedStar);
els.analyzeCandidateButton.addEventListener("click", analyzeSelectedCandidate);
els.openCvButton.addEventListener("click", openSelectedCv);
els.deleteCandidateButton.addEventListener("click", deleteSelectedCandidate);
els.addCandidateButton.addEventListener("click", openAddCandidateModal);
els.closeAddModalButton.addEventListener("click", closeAddCandidateModal);
els.cancelAddCandidateButton.addEventListener("click", closeAddCandidateModal);
els.addCandidateForm.addEventListener("submit", addManualCandidate);

els.navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.route = button.dataset.route;
    els.navButtons.forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showAuthCard("login");
    stopCandidatesListener();
    stopAuditListener();
    return;
  }

  const enrolledFactors = multiFactor(user).enrolledFactors || [];
  const hasTotp = enrolledFactors.some((factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID);

  if (!hasTotp) {
    await startTotpEnrollment(user);
    return;
  }

  openApp(user);
});

function showAuthCard(cardName) {
  els.loginView.classList.remove("hidden");
  els.appShell.classList.add("hidden");
  els.loginForm.classList.toggle("hidden", cardName !== "login");
  els.mfaSetupForm.classList.toggle("hidden", cardName !== "setup");
  els.mfaVerifyForm.classList.toggle("hidden", cardName !== "verify");

  if (cardName === "login") {
    state.mfaResolver = null;
    state.totpSecret = null;
    els.loginPassword.value = "";
  }
}

function resetToLogin() {
  state.mfaResolver = null;
  setStatus(els.totpSignInStatus, "");
  els.totpSignInCode.value = "";
  showAuthCard("login");
}

function openApp(user) {
  setUserProfile(user);
  els.loginView.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  startCandidatesListener();
  startAuditListener();
  loadScreeningSettings();
}

async function startTotpEnrollment(user) {
  showAuthCard("setup");
  setStatus(els.totpSetupStatus, "יוצר קוד אבטחה...");
  els.totpSetupCode.value = "";
  els.totpQrImage.removeAttribute("src");
  els.totpSecretKey.textContent = "נטען...";

  try {
    const session = await multiFactor(user).getSession();
    state.totpSecret = await TotpMultiFactorGenerator.generateSecret(session);
    const qrCodeUrl = state.totpSecret.generateQrCodeUrl(user.email || "HR-AI", "HR-AI");
    els.totpQrImage.src = await QRCode.toDataURL(qrCodeUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    els.totpSecretKey.textContent = state.totpSecret.secretKey;
    setStatus(els.totpSetupStatus, "");
  } catch (error) {
    console.error(error);
    let message = "לא ניתן ליצור קוד אימות. בדוק שה־TOTP הופעל בפרויקט Firebase.";
    if (error.code === "auth/unverified-email") {
      message = "שלחנו אימייל אימות. צריך לאמת את כתובת האימייל, לצאת ולהיכנס שוב.";
      try {
        await sendEmailVerification(user);
      } catch (verificationError) {
        console.warn("Email verification was not sent", verificationError);
        message = "צריך לאמת את כתובת האימייל של המשתמש לפני הפעלת TOTP.";
      }
    }
    setStatus(els.totpSetupStatus, message, true);
  }
}

async function completeTotpEnrollment(event) {
  event.preventDefault();
  const user = auth.currentUser;
  const code = els.totpSetupCode.value.trim();

  if (!user || !state.totpSecret) return;
  setStatus(els.totpSetupStatus, "מאמת קוד...");

  try {
    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(state.totpSecret, code);
    await multiFactor(user).enroll(assertion, "HR-AI Authenticator");
    await user.getIdToken(true);
    state.totpSecret = null;
    setStatus(els.totpSetupStatus, "האימות הופעל בהצלחה.");
    openApp(user);
  } catch (error) {
    console.error(error);
    setStatus(els.totpSetupStatus, "הקוד לא אומת. בדוק שהזנת את הקוד העדכני מהאפליקציה.", true);
  }
}

async function completeTotpSignIn(event) {
  event.preventDefault();
  const code = els.totpSignInCode.value.trim();
  const resolver = state.mfaResolver;

  if (!resolver) {
    setStatus(els.totpSignInStatus, "פג תוקף תהליך האימות. נסה להתחבר שוב.", true);
    return;
  }

  const hint = resolver.hints.find((item) => item.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!hint) {
    setStatus(els.totpSignInStatus, "לא נמצא אימות TOTP למשתמש הזה.", true);
    return;
  }

  setStatus(els.totpSignInStatus, "מאמת קוד...");

  try {
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code);
    await resolver.resolveSignIn(assertion);
    state.mfaResolver = null;
    els.totpSignInCode.value = "";
    setStatus(els.totpSignInStatus, "");
  } catch (error) {
    console.error(error);
    setStatus(els.totpSignInStatus, "קוד שגוי או שפג תוקפו. נסה את הקוד החדש שמופיע באפליקציה.", true);
  }
}

async function setUserProfile(user) {
  const fallbackProfile = {
    displayName: user.displayName || user.email || "מגייס",
    role: "מגייס",
    email: user.email || "",
    uid: user.uid,
  };

  applyRecruiterProfile(fallbackProfile);

  try {
    const profileSnapshot = await getDoc(doc(db, "recruiters", user.uid));
    if (!profileSnapshot.exists()) return;

    const profile = profileSnapshot.data();
    applyRecruiterProfile({
      displayName: profile.displayName || fallbackProfile.displayName,
      role: profile.role || "מגייס",
      email: profile.email || fallbackProfile.email,
      uid: user.uid,
    });
  } catch (error) {
    console.warn("Recruiter profile was not loaded", error);
  }
}

function applyRecruiterProfile(profile) {
  state.recruiterProfile = profile;
  els.userDisplayName.textContent = profile.displayName || profile.email || "מגייס";
  els.userRole.textContent = profile.role || "מגייס";
  els.userEmail.textContent = profile.email || "-";
  els.profileDisplayName.value = profile.displayName || "";
  els.profileRole.value = profile.role || "מגייס";
  els.profileEmail.value = profile.email || "";
}

function startCandidatesListener() {
  stopCandidatesListener();
  const candidatesQuery = query(collection(db, "candidates"), orderBy("createdAt", "desc"));

  state.unsubscribe = onSnapshot(
    candidatesQuery,
    (snapshot) => {
      state.candidates = snapshot.docs.map((item) => normalizeCandidate(item.id, item.data()));
      if (!state.selectedId && state.candidates.length) {
        state.selectedId = state.candidates[0].id;
      }
      if (state.selectedId && state.candidates.length && !state.candidates.some((candidate) => candidate.id === state.selectedId)) {
        state.selectedId = state.candidates[0].id;
      }
      if (!state.candidates.length) {
        state.selectedId = null;
      }
      render();
    },
    (error) => {
      console.error(error);
      els.candidateRows.innerHTML = "";
      els.emptyState.classList.remove("hidden");
      els.emptyState.querySelector("strong").textContent = "אין הרשאת קריאה";
      els.emptyState.querySelector("span").textContent = "בדוק Firebase Auth ו־Firestore Rules לדאשבורד.";
    }
  );
}

function stopCandidatesListener() {
  if (state.unsubscribe) {
    state.unsubscribe();
    state.unsubscribe = null;
  }
}

function startAuditListener() {
  stopAuditListener();
  const auditQuery = query(collection(db, "auditLogs"), orderBy("createdAt", "desc"));

  state.auditUnsubscribe = onSnapshot(
    auditQuery,
    (snapshot) => {
      state.auditLogs = snapshot.docs.slice(0, 25).map((item) => ({ id: item.id, ...item.data() }));
      renderAuditLogs();
    },
    (error) => {
      console.warn("Audit logs were not loaded", error);
      els.auditList.innerHTML = `<li>לא ניתן לטעון לוג פעולות. בדוק הרשאות Firestore.</li>`;
    }
  );
}

function stopAuditListener() {
  if (state.auditUnsubscribe) {
    state.auditUnsubscribe();
    state.auditUnsubscribe = null;
  }
}

function normalizeCandidate(id, data) {
  const ai = data.aiAnalysis || {};
  const recruiter = data.recruiter || {};
  const rawAiStatus = ai.status || "missing";
  const aiStartedAt = toDate(ai.startedAt);
  const isStalePending =
    rawAiStatus === "pending" &&
    aiStartedAt &&
    Date.now() - aiStartedAt.getTime() > AI_PENDING_STALE_MS;
  const aiStatus = isStalePending ? "failed" : rawAiStatus;
  const aiError = isStalePending
    ? "הניתוח נשאר במצב המתנה יותר מדי זמן. אפשר לנסות להריץ אותו שוב."
    : String(ai.error || "");
  const hasAi = aiStatus === "completed";
  const manualClassification = recruiter.classification || data.manualClassification;
  const classification = manualClassification || (hasAi ? ai.classification : "gray") || "gray";

  return {
    id,
    raw: data,
    fullName: data.fullName || "ללא שם",
    phone: data.phone || "",
    email: data.email || "",
    city: data.city || "",
    age: data.age || "",
    availability: data.availability || "",
    securityBackground: data.securityBackground || "",
    drivingLicense: data.drivingLicense || "",
    motivation: data.answers?.motivation || "",
    experience: data.answers?.experience || "",
    cvFile: data.cvFile || {},
    createdAt: toDate(data.createdAt),
    aiStatus,
    aiStartedAt,
    aiError,
    hasAi,
    classification,
    score: ai.score ?? null,
    summary: ai.summary || "",
    recommendation: ai.recommendation || "",
    strengths: Array.isArray(ai.strengths) ? ai.strengths : [],
    risks: Array.isArray(ai.risks) ? ai.risks : [],
    questionsToAsk: Array.isArray(ai.questionsToAsk) ? ai.questionsToAsk : [],
    isStarred: Boolean(recruiter.isStarred || data.isStarred || data.referredBy || data.referralSource === "friend"),
    processStage: recruiter.processStage || data.processStage || "submitted",
    recruiterNote: recruiter.note || "",
    referredBy: recruiter.referredBy || data.referredBy || "",
    history: Array.isArray(data.history) ? data.history : [],
  };
}

function render() {
  const routeConfig = getRouteConfig();
  els.viewTitle.textContent = routeConfig.title;
  els.tableTitle.textContent = routeConfig.tableTitle;
  els.tableSubtitle.textContent = routeConfig.subtitle;
  els.settingsPanel.classList.toggle("hidden", state.route !== "settings");

  renderKpis();
  renderRows(routeConfig);
  renderDetail();
  renderAuditLogs();
}

function getRouteConfig() {
  const configs = {
    dashboard: {
      title: "דאשבורד ראשי",
      tableTitle: "מאגר מלא",
      subtitle: "כל המועמדים שנכנסו מדף הנחיתה.",
      filter: () => true,
    },
    full: {
      title: "מאגר מלא",
      tableTitle: "מאגר מלא",
      subtitle: "חלוקה לפי ירוקים, כתומים, אפורים ואדומים.",
      filter: () => true,
    },
    filtered: {
      title: "מאגר מסונן",
      tableTitle: "ירוקים בלבד",
      subtitle: "מועמדים שעברו לסינון חיובי או סומנו ידנית כירוקים.",
      filter: (candidate) => candidate.classification === "green",
    },
    manual: {
      title: "ממתינים לבדיקה ידנית",
      tableTitle: "אפורים וכתומים",
      subtitle: "מועמדים שחסר להם AI, חסר מידע, או נדרשת בדיקה פרטנית.",
      filter: (candidate) => ["gray", "orange"].includes(candidate.classification),
    },
    stars: {
      title: "מומלצים בכוכב",
      tableTitle: "חבר מביא חבר / המלצות",
      subtitle: "מועמדים שסומנו בכוכב או הגיעו דרך המלצה.",
      filter: (candidate) => candidate.isStarred,
    },
    settings: {
      title: "הגדרות סף",
      tableTitle: "מאגר מלא",
      subtitle: "ההגדרות יופעלו בשלב חיבור מנוע ה־AI.",
      filter: () => true,
    },
  };
  return configs[state.route] || configs.dashboard;
}

function getVisibleCandidates(routeConfig) {
  const queryText = els.searchInput.value.trim().toLowerCase();
  const color = els.colorFilter.value;

  return state.candidates
    .filter(routeConfig.filter)
    .filter((candidate) => color === "all" || candidate.classification === color)
    .filter((candidate) => {
      if (!queryText) return true;
      return [candidate.fullName, candidate.phone, candidate.email, candidate.city]
        .join(" ")
        .toLowerCase()
        .includes(queryText);
    });
}

function renderKpis() {
  const total = state.candidates.length;
  const green = state.candidates.filter((candidate) => candidate.classification === "green").length;
  const manual = state.candidates.filter((candidate) => ["gray", "orange"].includes(candidate.classification)).length;
  const missingAi = state.candidates.filter((candidate) => candidate.aiStatus !== "completed").length;
  const stars = state.candidates.filter((candidate) => candidate.isStarred).length;

  els.kpiTotal.textContent = total;
  els.kpiGreen.textContent = green;
  els.kpiManual.textContent = manual;
  els.kpiMissingAi.textContent = missingAi;
  els.kpiStars.textContent = stars;
}

function renderRows(routeConfig) {
  const visibleCandidates = getVisibleCandidates(routeConfig);
  els.candidateRows.innerHTML = "";
  els.emptyState.classList.toggle("hidden", visibleCandidates.length > 0);

  visibleCandidates.forEach((candidate) => {
    const row = document.createElement("tr");
    row.classList.toggle("active", candidate.id === state.selectedId);
    row.innerHTML = `
      <td>
        <div class="candidate-name">
          <strong>${escapeHtml(candidate.fullName)} ${candidate.isStarred ? "★" : ""}</strong>
          <span>${escapeHtml(candidate.phone)} · ${escapeHtml(candidate.city || "ללא עיר")}${candidate.referredBy ? ` · הומלץ ע״י ${escapeHtml(candidate.referredBy)}` : ""}</span>
        </div>
      </td>
      <td><span class="badge ${candidate.classification}">${labels[candidate.classification] || "אפור"}</span></td>
      <td>${renderAiBadge(candidate)}</td>
      <td>${escapeHtml(stageLabels[candidate.processStage] || "הוגש")}</td>
      <td>${escapeHtml(candidate.availability || "-")}</td>
      <td>${candidate.createdAt ? candidate.createdAt.toLocaleDateString("he-IL") : "-"}</td>
    `;
    row.addEventListener("click", () => {
      state.selectedId = candidate.id;
      render();
    });
    els.candidateRows.appendChild(row);
  });
}

function renderAiBadge(candidate) {
  if (candidate.aiStatus === "completed") {
    return `<span class="badge green">נותח${candidate.score !== null ? ` · ${candidate.score}` : ""}</span>`;
  }
  if (candidate.aiStatus === "pending") {
    return `<span class="badge missing-ai">ממתין לניתוח</span>`;
  }
  if (candidate.aiStatus === "failed") {
    return `<span class="badge missing-ai">ניתוח נכשל</span>`;
  }
  return `<span class="badge missing-ai">חסר ניתוח AI</span>`;
}

function renderDetail() {
  const candidate = state.candidates.find((item) => item.id === state.selectedId);
  els.detailEmpty.classList.toggle("hidden", Boolean(candidate));
  els.detailContent.classList.toggle("hidden", !candidate);
  if (!candidate) return;

  els.detailTitle.textContent = candidate.fullName;
  els.detailMeta.textContent = [
    candidate.phone,
    candidate.email,
    candidate.city,
    candidate.referredBy ? `הומלץ ע״י ${candidate.referredBy}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  els.detailBadge.textContent = labels[candidate.classification] || "אפור";
  els.detailBadge.className = `badge ${candidate.classification}`;
  els.aiAlert.classList.toggle("hidden", candidate.aiStatus === "completed");
  updateAiAlert(candidate);
  els.aiSummary.textContent = candidate.summary || getMissingAiSummary(candidate);
  els.aiRecommendation.textContent = candidate.recommendation || "";
  els.aiStrengths.textContent = candidate.strengths.length ? candidate.strengths.join(" · ") : "-";
  els.aiRisks.textContent = candidate.risks.length ? candidate.risks.join(" · ") : "-";
  els.aiQuestions.textContent = candidate.questionsToAsk.length ? candidate.questionsToAsk.join(" · ") : "-";
  els.detailBackground.textContent = candidate.securityBackground || "-";
  els.detailLicense.textContent = candidate.drivingLicense || "-";
  els.detailMotivation.textContent = candidate.motivation || "-";
  els.detailExperience.textContent = candidate.experience || "-";
  els.manualClassification.value = candidate.classification;
  els.processStage.value = candidate.processStage;
  els.recruiterNote.value = candidate.recruiterNote;
  els.toggleStarButton.textContent = candidate.isStarred ? "הסרת כוכב" : "סימון כוכב";
  els.openCvButton.disabled = !candidate.cvFile?.storagePath;
  els.analyzeCandidateButton.disabled = candidate.aiStatus === "pending";
  els.analyzeCandidateButton.textContent = candidate.aiStatus === "pending" ? "בניתוח..." : "ניתוח AI";
  renderStageBar(candidate.processStage);
  renderHistory(candidate.history);
}

function updateAiAlert(candidate) {
  const title = els.aiAlert.querySelector("strong");
  const message = els.aiAlert.querySelector("span");
  if (!title || !message) return;

  if (candidate.aiStatus === "pending") {
    title.textContent = "ניתוח AI בתהליך";
    message.textContent = "המערכת מעבדת את קורות החיים והשאלון. אם זה נמשך יותר מדי זמן, רענן ונסה שוב.";
    return;
  }

  if (candidate.aiStatus === "failed") {
    title.textContent = "ניתוח AI נכשל";
    message.textContent = candidate.aiError || "אפשר להמשיך טיפול ידני או להריץ ניתוח מחדש.";
    return;
  }

  title.textContent = "חסר ניתוח AI";
  message.textContent = "המועמד מוצג לפי קורות החיים והשאלון בלבד. אפשר להמשיך טיפול ידני.";
}

function getMissingAiSummary(candidate) {
  if (candidate.aiStatus === "pending") {
    return "ניתוח AI עדיין בתהליך. אפשר להמתין או לחזור למועמד בעוד רגע.";
  }

  if (candidate.aiStatus === "failed") {
    return candidate.aiError
      ? `ניתוח AI נכשל: ${candidate.aiError}`
      : "ניתוח AI נכשל. אפשר לעבור על השאלון וקורות החיים ידנית או להריץ מחדש.";
  }

  return "אין ניתוח AI זמין. יש לעבור על השאלון וקורות החיים ידנית.";
}

function renderStageBar(currentStage) {
  const stages = Object.keys(stageLabels);
  const currentIndex = Math.max(0, stages.indexOf(currentStage));
  els.stageBar.innerHTML = stages
    .map((stage, index) => `<span class="stage ${index <= currentIndex ? "done" : ""}">${stageLabels[stage]}</span>`)
    .join("");
}

function renderHistory(history) {
  if (!history.length) {
    els.historyList.innerHTML = `<li>אין היסטוריית שינויים עדיין.</li>`;
    return;
  }
  els.historyList.innerHTML = history
    .slice()
    .reverse()
    .map((item) => `<li>${escapeHtml(item.label || "עדכון")} · ${formatDate(item.at)}</li>`)
    .join("");
}

function renderAuditLogs() {
  if (!els.auditList) return;
  if (!state.auditLogs.length) {
    els.auditList.innerHTML = `<li>אין פעולות להצגה עדיין.</li>`;
    return;
  }

  els.auditList.innerHTML = state.auditLogs
    .map((item) => `
      <li>
        <strong>${escapeHtml(item.label || item.action || "פעולה")}</strong>
        <span>${escapeHtml(item.recruiterName || item.recruiterEmail || "מגייס")} · ${formatDate(item.createdAt)}</span>
      </li>
    `)
    .join("");
}

async function saveRecruiterProfile(event) {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const profile = {
    uid: user.uid,
    displayName: els.profileDisplayName.value.trim(),
    role: els.profileRole.value.trim() || "מגייס",
    email: user.email || els.profileEmail.value.trim(),
    updatedAt: serverTimestamp(),
  };

  setStatus(els.profileStatus, "שומר פרופיל...");

  try {
    await setDoc(doc(db, "recruiters", user.uid), profile, { merge: true });
    applyRecruiterProfile(profile);
    await logAudit("profile_update", "עדכון פרופיל מגייס");
    setStatus(els.profileStatus, "הפרופיל נשמר.");
  } catch (error) {
    console.error(error);
    setStatus(els.profileStatus, "לא ניתן לשמור פרופיל. בדוק הרשאות.", true);
  }
}

async function loadScreeningSettings() {
  try {
    const settingsSnapshot = await getDoc(doc(db, "settings", "screening"));
    if (!settingsSnapshot.exists()) return;

    const settings = settingsSnapshot.data();
    els.greenThreshold.value = settings.greenThreshold ?? 80;
    els.orangeThreshold.value = settings.orangeThreshold ?? 60;
    els.licenseRequirement.value = settings.licenseRequirement || "יתרון בלבד";
    els.screeningPrompt.value = settings.screeningPrompt || els.screeningPrompt.value;
    els.successProfile.value = settings.successProfile || "";
  } catch (error) {
    console.warn("Screening settings were not loaded", error);
  }
}

async function saveScreeningSettings(event) {
  event.preventDefault();
  setStatus(els.screeningSettingsStatus, "שומר הגדרות...");

  const settings = {
    greenThreshold: Number(els.greenThreshold.value || 80),
    orangeThreshold: Number(els.orangeThreshold.value || 60),
    licenseRequirement: els.licenseRequirement.value,
    screeningPrompt: els.screeningPrompt.value.trim(),
    successProfile: els.successProfile.value.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || "",
  };

  try {
    await setDoc(doc(db, "settings", "screening"), settings, { merge: true });
    await logAudit("settings_update", "עדכון הגדרות סף ל־AI");
    setStatus(els.screeningSettingsStatus, "הגדרות הסף נשמרו.");
  } catch (error) {
    console.error(error);
    setStatus(els.screeningSettingsStatus, "לא ניתן לשמור הגדרות. בדוק הרשאות.", true);
  }
}

async function saveCandidateUpdate() {
  const candidate = getSelectedCandidate();
  if (!candidate) return;

  setStatus(els.saveStatus, "שומר...");
  const update = {
    recruiter: {
      classification: els.manualClassification.value,
      processStage: els.processStage.value,
      note: els.recruiterNote.value.trim(),
      isStarred: candidate.isStarred,
      updatedAt: serverTimestamp(),
    },
    history: [
      ...candidate.history,
      {
        label: `עדכון מגייס: ${labels[els.manualClassification.value]} / ${stageLabels[els.processStage.value]}`,
        at: new Date().toISOString(),
      },
    ],
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, "candidates", candidate.id), update);
    await logAudit("candidate_update", `עדכון מועמד: ${candidate.fullName}`, candidate);
    setStatus(els.saveStatus, "נשמר בהצלחה.");
  } catch (error) {
    console.error(error);
    setStatus(els.saveStatus, "לא ניתן לשמור. בדוק הרשאות Firestore.", true);
  }
}

async function toggleSelectedStar() {
  const candidate = getSelectedCandidate();
  if (!candidate) return;

  try {
    await updateDoc(doc(db, "candidates", candidate.id), {
      "recruiter.isStarred": !candidate.isStarred,
      "recruiter.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
      history: [
        ...candidate.history,
        {
          label: !candidate.isStarred ? "סומן בכוכב" : "הוסר סימון כוכב",
          at: new Date().toISOString(),
        },
      ],
    });
    await logAudit(
      !candidate.isStarred ? "candidate_star" : "candidate_unstar",
      !candidate.isStarred ? `סימון כוכב: ${candidate.fullName}` : `הסרת כוכב: ${candidate.fullName}`,
      candidate
    );
  } catch (error) {
    console.error(error);
    setStatus(els.saveStatus, "לא ניתן לעדכן כוכב. בדוק הרשאות.", true);
  }
}

async function analyzeSelectedCandidate() {
  const candidate = getSelectedCandidate();
  const user = auth.currentUser;
  if (!candidate || !user) return;

  setStatus(els.saveStatus, "שולח לניתוח AI...");
  els.analyzeCandidateButton.disabled = true;
  els.analyzeCandidateButton.textContent = "בניתוח...";
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AI_CLIENT_TIMEOUT_MS);

  try {
    await setDoc(doc(db, "candidates", candidate.id), {
      aiAnalysis: {
        status: "pending",
        startedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const token = await user.getIdToken(true);
    const response = await fetch("/api/analyze-candidate", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ candidateId: candidate.id }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || "AI analysis failed");
    }

    await logAudit("ai_analyze", `ניתוח AI: ${candidate.fullName}`, candidate);
    setStatus(els.saveStatus, "ניתוח AI הושלם.");
  } catch (error) {
    console.error(error);
    const message = getAnalysisErrorMessage(error);
    await markAnalysisFailed(candidate, message);
    setStatus(els.saveStatus, `ניתוח AI נכשל: ${message}`, true);
  } finally {
    window.clearTimeout(timeoutId);
    els.analyzeCandidateButton.disabled = false;
    els.analyzeCandidateButton.textContent = "ניתוח AI";
  }
}

async function markAnalysisFailed(candidate, message) {
  try {
    await setDoc(doc(db, "candidates", candidate.id), {
      aiAnalysis: {
        status: "failed",
        error: String(message || "שגיאה לא ידועה").slice(0, 500),
        failedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn("Could not save AI failure status", error);
  }
}

function getAnalysisErrorMessage(error) {
  if (error?.name === "AbortError") {
    return "הניתוח לקח יותר מדי זמן ונעצר. נסה שוב, ואם זה חוזר ייתכן שקובץ קורות החיים כבד מדי.";
  }
  return error?.message || "שגיאה לא ידועה";
}

async function openSelectedCv() {
  const candidate = getSelectedCandidate();
  if (!candidate?.cvFile?.storagePath) return;

  try {
    const url = await getDownloadURL(ref(storage, candidate.cvFile.storagePath));
    window.open(url, "_blank", "noopener");
    await logAudit("cv_open", `פתיחת קורות חיים: ${candidate.fullName}`, candidate);
  } catch (error) {
    console.error(error);
    setStatus(els.saveStatus, "לא ניתן לפתוח קורות חיים. בדוק הרשאות Storage.", true);
  }
}

function openAddCandidateModal() {
  els.addCandidateForm.reset();
  setStatus(els.addCandidateStatus, "");
  els.addCandidateModal.showModal();
}

function closeAddCandidateModal() {
  els.addCandidateModal.close();
  setStatus(els.addCandidateStatus, "");
}

async function addManualCandidate(event) {
  event.preventDefault();
  const formData = new FormData(els.addCandidateForm);
  const cvFile = formData.get("cvFile");
  const candidateRef = doc(collection(db, "candidates"));
  const candidateId = candidateRef.id;
  const referredBy = String(formData.get("referredBy") || "").trim();
  const note = String(formData.get("note") || "").trim();

  setStatus(els.addCandidateStatus, "מוסיף מועמד...");

  try {
    let cvFileData = {};

    if (cvFile instanceof File && cvFile.size > 0) {
      validateCvFile(cvFile);
      const storagePath = `candidate-cvs/${candidateId}/${Date.now()}-${safeFileName(cvFile.name)}`;
      await uploadBytes(ref(storage, storagePath), cvFile, {
        contentType: cvFile.type,
        customMetadata: {
          candidateId,
          source: "dashboard-manual",
        },
      });
      cvFileData = {
        name: cvFile.name,
        size: cvFile.size,
        type: cvFile.type,
        storagePath,
      };
    }

    await setDoc(candidateRef, {
      candidateId,
      source: "dashboard-manual",
      status: "new",
      fullName: String(formData.get("fullName") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      age: null,
      availability: String(formData.get("availability") || "לא ידוע"),
      securityBackground: String(formData.get("securityBackground") || "לא ידוע"),
      drivingLicense: String(formData.get("drivingLicense") || "לא ידוע"),
      answers: {
        motivation: "",
        experience: note,
      },
      cvFile: cvFileData,
      aiAnalysis: {
        status: "missing",
      },
      recruiter: {
        classification: "gray",
        processStage: "submitted",
        note,
        isStarred: Boolean(referredBy),
        referredBy,
        updatedAt: serverTimestamp(),
      },
      referredBy,
      referralSource: referredBy ? "friend" : "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      history: [
        {
          label: referredBy ? `נוסף ידנית והומלץ ע״י ${referredBy}` : "נוסף ידנית על ידי מגייס",
          at: new Date().toISOString(),
        },
      ],
    });

    state.selectedId = candidateId;
    await logAudit("candidate_create", `הוספת מועמד ידנית: ${String(formData.get("fullName") || "").trim()}`, {
      id: candidateId,
      fullName: String(formData.get("fullName") || "").trim(),
    });
    setStatus(els.addCandidateStatus, "המועמד נוסף בהצלחה.");
    setTimeout(closeAddCandidateModal, 650);
  } catch (error) {
    console.error(error);
    setStatus(els.addCandidateStatus, error.message || "לא ניתן להוסיף מועמד. בדוק הרשאות.", true);
  }
}

async function deleteSelectedCandidate() {
  const candidate = getSelectedCandidate();
  if (!candidate) return;

  const confirmed = window.confirm(`למחוק את ${candidate.fullName} מהמאגר? הפעולה אינה הפיכה.`);
  if (!confirmed) return;

  setStatus(els.saveStatus, "מוחק מועמד...");

  try {
    if (candidate.cvFile?.storagePath) {
      try {
        await deleteObject(ref(storage, candidate.cvFile.storagePath));
      } catch (storageError) {
        if (storageError.code !== "storage/object-not-found") {
          throw storageError;
        }
      }
    }

    await logAudit("candidate_delete", `מחיקת מועמד: ${candidate.fullName}`, candidate);
    await deleteDoc(doc(db, "candidates", candidate.id));
    state.selectedId = state.candidates.find((item) => item.id !== candidate.id)?.id || null;
    setStatus(els.saveStatus, "");
  } catch (error) {
    console.error(error);
    setStatus(els.saveStatus, "לא ניתן למחוק. בדוק הרשאות Firestore / Storage.", true);
  }
}

async function logAudit(action, label, candidate = null) {
  const user = auth.currentUser;
  if (!user) return;

  const profile = state.recruiterProfile || {};
  const payload = {
    action,
    label,
    recruiterUid: user.uid,
    recruiterName: profile.displayName || user.displayName || user.email || "מגייס",
    recruiterEmail: user.email || profile.email || "",
    candidateId: candidate?.id || "",
    candidateName: candidate?.fullName || "",
    createdAt: serverTimestamp(),
  };

  try {
    await addDoc(collection(db, "auditLogs"), payload);
  } catch (error) {
    console.warn("Audit log was not saved", error);
  }
}

function exportCandidatesCsv() {
  if (!state.candidates.length) {
    window.alert("אין מועמדים לייצוא.");
    return;
  }

  const headers = [
    "שם מלא",
    "טלפון",
    "אימייל",
    "עיר",
    "סיווג",
    "סטטוס AI",
    "שלב בתהליך",
    "זמינות",
    "הומלץ על ידי",
    "הערת מגייס",
    "תאריך יצירה",
  ];

  const rows = state.candidates.map((candidate) => [
    candidate.fullName,
    candidate.phone,
    candidate.email,
    candidate.city,
    labels[candidate.classification] || candidate.classification,
    candidate.aiStatus,
    stageLabels[candidate.processStage] || candidate.processStage,
    candidate.availability,
    candidate.referredBy,
    candidate.recruiterNote,
    candidate.createdAt ? candidate.createdAt.toLocaleString("he-IL") : "",
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hr-ai-candidates-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  logAudit("export_csv", "ייצוא מאגר מועמדים ל־CSV");
}

function getSelectedCandidate() {
  return state.candidates.find((candidate) => candidate.id === state.selectedId);
}

function validateCvFile(file) {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("אפשר להעלות רק PDF, DOC או DOCX.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("קובץ קורות החיים חייב להיות עד 8MB.");
  }
}

function safeFileName(fileName) {
  return fileName
    .trim()
    .replace(/[^\w.\-\u0590-\u05ff]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function toDate(value) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value.toDate?.() || value;
  return date instanceof Date && !Number.isNaN(date.valueOf()) ? date : null;
}

function formatDate(value) {
  if (!value) return "-";
  const date = toDate(value);
  return date ? date.toLocaleString("he-IL") : "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
