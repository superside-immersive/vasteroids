/**
 * Mock Service for Cvent BadgeKit API
 * Simulates API responses with realistic Latin American data
 * Used for demo/testing without real API credentials
 */

const MockService = {
    // Sample first names (Latin American)
    firstNames: [
        'María', 'José', 'Juan', 'Ana', 'Carlos', 'Laura', 'Luis', 'Sofía',
        'Diego', 'Valentina', 'Martín', 'Camila', 'Alejandro', 'Isabella',
        'Sebastián', 'Luciana', 'Mateo', 'Paula', 'Nicolás', 'Fernanda',
        'Gabriel', 'Daniela', 'Fernando', 'Carolina', 'Ricardo', 'Gabriela',
        'Andrés', 'Mariana', 'Pablo', 'Victoria'
    ],

    // Sample last names (Latin American)
    lastNames: [
        'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández',
        'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera',
        'Gómez', 'Díaz', 'Reyes', 'Morales', 'Cruz', 'Ortiz',
        'Gutiérrez', 'Chávez', 'Ramos', 'Vargas', 'Castillo', 'Jiménez',
        'Moreno', 'Romero', 'Alvarado', 'Ruiz', 'Mendoza', 'Fernández'
    ],

    // Sample companies
    companies: [
        'TechCorp Argentina', 'Innovación Digital SA', 'Grupo Empresarial Latino',
        'Soluciones Cloud México', 'StartUp Hub Chile', 'Fintech Solutions',
        'Consulting Partners', 'Data Analytics Co', 'Software Factory',
        'E-Commerce Solutions', 'Banco del Sur', 'Telecom Americas',
        'Energía Renovable SA', 'Logística Express', 'Seguros Continental',
        'Pharma Latina', 'Retail Group', 'Media Networks', 'Agro Tech',
        'Universidad del Valle', 'Hospital Central', 'Fundación Avanzar'
    ],

    // Sample titles
    titles: [
        'CEO', 'CTO', 'CFO', 'Director de Marketing', 'Gerente de Ventas',
        'Product Manager', 'Software Engineer', 'Data Scientist',
        'Director de Operaciones', 'Gerente General', 'VP de Innovación',
        'Arquitecto de Soluciones', 'Consultor Senior', 'Analista de Negocios',
        'Coordinador de Proyectos', 'Especialista en UX', 'DevOps Engineer',
        'Gerente de RRHH', 'Director Comercial', 'Jefe de Desarrollo'
    ],

    // Sample event names
    eventNames: [
        'Tech Summit 2026', 'Innovación Empresarial', 'Digital Transformation Forum',
        'Latam Business Conference', 'Startup Expo', 'Future of Work Summit'
    ],

    /**
     * Generate a random element from an array using referenceId as seed
     */
    seededRandom(referenceId, array) {
        // Create a simple hash from the referenceId for consistent results
        let hash = 0;
        for (let i = 0; i < referenceId.length; i++) {
            const char = referenceId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        const index = Math.abs(hash) % array.length;
        return array[index];
    },

    /**
     * Generate mock attendee data based on referenceId
     * Uses referenceId as seed for consistent results
     */
    generateAttendee(referenceId, parsedQRData = {}) {
        // If QR already has data, use it; otherwise generate
        const firstName = parsedQRData.firstName || this.seededRandom(referenceId + 'fn', this.firstNames);
        const lastName = parsedQRData.lastName || this.seededRandom(referenceId + 'ln', this.lastNames);
        const company = parsedQRData.company || this.seededRandom(referenceId + 'co', this.companies);
        const title = parsedQRData.title || this.seededRandom(referenceId + 'ti', this.titles);
        
        // Generate email if not provided
        const email = parsedQRData.email || 
            `${firstName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}.${lastName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}@${company.toLowerCase().replace(/\s+/g, '').substring(0, 10)}.com`;

        return {
            referenceId: referenceId,
            firstName: firstName,
            lastName: lastName,
            email: email,
            company: company,
            title: title,
            workPhone: parsedQRData.phone || '+54 11 ' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000),
            mobilePhone: '+54 9 11 ' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000),
            customFields: [
                { id: 'cf1', name: 'Tipo de Registro', value: 'General' },
                { id: 'cf2', name: 'Intereses', value: 'Tecnología, Innovación' }
            ],
            eventId: 'demo-event-' + Math.random().toString(36).substring(7),
            eventName: this.seededRandom(referenceId + 'ev', this.eventNames),
            exhibitorId: 'demo-exhibitor-001'
        };
    },

    /**
     * Simulate API call with delay
     * @param {string} referenceId - The reference ID from QR code
     * @param {object} parsedQRData - Parsed data from QR (may contain some attendee info)
     * @returns {Promise} Resolves with attendee data or rejects with error
     */
    async lookupAttendee(referenceId, parsedQRData = {}) {
        // Simulate network delay (300-800ms)
        const delay = 300 + Math.random() * 500;
        
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate occasional errors (5% chance)
                if (Math.random() < 0.05) {
                    reject({
                        error: 'NetworkError',
                        message: 'Error de conexión simulado. Intenta nuevamente.',
                        status: 503
                    });
                    return;
                }

                // Simulate "not found" for specific test cases
                if (referenceId === 'NOTFOUND' || referenceId === 'ERROR') {
                    reject({
                        error: 'NotFound',
                        message: 'Asistente no encontrado o sin consentimiento de escaneo.',
                        status: 404
                    });
                    return;
                }

                // Return mock attendee data
                const attendee = this.generateAttendee(referenceId, parsedQRData);
                resolve({
                    success: true,
                    data: attendee,
                    source: 'mock'
                });
            }, delay);
        });
    },

    /**
     * Generate test QR code data in different formats
     */
    generateTestQRData() {
        const refId1 = this.generateReferenceId();
        const refId2 = this.generateReferenceId();
        const refId3 = this.generateReferenceId();
        const refId4 = this.generateReferenceId();

        // Use shorter names for MeCard to avoid overflow
        const firstName1 = 'Maria';
        const lastName1 = 'Garcia';
        const company1 = 'TechCorp';
        const title1 = 'Director';

        const firstName2 = this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
        const lastName2 = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];

        const email3 = `${this.firstNames[Math.floor(Math.random() * this.firstNames.length)].toLowerCase()}.${this.lastNames[Math.floor(Math.random() * this.lastNames.length)].toLowerCase()}@empresa.com`
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        return {
            mecard: {
                data: `MECARD:CONF:${refId1};N:${lastName1},${firstName1};ORG:${company1};;`,
                description: `${firstName1} ${lastName1} - ${company1}`
            },
            delimited: {
                data: `${refId2}^${firstName2}^${lastName2}^test@email.com^Director^TechCorp`,
                description: `${firstName2} ${lastName2} - TechCorp`
            },
            email: {
                data: email3,
                description: email3
            },
            refIdOnly: {
                data: refId4,
                description: `Reference ID: ${refId4}`
            }
        };
    },

    /**
     * Generate a random reference ID similar to Cvent's format
     */
    generateReferenceId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 13; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MockService;
}
