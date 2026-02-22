import express from 'express';
import cors from 'cors';
import { EventRoutes } from './src/routes/eventRoutes.js';

class Server {
    #app;
    #port;
    #eventRoutes;

    constructor(port) {
        this.#port = port;
        this.#app = express();
        this.#eventRoutes = new EventRoutes();
        
        this.#initializeMiddlewares();
        this.#initializeRoutes();
    }

    #initializeMiddlewares() {
        this.#app.use(cors());
        this.#app.use(express.json());
    }

    #initializeRoutes() {
        this.#app.get('/api/health', (req, res) => {
            res.status(200).json({ 
                status: 'online', 
                timestamp: new Date().toISOString() 
            });
        });

        this.#app.use('/api/events', this.#eventRoutes.getRouter());
    }

    start() {
        this.#app.listen(this.#port, () => {
            console.log(`Server is running on http://localhost:${this.#port}`);
        });
    }
}

const server = new Server(3000);
server.start();