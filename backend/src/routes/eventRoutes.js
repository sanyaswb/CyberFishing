import { Router } from 'express';
import { EventController } from '../controllers/eventController.js';

export class EventRoutes {
    #router;
    #eventController;

    constructor() {
        this.#router = Router();
        this.#eventController = new EventController();
        this.#initializeRoutes();
    }

    #initializeRoutes() {
        this.#router.post('/', this.#eventController.createEvent);
    }

    getRouter() {
        return this.#router;
    }
}