from __future__ import annotations

import hmac
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from beta_access import BetaAccessStore, BetaSession
from beta_insights import BetaInsightsStore
from client_report_adapter import ClientReportRepository


BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
PROJECT_ROOT = Path(os.environ.get("AI_STOCK_ROOT", BASE_DIR.parent)).resolve()
REQUIRE_INVITE = os.environ.get("AI_STOCK_BETA_REQUIRE_INVITE", "0") == "1"
SECURE_COOKIE = os.environ.get("AI_STOCK_WEB_SECURE_COOKIE", "0") == "1"
BETA_DATABASE_PATH = Path(
    os.environ.get(
        "AI_STOCK_BETA_DB_PATH",
        PROJECT_ROOT / "database" / "web_beta" / "beta-access.sqlite3",
    )
).resolve()
ADMIN_TOKEN = os.environ.get("AI_STOCK_BETA_ADMIN_TOKEN", "").strip()

app = FastAPI(
    title="AI 股票健康 Beta API",
    version="1.5.0",
    description="將 AI Stock Terminal 客戶版報告安全提供給 PWA。",
)
reports = ClientReportRepository(project_root=PROJECT_ROOT, sample_dir=BASE_DIR / "sample_reports")
beta_access = BetaAccessStore(BETA_DATABASE_PATH)
beta_insights = BetaInsightsStore(BETA_DATABASE_PATH)
activation_attempts: dict[str, list[float]] = {}


class InviteActivation(BaseModel):
    invite_code: str = Field(min_length=5, max_length=64)


class InviteBootstrap(BaseModel):
    count: int = Field(default=20, ge=1, le=100)

class BetaEventPayload(BaseModel):
    event_name: str = Field(min_length=3, max_length=64)
    page: str | None = Field(default=None, max_length=32)
    stock_id: str | None = Field(default=None, max_length=4)
    mode: str | None = Field(default=None, max_length=16)


class BetaFeedbackPayload(BaseModel):
    category: str = Field(min_length=2, max_length=32)
    rating: int | None = Field(default=None, ge=1, le=5)
    message: str = Field(min_length=2, max_length=1200)
    page: str | None = Field(default=None, max_length=32)
    stock_id: str | None = Field(default=None, max_length=4)


def current_beta_session(request: Request) -> BetaSession | None:
    if not REQUIRE_INVITE:
        return BetaSession(tester_code="LOCAL-OWNER", expires_at=0)
    return beta_access.validate(request.cookies.get(BetaAccessStore.COOKIE_NAME))


def require_beta_session(request: Request) -> BetaSession:
    session = current_beta_session(request)
    if session is None:
        raise HTTPException(status_code=401, detail="請先使用 Beta 邀請碼登入")
    return session


def check_activation_rate(request: Request) -> None:
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    recent = [stamp for stamp in activation_attempts.get(key, []) if now - stamp < 300]
    if len(recent) >= 8:
        raise HTTPException(status_code=429, detail="嘗試次數過多，請稍後再試")
    recent.append(now)
    activation_attempts[key] = recent


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "healthy",
        "service": "ai-stock-web-beta",
        "version": app.version,
    }


@app.get("/api/beta/session")
def beta_session(request: Request) -> dict:
    session = current_beta_session(request)
    return {
        "status": "success",
        "invite_required": REQUIRE_INVITE,
        "authorized": session is not None,
        "tester_code": session.tester_code if session else None,
    }


@app.post("/api/admin/bootstrap-invites")
def bootstrap_invites(payload: InviteBootstrap, request: Request) -> dict:
    """Create production invites without committing plaintext secrets."""
    supplied = request.headers.get("X-Admin-Token", "")
    if not ADMIN_TOKEN or not hmac.compare_digest(supplied, ADMIN_TOKEN):
        raise HTTPException(status_code=404, detail="Not found")
    status = beta_access.status()
    if status["total"]:
        raise HTTPException(status_code=409, detail="正式邀請碼已建立，拒絕重複初始化")
    invites = beta_access.create_invites(payload.count)
    return {"status": "success", "count": len(invites), "invites": invites}


@app.post("/api/beta/activate")
def activate_beta(payload: InviteActivation, request: Request, response: Response) -> dict:
    check_activation_rate(request)
    activated = beta_access.activate(payload.invite_code)
    if activated is None:
        raise HTTPException(status_code=401, detail="邀請碼無效或已停用")
    token, session = activated
    response.set_cookie(
        BetaAccessStore.COOKIE_NAME,
        token,
        max_age=BetaAccessStore.SESSION_DAYS * 86400,
        httponly=True,
        secure=SECURE_COOKIE,
        samesite="lax",
        path="/",
    )
    return {"status": "success", "tester_code": session.tester_code}


@app.post("/api/beta/logout")
def logout_beta(request: Request, response: Response) -> dict:
    beta_access.logout(request.cookies.get(BetaAccessStore.COOKIE_NAME))
    response.delete_cookie(BetaAccessStore.COOKIE_NAME, path="/")
    return {"status": "success"}


@app.post("/api/beta/events")
def record_beta_event(payload: BetaEventPayload, request: Request) -> dict:
    session = require_beta_session(request)
    try:
        beta_insights.record_event(
            tester_code=session.tester_code,
            event_name=payload.event_name,
            page=payload.page,
            stock_id=payload.stock_id,
            mode=payload.mode,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"status": "success"}


@app.post("/api/beta/feedback")
def record_beta_feedback(payload: BetaFeedbackPayload, request: Request) -> dict:
    session = require_beta_session(request)
    try:
        feedback_id = beta_insights.record_feedback(
            tester_code=session.tester_code,
            category=payload.category,
            rating=payload.rating,
            message=payload.message,
            page=payload.page,
            stock_id=payload.stock_id,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"status": "success", "feedback_id": feedback_id}


@app.get("/api/admin/beta/summary")
def beta_admin_summary(request: Request, days: int = 7) -> dict:
    supplied = request.headers.get("X-Admin-Token", "")
    if not ADMIN_TOKEN or not hmac.compare_digest(supplied, ADMIN_TOKEN):
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "status": "success",
        "access": beta_access.status(),
        "insights": beta_insights.summary(days),
    }

@app.get("/api/stocks")
def available_stocks(request: Request) -> dict:
    require_beta_session(request)
    stocks = reports.available_stocks()
    sectors = sorted({str(item.get("industry") or "產業資料待補") for item in stocks})
    return {
        "status": "success",
        "counts": {"stocks": len(stocks), "sectors": len(sectors)},
        "sectors": sectors,
        "stocks": stocks,
    }


@app.get("/api/stocks/{stock_id}")
def stock_report(stock_id: str, request: Request) -> dict:
    require_beta_session(request)
    if not stock_id.isdigit() or len(stock_id) != 4:
        raise HTTPException(status_code=400, detail="請輸入四位數台股代號")
    report = reports.load(stock_id)
    if report is None:
        raise HTTPException(status_code=404, detail="這檔股票尚未產生客戶版研究報告")
    return {"status": "success", "report": report}


app.mount("/assets", StaticFiles(directory=WEB_DIR), name="assets")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


@app.get("/{path:path}", include_in_schema=False)
def pwa_fallback(path: str) -> FileResponse:
    candidate = (WEB_DIR / path).resolve()
    if WEB_DIR in candidate.parents and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(WEB_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host=os.environ.get("AI_STOCK_WEB_HOST", "127.0.0.1"),
        port=int(os.environ.get("AI_STOCK_WEB_PORT", "8765")),
        reload=False,
    )
