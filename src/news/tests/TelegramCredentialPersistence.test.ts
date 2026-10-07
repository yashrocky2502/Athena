import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TelegramService, maskToken, maskChatId } from '../NewsEngine/TelegramService';
import { TelegramNotificationPipeline } from '../NewsEngine/TelegramNotificationPipeline';
import { TelegramNotificationStateStore } from '../NewsEngine/TelegramNotificationStateStore';

describe('ATHENA — Telegram Credential Persistence Forensic Test Suite', () => {
  const sandboxDir = path.join(process.cwd(), 'data', 'test_cred_persistence_sandbox');
  const testConfigPath = path.join(sandboxDir, '.telegram_config.json');
  const testBackupPath = path.join(sandboxDir, '.telegram_config.backup.json');

  const SYNTHETIC_TOKEN_1 = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz_12345678';
  const SYNTHETIC_TOKEN_2 = '987654321:ZYXwvUTSRqponMLKjihgFEDCba_87654321';
  const SYNTHETIC_CHAT_ID = '-1001987654321';

  let telegramService: TelegramService;

  beforeEach(() => {
    // Ensure clean test sandbox directory
    if (!fs.existsSync(sandboxDir)) {
      fs.mkdirSync(sandboxDir, { recursive: true });
    }
    // Clean sandbox files
    if (fs.existsSync(testConfigPath)) fs.unlinkSync(testConfigPath);
    if (fs.existsSync(testBackupPath)) fs.unlinkSync(testBackupPath);

    telegramService = TelegramService.getInstance();
    telegramService.setCustomPathsForTest(testConfigPath, testBackupPath);
  });

  afterEach(() => {
    telegramService.resetCustomPaths();
    telegramService.loadCredentials();
    // Clean up sandbox
    if (fs.existsSync(testConfigPath)) fs.unlinkSync(testConfigPath);
    if (fs.existsSync(testBackupPath)) fs.unlinkSync(testBackupPath);
    if (fs.existsSync(sandboxDir)) {
      try { fs.rmdirSync(sandboxDir); } catch (_) {}
    }
    vi.restoreAllMocks();
  });

  it('TEST 1: Save valid token → reload → token remains', async () => {
    const res = await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });
    expect(res.success).toBe(true);

    // Verify written to disk
    expect(fs.existsSync(testConfigPath)).toBe(true);

    // Re-instantiate / simulate reload
    const creds = telegramService.loadCredentials();
    expect(creds.botToken).toBe(SYNTHETIC_TOKEN_1);
  });

  it('TEST 2: Save valid token + chat ID → reload → both remain', async () => {
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });

    const creds = telegramService.loadCredentials();
    expect(creds.botToken).toBe(SYNTHETIC_TOKEN_1);
    expect(creds.chatId).toBe(SYNTHETIC_CHAT_ID);
    expect(creds.enabled).toBe(true);
  });

  it('TEST 3: Backend restart simulation → credential remains', async () => {
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });

    // Wipe in-memory state to simulate clean process startup
    telegramService.setCredentials('', '', false);
    expect(telegramService.getCredentials().botToken).toBe('');

    // Hydrate from disk
    const creds = telegramService.loadCredentials();
    expect(creds.botToken).toBe(SYNTHETIC_TOKEN_1);
    expect(creds.chatId).toBe(SYNTHETIC_CHAT_ID);
  });

  it('TEST 4: Empty settings payload cannot erase valid token', async () => {
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });

    // Attempt to save empty token
    const res = await telegramService.saveCredentials('', SYNTHETIC_CHAT_ID, true, 'TEST_EMPTY', { skipLiveValidation: true });
    expect(res.success).toBe(true);

    // Token must still be the valid token (retained)
    const creds = telegramService.getCredentials();
    expect(creds.botToken).toBe(SYNTHETIC_TOKEN_1);

    // Check disk as well
    const fileData = JSON.parse(fs.readFileSync(testConfigPath, 'utf-8'));
    expect(fileData.botToken).toBe(SYNTHETIC_TOKEN_1);
  });

  it('TEST 5: "undefined" or masked token cannot erase valid token', async () => {
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });

    // Masked token payload
    const masked = maskToken(SYNTHETIC_TOKEN_1);
    const res = await telegramService.saveCredentials(masked, SYNTHETIC_CHAT_ID, true, 'TEST_MASKED', { skipLiveValidation: true });
    expect(res.success).toBe(true);

    const creds = telegramService.getCredentials();
    expect(creds.botToken).toBe(SYNTHETIC_TOKEN_1);
  });

  it('TEST 6: Invalid replacement token cannot erase existing valid token', async () => {
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });

    // Attempt to overwrite with invalid token
    const res = await telegramService.saveCredentials('invalid_token_123', SYNTHETIC_CHAT_ID, true, 'TEST_INVALID', { skipLiveValidation: true });
    expect(res.success).toBe(false);

    // Existing token remains intact
    const creds = telegramService.getCredentials();
    expect(creds.botToken).toBe(SYNTHETIC_TOKEN_1);

    const fileData = JSON.parse(fs.readFileSync(testConfigPath, 'utf-8'));
    expect(fileData.botToken).toBe(SYNTHETIC_TOKEN_1);
  });

  it('TEST 7: Explicit credential deletion removes credential', async () => {
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });
    expect(fs.existsSync(testConfigPath)).toBe(true);

    const delRes = telegramService.deleteCredentials('TEST_DELETE');
    expect(delRes.success).toBe(true);

    expect(telegramService.getCredentials().botToken).toBe('');
    expect(fs.existsSync(testConfigPath)).toBe(false);
    expect(fs.existsSync(testBackupPath)).toBe(false);
  });

  it('TEST 8: Clearing notification/history data does NOT remove credentials', async () => {
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });

    // Clear state store and pipeline history
    const stateStore = TelegramNotificationStateStore.getInstance();
    stateStore.clear();

    const pipeline = TelegramNotificationPipeline.getInstance();
    pipeline.clearHistory();

    // Credentials must remain unaffected
    const creds = telegramService.loadCredentials();
    expect(creds.botToken).toBe(SYNTHETIC_TOKEN_1);
    expect(creds.chatId).toBe(SYNTHETIC_CHAT_ID);
    expect(fs.existsSync(testConfigPath)).toBe(true);
  });

  it('TEST 9: Missing primary credential can recover from valid backup if backup exists', async () => {
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });
    expect(fs.existsSync(testBackupPath)).toBe(true);

    // Delete primary config file, simulate accidental primary loss
    fs.unlinkSync(testConfigPath);
    expect(fs.existsSync(testConfigPath)).toBe(false);

    // Wipe memory
    telegramService.setCredentials('', '', false);

    // Load credentials -> recovers from backup
    const creds = telegramService.loadCredentials();
    expect(creds.botToken).toBe(SYNTHETIC_TOKEN_1);
    expect(creds.chatId).toBe(SYNTHETIC_CHAT_ID);

    // Primary config path should have been restored
    expect(fs.existsSync(testConfigPath)).toBe(true);
  });

  it('TEST 10: Empty environment variables cannot override valid persisted credentials', async () => {
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });

    const origToken = process.env.TELEGRAM_BOT_TOKEN;
    const origChat = process.env.TELEGRAM_CHAT_ID;
    try {
      process.env.TELEGRAM_BOT_TOKEN = '';
      process.env.TELEGRAM_CHAT_ID = '';

      const creds = telegramService.loadCredentials();
      expect(creds.botToken).toBe(SYNTHETIC_TOKEN_1);
      expect(creds.chatId).toBe(SYNTHETIC_CHAT_ID);
    } finally {
      process.env.TELEGRAM_BOT_TOKEN = origToken;
      process.env.TELEGRAM_CHAT_ID = origChat;
    }
  });

  it('TEST 11: Valid environment fallback works when no persisted credential exists', async () => {
    // Both files absent
    expect(fs.existsSync(testConfigPath)).toBe(false);
    expect(fs.existsSync(testBackupPath)).toBe(false);

    const origToken = process.env.TELEGRAM_BOT_TOKEN;
    const origChat = process.env.TELEGRAM_CHAT_ID;
    try {
      process.env.TELEGRAM_BOT_TOKEN = SYNTHETIC_TOKEN_2;
      process.env.TELEGRAM_CHAT_ID = '-1009988776655';

      const creds = telegramService.loadCredentials();
      expect(creds.botToken).toBe(SYNTHETIC_TOKEN_2);
      expect(creds.chatId).toBe('-1009988776655');
    } finally {
      process.env.TELEGRAM_BOT_TOKEN = origToken;
      process.env.TELEGRAM_CHAT_ID = origChat;
    }
  });

  it('TEST 12: Temporary Telegram network failure does NOT delete credentials', async () => {
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });

    // Mock fetch to simulate network failure (500 Internal Server Error)
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        throw new Error('Connection refused / DNS lookup failed');
      };

      const valRes = await telegramService.validateCredentials();
      expect(valRes.success).toBe(false);

      // Credentials remain valid on disk and in memory
      const creds = telegramService.getCredentials();
      expect(creds.botToken).toBe(SYNTHETIC_TOKEN_1);
      expect(fs.existsSync(testConfigPath)).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('TEST 13: Container/application initialization does not overwrite existing credentials', async () => {
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST', { skipLiveValidation: true });

    // Simulate startup check
    const credsBefore = telegramService.getCredentials();
    telegramService.migrateLegacyConfigIfNeeded();
    telegramService.loadCredentials();
    const credsAfter = telegramService.getCredentials();

    expect(credsAfter.botToken).toBe(credsBefore.botToken);
    expect(credsAfter.chatId).toBe(credsBefore.chatId);
  });

  it('TEST 14: Credential file remains separate from protected news/portfolio datasets', async () => {
    const protectedFiles = [
      'data/portfolio_store.json',
      'data/news_core_v2.json',
      'data/news_intelligence_v2.json',
      'data/market_intelligence_outcomes.json',
      'data/news_signal_lifecycle.json',
      'data/news_signal_historical_ledger.json',
      'data/telegram_pipeline_config.json',
      'data/telegram_outbox.json'
    ];

    // Compute hashes before
    const beforeHashes: Record<string, string> = {};
    for (const f of protectedFiles) {
      if (fs.existsSync(f)) {
        beforeHashes[f] = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
      }
    }

    // Perform save and load operations
    await telegramService.saveCredentials(SYNTHETIC_TOKEN_1, SYNTHETIC_CHAT_ID, true, 'TEST_SEPARATION', { skipLiveValidation: true });
    telegramService.loadCredentials();

    // Verify all protected datasets remain exactly untouched
    for (const f of protectedFiles) {
      if (fs.existsSync(f)) {
        const afterHash = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
        expect(afterHash).toBe(beforeHashes[f]);
      }
    }
  });
});
