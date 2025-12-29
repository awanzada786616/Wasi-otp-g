// app.js - Testing Version (No Auth)

const RUB_TO_PKR_RATE = 6.5; // Profit included rate
let demoBalance = 5000;

async function initDashboard() {
    // 1. Load Countries from 5sim
    try {
        const rawCountries = await fetch("/api/proxy?action=countries").then(r => r.json());
        const countrySelect = document.getElementById('countrySelect');
        Object.keys(rawCountries).sort().forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.innerText = c.toUpperCase();
            countrySelect.appendChild(opt);
        });
    } catch (e) {
        alert("API Error: Make sure you are running on Vercel or local dev.");
    }

    // 2. Load Services when Country changes
    document.getElementById('countrySelect').onchange = async (e) => {
        const country = e.target.value;
        if (!country) return;

        const ss = document.getElementById('serviceSelect');
        ss.innerHTML = '<option value="">🔄 Syncing stock...</option>';

        try {
            const products = await fetch(`/api/proxy?action=products&country=${country}`).then(r => r.json());
            ss.innerHTML = '<option value="">-- Choose Service --</option>';
            Object.entries(products).forEach(([name, data]) => {
                if (data.category === "activation" && data.count > 0) {
                    const pkr = Math.ceil(data.cost * RUB_TO_PKR_RATE);
                    const opt = document.createElement('option');
                    opt.value = name; opt.dataset.price = pkr;
                    opt.innerText = `${name.toUpperCase()} (Stock: ${data.count})`;
                    ss.appendChild(opt);
                }
            });
        } catch (e) {
            ss.innerHTML = '<option>Error loading services</option>';
        }
    };

    // Update Price Display
    document.getElementById('serviceSelect').onchange = (e) => {
        const price = e.target.selectedOptions[0]?.dataset.price || "0.00";
        document.getElementById('priceDisplay').innerText = price;
    };

    // 3. Buy Number Action
    document.getElementById('buyBtn').onclick = async () => {
        const country = document.getElementById('countrySelect').value;
        const service = document.getElementById('serviceSelect').value;
        const selectedOpt = document.getElementById('serviceSelect').selectedOptions[0];
        
        if (!selectedOpt) return alert("Select server and service!");
        const price = parseFloat(selectedOpt.dataset.price);

        if (demoBalance < price) return alert("Insufficient Demo Balance!");

        const btn = document.getElementById('buyBtn');
        btn.disabled = true; btn.innerText = "WAITING...";

        try {
            const order = await fetch(`/api/proxy?action=buy&country=${country}&service=${service}`).then(r => r.json());
            
            if (order.id) {
                // Testing: Mock Balance Deduction
                demoBalance -= price;
                
                document.getElementById('idleState').classList.add('hidden');
                document.getElementById('activeOrder').classList.remove('hidden');
                document.getElementById('orderNum').innerText = order.phone;
                
                document.getElementById('copyBtn').onclick = () => {
                    navigator.clipboard.writeText(order.phone);
                    alert("Number Copied!");
                };
                
                startPolling(order.id);
            } else {
                alert("API Message: " + (order.error || "No numbers available."));
            }
        } catch (err) {
            alert("API Error. Order failed.");
        }
        btn.disabled = false; btn.innerText = "GET NUMBER";
    };
}

function startPolling(id) {
    const interval = setInterval(async () => {
        try {
            const check = await fetch(`/api/proxy?action=check&id=${id}`).then(r => r.json());
            if (check.sms && check.sms.length > 0) {
                document.getElementById('orderOtp').innerText = check.sms[0].code;
                document.getElementById('otpStatus').innerText = "OTP RECEIVED!";
                document.getElementById('otpStatus').className = "text-xs font-black text-green-500 mb-2";
                clearInterval(interval);
            }
        } catch (e) {
            console.log("Polling for OTP...");
        }
    }, 5000);
}

// Start
initDashboard();
