# Credit Card Statement Analyzer & Tracker

A comprehensive household credit card statement analysis and tracking application with AI-powered categorization, spending insights, and automated reporting.

## Features

✅ **Statement Processing**
- Upload and parse PDF, CSV, and Excel credit card statements
- Automatic transaction extraction and data cleaning
- Support for multiple credit card providers

✅ **AI-Powered Categorization**
- Automatic transaction categorization using rule-based and AI algorithms
- Custom category creation and management
- High-confidence categorization with manual review for edge cases

✅ **Analytics & Insights**
- Spending trend analysis with anomaly detection
- Monthly and quarterly spending reports
- Budget tracking and alerts
- Category-wise spending breakdowns

✅ **Interactive Dashboard**
- Real-time spending visualizations
- Interactive charts and graphs
- Transaction search and filtering
- Mobile-responsive design

✅ **Email Reports**
- Automated monthly and quarterly spending reports
- Budget alert notifications
- Anomaly detection alerts
- Beautiful HTML email templates

✅ **AI Chat Assistant**
- Natural language queries about spending patterns
- Data-driven financial insights
- Personalized recommendations
- Transaction search via chat

✅ **Security & Privacy**
- User authentication and authorization
- Encrypted password storage
- Secure API endpoints
- Local data storage

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS for styling
- Chart.js for visualizations
- React Router for navigation
- Heroicons for UI icons

**Backend:**
- Node.js + Express + TypeScript
- SQLite for data storage
- JWT authentication
- OpenAI API integration
- Nodemailer for email reports

**File Processing:**
- PDF parsing with pdf-parse
- CSV parsing with csv-parser
- Multer for file uploads

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd track-money
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   JWT_SECRET=your-super-secret-jwt-key
   OPENAI_API_KEY=your-openai-api-key  # Optional
   SMTP_USER=your-email@gmail.com      # Optional
   SMTP_PASS=your-app-password         # Optional
   ```

3. **Start the development servers:**
   ```bash
   npm run dev
   ```
   
   This starts both the backend (port 3001) and frontend (port 5173).

4. **Open your browser:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001/api

## Usage

### 1. Upload Statements
- Navigate to the Upload page
- Drag and drop or select PDF/CSV credit card statements
- The system will automatically parse and categorize transactions

### 2. Review Dashboard
- View spending summaries and visualizations
- Check monthly trends and category breakdowns
- Review recent transactions

### 3. Use AI Chat
- Ask questions like "How much did I spend on groceries this month?"
- Get insights about spending patterns and anomalies
- Receive personalized financial recommendations

### 4. Set Up Email Reports
- Configure SMTP settings in `.env`
- Receive automated monthly/quarterly reports
- Get budget alerts when spending exceeds limits

## Project Structure

```
track-money/
├── src/
│   ├── client/           # React frontend
│   │   ├── src/
│   │   │   ├── components/    # UI components
│   │   │   ├── pages/         # Page components
│   │   │   └── main.tsx       # App entry point
│   │   └── index.html
│   ├── server/           # Node.js backend
│   │   ├── database/          # Database schema and connection
│   │   ├── services/          # Business logic services
│   │   ├── routes/            # API routes
│   │   └── index.ts           # Server entry point
│   └── types/            # Shared TypeScript types
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Upload & Processing
- `POST /api/upload` - Upload statement file
- `GET /api/upload/status/:id` - Check processing status

### Analytics
- `GET /api/analytics/spending` - Spending analysis
- `GET /api/analytics/trends` - Spending trends
- `GET /api/analytics/anomalies` - Anomaly detection

### Chat
- `POST /api/chat` - Send chat message
- `GET /api/chat/history` - Get chat history

## Configuration

### Environment Variables

- `DATABASE_PATH` - SQLite database file path
- `JWT_SECRET` - JWT signing secret
- `OPENAI_API_KEY` - OpenAI API key for AI features (optional)
- `SMTP_*` - Email configuration for reports (optional)

### AI Features

The application includes optional AI features that enhance the user experience:

1. **Smart Categorization**: Uses OpenAI to categorize transactions with high accuracy
2. **Chat Assistant**: Natural language interface for financial queries
3. **Spending Insights**: AI-generated recommendations and insights

To enable AI features, add your OpenAI API key to the `.env` file.

### Email Reports

Configure SMTP settings to enable automated email reports:

1. Set up an app password for Gmail or your email provider
2. Add SMTP configuration to `.env`
3. Email reports will be sent automatically monthly/quarterly

## Development

### Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run typecheck` - Type checking

### Database

The application uses SQLite for data storage. The database is automatically initialized on first run with:

- User accounts and authentication
- Transaction storage with categorization
- Spending budgets and goals
- Chat message history
- Email report tracking

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure production database
3. Set secure JWT secret
4. Configure email SMTP for reports
5. Add OpenAI API key for AI features

## Security Considerations

- Passwords are hashed using bcrypt
- JWT tokens for secure API access
- Input validation and sanitization
- SQL injection prevention with parameterized queries
- File upload restrictions and validation
- CORS protection for API endpoints

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For questions or issues:

1. Check the existing GitHub issues
2. Create a new issue with detailed description
3. Include error logs and system information

## License

This project is licensed under the MIT License - see the LICENSE file for details.
