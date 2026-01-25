# 🌾 AgriFinance - Blockchain-Powered Agricultural DeFi Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-crop--cash--3.emergent.host-green?style=for-the-badge)](https://crop-cash-3.emergent.host/)
[![Sepolia Testnet](https://img.shields.io/badge/Network-Sepolia%20Testnet-627EEA?style=for-the-badge&logo=ethereum)](https://sepolia.etherscan.io/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

> **Revolutionizing agricultural finance** with zero-collateral loans, AI-powered credit scoring, transparent supply chains, and advanced Web3 features.

---

## 🚀 Live Demo

**🌐 [https://crop-cash-3.emergent.host/](https://crop-cash-3.emergent.host/)**

---

## ✨ Key Features

### 💰 DeFi Financial Services
- **Zero-Collateral Loans** - Farmers can access loans without traditional collateral using AI credit scoring
- **Liquidity Pools** - Lenders deposit KRSI tokens and earn returns from borrower interest
- **On-Chain Lending** - LoanVault smart contract with fixed 8% APR (DAO-controlled)
- **Committee Voting** - Decentralized loan approval via staked lender voting

### 🔗 Supply Chain Transparency
- **End-to-End Traceability** - Track products from farm to consumer
- **QR Code Verification** - Scan to verify product authenticity
- **Blockchain-Verified Records** - Immutable supply chain history

### 🧠 Advanced Web3 Features
- **AI Credit Scoring** - Multi-factor risk analysis using farm data, weather, and market conditions
- **Zero-Knowledge Proofs** - Privacy-preserving credential verification
- **Gasless Transactions** - Account Abstraction via Biconomy for seamless onboarding
- **DAO Governance** - Community-driven platform decisions

### 🎨 NFT Marketplace
- **Land NFTs** - Tokenized agricultural land ownership
- **Crop NFTs** - Verifiable crop batches as digital assets
- **Secure Trading** - Decentralized marketplace

---

## 👥 User Roles

| Role | Capabilities |
|------|-------------|
| **👨‍🌾 Farmer** | Apply for loans, manage crops, track supply chain, mint NFTs |
| **💰 Lender** | Provide liquidity, vote in committee, review loan requests |
| **🛒 Buyer** | Purchase products, verify authenticity, track orders |
| **🔧 Admin** | Platform management, analytics, user administration |

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           AgriFinance Platform                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   Frontend    │           │   Backend     │           │  Blockchain   │
│  React + Vite │◄─────────►│  Node.js API  │◄─────────►│   Sepolia     │
│  TailwindCSS  │           │   Express.js  │           │   Testnet     │
└───────────────┘           └───────────────┘           └───────────────┘
        │                           │                           │
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│    Hosting    │           │   Database    │           │  Smart        │
│   Emergent    │           │   NeonDB      │           │  Contracts    │
│    Cloud      │           │  PostgreSQL   │           │  (Solidity)   │
└───────────────┘           └───────────────┘           └───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │  IPFS Storage │               │  AI Credit    │
            │ Web3.Storage  │               │  Scoring      │
            └───────────────┘               └───────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, TailwindCSS, React Router, ethers.js |
| **Backend** | Node.js, Express, PostgreSQL (NeonDB), JWT Auth |
| **Blockchain** | Solidity, Hardhat, Polygon Amoy, IPFS |
| **Web3** | Biconomy Account Abstraction, Zero-Knowledge Proofs |
| **AI/ML** | Custom credit scoring engine |

---

## 📁 Project Structure

```
agrifinance/
├── frontend/          # React application
│   ├── src/
│   │   ├── pages/     # Route components
│   │   ├── components/# Reusable UI components
│   │   ├── context/   # React contexts (Auth, Web3, Theme)
│   │   └── services/  # API and blockchain services
├── backend/           # Express API server
│   ├── services/      # Business logic
│   └── server.js      # Main entry point
├── contracts/         # Solidity smart contracts
├── deployments/       # Contract deployment addresses
└── zk-circuits/       # Zero-Knowledge proof circuits
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Git
- MetaMask (optional, in-app wallet available)

### Installation

```bash
# Clone the repository
git clone https://github.com/Ritinpaul/Agrifinancev2.git
cd Agrifinancev2

# Install dependencies
npm install
cd frontend && npm install
cd ../backend && npm install

# Configure environment
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# Start development server
npm run dev
```

---

## 📜 Smart Contracts (Sepolia Testnet)

| Contract | Address | Description |
|----------|---------|-------------|
| **KrishiToken (KRSI)** | [`0x41ef54662509D66715C237c6e1d025DBC6a9D8d1`](https://sepolia.etherscan.io/address/0x41ef54662509D66715C237c6e1d025DBC6a9D8d1) | Platform utility token |
| **LoanVault** | [`0xb3c84011492b4126337798E53aE5e483FD2933A8`](https://sepolia.etherscan.io/address/0xb3c84011492b4126337798E53aE5e483FD2933A8) | DeFi lending pool |
| **SupplyChain** | [`0x2FDf116504b8FB172F6b98363a9047481f59dd8b`](https://sepolia.etherscan.io/address/0x2FDf116504b8FB172F6b98363a9047481f59dd8b) | Product traceability |
| **BatchNFT** | [`0x36f9d540B32f5b8F5962a3928c1f328d30b71189`](https://sepolia.etherscan.io/address/0x36f9d540B32f5b8F5962a3928c1f328d30b71189) | Agricultural batch NFTs |
| **EscrowLoan** | [`0x26129493f5095445a2a27F1b358504eCD87Cb710`](https://sepolia.etherscan.io/address/0x26129493f5095445a2a27F1b358504eCD87Cb710) | Loan escrow contract |

---

## 🔐 Security Features

- ✅ Role-based access control
- ✅ JWT authentication
- ✅ Rate limiting
- ✅ Input validation (Joi)
- ✅ XSS/SQL injection protection
- ✅ CORS configuration
- ✅ Helmet security headers

---

## 📖 Documentation

Visit `/docs` in the application for comprehensive user documentation including:
- Feature guides
- User role explanations
- FAQ section
- Getting started tutorials

---

## 🏆 Hackathon Highlights

1. **Real DeFi Functionality** - Actual on-chain lending with LoanVault
2. **AI Integration** - Credit scoring for unsecured farmer loans
3. **Privacy-First** - Zero-Knowledge proof verification
4. **Gasless UX** - Account Abstraction for Web2-like experience
5. **Full Supply Chain** - End-to-end product traceability

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Team

Built with ❤️ for the agricultural community.

**Contact:** [GitHub Issues](https://github.com/Ritinpaul/Agrifinancev2/issues)


