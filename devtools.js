class DevTools {
    #config;
    #ui;
    #isOpen = false;
    
    // --- ПОРЯДОК ГОЛОВНИХ СЕКЦІЙ ---
    #sectionOrder = [
        'debug',
        'OVERLAY MODULES',
        'CONSOLE MODULES',
        'spawns',
        'rod',
        'reel',
        'hook',
        'tension',
        'stamina',
        'physics',
        'net',
        'locations',
        'ui',
    ];
    
    #excludeKeys = ['id', 'name', 'bgUrls', 'depthUrl', 'endpoint', 'backgroundColor', 'colorGradient', 'statuses', 'zones'];

    constructor(config) {
        this.#config = config;
        // Створюємо екземпляр UI і передаємо йому колбек для відкриття/закриття
        this.#ui = new DevToolsUI(() => this.toggle(), this.#config);
    }

    toggle() {
        this.#isOpen = !this.#isOpen;
        this.#ui.togglePanel(this.#isOpen); // Даємо команду UI висунути або сховати панель
        
        // Якщо панель відкрили, генеруємо її вміст
        if (this.#isOpen) {
            this.#populatePanel();
        }
    }

    #populatePanel() {
        const body = this.#ui.body;
        body.innerHTML = ''; 
        
        // 1. Збираємо секції
        const configKeys = Object.keys(this.#config).filter(k => !this.#excludeKeys.includes(k));
        const allAvailableSections = ['OVERLAY MODULES', 'CONSOLE MODULES', ...configKeys];
        
        // 2. Сортуємо їх
        allAvailableSections.sort((a, b) => {
            let indexA = this.#sectionOrder.indexOf(a);
            let indexB = this.#sectionOrder.indexOf(b);
            if (indexA === -1) indexA = 999;
            if (indexB === -1) indexB = 999;
            return indexA - indexB;
        });

        // 3. Будуємо дерево
        for (const key of allAvailableSections) {
            if (key === 'OVERLAY MODULES') {
                if (typeof OVERLAY_MODULES !== 'undefined') {
                    const content = this.#createSectionWithCache('OVERLAY MODULES (На Екрані)', body);
                    for (const k in OVERLAY_MODULES) {
                        this.#ui.createSwitcherRow(k, OVERLAY_MODULES[k], content, (v) => OVERLAY_MODULES[k] = v);
                    }
                }
            } else if (key === 'CONSOLE MODULES') {
                const debugMods = typeof window !== 'undefined' && window.DEBUG_MODULES ? window.DEBUG_MODULES : null;
                if (debugMods) {
                    const content = this.#createSectionWithCache('CONSOLE MODULES (Логи F12)', body);
                    for (const k in debugMods) {
                        this.#ui.createSwitcherRow(k, debugMods[k], content, (v) => debugMods[k] = v);
                    }
                }
            } else {
                const content = this.#createSectionWithCache(key, body);
                this.#buildTree(this.#config[key], content, [key]);
            }
        }
    }

    // --- Обгортка для створення секцій з підтримкою CacheManager ---
    #createSectionWithCache(labelStr, parentElement) {
        // Перевіряємо кеш на стан цієї папки
        let savedStates = typeof CacheManager !== 'undefined' ? CacheManager.get('dev_tools_sections_state', {}) : {};
        let isExpanded = savedStates[labelStr] || false; 
        
        // Викликаємо створення UI, передаючи поточний стан і колбек на його зміну
        return this.#ui.createSection(labelStr, parentElement, isExpanded, (isNowExpanded) => {
            if (typeof CacheManager !== 'undefined') {
                savedStates = CacheManager.get('dev_tools_sections_state', {});
                savedStates[labelStr] = isNowExpanded; 
                CacheManager.set('dev_tools_sections_state', savedStates);
            }
        });
    }

    #buildTree(obj, parentElement, path) {
        for (const key in obj) {
            if (this.#excludeKeys.includes(key)) continue;
            
            const val = obj[key];
            const currentPath = [...path, key];

            if (Array.isArray(val)) {
                if (val.length > 0 && typeof val[0] === 'number') {
                    this.#ui.createInputRow(key, val.join(', '), parentElement, 'array', (newVal) => this.#updateConfigValue(currentPath, newVal));
                } else if (val.length > 0 && typeof val[0] === 'object') {
                    const content = this.#createSectionWithCache(key, parentElement);
                    val.forEach((item, index) => {
                        const itemLabel = item.id || item.type || `Item [${index}]`;
                        const itemContent = this.#createSectionWithCache(itemLabel, content);
                        this.#buildTree(item, itemContent, [...currentPath, index]);
                    });
                }
            } else if (val !== null && typeof val === 'object') {
                const content = this.#createSectionWithCache(key, parentElement);
                this.#buildTree(val, content, currentPath);
            } else if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'string') {
                if (typeof val === 'boolean') {
                    this.#ui.createSwitcherRow(key, val, parentElement, (newVal) => this.#updateConfigValue(currentPath, newVal));
                } else {
                    this.#ui.createInputRow(key, val, parentElement, typeof val, (newVal) => this.#updateConfigValue(currentPath, newVal));
                }
            }
        }
    }

    #updateConfigValue(path, newValue) {
        let target = this.#config;
        for (let i = 0; i < path.length - 1; i++) {
            target = target[path[i]];
        }
        target[path[path.length - 1]] = newValue;
        console.log(`[DevTools] Оновлено CONFIG.${path.join('.')} =`, newValue);

        document.dispatchEvent(new CustomEvent('config-updated', { 
            detail: { path: path, value: newValue } 
        }));
    }
}