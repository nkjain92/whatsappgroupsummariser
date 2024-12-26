import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { processWhatsAppChat } from '@/lib/chatProcessor';
import JSZip from 'jszip';
import { estimateTokenCount } from '@/lib/tokenCounter';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET() {
  return new NextResponse('Method GET not allowed', { status: 405 });
}

export async function POST(request: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  const timings: Record<string, number> = {};
  const startTime = performance.now();

  try {
    // Validate request
    if (!request.body) {
      return new NextResponse(JSON.stringify({ error: 'No request body' }), {
        status: 400,
        headers,
      });
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return new NextResponse(JSON.stringify({ error: 'Failed to parse form data' }), {
        status: 400,
        headers,
      });
    }

    const file = formData.get('file') as File;
    if (!file) {
      console.error('No file uploaded');
      return new NextResponse(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers,
      });
    }

    console.log('File received:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Get the file content based on file type
    let fileContent: string;
    const fileReadStart = performance.now();
    try {
      if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        console.log('Processing zip file...');
        fileContent = await extractTextFromZip(file);
      } else {
        console.log('Processing text file...');
        fileContent = await file.text();
      }
      timings.fileRead = performance.now() - fileReadStart;
      console.log(`File read took: ${timings.fileRead.toFixed(2)}ms`);

      if (!fileContent || fileContent.trim().length === 0) {
        console.error('Empty file content');
        return new NextResponse(JSON.stringify({ error: 'Chat file is empty' }), {
          status: 400,
          headers,
        });
      }

      console.log('File content length:', fileContent.length);
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
    console.log('Processing chat data...');
    const processStart = performance.now();
    const processedChat = await processWhatsAppChat(fileContent);
    timings.processing = performance.now() - processStart;
    console.log(`Chat processing took: ${timings.processing.toFixed(2)}ms`);

    if (!processedChat || processedChat.trim().length === 0) {
      console.error('No valid chat messages found');
      return new NextResponse(
        JSON.stringify({ error: 'No valid chat messages found in the file' }),
        { status: 400, headers },
      );
    }

    // Extract date range and prepare prompt
    const promptStart = performance.now();
    const dateRangeMatch = processedChat.match(/===\s*(\d{2}\/\d{2}\/\d{2})/g);
    const dates = dateRangeMatch ? dateRangeMatch.map(d => d.replace(/===\s*/, '')) : [];
    const dateRange =
      dates.length >= 2 ? `from ${dates[0]} to ${dates[dates.length - 1]}` : 'for the last 7 days';

    const promptTemplate = `You are an AI assistant specializing in summarizing group conversations. Below is a WhatsApp group chat export. Your task is to generate a detailed, insightful summary of the conversations ${dateRange}.

### Key Objectives:
1. Identify the **main topics** discussed each day and provide a **clear summary** of each.
2. Highlight key contributions by mentioning **who said what** for important points.
3. Extract and list **notable quotes or key messages** that add significant value to the discussion.
4. **Organize the output clearly** with headings, subheadings, and bullet points.

### Special Instructions:
- Ignore trivial messages, such as greetings, media notifications, and unrelated chatter.
- Prioritize content that reflects meaningful discussions, ideas, or decisions.
- For controversial or multi-participant discussions, summarize all viewpoints succinctly.
- Make the summary concise but ensure it covers all significant details.

### Chat Data:
${processedChat}

### Output Format:
#### Summary of Conversations (${dateRange})
**Date: [Insert Date]**
1. **Main Topics Discussed:**
   - **Topic 1: [Brief Topic Name]**
     - [Username]: "[Key message or insight]"
     - [Username]: "[Another key message or insight]"
     - Summary: [Briefly summarize the discussion]

   - **Topic 2: [Brief Topic Name]**
     - [Username]: "[Key message or insight]"
     - Summary: [Briefly summarize the discussion]

2. **Key Highlights:**
   - "[Important quote or insight]" - [Username]
   - "[Another important quote or insight]" - [Username]

3. **Notable Messages:**
   - [Username]: "[Important message]"
   - [Username]: "[Another important message]"

4. **Actionable Outcomes (if any):**
   - [Action item 1]
   - [Action item 2]

This format ensures the output is organized, actionable, and easy to understand. For each conversation, focus on clarity, coherence, and relevance.`;
    timings.promptPrep = performance.now() - promptStart;
    console.log(`Prompt preparation took: ${timings.promptPrep.toFixed(2)}ms`);

    // Calculate tokens
    const tokenStart = performance.now();
    const chatTokens = estimateTokenCount(processedChat);
    const promptTokens = estimateTokenCount(promptTemplate);
    timings.tokenCount = performance.now() - tokenStart;
    console.log(`Token counting took: ${timings.tokenCount.toFixed(2)}ms`);
    console.log('Token counts:', { chatTokens, promptTokens });

    if (promptTokens > 128000) {
      return new NextResponse(
        JSON.stringify({
          error: `Content is too long (${promptTokens} tokens). Please upload a smaller chat file. Maximum allowed is 128,000 tokens.`,
        }),
        { status: 400, headers },
      );
    }

    // Generate summary using the new model
    console.log('Sending request to OpenAI...');
    const aiStart = performance.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: promptTemplate,
        },
      ],
      temperature: 1,
      top_p: 1,
      max_tokens: 16384,
      presence_penalty: 0,
      frequency_penalty: 0,
    });
    timings.aiGeneration = performance.now() - aiStart;
    console.log(`AI generation took: ${timings.aiGeneration.toFixed(2)}ms`);

    const totalTime = performance.now() - startTime;
    console.log('Total processing time:', totalTime.toFixed(2), 'ms');
    console.log('Detailed timings:', timings);

    return new NextResponse(
      JSON.stringify({
        summary: completion.choices[0].message.content,
        timings,
      }),
      { status: 200, headers },
    );
  } catch (error: unknown) {
    const totalTime = performance.now() - startTime;
    console.error('Error processing chat:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Failed after:', totalTime.toFixed(2), 'ms');
    console.error('Partial timings:', timings);

    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error processing chat',
        details: error instanceof Error ? error.stack : undefined,
        timings,
      }),
      { status: 500, headers },
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
