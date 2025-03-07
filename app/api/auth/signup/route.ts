import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        provider: 'credentials'
      }
    });

    // Send welcome email
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      await fetch(`${baseUrl}/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: user.name?.split(' ')[0] || 'User',
          email: user.email,
        }),
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Continue with signup even if email fails
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Signup error details:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create user' },
      { status: 500 }
    );
  }
} 