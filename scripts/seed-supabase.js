// Seed Supabase with a demo user, video, and clips.
// WARNING: This uses SUPABASE_SERVICE_ROLE_KEY. Keep it local and DO NOT COMMIT secrets.

const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    console.error('DEBUG has URL:', Boolean(SUPABASE_URL), 'has SERVICE_ROLE:', Boolean(SERVICE_ROLE));
    console.error('DEBUG keys present:', Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', '));
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1) Create or fetch demo user
  const demoEmail = 'demo@yta.local';
  const demoPassword = 'DemoPass!123';

  let userId;
  try {
    const { data, error } = await admin.auth.admin.listUsers();
    if (error) throw error;
    const existing = data.users.find(u => u.email === demoEmail);

    if (existing) {
      userId = existing.id;
      console.log('Using existing demo user:', userId);
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true,
        user_metadata: { full_name: 'YT Arsenal Demo' }
      });
      if (createErr) throw createErr;
      userId = created.user.id;
      console.log('Created demo user:', userId);
    }
  } catch (e) {
    console.error('Failed to create/fetch demo user:', e.message);
    process.exit(1);
  }

  // 2) Upsert profile
  try {
    const { error } = await admin.from('profiles').upsert({
      id: userId,
      email: demoEmail,
      full_name: 'YT Arsenal Demo',
      avatar_url: null,
      token_balance: 1000,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    if (error) throw error;
    console.log('Upserted demo profile');
  } catch (e) {
    console.error('Failed to upsert profile:', e.message);
    process.exit(1);
  }

  // 3) Insert a demo video
  const demoVideoId = 'n9tY0HIL848';
  const demoYouTubeUrl = `https://youtu.be/${demoVideoId}`;
  const now = new Date().toISOString();

  try {
    const { data, error } = await admin.from('videos').upsert({
      user_id: userId,
      youtube_url: demoYouTubeUrl,
      video_id: demoVideoId,
      title: 'How to Build a Successful YouTube Channel in 2024',
      description: '3 deadly mistakes that kill your growth, and the secret strategy for retention',
      transcript: 'Welcome to my channel everyone!... (demo transcript)',
      duration: 600,
      thumbnail_url: 'https://i.ytimg.com/vi/n9tY0HIL848/hqdefault.jpg',
      summary: 'This video explains 3 mistakes: thumbnails, titles, algorithm retention, and shares a growth strategy.',
      generated_description: 'A long-form, SEO-friendly description with hooks, timestamps, and CTAs...',
      keywords: ['YouTube channel growth','YouTube algorithm','thumbnails','titles','retention','2024 strategy'],
      created_at: now,
      updated_at: now
    }, { onConflict: 'user_id,video_id' }).select().single();
    if (error) throw error;
    console.log('Upserted demo video');
  } catch (e) {
    console.error('Failed to upsert demo video:', e.message);
    process.exit(1);
  }

  // 4) Insert demo clips for the same video_id
  try {
    // Clear old clips for this video
    const { error: delErr } = await admin.from('clips').delete().eq('video_id', demoVideoId);
    if (delErr) throw delErr;

    const clips = [
      { title: '🤯 Shocking Title Secrets REVEALED! 🤫', start_time: 369, end_time: 414, transcript_excerpt: 'Words like shocking, unbelievable...', hook_score: 9 },
      { title: '2 MILLION Subs in 6 Months?! (SECRET Revealed!) 🤫', start_time: 553, end_time: 598, transcript_excerpt: 'My secret strategy...', hook_score: 9 },
      { title: '🛑 STOP! 3 Mistakes KILLING Your Growth!', start_time: 46, end_time: 91, transcript_excerpt: 'Mistake #1 thumbnails...', hook_score: 7 },
    ].map(c => ({ ...c, video_id: demoVideoId }));

    const { error: insErr } = await admin.from('clips').insert(clips);
    if (insErr) throw insErr;
    console.log('Inserted demo clips');
  } catch (e) {
    console.error('Failed to insert clips:', e.message);
    process.exit(1);
  }

  console.log('\n✅ Seeding complete.');
  console.log('Demo user:', demoEmail, '| Password:', demoPassword);
  console.log('Demo video:', demoYouTubeUrl);
}

main();
