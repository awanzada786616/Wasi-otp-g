import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. FIREBASE CONFIG ---
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

let currentUID = null;
let userBalance = 0;
let otpPollingInterval = null;

// --- 2. AUTH STATE & INITIAL LOAD ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUID = user.uid;
        document.getElementById('userEmail').innerText = user.email.split('@')[0];
        
        // Real-time Balance Listener (Firebase se balance khud hi update hota rahega)
        onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                userBalance = doc.data().balance || 0;
                document.getElementById('userBalance').innerText = userBalance.toFixed(2);
            }
        });

        loadCountries(); // API se countries load karein
    } else {
        window.location.href = "auth.html";
    }
});

// --- 3. FETCH COUNTRIES (API) ---
async function loadCountries() {
    const countrySelect = document.getElementById('countrySelect');
    try {
        const response = await fetch('/.netlify/functions/api-bridge?action=getCountries');
        const data = await response.json();
        
        // Agar response string hai (e.g. "0:Russia|1:Ukraine")
        let countries = typeof data.message === 'string' ? parsePipeData(data.message) : data;

        countrySelect.innerHTML = '<option value="">-- Select Server --</option>';
        Object.entries(countries).forEach(([id, name]) => {
            let opt = document.createElement('option');
            opt.value = id;
            opt.innerText = name;
            countrySelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Countries Load Error:", err);
        countrySelect.innerHTML = '<option value="">Error Loading Servers</option>';
    }
}

// --- 4. FETCH SERVICES (API) ---
document.getElementById('countrySelect').addEventListener('change', async (e) => {
    const countryId = e.target.value;
    const serviceSelect = document.getElementById('serviceSelect');
    if (!countryId) return;

    serviceSelect.innerHTML = '<option value="">Loading Services...</option>';

    try {
        const response = await fetch(`/.netlify/functions/api-bridge?action=getServices&country=${countryId}`);
        const data = await response.json();
        
        let services = typeof data.message === 'string' ? JSON.parse(data.message) : data;

        serviceSelect.innerHTML = '<option value="">-- Select Service --</option>';
        
        // Services dropdown bharna
        services.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s.code;
            
            // PRICE CALCULATION: Maan lo API price 10 hai, hum usay PKR mein convert kar ke profit add kar rahay hain
            // Formula: (API_Price * Exchange_Rate) + Profit
            let pkrPrice = Math.ceil((s.price * 4) + 15); // Example Calculation
            
            opt.innerText = `${s.name.toUpperCase()} - RS ${pkrPrice}`;
            opt.dataset.price = pkrPrice; 
            serviceSelect.appendChild(opt);
        });
    } catch (err) {
        serviceSelect.innerHTML = '<option value="">Service not available</option>';
    }
});

// Service select hone par price display update karna
document.getElementById('serviceSelect').addEventListener('change', (e) => {
    const selected = e.target.selectedOptions[0];
    const price = selected ? selected.dataset.price : "0.00";
    document.getElementById('priceDisplay').innerText = price;
});

// --- 5. BUY NUMBER LOGIC ---
document.getElementById('getNumberBtn').addEventListener('click', async () => {
    const country = document.getElementById('countrySelect').value;
    const service = document.getElementById('serviceSelect').value;
    const selectedOption = document.getElementById('serviceSelect').selectedOptions[0];
    
    if (!country || !service) {
        alert("Please select both Country and Service!");
        return;
    }

    const price = parseFloat(selectedOption.dataset.price);

    // Balance Check
    if (userBalance < price) {
        alert("In-sufficient Balance! Please add funds.");
        return;
    }

    const btn = document.getElementById('getNumberBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Processing...';

    try {
        // Request Number from Netlify Function
        const response = await fetch(`/.netlify/functions/api-bridge?action=getNumber&country=${country}&service=${service}`);
        const result = await response.json();
        const msg = result.message; // E.g. "ACCESS_NUMBER:ID:NUMBER"

        if (msg.includes("ACCESS_NUMBER")) {
            const parts = msg.split(':');
            const activationId = parts[1];
            const phoneNumber = parts[2];

            // 1. Deduct Balance in Firebase
            const newBalance = userBalance - price;
            await updateDoc(doc(db, "users", currentUID), { balance: newBalance });

            // 2. Show UI
            showActiveNumberUI(phoneNumber, activationId);
        } else {
            alert("API Error: " + msg);
        }
    } catch (err) {
        alert("Failed to connect to API bridge.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Get Number";
    }
});

// --- 6. OTP POLLING (Check OTP every 5s) ---
function showActiveNumberUI(num, id) {
    const display = document.getElementById('activeNumberDisplay');
    display.innerHTML = `
        <div class="w-full text-center p-8 bg-blue-50 rounded-[2rem] border-2 border-blue-100" data-aos="zoom-in">
            <p class="text-xs font-black text-blue-600 uppercase tracking-widest mb-2">Your New Number</p>
            <h2 class="text-4xl font-black text-slate-800 mb-6 tracking-tighter">${num}</h2>
            
            <div id="otpBox" class="bg-white p-6 rounded-2xl border-2 border-dashed border-blue-200 mb-6">
                <p class="text-slate-400 font-bold animate-pulse">Waiting for OTP code...</p>
            </div>

            <div class="flex gap-4 justify-center">
                <button onclick="cancelActivation('${id}')" class="bg-red-100 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-200 transition">Cancel</button>
                <button onclick="copyToClipboard('${num}')" class="bg-blue-100 text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-200 transition">Copy Number</button>
            </div>
        </div>
    `;

    // Start Polling
    if (otpPollingInterval) clearInterval(otpPollingInterval);
    
    otpPollingInterval = setInterval(async () => {
        try {
            const res = await fetch(`/.netlify/functions/api-bridge?action=getStatus&id=${id}`);
            const data = await res.json();
            const status = data.message;

            if (status.includes("STATUS_OK")) {
                const otpCode = status.split(':')[1];
                document.getElementById('otpBox').innerHTML = `
                    <p class="text-xs font-bold text-green-500 uppercase mb-1">OTP Received!</p>
                    <h3 class="text-5xl font-black text-slate-800 tracking-widest">${otpCode}</h3>
                `;
                clearInterval(otpPollingInterval);
                playNotificationSound(); // Optional
            } else if (status === "STATUS_CANCEL") {
                document.getElementById('otpBox').innerHTML = `<p class="text-red-500 font-bold">Order Cancelled</p>`;
                clearInterval(otpPollingInterval);
            }
        } catch (e) { console.log("Polling error..."); }
    }, 5000);
}

// --- 7. HELPER FUNCTIONS ---

// Pipe separated data (0:Russia|1:USA) ko object mein badalna
function parsePipeData(str) {
    let obj = {};
    str.split('|').forEach(item => {
        let [id, name] = item.split(':');
        if(id && name) obj[id] = name;
    });
    return obj;
}

// Global functions for buttons
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Number copied!");
};

window.cancelActivation = async (id) => {
    if(confirm("Are you sure to cancel? Money will be refunded (if API allows).")) {
        const res = await fetch(`/.netlify/functions/api-bridge?action=setStatus&id=${id}&status=8`);
        alert("Cancel request sent.");
        location.reload(); // Refresh to reset UI
    }
};

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "auth.html");
});