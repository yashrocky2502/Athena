import { LiveMarketReactionEngine, MarketReactionSnapshot } from './LiveMarketReactionEngine.ts';
import { MarketVolumeConfirmationEngine, VolumeConfirmationSnapshot } from './MarketVolumeConfirmationEngine.ts';
import { FnoPositioningEngine, FnoPositioningSnapshot } from './FnoPositioningEngine.ts';

export type OverallConfirmationState =
  | 'CONFIRMED'
  | 'PARTIALLY_CONFIRMED'
  | 'NEUTRAL'
  | 'CONTRADICTED'
  | 'INSUFFICIENT_EVIDENCE';

export interface MarketConfirmationDossier {
  symbol: string;
  fundamentalDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN';
  priceReaction: MarketReactionSnapshot;
  volumeConfirmation: VolumeConfirmationSnapshot;
  fnoPositioning: FnoPositioningSnapshot;
  overallConfirmation: OverallConfirmationState;
  contradictionFlags: string[];
  evidenceCompleteness: number; // percentage
  confidence: number; // 0 to 100
  marketInterpretation: string;
  timestamp: string;
}

export class MarketConfirmationEngine {
  /**
   * Combines fundamental direction, live market pricing, volume participation,
   * and derivatives positions to form the unified confirmation snapshot.
   */
  public static process(
    symbol: string,
    eventTimestampStr: string,
    fundamentalDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN'
  ): MarketConfirmationDossier {
    const cleanSymbol = symbol.trim().toUpperCase();

    // 1. Calculate price reaction snapshot
    const priceReaction = LiveMarketReactionEngine.calculate(cleanSymbol, eventTimestampStr);

    // 2. Evaluate volume confirmation snapshot
    const volumeConfirmation = MarketVolumeConfirmationEngine.evaluate(
      cleanSymbol,
      eventTimestampStr,
      priceReaction.percentagePriceChange
    );

    // 3. Compute derivatives positioning snapshot
    const fnoPositioning = FnoPositioningEngine.calculate(
      cleanSymbol,
      eventTimestampStr,
      priceReaction.percentagePriceChange
    );

    // 4. Trace contradictions
    const contradictionFlags: string[] = [];
    const pChange = priceReaction.percentagePriceChange ?? 0;

    if (fundamentalDirection === 'BULLISH' && priceReaction.reactionDirection === 'NEGATIVE') {
      contradictionFlags.push('PRICE_DIRECTION_CONTRADICTS_BULLISH_THESIS');
    } else if (fundamentalDirection === 'BEARISH' && priceReaction.reactionDirection === 'POSITIVE') {
      contradictionFlags.push('PRICE_DIRECTION_CONTRADICTS_BEARISH_THESIS');
    }

    if (Math.abs(pChange) >= 1.5 && volumeConfirmation.confirmationStatus === 'CONTRADICTORY') {
      contradictionFlags.push('VOLUME_PARTICIPATION_DEFICIT');
    }

    if (priceReaction.reactionDirection === 'POSITIVE' && fnoPositioning.optionFlowClassification === 'CALL_WRITING') {
      contradictionFlags.push('FNO_FLOWS_CONTRADICT_BULLISH_PRICE_ACTION');
    } else if (priceReaction.reactionDirection === 'NEGATIVE' && fnoPositioning.optionFlowClassification === 'PUT_WRITING') {
      contradictionFlags.push('FNO_FLOWS_CONTRADICT_BEARISH_PRICE_ACTION');
    }

    // 5. Determine overall confirmation state
    let overallConfirmation: OverallConfirmationState = 'INSUFFICIENT_EVIDENCE';

    if (priceReaction.availability === 'NOT_AVAILABLE') {
      overallConfirmation = 'INSUFFICIENT_EVIDENCE';
    } else if (contradictionFlags.length > 0 && contradictionFlags.some(f => f.startsWith('PRICE_DIRECTION_CONTRADICTS'))) {
      overallConfirmation = 'CONTRADICTED';
    } else if (fundamentalDirection === 'BULLISH') {
      if (priceReaction.reactionDirection === 'POSITIVE') {
        const isVolOk = volumeConfirmation.confirmationStatus === 'STRONG_CONFIRMATION' || volumeConfirmation.confirmationStatus === 'CONFIRMED';
        const isFnoOk = ['PUT_WRITING', 'CALL_BUYING', 'LONG_BUILDUP', 'SHORT_COVERING'].includes(fnoPositioning.optionFlowClassification);
        
        if (isVolOk && isFnoOk) {
          overallConfirmation = 'CONFIRMED';
        } else if (isVolOk || isFnoOk) {
          overallConfirmation = 'PARTIALLY_CONFIRMED';
        } else {
          overallConfirmation = 'NEUTRAL';
        }
      } else if (priceReaction.reactionDirection === 'NEUTRAL') {
        overallConfirmation = 'NEUTRAL';
      } else {
        overallConfirmation = 'CONTRADICTED';
      }
    } else if (fundamentalDirection === 'BEARISH') {
      if (priceReaction.reactionDirection === 'NEGATIVE') {
        const isVolOk = volumeConfirmation.confirmationStatus === 'STRONG_CONFIRMATION' || volumeConfirmation.confirmationStatus === 'CONFIRMED';
        const isFnoOk = ['CALL_WRITING', 'PUT_BUYING', 'SHORT_BUILDUP', 'LONG_UNWINDING'].includes(fnoPositioning.optionFlowClassification);

        if (isVolOk && isFnoOk) {
          overallConfirmation = 'CONFIRMED';
        } else if (isVolOk || isFnoOk) {
          overallConfirmation = 'PARTIALLY_CONFIRMED';
        } else {
          overallConfirmation = 'NEUTRAL';
        }
      } else if (priceReaction.reactionDirection === 'NEUTRAL') {
        overallConfirmation = 'NEUTRAL';
      } else {
        overallConfirmation = 'CONTRADICTED';
      }
    } else {
      // Thesis is neutral or unknown
      overallConfirmation = 'NEUTRAL';
    }

    // If there is simply no market data available
    if (priceReaction.availability === 'NOT_AVAILABLE' && volumeConfirmation.volumeAvailability === 'NOT_AVAILABLE') {
      overallConfirmation = 'INSUFFICIENT_EVIDENCE';
    }

    // 6. Generate precise, deterministic market interpretation
    let marketInterpretation = 'No market-state evidence available; tracking ongoing trading signals.';

    if (priceReaction.availability === 'AVAILABLE') {
      const dirWord = priceReaction.reactionDirection === 'POSITIVE' ? 'appreciation' : 'depreciation';
      const changeWord = `${priceReaction.percentagePriceChange}% price ${dirWord}`;

      if (overallConfirmation === 'CONFIRMED') {
        marketInterpretation = `Market action confirms the positive event thesis, with ${changeWord} supported by elevated participation and aligned open interest.`;
      } else if (overallConfirmation === 'CONTRADICTED') {
        const actDir = priceReaction.reactionDirection === 'POSITIVE' ? 'rising' : 'falling';
        marketInterpretation = `Market action is contradicting the positive fundamental thesis as the stock is ${actDir} on elevated volume.`;
      } else if (overallConfirmation === 'PARTIALLY_CONFIRMED') {
        marketInterpretation = `Market action shows partial confirmation of the thesis, with ${changeWord} but minor derivatives flow divergence.`;
      } else if (priceReaction.reactionDirection === 'NEUTRAL') {
        marketInterpretation = 'Market action is flat or range-bound with low volume participation, showing insufficient evidence to confirm the corporate catalyst.';
      } else {
        marketInterpretation = `Market price action reflects a localized ${priceReaction.reactionDirection.toLowerCase()} shock, awaiting strong volume backing.`;
      }
    }

    // 7. Compute evidence completeness
    let fieldsPopulated = 0;
    const totalFields = 6;
    if (priceReaction.eventTimePrice !== undefined) fieldsPopulated++;
    if (priceReaction.currentPrice !== undefined) fieldsPopulated++;
    if (volumeConfirmation.currentVolume !== undefined) fieldsPopulated++;
    if (fnoPositioning.PCR !== undefined) fieldsPopulated++;
    if (fnoPositioning.IV !== undefined) fieldsPopulated++;
    if (fundamentalDirection !== 'UNKNOWN') fieldsPopulated++;

    const evidenceCompleteness = Number(((fieldsPopulated / totalFields) * 100).toFixed(1));

    // 8. Compute confidence rating
    let confidence = 100;
    if (priceReaction.availability === 'NOT_AVAILABLE') confidence -= 50;
    if (priceReaction.dataFreshness === 'STALE') confidence -= 20;
    if (priceReaction.dataFreshness === 'EXPIRED') confidence -= 40;
    if (volumeConfirmation.volumeAvailability === 'NOT_AVAILABLE') confidence -= 15;
    if (fnoPositioning.availability === 'NOT_AVAILABLE') confidence -= 15;
    if (contradictionFlags.length > 0) confidence -= 10;

    confidence = Math.max(10, Math.min(100, confidence));

    return {
      symbol: cleanSymbol,
      fundamentalDirection,
      priceReaction,
      volumeConfirmation,
      fnoPositioning,
      overallConfirmation,
      contradictionFlags,
      evidenceCompleteness,
      confidence,
      marketInterpretation,
      timestamp: new Date().toISOString()
    };
  }
}
