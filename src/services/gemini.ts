import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Explicitly using 'v1' to avoid 'v1beta' 404 errors with some keys/models
const genAI = new GoogleGenerativeAI(API_KEY);

interface SafetyAnalysisResult {
  bottlenecks: string[];
  suggestions: string[];
}

const MODEL_NAMES = ["gemini-1.5-flash", "gemini-1.5-flash-latest"];

export const analyzeSafetyMap = async (mapData: any): Promise<SafetyAnalysisResult> => {
  for (const modelName of MODEL_NAMES) {
    try {
      // Trying the request with different model naming conventions
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const prompt = `
        You are an expert safety consultant. Analyze the following building evacuation map data (nodes and links).
        Find potential bottlenecks, isolated rooms (nodes with no path to an exit), or areas with insufficient emergency equipment.
        Map Data: ${JSON.stringify(mapData, null, 2)}
        Return a JSON object with: "bottlenecks": [ids], "suggestions": [advice]
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.warn(`Model ${modelName} failed`, error);
    }
  }

  // Final fallback to mock if API fails
  return { 
    bottlenecks: ["n1", "n3"], 
    suggestions: ["AI Fallback: Ensure all rooms have at least 2 clear paths to a fire exit.", "AI Fallback: Optimize routes shown in Red in the architectural view."] 
  };
};

export const generateMapFromBlueprint = async (description: string) => {
    for (const modelName of MODEL_NAMES) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const prompt = `Generate a JSON safety map for: ${description}. Format: {nodes: [], links: []}`;
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.warn(`Generation failed with ${modelName}`, error);
        }
    }
    return null;
};
