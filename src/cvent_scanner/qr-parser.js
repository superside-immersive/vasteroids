/**
 * Cvent QR Code Parser
 * Supports all 4 Cvent badge QR formats:
 * 1. MeCard format
 * 2. Delimited format (^, *, %, |)
 * 3. Email only
 * 4. Reference ID only
 */

const QRParser = {
    // Format identifiers
    FORMATS: {
        MECARD: 'MeCard',
        DELIMITED: 'Delimitado',
        EMAIL: 'Email',
        REFERENCE_ID: 'Reference ID'
    },

    // Supported delimiters for delimited format
    DELIMITERS: ['^', '*', '%', '|'],

    /**
     * Parse a Cvent QR code string and extract attendee data
     * @param {string} qrData - Raw QR code data
     * @returns {object} Parsed data with format, referenceId, and available fields
     */
    parse(qrData) {
        if (!qrData || typeof qrData !== 'string') {
            return { error: 'Datos de QR inválidos', raw: qrData };
        }

        const trimmedData = qrData.trim();

        // Try each format in order of specificity
        if (this.isMeCardFormat(trimmedData)) {
            return this.parseMeCard(trimmedData);
        }

        if (this.isDelimitedFormat(trimmedData)) {
            return this.parseDelimited(trimmedData);
        }

        if (this.isEmailFormat(trimmedData)) {
            return this.parseEmail(trimmedData);
        }

        // Default: assume it's a reference ID
        return this.parseReferenceId(trimmedData);
    },

    /**
     * Check if data is in MeCard format
     */
    isMeCardFormat(data) {
        return data.toUpperCase().startsWith('MECARD:');
    },

    /**
     * Parse MeCard format
     * Example: MECARD:CONF:2WBCTIXLFURQT;N:Bryant,Jason;TEL:;EMAIL:jason@email.com;TITLE:Research Nurse;ORG:Skimia;;
     */
    parseMeCard(data) {
        const result = {
            format: this.FORMATS.MECARD,
            raw: data,
            referenceId: null,
            firstName: null,
            lastName: null,
            email: null,
            phone: null,
            title: null,
            company: null
        };

        try {
            // Extract CONF (confirmation/reference ID)
            const confMatch = data.match(/CONF:([^;]*)/i);
            if (confMatch && confMatch[1]) {
                result.referenceId = confMatch[1].trim();
            }

            // Extract Name (format: LastName,FirstName)
            const nameMatch = data.match(/N:([^;]*)/i);
            if (nameMatch && nameMatch[1]) {
                const nameParts = nameMatch[1].split(',');
                if (nameParts.length >= 2) {
                    result.lastName = nameParts[0].trim();
                    result.firstName = nameParts[1].trim();
                } else if (nameParts.length === 1) {
                    result.lastName = nameParts[0].trim();
                }
            }

            // Extract Email
            const emailMatch = data.match(/EMAIL:([^;]*)/i);
            if (emailMatch && emailMatch[1]) {
                result.email = emailMatch[1].trim() || null;
            }

            // Extract Phone (TEL)
            const telMatch = data.match(/TEL:([^;]*)/i);
            if (telMatch && telMatch[1]) {
                result.phone = telMatch[1].trim() || null;
            }

            // Extract Title
            const titleMatch = data.match(/TITLE:([^;]*)/i);
            if (titleMatch && titleMatch[1]) {
                result.title = titleMatch[1].trim() || null;
            }

            // Extract Organization/Company (ORG)
            const orgMatch = data.match(/ORG:([^;]*)/i);
            if (orgMatch && orgMatch[1]) {
                result.company = orgMatch[1].trim() || null;
            }

        } catch (e) {
            result.error = 'Error parsing MeCard: ' + e.message;
        }

        return result;
    },

    /**
     * Check if data is in delimited format
     */
    isDelimitedFormat(data) {
        // Must contain at least one delimiter and have multiple parts
        for (const delim of this.DELIMITERS) {
            if (data.includes(delim)) {
                const parts = data.split(delim);
                // Cvent delimited format typically has at least 4 parts
                if (parts.length >= 3) {
                    return true;
                }
            }
        }
        return false;
    },

    /**
     * Parse delimited format
     * Example: J3NHHSZN2VK^Neil^Quinn^nquinn@cvent.com^MyTitle^MyCompany^MyCity^^22201^555-555-5555
     * Fields: ReferenceID^FirstName^LastName^Email^Title^Company^City^State^Zip^Phone
     */
    parseDelimited(data) {
        const result = {
            format: this.FORMATS.DELIMITED,
            raw: data,
            referenceId: null,
            firstName: null,
            lastName: null,
            email: null,
            title: null,
            company: null,
            city: null,
            state: null,
            zip: null,
            phone: null,
            delimiter: null
        };

        try {
            // Find which delimiter is used
            let delimiter = null;
            let maxParts = 0;

            for (const delim of this.DELIMITERS) {
                const parts = data.split(delim);
                if (parts.length > maxParts) {
                    maxParts = parts.length;
                    delimiter = delim;
                }
            }

            if (!delimiter) {
                result.error = 'No se encontró delimitador válido';
                return result;
            }

            result.delimiter = delimiter;
            const parts = data.split(delimiter);

            // Map parts to fields (standard Cvent order)
            if (parts[0]) result.referenceId = parts[0].trim();
            if (parts[1]) result.firstName = parts[1].trim();
            if (parts[2]) result.lastName = parts[2].trim();
            if (parts[3]) result.email = parts[3].trim();
            if (parts[4]) result.title = parts[4].trim();
            if (parts[5]) result.company = parts[5].trim();
            if (parts[6]) result.city = parts[6].trim();
            if (parts[7]) result.state = parts[7].trim();
            if (parts[8]) result.zip = parts[8].trim();
            if (parts[9]) result.phone = parts[9].trim();

        } catch (e) {
            result.error = 'Error parsing delimited format: ' + e.message;
        }

        return result;
    },

    /**
     * Check if data is an email address
     */
    isEmailFormat(data) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(data);
    },

    /**
     * Parse email-only format
     */
    parseEmail(data) {
        return {
            format: this.FORMATS.EMAIL,
            raw: data,
            referenceId: data, // Use email as reference for lookup
            email: data,
            firstName: null,
            lastName: null,
            title: null,
            company: null
        };
    },

    /**
     * Parse reference ID only format
     */
    parseReferenceId(data) {
        // Validate it looks like a reference ID (alphanumeric, reasonable length)
        const isValid = /^[A-Za-z0-9]{5,20}$/.test(data);

        return {
            format: this.FORMATS.REFERENCE_ID,
            raw: data,
            referenceId: data,
            firstName: null,
            lastName: null,
            email: null,
            title: null,
            company: null,
            warning: isValid ? null : 'El formato del Reference ID parece inusual'
        };
    },

    /**
     * Get the full name from parsed data
     */
    getFullName(parsedData) {
        if (parsedData.firstName && parsedData.lastName) {
            return `${parsedData.firstName} ${parsedData.lastName}`;
        }
        if (parsedData.firstName) return parsedData.firstName;
        if (parsedData.lastName) return parsedData.lastName;
        return null;
    },

    /**
     * Get initials for avatar display
     */
    getInitials(parsedData) {
        const first = parsedData.firstName ? parsedData.firstName[0] : '';
        const last = parsedData.lastName ? parsedData.lastName[0] : '';
        
        if (first && last) return (first + last).toUpperCase();
        if (first) return first.toUpperCase();
        if (last) return last.toUpperCase();
        if (parsedData.email) return parsedData.email[0].toUpperCase();
        if (parsedData.referenceId) return parsedData.referenceId.substring(0, 2).toUpperCase();
        
        return '??';
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QRParser;
}
