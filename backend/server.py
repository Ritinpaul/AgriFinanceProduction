from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
from dotenv import load_dotenv
import uuid

load_dotenv()

app = FastAPI(title="AgriFinance API", version="1.0.0")

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://agrifinance.com",
    "https://www.agrifinance.com",
    "https://app.agrifinance.com",
]

# Add Emergent domains dynamically
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)
JWT_SECRET = os.environ.get("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "agrifinance")

client: AsyncIOMotorClient = None
db = None

@app.on_event("startup")
async def startup_db_client():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.wallet_accounts.create_index([("user_id", 1), ("wallet_type", 1)])
    print(f"✅ Connected to MongoDB: {DB_NAME}")

@app.on_event("shutdown")
async def shutdown_db_client():
    global client
    if client:
        client.close()

# Helper functions
def create_token(user_id: str, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode = {
        "userId": user_id,
        "email": email,
        "role": role,
        "exp": expire
    }
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("userId")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return {
            "id": str(user["_id"]),
            "email": user.get("email"),
            "first_name": user.get("first_name"),
            "last_name": user.get("last_name"),
            "role": user.get("role", "farmer"),
            "profile_completed": user.get("profile_completed", False)
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == "_id":
                result["id"] = str(value)
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = serialize_doc(value)
            else:
                result[key] = value
        return result
    return doc

# Pydantic models
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: str = "farmer"

class SignInRequest(BaseModel):
    email: EmailStr
    password: str

class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None

class WalletSync(BaseModel):
    address: str
    wallet_type: str = "agrifinance"
    balance_wei: Optional[str] = "0"

# Routes
@app.get("/api/health")
async def health_check():
    return {
        "status": "OK",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }

@app.post("/api/auth/signup")
async def signup(request: SignUpRequest):
    # Check if user exists
    existing = await db.users.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Hash password and create user
    hashed_password = get_password_hash(request.password)
    
    user_doc = {
        "email": request.email,
        "password_hash": hashed_password,
        "first_name": request.first_name,
        "last_name": request.last_name,
        "phone": request.phone,
        "role": request.role,
        "profile_completed": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    token = create_token(user_id, request.email, request.role)
    
    return {
        "success": True,
        "user": {
            "id": user_id,
            "email": request.email,
            "first_name": request.first_name,
            "last_name": request.last_name,
            "role": request.role,
            "profile_completed": True
        },
        "token": token
    }

@app.post("/api/auth/signin")
async def signin(request: SignInRequest):
    user = await db.users.find_one({"email": request.email})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    if not verify_password(request.password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    token = create_token(user_id, user["email"], user.get("role", "farmer"))
    
    return {
        "success": True,
        "user": {
            "id": user_id,
            "email": user["email"],
            "first_name": user.get("first_name"),
            "last_name": user.get("last_name"),
            "role": user.get("role", "farmer"),
            "profile_completed": user.get("profile_completed", False)
        },
        "token": token
    }

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

@app.post("/api/auth/signout")
async def signout():
    return {"success": True, "message": "Signed out successfully"}

@app.get("/api/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

@app.put("/api/profile")
async def update_profile(request: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if request.first_name:
        update_data["first_name"] = request.first_name
    if request.last_name:
        update_data["last_name"] = request.last_name
    if request.phone:
        update_data["phone"] = request.phone
    
    if update_data:
        await db.users.update_one(
            {"_id": ObjectId(current_user["id"])},
            {"$set": update_data}
        )
    
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    return {"user": serialize_doc(user)}

# Wallet endpoints
@app.post("/api/wallet/sync")
async def sync_wallet(request: WalletSync, current_user: dict = Depends(get_current_user)):
    wallet = await db.wallet_accounts.find_one({
        "user_id": current_user["id"],
        "wallet_type": request.wallet_type
    })
    
    if wallet:
        await db.wallet_accounts.update_one(
            {"_id": wallet["_id"]},
            {"$set": {"address": request.address, "balance_wei": request.balance_wei, "updated_at": datetime.now(timezone.utc)}}
        )
    else:
        await db.wallet_accounts.insert_one({
            "user_id": current_user["id"],
            "address": request.address,
            "wallet_type": request.wallet_type,
            "balance_wei": request.balance_wei,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        })
    
    wallet = await db.wallet_accounts.find_one({
        "user_id": current_user["id"],
        "wallet_type": request.wallet_type
    })
    
    return {"success": True, "wallet": serialize_doc(wallet)}

@app.get("/api/wallet")
async def get_wallet(current_user: dict = Depends(get_current_user)):
    wallet = await db.wallet_accounts.find_one({
        "user_id": current_user["id"],
        "wallet_type": "agrifinance"
    })
    
    if not wallet:
        return {"wallet": None}
    
    return {"wallet": serialize_doc(wallet)}

@app.get("/api/wallet/transactions")
async def get_transactions(current_user: dict = Depends(get_current_user)):
    transactions = await db.transactions.find({
        "$or": [
            {"from_user_id": current_user["id"]},
            {"to_user_id": current_user["id"]}
        ]
    }).sort("created_at", -1).limit(50).to_list(50)
    
    return {"transactions": serialize_doc(transactions)}

# Farmer endpoints
@app.get("/api/farmer/profile")
async def get_farmer_profile(current_user: dict = Depends(get_current_user)):
    profile = await db.farmer_profiles.find_one({"user_id": current_user["id"]})
    if not profile:
        return {"profile": None}
    return {"profile": serialize_doc(profile)}

@app.put("/api/farmer/profile")
async def update_farmer_profile(request: dict, current_user: dict = Depends(get_current_user)):
    await db.farmer_profiles.update_one(
        {"user_id": current_user["id"]},
        {"$set": {**request, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    profile = await db.farmer_profiles.find_one({"user_id": current_user["id"]})
    return {"profile": serialize_doc(profile)}

@app.get("/api/farmer/stats")
async def get_farmer_stats(current_user: dict = Depends(get_current_user)):
    loans_count = await db.loans.count_documents({"borrower_id": current_user["id"]})
    batches_count = await db.supply_chain_batches.count_documents({"farmer_id": current_user["id"]})
    
    return {
        "stats": {
            "total_loans": loans_count,
            "total_batches": batches_count,
            "credit_score": 0
        }
    }

@app.get("/api/farmer/loans")
async def get_farmer_loans(current_user: dict = Depends(get_current_user)):
    loans = await db.loans.find({"borrower_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    return {"loans": serialize_doc(loans)}

@app.get("/api/farmer/batches")
async def get_farmer_batches(current_user: dict = Depends(get_current_user)):
    batches = await db.supply_chain_batches.find({"farmer_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    return {"batches": serialize_doc(batches)}

@app.post("/api/farmer/batches")
async def create_farmer_batch(request: dict, current_user: dict = Depends(get_current_user)):
    batch_doc = {
        **request,
        "farmer_id": current_user["id"],
        "status": "created",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.supply_chain_batches.insert_one(batch_doc)
    batch = await db.supply_chain_batches.find_one({"_id": result.inserted_id})
    return {"batch": serialize_doc(batch)}

# Credit score endpoints
@app.get("/api/credit/score")
async def get_credit_score(current_user: dict = Depends(get_current_user)):
    score_doc = await db.credit_scores.find_one({"user_id": current_user["id"]})
    if not score_doc:
        # Create default score
        await db.credit_scores.insert_one({
            "user_id": current_user["id"],
            "score": 300,
            "last_updated": datetime.now(timezone.utc)
        })
        return {"userId": current_user["id"], "score": 300}
    
    return {"userId": current_user["id"], "score": score_doc.get("score", 0)}

@app.get("/api/credit/score/cached")
async def get_credit_score_cached(current_user: dict = Depends(get_current_user)):
    score_doc = await db.credit_scores.find_one({"user_id": current_user["id"]})
    if score_doc:
        return {
            "userId": current_user["id"],
            "score": score_doc.get("score"),
            "cached": True,
            "lastUpdated": score_doc.get("last_updated")
        }
    return {"userId": current_user["id"], "score": None, "cached": True}

@app.post("/api/credit/score/recompute")
async def recompute_credit_score(current_user: dict = Depends(get_current_user)):
    # Simple score computation
    docs_count = await db.documents.count_documents({"owner_id": current_user["id"]})
    loans_count = await db.loans.count_documents({"borrower_id": current_user["id"], "status": "repaid"})
    
    score = min(300 + (docs_count * 10) + (loans_count * 50), 850)
    
    await db.credit_scores.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"score": score, "last_updated": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    return {"userId": current_user["id"], "score": score, "updated": True}

@app.get("/api/credit/policy")
async def get_credit_policy():
    return {
        "minScore": 300,
        "approvalsThreshold": 2
    }

# Liquidity pool endpoints
@app.get("/api/liquidity/pool")
async def get_liquidity_pool(current_user: dict = Depends(get_current_user)):
    pool = await db.liquidity_pools.find_one({"symbol": "KRSI"})
    if not pool:
        pool = {
            "symbol": "KRSI",
            "total_deposits_wei": "0",
            "total_borrows_wei": "0",
            "apy_bps": 800
        }
        await db.liquidity_pools.insert_one(pool)
        pool = await db.liquidity_pools.find_one({"symbol": "KRSI"})
    
    return {"pool": serialize_doc(pool)}

# DAO endpoints
@app.get("/api/dao/proposals")
async def get_dao_proposals(current_user: dict = Depends(get_current_user)):
    proposals = await db.governance_proposals.find().sort("created_at", -1).to_list(100)
    return {"proposals": serialize_doc(proposals)}

@app.post("/api/dao/proposals")
async def create_dao_proposal(request: dict, current_user: dict = Depends(get_current_user)):
    proposal_doc = {
        **request,
        "proposer_id": current_user["id"],
        "status": "active",
        "votes_for": 0,
        "votes_against": 0,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.governance_proposals.insert_one(proposal_doc)
    proposal = await db.governance_proposals.find_one({"_id": result.inserted_id})
    return {"proposal": serialize_doc(proposal)}

@app.post("/api/dao/proposals/{proposal_id}/vote")
async def vote_on_proposal(proposal_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    vote = request.get("vote", "for")
    
    # Check if already voted
    existing_vote = await db.governance_votes.find_one({
        "proposal_id": proposal_id,
        "voter_id": current_user["id"]
    })
    
    if existing_vote:
        raise HTTPException(status_code=400, detail="Already voted on this proposal")
    
    # Record vote
    await db.governance_votes.insert_one({
        "proposal_id": proposal_id,
        "voter_id": current_user["id"],
        "vote": vote,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Update proposal counts
    update_field = "votes_for" if vote == "for" else "votes_against"
    await db.governance_proposals.update_one(
        {"_id": ObjectId(proposal_id)},
        {"$inc": {update_field: 1}}
    )
    
    proposal = await db.governance_proposals.find_one({"_id": ObjectId(proposal_id)})
    return {"proposal": serialize_doc(proposal)}

@app.get("/api/dao/profile")
async def get_dao_profile(current_user: dict = Depends(get_current_user)):
    votes = await db.governance_votes.find({"voter_id": current_user["id"]}).to_list(100)
    proposals = await db.governance_proposals.find({"proposer_id": current_user["id"]}).to_list(100)
    
    return {
        "profile": {
            "total_votes": len(votes),
            "total_proposals": len(proposals),
            "voting_power": 1
        }
    }

@app.get("/api/dao/metrics")
async def get_dao_metrics():
    total_proposals = await db.governance_proposals.count_documents({})
    active_proposals = await db.governance_proposals.count_documents({"status": "active"})
    total_votes = await db.governance_votes.count_documents({})
    
    return {
        "metrics": {
            "total_proposals": total_proposals,
            "active_proposals": active_proposals,
            "total_votes": total_votes
        }
    }

# NFT endpoints
@app.get("/api/nfts")
async def get_nfts(current_user: dict = Depends(get_current_user)):
    nfts = await db.nfts.find({"owner_id": current_user["id"]}).to_list(100)
    return {"nfts": serialize_doc(nfts)}

@app.post("/api/nfts")
async def create_nft(request: dict, current_user: dict = Depends(get_current_user)):
    nft_doc = {
        **request,
        "owner_id": current_user["id"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.nfts.insert_one(nft_doc)
    nft = await db.nfts.find_one({"_id": result.inserted_id})
    return {"nft": serialize_doc(nft)}

# Faucet endpoints (stub)
@app.get("/api/faucet/krsi/status")
async def get_faucet_status(current_user: dict = Depends(get_current_user)):
    return {
        "canClaim": True,
        "nextClaimTime": None,
        "claimAmount": "1000000000"
    }

@app.post("/api/faucet/krsi/claim")
async def claim_faucet(current_user: dict = Depends(get_current_user)):
    return {
        "success": True,
        "amount": "1000000000",
        "message": "Tokens claimed successfully"
    }

# Supply chain endpoints
@app.get("/api/supply-chain")
async def get_supply_chain(current_user: dict = Depends(get_current_user)):
    batches = await db.supply_chain_batches.find().sort("created_at", -1).limit(50).to_list(50)
    return {"batches": serialize_doc(batches)}

@app.post("/api/supply-chain")
async def create_supply_chain_batch(request: dict, current_user: dict = Depends(get_current_user)):
    batch_doc = {
        **request,
        "creator_id": current_user["id"],
        "status": "created",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.supply_chain_batches.insert_one(batch_doc)
    batch = await db.supply_chain_batches.find_one({"_id": result.inserted_id})
    return {"batch": serialize_doc(batch)}

# Loans endpoints
@app.get("/api/loans/active")
async def get_active_loans(current_user: dict = Depends(get_current_user)):
    loans = await db.loans.find({
        "borrower_id": current_user["id"],
        "status": {"$ne": "repaid"}
    }).to_list(100)
    return {"loans": serialize_doc(loans)}

@app.get("/api/loans/repaid")
async def get_repaid_loans(current_user: dict = Depends(get_current_user)):
    loans = await db.loans.find({
        "borrower_id": current_user["id"],
        "status": "repaid"
    }).to_list(100)
    return {"loans": serialize_doc(loans)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
