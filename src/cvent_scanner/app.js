/**
 * Cvent QR Scanner - Main Application
 * Handles UI interactions, QR scanning, and API calls
 */

const App = {
    // State
    scanner: null,
    isScanning: false,
    cameras: [],
    currentCameraId: null,
    testQRData: null,

    // DOM Elements
    elements: {},

    /**
     * Initialize the application
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadSettings();
        this.renderHistory();
        this.generateTestQRCodes();
        this.checkCameraSupport();
        
        console.log('🚀 Cvent QR Scanner initialized');
    },

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements = {
            // Tabs
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            
            // Scanner
            qrReader: document.getElementById('qr-reader'),
            startScanBtn: document.getElementById('start-scan'),
            stopScanBtn: document.getElementById('stop-scan'),
            cameraSelect: document.getElementById('camera-select'),
            
            // Results
            resultContainer: document.getElementById('result-container'),
            errorContainer: document.getElementById('error-container'),
            attendeeName: document.getElementById('attendee-name'),
            attendeeTitle: document.getElementById('attendee-title'),
            attendeeCompany: document.getElementById('attendee-company'),
            attendeeEmail: document.getElementById('attendee-email'),
            attendeeAvatar: document.getElementById('attendee-avatar'),
            qrFormat: document.getElementById('qr-format'),
            refId: document.getElementById('ref-id'),
            errorMessage: document.getElementById('error-message'),
            scanAnotherBtn: document.getElementById('scan-another'),
            retryScanBtn: document.getElementById('retry-scan'),
            
            // Test QR
            qrMecard: document.getElementById('qr-mecard'),
            qrDelimited: document.getElementById('qr-delimited'),
            qrEmail: document.getElementById('qr-email'),
            qrRefid: document.getElementById('qr-refid'),
            generateNewQRsBtn: document.getElementById('generate-new-qrs'),
            
            // History
            historyList: document.getElementById('history-list'),
            clearHistoryBtn: document.getElementById('clear-history'),
            
            // Settings
            demoModeToggle: document.getElementById('demo-mode'),
            apiSettings: document.getElementById('api-settings'),
            eventIdInput: document.getElementById('event-id'),
            exhibitorIdInput: document.getElementById('exhibitor-id'),
            bearerTokenInput: document.getElementById('bearer-token'),
            apiRegionSelect: document.getElementById('api-region'),
            saveSettingsBtn: document.getElementById('save-settings'),
            testConnectionBtn: document.getElementById('test-connection'),
            
            // Loading
            loadingOverlay: document.getElementById('loading-overlay')
        };
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Tab navigation
        this.elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Scanner controls
        this.elements.startScanBtn.addEventListener('click', () => this.startScanning());
        this.elements.stopScanBtn.addEventListener('click', () => this.stopScanning());
        this.elements.cameraSelect.addEventListener('change', (e) => this.switchCamera(e.target.value));
        
        // Result actions
        this.elements.scanAnotherBtn.addEventListener('click', () => this.resetScanner());
        this.elements.retryScanBtn.addEventListener('click', () => this.resetScanner());
        
        // Test QR
        this.elements.generateNewQRsBtn.addEventListener('click', () => this.generateTestQRCodes());
        
        // History
        this.elements.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        
        // Settings
        this.elements.demoModeToggle.addEventListener('change', (e) => this.toggleDemoMode(e.target.checked));
        this.elements.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.elements.testConnectionBtn.addEventListener('click', () => this.testConnection());
    },

    /**
     * Check if camera is supported
     */
    async checkCameraSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.elements.startScanBtn.disabled = true;
            this.elements.startScanBtn.innerHTML = '<span class="icon">⚠️</span> Cámara no soportada';
            return;
        }

        try {
            const devices = await Html5Qrcode.getCameras();
            this.cameras = devices;
            
            // Populate camera select
            this.elements.cameraSelect.innerHTML = '<option value="">Seleccionar cámara...</option>';
            devices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = device.label || `Cámara ${index + 1}`;
                this.elements.cameraSelect.appendChild(option);
            });

            // Auto-select back camera if available
            const backCamera = devices.find(d => 
                d.label.toLowerCase().includes('back') || 
                d.label.toLowerCase().includes('trasera') ||
                d.label.toLowerCase().includes('rear')
            );
            if (backCamera) {
                this.elements.cameraSelect.value = backCamera.id;
                this.currentCameraId = backCamera.id;
            } else if (devices.length > 0) {
                this.elements.cameraSelect.value = devices[0].id;
                this.currentCameraId = devices[0].id;
            }
        } catch (e) {
            console.error('Error getting cameras:', e);
        }
    },

    /**
     * Start QR scanning
     */
    async startScanning() {
        if (this.isScanning) return;

        try {
            // Hide results
            this.elements.resultContainer.classList.add('hidden');
            this.elements.errorContainer.classList.add('hidden');

            // Initialize scanner
            this.scanner = new Html5Qrcode('qr-reader');
            
            const cameraId = this.currentCameraId || this.elements.cameraSelect.value;
            
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            if (cameraId) {
                await this.scanner.start(
                    cameraId,
                    config,
                    (decodedText) => this.onScanSuccess(decodedText),
                    (errorMessage) => {} // Ignore scan errors
                );
            } else {
                // Use facing mode if no camera ID
                await this.scanner.start(
                    { facingMode: 'environment' },
                    config,
                    (decodedText) => this.onScanSuccess(decodedText),
                    (errorMessage) => {}
                );
            }

            this.isScanning = true;
            this.elements.startScanBtn.disabled = true;
            this.elements.stopScanBtn.disabled = false;
            
        } catch (e) {
            console.error('Error starting scanner:', e);
            this.showError('No se pudo acceder a la cámara. Verifica los permisos.');
        }
    },

    /**
     * Stop QR scanning
     */
    async stopScanning() {
        if (!this.isScanning || !this.scanner) return;

        try {
            await this.scanner.stop();
            this.scanner.clear();
        } catch (e) {
            console.error('Error stopping scanner:', e);
        }

        this.isScanning = false;
        this.elements.startScanBtn.disabled = false;
        this.elements.stopScanBtn.disabled = true;
    },

    /**
     * Switch camera
     */
    async switchCamera(cameraId) {
        this.currentCameraId = cameraId;
        if (this.isScanning) {
            await this.stopScanning();
            await this.startScanning();
        }
    },

    /**
     * Handle successful QR scan
     */
    async onScanSuccess(decodedText) {
        // Stop scanning immediately
        await this.stopScanning();
        
        console.log('📱 QR Detected:', decodedText);
        
        // Parse QR code
        const parsedData = QRParser.parse(decodedText);
        console.log('📋 Parsed Data:', parsedData);

        if (parsedData.error) {
            this.showError(parsedData.error);
            return;
        }

        // Show loading
        this.showLoading(true);

        try {
            // Lookup attendee
            const result = await this.lookupAttendee(parsedData);
            
            // Hide loading
            this.showLoading(false);
            
            // Show result
            this.showResult(result.data, parsedData);
            
            // Save to history
            StorageService.addToHistory(result.data, parsedData);
            
        } catch (error) {
            this.showLoading(false);
            this.showError(error.message || 'Error al buscar asistente');
        }
    },

    /**
     * Lookup attendee via API or mock
     */
    async lookupAttendee(parsedData) {
        const isDemoMode = StorageService.isDemoMode();
        
        if (isDemoMode) {
            // Use mock service
            return MockService.lookupAttendee(parsedData.referenceId, parsedData);
        } else {
            // Use real API
            return this.callBadgeKitAPI(parsedData);
        }
    },

    /**
     * Call real BadgeKit API
     */
    async callBadgeKitAPI(parsedData) {
        const config = StorageService.getAPIConfig();
        
        if (!config.isConfigured) {
            throw new Error('API no configurada. Activa modo demo o ingresa credenciales.');
        }

        const url = `${config.baseUrl}/onsite/v1/events/${config.eventId}/exhibitors/${config.exhibitorId}/attendees/${parsedData.referenceId}`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.bearerToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Asistente no encontrado o sin consentimiento de escaneo.');
                }
                if (response.status === 401) {
                    throw new Error('Token inválido o expirado. Actualiza las credenciales.');
                }
                throw new Error(`Error de API: ${response.status}`);
            }

            const data = await response.json();
            return {
                success: true,
                data: data,
                source: 'api'
            };
        } catch (e) {
            if (e.name === 'TypeError' && e.message.includes('Failed to fetch')) {
                throw new Error('Error de conexión. Verifica tu conexión a internet.');
            }
            throw e;
        }
    },

    /**
     * Show attendee result
     */
    showResult(attendee, parsedData) {
        const fullName = `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim() || 'Sin nombre';
        const initials = QRParser.getInitials(attendee);
        
        this.elements.attendeeName.textContent = fullName;
        this.elements.attendeeTitle.textContent = attendee.title || 'Sin título';
        this.elements.attendeeCompany.textContent = attendee.company || 'Sin empresa';
        this.elements.attendeeEmail.textContent = attendee.email || 'Sin email';
        this.elements.attendeeAvatar.textContent = initials;
        this.elements.qrFormat.textContent = `Formato: ${parsedData.format}`;
        this.elements.refId.textContent = `Ref: ${parsedData.referenceId?.substring(0, 10) || 'N/A'}...`;
        
        this.elements.resultContainer.classList.remove('hidden');
        this.elements.errorContainer.classList.add('hidden');
        
        // Play success sound or vibrate
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    },

    /**
     * Show error message
     */
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorContainer.classList.remove('hidden');
        this.elements.resultContainer.classList.add('hidden');
        
        // Vibrate pattern for error
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
    },

    /**
     * Show/hide loading overlay
     */
    showLoading(show) {
        if (show) {
            this.elements.loadingOverlay.classList.remove('hidden');
        } else {
            this.elements.loadingOverlay.classList.add('hidden');
        }
    },

    /**
     * Reset scanner for new scan
     */
    resetScanner() {
        this.elements.resultContainer.classList.add('hidden');
        this.elements.errorContainer.classList.add('hidden');
        this.startScanning();
    },

    /**
     * Switch active tab
     */
    switchTab(tabId) {
        // Update tab buttons
        this.elements.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        // Update tab content
        this.elements.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });

        // Refresh history when switching to that tab
        if (tabId === 'history') {
            this.renderHistory();
        }
    },

    /**
     * Generate test QR codes
     */
    generateTestQRCodes() {
        this.testQRData = MockService.generateTestQRData();

        // Generate QR images
        this.generateQRImage('qr-mecard', this.testQRData.mecard.data);
        this.generateQRImage('qr-delimited', this.testQRData.delimited.data);
        this.generateQRImage('qr-email', this.testQRData.email.data);
        this.generateQRImage('qr-refid', this.testQRData.refIdOnly.data);

        // Update descriptions
        document.querySelectorAll('.qr-data').forEach((el, index) => {
            const data = [
                this.testQRData.mecard.data,
                this.testQRData.delimited.data,
                this.testQRData.email.data,
                this.testQRData.refIdOnly.data
            ][index];
            el.textContent = data.length > 35 ? data.substring(0, 35) + '...' : data;
        });
    },

    /**
     * Generate QR code image
     */
    generateQRImage(elementId, data) {
        const container = document.getElementById(elementId);
        container.innerHTML = '';
        
        try {
            new QRCode(container, {
                text: data,
                width: 120,
                height: 120,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (error) {
            console.error('Error generating QR:', error);
            container.innerHTML = '<span style="color: red; font-size: 0.8rem;">Error</span>';
        }
    },

    /**
     * Render history list
     */
    renderHistory() {
        const history = StorageService.getHistory();
        
        if (history.length === 0) {
            this.elements.historyList.innerHTML = '<p class="empty-state">No hay escaneos registrados</p>';
            return;
        }

        const html = history.map(item => {
            const initials = ((item.firstName?.[0] || '') + (item.lastName?.[0] || '')).toUpperCase() || '??';
            const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Sin nombre';
            const timeAgo = StorageService.formatTimestamp(item.timestamp);
            
            return `
                <div class="history-item">
                    <div class="history-avatar">${initials}</div>
                    <div class="history-info">
                        <div class="history-name">${fullName}</div>
                        <div class="history-company">${item.company || 'Sin empresa'}</div>
                    </div>
                    <div class="history-time">${timeAgo}</div>
                </div>
            `;
        }).join('');

        this.elements.historyList.innerHTML = html;
    },

    /**
     * Clear scan history
     */
    clearHistory() {
        if (confirm('¿Estás seguro de que querés borrar todo el historial?')) {
            StorageService.clearHistory();
            this.renderHistory();
        }
    },

    /**
     * Load settings into form
     */
    loadSettings() {
        const settings = StorageService.getSettings();
        if (!settings) return;

        this.elements.demoModeToggle.checked = settings.demoMode;
        this.elements.eventIdInput.value = settings.eventId || '';
        this.elements.exhibitorIdInput.value = settings.exhibitorId || '';
        this.elements.bearerTokenInput.value = settings.bearerToken || '';
        this.elements.apiRegionSelect.value = settings.region || 'na';
        
        this.toggleDemoMode(settings.demoMode);
    },

    /**
     * Toggle demo mode
     */
    toggleDemoMode(enabled) {
        StorageService.updateSetting('demoMode', enabled);
        
        if (enabled) {
            this.elements.apiSettings.classList.add('disabled');
        } else {
            this.elements.apiSettings.classList.remove('disabled');
        }
    },

    /**
     * Save settings
     */
    saveSettings() {
        const settings = {
            demoMode: this.elements.demoModeToggle.checked,
            eventId: this.elements.eventIdInput.value.trim(),
            exhibitorId: this.elements.exhibitorIdInput.value.trim(),
            bearerToken: this.elements.bearerTokenInput.value.trim(),
            region: this.elements.apiRegionSelect.value
        };

        StorageService.saveSettings(settings);
        alert('✅ Configuración guardada');
    },

    /**
     * Test API connection
     */
    async testConnection() {
        const config = StorageService.getAPIConfig();
        
        if (!config.isConfigured) {
            alert('⚠️ Completa todos los campos de configuración primero');
            return;
        }

        this.elements.testConnectionBtn.disabled = true;
        this.elements.testConnectionBtn.textContent = 'Probando...';

        try {
            // Try to make a simple request (will likely fail with fake data, but tests connectivity)
            const response = await fetch(`${config.baseUrl}/onsite/v1/events/${config.eventId}`, {
                method: 'HEAD',
                headers: {
                    'Authorization': `Bearer ${config.bearerToken}`
                }
            });

            if (response.ok || response.status === 404) {
                alert('✅ Conexión exitosa con Cvent API');
            } else if (response.status === 401) {
                alert('❌ Token inválido o expirado');
            } else {
                alert(`⚠️ Respuesta: ${response.status}`);
            }
        } catch (e) {
            alert('❌ Error de conexión: ' + e.message);
        }

        this.elements.testConnectionBtn.disabled = false;
        this.elements.testConnectionBtn.textContent = '🔗 Probar Conexión';
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
