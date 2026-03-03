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

    constructor(element, onClickCallback, config, options = {}) {
        this.#element = element;
        this.#onClickCallback = onClickCallback;
        this.#config = config;
        this.#options = options; 

        this.#holdTimer = null;
        this.#isDragging = false;
        
        // Спочатку робимо солідним (буде зупиняти спливання)
        UIUtils.makeSolid(this.#element);
        
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        
        this.#initEvents();
    }

    #initEvents() {
        // ВИПРАВЛЕННЯ: Використовуємо стандартну фазу для перетягування
        this.#element.addEventListener('pointerdown', this.onPointerDown);
        
        this.#element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    }

    onPointerDown(e) {
        // Дозволяємо перетягування, але не даємо події піти до гри
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

        // Слухачі руху додаємо на вікно або елемент для надійності
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
    #settingsUI;

    constructor(config) {
        this.#config = config;
        this.#initFullscreenBtn();
        this.#initNetBtn();
        this.#initContinueBtn();
        this.#settingsUI = new SettingsUI(config);
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

// БЛОК ІНТЕРФЕЙСУ ВИБОРУ ГЛИБИНИ
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

// БЛОК ІНТЕРФЕЙСУ ІГРОВОГО ЧАСУ
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

// БЛОК ІНТЕРФЕЙСУ НАЛАШТУВАНЬ (ДЕБАГ)
class SettingsUI {
    #config;
    #btn;
    #modal;
    #content;
    #isOpen = false;
    
    // Поля, які ми не хочемо виводити в меню налаштувань (шляхи, складні масиви)
    #excludeKeys = ['id', 'name', 'bgUrls', 'depthUrl', 'endpoint', 'backgroundColor', 'fishes', 'colorGradient', 'statuses', 'chances', 'zones', 'timePhases'];

    constructor(config) {
        this.#config = config;
        this.#initStyles();
        this.#initBtn();
        this.#initModal();
    }

    #initStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            .settings-modal {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.7); display: none; justify-content: center; align-items: center;
                z-index: 10000; font-family: monospace; color: #fff;
            }
            .settings-content {
                background: #111a22; border: 2px solid #00ccff; border-radius: 8px;
                width: 90%; max-width: 600px; max-height: 85vh; display: flex; flex-direction: column;
                box-shadow: 0 0 20px rgba(0, 204, 255, 0.3);
            }
            .settings-header {
                padding: 15px; border-bottom: 1px solid #00ccff; display: flex; justify-content: space-between;
                align-items: center; background: #0b1520; border-radius: 8px 8px 0 0;
            }
            .settings-header h2 { margin: 0; font-size: 20px; color: #00ff80; }
            .settings-close {
                background: none; border: none; color: #ff4444; font-size: 24px; cursor: pointer; font-weight: bold;
            }
            .settings-body {
                padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
            }
            .settings-body::-webkit-scrollbar { width: 8px; }
            .settings-body::-webkit-scrollbar-track { background: #0b1520; }
            .settings-body::-webkit-scrollbar-thumb { background: #00ccff; border-radius: 4px; }
            
            .settings-section { margin-top: 10px; border-left: 2px solid #00ccff; padding-left: 10px; }
            .settings-section-title { font-size: 16px; color: #00ccff; margin-bottom: 10px; text-transform: uppercase; }
            
            .settings-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 4px 0; border-bottom: 1px dashed #2a3b4c; }
            .settings-label { font-size: 14px; color: #ccc; }
            
            .settings-input-num {
                background: #0b1520; border: 1px solid #4a5b6c; color: #fff; padding: 4px 8px;
                border-radius: 4px; width: 80px; text-align: right; font-family: monospace;
            }
            .settings-input-text {
                background: #0b1520; border: 1px solid #4a5b6c; color: #fff; padding: 4px 8px;
                border-radius: 4px; width: 120px; text-align: right; font-family: monospace;
            }
            
            /* Світчер для boolean */
            .switch { position: relative; display: inline-block; width: 40px; height: 20px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #4a5b6c; transition: .2s; border-radius: 20px; }
            .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; }
            input:checked + .slider { background-color: #00ff80; }
            input:checked + .slider:before { transform: translateX(20px); }
        `;
        document.head.appendChild(style);
    }

    #initBtn() {
        this.#btn = document.createElement('button');
        this.#btn.innerHTML = '⚙️';
        
        Object.assign(this.#btn.style, {
            position: 'absolute', 
            top: '15px', 
            left: '160px', 
            fontSize: '32px', // Зробили трохи більшою, бо немає рамки
            background: 'transparent', // Прозорий фон
            border: 'none', // Без обводки
            padding: '0',
            cursor: 'pointer', 
            zIndex: '9998',
            filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.8))', // Тінь, щоб не губилася на складному фоні
            transition: 'transform 0.1s ease'
        });

        UIUtils.makeSolid(this.#btn);
        
        // Робимо кнопку перетягуваною, клік відкриває меню
        new UIDraggableButton(this.#btn, () => this.toggle(), this.#config, { noTransform: true });
        document.body.appendChild(this.#btn);
    }

    #initModal() {
        this.#modal = document.createElement('div');
        this.#modal.className = 'settings-modal';
        
        this.#modal.innerHTML = `
            <div class="settings-content">
                <div class="settings-header">
                    <h2>⚙️ БАЛАНС ТА КОНФІГ</h2>
                    <button class="settings-close">×</button>
                </div>
                <div class="settings-body" id="settings-body"></div>
            </div>
        `;
        
        document.body.appendChild(this.#modal);
        UIUtils.makeSolid(this.#modal.querySelector('.settings-content')); // Щоб кліки не йшли в гру
        
        this.#modal.querySelector('.settings-close').addEventListener('click', () => this.toggle());
        
        // Закриття по кліку на темний фон
        this.#modal.addEventListener('pointerdown', (e) => {
            if (e.target === this.#modal) this.toggle();
        });
    }

    toggle() {
        this.#isOpen = !this.#isOpen;
        this.#modal.style.display = this.#isOpen ? 'flex' : 'none';
        
        if (this.#isOpen) {
            const body = this.#modal.querySelector('#settings-body');
            body.innerHTML = ''; // Очищаємо перед генерацією
            this.#buildTree(this.#config, body, []);
        }
    }

    // Рекурсивна генерація форми
    #buildTree(obj, parentElement, path) {
        for (const key in obj) {
            if (this.#excludeKeys.includes(key)) continue;
            
            const val = obj[key];
            const currentPath = [...path, key];

            // Якщо це масив з чисел (наприклад [1.5, 2.5] для вітру)
            if (Array.isArray(val) && typeof val[0] === 'number') {
                this.#createInputRow(key, val.join(', '), parentElement, currentPath, 'array');
            } 
            // Якщо це об'єкт - створюємо нову секцію і заглиблюємось
            else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
                const section = document.createElement('div');
                section.className = 'settings-section';
                section.innerHTML = `<div class="settings-section-title">${key}</div>`;
                parentElement.appendChild(section);
                this.#buildTree(val, section, currentPath);
            } 
            // Прості значення (числа, булеві, строки)
            else if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'string') {
                this.#createInputRow(key, val, parentElement, currentPath, typeof val);
            }
        }
    }

    #createInputRow(key, val, parentElement, path, type) {
        const row = document.createElement('div');
        row.className = 'settings-row';
        
        const label = document.createElement('div');
        label.className = 'settings-label';
        label.innerText = key;
        row.appendChild(label);

        let inputElement;

        if (type === 'boolean') {
            inputElement = document.createElement('label');
            inputElement.className = 'switch';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = val;
            const slider = document.createElement('span');
            slider.className = 'slider';
            inputElement.appendChild(cb);
            inputElement.appendChild(slider);
            
            cb.addEventListener('change', (e) => this.#updateConfigValue(path, e.target.checked));
        } else if (type === 'number') {
            inputElement = document.createElement('input');
            inputElement.type = 'number';
            inputElement.step = 'any'; // Дозволяє дроби
            inputElement.className = 'settings-input-num';
            inputElement.value = val;
            
            inputElement.addEventListener('change', (e) => this.#updateConfigValue(path, parseFloat(e.target.value) || 0));
        } else {
            inputElement = document.createElement('input');
            inputElement.type = 'text';
            inputElement.className = 'settings-input-text';
            inputElement.value = val;
            
            inputElement.addEventListener('change', (e) => {
                let newVal = e.target.value;
                if (type === 'array') {
                    // Перетворюємо строку "1.5, 2.5" назад у масив чисел [1.5, 2.5]
                    newVal = newVal.split(',').map(n => parseFloat(n.trim()) || 0);
                }
                this.#updateConfigValue(path, newVal);
            });
        }

        row.appendChild(inputElement);
        parentElement.appendChild(row);
    }

    #updateConfigValue(path, newValue) {
        // Проходимо по дереву CONFIG і міняємо значення за вказаним шляхом
        let target = this.#config;
        for (let i = 0; i < path.length - 1; i++) {
            target = target[path[i]];
        }
        target[path[path.length - 1]] = newValue;
        console.log(`Updated CONFIG.${path.join('.')} =`, newValue);
    }
}