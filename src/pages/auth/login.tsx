import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) console.error(error);
    if (data?.url) {
      window.location.href = data.url; // redirect to supabase sign-in page
    }
  };
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Login</h1>
      <button onClick={signIn}>Login with Google</button>
    </div>
  );
}
