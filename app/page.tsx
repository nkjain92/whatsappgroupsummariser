'use client';

import { useState } from 'react';
import { jsPDF } from 'jspdf';

interface TokenInfo {
  chatTokens: number;
  promptTokens: number;
}

interface FileInfo {
  name: string;
  dateRange?: string;
}

const isValidFileType = (file: File) => {
  return (
    file.type === 'text/plain' ||
    file.name.endsWith('.txt') ||
    file.type === 'application/zip' ||
    file.name.endsWith('.zip')
  );
};

const WhatsAppIcon = () => (
  <svg
    width='32'
    height='32'
    viewBox='0 0 32 32'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    className='text-green-500'>
    <path
      d='M16 2C8.27812 2 2 8.27812 2 16C2 19.2375 3.0875 22.2313 4.95625 24.6344L2.75313 29.8188C2.64375 30.0781 2.7375 30.3781 2.95938 30.5469C3.18125 30.7156 3.49375 30.7156 3.71563 30.5469L9.26875 27.0438C11.3 28.2875 13.5906 29 16 29C23.7219 29 30 22.7219 30 15C30 7.27812 23.7219 2 16 2Z'
      fill='currentColor'
    />
  </svg>
);

const UploadIcon = () => (
  <svg
    width='48'
    height='48'
    viewBox='0 0 48 48'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    className='text-gray-400'>
    <path
      d='M24 32V16M24 16L18 22M24 16L30 22'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);

const ShieldIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    className='text-green-500'>
    <path
      d='M12 2L3 7V12C3 16.97 7.02 21.5 12 22C16.98 21.5 21 16.97 21 12V7L12 2ZM12 16C11.45 16 11 15.55 11 15V11C11 10.45 11.45 10 12 10C12.55 10 13 10.45 13 11V15C13 15.55 12.55 16 12 16ZM13 8H11V6H13V8Z'
      fill='currentColor'
    />
  </svg>
);

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [timings, setTimings] = useState<Record<string, number>>({});

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFileType(droppedFile)) {
      setFile(droppedFile);
      setError('');
      checkFileTokens(droppedFile);
    } else {
      setError('Please upload a valid .txt or .zip file');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidFileType(selectedFile)) {
      setFile(selectedFile);
      setError('');
      checkFileTokens(selectedFile);
    } else {
      setError('Please upload a valid .txt or .zip file');
    }
  };

  const checkFileTokens = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/check-tokens', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      setTokenInfo(data.tokens);
      setFileInfo({ name: file.name, dateRange: data.dateRange });
    } catch (err) {
      console.error('Error checking tokens:', err);
      setError(err instanceof Error ? err.message : 'Error checking file tokens');
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setProcessingStage('Preparing chat data...');
    setTimings({});

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProcessingStage('Sending to AI model...');
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      setProcessingStage('Generating summary...');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      if (data.timings) {
        setTimings(data.timings);
      }
      setSummary(data.summary);
    } catch (err) {
      console.error('Error details:', err);
      setError(err instanceof Error ? err.message : 'Error processing chat. Please try again.');
    } finally {
      setLoading(false);
      setProcessingStage('');
    }
  };

  const resetForm = () => {
    setFile(null);
    setSummary('');
    setTokenInfo(null);
    setFileInfo(null);
    setError('');
  };

  const downloadPDF = () => {
    if (!summary || !fileInfo) return;
    const doc = new jsPDF();

    // Add title and date range
    doc.setFontSize(16);
    doc.text(fileInfo.name, 15, 15);
    if (fileInfo.dateRange) {
      doc.setFontSize(12);
      doc.text(fileInfo.dateRange, 15, 25);
    }

    // Add summary content
    doc.setFontSize(12);
    const splitText = doc.splitTextToSize(summary, 180);
    doc.text(splitText, 15, 35);

    doc.save('chat-summary.pdf');
  };

  const copyToClipboard = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
  };

  // Function to format links and markdown in the summary
  const formatSummary = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Handle bold text
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Handle italic text
      line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');

      // Handle links
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = line.split(urlRegex);

      return (
        <div
          key={i}
          className='mb-2'
          dangerouslySetInnerHTML={{
            __html: parts
              .map((part, j) => {
                if (part.match(urlRegex)) {
                  return `<a href="${part}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700 underline break-all">${part}</a>`;
                }
                return part;
              })
              .join(''),
          }}
        />
      );
    });
  };

  const handleClick = () => {
    document.getElementById('file-upload')?.click();
  };

  if (summary) {
    return (
      <main className='min-h-screen p-8 max-w-4xl mx-auto'>
        <div className='mb-8 flex justify-between items-center'>
          <h1 className='text-2xl font-bold'>{fileInfo?.name}</h1>
          <button
            onClick={resetForm}
            className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'>
            Summarize Another Chat
          </button>
        </div>

        {fileInfo?.dateRange && (
          <p className='text-gray-600 mb-6'>Summary of chat {fileInfo.dateRange}</p>
        )}

        <div className='bg-white rounded-lg shadow-lg p-6'>
          <div className='flex justify-end space-x-4 mb-6'>
            <button
              onClick={copyToClipboard}
              className='px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors'>
              Copy Text
            </button>
            <button
              onClick={downloadPDF}
              className='px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'>
              Download PDF
            </button>
          </div>
          <div className='prose max-w-none'>{formatSummary(summary)}</div>
        </div>
      </main>
    );
  }

  return (
    <main className='min-h-screen p-8 max-w-4xl mx-auto'>
      <div className='flex flex-col items-center justify-center space-y-4 mb-12'>
        <div className='flex items-center gap-3'>
          <WhatsAppIcon />
          <h1 className='text-4xl font-bold text-gray-900'>WhatsApp Chat Summarizer</h1>
        </div>
        <p className='text-lg text-gray-600 text-center max-w-2xl'>
          Upload your WhatsApp chat export and get an AI-powered summary of your conversations,
          organized by date and topic.
        </p>
      </div>

      <div className='space-y-8'>
        {/* File Upload Section */}
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : file
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}>
          <div className='space-y-6'>
            <div className='flex justify-center'>
              <UploadIcon />
            </div>
            <div className='space-y-2'>
              <p className='text-xl font-medium text-gray-900'>
                Drop your WhatsApp chat export here
              </p>
              <p className='text-sm text-gray-500'>or click to select file</p>
            </div>
            <input
              type='file'
              accept='.txt,.zip'
              onChange={handleFileChange}
              className='hidden'
              id='file-upload'
              aria-label='Upload WhatsApp chat file'
              title='Upload WhatsApp chat file'
            />
            <p className='text-sm text-gray-600 hover:text-gray-900'>
              Supports .txt and .zip files up to 10MB
            </p>
            {file && <p className='text-sm text-green-600 font-medium'>Selected: {file.name}</p>}
            {tokenInfo && (
              <div className='text-sm text-gray-600'>
                <p>Chat tokens: {tokenInfo.chatTokens}</p>
                <p>Total prompt tokens: {tokenInfo.promptTokens}</p>
              </div>
            )}
            {error && <p className='text-sm text-red-500'>{error}</p>}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className='bg-gray-50 rounded-lg p-4'>
          <div className='flex items-center gap-3 mb-2'>
            <ShieldIcon />
            <h2 className='text-lg font-semibold text-gray-900'>Privacy Notice</h2>
          </div>
          <p className='text-gray-600 text-sm'>
            Your privacy is important to us. The chat data you upload is processed securely and is
            not stored on our servers. All processing is done in your browser session only.
          </p>
        </div>

        {/* Generate Summary Button and Loading State */}
        {file && !summary && tokenInfo && tokenInfo.promptTokens <= 128000 && (
          <div className='text-center space-y-4'>
            {loading ? (
              <div className='space-y-3'>
                <div className='animate-pulse flex flex-col items-center'>
                  <div className='h-2 bg-green-200 rounded w-48 mb-4'></div>
                  <p className='text-gray-600'>{processingStage}</p>
                  {processingStage === 'Generating summary...' && (
                    <p className='text-xs text-gray-500 mt-2'>
                      This might take a minute or two for longer chats...
                    </p>
                  )}
                  {Object.keys(timings).length > 0 && (
                    <div className='text-xs text-gray-500 mt-4 text-left'>
                      <p className='font-medium mb-1'>Processing times:</p>
                      <ul className='space-y-1'>
                        {timings.fileRead && (
                          <li>File reading: {(timings.fileRead / 1000).toFixed(2)}s</li>
                        )}
                        {timings.processing && (
                          <li>Chat processing: {(timings.processing / 1000).toFixed(2)}s</li>
                        )}
                        {timings.promptPrep && (
                          <li>Prompt preparation: {(timings.promptPrep / 1000).toFixed(2)}s</li>
                        )}
                        {timings.tokenCount && (
                          <li>Token counting: {(timings.tokenCount / 1000).toFixed(2)}s</li>
                        )}
                        {timings.aiGeneration && (
                          <li>AI generation: {(timings.aiGeneration / 1000).toFixed(2)}s</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
                <div className='flex justify-center items-center gap-2'>
                  <svg
                    className='animate-spin h-5 w-5 text-green-500'
                    xmlns='http://www.w3.org/2000/svg'
                    fill='none'
                    viewBox='0 0 24 24'>
                    <circle
                      className='opacity-25'
                      cx='12'
                      cy='12'
                      r='10'
                      stroke='currentColor'
                      strokeWidth='4'></circle>
                    <path
                      className='opacity-75'
                      fill='currentColor'
                      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
                  </svg>
                  <span className='text-sm text-gray-600'>Processing your chat...</span>
                </div>
              </div>
            ) : (
              <div className='space-y-2'>
                <button
                  onClick={handleSubmit}
                  className='px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors'>
                  Generate Summary
                </button>
                {tokenInfo.promptTokens > 64000 && (
                  <p className='text-xs text-gray-500'>
                    Large chat detected ({Math.round(tokenInfo.promptTokens / 1000)}K tokens).
                    Processing might take a few minutes.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
