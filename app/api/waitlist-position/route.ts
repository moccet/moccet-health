import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get or create the counter
    const { data: counterData, error: fetchError } = await supabase
      .from('waitlist_counter')
      .select('count')
      .eq('id', 1)
      .single();

    let currentCount = 2848; // Start from 2848 if table doesn't exist yet

    if (counterData && !fetchError) {
      currentCount = counterData.count;
    }

    // Increment the counter
    const newCount = currentCount + 1;

    // Update the counter in the database
    const { error: updateError } = await supabase
      .from('waitlist_counter')
      .upsert({ id: 1, count: newCount })
      .select();

    if (updateError) {
      console.error('Error updating waitlist counter:', updateError);
      // Return the incremented count anyway
      return NextResponse.json({ position: newCount });
    }

    return NextResponse.json({ position: newCount });
  } catch (error) {
    console.error('Error in waitlist-position:', error);
    // Return a fallback position
    return NextResponse.json({ position: 2849 });
  }
}

export async function GET() {
  try {
    // Get the current counter
    const { data: counterData, error: fetchError } = await supabase
      .from('waitlist_counter')
      .select('count')
      .eq('id', 1)
      .single();

    if (fetchError || !counterData) {
      return NextResponse.json({ position: 2848 });
    }

    return NextResponse.json({ position: counterData.count });
  } catch (error) {
    console.error('Error getting waitlist position:', error);
    return NextResponse.json({ position: 2848 });
  }
}
