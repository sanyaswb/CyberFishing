import { promises as fs } from 'fs';
import path from 'path';

export class EventService {
    #filePath;
    #maxEntries;

    constructor(maxEntries = 50) {
        this.#filePath = path.resolve('logs', 'events.json');
        this.#maxEntries = maxEntries;
        this.#init();
    }

    async #init() {
        try {
            await fs.access(this.#filePath);
        } catch {
            await fs.mkdir(path.dirname(this.#filePath), { recursive: true });
            await fs.writeFile(this.#filePath, JSON.stringify([]));
        }
    }

    async save(eventData) {
        try {
            const data = await fs.readFile(this.#filePath, 'utf-8');
            let events = JSON.parse(data);
            
            events.push(eventData);
            
            if (events.length > this.#maxEntries) {
                events = events.slice(-this.#maxEntries);
            }
            
            await fs.writeFile(this.#filePath, JSON.stringify(events, null, 2));
            return { success: true };
        } catch (error) {
            throw error;
        }
    }
}