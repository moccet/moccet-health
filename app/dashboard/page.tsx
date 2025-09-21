import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  async function signOut() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-3xl font-bold">Welcome to moccet</h1>
          <form action={signOut}>
            <button
              type="submit"
              className="bg-black text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>

        <div className="bg-gray-50 rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-4">Your Account</h2>
          <p className="text-gray-600 mb-2">
            Email: <span className="text-black">{user.email}</span>
          </p>
          <p className="text-gray-600">
            User ID: <span className="text-black">{user.id}</span>
          </p>
        </div>

        <div className="mt-12">
          <h3 className="text-lg font-semibold mb-6">Your Health Data</h3>
          <p className="text-gray-600">
            Your personal health AI dashboard is coming soon. We're building the most advanced health monitoring system with complete privacy.
          </p>
        </div>
      </div>
    </div>
  );
}