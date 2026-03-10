class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    multiplyScalar(s) {
        this.x *= s;
        this.y *= s;
        return this;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    normalize() {
        const length = Math.hypot(this.x, this.y);
        if (length > 0) {
            this.x /= length;
            this.y /= length;
        }
        return this;
    }

    length() {
        return Math.hypot(this.x, this.y);
    }
}

class InputManager {
    #canvas;
    #isPulling;
    #pullDirection;
    #isDragging;
    #isPointerDown;
    #startX;
    #startY;
    #lastPointerX;
    #panDeltaX;
    #clickPos;
    #config;
    #keys = {};
    #isDoubleClick = false;
    #longPressPos = null;
    #lastClickTime = 0;
    #longPressTimeout = null;

    constructor(canvas, config) {
        this.#canvas = canvas;
        this.#config = config;
        this.#isPulling = false;
        this.#pullDirection = new Vector2(0, 1);
        this.#isDragging = false;
        this.#isPointerDown = false;
        this.#startX = 0;
        this.#startY = 0;
        this.#lastPointerX = 0;
        this.#panDeltaX = 0;
        this.#clickPos = null;

        this.#bindEvents();
    }

    #bindEvents() {
        this.#canvas.addEventListener('pointerdown', (e) => {
            this.#isPointerDown = true;
            this.#isPulling = true;
            
            this.#isDragging = false;
            this.#startX = e.clientX;
            this.#startY = e.clientY;
            this.#lastPointerX = e.clientX;
            this.#updateDirection(e);

            if (this.#longPressTimeout) clearTimeout(this.#longPressTimeout);
            this.#longPressTimeout = setTimeout(() => {
                if (!this.#isDragging) {
                    this.#longPressPos = { x: e.clientX, y: e.clientY };
                }
            }, 500);
        });

        this.#canvas.addEventListener('pointermove', (e) => {
            if (!this.#isPointerDown) return;

            const dist = Math.hypot(e.clientX - this.#startX, e.clientY - this.#startY);
            if (dist > 5) {
                this.#isDragging = true;
                if (this.#longPressTimeout) clearTimeout(this.#longPressTimeout);
            }

            if (this.#isDragging) {
                this.#panDeltaX = this.#lastPointerX - e.clientX;
                this.#lastPointerX = e.clientX;
            }
            
            this.#updateDirection(e);
        });

        const resetInput = (e) => {
            if (this.#longPressTimeout) clearTimeout(this.#longPressTimeout);

            const isPointerEvent = e && (e.type === 'pointerup' || e.type === 'touchend' || e.type === 'pointercancel');
            
            if (isPointerEvent) {
                if (!this.#isDragging && this.#isPointerDown) {
                    const now = Date.now();
                    if (now - this.#lastClickTime < 300) {
                        this.#isDoubleClick = true;
                    } else {
                        const clientX = e.clientX || (e.changedTouches && e.changedTouches[0]?.clientX);
                        const clientY = e.clientY || (e.changedTouches && e.changedTouches[0]?.clientY);
                        this.#clickPos = { x: clientX, y: clientY };
                    }
                    this.#lastClickTime = now;
                }
                this.#isPointerDown = false;
            }
            
            this.#isPulling = this.#keys['Space'] === true || this.#isPointerDown === true;
            
            if (!this.#isPulling) {
                this.#pullDirection = new Vector2(0, 1);
            }
            this.#isDragging = false;
        };

        window.addEventListener('pointerup', resetInput, { capture: true });
        window.addEventListener('pointercancel', resetInput, { capture: true });
        window.addEventListener('touchend', resetInput, { capture: true });
        
        window.addEventListener('blur', () => {
            this.#keys = {};
            this.#isPointerDown = false;
            resetInput();
        });

        window.addEventListener('keydown', (e) => {
            this.#keys[e.code] = true;
            if (e.code === 'Space') {
                this.#isPulling = true;
                e.preventDefault(); 
            }
        });

        window.addEventListener('keyup', (e) => {
            this.#keys[e.code] = false;
            if (e.code === 'Space') {
                this.#isPulling = this.#isPointerDown;
                if (!this.#isPulling) {
                    this.#pullDirection = new Vector2(0, 1);
                }
            }
        });

        this.#canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    #updateDirection(e) {
        let keyX = 0;
        if (this.#keys['KeyA'] || this.#keys['ArrowLeft']) keyX = -1;
        if (this.#keys['KeyD'] || this.#keys['ArrowRight']) keyX = 1;

        if (keyX !== 0) {
            this.#pullDirection = new Vector2(keyX, 1).normalize();
        } else if (e && e.clientX !== undefined) {
            const rect = this.#canvas.getBoundingClientRect();
            let anchorX = rect.width / 2;
            if (this.#config.ui?.rod?.x && this.#config.ui.rod.x !== 'center') anchorX = Number(this.#config.ui.rod.x);
            
            const dx = e.clientX - rect.left - anchorX;
            const dy = rect.height / 2; 
            
            const length = Math.hypot(dx, dy);
            if (length > 0) this.#pullDirection = new Vector2(dx / length, dy / length);
        }
    }

    getState() {
        if (this.#keys['KeyA'] || this.#keys['KeyD'] || this.#keys['ArrowLeft'] || this.#keys['ArrowRight']) {
            this.#updateDirection();
        }

        const state = {
            isPulling: this.#isPulling,
            pullDirection: this.#pullDirection,
            panDeltaX: this.#panDeltaX,
            clickPos: this.#clickPos,
            isDoubleClick: this.#isDoubleClick,
            longPressPos: this.#longPressPos
        };
        
        this.#panDeltaX = 0;
        this.#clickPos = null; 
        this.#isDoubleClick = false;
        this.#longPressPos = null;

        return state;
    }
}

class EventLogger {
    static async logBreakEvent(reason, tensionMeter) {
        if (typeof CONFIG === 'undefined' || !CONFIG.logs?.events) {
            return;
        }

        const data = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now(),
            timestamp: new Date().toISOString(),
            event: reason === 'rod' ? 'ROD_BROKEN' : reason === 'hook' ? 'FISH_ESCAPED' : 'LINE_BROKEN',
            location: 'Lake Whisper (Mock)',
            fish: 'Pike (Mock)',
            gameplayStats: {
                fishState: window.DEBUG_LIVE_FISH_STATE || 'unknown',
                fishCurrentBasePower: window.DEBUG_LIVE_FISH_POWER || 0,
                fishPullMultiplier: window.DEBUG_LIVE_FISH_PULL_MULT || 0,
                breakTimerProgressPercent: +(tensionMeter.getLineBreakProgress() * 100).toFixed(1)
            }
        };

        if (CONFIG.logs.endpoint) {
            try {
                const response = await fetch(CONFIG.logs.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    console.log(`[EventLogger] Event ${data.event} successfully sent to backend.`);
                }
            } catch (error) {
                console.error('[EventLogger] Failed to send event to backend.', error);
            }
        }
    }
}

class CacheManager {
    static PREFIX = 'fishing_game_';

    static set(key, value) {
        try {
            localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
        } catch (e) {
            console.warn('[CacheManager] Помилка збереження в кеш. Можливо, перевищено ліміт 5MB:', e);
        }
    }

    static get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.PREFIX + key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.warn('[CacheManager] Помилка читання з кешу:', e);
            return defaultValue;
        }
    }

    static remove(key) {
        localStorage.removeItem(this.PREFIX + key);
    }

    static clearAll() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        console.log('[CacheManager] Весь кеш гри очищено.');
    }

    static printStorageUsage() {
        let totalBytes = 0;

        // Рахуємо всі ключі та їх значення в localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            
            // Кожен символ в JS займає 2 байти
            totalBytes += (key.length + value.length) * 2;
        }

        const kb = (totalBytes / 1024).toFixed(2);
        const mb = (totalBytes / (1024 * 1024)).toFixed(3);
        const limitMb = 5.0; // Стандартний ліміт браузерів
        const percentage = ((totalBytes / (limitMb * 1024 * 1024)) * 100).toFixed(2);

        let color = '#00ff80'; // Зелений (все добре)
        if (percentage > 70) color = '#ffaa00'; // Жовтий (увага)
        if (percentage > 90) color = '#ff4444'; // Червоний (критично)

        console.log(`%c💾 [CacheManager] Використано: ${kb} KB (${mb} MB) з ~${limitMb} MB | Заповнено на ${percentage}%`, `color: ${color}; font-weight: bold; font-family: monospace;`);
    }
}