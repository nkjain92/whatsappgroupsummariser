import { NextRequest, NextResponse } from 'next/server';
import { processWhatsAppChat } from '@/lib/chatProcessor';
import JSZip from 'jszip';
import { estimateTokenCount } from '@/lib/tokenCounter';

// Export runtime configuration at the top
export const runtime = 'edge';

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

// Add allowed methods
export async function GET() {
  return new NextResponse('Method GET not allowed', { status: 405 });
}

export async function POST(request: NextRequest) {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new NextResponse(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers,
      });
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
        return new NextResponse(JSON.stringify({ error: 'The uploaded file is empty' }), {
          status: 400,
          headers,
        });
      }
    } catch (error) {
      console.error('Error reading file:', error);
      return new NextResponse(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to read chat data from file',
          details: error instanceof Error ? error.stack : undefined,
        }),
        { status: 400, headers },
      );
    }

    // Process the chat data
    const processedChat = await processWhatsAppChat(fileContent);

    // Create the prompt template
    const promptTemplate = `You are a chatbot trained to analyze and summarize WhatsApp group chats. A user has provided the following chat export from a WhatsApp group. Your task is to generate a summary of the conversations.

For each day, include:
1. The main topics discussed.
2. Key highlights or conclusions for each topic.
3. Notable contributions from specific users (mention who said what).

Chat data:
${processedChat}`;

    // Get token counts
    const chatTokens = estimateTokenCount(processedChat);
    const promptTokens = estimateTokenCount(promptTemplate);

    // Extract date range
    const dateRangeMatch = processedChat.match(/===\s*(\d{2}\/\d{2}\/\d{2})/g);
    const dates = dateRangeMatch ? dateRangeMatch.map(d => d.replace(/===\s*/, '')) : [];
    const dateRange =
      dates.length >= 2 ? `from ${dates[0]} to ${dates[dates.length - 1]}` : 'for the last 7 days';

    return new NextResponse(
      JSON.stringify({
        tokens: {
          chatTokens,
          promptTokens,
        },
        dateRange,
      }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error('Error:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers },
    );
  }
}

// Add OPTIONS handler
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
