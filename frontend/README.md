# AgriFinance Frontend

A modern React-based frontend for the AgriFinance platform, featuring advanced Web3 integration, Account Abstraction, and a comprehensive agricultural DeFi ecosystem.

## 🌟 Features

### 🎨 User Interface
- **Modern Design**: Clean, professional interface with dark/light mode support
- **Responsive Layout**: Optimized for desktop, tablet, and mobile devices
- **Component Library**: Reusable UI components with consistent styling
- **Navigation**: Organized dropdown menus for better user experience

### 🔐 Authentication & User Management
- **Multi-Role Support**: Farmers, Lenders, Buyers, and Admin roles
- **Profile Management**: Complete user profiles with role-specific features
- **Protected Routes**: Secure access control based on user roles
- **Session Management**: Persistent authentication with automatic token refresh

### 💰 Financial Features
- **Loan Application**: Comprehensive loan application system
- **Credit Scoring**: AI-powered credit assessment interface
- **Token Faucet**: Free test tokens for development and testing
- **Staking Interface**: Token staking with rewards tracking
- **Transaction History**: Complete transaction tracking and analytics

### 🛒 Marketplace Ecosystem
- **NFT Marketplace**: Trade agricultural land NFTs
- **Product Marketplace**: Buy and sell agricultural products
- **Product Verification**: QR code scanning for supply chain verification
- **Supply Chain Tracking**: Real-time product journey tracking

### 🔧 Advanced Web3 Features
- **Smart Account Setup**: Biconomy-powered Account Abstraction
- **Gasless Transactions**: Zero-gas user experience
- **ZK Verification**: Zero-Knowledge proof verification dashboard
- **Governance Portal**: Decentralized governance interface
- **Hybrid Wallet**: Multi-chain wallet integration

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- MetaMask wallet

### Installation

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create `.env` file in frontend directory:
   ```env
   VITE_ALCHEMY_API_KEY=your_alchemy_api_key
   VITE_BICONOMY_API_KEY=your_biconomy_api_key
   VITE_WEB3_STORAGE_TOKEN=your_web3_storage_token
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5173

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── AuthModal.jsx     # Authentication modal
│   │   ├── BatchManagement.jsx # Batch processing interface
│   │   ├── CreditScoring.jsx # Credit scoring interface
│   │   ├── DigitalAssetsDropdown.jsx # Digital assets navigation
│   │   ├── FinanceDropdown.jsx # Financial tools navigation
│   │   ├── GaslessOnboarding.jsx # Gasless onboarding flow
│   │   ├── GaslessTransaction.jsx # Gasless transaction interface
│   │   ├── GovernanceDashboard.jsx # Governance interface
│   │   ├── LoanApplication.jsx # Loan application form
│   │   ├── MarketplacesDropdown.jsx # Marketplace navigation
│   │   ├── Navbar.jsx # Main navigation component
│   │   ├── QRCodeScanner.jsx # QR code scanning modal
│   │   ├── ServicesDropdown.jsx # Services navigation
│   │   ├── SmartAccountSetup.jsx # Smart account configuration
│   │   ├── SmartToolsDropdown.jsx # Smart tools navigation
│   │   └── ZKVerificationDashboard.jsx # ZK verification interface
│   ├── pages/               # Page components
│   │   ├── BorrowerInterface.jsx # Borrower dashboard
│   │   ├── BuyerDashboard.jsx # Buyer interface
│   │   ├── DAOGovernance.jsx # DAO governance page
│   │   ├── FarmerDashboard.jsx # Farmer dashboard
│   │   ├── HybridWallet.jsx # Wallet management
│   │   ├── LenderDashboard.jsx # Lender interface
│   │   ├── Marketplace.jsx # Product marketplace
│   │   ├── NFTMarketplace.jsx # NFT trading interface
│   │   ├── ProductVerification.jsx # Product verification page
│   │   ├── Staking.jsx # Staking interface
│   │   ├── SupplyChain.jsx # Supply chain tracking
│   │   ├── TokenFaucetPage.jsx # Token faucet interface
│   │   └── TransactionHistory.jsx # Transaction history
│   ├── context/             # React contexts
│   │   ├── AccountAbstractionContext.jsx # AA state management
│   │   ├── AuthContext.jsx # Authentication state
│   │   ├── ThemeContext.jsx # Theme management
│   │   └── Web3Context.jsx # Web3 connection state
│   ├── services/            # External service integrations
│   │   └── accountAbstractionService.js # Biconomy integration
│   ├── utils/               # Utility functions
│   │   ├── aaTest.js # Account Abstraction testing
│   │   └── ... # Other utility files
│   ├── App.jsx # Main application component
│   ├── main.jsx # Application entry point
│   └── index.css # Global styles
├── public/ # Static assets
├── package.json # Dependencies and scripts
├── vite.config.js # Vite configuration
└── tailwind.config.js # Tailwind CSS configuration
```

## 🛠️ Technology Stack

### Core Framework
- **React 18** - Modern UI framework with hooks
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing

### Styling
- **Tailwind CSS** - Utility-first CSS framework
- **Custom Components** - Reusable UI components
- **Dark/Light Mode** - Theme switching support

### Web3 Integration
- **Ethers.js** - Ethereum blockchain interaction
- **Biconomy SDK** - Account Abstraction and gasless transactions
- **MetaMask** - Wallet integration
- **Web3.Storage** - Decentralized file storage

### UI/UX
- **React Hot Toast** - Notification system
- **QR Code Scanner** - Product verification
- **Responsive Design** - Mobile-first approach

## 🎯 Component Architecture

### Navigation Components
- **Navbar.jsx** - Main navigation with dropdown menus
- **ServicesDropdown.jsx** - Services navigation
- **SmartToolsDropdown.jsx** - Smart tools navigation
- **FinanceDropdown.jsx** - Financial tools navigation
- **MarketplacesDropdown.jsx** - Marketplace navigation
- **DigitalAssetsDropdown.jsx** - Digital assets navigation

### Feature Components
- **AuthModal.jsx** - Authentication interface
- **LoanApplication.jsx** - Loan application form
- **CreditScoring.jsx** - Credit assessment interface
- **QRCodeScanner.jsx** - Product verification scanner
- **SmartAccountSetup.jsx** - Account Abstraction setup
- **GaslessOnboarding.jsx** - Gasless transaction flow

### Dashboard Components
- **FarmerDashboard.jsx** - Farmer-specific interface
- **LenderDashboard.jsx** - Lender management interface
- **BuyerDashboard.jsx** - Buyer interface
- **BorrowerInterface.jsx** - Borrower dashboard

## 🔧 Configuration

### Vite Configuration
The `vite.config.js` includes:
- React plugin
- Node.js polyfills for Web3 compatibility
- Biconomy package optimization
- Development server configuration

### Environment Variables
Required environment variables:
```env
VITE_ALCHEMY_API_KEY=your_alchemy_api_key
VITE_BICONOMY_API_KEY=your_biconomy_api_key
VITE_WEB3_STORAGE_TOKEN=your_web3_storage_token
```

### Tailwind Configuration
Custom Tailwind setup with:
- AgriFinance color scheme
- Custom component classes
- Dark mode support
- Responsive breakpoints

## 🚀 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Development Guidelines
- Use functional components with hooks
- Follow React best practices
- Implement proper error handling
- Ensure mobile responsiveness
- Write clean, maintainable code

### Code Structure
- **Components**: Reusable UI components
- **Pages**: Full-page components
- **Context**: Global state management
- **Services**: External API integrations
- **Utils**: Helper functions

## 🔐 Security Features

- **Input Validation**: Comprehensive form validation
- **XSS Protection**: Content sanitization
- **Secure Routing**: Protected route implementation
- **Token Management**: Secure authentication tokens
- **Wallet Security**: MetaMask integration best practices

## 📱 Mobile Support

- **Responsive Design**: Mobile-first approach
- **Touch Interactions**: Mobile-optimized UI
- **QR Code Scanning**: Native camera integration
- **Mobile Wallet**: MetaMask mobile support

## 🧪 Testing

### Component Testing
- Unit tests for individual components
- Integration tests for user flows
- Accessibility testing
- Cross-browser compatibility

### Web3 Testing
- Smart contract interaction testing
- Wallet connection testing
- Transaction flow testing
- Account Abstraction testing

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Deployment Options
- **Vercel**: Automatic deployments from Git
- **Netlify**: Static site hosting
- **AWS S3**: Cloud storage deployment
- **Custom Server**: Traditional hosting

### Environment Setup
Ensure all environment variables are configured for production:
- API keys
- Contract addresses
- Network configurations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Workflow
- Follow existing code patterns
- Update documentation
- Ensure mobile compatibility
- Test Web3 integrations

---

**Built with React, Vite, and modern Web3 technologies**