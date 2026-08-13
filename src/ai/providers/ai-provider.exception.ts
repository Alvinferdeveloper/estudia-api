import { HttpException, HttpStatus } from '@nestjs/common';

export class AIProviderException extends HttpException {
  constructor(message: string, cause?: unknown) {
    super(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        message,
        error: 'AI Provider Error',
      },
      HttpStatus.BAD_GATEWAY,
      cause !== undefined ? { cause } : undefined,
    );
  }
}
