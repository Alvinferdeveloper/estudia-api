import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { ErrorCode } from '../errors/error-codes';

export enum UsageType {
  CHAT = 'chat',
  AI_NOTE = 'ai_note',
}

@Injectable()
export class UsageInterceptor implements NestInterceptor {
  constructor(private subscriptionsService: SubscriptionsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const usageType = request.headers['x-usage-type'] as UsageType;

    if (!userId || !usageType) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: async () => {
          if (usageType === UsageType.CHAT) {
            const canUse = await this.subscriptionsService.canUseChat(userId);
            if (!canUse) {
              throw new ForbiddenException({
                code: ErrorCode.CHAT_LIMIT_REACHED,
              });
            }
            await this.subscriptionsService.incrementChatUsage(userId);
          } else if (usageType === UsageType.AI_NOTE) {
            const canUse = await this.subscriptionsService.canUseAiNote(userId);
            if (!canUse) {
              throw new ForbiddenException({
                code: ErrorCode.AI_NOTES_LIMIT_REACHED,
              });
            }
            await this.subscriptionsService.incrementAiNoteUsage(userId);
          }
        },
        error: () => {},
      }),
    );
  }
}
