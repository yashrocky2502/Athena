import fs from 'fs';

let content = fs.readFileSync('src/news/NewsEngine/TelegramDecisionEngine.ts', 'utf-8');

const regex = /private async processQueueItem\(item: TelegramQueueItem\) \{[\s\S]*?public async sendTelegramMessage/m;

const replacement = `private async processQueueItem(item: TelegramQueueItem) {
    const startTime = Date.now();
    console.log(\`[Telegram Worker] Processing item [\${item.id}] for \${item.params.company} (\${item.params.symbol})\`);

    const log = this.getDecisionLogForArticle(item.id);
    if (log) {
      log.workerPicked = true;
      log.deliveryStatus = 'PROCESSING';
    }

    try {
      const result = await this.sendTelegramMessage(item);
      const latencyMs = Date.now() - startTime;
      
      item.sentAt = new Date().toISOString();

      // Exponential backoff strategy: 5s, 30s, 2m, 10m
      if (result.delivered) {
          item.finalStatus = 'DELIVERED';
          item.deliveredAt = new Date().toISOString();
          PersistentTelegramQueue.getInstance().markEventDelivered(item.eventId);
          PersistentTelegramQueue.getInstance().dequeue(item.id);
          PersistentTelegramQueue.getInstance().logProduction(item);
      } else {
          // Rate limit 429 wait slightly longer
          const isRateLimit = result.httpStatus === 429;
          
          if (item.retryCount < PersistentTelegramQueue.getInstance().RETRY_DELAYS_MS.length) {
              const delay = PersistentTelegramQueue.getInstance().RETRY_DELAYS_MS[item.retryCount];
              item.nextRetryAt = Date.now() + (isRateLimit ? delay * 2 : delay);
              item.retryCount++;
              PersistentTelegramQueue.getInstance().updateItem(item);
              console.warn(\`[Telegram Worker] Delivery failed for [\${item.id}], retrying at \${new Date(item.nextRetryAt).toISOString()}\`);
          } else {
              item.finalStatus = 'FAILED';
              PersistentTelegramQueue.getInstance().moveToDlq(item);
              PersistentTelegramQueue.getInstance().logProduction(item);
              console.error(\`[Telegram Worker] Delivery permanently failed for [\${item.id}] after max retries.\`);
          }
      }

      if (log) {
        log.telegramSent = result.sent;
        log.telegramApiCalled = true;
        log.telegramHttpStatus = result.httpStatus;
        log.telegramDelivered = result.delivered;
        log.messageId = result.messageId || null;
        log.failureReason = result.error || null;
        log.latencyMs = (log.latencyMs || 0) + latencyMs;
        log.dispatchLatencyMs = latencyMs;
        log.deliveryStatus = result.delivered ? 'DELIVERED' : 'FAILED';
        log.exactRejectionReason = result.delivered ? null : (result.error || 'API Error');
        log.retryCount = item.retryCount;

        // Update step status in history
        const step8 = log.steps.find((s) => s.stepNumber === 8);
        if (step8) {
          step8.status = result.sent ? 'SUCCESS' : 'FAILED';
          step8.details = result.sent 
            ? \`Telegram alert dispatched to Chat ID (Status: \${result.httpStatus})\` 
            : \`Failed dispatch: \${result.error}\`;
          step8.timestamp = new Date().toISOString();
        }

        const step9 = log.steps.find((s) => s.stepNumber === 9);
        if (step9) {
          step9.status = result.delivered ? 'SUCCESS' : 'FAILED';
          step9.details = result.delivered 
            ? \`Delivered successfully. Message ID: \${result.messageId}\` 
            : \`Delivery unconfirmed: \${result.error}\`;
          step9.timestamp = new Date().toISOString();
        }
      }

      console.log(\`[Telegram Worker] Dispatch complete for [\${item.id}]: Sent=\${result.sent}, Delivered=\${result.delivered}\`);
    } catch (err: any) {
      console.error(\`[Telegram Worker] Unexpected exception during dispatch for [\${item.id}]:\`, err);
      const latencyMs = Date.now() - startTime;
      
      if (item.retryCount < PersistentTelegramQueue.getInstance().RETRY_DELAYS_MS.length) {
          item.nextRetryAt = Date.now() + PersistentTelegramQueue.getInstance().RETRY_DELAYS_MS[item.retryCount];
          item.retryCount++;
          PersistentTelegramQueue.getInstance().updateItem(item);
          console.warn(\`[Telegram Worker] Exception failed for [\${item.id}], retrying...\`);
      } else {
          item.finalStatus = 'FAILED';
          PersistentTelegramQueue.getInstance().moveToDlq(item);
          PersistentTelegramQueue.getInstance().logProduction(item);
      }

      if (log) {
        log.telegramSent = false;
        log.telegramApiCalled = true;
        log.telegramHttpStatus = 500;
        log.telegramDelivered = false;
        log.failureReason = err?.message || 'Worker Exception';
        log.dispatchLatencyMs = latencyMs;
        log.deliveryStatus = 'FAILED';
        log.exactRejectionReason = err?.message || 'Worker Exception';
      }
    }
  }

  /**
   * Executes the actual Telegram Bot API Request and Logs Telemetry
   */
  public async sendTelegramMessage`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/news/NewsEngine/TelegramDecisionEngine.ts', content);
