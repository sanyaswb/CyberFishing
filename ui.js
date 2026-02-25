const UI_EXCEPTIONS = {
    tags: ['INPUT', 'TEXTAREA'],
    classes: [],
    ids: []
};

function initEngineInterface() {
    const style = document.createElement('style');
    style.innerHTML = `
        * {
            -webkit-tap-highlight-color: transparent !important;
            -webkit-touch-callout: none !important;
        }

        body {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            touch-action: none;
            overflow: hidden;
        }

        *:focus {
            outline: none !important;
        }

        button, a {
            transition: transform 0.12s ease-out;
            -webkit-user-select: none;
            user-select: none;
        }

        button:active, a:active {
            transform: scale(0.96);
        }
    `;
    document.head.appendChild(style);

    document.addEventListener('touchstart', () => {}, { passive: true });

    document.addEventListener('contextmenu', (e) => {
        const t = e.target;
        
        const isException = 
            UI_EXCEPTIONS.tags.includes(t.tagName) ||
            UI_EXCEPTIONS.classes.some(c => t.classList.contains(c)) ||
            UI_EXCEPTIONS.ids.includes(t.id);

        if (!isException) {
            e.preventDefault();
        }
    });
}

initEngineInterface();

class UIDraggableButton {
    #element;
    #onClickCallback;
    #config;
    #holdTimer;
    #isDragging;
    #startX;
    #startY;
    #offsetX;
    #offsetY;

    constructor(element, onClickCallback, config) {
        this.#element = element;
        this.#onClickCallback = onClickCallback;
        this.#config = config;

        this.#holdTimer = null;
        this.#isDragging = false;
        
        this.#element.style.touchAction = 'none';
        
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        
        this.#initEvents();
    }

    #initEvents() {
        this.#element.addEventListener('pointerdown', this.onPointerDown);
        
        this.#element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        this.#element.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
        this.#element.addEventListener('touchend', (e) => e.stopPropagation(), { passive: false });
        this.#element.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: false });
        this.#element.addEventListener('mousedown', (e) => e.stopPropagation());
        this.#element.addEventListener('mouseup', (e) => e.stopPropagation());
    }

    onPointerDown(e) {
        e.stopPropagation();
        if (e.button !== 0 && e.pointerType === 'mouse') return;

        this.#element.setPointerCapture(e.pointerId);

        this.#isDragging = false;
        this.#startX = e.clientX;
        this.#startY = e.clientY;

        const rect = this.#element.getBoundingClientRect();
        this.#offsetX = e.clientX - rect.left;
        this.#offsetY = e.clientY - rect.top;

        if (this.#config.ui?.draggableButtons) {
            this.#holdTimer = setTimeout(() => {
                this.#startDrag();
            }, this.#config.ui?.dragHoldTimeMs || 1500);
        }

        this.#element.addEventListener('pointermove', this.onPointerMove);
        this.#element.addEventListener('pointerup', this.onPointerUp);
        this.#element.addEventListener('pointercancel', this.onPointerUp);
    }

    #startDrag() {
        this.#isDragging = true;
        this.#element.style.transform = 'scale(1.1)';
        this.#element.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
        this.#element.style.transition = 'none';
        
        this.#element.style.position = 'absolute';
        this.#element.style.margin = '0';
        this.#element.style.right = 'auto';
        this.#element.style.bottom = 'auto';
        
        this.#updatePosition(this.#startX, this.#startY);
    }

    onPointerMove(e) {
        e.stopPropagation();
        
        if (!this.#isDragging) {
            const dist = Math.hypot(e.clientX - this.#startX, e.clientY - this.#startY);
            if (dist > 10 && this.#holdTimer) {
                clearTimeout(this.#holdTimer);
                this.#holdTimer = null;
            }
            return;
        }

        this.#updatePosition(e.clientX, e.clientY);
    }

    #updatePosition(clientX, clientY) {
        let x = clientX - this.#offsetX;
        let y = clientY - this.#offsetY;

        x = Math.max(0, Math.min(x, window.innerWidth - this.#element.offsetWidth));
        y = Math.max(0, Math.min(y, window.innerHeight - this.#element.offsetHeight));

        this.#element.style.left = `${x}px`;
        this.#element.style.top = `${y}px`;
    }

    onPointerUp(e) {
        e.stopPropagation();
        this.#element.releasePointerCapture(e.pointerId);
        
        this.#element.removeEventListener('pointermove', this.onPointerMove);
        this.#element.removeEventListener('pointerup', this.onPointerUp);
        this.#element.removeEventListener('pointercancel', this.onPointerUp);

        if (this.#holdTimer) {
            clearTimeout(this.#holdTimer);
            this.#holdTimer = null;
        }

        if (this.#isDragging) {
            this.#isDragging = false;
            this.#element.style.transform = '';
            this.#element.style.boxShadow = '';
            this.#element.style.transition = '';
        } else {
            const dist = Math.hypot(e.clientX - this.#startX, e.clientY - this.#startY);
            if (dist < 10 && this.#onClickCallback) {
                this.#onClickCallback(e);
            }
        }
    }
}

class UIManager {
    #config;
    #fullscreenBtn;
    #netBtn;
    #isNetReady = false;
    onNetClick;

    constructor(config) {
        this.#config = config;
        this.#initFullscreenBtn();
        this.#initNetBtn();
    }

    #initFullscreenBtn() {
        this.#fullscreenBtn = document.createElement('button');
        this.#fullscreenBtn.innerHTML = '⛶ FULLSCREEN';
        
        Object.assign(this.#fullscreenBtn.style, {
            position: 'absolute',
            top: '15px',
            right: '15px',
            padding: '8px 16px',
            backgroundColor: 'rgba(15, 23, 30, 0.8)',
            color: '#00ff80',
            border: '1px solid #00ff80',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: '9999',
            transition: 'all 0.2s ease',
            touchAction: 'none'
        });

        this.#fullscreenBtn.addEventListener('mouseenter', () => {
            this.#fullscreenBtn.style.backgroundColor = 'rgba(0, 255, 128, 0.2)';
        });
        
        this.#fullscreenBtn.addEventListener('mouseleave', () => {
            this.#fullscreenBtn.style.backgroundColor = 'rgba(15, 23, 30, 0.8)';
        });

        new UIDraggableButton(this.#fullscreenBtn, () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.warn(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        }, this.#config);

        document.addEventListener('fullscreenchange', () => {
            this.#fullscreenBtn.innerHTML = document.fullscreenElement ? '🗗 EXIT FULLSCREEN' : '⛶ FULLSCREEN';
        });

        document.body.appendChild(this.#fullscreenBtn);
    }

    #initNetBtn() {
        this.#netBtn = document.createElement('button');
        this.#netBtn.innerHTML = '🕸️ NET';
        
        Object.assign(this.#netBtn.style, {
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            padding: '15px 30px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            fontSize: '18px',
            zIndex: '9999',
            display: 'none',
            touchAction: 'none',
            transition: 'all 0.2s ease',
            color: '#fff',
            borderWidth: '2px',
            borderStyle: 'solid'
        });

        // Кнопку можна перетягувати ЗАВЖДИ. А от клік пройде, тільки якщо вона готова.
        new UIDraggableButton(this.#netBtn, () => {
            if (this.#isNetReady && this.onNetClick) {
                this.onNetClick();
            }
        }, this.#config);

        document.body.appendChild(this.#netBtn);
    }

    updateNetButtonState(config, isReady) {
        if (!this.#netBtn) return;
        
        this.#isNetReady = isReady;

        if (!config.net || !config.net.active) {
            this.#netBtn.style.display = 'none';
            return;
        }

        const isAppearing = this.#netBtn.style.display === 'none' || this.#netBtn.style.display === '';
        
        this.#netBtn.style.display = 'flex';
        this.#netBtn.style.justifyContent = 'center';
        this.#netBtn.style.alignItems = 'center';

        if (isAppearing) {
            this.#netBtn.style.transform = 'scale(0)';
            setTimeout(() => {
                this.#netBtn.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.2s, box-shadow 0.2s';
                this.#netBtn.style.transform = 'scale(1)';
            }, 10);
        }
        
        if (isReady) {
            this.#netBtn.style.backgroundColor = 'rgba(0, 255, 128, 0.7)';
            this.#netBtn.style.borderColor = '#00ff80';
            this.#netBtn.style.cursor = 'pointer';
            this.#netBtn.style.boxShadow = '0 0 15px rgba(0, 255, 128, 0.5)';
        } else {
            this.#netBtn.style.backgroundColor = 'rgba(128, 128, 128, 0.3)';
            this.#netBtn.style.borderColor = '#aaa';
            this.#netBtn.style.cursor = 'not-allowed';
            this.#netBtn.style.boxShadow = 'none';
        }
    }
}