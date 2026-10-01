import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface TelegramCredentials {
  botToken: string;
  chatId: string;
  enabled?: boolean;
}

export interface TelegramSendResult {
  success: boolean;
  httpStatus: number;
  messageId?: number;
  responseBody?: any;
  error?: string;
  errorCode?: string;
  retryAfterSeconds?: number;
}

export function maskToken(token: string): string {
  if (!token) return '';
  const trimmed = token.trim();
  if (trimmed.length <= 8) return '****';
  const first = trimmed.slice(0, 4);
  const last = trimmed.slice(-4);
  return `${first}****${last}`;
}

export function maskChatId(chatId: string): string {
  if (!chatId) return '';
  const trimmed = chatId.trim();
  if (trimmed.length <= 4) return '****';
  const first = trimmed.slice(0, 3);
  const last = trimmed.slice(-2);
  return `${first}****${last}`;
}

export function sanitizeTelegramLog(text: string, token?: string): string {
  if (!text) return text;
  let sanitized = text;
  if (token && token.length > 5) {
    sanitized = sanitized.replaceAll(token, maskToken(token));
  }
  // Replace any bot<token> URI patterns
  sanitized = sanitized.replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[REDACTED_TOKEN]');
  return sanitized;
}

export class TelegramService {
  private static instance: TelegramService;
  private botToken: string = '';
  private chatId: string = '';
  private enabled: boolean = true;

  // Authoritative credential configuration files stored in persistent /app/data volume
  private configPath: string = (typeof process !== 'undefined' && typeof process.cwd === 'function') 
    ? path.join(process.cwd(), 'data', '.telegram_config.json') 
    : 'data/.telegram_config.json';
  private backupPath: string = (typeof process !== 'undefined' && typeof process.cwd === 'function') 
    ? path.join(process.cwd(), 'data', '.telegram_config.backup.json') 
    : 'data/.telegram_config.backup.json';

  // Legacy root paths for non-destructive migration
  private legacyConfigPath: string = (typeof process !== 'undefined' && typeof process.cwd === 'function') 
    ? path.join(process.cwd(), '.telegram_config.json') 
    : '.telegram_config.json';
  private legacyBackupPath: string = (typeof process !== 'undefined' && typeof process.cwd === 'function') 
    ? path.join(process.cwd(), '.telegram_config.backup.json') 
    : '.telegram_config.backup.json';

  // Live status telemetry
  private lastVerifiedAt: string | null = null;
  private lastVerifiedStatus: 'CONNECTED' | 'DISCONNECTED' = 'DISCONNECTED';
  private botUsername: string | null = null;
  private botId: number | null = null;
  private lastError: string | null = null;

  private constructor() {
    this.loadCredentials();
  }

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public getBackupPath(): string {
    return this.backupPath;
  }

  public setCustomPathsForTest(configPath?: string, backupPath?: string): void {
    if (configPath) this.configPath = configPath;
    if (backupPath) this.backupPath = backupPath;
  }

  public resetCustomPaths(): void {
    this.configPath = (typeof process !== 'undefined' && typeof process.cwd === 'function') 
      ? path.join(process.cwd(), 'data', '.telegram_config.json') 
      : 'data/.telegram_config.json';
    this.backupPath = (typeof process !== 'undefined' && typeof process.cwd === 'function') 
      ? path.join(process.cwd(), 'data', '.telegram_config.backup.json') 
      : 'data/.telegram_config.backup.json';
  }

  private ensureDataDirExists(): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        // Fallback
      }
    }
  }

  /**
   * Non-destructive migration:
   * Migrates legacy credentials from process.cwd()/.telegram_config.json into
   * persistent data volume process.cwd()/data/.telegram_config.json if the new persistent file
   * does not exist yet. Idempotent and never overwrites an existing persistent file.
   */
  public migrateLegacyConfigIfNeeded(): boolean {
    try {
      this.ensureDataDirExists();
      if (!fs.existsSync(this.configPath) && fs.existsSync(this.legacyConfigPath)) {
        const raw = fs.readFileSync(this.legacyConfigPath, 'utf-8');
        const parsed = JSON.parse(raw);
        const botToken = parsed.botToken || parsed.telegramBotToken || '';
        const chatId = parsed.chatId || parsed.telegramChatId || '';
        const enabled = parsed.enabled !== undefined ? parsed.enabled : true;

        if (this.isLocalConfigValid({ botToken, chatId, enabled })) {
          const payload = JSON.stringify({ botToken, chatId, enabled }, null, 2);
          const tempPath = this.configPath + '.tmp';
          fs.writeFileSync(tempPath, payload, 'utf-8');
          fs.renameSync(tempPath, this.configPath);
          fs.writeFileSync(this.backupPath, payload, 'utf-8');
          console.info('[TelegramService] Migrated existing legacy credentials to persistent data volume.');
          return true;
        }
      }
    } catch (e: any) {
      console.warn('[TelegramService] Legacy migration check failed non-fatally:', e?.message);
    }
    return false;
  }

  public isLocalConfigValid(creds: TelegramCredentials): boolean {
    if (!creds || !creds.botToken || !creds.chatId) {
      return false;
    }
    const token = creds.botToken.trim();
    const chat = creds.chatId.trim();

    if (!token || !chat) {
      return false;
    }

    // Check for placeholder/mock/example patterns
    const invalidPatterns = [
      "placeholder",
      "mock",
      "example",
      "your_",
      "bot_token",
      "token_here",
      "xxxx"
    ];
    for (const pattern of invalidPatterns) {
      if (token.toLowerCase().includes(pattern) || chat.toLowerCase().includes(pattern)) {
        return false;
      }
    }

    if (token === "123456" || chat === "123456") {
      return false;
    }

    // Check format (digits:secret_key with at least 30 chars in secret)
    const tokenRegex = /^\d+:[A-Za-z0-9_-]{30,}$/;
    if (!tokenRegex.test(token)) {
      return false;
    }

    return true;
  }

  public getLocalConfigValidationError(token: string, chatId: string): string | null {
    const trimmedToken = token.trim();
    const trimmedChatId = chatId.trim();

    if (!trimmedToken) {
      return 'Bot Token is empty';
    }
    if (!trimmedChatId) {
      return 'Chat ID is empty';
    }

    const invalidPatterns = [
      "placeholder",
      "mock",
      "example",
      "your_",
      "bot_token",
      "token_here",
      "xxxx",
      "123456"
    ];
    for (const pattern of invalidPatterns) {
      if (trimmedToken.toLowerCase().includes(pattern)) {
        return `Bot Token contains forbidden pattern: '${pattern}'`;
      }
      if (trimmedChatId.toLowerCase().includes(pattern)) {
        return `Chat ID contains forbidden pattern: '${pattern}'`;
      }
    }

    const tokenRegex = /^\d+:[A-Za-z0-9_-]{30,}$/;
    if (!tokenRegex.test(trimmedToken)) {
      return "Bot Token format is invalid. Must match standard '<bot_id>:<secret>' with at least 30 characters in secret.";
    }

    return null;
  }

  public loadCredentials(): TelegramCredentials {
    // 0. Perform idempotent non-destructive migration if legacy file exists and persistent file does not
    this.migrateLegacyConfigIfNeeded();

    let mainValid = false;
    let mainCreds: TelegramCredentials = { botToken: '', chatId: '', enabled: true };

    // 1. Try persistent data volume file (/app/data/.telegram_config.json)
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data);
        const botToken = parsed.botToken || parsed.telegramBotToken || '';
        const chatId = parsed.chatId || parsed.telegramChatId || '';
        const enabled = parsed.enabled !== undefined ? parsed.enabled : true;
        mainCreds = { botToken, chatId, enabled };
        if (this.isLocalConfigValid(mainCreds)) {
          mainValid = true;
        }
      }
    } catch (e) {
      console.error('[TelegramService] Error parsing persistent .telegram_config.json on startup:', e);
    }

    if (mainValid) {
      this.botToken = mainCreds.botToken;
      this.chatId = mainCreds.chatId;
      this.enabled = mainCreds.enabled ?? true;
      return mainCreds;
    }

    // 2. Try persistent backup file (/app/data/.telegram_config.backup.json) if main config is missing or invalid
    let backupValid = false;
    let backupCreds: TelegramCredentials = { botToken: '', chatId: '', enabled: true };

    try {
      if (fs.existsSync(this.backupPath)) {
        const data = fs.readFileSync(this.backupPath, 'utf-8');
        const parsed = JSON.parse(data);
        const botToken = parsed.botToken || parsed.telegramBotToken || '';
        const chatId = parsed.chatId || parsed.telegramChatId || '';
        const enabled = parsed.enabled !== undefined ? parsed.enabled : true;
        backupCreds = { botToken, chatId, enabled };
        if (this.isLocalConfigValid(backupCreds)) {
          backupValid = true;
        }
      }
    } catch (e) {
      console.error('[TelegramService] Error parsing persistent .telegram_config.backup.json on startup:', e);
    }

    if (backupValid) {
      try {
        const tempPath = this.configPath + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(backupCreds, null, 2), 'utf-8');
        fs.renameSync(tempPath, this.configPath);
        this.botToken = backupCreds.botToken;
        this.chatId = backupCreds.chatId;
        this.enabled = backupCreds.enabled ?? true;
        return backupCreds;
      } catch (err) {
        console.error('[TelegramService] Failed to restore config from backup file:', err);
      }
    }

    // 3. Fallback: Environment variables TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
    const envToken = (typeof process !== 'undefined' && process.env?.TELEGRAM_BOT_TOKEN) 
      ? process.env.TELEGRAM_BOT_TOKEN.trim() 
      : '';
    const envChatId = (typeof process !== 'undefined' && process.env?.TELEGRAM_CHAT_ID) 
      ? process.env.TELEGRAM_CHAT_ID.trim() 
      : '';
    const envCreds: TelegramCredentials = { botToken: envToken, chatId: envChatId, enabled: true };

    if (this.isLocalConfigValid(envCreds)) {
      this.botToken = envCreds.botToken;
      this.chatId = envCreds.chatId;
      this.enabled = true;
      console.info('[TelegramService] Loaded Telegram credentials from environment variable fallback.');
      return envCreds;
    }

    this.botToken = '';
    this.chatId = '';
    this.enabled = false;
    return { botToken: '', chatId: '', enabled: false };
  }

  public async saveCredentials(
    botToken: string,
    chatId: string,
    enabled: boolean = true,
    source: string = 'POST /api/telegram/save'
  ): Promise<{ success: boolean; message: string; error?: string }> {
    let targetToken = botToken.trim();
    const targetChat = chatId.trim();

    // If targetToken is masked or contains asterisks or is empty, retain stored token if available
    if ((targetToken.includes('****') || targetToken === maskToken(this.botToken) || !targetToken) && this.botToken) {
      targetToken = this.botToken;
    }

    // Validate provided credentials against Telegram getMe API
    const validation = await this.validateCredentials(targetToken, targetChat);
    if (!validation.success) {
      const errMsg = validation.error || 'Validation failed';
      this.lastError = errMsg;
      return { success: false, message: `Validation failed: ${errMsg}`, error: errMsg };
    }

    const oldToken = this.botToken;
    const oldChecksum = crypto.createHash('sha256').update(oldToken).digest('hex');

    try {
      this.ensureDataDirExists();
      if (fs.existsSync(this.configPath)) {
        try {
          const currentConfigData = fs.readFileSync(this.configPath, 'utf-8');
          fs.writeFileSync(this.backupPath, currentConfigData, 'utf-8');
        } catch (backupErr) {
          console.warn('[TelegramService] Could not parse current config for backup:', backupErr);
        }
      }

      const tempPath = this.configPath + '.tmp';
      const newConfigObj = { botToken: targetToken, chatId: targetChat, enabled };
      const newConfigJson = JSON.stringify(newConfigObj, null, 2);
      fs.writeFileSync(tempPath, newConfigJson, 'utf-8');

      const verifyJson = fs.readFileSync(tempPath, 'utf-8');
      const verifyObj = JSON.parse(verifyJson);
      if (verifyObj.botToken !== targetToken || verifyObj.chatId !== targetChat) {
        throw new Error('Temporary file verification failed. Mismatched contents.');
      }

      fs.renameSync(tempPath, this.configPath);

      this.botToken = targetToken;
      this.chatId = targetChat;
      this.enabled = enabled;

      const newChecksum = crypto.createHash('sha256').update(targetToken).digest('hex');
      console.info(JSON.stringify({
        type: 'TELEGRAM_CREDENTIALS_CHANGED',
        timestamp: new Date().toISOString(),
        oldChecksum,
        newChecksum,
        saveSource: source,
        validationResult: 'SUCCESS'
      }, null, 2));

      return { success: true, message: 'Credentials saved to .telegram_config.json' };
    } catch (e: any) {
      const errStr = e?.message || String(e);
      this.lastError = errStr;
      return { success: false, message: `Save failed: ${errStr}`, error: errStr };
    }
  }

  public getCredentials(): TelegramCredentials {
    return { botToken: this.botToken, chatId: this.chatId, enabled: this.enabled };
  }

  public setCredentials(botToken: string, chatId: string, enabled: boolean = true): void {
    this.botToken = botToken;
    this.chatId = chatId;
    this.enabled = enabled;
  }

  public getPublicConfig() {
    return {
      hasBotToken: !!this.botToken && this.isLocalConfigValid({ botToken: this.botToken, chatId: this.chatId }),
      botTokenMasked: maskToken(this.botToken),
      chatId: this.chatId,
      chatIdMasked: maskChatId(this.chatId),
      enabled: this.enabled
    };
  }

  public async validateCredentials(
    botToken?: string,
    chatId?: string
  ): Promise<{ success: boolean; bot?: any; chat?: any; error?: string; httpStatus?: number; lastVerifiedAt?: string }> {
    let token = (botToken || this.botToken).trim();
    const targetChat = (chatId || this.chatId).trim();

    if ((token.includes('****') || token === maskToken(this.botToken) || !token) && this.botToken) {
      token = this.botToken;
    }

    const localError = this.getLocalConfigValidationError(token, targetChat);
    if (localError) {
      this.lastVerifiedStatus = 'DISCONNECTED';
      this.lastError = localError;
      return {
        success: false,
        error: localError,
        httpStatus: 400
      };
    }

    try {
      // 1. Validate Bot Token using getMe
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const meStatus = meRes.status;
      const meData = await meRes.json().catch(() => ({}));

      if (meStatus === 401) {
        const errDesc = "Telegram authentication failed. Check the Bot Token.";
        this.lastVerifiedStatus = 'DISCONNECTED';
        this.lastError = errDesc;
        return { success: false, error: errDesc, httpStatus: 401 };
      }
      if (meStatus === 403) {
        const errDesc = "Telegram bot does not have permission to send messages to this chat.";
        this.lastVerifiedStatus = 'DISCONNECTED';
        this.lastError = errDesc;
        return { success: false, error: errDesc, httpStatus: 403 };
      }
      if (meStatus === 429) {
        const errDesc = "Telegram rate limit reached. Retry scheduled.";
        this.lastVerifiedStatus = 'DISCONNECTED';
        this.lastError = errDesc;
        return { success: false, error: errDesc, httpStatus: 429 };
      }

      if (!meRes.ok || !meData.ok) {
        const errDesc = meData.description || `Invalid Bot Token (HTTP ${meStatus})`;
        this.lastVerifiedStatus = 'DISCONNECTED';
        this.lastError = errDesc;
        return { success: false, error: errDesc, httpStatus: meStatus };
      }

      // 2. Validate Chat ID using getChat
      const chatRes = await fetch(
        `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(targetChat)}`
      );
      const chatStatus = chatRes.status;
      const chatData = await chatRes.json().catch(() => ({}));

      if (chatStatus === 400 || !chatRes.ok || !chatData.ok) {
        const errDesc = chatStatus === 400 
          ? "Telegram rejected the request. Check the Chat ID/message parameters."
          : (chatData.description || `Invalid Chat ID (HTTP ${chatStatus})`);
        this.lastVerifiedStatus = 'DISCONNECTED';
        this.lastError = errDesc;
        return { success: false, error: errDesc, httpStatus: chatStatus };
      }

      // Successful verification
      this.lastVerifiedAt = new Date().toISOString();
      this.lastVerifiedStatus = 'CONNECTED';
      this.botUsername = meData.result?.username ? `@${meData.result.username}` : null;
      this.botId = meData.result?.id || null;
      this.lastError = null;

      return {
        success: true,
        bot: meData.result,
        chat: chatData.result,
        httpStatus: 200,
        lastVerifiedAt: this.lastVerifiedAt
      };
    } catch (e: any) {
      const errDesc = "Telegram API could not be reached. Retry scheduled.";
      this.lastVerifiedStatus = 'DISCONNECTED';
      this.lastError = errDesc;
      return {
        success: false,
        error: errDesc,
        httpStatus: 500
      };
    }
  }

  public async sendMessage(
    text: string,
    customToken?: string,
    customChatId?: string
  ): Promise<TelegramSendResult> {
    let token = (customToken || this.botToken).trim();
    const chatId = (customChatId || this.chatId).trim();

    if ((token.includes('****') || token === maskToken(this.botToken) || !token) && this.botToken) {
      token = this.botToken;
    }

    if (!token || !chatId) {
      return {
        success: false,
        httpStatus: 400,
        error: 'Missing Telegram credentials (Bot Token or Chat ID)',
        errorCode: 'MISSING_CREDENTIALS'
      };
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    };

    let attempt = 0;
    while (attempt < 2) {
      attempt++;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const status = res.status;
        const data = await res.json().catch(() => ({}));

        if (status === 200 && data.ok && data.result?.message_id) {
          this.lastVerifiedStatus = 'CONNECTED';
          this.lastError = null;
          return {
            success: true,
            httpStatus: 200,
            messageId: data.result.message_id,
            responseBody: data,
          };
        }

        // Map Telegram specific HTTP status codes
        let mappedError = data.description || `HTTP ${status}`;
        let errorCode = `HTTP_${status}`;

        let retryAfterSeconds: number | undefined;
        if (status === 401) {
          mappedError = "Telegram authentication failed. Check the Bot Token.";
          errorCode = "AUTH_FAILED";
        } else if (status === 400) {
          mappedError = "Telegram rejected the request. Check the Chat ID/message parameters.";
          errorCode = "INVALID_PAYLOAD";
        } else if (status === 403) {
          mappedError = "Telegram bot does not have permission to send messages to this chat.";
          errorCode = "PERMISSION_DENIED";
        } else if (status === 429) {
          mappedError = "Telegram rate limit reached. Retry scheduled.";
          errorCode = "RATE_LIMITED";
          retryAfterSeconds = data.parameters?.retry_after ||
            (res.headers.get('retry-after') ? parseInt(res.headers.get('retry-after')!, 10) : undefined);
        }

        // Retry criteria: 429 or 500+ (retry once after 1 second for test speed)
        if ((status === 429 || status >= 500) && attempt === 1) {
          console.warn(`[TelegramService] Telegram returned ${status}. Retrying in 1 second...`);
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        this.lastError = mappedError;
        return {
          success: false,
          httpStatus: status,
          responseBody: data,
          error: mappedError,
          errorCode,
          retryAfterSeconds
        };
      } catch (e: any) {
        if (attempt === 1) {
          console.warn(`[TelegramService] Network error sending message. Retrying in 1 second...`, e);
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        const netErr = "Telegram API could not be reached. Retry scheduled.";
        this.lastError = netErr;
        return {
          success: false,
          httpStatus: 500,
          error: netErr,
          errorCode: 'NETWORK_ERROR'
        };
      }
    }

    return {
      success: false,
      httpStatus: 500,
      error: 'Failed after retries',
      errorCode: 'MAX_RETRIES'
    };
  }

  public getStatusReport() {
    return {
      connected: this.lastVerifiedStatus === 'CONNECTED',
      status: this.lastVerifiedStatus,
      botUsername: this.botUsername,
      botId: this.botId,
      chatIdMasked: maskChatId(this.chatId),
      hasBotToken: !!this.botToken && this.isLocalConfigValid({ botToken: this.botToken, chatId: this.chatId }),
      lastVerifiedAt: this.lastVerifiedAt,
      lastError: this.lastError
    };
  }
}
