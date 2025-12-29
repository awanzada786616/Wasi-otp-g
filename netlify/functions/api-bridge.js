// Netlify Function to bypass CORS and hide API Key
export const handler = async (event, context) => {
    
    // 1. API Key ko yahan mahfooz rakhein
    const API_KEY = "e4c5d4fcc56363f572a597267b42e5d2"; 
    const BASE_URL = "http://otpget.com/stubs/handler_api.php";

    // 2. Frontend se parameters lein (action, country, service, etc.)
    const params = event.queryStringParameters;
    const action = params.action;

    // URL banana
    let targetUrl = `${BASE_URL}?api_key=${API_KEY}&action=${action}`;

    if (params.country) targetUrl += `&country=${params.country}`;
    if (params.service) targetUrl += `&service=${params.service}`;
    if (params.id) targetUrl += `&id=${params.id}`;
    if (params.status) targetUrl += `&status=${params.status}`;

    try {
        const response = await fetch(targetUrl);
        const data = await response.text();

        // Check karein ke data JSON hai ya Plain Text (otpget aksar plain text deta hai)
        let body;
        try {
            body = JSON.parse(data); // Agar JSON hai
        } catch (e) {
            body = data; // Agar plain text hai (e.g., ACCESS_NUMBER:ID:NUM)
        }

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // CORS fix
                "Content-Type": "application/json",
            },
            body: typeof body === 'string' ? JSON.stringify({ message: body }) : JSON.stringify(body),
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to fetch from OTP API", details: error.message }),
        };
    }
};
