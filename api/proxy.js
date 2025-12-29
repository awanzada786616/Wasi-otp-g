import axios from 'axios';

export default async function handler(req, res) {
    const API_TOKEN = process.env.FIVE_SIM_TOKEN; // Vercel Env Variable
    const { action, country, service, id } = req.query;
    const headers = { 'Authorization': `Bearer ${API_TOKEN}`, 'Accept': 'application/json' };

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
        res.status(500).json({ error: error.message });
    }
}
