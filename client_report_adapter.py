from __future__ import annotations

import json
from pathlib import Path
from typing import Any


LABELS = {
    "financial": ("財務健康", "獲利、資產品質與財務穩定度"),
    "technical": ("技術健康", "價格趨勢、動能與波動狀態"),
    "institutional": ("法人籌碼", "三大法人與市場籌碼方向"),
    "market": ("市場環境", "大盤與產業環境"),
    "news": ("新聞情緒", "近期公開消息情緒"),
}

KNOWN_STOCKS = {
    "2330": ("台積電", "半導體業"),
    "2303": ("聯電", "半導體業"),
    "2454": ("聯發科", "半導體業"),
    "3711": ("日月光投控", "半導體業"),
    "2317": ("鴻海", "電子製造業"),
    "3231": ("緯創", "電腦及週邊設備業"),
    "6669": ("緯穎", "電腦及週邊設備業"),
    "2891": ("中信金", "金融保險業"),
    "2881": ("富邦金", "金融保險業"),
    "2603": ("長榮", "航運業"),
    "2609": ("陽明", "航運業"),
    "2618": ("長榮航", "航運業"),
    "1303": ("南亞", "塑膠工業"),
    "6446": ("藥華藥", "生技醫療業"),
}


class ClientReportRepository:
    def __init__(self, project_root: Path, sample_dir: Path | None = None) -> None:
        self.project_root = Path(project_root)
        self.report_root = self.project_root / "database" / "client_reports"
        self.sample_dir = Path(sample_dir) if sample_dir else None

    def _candidate_paths(self, stock_id: str) -> list[Path]:
        paths = [self.report_root / stock_id / "latest.json"]
        if self.sample_dir:
            paths.append(self.sample_dir / f"{stock_id}.json")
        return paths

    def load(self, stock_id: str) -> dict[str, Any] | None:
        for path in self._candidate_paths(stock_id):
            if not path.is_file():
                continue
            try:
                payload = json.loads(path.read_text(encoding="utf-8-sig"))
                normalized = self._normalize(payload, stock_id)
                normalized["source"] = "engine" if self.report_root in path.parents else "beta_sample"
                return normalized
            except (OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError):
                continue
        return None

    def available_stocks(self) -> list[dict[str, str]]:
        ids: set[str] = set()
        if self.report_root.is_dir():
            ids.update(path.parent.name for path in self.report_root.glob("*/latest.json"))
        if self.sample_dir and self.sample_dir.is_dir():
            ids.update(path.stem for path in self.sample_dir.glob("*.json"))
        result = []
        for stock_id in sorted(ids):
            report = self.load(stock_id)
            if report:
                result.append({"id": stock_id, "name": report["name"]})
        return result

    def _normalize(self, payload: dict[str, Any], stock_id: str) -> dict[str, Any]:
        stock = payload.get("stock") or {}
        overview = payload.get("overview") or payload
        known_name, known_industry = KNOWN_STOCKS.get(stock_id, (stock_id, "產業資料待補"))
        raw_indicators = payload.get("health_indicators") or payload.get("indicators") or []
        indicators = self._normalize_indicators(raw_indicators)
        if len(indicators) != 5:
            raise ValueError("client report must provide five health indicators")

        notices = payload.get("notices_zh") or []
        if isinstance(notices, str):
            notices = [notices]
        summary = overview.get("summary_zh") or payload.get("summary_zh") or "目前資料仍在累積，建議持續觀察。"
        explanation = payload.get("score_explanation") or {}
        detailed = payload.get("detailed_score_explanation") or {}
        return {
            "id": str(payload.get("stock_id") or stock.get("stock_id") or stock_id),
            "name": stock.get("name") or payload.get("stock_name") or known_name,
            "industry": stock.get("industry") or known_industry,
            "market": stock.get("market") or payload.get("market") or "TWSE",
            "score": self._number(overview.get("health_score"), 0),
            "score_v1": self._optional_number(overview.get("health_score_v1")),
            "score_v2": self._optional_number(overview.get("health_score_v2")),
            "assessment": overview.get("assessment") or self._level(self._number(overview.get("health_score"), 0)),
            "grade": overview.get("research_grade") or "研究累積中",
            "confidence": self._number(overview.get("confidence_score"), 0),
            "confidence_level": overview.get("confidence_level") or "資料待確認",
            "risk": self._number(overview.get("risk_score"), 0),
            "risk_level": overview.get("risk_level") or "資料待確認",
            "summary": summary,
            "updated": str(payload.get("generated_at") or payload.get("data_as_of") or "—")[:10],
            "strategy": payload.get("strategy") or {},
            "data_status": payload.get("data_status") or {},
            "indicators": indicators,
            "score_interval": overview.get("health_score_interval") or "—",
            "score_method": (
                explanation.get("method_zh")
                or overview.get("score_explanation_zh")
                or "分數依五大面向與資料完整度形成，用於一致比較。"
            ),
            "positive_factors": self._normalize_factors(explanation.get("positive_factors")),
            "negative_factors": self._normalize_factors(explanation.get("negative_factors")),
            "detailed_positive": self._normalize_contributions(detailed.get("top_positive")),
            "detailed_negative": self._normalize_contributions(detailed.get("top_negative")),
            "impact_definition": str(detailed.get("impact_definition_zh") or ""),
            "weight_adjustments": [str(item) for item in detailed.get("weight_adjustments_zh", []) if item],
            "score_history": self._normalize_history(payload.get("score_history")),
            "data_sources": self._normalize_sources(payload.get("data_sources")),
            "today_changes": self._normalize_today_changes(payload.get("today_changes"), stock_id),
            "daily_research": self._normalize_daily_research(payload.get("daily_research")),
            "stock_profile": self._normalize_stock_profile(payload.get("stock_profile"), stock_id),
            "income_profile": json.loads(json.dumps(payload.get("income_profile") or {}, ensure_ascii=False, default=str)),
            "growth_profile": json.loads(json.dumps(payload.get("growth_profile") or {}, ensure_ascii=False, default=str)),
            "cyclical_profile": json.loads(json.dumps(payload.get("cyclical_profile") or {}, ensure_ascii=False, default=str)),
            "event_profile": json.loads(json.dumps(payload.get("event_profile") or {}, ensure_ascii=False, default=str)),
            "material_news": json.loads(json.dumps(payload.get("material_news") or {}, ensure_ascii=False, default=str)),
            "historical_context": json.loads(json.dumps(payload.get("historical_context") or {}, ensure_ascii=False, default=str)),
            "research_notifications": self._normalize_research_notifications(payload.get("research_notifications"), stock_id),
            "market_home_summary": self._normalize_market_home_summary(payload.get("market_home_summary")),
            "upcoming_events": self._normalize_upcoming_events(payload.get("upcoming_events"), stock_id),
            "investment_research": self._normalize_investment_research(payload.get("investment_research")),
            "notices": notices,
            "disclaimer": payload.get("disclaimer_zh") or "本服務僅供資料整理與研究輔助，不構成投資建議。",
        }

    @staticmethod
    def _normalize_daily_research(raw: Any) -> dict[str, Any]:
        if not isinstance(raw, dict):
            return {
                "version": "DailyResearch-v1.1", "mode": "guided", "steps": [],
                "available_step_count": 0, "estimated_minutes": 0,
                "score_policy": {"affects_health_score": False, "mode": "navigation_only"},
            }
        detached = json.loads(json.dumps(raw, ensure_ascii=False, default=str))
        detached["steps"] = [
            item for item in detached.get("steps", [])
            if isinstance(item, dict) and item.get("key") in {"new", "change", "follow_up", "evidence"}
        ]
        return detached

    @staticmethod
    def _normalize_stock_profile(raw: Any, stock_id: str) -> dict[str, Any]:
        if not isinstance(raw, dict):
            return {
                "version": "StockProfile-v1.0",
                "stock_id": str(stock_id),
                "sector": "unknown",
                "sector_label_zh": "待確認",
                "profile_id": "default",
                "label_zh": "待確認",
                "comparison_group_zh": "一般股票",
                "classification_confidence": "low",
                "score_policy": {
                    "affects_health_score": False,
                    "mode": "comparison_only",
                },
            }
        return json.loads(json.dumps(raw, ensure_ascii=False, default=str))

    @staticmethod
    def _normalize_research_notifications(raw: Any, stock_id: str) -> dict[str, Any]:
        if not isinstance(raw, dict):
            return {
                "version": "ResearchNotifications-v1.0", "status": "empty",
                "stock_id": str(stock_id), "notifications": [], "notification_count": 0,
                "score_policy": {"affects_health_score": False, "mode": "attention_only"},
            }
        detached = json.loads(json.dumps(raw, ensure_ascii=False, default=str))
        detached["notifications"] = [
            item for item in detached.get("notifications", [])
            if isinstance(item, dict) and item.get("affects_health_score") is False
        ]
        detached["notification_count"] = len(detached["notifications"])
        return detached

    @staticmethod
    def _normalize_market_home_summary(raw: Any) -> dict[str, Any]:
        """Pass through only the engine-owned market homepage contract."""
        if not isinstance(raw, dict):
            return {
                "version": "MarketHomeSummary-v1.0", "status": "unavailable",
                "headline_zh": "市場資料尚未接入",
                "summary_zh": "目前沒有可供首頁使用的官方大盤資料，不顯示推測數字。",
                "history": [],
            }
        return json.loads(json.dumps(raw, ensure_ascii=False, default=str))

    @staticmethod
    def _normalize_upcoming_events(raw: Any, stock_id: str) -> dict[str, Any]:
        """Pass through only verified, engine-owned future event rows."""
        if not isinstance(raw, dict):
            return {
                "version": "UpcomingEvents-v1.0", "status": "unavailable",
                "stock_id": str(stock_id), "events": [], "event_count": 0,
                "message_zh": "官方預定事件資料尚未建立，不顯示推測日期。",
                "score_policy": {"affects_health_score": False, "mode": "context_only"},
            }
        detached = json.loads(json.dumps(raw, ensure_ascii=False, default=str))
        detached["events"] = [
            item for item in detached.get("events", [])
            if isinstance(item, dict)
            and item.get("verified") is True
            and item.get("affects_health_score") is False
        ]
        detached["event_count"] = len(detached["events"])
        return detached

    @staticmethod
    def _normalize_investment_research(raw: Any) -> dict[str, Any]:
        """Pass through the engine-owned, customer-safe research contract."""
        if not isinstance(raw, dict):
            return {
                "status": "limited",
                "company_profile": {"status": "limited"},
                "valuation": {"status": "unavailable", "metrics": []},
                "comparisons": {"mode": "shadow"},
                "research_fit": {"lenses": [], "follow_up_items_zh": []},
            }
        # JSON round-trip makes a detached copy and only permits web-safe data.
        return json.loads(json.dumps(raw, ensure_ascii=False, default=str))

    def _normalize_today_changes(self, raw: Any, stock_id: str) -> dict[str, Any]:
        block = raw if isinstance(raw, dict) else {}
        events = []
        raw_events = block.get("events") if isinstance(block.get("events"), list) else []
        if not raw_events and isinstance(block.get("factor_events"), list):
            raw_events = block.get("factor_events")
        for item in raw_events:
            if not isinstance(item, dict):
                continue
            questions = item.get("six_questions") if isinstance(item.get("six_questions"), dict) else {}
            source_time = str(item.get("source_time") or "")[:10]
            source_url = str(item.get("source_url") or "").strip()
            official_url = self._official_source_url(str(item.get("category") or ""), stock_id, source_time)
            # Old engine reports used generic TWSE landing pages.  Replace them
            # with a dated query so the link cannot inherit a wrong industry.
            if official_url:
                source_url = official_url
            events.append({
                "id": str(item.get("event_id") or ""),
                "type": str(item.get("event_type") or "score_driver"),
                "status": str(item.get("status") or "current"),
                "category": str(item.get("category") or ""),
                "title": str(item.get("title_zh") or "重要變化"),
                "direction": str(item.get("direction") or "neutral"),
                "current_value": self._optional_number(item.get("current_value")),
                "current_unit": str(item.get("current_unit") or ""),
                "baseline_value": self._optional_number(item.get("baseline_value")),
                "baseline_label": str(item.get("baseline_label_zh") or "比較基準"),
                "comparison_window": str(item.get("comparison_window") or ""),
                "impact": self._number(item.get("score_impact"), 0),
                "reason": str(item.get("reason_zh") or ""),
                "source": str(item.get("source") or "公開資料"),
                "source_time": source_time,
                "source_url": source_url,
                "source_link_available": bool(source_url),
                "confidence": str(item.get("confidence") or "medium"),
                "what_happened": str(questions.get("what_happened_zh") or item.get("what_happened_zh") or item.get("reason_zh") or ""),
                "current_value_zh": str(questions.get("current_value_zh") or ""),
                "baseline_value_zh": str(questions.get("baseline_value_zh") or ""),
                "meaning": str(questions.get("meaning_zh") or item.get("metric_explanation_zh") or "此項資料用來觀察公司的最新變化。"),
                "score_reason": str(questions.get("score_reason_zh") or item.get("score_reason_zh") or item.get("reason_zh") or ""),
            })
        groups = []
        for group in block.get("event_groups", []) if isinstance(block.get("event_groups"), list) else []:
            if not isinstance(group, dict):
                continue
            wanted = {str(item.get("event_id") or "") for item in group.get("events", []) if isinstance(item, dict)}
            group_events = [item for item in events if item["id"] in wanted] if wanted else []
            groups.append({
                "category": str(group.get("category") or "other"),
                "label": str(group.get("category_zh") or "其他研究資料"),
                "direction": str(group.get("direction") or "neutral"),
                "event_count": int(group.get("event_count") or len(group_events)),
                "positive_count": int(group.get("positive_count") or 0),
                "negative_count": int(group.get("negative_count") or 0),
                "positive_impact": self._number(group.get("positive_impact"), 0),
                "negative_impact": self._number(group.get("negative_impact"), 0),
                "net_impact": self._number(group.get("net_impact"), 0),
                "headline": str(group.get("headline_zh") or "同類因子彙整"),
                "summary": str(group.get("summary_zh") or ""),
                "events": group_events,
            })
        return {
            "version": str(block.get("version") or ""),
            "summary": str(block.get("summary_zh") or "今日尚無足夠的可量化事件。"),
            "comparison_available": bool(block.get("comparison_available")),
            "comparison_date": block.get("comparison_date"),
            "data_date": block.get("data_date"),
            "events": events,
            "event_groups": groups,
            "event_group_overview": {
                "title": str((block.get("event_group_overview") or {}).get("title_zh") or "總分變化總覽"),
                "event_count": int((block.get("event_group_overview") or {}).get("event_count") or len(events)),
                "positive_impact": self._number((block.get("event_group_overview") or {}).get("positive_impact"), 0),
                "negative_impact": self._number((block.get("event_group_overview") or {}).get("negative_impact"), 0),
                "net_impact": self._number((block.get("event_group_overview") or {}).get("net_impact"), 0),
                "direction": str((block.get("event_group_overview") or {}).get("direction") or "neutral"),
                "summary": str((block.get("event_group_overview") or {}).get("summary_zh") or ""),
            },
        }

    @staticmethod
    def _official_source_url(category: str, stock_id: str, source_date: str) -> str:
        company_root = "https://wwwc.twse.com.tw/IIH2/zh/company"
        if category == "technical":
            return f"{company_root}/stock.html?code={stock_id}"
        if category == "institutional":
            return f"{company_root}/investors.html?code={stock_id}"
        if category == "financial":
            return f"{company_root}/financial.html?code={stock_id}"
        if category == "market":
            date = source_date.replace("-", "")
            if not date:
                return ""
            return "https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX" f"?date={date}&type=ALL&response=html"
        return ""

    def _normalize_factors(self, raw: Any) -> list[dict[str, Any]]:
        factors = []
        for item in raw if isinstance(raw, list) else []:
            if not isinstance(item, dict):
                continue
            factors.append({
                "key": str(item.get("key") or ""),
                "label": str(item.get("label") or item.get("label_zh") or "影響因素"),
                "score": self._number(item.get("score"), 0),
                "reason": str(item.get("reason_zh") or "持續觀察資料變化。"),
                "source": str(item.get("source_label_zh") or "公開資料"),
            })
        return factors[:5]

    def _normalize_contributions(self, raw: Any) -> list[dict[str, Any]]:
        result = []
        for item in raw if isinstance(raw, list) else []:
            if not isinstance(item, dict):
                continue
            result.append({
                "label": str(item.get("label_zh") or "子指標"),
                "factor": str(item.get("factor") or ""),
                "score": self._number(item.get("score"), 0),
                "impact": self._number(item.get("health_impact"), 0),
                "sub_weight_pct": self._number(item.get("sub_weight_pct"), 0),
                "factor_weight_pct": self._number(item.get("factor_weight_pct"), 0),
                "reason": str(item.get("reason_zh") or "此項用於構成面向分數。"),
                "source": str(item.get("source_label_zh") or "公開資料"),
            })
        return result[:5]

    def _normalize_history(self, raw: Any) -> list[dict[str, Any]]:
        by_date: dict[str, dict[str, Any]] = {}
        for item in raw if isinstance(raw, list) else []:
            if not isinstance(item, dict) or not item.get("date"):
                continue
            date = str(item["date"])[:10]
            by_date[date] = {
                "date": date,
                "score": self._number(item.get("score"), 0),
                "risk": self._number(item.get("risk"), 0),
                "confidence": self._number(item.get("confidence"), 0),
            }
        return [by_date[date] for date in sorted(by_date)][-30:]

    @staticmethod
    def _normalize_sources(raw: Any) -> list[dict[str, str]]:
        sources = []
        for item in raw if isinstance(raw, list) else []:
            if not isinstance(item, dict):
                continue
            sources.append({
                "key": str(item.get("key") or ""),
                "label": str(item.get("label") or "資料來源"),
                "source": str(item.get("source_label_zh") or "公開資料"),
            })
        return sources[:5]

    def _normalize_indicators(self, raw: Any) -> list[dict[str, Any]]:
        items: list[tuple[str, Any]]
        if isinstance(raw, dict):
            items = list(raw.items())
        elif isinstance(raw, list):
            items = [(str(item.get("key") or item.get("id") or index), item) for index, item in enumerate(raw)]
        else:
            return []

        normalized = []
        for key, value in items:
            item = value if isinstance(value, dict) else {"score": value}
            canonical = str(item.get("key") or key).lower()
            label, default_note = LABELS.get(canonical, (str(item.get("label_zh") or item.get("label") or key), "持續追蹤資料變化"))
            score = self._number(item.get("score") or item.get("value"), 0)
            normalized.append({
                "key": canonical,
                "label": item.get("label_zh") or item.get("label") or label,
                "score": score,
                "level": item.get("level_zh") or item.get("level") or self._level(score),
                "note": (
                    item.get("summary_zh")
                    or item.get("description")
                    or item.get("note_zh")
                    or item.get("note")
                    or default_note
                ),
                "weight_pct": round(self._number(item.get("weight"), 0) * 100, 2),
                "weighted_contribution": self._number(item.get("weighted_contribution"), 0),
                "coverage_pct": self._number(item.get("coverage_pct"), 0),
                "contributions": self._normalize_contributions(item.get("contributions")),
                "missing_features": [str(value) for value in item.get("missing_features", []) if value],
            })
        return normalized[:5]

    @staticmethod
    def _number(value: Any, default: float) -> float:
        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _optional_number(value: Any) -> float | None:
        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _level(score: float) -> str:
        if score >= 75:
            return "良好"
        if score >= 55:
            return "中性"
        return "觀察"
