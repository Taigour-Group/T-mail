import { supabase } from '../supabase.js';
import { normalizeAddress } from './addresses.js';

// Resolve the tmail mailbox for a freshly-authenticated TGO ID user.
// Handles the "shadow mailbox" case: if mail was already delivered to this
// address (e.g. a verification code) before the user ever opened tmail, a
// mailbox exists with tgo_user_id = "pending:<address>" — adopt it here.
export async function reconcileMailbox({ sub, address, name }) {
  const addr = normalizeAddress(address);

  // 1) Already linked to this TGO ID user?
  const { data: byUser } = await supabase
    .from('mailboxes').select('id, address, display_name').eq('tgo_user_id', sub).maybeSingle();
  if (byUser) {
    if (byUser.address !== addr || (name && byUser.display_name !== name)) {
      await supabase.from('mailboxes').update({ address: addr, display_name: name ?? byUser.display_name }).eq('id', byUser.id);
    }
    return byUser.id;
  }

  // 2) A shadow mailbox for this address? Adopt it.
  const { data: byAddr } = await supabase
    .from('mailboxes').select('id').eq('address', addr).maybeSingle();
  if (byAddr) {
    await supabase.from('mailboxes').update({ tgo_user_id: sub, display_name: name ?? null }).eq('id', byAddr.id);
    return byAddr.id;
  }

  // 3) Brand new.
  const { data: created, error } = await supabase
    .from('mailboxes').insert({ tgo_user_id: sub, address: addr, display_name: name ?? null })
    .select('id').single();
  if (error) throw error;
  return created.id;
}

export async function getMailboxById(id) {
  const { data } = await supabase.from('mailboxes').select('id, address, display_name').eq('id', id).maybeSingle();
  return data;
}
