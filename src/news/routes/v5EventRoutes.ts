/**
 * ATHENA NEWS ENGINE — STAGE 8.4 EVENT API ROUTES
 * REST endpoints for event-centric live intelligence orchestration.
 */

import { Router, Request, Response } from 'express';
import { EventCentricOrchestrator } from '../intelligence/EventCentricOrchestrator';

const router = Router();
const orchestrator = EventCentricOrchestrator.getInstance();

/**
 * GET /api/v5/news/events
 * Query live market events with optional filters (category, symbol, status, limit).
 */
router.get('/events', (req: Request, res: Response) => {
  try {
    const { category, symbol, status, limit } = req.query;
    let events = orchestrator.getAllEvents();

    if (category) {
      const cat = String(category).toLowerCase();
      events = events.filter(e => (e.category || '').toLowerCase() === cat);
    }

    if (symbol) {
      const sym = String(symbol).toUpperCase();
      events = events.filter(e => e.symbol.toUpperCase() === sym || e.primaryEntity.toUpperCase() === sym);
    }

    if (status) {
      events = events.filter(e => e.eventStatus === status);
    }

    const maxLimit = limit ? parseInt(String(limit), 10) : 50;
    if (!isNaN(maxLimit) && maxLimit > 0) {
      events = events.slice(0, maxLimit);
    }

    res.json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/v5/news/events/:eventId
 * Get full details of a specific event.
 */
router.get('/events/:eventId', (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const event = orchestrator.getEventById(eventId);

    if (!event) {
      return res.status(404).json({ success: false, error: `Event with ID ${eventId} not found` });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/v5/news/events/:eventId/sources
 * Get all primary and supporting source references for an event.
 */
router.get('/events/:eventId/sources', (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const event = orchestrator.getEventById(eventId);

    if (!event) {
      return res.status(404).json({ success: false, error: `Event with ID ${eventId} not found` });
    }

    res.json({
      success: true,
      eventId: event.eventId,
      sourceCount: event.sourceCount,
      primarySource: event.primarySource,
      supportingSources: event.supportingSources
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/v5/news/events/:eventId/history
 * Get update timeline, state transitions, and numerical conflict history for an event.
 */
router.get('/events/:eventId/history', (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const event = orchestrator.getEventById(eventId);

    if (!event) {
      return res.status(404).json({ success: false, error: `Event with ID ${eventId} not found` });
    }

    res.json({
      success: true,
      eventId: event.eventId,
      eventStatus: event.eventStatus,
      escalationLevel: event.escalationLevel,
      conflictStatus: event.conflictStatus,
      conflictingReports: event.conflictingReports || [],
      history: event.history || []
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

export default router;
