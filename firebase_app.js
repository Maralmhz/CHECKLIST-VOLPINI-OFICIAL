// firebase_app.js - ARQUITETURA SaaS OTIMIZADA - VOLPINI
// Estrutura: oficinas/{oficina_id}/checklists/{ano}/{mes}/{checklist_id}

// ============================================
// CONFIGURAÇÃO FIREBASE
// ============================================

const getFirebaseConfig = () => {
    if (window.FIREBASE_CONFIG) return window.FIREBASE_CONFIG;

    return {
        apiKey: window.FIREBASE_API_KEY || "CONFIGURE_NO_CONFIG_JS",
        authDomain: "checklist-oficina-72c9e.firebaseapp.com",
        projectId: "checklist-oficina-72c9e",
        storageBucket: "checklist-oficina-72c9e.appspot.com",
        messagingSenderId: window.FIREBASE_SENDER_ID || "CONFIGURE_NO_CONFIG_JS",
        appId: window.FIREBASE_APP_ID || "CONFIGURE_NO_CONFIG_JS"
    };
};

let firebaseApp = null;
let firestoreDB = null;

async function initFirebase() {
    if (firebaseApp) return { app: firebaseApp, db: firestoreDB };

    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const config = getFirebaseConfig();
    if (config.apiKey === "CONFIGURE_NO_CONFIG_JS") {
        throw new Error("Firebase não configurado corretamente.");
    }

    firebaseApp = initializeApp(config);
    firestoreDB = getFirestore(firebaseApp);

    console.log("✅ Firebase inicializado [VOLPINI]");
    return { app: firebaseApp, db: firestoreDB };
}

// ============================================
// HELPERS
// ============================================

function getOficinaId() {
    return window.OFICINA_CONFIG?.oficina_id || "VOLPINI";
}

function gerarCaminhoData(dataISO) {
    const data = new Date(dataISO);
    const ano = String(data.getFullYear());
    const mes = String(data.getMonth() + 1).padStart(2, "0");

    return { ano, mes };
}

function caminhoChecklist(checklistId, dataCriacao) {
    const oficinaId = getOficinaId();
    const { ano, mes } = gerarCaminhoData(dataCriacao);

    return {
        path: `oficinas/${oficinaId}/checklists/${ano}/${mes}`,
        docId: String(checklistId)
    };
}

// ============================================
// SALVAR CHECKLIST
// ============================================

export async function salvarChecklist(checklist) {
    const { db } = await initFirebase();
    const { doc, setDoc, serverTimestamp } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const { path, docId } = caminhoChecklist(checklist.id, checklist.data_criacao);

    const dados = {
        ...checklist,
        oficina_id: getOficinaId(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
    };

    await setDoc(doc(db, path, docId), dados, { merge: true });

    if (checklist.placa) {
        await atualizarIndiceVeiculo(checklist);
    }

    console.log("✅ Checklist salvo com sucesso");
}

// ============================================
// ÍNDICE DE VEÍCULO
// ============================================

async function atualizarIndiceVeiculo(checklist) {
    const { db } = await initFirebase();
    const { doc, setDoc, arrayUnion, serverTimestamp } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const oficinaId = getOficinaId();
    const placa = checklist.placa.replace(/[^A-Z0-9]/g, "").toUpperCase();

    await setDoc(
        doc(db, `oficinas/${oficinaId}/veiculos`, placa),
        {
            placa,
            ultima_visita: checklist.data_criacao,
            historico_ids: arrayUnion(checklist.id),
            updated_at: serverTimestamp()
        },
        { merge: true }
    );
}

// ============================================
// BUSCAR CHECKLISTS COM PAGINAÇÃO
// ============================================

export async function buscarChecklistsMes(ano, mes, limite = 20) {
    const { db } = await initFirebase();
    const { collection, getDocs, query, orderBy, limit } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const oficinaId = getOficinaId();
    const mesFormatado = String(mes).padStart(2, "0");

    const ref = collection(
        db,
        `oficinas/${oficinaId}/checklists/${ano}/${mesFormatado}`
    );

    const q = query(ref, orderBy("data_criacao", "desc"), limit(limite));

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

// ============================================
// BUSCAR CHECKLIST POR ID
// ============================================

export async function buscarChecklistPorId(id, dataCriacao) {
    const { db } = await initFirebase();
    const { doc, getDoc } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const { path, docId } = caminhoChecklist(id, dataCriacao);
    const snap = await getDoc(doc(db, path, docId));

    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ============================================
// DELETAR CHECKLIST
// ============================================

export async function deletarChecklist(id, dataCriacao) {
    const { db } = await initFirebase();
    const { doc, deleteDoc } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const { path, docId } = caminhoChecklist(id, dataCriacao);

    await deleteDoc(doc(db, path, docId));
    console.log("🗑️ Checklist deletado");
}

// ============================================
// HISTÓRICO DE VEÍCULO
// ============================================

export async function buscarHistoricoVeiculo(placa) {
    const { db } = await initFirebase();
    const { doc, getDoc } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const oficinaId = getOficinaId();
    const placaLimpa = placa.replace(/[^A-Z0-9]/g, "").toUpperCase();

    const snap = await getDoc(
        doc(db, `oficinas/${oficinaId}/veiculos`, placaLimpa)
    );

    return snap.exists() ? snap.data() : null;
}

// ============================================
// DEBUG
// ============================================

export async function testarConexao() {
    try {
        await initFirebase();
        return { status: "ok", oficina: getOficinaId() };
    } catch (err) {
        return { status: "erro", mensagem: err.message };
    }
}

if (typeof window !== "undefined") {
    window.firebaseDebug = {
        salvarChecklist,
        buscarChecklistsMes,
        buscarChecklistPorId,
        deletarChecklist,
        buscarHistoricoVeiculo,
        testarConexao
    };

    console.log("🔧 Firebase Debug carregado");
}
