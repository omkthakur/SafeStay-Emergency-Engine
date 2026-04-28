import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting SafeStay Secure Server (Native Fetch Mode)...');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint for Cloud Run
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.post('/api/scan-blueprint', async (req, res) => {
    try {
        const rawKey = process.env.GEMINI_API_KEY;
        if (!rawKey) {
            console.error('❌ Missing GEMINI_API_KEY on server');
            return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
        }
        
        const apiKey = rawKey.trim();
        const { image, prompt } = req.body;
        
        const modelName = 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    ...(image ? [{ inline_data: { mime_type: "image/png", data: image } }] : [])
                ]
            }]
        };

        // --- RETRY LOGIC FOR HIGH DEMAND (503) ---
        let attempts = 0;
        let googleResponse;
        let data;

        while (attempts < 2) {
            console.log(`📡 Sending request to Gemini (Attempt ${attempts + 1})...`);
            googleResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            data = await googleResponse.json();

            if (googleResponse.status === 503) {
                console.warn('⚠️ Model busy (503). Retrying in 1.5s...');
                attempts++;
                await new Promise(r => setTimeout(r, 1500));
                continue;
            }
            break;
        }

        if (!googleResponse.ok) {
            console.error('❌ Google API Error:', data);
            return res.status(googleResponse.status).json({ 
                error: data.error?.message || 'Google API refused request' 
            });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI";
        res.json({ text: aiText });

    } catch (error) {
        console.error('AI Proxy Error Details:', error);
        res.status(500).json({ error: error.message || 'AI processing failed' });
    }
});

// Static files
const distPath = path.join(__dirname, 'dist');
console.log('📂 Serving static files from:', distPath);
app.use(express.static(distPath));

// Fallback for React Router (SPA)
app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server successfully listening on 0.0.0.0:${PORT}`);
});
