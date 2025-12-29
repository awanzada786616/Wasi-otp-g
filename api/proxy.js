import axios from 'axios';

export default async function handler(req, res) {
    // AAPKA 5SIM TOKEN INTEGRATED
    const API_TOKEN = "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTg1NDc3NDAsImlhdCI6MTc2NzAxMTc0MCwicmF5IjoiOTQ2YTQ5OWViOGRmMzYwMTgzNzA4YjlkN2JiMWU4ODkiLCJzdWIiOjM0MDkzMDB9.h_SIUTYe07TtNcYf7etMB-o4I7QsMsiq8990QOQIrMobxdd5flUbGuZIPIUfQsXx_05LjWtLodguTdgixthI9hwN9PDeDDqVtgd9vxYUpERpqU_f0B2gIZJAQcYy9zXcEyK0eACjhGCTIwK-UkpmfV-Kt_KmJ1B_oewy6oODs5uOCqiWtL0n1HhF9yfYKn1liBf23jFmSKyu9UeGvsbfUyFX2_BxsngpUdVFy59bDJI8jWEPWX0LRDvIjcdrr20qe0hxP_hefBYool4HV7XykYLXXagqV-r-ROEcdYCpYK-x0YBt6H1CLVMJ_4Cr286HxiD6a0x-TSaSjFr213coYQ";
    
    const { action, country, service, id } = req.query;
    const headers = { 
        'Authorization': `Bearer ${API_TOKEN}`, 
        'Accept': 'application/json' 
    };

    let url = "";
    if (action === "profile") url = "https://5sim.net/v1/user/profile";
    if (action === "countries") url = "https://5sim.net/v1/guest/countries";
    if (action === "products") url = `https://5sim.net/v1/guest/products/${country}/any`;
    if (action === "buy") url = `https://5sim.net/v1/user/buy/activation/${country}/any/${service}`;
    if (action === "check") url = `https://5sim.net/v1/user/check/${id}`;

    try {
        const response = await axios.get(url, { headers });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message, details: error.response?.data });
    }
}
