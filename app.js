import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
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
  appShell: document.querySelector("#appShell"),
  userEmail: document.querySelector("#userEmail"),
  logoutButton: document.querySelector("#logoutButton"),
  refreshButton: document.querySelector("#refreshButton"),
  addCandidateButton: document.querySelector("#addCandidateButton"),
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
  detailBackground: document.querySelector("#detailBackground"),
  detailLicense: document.querySelector("#detailLicense"),
  detailMotivation: document.querySelector("#detailMotivation"),
  detailExperience: document.querySelector("#detailExperience"),
  manualClassification: document.querySelector("#manualClassification"),
  processStage: document.querySelector("#processStage"),
  recruiterNote: document.querySelector("#recruiterNote"),
  toggleStarButton: document.querySelector("#toggleStarButton"),
  saveCandidateButton: document.querySelector("#saveCandidateButton"),
  saveStatus: document.querySelector("#saveStatus"),
  openCvButton: document.querySelector("#openCvButton"),
  deleteCandidateButton: document.querySelector("#deleteCandidateButton"),
  stageBar: document.querySelector("#stageBar"),
  historyList: document.querySelector("#historyList"),
  settingsPanel: document.querySelector("#settingsPanel"),
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
  selectedId: null,
  unsubscribe: null,
};

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(els.loginStatus, "");

  try {
    await signInWithEmailAndPassword(auth, els.loginEmail.value.trim(), els.loginPassword.value);
  } catch (error) {
    if (error.code === "auth/multi-factor-auth-required") {
      setStatus(els.loginStatus, "נדרש אימות דו שלבי. נחבר את מסך האימות בשלב הבא.", true);
      return;
    }
    setStatus(els.loginStatus, "פרטי התחברות שגויים או משתמש לא מורשה.", true);
  }
});

els.logoutButton.addEventListener("click", () => signOut(auth));
els.refreshButton.addEventListener("click", () => render());
els.searchInput.addEventListener("input", render);
els.colorFilter.addEventListener("change", render);
els.saveCandidateButton.addEventListener("click", saveCandidateUpdate);
els.toggleStarButton.addEventListener("click", toggleSelectedStar);
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

onAuthStateChanged(auth, (user) => {
  if (!user) {
    els.loginView.classList.remove("hidden");
    els.appShell.classList.add("hidden");
    stopCandidatesListener();
    return;
  }

  els.userEmail.textContent = user.email || "מחובר";
  els.loginView.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  startCandidatesListener();
});

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

function normalizeCandidate(id, data) {
  const ai = data.aiAnalysis || {};
  const recruiter = data.recruiter || {};
  const aiStatus = ai.status || "missing";
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
    createdAt: data.createdAt?.toDate?.() || null,
    aiStatus,
    hasAi,
    classification,
    score: ai.score ?? null,
    summary: ai.summary || "",
    recommendation: ai.recommendation || "",
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
  els.aiSummary.textContent = candidate.summary || "אין ניתוח AI זמין. יש לעבור על השאלון וקורות החיים ידנית.";
  els.detailBackground.textContent = candidate.securityBackground || "-";
  els.detailLicense.textContent = candidate.drivingLicense || "-";
  els.detailMotivation.textContent = candidate.motivation || "-";
  els.detailExperience.textContent = candidate.experience || "-";
  els.manualClassification.value = candidate.classification;
  els.processStage.value = candidate.processStage;
  els.recruiterNote.value = candidate.recruiterNote;
  els.toggleStarButton.textContent = candidate.isStarred ? "הסרת כוכב" : "סימון כוכב";
  els.openCvButton.disabled = !candidate.cvFile?.storagePath;
  renderStageBar(candidate.processStage);
  renderHistory(candidate.history);
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
  } catch (error) {
    console.error(error);
    setStatus(els.saveStatus, "לא ניתן לעדכן כוכב. בדוק הרשאות.", true);
  }
}

async function openSelectedCv() {
  const candidate = getSelectedCandidate();
  if (!candidate?.cvFile?.storagePath) return;

  try {
    const url = await getDownloadURL(ref(storage, candidate.cvFile.storagePath));
    window.open(url, "_blank", "noopener");
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

    await deleteDoc(doc(db, "candidates", candidate.id));
    state.selectedId = state.candidates.find((item) => item.id !== candidate.id)?.id || null;
    setStatus(els.saveStatus, "");
  } catch (error) {
    console.error(error);
    setStatus(els.saveStatus, "לא ניתן למחוק. בדוק הרשאות Firestore / Storage.", true);
  }
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

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function formatDate(value) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value.toDate?.() || value;
  return date instanceof Date && !Number.isNaN(date.valueOf())
    ? date.toLocaleString("he-IL")
    : "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
