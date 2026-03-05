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
}