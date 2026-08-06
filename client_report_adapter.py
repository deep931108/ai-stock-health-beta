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

    def available_stocks(self) -> list[dict[str, Any]]:
        ids: set[str] = set()
        if self.report_root.is_dir():
            ids.update(path.parent.name for path in self.report_root.glob("*/latest.json"))
        if self.sample_dir and self.sample_dir.is_dir():
            ids.update(path.stem for path in self.sample_dir.glob("*.json"))
        result = []
        for stock_id in sorted(ids):
            report = self.load(stock_id)
            if report:
                result.append({
                    "id": stock_id,
                    "name": report["name"],
                    "industry": report["industry"],
                    "score": report["score"],
                    "assessment": report["assessment"],
                    "grade": report["grade"],
                    "risk": report["risk"],
                    "risk_level": report["risk_level"],
                    "updated": report["updated"],
                    "source": report["source"],
                })
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
        return {
            "id": str(payload.get("stock_id") or stock.get("stock_id") or stock_id),
            "name": stock.get("name") or payload.get("stock_name") or known_name,
            "industry": stock.get("industry") or known_industry,
            "market": stock.get("market") or payload.get("market") or "TWSE",
            "score": self._number(overview.get("health_score"), 0),
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
            "notices": notices,
            "disclaimer": payload.get("disclaimer_zh") or "本服務僅供資料整理與研究輔助，不構成投資建議。",
        }

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
            })
        return normalized[:5]

    @staticmethod
    def _number(value: Any, default: float) -> float:
        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _level(score: float) -> str:
        if score >= 75:
            return "良好"
        if score >= 55:
            return "中性"
        return "觀察"
