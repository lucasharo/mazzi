import { supabase } from './supabase';

export async function getMyProfileAvatar(): Promise<string | undefined> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return undefined;

  const { data, error } = await (supabase as any)
    .from('users')
    .select('avatar_url')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.avatar_url || undefined;
}

