import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// The Gemini Key is pulled from the SERVER environment, never sent to the browser
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.post('/api/scan-blueprint', async (req, res) => {
    try {
        const { image, prompt } = req.body;
        if (!image || !prompt) return res.status(400).json({ error: 'Missing data' });

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
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

// Serve the React frontend from the 'dist' folder
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🛡️ Secure SafeStay Server running on port ${PORT}`);
});
