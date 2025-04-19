import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
console.log('openai key',process.env.OPENAI_API_KEY);
export async function POST(req: Request) {
  try {
    const { originalMessage, numVariants = 3 } = await req.json();

    if (!originalMessage) {
      return NextResponse.json(
        { error: 'Original message is required' },
        { status: 400 }
      );
    }

    const prompt = `Generate ${numVariants} unique, human-like variations of the following message while maintaining the same intent and tone. Each variation should be different but natural. Keep variables like {name}, {username}, {followers}, and {bio} intact.

Original message:
${originalMessage}

Rules:
1. Keep the same overall message intent
2. Maintain a conversational, natural tone
3. Preserve all variables in their exact format
4. Each variation should be unique
5. Keep similar length to the original
6. Maintain professionalism
7. Don't use generic phrases like "I hope this message finds you well"

Format each variation on a new line starting with "Variant:"`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert in writing natural, engaging social media messages. Your task is to create variations of messages that sound human-written and authentic."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
    });

    const response = completion.choices[0].message.content;
    const variants = response
      ?.split('Variant:')
      .filter((v: string) => v.trim())
      .map((v: string) => v.trim());

    return NextResponse.json({ variants });
  } catch (error) {
    console.error('Error generating message variants:', error);
    return NextResponse.json(
      { error: 'Failed to generate message variants' },
      { status: 500 }
    );
  }
} 