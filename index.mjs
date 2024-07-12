// index.mjs
import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { Client } from "@gradio/client";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

// Definir __dirname e __filename para módulos ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function genImage(prompt, size = '1024x1024', style = '', quality = 'standard') {
  if (!prompt) return false;

  try {
    const url = process.env.URL || "https://mukaist-dalle-4k.hf.space";
    const repo = process.env.REPO || "mukaist/DALLE-4K";
    const generator = await Client.connect(repo);
    const result = await generator.predict("/run", {
      prompt: `digital art of ${prompt}. ${style}`,
      negative_prompt: "ugly, deformed, noisy, low poly, blurry",
      use_negative_prompt: true,
      style: "3840 x 2160",
      seed: 0,
      width: parseInt(size.split('x')[0], 10),
      height: parseInt(size.split('x')[1], 10),
      guidance_scale: quality === 'high' ? 15 : quality === 'standard' ? 10 : 6, // Configurar guidance_scale com base no quality
      randomize_seed: true,
    });

    if (result && result.data && result.data.length > 0 && result.data[0][0].image.path) {
      const imagePath = result.data[0][0].image.path;
      const fullImagePath = `${url}/file=${imagePath}`;
      const response = await fetch(fullImagePath);

      // Convert response to a buffer
      const buffer = await response.arrayBuffer();
      const bufferData = Buffer.from(buffer);

      return {
        created: new Date().getTime(),
        data: [
          {
            url: fullImagePath,
            b64_json: bufferData.toString('base64')
          }
        ]
      };
    }
  } catch (error) {
    console.error("Error in genImage:", error);

    if (error.message && error.message.includes('Please retry in')) {
      const match = error.message.match(/Please retry in (\d+):(\d+):(\d+)/);
      if (match) {
        const waitTimeInSeconds = parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
        console.log(`Waiting for ${waitTimeInSeconds} seconds before retrying...`);
        await sleep(waitTimeInSeconds * 1000);
        return genImage(prompt, size, style, quality);  // Retry the function after waiting
      }
    }
  }

  return false;
}

// Endpoint to generate image
app.post('/v1/images/generations', async (req, res) => {
  const { prompt, size, style, quality } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'The "prompt" field is required.' });
  }

  const result = await genImage(prompt, size, style, quality);

  if (result) {
    res.status(200).json(result);
  } else {
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
