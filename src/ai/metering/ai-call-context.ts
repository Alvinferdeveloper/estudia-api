import { AsyncLocalStorage } from 'node:async_hooks';

// Who triggered the AI calls running inside a charged action, without threading it through every function.
export interface AICallContext {
  userId: string;
  ledgerEntryId: string;
}

const storage = new AsyncLocalStorage<AICallContext>();

export const aiCallContext = {
  run: <T>(context: AICallContext, fn: () => T): T =>
    storage.run(context, fn),
  current: (): AICallContext | undefined => storage.getStore(),
};
