"""
CHH Compliance Intelligence Center — FastAPI Backend
=====================================================
Endpoints  : Auth, Regulatory Items, Manual Scrape, Manual Digest
Scheduler  : APScheduler – daily scrape (06:00) + weekly digest (Mon 08:00)
Email      : SendGrid
Database   : SQLite (swap DB_URL in .env for PostgreSQL on Render/Railway)
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import logging, os

from auth import create_access_token, verify_token
from scraper import NaicomScraper
from email_sender import send_weekly_digest, send_critical_alerts
from database import get_all_items, get_gaps, get_stats, get_scrape_logs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Scheduler ────────────────────────────────────────────────────────────────
scheduler = BackgroundScheduler(timezone="Africa/Lagos")

def daily_job():
    logger.info("▶ Daily scrape triggered by scheduler")
    scraper = NaicomScraper()
    result = scraper.run()
    if result["new_items"] > 0:
        critical = [i for i in result["new_items_list"] if i.urgency == "critical"]
        if critical:
            send_critical_alerts(critical)
    logger.info(f"Daily job done. New items: {result['new_items']}")

def weekly_job():
    logger.info("▶ Weekly digest triggered by scheduler")
    daily_job()
    send_weekly_digest()
    logger.info("Weekly digest job done.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Daily scrape at 06:00 WAT
    scheduler.add_job(daily_job,  CronTrigger(hour=6,  minute=0, timezone="Africa/Lagos"), id="daily_scrape")
    # Weekly digest every Monday at 08:00 WAT
    scheduler.add_job(weekly_job, CronTrigger(day_of_week="mon", hour=8, minute=0, timezone="Africa/Lagos"), id="weekly_digest")
    scheduler.start()
    logger.info("✓ Scheduler started (daily 06:00, weekly Mon 08:00 WAT)")
    yield
    scheduler.shutdown()

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CHH Compliance Intelligence Center",
    description="NAICOM Regulatory Monitoring API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return payload

# ── Auth ──────────────────────────────────────────────────────────────────────
USERS = {
    os.getenv("ADMIN_USERNAME", "admin"): os.getenv("ADMIN_PASSWORD", "chh2025!")
}

@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    password = USERS.get(form.username)
    if not password or password != form.password:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    token = create_access_token({"sub": form.username})
    return {"access_token": token, "token_type": "bearer", "username": form.username}

@app.get("/auth/me")
def me(user=Depends(get_current_user)):
    return {"username": user["sub"], "role": "admin"}

# ── Dashboard Data ────────────────────────────────────────────────────────────
@app.get("/api/items")
def list_items(category: str = None, urgency: str = None, user=Depends(get_current_user)):
    items = get_all_items(category=category, urgency=urgency)
    return {"items": items, "total": len(items)}

@app.get("/api/gaps")
def list_gaps(user=Depends(get_current_user)):
    gaps = get_gaps()
    return {"gaps": gaps, "total": len(gaps)}

@app.get("/api/stats")
def stats(user=Depends(get_current_user)):
    return get_stats()

@app.get("/api/logs")
def logs(limit: int = 10, user=Depends(get_current_user)):
    return {"logs": get_scrape_logs(limit)}

# ── Manual Triggers ────────────────────────────────────────────────────────────
@app.post("/api/scrape")
def trigger_scrape(user=Depends(get_current_user)):
    logger.info(f"Manual scrape triggered by {user['sub']}")
    scraper = NaicomScraper()
    result = scraper.run()
    return {
        "status": "success",
        "new_items": result["new_items"],
        "total_found": result["total_found"],
        "errors": result["errors"]
    }

@app.post("/api/digest")
def trigger_digest(user=Depends(get_current_user)):
    logger.info(f"Manual digest triggered by {user['sub']}")
    send_weekly_digest()
    return {"status": "success", "message": "Digest dispatched to all department recipients."}

@app.get("/health")
def health():
    return {"status": "healthy", "service": "CHH Compliance Intelligence Center"}
