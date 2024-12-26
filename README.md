# WhatsApp Chat Summarizer

A web application that uses GPT-4 to generate summaries of WhatsApp group chat exports. The app processes chat data and provides daily breakdowns of topics discussed, key highlights, and notable contributions from participants.

## Features

- Drag-and-drop interface for uploading WhatsApp chat exports (.txt files)
- Secure processing of chat data (not stored after session)
- GPT-4 powered summarization
- Daily breakdown of discussions
- Export summaries as PDF or copy as text
- Responsive design for all devices

## Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd whatsappsummariser
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the root directory and add your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Export your WhatsApp chat:

   - Open the WhatsApp group chat
   - Click the three dots menu (⋮)
   - Select "More" > "Export chat"
   - Choose "Without media"
   - Save the .txt file

2. Upload the chat export:

   - Drag and drop the .txt file onto the upload area
   - Or click "Select File" to choose the file

3. Click "Generate Summary" to process the chat

4. View the summary:
   - Summaries are organized by date
   - Each day shows topics discussed and key messages
   - Use the "Copy Text" or "Download PDF" buttons to save the summary

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- OpenAI GPT-4
- jsPDF for PDF generation

## Privacy

This application processes chat data client-side and through secure API calls. No chat data is stored on servers after processing. All communication with the OpenAI API is done securely through server-side API routes.
