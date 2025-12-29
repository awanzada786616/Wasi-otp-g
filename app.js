// app.js - FIXED FOR 5SIM DATA STRUCTURE

const RUB_TO_PKR_RATE = 7.0; // 1 Ruble = 7 PKR (Markup included)
let demoBalance = 5000;

async function initDashboard() {
    console.log("Initializing Dashboard...");
    
    // 1. Load Countries
    try {
        const rawCountries = await fetch("/api/proxy?action=countries").then(r => r.json());
        const countrySelect = document.getElementById('countrySelect');
        countrySelect.innerHTML = '<option value="">-- Choose Country --</option>';
        
        Object.keys(rawCountries).sort().forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.innerText = c.toUpperCase();
            countrySelect.appendChild(opt);
        });
        console.log("Countries Loaded.");
    } catch (e) {
        console.error("Countries failed:", e);
    }

    // 2. Load Services (FIXED LOGIC)
    document.getElementById('countrySelect').onchange = async (e) => {
        const country = e.target.value;
        if (!country) return;

        const ss = document.getElementById('serviceSelect');
        ss.innerHTML = '<option value="">🔄 Syncing stock...</option>';

        try {
            console.log(`Fetching services for: ${country}`);
            const products = await fetch(`/api/proxy?action=products&country=${country}`).then(r => r.json());
            
            ss.innerHTML = '<option value="">-- Select Service --</option>';
            let serviceCount = 0;

            // 5sim JSON Structure: { "whatsapp": { "activation": { "cost": 10, "count": 500 } } }
            Object.entries(products).forEach(([serviceName, types]) => {
                // Check if "activation" exists for this service
                const activationData = types.activation;
                
                if (activationData && activationData.count > 0) {
                    const opt = document.createElement('option');
                    opt.value = serviceName;
                    
                    // Price Calculation
                    const pkrPrice = Math.ceil(activationData.cost * RUB_TO_PKR_RATE);
                    
                    opt.dataset.price = pkrPrice;
                    opt.innerText = `${serviceName.toUpperCase()} - RS ${pkrPrice} (Stock: ${activationData.count})`;
                    ss.appendChild(opt);
                    serviceCount++;
                }
            });

            if(serviceCount === 0) {
                ss.innerHTML = '<option value="">No stock available for this country</option>';
            }
            console.log(`Found ${serviceCount} active services.`);

        } catch (e) {
            console.error("Service Error:", e);
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
        
        if (!selectedOpt || !service) return alert("Please select a service!");
        const price = parseFloat(selectedOpt.dataset.price);

        if (demoBalance < price) return alert("Insufficient Balance!");

        const btn = document.getElementById('buyBtn');
        btn.disabled = true; btn.innerText = "ALLOCATING...";

        try {
            const order = await fetch(`/api/proxy?action=buy&country=${country}&service=${service}`).then(r => r.json());
            
            if (order.id) {
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
                alert("Error: " + (order.error || "No numbers available at this moment."));
            }
        } catch (err) {
            alert("Order failed. Please try again.");
        }
        btn.disabled = false; btn.innerText = "GET NUMBER";
    };
}

function startPolling(id) {
    const interval = setInterval(async () => {
        try {
            const check = await fetch(`/api/proxy?action=check&id=${id}`).then(r => r.json());
            // 5sim SMS check logic
            if (check.sms && check.sms.length > 0) {
                document.getElementById('orderOtp').innerText = check.sms[0].code;
                document.getElementById('otpStatus').innerText = "OTP RECEIVED!";
                document.getElementById('otpStatus').className = "text-xs font-black text-green-500 mb-2";
                clearInterval(interval);
            }
        } catch (e) {
            console.log("Polling...");
        }
    }, 5000);
}

// Start
initDashboard();
