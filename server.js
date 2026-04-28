import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting SafeStay Secure Server...');

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
            return res.status(500).json({ error: 'Server Configuration Error' });
        }
        
        // Remove any accidental newlines or spaces from the key (e.g. \n)
        const apiKey = rawKey.trim();

        const { image, prompt } = req.body;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const result = await model.generateContent([
            prompt,
            { inlineData: { data: image, mimeType: "image/png" } }
        ]);

        const response = await result.response;
        res.json({ text: response.text() });
    } catch (error) {
        console.error('AI Proxy Error:', error);
        res.status(500).json({ error: 'AI Processing Failed' });
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
