interface Message {
  date: string;
  sender: string;
  content: string;
}

function parseWhatsAppDate(dateStr: string): Date {
  // Convert "DD/MM/YY" to Date object
  const [day, month, year] = dateStr.split('/').map(num => parseInt(num));
  return new Date(2000 + year, month - 1, day); // month is 0-based in JS Date
}

export async function processWhatsAppChat(chatContent: string): Promise<string> {
  try {
    console.log('Starting chat processing...');
    console.log('First 500 chars of input:', chatContent.slice(0, 500));

    // Split the chat content into lines
    const lines = chatContent.split('\n');
    console.log('Total lines:', lines.length);
    console.log('First few lines:', lines.slice(0, 5));

    // Updated regex to match the specific WhatsApp format
    const messageRegex =
      /^\[?(\d{2}\/\d{2}\/\d{2},\s*\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)\]?\s*([^:]+?):\s*(.*)/;

    const messages: Message[] = [];
    let currentMessage: Message | null = null;
    let linesParsed = 0;
    let linesMatched = 0;

    for (const line of lines) {
      linesParsed++;
      const match = line.match(messageRegex);

      if (match) {
        linesMatched++;
        if (currentMessage) {
          messages.push(currentMessage);
        }

        // Clean up the sender name by removing special characters and "~"
        const sender = match[2]
          .replace(/^~\s*/, '') // Remove leading "~"
          .replace(/‪|\u202A|\u202C|‬/g, '') // Remove special characters
          .trim();

        currentMessage = {
          date: match[1].split(',')[0], // Keep only the date part, not time
          sender: sender,
          content: match[3].trim(),
        };

        if (linesMatched <= 3) {
          console.log('Matched message:', {
            date: match[1],
            sender: sender,
            content: match[3].trim(),
          });
        }
      } else if (currentMessage && line.trim()) {
        // Skip system messages and image notifications
        if (
          line.includes('‎image omitted') ||
          line.includes('security code') ||
          line.includes('added you') ||
          line.includes('This message was deleted')
        ) {
          continue;
        }
        // Append to previous message if it's a continuation
        currentMessage.content += ' ' + line.trim();
      }
    }

    if (currentMessage) {
      messages.push(currentMessage);
    }

    console.log(`Parsed ${linesParsed} lines, matched ${linesMatched} messages`);
    console.log('Total messages parsed:', messages.length);

    if (messages.length === 0) {
      console.error('No messages parsed. First few lines of input:', lines.slice(0, 5));
      throw new Error(
        'No valid WhatsApp messages found in the file. Please ensure this is a WhatsApp chat export file.',
      );
    }

    // Find the date range for the last 7 days
    const dates = messages.map(m => parseWhatsAppDate(m.date));
    const mostRecentDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const sevenDaysAgo = new Date(mostRecentDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log('Date range:', {
      from: sevenDaysAgo.toLocaleDateString(),
      to: mostRecentDate.toLocaleDateString(),
    });

    // Filter messages to keep only last 7 days
    const recentMessages = messages.filter(message => {
      const messageDate = parseWhatsAppDate(message.date);
      return messageDate >= sevenDaysAgo;
    });

    console.log('Messages in last 7 days:', recentMessages.length);

    if (recentMessages.length === 0) {
      throw new Error('No messages found in the last 7 days');
    }

    // Group messages by date
    const messagesByDate = recentMessages.reduce((acc, message) => {
      if (!acc[message.date]) {
        acc[message.date] = [];
      }
      acc[message.date].push(`${message.sender}: ${message.content}`);
      return acc;
    }, {} as Record<string, string[]>);

    // Format the output
    let output = '';
    for (const [date, msgs] of Object.entries(messagesByDate)) {
      output += `\n=== ${date} ===\n`;
      output += msgs.join('\n');
      output += '\n';
    }

    return output;
  } catch (error) {
    console.error('Error in processWhatsAppChat:', error);
    throw error;
  }
}
