import type { Context, SessionFlavor, MiddlewareFn } from 'grammy';

export interface SessionData {
  lastMessageAt?: number;
  messageCount?: number;
}

export type AppContext = Context & SessionFlavor<SessionData>;

export function createWhitelistMiddleware(allowedUserIds: string[]): MiddlewareFn<AppContext> {
  const allowedSet = new Set(allowedUserIds);

  return async (ctx: AppContext, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();

    if (!userId) {
      console.log('[Whitelist] Rejected: No user ID in update');
      return;
    }

    if (!allowedSet.has(userId)) {
      console.log(`[Whitelist] Rejected user: ${userId}`);
      await ctx.reply('⛔ Acceso Denegado. No tienes permisos para usar este bot.');
      return;
    }

    return next();
  };
}
