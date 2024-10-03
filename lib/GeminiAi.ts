/*
 * Install the Generative AI SDK
 *
 * $ npm install @google/generative-ai
 *
 * See the getting started guide for more information
 * https://ai.google.dev/gemini-api/docs/get-started/node
 */

// To use the File API, use this import path for GoogleAIFileManager.
// Note that this is a different import path than what you use for generating content.
// For versions lower than @google/generative-ai@0.13.0
// use "@google/generative-ai/files"

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

  
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  const genAI = new GoogleGenerativeAI(apiKey);

  
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    
  ];


  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings
  });
  
  const generationConfig = {
    temperature: 2,
    topP: 0.85,
    topK: 64,
    maxOutputTokens: 10000,
    responseMimeType: "text/plain",
  };
  

  const generationConfigforPro = {
    temperature: 0.5,
    topP: 1.0,
    topK: 1,
    randomSeed: 42,
    maxOutputTokens: 5000,
    responseMimeType: "text/plain",
  }

 export const chatSession = model.startChat({
      generationConfig,
   
 })
  
// const latestModel = genAI.getGenerativeModel({
//   model: "gemini-1.5-flash",
//   safetySettings
// })

// export const chatSessions = latestModel.startChat({
//   generationConfigforPro,

// })

