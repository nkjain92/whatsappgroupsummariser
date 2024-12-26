import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { processWhatsAppChat } from '@/lib/chatProcessor';
import JSZip from 'jszip';
import { encoding_for_model } from 'tiktoken';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get accurate token count using tiktoken
async function getTokenCount(text: string): Promise<number> {
  try {
    // Using cl100k_base encoding for GPT-4 models
    const enc = encoding_for_model('gpt-4');
    const tokens = enc.encode(text);
    enc.free();
    return tokens.length;
  } catch (error) {
    console.error('Error counting tokens:', error);
    return Math.ceil(text.length / 4);
  }
}

async function extractTextFromZip(file: File): Promise<string> {
  try {
    const zip = new JSZip();
    const zipContent = await file.arrayBuffer();
    const zipFiles = await zip.loadAsync(zipContent);

    // Find all .txt files in the zip
    const txtFiles = Object.values(zipFiles.files).filter(
      f => f.name.toLowerCase().endsWith('.txt') && !f.dir,
    );

    if (txtFiles.length === 0) {
      throw new Error('No .txt file found in the zip archive');
    }

    // Get file sizes and contents in parallel
    const filesWithSizes = await Promise.all(
      txtFiles.map(async file => ({
        file,
        content: await file.async('string'),
      })),
    );

    // Sort by content length to get the largest file (likely the chat export)
    const sortedFiles = filesWithSizes.sort((a, b) => b.content.length - a.content.length);
    const { file: chatFile, content } = sortedFiles[0];

    console.log('Found chat file:', chatFile.name);

    if (!content || content.trim().length === 0) {
      throw new Error('Chat file is empty');
    }

    return content;
  } catch (error) {
    console.error('Error extracting text from zip:', error);
    throw new Error('Failed to extract chat data from zip file');
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('No file uploaded');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log('File received:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Get the file content based on file type
    let fileContent: string;
    try {
      if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        console.log('Processing zip file...');
        fileContent = await extractTextFromZip(file);
      } else {
        console.log('Processing text file...');
        fileContent = await file.text();
      }

      if (!fileContent || fileContent.trim().length === 0) {
        console.error('Empty file content');
        throw new Error('Chat file is empty');
      }

      console.log('File content length:', fileContent.length);
    } catch (error) {
      console.error('Error reading file:', error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Failed to read chat data from file',
          details: error instanceof Error ? error.stack : undefined,
        },
        { status: 400 },
      );
    }

    // Process the chat data
    console.log('Processing chat data...');
    const processedChat = await processWhatsAppChat(fileContent);

    if (!processedChat || processedChat.trim().length === 0) {
      console.error('No valid chat messages found');
      return NextResponse.json(
        { error: 'No valid chat messages found in the file' },
        { status: 400 },
      );
    }

    // Extract date range from the first and last message groups
    console.log('Extracting date range...');
    const dateRangeMatch = processedChat.match(/===\s*(\d{2}\/\d{2}\/\d{2})/g);
    const dates = dateRangeMatch ? dateRangeMatch.map(d => d.replace(/===\s*/, '')) : [];
    const dateRange =
      dates.length >= 2 ? `from ${dates[0]} to ${dates[dates.length - 1]}` : 'for the last 7 days';

    console.log('Preparing prompt...');
    const promptTemplate = `You are a chatbot trained to analyze and summarize WhatsApp group chats. A user has provided the following chat export from a WhatsApp group. Your task is to generate a summary of the conversations ${dateRange}.

For each day, include:
1. The main topics discussed.
2. Key highlights or conclusions for each topic.
3. Notable contributions from specific users (mention who said what).

Chat data:
${processedChat}

Output Format:
Date: [Date]
Topics Discussed:
- Topic 1: Summary of discussion.
    - [Username]: [Important message]
    - [Username]: [Important message]
- Topic 2: Summary of discussion.
    - [Username]: [Important message]
    - [Username]: [Important message]

Key Messages not covered in the topics above:
- [Username]: [Important message]
- [Username]: [Important message]`;

    // Log content lengths and token counts
    console.log('Calculating token counts...');
    console.log('Content Statistics:');
    console.log('Processed chat length (chars):', processedChat.length);
    console.log('Full prompt length (chars):', promptTemplate.length);

    const chatTokens = await getTokenCount(processedChat);
    const promptTokens = await getTokenCount(promptTemplate);
    console.log('Accurate token count in chat:', chatTokens);
    console.log('Accurate token count in full prompt:', promptTokens);

    // If the content is too long, return an error
    if (promptTokens > 128000) {
      return NextResponse.json(
        {
          error: `Content is too long (${promptTokens} tokens). Please upload a smaller chat file. Maximum allowed is 128,000 tokens.`,
        },
        { status: 400 },
      );
    }

    // Generate summary using the new model
    console.log('Sending request to OpenAI...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'user',
          content: promptTemplate,
        },
      ],
      temperature: 1,
      top_p: 1,
      max_tokens: 16384, // Set max output tokens
      presence_penalty: 0,
      frequency_penalty: 0,
    });

    console.log('Summary generated successfully');
    return NextResponse.json({
      summary: completion.choices[0].message.content,
    });
  } catch (error: any) {
    console.error('Error processing chat:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      {
        error: error.message || 'Error processing chat',
        details: error.stack,
      },
      { status: 500 },
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
