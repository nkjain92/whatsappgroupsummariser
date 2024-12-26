import { NextRequest, NextResponse } from 'next/server';
import { processWhatsAppChat } from '@/lib/chatProcessor';
import JSZip from 'jszip';
import { encoding_for_model } from 'tiktoken';

// Get accurate token count using tiktoken
async function getTokenCount(text: string): Promise<number> {
  try {
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

    const txtFiles = Object.values(zipFiles.files).filter(
      f => f.name.toLowerCase().endsWith('.txt') && !f.dir,
    );

    if (txtFiles.length === 0) {
      throw new Error('No .txt file found in the zip archive');
    }

    const filesWithSizes = await Promise.all(
      txtFiles.map(async file => ({
        file,
        content: await file.async('string'),
      })),
    );

    const sortedFiles = filesWithSizes.sort((a, b) => b.content.length - a.content.length);
    const { content } = sortedFiles[0];

    if (!content || content.trim().length === 0) {
      throw new Error('Chat file is empty');
    }

    return content;
  } catch (error) {
    console.error('Error extracting text from zip:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Get the file content based on file type
    let fileContent: string;
    try {
      if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        console.log('Processing zip file:', file.name);
        fileContent = await extractTextFromZip(file);
      } else {
        console.log('Processing text file:', file.name);
        fileContent = await file.text();
      }

      if (!fileContent || fileContent.trim().length === 0) {
        console.error('Empty file content');
        return NextResponse.json({ error: 'The uploaded file is empty' }, { status: 400 });
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

    try {
      // Process the chat data
      console.log('Processing chat data...');
      const processedChat = await processWhatsAppChat(fileContent);

      // Create the prompt template to get accurate token count
      const promptTemplate = `You are a chatbot trained to analyze and summarize WhatsApp group chats. A user has provided the following chat export from a WhatsApp group. Your task is to generate a summary of the conversations.

For each day, include:
1. The main topics discussed.
2. Key highlights or conclusions for each topic.
3. Notable contributions from specific users (mention who said what).

Chat data:
${processedChat}`;

      // Get token counts
      console.log('Counting tokens...');
      const chatTokens = await getTokenCount(processedChat);
      const promptTokens = await getTokenCount(promptTemplate);

      // Extract date range
      const dateRangeMatch = processedChat.match(/===\s*(\d{2}\/\d{2}\/\d{2})/g);
      const dates = dateRangeMatch ? dateRangeMatch.map(d => d.replace(/===\s*/, '')) : [];
      const dateRange =
        dates.length >= 2
          ? `from ${dates[0]} to ${dates[dates.length - 1]}`
          : 'for the last 7 days';

      return NextResponse.json({
        tokens: {
          chatTokens,
          promptTokens,
        },
        dateRange,
      });
    } catch (error) {
      console.error('Error processing chat:', error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Error processing chat data',
          details: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    console.error('Error checking tokens:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error checking file' },
      { status: 500 },
    );
  }
}
