import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import {
  MdAttachMoney,
  MdInventory,
  MdSmartToy,
  MdDescription,
  MdAgriculture,
  MdAccountBalance,
  MdShoppingCart,
  MdVerifiedUser,
  MdTrendingUp,
  MdSecurity,
  MdGroups,
  MdArrowForward,
  MdStar,
  MdCheckCircle,
  MdWarning,
  MdInfo
} from 'react-icons/md';

/* ── High-quality Unsplash farming images ─────────────────────── */
const IMAGES = {
  heroBg:      'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1920&q=80',
  farmer1:     'https://images.unsplash.com/photo-1593691509543-c55fb32d8de5?auto=format&fit=crop&w=800&q=80',
  farmer2:     'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=800&q=80',
  field:       'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
  harvest:     'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=800&q=80',
  tech:        'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=800&q=80',
  drone:       'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=800&q=80',
  greenhouse:  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80',
};

const LandingPage = () => {
  const { user } = useAuth();

  // Web3 is optional - handle gracefully if not available
  let web3Data = { address: null, connectWallet: () => {} };
  try {
    const web3 = useWeb3();
    web3Data = web3;
  } catch (error) {}
  const { address } = web3Data;

  return (
    <div className="min-h-screen">

      {/* ═══════ HERO SECTION with Background Image ═══════ */}
      <section className="relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src={IMAGES.heroBg} 
            alt="Agricultural field" 
            className="w-full h-full object-cover"
          />
          {/* Dark green gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a1f14]/85 via-[#1a3a2a]/80 to-[#0d2818]/90"></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-12 sm:pb-16">
          <div className="text-center animate-fade-in">
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 shadow-glow-green animate-float">
                <span className="text-4xl sm:text-5xl">🌾</span>
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 sm:mb-5 px-4 tracking-tight">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-agri-leaf via-agri-mint to-agri-light bg-clip-text text-transparent">
                AgriFinance
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-200 mb-3 sm:mb-4 max-w-3xl mx-auto font-medium px-4">
              Blockchain-Powered Agricultural Supply Chain & DeFi Lending Platform
            </p>
            <p className="text-sm sm:text-base text-gray-300/80 mb-6 sm:mb-8 max-w-4xl mx-auto leading-relaxed px-4">
              Empowering farmers with zero-collateral loans, transparent supply chains, 
              AI-based credit scoring, and NFT land ownership verification.
            </p>
            
            {!user && (
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-4 mb-8 max-w-2xl mx-auto border-l-4 border-agri-warm">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MdWarning className="text-agri-warm text-xl" />
                  </div>
                  <div className="ml-3">
                    <p className="text-agri-warm dark:text-agri-warm font-medium text-sm">
                      Please sign in to access all features
                    </p>
                  </div>
                </div>
              </div>
            )}

            {user && !address && (
              <div className="glass-card p-4 mb-8 max-w-2xl mx-auto border-l-4 border-blue-500">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MdInfo className="text-blue-500 text-xl" />
                  </div>
                  <div className="ml-3">
                    <p className="text-blue-700 dark:text-blue-300 font-medium text-sm">
                      {user?.role === 'farmer' 
                        ? 'Farmers use in-app wallet only for blockchain features'
                        : 'Connect your wallet or use in-app wallet for blockchain features'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Link 
                to="/farmer" 
                className="group bg-gradient-to-r from-agri-forest to-agri-green hover:from-agri-deep hover:to-agri-forest text-white font-semibold py-3 sm:py-3.5 px-6 sm:px-8 rounded-xl text-sm shadow-lg hover:shadow-xl transition-all duration-300 text-center flex items-center justify-center gap-2 hover:-translate-y-1"
              >
                <MdAgriculture className="text-lg group-hover:scale-110 transition-transform" />
                <span>Farmer Dashboard</span>
              </Link>
              <Link 
                to="/lender" 
                className="group bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 sm:py-3.5 px-6 sm:px-8 rounded-xl text-sm shadow-lg hover:shadow-xl transition-all duration-300 text-center flex items-center justify-center gap-2 hover:-translate-y-1"
              >
                <MdAccountBalance className="text-lg group-hover:scale-110 transition-transform" />
                <span>Lender Dashboard</span>
              </Link>
              <Link 
                to="/buyer" 
                className="group bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 sm:py-3.5 px-6 sm:px-8 rounded-xl text-sm shadow-lg hover:shadow-xl transition-all duration-300 text-center flex items-center justify-center gap-2 hover:-translate-y-1"
              >
                <MdShoppingCart className="text-lg group-hover:scale-110 transition-transform" />
                <span>Buyer Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ TRUST BAR ═══════ */}
      <section className="bg-[#1a3a2a] py-5 border-y border-agri-leaf/20">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-white/90 text-sm font-semibold">
          <span className="flex items-center gap-2"><MdSecurity className="text-agri-leaf text-xl" /> Blockchain Secured</span>
          <span className="hidden sm:inline text-agri-leaf/40">|</span>
          <span className="flex items-center gap-2"><MdVerifiedUser className="text-agri-leaf text-xl" /> Smart Contract Audited</span>
          <span className="hidden sm:inline text-agri-leaf/40">|</span>
          <span className="flex items-center gap-2"><MdGroups className="text-agri-leaf text-xl" /> DAO Governed</span>
          <span className="hidden sm:inline text-agri-leaf/40">|</span>
          <span className="flex items-center gap-2"><MdTrendingUp className="text-agri-leaf text-xl" /> AI Credit Scoring</span>
        </div>
      </section>

      {/* ═══════ ABOUT / MISSION with Farmer Images ═══════ */}
      <section className="py-16 sm:py-20 bg-white dark:bg-agri-dark relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-agri-leaf/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            {/* Image Grid */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-3 sm:space-y-4">
                  <div className="rounded-2xl overflow-hidden shadow-xl">
                    <img src={IMAGES.farmer1} alt="Farmer inspecting crops" className="w-full h-40 sm:h-48 object-cover hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="rounded-2xl overflow-hidden shadow-xl">
                    <img src={IMAGES.greenhouse} alt="Modern greenhouse" className="w-full h-28 sm:h-36 object-cover hover:scale-105 transition-transform duration-500" />
                  </div>
                </div>
                <div className="space-y-3 sm:space-y-4 mt-6 sm:mt-8">
                  <div className="rounded-2xl overflow-hidden shadow-xl">
                    <img src={IMAGES.tech} alt="Smart farming" className="w-full h-28 sm:h-36 object-cover hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="rounded-2xl overflow-hidden shadow-xl">
                    <img src={IMAGES.harvest} alt="Harvest produce" className="w-full h-40 sm:h-48 object-cover hover:scale-105 transition-transform duration-500" />
                  </div>
                </div>
              </div>
              {/* Floating accent card removed */}
            </div>

            {/* Text Content */}
            <div>
              <div className="inline-flex items-center gap-2 bg-agri-leaf/10 rounded-full px-4 py-1.5 mb-5">
                <span className="text-agri-forest dark:text-agri-leaf text-xs font-bold tracking-wider uppercase">About AgriFinance</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white mb-4 leading-tight">
                Growing More with{' '}
                <span className="bg-gradient-to-r from-agri-forest to-agri-leaf bg-clip-text text-transparent">Every Decision</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-5 leading-relaxed text-sm sm:text-base">
                AgriFinance gives you the intelligence to make choices that improve yields and protect your land.
                We bring powerful agritech directly to your fingertips — no complexity, just impact.
              </p>
              <div className="space-y-2.5 mb-6">
                {['Zero-collateral DeFi loans for farmers', 'AI-powered credit scoring from yield data', 'Full blockchain supply chain transparency', 'NFT-based land ownership verification'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-agri-leaf/15 flex items-center justify-center flex-shrink-0">
                      <MdCheckCircle className="text-agri-leaf text-sm" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-agri-forest to-agri-green text-white font-semibold py-3 px-7 rounded-full text-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
              >
                Learn More <MdArrowForward />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section className="py-16 sm:py-20 hero-section relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-agri-leaf/8 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-agri-forest/5 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-agri-leaf/10 dark:bg-agri-leaf/5 rounded-full px-4 py-1.5 mb-4">
              <span className="text-agri-forest dark:text-agri-leaf text-xs font-bold tracking-wider uppercase">Core Features</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
              Where Innovation Meets{' '}
              <span className="bg-gradient-to-r from-agri-forest to-agri-leaf bg-clip-text text-transparent">Cultivation</span>
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
              We deliver cutting-edge solutions designed to fit into your daily farming routine.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: MdAttachMoney, title: 'Zero Collateral DeFi', desc: 'Access instant blockchain loans without traditional collateral', link: '/farmer', gradient: 'from-agri-forest to-agri-leaf' },
              { icon: MdInventory, title: 'Supply Chain Tracking', desc: 'Track produce from farm to market with full transparency', link: '/supply-chain', gradient: 'from-blue-500 to-blue-600' },
              { icon: MdSmartToy, title: 'AI Credit Scoring', desc: 'Fair assessments based on yield, sales, and weather data', link: '/credit-scoring', gradient: 'from-purple-500 to-purple-600' },
              { icon: MdDescription, title: 'NFT Land Ownership', desc: 'Verify land ownership and boost creditworthiness', link: '/nft-marketplace', gradient: 'from-amber-500 to-orange-500' },
            ].map((f, i) => (
              <Link key={i} to={f.link} className="group glass-card p-5 hover:shadow-glass-lg hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-agri-leaf/5 rounded-full blur-2xl translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform duration-500"></div>
                <div className={`bg-gradient-to-br ${f.gradient} rounded-2xl p-3 w-12 h-12 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                  <f.icon className="text-white text-xl" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm group-hover:text-agri-forest dark:group-hover:text-agri-leaf transition-colors">{f.title}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">{f.desc}</p>
                <span className="text-agri-forest dark:text-agri-leaf text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                  Explore <MdArrowForward className="text-sm" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ BIG IMAGE + CTA ═══════ */}
      <section className="relative py-0 overflow-hidden">
        <div className="relative h-[400px] sm:h-[500px]">
          <img src={IMAGES.drone} alt="Agricultural drone technology" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-agri-dark/90 via-agri-dark/60 to-transparent"></div>
          <div className="relative z-10 flex items-center h-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center w-full">
              <div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-4 leading-tight">
                  Revolutionizing Farming,<br />
                  <span className="text-agri-leaf">One Field at a Time</span>
                </h2>
                <p className="text-gray-300 mb-6 leading-relaxed text-sm sm:text-base">
                  AgriFinance brings powerful agritech directly to your fingertips — 
                  no complexity, just impact. From zero-collateral loans to AI-powered insights.
                </p>
                <Link
                  to={user ? '/farmer' : '/signup'}
                  className="inline-flex items-center gap-2 bg-white text-agri-forest font-bold py-3 px-7 rounded-full text-sm hover:bg-agri-cream transition-all duration-300 shadow-xl hover:-translate-y-0.5"
                >
                  Start Now <MdArrowForward />
                </Link>
              </div>
              <div className="hidden lg:block">
                <div className="glass-card bg-white/10 backdrop-blur-lg border border-white/15 p-5 rounded-2xl">
                  <h3 className="text-white font-bold text-lg mb-2">Let Your Farm Think Ahead</h3>
                  <p className="text-gray-300 text-sm mb-4">From sunrise to harvest, our tools support every decision you make in the field.</p>
                  <div className="space-y-2.5">
                    {['Smart loan applications', 'Real-time crop tracking', 'Automated credit assessment'].map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-200">
                        <MdCheckCircle className="text-agri-leaf flex-shrink-0" /> {t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ ROLES SECTION ═══════ */}
      <section className="py-16 sm:py-20 bg-white dark:bg-agri-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-agri-leaf/10 rounded-full px-4 py-1.5 mb-4">
              <span className="text-agri-forest dark:text-agri-leaf text-xs font-bold tracking-wider uppercase">Choose Your Role</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
              Empowering Farmers with the{' '}
              <span className="bg-gradient-to-r from-agri-forest to-agri-leaf bg-clip-text text-transparent">Science of Growth</span>
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
              We help you farm efficiently, reduce waste, and improve yields through eco-friendly technologies.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                role: 'Farmer', icon: MdAgriculture, image: IMAGES.farmer2,
                desc: 'Apply for loans, track your produce, and manage your land NFTs',
                features: ['Loan Applications', 'Supply Chain Tracking', 'Land NFT Management', 'Credit Score Monitoring'],
                link: '/farmer', gradient: 'from-agri-forest to-agri-leaf'
              },
              {
                role: 'Lender', icon: MdAccountBalance, image: IMAGES.field,
                desc: 'Provide liquidity and earn yields through agricultural lending',
                features: ['Loan Pool Management', 'Risk Assessment', 'Yield Generation', 'Portfolio Analytics'],
                link: '/lender', gradient: 'from-blue-500 to-blue-600'
              },
              {
                role: 'Buyer', icon: MdShoppingCart, image: IMAGES.harvest,
                desc: 'Purchase verified produce with complete traceability',
                features: ['Product Verification', 'Supply Chain Transparency', 'Quality Assurance', 'Direct Farmer Connection'],
                link: '/buyer', gradient: 'from-purple-500 to-purple-600'
              },
            ].map((r, i) => (
              <Link key={i} to={r.link} className="group glass-card overflow-hidden hover:shadow-glass-lg hover:-translate-y-2 transition-all duration-300">
                <div className="relative h-40 overflow-hidden">
                  <img src={r.image} alt={r.role} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <div className="absolute bottom-3 left-4 flex items-center gap-2">
                    <div className={`bg-gradient-to-br ${r.gradient} rounded-xl p-2`}>
                      <r.icon className="text-white text-lg" />
                    </div>
                    <span className="text-white font-bold text-lg">{r.role}</span>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">{r.desc}</p>
                  <ul className="space-y-2 mb-4">
                    {r.features.map((f, fi) => (
                      <li key={fi} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="w-5 h-5 rounded-full bg-agri-leaf/15 flex items-center justify-center flex-shrink-0">
                          <MdCheckCircle className="text-agri-leaf text-xs" />
                        </span>
                        <span className="font-medium">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="text-agri-forest dark:text-agri-leaf text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                    Get Started <MdArrowForward />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats and Testimonials sections removed */}

      {/* ═══════ CTA SECTION ═══════ */}
      <section className="relative py-16 sm:py-20 overflow-hidden">
        <div className="absolute inset-0 premium-gradient"></div>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-agri-leaf/15 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-agri-mint/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-4">
            Ready to Transform Your Farming?
          </h2>
          <p className="text-agri-light/70 mb-7 max-w-2xl mx-auto leading-relaxed text-sm sm:text-base">
            Join thousands of farmers, lenders, and buyers already using AgriFinance
            to build a more transparent and inclusive agricultural ecosystem.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={user ? '/farmer' : '/signup'}
              className="group bg-white text-agri-forest px-8 py-3.5 rounded-full font-bold text-sm hover:bg-agri-cream transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <MdAgriculture className="text-lg group-hover:scale-110 transition-transform" />
              Start Your Journey
            </Link>
            <Link
              to="/docs"
              className="group bg-agri-leaf/20 text-white border border-agri-leaf/40 px-8 py-3.5 rounded-full font-bold text-sm hover:bg-agri-leaf/30 transition-all duration-300 backdrop-blur-sm flex items-center justify-center gap-2"
            >
              Explore Platform
              <MdArrowForward className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-agri-dark dark:bg-black/50 text-white pt-14 pb-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-agri-forest to-agri-leaf rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-white text-lg">🌾</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-agri-mint to-agri-light bg-clip-text text-transparent">
                  AgriFinance
                </span>
              </div>
              <p className="text-agri-light/40 text-sm leading-relaxed mb-4">
                Transforming Agriculture Through Blockchain Technology & DeFi Innovation.
              </p>
              <div className="flex gap-3">
                {['Twitter', 'GitHub', 'Discord'].map(s => (
                  <a key={s} href="#" className="w-9 h-9 rounded-full bg-agri-forest/50 hover:bg-agri-leaf/30 flex items-center justify-center text-agri-light/50 hover:text-agri-leaf transition-all text-xs font-bold">
                    {s.charAt(0)}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-agri-mint mb-3 uppercase tracking-wider">Platform</h4>
              <div className="space-y-2.5">
                <Link to="/farmer" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">Farmer Dashboard</Link>
                <Link to="/lender" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">Lender Dashboard</Link>
                <Link to="/buyer" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">Buyer Dashboard</Link>
                <Link to="/services" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">All Services</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-agri-mint mb-3 uppercase tracking-wider">Features</h4>
              <div className="space-y-2.5">
                <Link to="/supply-chain" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">Supply Chain</Link>
                <Link to="/nft-marketplace" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">NFT Marketplace</Link>
                <Link to="/marketplace" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">Marketplace</Link>
                <Link to="/dao" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">DAO Governance</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-agri-mint mb-3 uppercase tracking-wider">Resources</h4>
              <div className="space-y-2.5">
                <Link to="/docs" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">Documentation</Link>
                <Link to="/credit-scoring" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">Credit Scoring</Link>
                <Link to="/track-product" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">Track Products</Link>
                <Link to="/smart-tools" className="block text-agri-light/40 hover:text-agri-leaf transition-colors text-sm">Smart Tools</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-agri-forest/20 pt-6 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-agri-light/30 text-xs mb-3 sm:mb-0">
              © 2024 AgriFinance. Built on blockchain for a sustainable future.
            </p>
            <div className="flex items-center space-x-4">
              <span className="text-agri-light/30 text-xs">Powered by</span>
              <span className="text-agri-leaf text-xs font-bold">Ethereum</span>
              <span className="text-agri-light/15">•</span>
              <span className="text-agri-leaf text-xs font-bold">DeFi</span>
              <span className="text-agri-light/15">•</span>
              <span className="text-agri-leaf text-xs font-bold">AI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
