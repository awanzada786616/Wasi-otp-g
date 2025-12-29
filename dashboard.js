import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- API SETTINGS ---
const API_KEY = "e4c5d4fcc56363f572a597267b42e5d2";
const PROXY = "https://corsproxy.io/?";
const BASE_URL = "http://otpget.com/stubs/handler_api.php";

let currentUID = null;
let userBalance = 0;
let pollingTimer = null;

// --- INITIALIZE DASHBOARD ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUID = user.uid;
        document.getElementById('userName').innerText = user.email.split('@')[0];
        
        // Listen to balance changes
        onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                userBalance = doc.data().balance || 0;
                document.getElementById('userBalanceDisplay').innerText = userBalance.toFixed(2);
            }
        });

        loadCountries();
    } else {
        window.location.href = "auth.html";
    }
});

// Helper function to call API via Proxy
async function callApi(params) {
    const url = `${BASE_URL}?api_key=${API_KEY}&${params}`;
    const response = await fetch(PROXY + encodeURIComponent(url));
    return await response.text();
}

// 1. Load Countries
async function loadCountries() {
    try {
        const data = await callApi("action=getCountries");
        const select = document.getElementById('countrySelect');
        select.innerHTML = '<option value="">-- Choose Server --</option>';
        
        data.split('|').forEach(item => {
            const [id, name] = item.split(':');
            if(id && name) {
                let opt = document.createElement('option');
                opt.value = id;
                opt.innerText = name;
                select.appendChild(opt);
            }
        });
    } catch (e) { console.error("Error loading countries"); }
}

// 2. Load Services on Country Change
document.getElementById('countrySelect').addEventListener('change', async (e) => {
    const countryId = e.target.value;
    const sSelect = document.getElementById('serviceSelect');
    if(!countryId) return;

    sSelect.innerHTML = '<option>Loading Services...</option>';

    try {
        const data = await callApi(`action=getServices&country=${countryId}`);
        // otpget returns JSON for services usually
        const services = JSON.parse(data);
        
        sSelect.innerHTML = '<option value="">-- Select Service --</option>';
        services.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s.code;
            // Profit Calculation: (API Price * 5) + 10 RS
            let pkr = Math.ceil((s.price * 5) + 10); 
            opt.innerText = `${s.name.toUpperCase()} - RS ${pkr}`;
            opt.dataset.price = pkr;
            sSelect.appendChild(opt);
        });
    } catch (e) { sSelect.innerHTML = '<option>Error loading</option>'; }
});

// Price Display Update
document.getElementById('serviceSelect').addEventListener('change', (e) => {
    const price = e.target.selectedOptions[0]?.dataset.price || "0.00";
    document.getElementById('finalPrice').innerText = price;
});

// 3. Buy Number Logic
document.getElementById('getNumberBtn').addEventListener('click', async () => {
    const c = document.getElementById('countrySelect').value;
    const s = document.getElementById('serviceSelect').value;
    const price = parseFloat(document.getElementById('serviceSelect').selectedOptions[0]?.dataset.price);

    if(!c || !s) return alert("Select Country & Service!");
    if(userBalance < price) return alert("Insufficient Balance!");

    const btn = document.getElementById('getNumberBtn');
    btn.disabled = true;
    btn.innerText = "Requesting...";

    try {
        const result = await callApi(`action=getNumber&service=${s}&country=${c}`);
        
        if (result.includes("ACCESS_NUMBER")) {
            const [_, id, num] = result.split(':');
            
            // Deduct from Firebase
            await updateDoc(doc(db, "users", currentUID), { balance: userBalance - price });
            
            // Update UI
            showOrder(num, id);
        } else {
            alert("API Message: " + result);
        }
    } catch (e) { alert("API Connection Failed"); }
    btn.disabled = false;
    btn.innerText = "Get Number";
});

// 4. Show Active Order & Poll OTP
function showOrder(num, id) {
    const display = document.getElementById('numberDisplay');
    display.innerHTML = `
        <div class="text-center p-6 w-full max-w-sm">
            <p class="text-xs font-black text-blue-600 uppercase mb-2">Number Ready</p>
            <h2 class="text-4xl font-black text-slate-800 mb-6">${num}</h2>
            <div id="otpBox" class="bg-blue-50 p-6 rounded-2xl border-2 border-dashed border-blue-200 mb-6">
                <p class="animate-pulse text-slate-400 font-bold">Waiting for SMS...</p>
            </div>
            <div class="flex gap-3">
                <button onclick="window.location.reload()" class="flex-1 bg-red-100 text-red-600 py-3 rounded-xl font-bold">Cancel</button>
                <button onclick="navigator.clipboard.writeText('${num}');alert('Copied!')" class="flex-1 bg-blue-100 text-blue-600 py-3 rounded-xl font-bold">Copy</button>
            </div>
        </div>
    `;

    // Start Polling OTP every 5 seconds
    if(pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(async () => {
        const status = await callApi(`action=getStatus&id=${id}`);
        if(status.includes("STATUS_OK")) {
            const code = status.split(':')[1];
            document.getElementById('otpBox').innerHTML = `
                <p class="text-xs font-bold text-green-600 mb-1">CODE RECEIVED!</p>
                <h3 class="text-5xl font-black text-slate-800 tracking-widest">${code}</h3>
            `;
            clearInterval(pollingTimer);
        }
    }, 5000);
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "auth.html");
});

AOS.init({ once: true });
