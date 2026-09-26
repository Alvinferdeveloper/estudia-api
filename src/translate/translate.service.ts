import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

export interface TranslateResult {
  translatedText: string;
  detectedSourceLanguage?: string;
}

// DeepL rejects some bare 2-letter codes as a *target* language and requires
// a regional variant instead (source language has no such restriction).
// Extend this map if a future supported language hits the same requirement.
const TARGET_LANGUAGE_ALIASES: Record<string, string> = {
  EN: 'EN-US',
  PT: 'PT-PT',
};

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private readonly apiKey: string | undefined;
  private readonly http: AxiosInstance;

  constructor() {
    this.apiKey = process.env.DEEPL_API_KEY;

    // DeepL free-tier keys end in ":fx" and only work against the free
    // subdomain; paid keys use the regular one. Inferring this from the key
    // avoids needing a separate "which tier" env var.
    const isFreeKey = this.apiKey?.endsWith(':fx') ?? true;
    const baseURL = isFreeKey
      ? 'https://api-free.deepl.com/v2'
      : 'https://api.deepl.com/v2';

    // Keep-alive so repeated selections (very frequent during a reading
    // session) reuse the TCP/TLS connection instead of paying handshake
    // cost on every request — that handshake is the dominant latency here.
    this.http = axios.create({
      baseURL,
      timeout: 5000,
      httpAgent: new HttpAgent({ keepAlive: true }),
      httpsAgent: new HttpsAgent({ keepAlive: true }),
    });
  }

  async translate(
    text: string,
    targetLanguage = 'es',
  ): Promise<TranslateResult> {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'Translation API key is not configured. Set DEEPL_API_KEY.',
      );
    }

    try {
      const upperTarget = targetLanguage.toUpperCase();
      const target = TARGET_LANGUAGE_ALIASES[upperTarget] ?? upperTarget;

      const { data } = await this.http.post(
        '/translate',
        { text: [text], target_lang: target },
        { headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}` } },
      );

      const result = data?.translations?.[0];

      return {
        translatedText: result?.text ?? text,
        detectedSourceLanguage: result?.detected_source_language,
      };
    } catch (error) {
      this.logger.error(
        'Translation request failed:',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Translation failed');
    }
  }
}
