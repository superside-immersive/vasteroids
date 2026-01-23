/**
 * Storage Service
 * Handles localStorage persistence for scan history and settings
 */

const StorageService = {
    // Storage keys
    KEYS: {
        HISTORY: 'cvent_scan_history',
        SETTINGS: 'cvent_scanner_settings'
    },

    // Maximum history items to keep
    MAX_HISTORY_ITEMS: 100,

    /**
     * Initialize storage with defaults if empty
     */
    init() {
        if (!this.getSettings()) {
            this.saveSettings({
                demoMode: true,
                eventId: '',
                exhibitorId: '',
                bearerToken: '',
                region: 'na'
            });
        }
        if (!this.getHistory()) {
            this.saveHistory([]);
        }
    },

    // ==================== HISTORY ====================

    /**
     * Get all scan history
     * @returns {Array} Array of scan records
     */
    getHistory() {
        try {
            const data = localStorage.getItem(this.KEYS.HISTORY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading history:', e);
            return [];
        }
    },

    /**
     * Add a scan to history
     * @param {object} attendee - Attendee data from scan
     * @param {object} qrData - Parsed QR data
     */
    addToHistory(attendee, qrData) {
        try {
            const history = this.getHistory();
            
            const record = {
                id: Date.now().toString(36) + Math.random().toString(36).substring(2),
                timestamp: new Date().toISOString(),
                referenceId: attendee.referenceId,
                firstName: attendee.firstName,
                lastName: attendee.lastName,
                email: attendee.email,
                company: attendee.company,
                title: attendee.title,
                qrFormat: qrData.format,
                eventName: attendee.eventName || 'Demo Event'
            };

            // Add to beginning of array
            history.unshift(record);

            // Trim to max size
            if (history.length > this.MAX_HISTORY_ITEMS) {
                history.splice(this.MAX_HISTORY_ITEMS);
            }

            this.saveHistory(history);
            return record;
        } catch (e) {
            console.error('Error adding to history:', e);
            return null;
        }
    },

    /**
     * Save history to localStorage
     * @param {Array} history - History array
     */
    saveHistory(history) {
        try {
            localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
        } catch (e) {
            console.error('Error saving history:', e);
        }
    },

    /**
     * Clear all history
     */
    clearHistory() {
        try {
            localStorage.setItem(this.KEYS.HISTORY, JSON.stringify([]));
        } catch (e) {
            console.error('Error clearing history:', e);
        }
    },

    /**
     * Get history count
     * @returns {number} Number of items in history
     */
    getHistoryCount() {
        return this.getHistory().length;
    },

    /**
     * Format timestamp for display
     * @param {string} isoString - ISO timestamp
     * @returns {string} Formatted time string
     */
    formatTimestamp(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Ahora mismo';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        if (diffDays < 7) return `Hace ${diffDays} días`;

        return date.toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // ==================== SETTINGS ====================

    /**
     * Get saved settings
     * @returns {object} Settings object
     */
    getSettings() {
        try {
            const data = localStorage.getItem(this.KEYS.SETTINGS);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error reading settings:', e);
            return null;
        }
    },

    /**
     * Save settings
     * @param {object} settings - Settings object
     */
    saveSettings(settings) {
        try {
            localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
        } catch (e) {
            console.error('Error saving settings:', e);
        }
    },

    /**
     * Update specific setting
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     */
    updateSetting(key, value) {
        const settings = this.getSettings() || {};
        settings[key] = value;
        this.saveSettings(settings);
    },

    /**
     * Check if demo mode is enabled
     * @returns {boolean} True if demo mode
     */
    isDemoMode() {
        const settings = this.getSettings();
        return settings ? settings.demoMode : true;
    },

    /**
     * Get API configuration
     * @returns {object} API config object
     */
    getAPIConfig() {
        const settings = this.getSettings() || {};
        const baseUrl = settings.region === 'eu' 
            ? 'https://io-eur.cvent.com' 
            : 'https://io.cvent.com';

        return {
            baseUrl: baseUrl,
            eventId: settings.eventId || '',
            exhibitorId: settings.exhibitorId || '',
            bearerToken: settings.bearerToken || '',
            isConfigured: !!(settings.eventId && settings.exhibitorId && settings.bearerToken)
        };
    },

    /**
     * Export history as JSON
     * @returns {string} JSON string of history
     */
    exportHistory() {
        const history = this.getHistory();
        return JSON.stringify(history, null, 2);
    },

    /**
     * Export history as CSV
     * @returns {string} CSV string of history
     */
    exportHistoryCSV() {
        const history = this.getHistory();
        if (history.length === 0) return '';

        const headers = ['Timestamp', 'Nombre', 'Apellido', 'Email', 'Empresa', 'Título', 'Reference ID', 'Formato QR'];
        const rows = history.map(h => [
            h.timestamp,
            h.firstName || '',
            h.lastName || '',
            h.email || '',
            h.company || '',
            h.title || '',
            h.referenceId || '',
            h.qrFormat || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csvContent;
    }
};

// Initialize on load
StorageService.init();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageService;
}
