import { EventService } from '../services/eventService.js';

export class EventController {
    #eventService;

    constructor() {
        this.#eventService = new EventService();
        this.createEvent = this.createEvent.bind(this);
    }

    async createEvent(req, res) {
        try {
            const eventData = req.body;
            if (!eventData || Object.keys(eventData).length === 0) {
                return res.status(400).json({ error: 'Bad Request' });
            }
            
            await this.#eventService.save(eventData);
            res.status(201).json({ message: 'Created' });
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}