# I create this with only 3 hours, please dont cite this as i prob dont remember anything about this project
# Food Delivery Backend Service

A TypeScript-based backend service designed to handle rider assignments and restaurant statistics for a food delivery platform.

## Project Structure

- `src/index.ts`: Entry point for the Express server.
- `src/controllers/`: Request handlers.
- `src/models/`: Shared TypeScript interfaces and configuration constants.
- `src/repositories/`: Data access layer interfacing with PostgreSQL.
- `src/services/`: Core business logic (e.g., rider matching algorithm).

## Quick Start

### Prerequisites

- Node.js (v18+)
- PostgreSQL Database

### Configuration

Create a `.env` file in the root directory:

```env
POSTGRES_USER=your_user
POSTGRES_HOST=localhost
POSTGRES_DB=your_db
POSTGRES_PASSWORD=your_password
```

### Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (auto-reloads):
   ```bash
   npm run dev
   ```
3. Run the simulation:

```bash
   npx ts-node src/simulate.ts
```

### Production

1. Build the project:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm start
   ```

## Contributing

- Run `npm test` before submitting changes to ensure existing logic remains sound.
- Follow existing patterns in `repositories/` and `services/` for new features.
