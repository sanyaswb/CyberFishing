const UI_EXCEPTIONS = {
    tags: ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'A'],
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
        if (!isException) e.preventDefault();
    });
}

initEngineInterface();

class UIUtils {
    static makeSolid(element) {
        if (!element) return;

        const eventsToBlock = [
            'pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 
            'click', 'dblclick', 'touchstart', 'touchend', 'touchmove', 'wheel'
        ];

        eventsToBlock.forEach(evt => {
            // ВИПРАВЛЕННЯ: Використовуємо capture: false (Bubbling)
            // Це дозволяє дітям (+ / -) та власним обробникам перетягування спрацювати першими.
            element.addEventListener(evt, (e) => {
                e.stopPropagation(); 
                // Ми видалили stopImmediatePropagation, щоб не блокувати 
                // інші скрипти на цьому ж елементі.
            }, { capture: false }); 
        });

        element.addEventListener('contextmenu', e => e.preventDefault());
        element.style.touchAction = 'none';
        element.style.pointerEvents = 'all';
    }
}

class UIDraggableButton {
    #element;
    #onClickCallback;
    #config;
    #options;
    #holdTimer;
    #isDragging;
    #startX;
    #startY;
    #offsetX;
    #offsetY;
    #id; // Унікальний ідентифікатор для кешу

    constructor(element, onClickCallback, config, options = {}) {
        this.#element = element;
        this.#onClickCallback = onClickCallback;
        this.#config = config;
        this.#options = options; 
        
        // Визначаємо ID (пріоритет: options.id -> element.id -> дефолтна назва)
        this.#id = options.id || element.id || 'default_draggable';

        this.#holdTimer = null;
        this.#isDragging = false;
        
        UIUtils.makeSolid(this.#element);
        
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        
        this.#initEvents();
        this.#restorePosition(); // Відновлюємо позицію при створенні
    }

    // --- МАГІЯ КЕШУ ---
    #restorePosition() {
        if (typeof CacheManager === 'undefined') return;
        
        const savedPos = CacheManager.get(`drag_pos_${this.#id}`);
        if (savedPos) {
            this.#element.style.position = 'absolute';
            this.#element.style.margin = '0';
            this.#element.style.transition = 'none';
            
            // Якщо це старий кеш (де ми зберігали x та y), для сумісності
            if (savedPos.x !== undefined) {
                this.#element.style.left = savedPos.x;
                this.#element.style.top = savedPos.y;
                this.#element.style.right = 'auto';
                this.#element.style.bottom = 'auto';
            } else {
                // Новий розумний кеш з прив'язкою до країв
                this.#element.style.left = savedPos.left || 'auto';
                this.#element.style.right = savedPos.right || 'auto';
                this.#element.style.top = savedPos.top || 'auto';
                this.#element.style.bottom = savedPos.bottom || 'auto';
            }
        }
    }

    #savePosition() {
        if (typeof CacheManager === 'undefined') return;
        
        const rect = this.#element.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        // Рахуємо відстань до всіх чотирьох країв екрана
        const distLeft = rect.left;
        const distRight = winWidth - rect.right;
        const distTop = rect.top;
        const distBottom = winHeight - rect.bottom;

        const pos = {};

        // По горизонталі: прив'язуємо до того краю, який ближче
        if (distLeft <= distRight) {
            pos.left = `${Math.max(0, distLeft)}px`;
            pos.right = 'auto';
        } else {
            pos.right = `${Math.max(0, distRight)}px`;
            pos.left = 'auto';
        }

        // По вертикалі: прив'язуємо до верху або до низу
        if (distTop <= distBottom) {
            pos.top = `${Math.max(0, distTop)}px`;
            pos.bottom = 'auto';
        } else {
            pos.bottom = `${Math.max(0, distBottom)}px`;
            pos.top = 'auto';
        }

        // Застосовуємо ці "розумні" координати одразу до елемента
        this.#element.style.left = pos.left;
        this.#element.style.right = pos.right;
        this.#element.style.top = pos.top;
        this.#element.style.bottom = pos.bottom;

        // Зберігаємо в кеш
        CacheManager.set(`drag_pos_${this.#id}`, pos);
    }
    // -------------------

    #initEvents() {
        this.#element.addEventListener('pointerdown', this.onPointerDown);
        
        this.#element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    }

    onPointerDown(e) {
        e.stopPropagation();
        
        if (e.button !== 0 && e.pointerType === 'mouse') return;

        this.#element.setPointerCapture(e.pointerId);

        this.#isDragging = false;
        this.#startX = e.clientX;
        this.#startY = e.clientY;

        const rect = this.#element.getBoundingClientRect();
        this.#offsetX = (e.clientX - rect.left);
        this.#offsetY = (e.clientY - rect.top);

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
        if (!this.#options.noTransform) {
            this.#element.style.transform = 'scale(1.1)';
            this.#element.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
            this.#element.style.transition = 'none';
        }
        this.#element.style.position = 'absolute';
        this.#element.style.margin = '0';
        this.#element.style.right = 'auto';
        this.#element.style.bottom = 'auto';
        this.#updatePosition(this.#startX, this.#startY);
    }

    onPointerMove(e) {
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
        const rect = this.#element.getBoundingClientRect();
        x = Math.max(0, Math.min(x, window.innerWidth - rect.width));
        y = Math.max(0, Math.min(y, window.innerHeight - rect.height));
        this.#element.style.left = `${x}px`;
        this.#element.style.top = `${y}px`;
    }

    onPointerUp(e) {
        this.#element.releasePointerCapture(e.pointerId);
        this.#element.removeEventListener('pointermove', this.onPointerMove, { capture: true });
        this.#element.removeEventListener('pointerup', this.onPointerUp, { capture: true });
        this.#element.removeEventListener('pointercancel', this.onPointerUp, { capture: true });

        if (this.#holdTimer) {
            clearTimeout(this.#holdTimer);
            this.#holdTimer = null;
        }

        if (this.#isDragging) {
            this.#isDragging = false;
            if (!this.#options.noTransform) {
                this.#element.style.transform = '';
                this.#element.style.boxShadow = '';
                this.#element.style.transition = '';
            }
            // Зберігаємо позицію після того, як кинули кнопку
            this.#savePosition(); 
        } else {
            const dist = Math.hypot(e.clientX - this.#startX, e.clientY - this.#startY);
            if (dist < 10 && this.#onClickCallback) this.#onClickCallback(e);
        }
    }
}

class UIManager {
    #config;
    #fullscreenBtn;
    #netBtn;
    #isNetReady = false;
    onNetClick;
    #continueBtn;
    onContinueClick;
    
    constructor(config) {
        this.#config = config;
        this.#initFullscreenBtn();
        this.#initNetBtn();
        this.#initContinueBtn();
        
        new DevTools(this.#config); 
    }

    #initFullscreenBtn() {
        this.#fullscreenBtn = document.createElement('button');
        this.#fullscreenBtn.innerHTML = '⛶';
        
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
        }, this.#config, { id: 'btn_fullscreen' });

        document.addEventListener('fullscreenchange', () => {
            this.#fullscreenBtn.innerHTML = document.fullscreenElement ? '🗗' : '⛶';
        });

        document.body.appendChild(this.#fullscreenBtn);
    }

    #initNetBtn() {
        this.#netBtn = document.createElement('button');
        this.#netBtn.innerHTML = '🕸️';
        
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

        new UIDraggableButton(this.#netBtn, () => {
            if (this.#isNetReady && this.onNetClick) {
                this.onNetClick();
            }
        }, this.#config, { id: 'btn_net' });

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

    #initContinueBtn() {
        this.#continueBtn = document.createElement('button');
        this.#continueBtn.innerHTML = 'ПРОДОВЖИТИ';
        
        Object.assign(this.#continueBtn.style, {
            position: 'absolute',
            top: '80%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '15px 40px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            fontSize: '24px',
            zIndex: '9999',
            display: 'none',
            backgroundColor: 'rgba(0, 204, 255, 0.8)',
            color: '#fff',
            border: '2px solid #00ccff',
            cursor: 'pointer',
            boxShadow: '0 0 15px rgba(0, 204, 255, 0.4)',
            transition: 'all 0.2s ease'
        });

        this.#continueBtn.addEventListener('mouseenter', () => {
            this.#continueBtn.style.backgroundColor = 'rgba(0, 204, 255, 1)';
            this.#continueBtn.style.transform = 'translate(-50%, -50%) scale(1.05)';
        });

        this.#continueBtn.addEventListener('mouseleave', () => {
            this.#continueBtn.style.backgroundColor = 'rgba(0, 204, 255, 0.8)';
            this.#continueBtn.style.transform = 'translate(-50%, -50%) scale(1)';
        });

        UIUtils.makeSolid(this.#continueBtn);

        this.#continueBtn.addEventListener('click', () => {
            if (this.onContinueClick) this.onContinueClick();
        });

        document.body.appendChild(this.#continueBtn);
    }

    updateContinueButtonState(isVisible) {
        if (!this.#continueBtn) return;
        this.#continueBtn.style.display = isVisible ? 'block' : 'none';
    }
}

class DepthSelectorUI {
    constructor() {
        this.container = document.createElement('div');
        this.container.innerHTML = `
            <style>
                #ds-container {
                    position: fixed; top: 0; right: 0; width: 140px; height: 100%;
                    display: none; justify-content: center; align-items: center; padding-right: 5%;
                    font-family: sans-serif; pointer-events: none; z-index: 9999;
                }
                #ds-wrapper {
                    display: flex; align-items: center; gap: 15px; height: 50vh; position: relative;
                    pointer-events: none;
                }
                #ds-input-container {
                    position: absolute; left: -90px;
                }
                #ds-input {
                    background: #73c2fb; color: #000; font-size: 18px; font-weight: bold;
                    border: 2px solid #000; border-radius: 4px; padding: 4px;
                    width: 60px; text-align: center; outline: none;
                    pointer-events: auto;
                }
                #ds-input::after {
                    content: ''; position: absolute; right: -12px; top: 50%; transform: translateY(-50%);
                    width: 12px; height: 2px; background: #fff;
                }
                #ds-slider-container {
                    height: 100%; display: flex; align-items: center;
                }
                #ds-slider {
                    writing-mode: vertical-lr; width: 8px; height: 100%; margin: 0; cursor: pointer;
                    background: linear-gradient(to bottom, #002233, #73c2fb); border-radius: 4px; outline: none;
                    pointer-events: auto;
                }
                #ds-labels {
                    display: flex; flex-direction: column; justify-content: space-between;
                    height: 100%; color: #fff; font-size: 14px; font-weight: bold; margin-left: 5px;
                }
            </style>
            <div id="ds-container">
                <div id="ds-wrapper">
                    <div id="ds-input-container">
                        <input type="text" id="ds-input" value="1.5">
                    </div>
                    <div id="ds-slider-container">
                        <input type="range" id="ds-slider" min="0.1" step="0.1">
                    </div>
                    <div id="ds-labels">
                        <span id="ds-min">0.1</span>
                        <span></span>
                        <span id="ds-max">8.0</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.container);

        this.mainContainer = document.getElementById('ds-container');
        this.slider = document.getElementById('ds-slider');
        this.input = document.getElementById('ds-input');
        this.maxLabel = document.getElementById('ds-max');
        this.inputContainer = document.getElementById('ds-input-container');

        this.onChange = null;
        this.isActive = false;

        this.#bindEvents();
    }

    #bindEvents() {
        this.slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.input.value = val.toFixed(2);
            this.#updateInputPosition();
            if (this.onChange) this.onChange(val);
        });

        this.input.addEventListener('input', (e) => {
            let val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
            if ((val.match(/\./g) || []).length > 1) {
                val = val.substring(0, val.lastIndexOf('.'));
            }
            e.target.value = val;
        });

        this.input.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) val = 0.1;
            val = Math.max(0.1, Math.min(parseFloat(this.slider.max), val));
            this.input.value = val.toFixed(2);
            this.slider.value = val;
            this.#updateInputPosition();
            if (this.onChange) this.onChange(val);
        });
    }

    #updateInputPosition() {
        const min = parseFloat(this.slider.min);
        const max = parseFloat(this.slider.max);
        const val = parseFloat(this.slider.value);
        
        const percent = (val - min) / (max - min); 
        const sliderHeight = this.slider.clientHeight;
        const offset = percent * sliderHeight;
        
        this.inputContainer.style.top = `calc(${offset}px - 18px)`;
    }

    show(maxDepth, currentDepth, changeCallback) {
        this.isActive = true;
        this.onChange = changeCallback;

        this.slider.max = maxDepth;
        this.maxLabel.innerText = maxDepth.toFixed(1);

        this.slider.value = currentDepth;
        this.input.value = currentDepth.toFixed(2);

        this.mainContainer.style.display = 'flex';
        
        requestAnimationFrame(() => this.#updateInputPosition());
    }

    updateMax(maxDepth) {
        if (!this.isActive || parseFloat(this.slider.max) === maxDepth) return;
        
        this.slider.max = maxDepth;
        this.maxLabel.innerText = maxDepth.toFixed(1);
        
        // Якщо поточна глибина стала більшою за новий ліміт - обрізаємо її
        let val = parseFloat(this.input.value);
        if (val > maxDepth) {
            val = maxDepth;
            this.input.value = val.toFixed(2);
            this.slider.value = val;
            if (this.onChange) this.onChange(val);
        }
        
        requestAnimationFrame(() => this.#updateInputPosition());
    }

    hide() {
        this.isActive = false;
        this.mainContainer.style.display = 'none';
    }
}

class TimeDisplayUI {
    constructor() {
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed;
            top: 15px;
            left: 15px;
            background: rgba(11, 21, 32, 0.85);
            border: 2px solid #4a5b6c;
            border-radius: 8px;
            padding: 6px 16px;
            color: #fff;
            font-family: monospace;
            font-size: 20px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 9998;
            pointer-events: none;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        `;
        
        this.emojiSpan = document.createElement('span');
        this.timeSpan = document.createElement('span');
        this.timeSpan.style.color = '#00ccff';

        this.container.appendChild(this.emojiSpan);
        this.container.appendChild(this.timeSpan);
        document.body.appendChild(this.container);
    }

    update(gameTimeHours) {
        const h = Math.floor(gameTimeHours);
        const m = Math.floor((gameTimeHours % 1) * 60);
        const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

        let emoji = '☀️';
        if (gameTimeHours >= 21 || gameTimeHours < 5) {
            emoji = '🌙'; 
        } else if (gameTimeHours >= 5 && gameTimeHours < 8) {
            emoji = '🌅'; 
        } else if (gameTimeHours >= 18 && gameTimeHours < 21) {
            emoji = '🌇'; 
        }

        if (this.timeSpan.innerText !== timeStr) {
            this.timeSpan.innerText = timeStr;
            this.emojiSpan.innerText = emoji;
        }
    }
}

class ChumUI {
    constructor(onClickCallback) {
        this.button = document.createElement('button');
        this.button.innerText = 'Прикормка';
        
        this.currentState = 'idle';

        Object.assign(this.button.style, {
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: '#ffaa00',
            color: '#1a1a1a',
            border: '2px solid #ffcc00',
            borderRadius: '8px',
            cursor: 'pointer',
            zIndex: '100',
            boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
            transition: 'all 0.2s ease',
            touchAction: 'none'
        });

        if (typeof UIUtils !== 'undefined') {
            UIUtils.makeSolid(this.button);
        }

        this.button.addEventListener('click', (e) => {
            if (this.currentState === 'disabled' || this.currentState === 'empty' || this.currentState === 'moving') {
                return;
            }
            
            if (onClickCallback) onClickCallback(e);
        });

        document.body.appendChild(this.button);
    }

    setState(state) {
        if (this.currentState === state) return;
        this.currentState = state;

        switch(state) {
            case 'disabled':
                this.button.innerText = 'Прикормка';
                this.button.style.backgroundColor = '#555555';
                this.button.style.borderColor = '#444444';
                this.button.style.color = '#aaaaaa';
                this.button.style.opacity = '0.6';
                this.button.style.cursor = 'not-allowed';
                this.button.style.pointerEvents = 'auto';
                break;
                
            case 'empty':
                this.button.innerText = 'Розряджено';
                this.button.style.backgroundColor = '#2c3e50';
                this.button.style.borderColor = '#34495e';
                this.button.style.color = '#95a5a6';
                this.button.style.opacity = '0.9';
                this.button.style.cursor = 'not-allowed';
                this.button.style.pointerEvents = 'auto';
                break;
                
            case 'aiming':
                this.button.innerText = 'Відмінити ціль';
                this.button.style.backgroundColor = '#ff4444';
                this.button.style.borderColor = '#ff8888';
                this.button.style.color = '#fff';
                this.button.style.opacity = '1';
                this.button.style.cursor = 'pointer';
                this.button.style.pointerEvents = 'auto';
                break;
                
            case 'moving':
                this.button.innerText = 'Пливе...';
                this.button.style.backgroundColor = '#6c7a89';
                this.button.style.borderColor = '#8a9bac';
                this.button.style.color = '#fff';
                this.button.style.opacity = '0.7';
                this.button.style.cursor = 'wait';
                this.button.style.pointerEvents = 'auto';
                break;
                
            case 'ready':
                this.button.innerText = 'Активувати';
                this.button.style.backgroundColor = '#00ff80';
                this.button.style.borderColor = '#55ffaa';
                this.button.style.color = '#000';
                this.button.style.opacity = '1';
                this.button.style.cursor = 'pointer';
                this.button.style.pointerEvents = 'auto';
                break;
                
            case 'idle':
            default:
                this.button.innerText = 'Прикормка';
                this.button.style.backgroundColor = '#ffaa00';
                this.button.style.borderColor = '#ffcc00';
                this.button.style.color = '#000';
                this.button.style.opacity = '1';
                this.button.style.cursor = 'pointer';
                this.button.style.pointerEvents = 'auto';
                break;
        }
    }
}