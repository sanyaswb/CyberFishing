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