# WhatsApp Group Chat Summarizer

An AI-powered tool that generates concise, organized summaries of WhatsApp group chats. Built with Next.js and OpenAI's GPT-4.

## Features

- Upload WhatsApp chat exports (.txt or .zip)
- AI-powered summarization by date and topic
- Markdown formatting support
- Copy to clipboard and PDF export
- Privacy-focused (no data storage)
- Real-time token counting
- Detailed processing status

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- OpenAI GPT-4
- Vercel (hosting)

## Setup

1. Clone the repository:

```bash
git clone https://github.com/nkjain92/whatsappgroupsummariser.git
cd whatsappgroupsummariser
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the root directory and add your OpenAI API key:

```
OPENAI_API_KEY=your_api_key_here
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Export your WhatsApp chat:

   - Open the WhatsApp group
   - Click Group Info > More > Export Chat
   - Choose "Without Media"

2. Upload the exported file:

   - Drag and drop the .txt or .zip file
   - Or click to select the file

3. Click "Generate Summary"

   - The AI will process the chat
   - You'll see real-time processing status

4. View and export:

   - Read the organized summary
   - Copy to clipboard or download as PDF

## Deployment

The app is optimized for Vercel deployment. Simply:

1. Push to GitHub
2. Import to Vercel
3. Add your `OPENAI_API_KEY` in Vercel's environment variables
4. Deploy!

## Privacy

- No chat data is stored on servers
- All processing happens in your session
- Direct API calls to OpenAI only

## License

MIT License - feel free to use and modify!
