import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { asyncH, requireUser } from '../middleware.js';

export const friendsRouter = Router();
friendsRouter.use(requireUser);

friendsRouter.get('/', asyncH(async (req, res) => {
  const parsed = z.string().trim().min(1).max(200).safeParse(req.query.q);
  if (!parsed.success) return res.json({ friends: [] });

  const query = parsed.data;
  const { data, error } = await supabase
    .from('mailboxes')
    .select('address, display_name')
    .neq('id', req.user.mailboxId)
    .ilike('address', `%${query}%`)
    .order('address', { ascending: true })
    .limit(20);
  if (error) throw error;

  res.json({
    friends: (data || []).map((friend) => ({
      address: friend.address,
      name: friend.display_name || friend.address,
    })),
  });
}));
