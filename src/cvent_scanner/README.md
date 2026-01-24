# Cvent QR Scanner - Demo

Web application to scan QR codes from Cvent event badges and display attendee information.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.html                               │
│  - Layout with 4 tabs: Scanner, Test QR, History, Settings      │
│  - CDN: html5-qrcode (scanner) + qrcodejs (generator)           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                           app.js                                 │
│  - Main controller                                               │
│  - Handles camera, UI, tabs, events                             │
│  - Orchestrates parser → service → storage                      │
└─────────────────────────────────────────────────────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  qr-parser.js │    │  mock-service.js │    │   storage.js    │
│               │    │                  │    │                 │
│ Detects and   │    │ Simulates        │    │ localStorage    │
│ parses 4      │    │ BadgeKit API     │    │ for history     │
│ Cvent QR      │    │ with random      │    │ and settings    │
│ formats       │    │ mock data        │    │                 │
└───────────────┘    └──────────────────┘    └─────────────────┘
```

## 📁 File Structure

```
cvent demo/
├── index.html       # Main UI with 4 sections
├── styles.css       # Mobile-first responsive styles
├── app.js           # Main logic and controller
├── qr-parser.js     # Parser for 4 Cvent QR formats
├── mock-service.js  # API simulator with mock data
├── storage.js       # localStorage persistence
└── README.md        # This file
```

## 🔍 Supported QR Formats (qr-parser.js)

Cvent uses 4 QR formats in their badges:

### 1. MeCard
```
MECARD:CONF:2WBCTIXLFURQT;N:Smith,Mary;TEL:+1555123;EMAIL:mary@email.com;TITLE:Director;ORG:TechCorp;;
```
- \`CONF:\` = Reference ID
- \`N:\` = LastName,FirstName
- \`ORG:\` = Company

### 2. Delimited (separators: ^ * % |)
```
J3NHHSZN2VK^John^Smith^john@email.com^Director^TechCorp^NewYork^^10001^+1555234
```
Order: RefID^FirstName^LastName^Email^Title^Company^City^State^ZIP^Phone

### 3. Email Only
```
mary.smith@company.com
```
The email is used as referenceId for API lookup.

### 4. Reference ID Only
```
2WBCTIXLFURQT
```
Alphanumeric code of 5-20 characters.

## 🔄 Scan Flow

```
1. User presses "Start Scan"
   └── app.js → Html5Qrcode.start()

2. Camera detects QR
   └── onScanSuccess(decodedText)

3. Parser analyzes the text
   └── QRParser.parse(decodedText)
   └── Returns: { format, referenceId, firstName, lastName, email, company, title }

4. Attendee lookup
   ├── Demo Mode: MockService.lookupAttendee()
   │   └── Generates mock data based on referenceId as seed
   └── Real Mode: callBadgeKitAPI()
       └── GET https://io.cvent.com/onsite/v1/events/{eventId}/exhibitors/{exhibitorId}/attendees/{refId}

5. Show result
   └── showResult(attendee, parsedData)
   └── StorageService.addToHistory()
```

## ⚙️ Configuration (storage.js)

\`\`\`javascript
// Settings structure in localStorage
{
  demoMode: true,          // true = use MockService, false = use real API
  eventId: "",             // Cvent event ID
  exhibitorId: "",         // Exhibitor ID
  bearerToken: "",         // Authentication token
  region: "na"             // "na" = io.cvent.com, "eu" = io-eur.cvent.com
}
\`\`\`

## 🌐 Real Cvent API (BadgeKit)

When \`demoMode: false\`, the app calls:

```
GET https://io.cvent.com/onsite/v1/events/{eventId}/exhibitors/{exhibitorId}/attendees/{referenceId}
Headers:
  Authorization: Bearer {token}
  Content-Type: application/json
```

Response:
\`\`\`json
{
  "firstName": "Mary",
  "lastName": "Smith",
  "email": "mary@company.com",
  "company": "TechCorp",
  "title": "Director",
  "workPhone": "+1555...",
  "customFields": [...]
}
\`\`\`

**Requirements for real API:**
- Credentials from Cvent Account Manager
- Event with BadgeKit enabled
- Attendees with scan consent

## 🧪 Test QR Codes (mock-service.js)

The "Test QR" tab generates scannable QR codes in all 4 formats.
- Uses \`MockService.generateTestQRData()\` 
- Data is random but consistent (seeded random based on referenceId)
- Realistic English names

## 📱 Running

\`\`\`bash
# Local server (Python)
cd "cvent demo"
python3 -m http.server 8080

# Open in browser
http://localhost:8080

# From mobile (same WiFi network)
http://192.168.x.x:8080
\`\`\`

## 🔧 To Modify

### Add new fields to result
1. Edit \`showResult()\` in [app.js](app.js#L298)
2. Add HTML elements in [index.html](index.html#L45-L60)

### Change mock data
1. Edit arrays in [mock-service.js](mock-service.js#L10-L45)
