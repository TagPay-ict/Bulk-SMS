# TagPay Bulk SMS Sender

A bulk SMS sending application that processes CSV files and sends personalized messages via Termii API.

## Features

- 📄 CSV file upload with flexible column matching
- ✏️ Message templates with placeholders ({{name}}, {{phoneNumber}}, {{accountNumber}})
- 🔄 Background job processing with BullMQ and Redis
- 📊 Real-time progress tracking via Server-Sent Events
- ⚡ Batch processing (100 recipients per batch) with rate limiting
- ❌ Failed batch management with retry approval workflow
- 💾 Template management with localStorage

## Architecture

- **Client**: Vite + React (frontend)
- **Server**: Express.js (backend API)
- **Queue**: BullMQ with Redis
- **SMS Provider**: Termii API

## Setup

### Prerequisites

- Node.js 18+
- Redis server (local or cloud)

### Server Setup

1. Navigate to server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Configure environment variables:
```
PORT=3001
REDIS_URL=redis://localhost:6379
TERMII_API_KEY=your_termii_api_key_here
TERMII_BASE_URL=https://api.ng.termii.com
BATCH_DELAY_MS=2000
```

5. Start the server:
```bash
npm run dev
```

### Client Setup

1. Navigate to client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Update API base URL in components if needed (default: `http://localhost:3001`)

4. Start the development server:
```bash
npm run dev
```

## Usage

1. Upload a CSV file with columns: `phoneNumber` (or `phone`), `name`, `accountNumber` (or `account`)
2. Write your message template using placeholders: `{{name}}`, `{{phoneNumber}}`, `{{accountNumber}}`
3. Enter your sender ID (3-11 alphanumeric characters)
4. Select channel (DND for transactional, Generic for promotional)
5. Click "Start Sending SMS"
6. Monitor progress in real-time
7. Review and retry failed batches if needed

## CSV Format

The CSV parser is flexible and will match columns case-insensitively:

- Phone number: `phoneNumber`, `phone`, `phonenumber`
- Name: `name`
- Account number: `accountNumber`, `account`, `accountnumber`

Example CSV:
```csv
phoneNumber,name,accountNumber
2349012345678,John Doe,1234567890
2349012345679,Jane Smith,0987654321
```

## API Endpoints

- `POST /api/upload` - Upload CSV and create job
- `GET /api/jobs/:jobId/progress` - Get job progress (SSE)
- `GET /api/jobs/:jobId/failed` - Get failed batches
- `POST /api/jobs/:jobId/retry` - Retry failed batches
- `GET /api/jobs/:jobId` - Get job status

## Deployment

### Render Setup

1. Create a Redis instance on Render
2. Deploy server with environment variables
3. Deploy client (static site)
4. Update API base URL in client to point to server URL

## License

ISC
