import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../common/errors/error-codes';

export class AIProviderException extends HttpException {
  constructor(message: string, cause?: unknown) {
    super(
      { code: ErrorCode.AI_PROVIDER_ERROR, message },
      HttpStatus.BAD_GATEWAY,
      cause !== undefined ? { cause } : undefined,
    );
  }
}
