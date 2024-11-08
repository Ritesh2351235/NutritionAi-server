import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { Ollama } from 'ollama';

const app = express();
const port = 3000;

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

// Initialize Ollama client
const ollama = new Ollama();

// Endpoint to analyze image
app.post('/api/analyze-food', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Convert image buffer to base64 string
    const imageBase64 = req.file.buffer.toString('base64');

    // Send the image to Ollama's llava model
    console.log('Sending image to llava model...');
    const response = await ollama.generate({
      model: 'llava:7b', // Assuming this is the correct model
      prompt: 'Analyse the given image, and find out the food item present in it within 5 words and try to give out individual food items present if more than one are present.',
      images: [imageBase64],
    });

    console.log('Received response from llava model:', response);

    if (!response || !response.response) {
      throw new Error('No valid response from llava model');
    }
    const responseText = `Here is a general nutritional breakdown:
    * Food Item: Cheescake
    * Calories: 370-400
    * Total Fat: 26-30g 
    * Cholesterol: 125mg
    * Sodium: 300-350mg
    * Carbohydrates: 30-35g (Sugars: 24-28g)
    * Protein: 7-8g
    * Other infomation:`;
    // Now send the result to the llama2 model for nutritional analysis
    console.log('Sending response to mistral model...');
    const mistralResponse = await ollama.generate({
      model: 'mistral',
      prompt: `Provide only the nutrition stats for ${response.response} in the following format: ${responseText}. No additional information is needed and dont include any starting introductory sentence strictly.`,
    });

    console.log('Received response from mistral model:', mistralResponse);
    console.log('Received response from mistral model:', mistralResponse);

    const fullNutritionInfo = mistralResponse.response;
    
    // Split by double newlines to separate different food items
    const foodItemsData = fullNutritionInfo.split('\n\n').map(item => {
      const lines = item.split('\n').filter(line => line.trim() !== '');
      const nutritionData = {};
      
      lines.forEach(line => {
        // Use regex to capture key-value pairs including anything in parentheses
        const match = line.match(/^(.*?):\s*(.*?)(\s*\(.*?\))?$/);
        if (match) {
          const key = match[1].trim().replace(/^[\d.]+\s*|\s*[-*]\s*/g, ''); // Remove leading numbers and symbols
          const value = match[2].trim() + (match[3] ? match[3].trim() : '');
          nutritionData[key] = value;
        }
      });

      return nutritionData;
    }).filter(item => Object.keys(item).length > 0); // Filter out any empty objects

    console.log('Structured Nutrition Data:', foodItemsData);

    if (!mistralResponse || !mistralResponse.response) {
      throw new Error('No valid response from mistral model');
    }
    res.json({ nutritionData: foodItemsData });

  } catch (error) {
    console.error('Error analyzing image:', error);
    res.status(500).json({ error: 'Error analyzing image' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
