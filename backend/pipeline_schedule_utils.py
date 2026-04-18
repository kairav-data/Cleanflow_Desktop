from __future__ import annotations

import calendar
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo


SUPPORTED_FREQUENCIES = ("Hourly", "Daily", "Weekly", "Monthly")
DAY_NAMES = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
DAY_ALIASES = {
    "mon": "Mon",
    "monday": "Mon",
    "tue": "Tue",
    "tues": "Tue",
    "tuesday": "Tue",
    "wed": "Wed",
    "wednesday": "Wed",
    "thu": "Thu",
    "thur": "Thu",
    "thurs": "Thu",
    "thursday": "Thu",
    "fri": "Fri",
    "friday": "Fri",
    "sat": "Sat",
    "saturday": "Sat",
    "sun": "Sun",
    "sunday": "Sun",
}
DAY_INDEX = {name: index for index, name in enumerate(DAY_NAMES)}


def normalize_frequency(value: Optional[str]) -> str:
    normalized = str(value or "Daily").strip().lower()
    mapping = {
        "hourly": "Hourly",
        "daily": "Daily",
        "weekly": "Weekly",
        "monthly": "Monthly",
    }
    if normalized not in mapping:
        raise ValueError("Frequency must be Hourly, Daily, Weekly, or Monthly.")
    return mapping[normalized]


def normalize_timezone_name(value: Optional[str]) -> str:
    timezone_name = str(value or "UTC").strip() or "UTC"
    try:
        ZoneInfo(timezone_name)
    except Exception as exc:
        raise ValueError(f"Timezone '{timezone_name}' is not supported.") from exc
    return timezone_name


def normalize_day_of_week(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = DAY_ALIASES.get(str(value).strip().lower())
    if not normalized:
        raise ValueError("Day of week must be Mon, Tue, Wed, Thu, Fri, Sat, or Sun.")
    return normalized


def parse_run_time(value: Optional[str]) -> tuple[int, int]:
    raw = str(value or "").strip()
    try:
        hour_str, minute_str = raw.split(":")
        hour = int(hour_str)
        minute = int(minute_str)
    except Exception as exc:
        raise ValueError("Run time must be in HH:MM format.") from exc

    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError("Run time must be in HH:MM format.")
    return hour, minute


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_utc(value: Optional[datetime]) -> datetime:
    current = value or _utc_now()
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def _build_monthly_candidate(year: int, month: int, day_of_month: int, hour: int, minute: int, tz: ZoneInfo) -> datetime:
    last_day = calendar.monthrange(year, month)[1]
    safe_day = min(day_of_month, last_day)
    return datetime(year, month, safe_day, hour, minute, tzinfo=tz)


def compute_next_run_at(
    frequency: Optional[str],
    run_time: Optional[str],
    timezone_name: Optional[str] = "UTC",
    day_of_week: Optional[str] = None,
    day_of_month: Optional[int] = None,
    now_utc: Optional[datetime] = None,
) -> datetime:
    normalized_frequency = normalize_frequency(frequency)
    normalized_timezone = normalize_timezone_name(timezone_name)
    tz = ZoneInfo(normalized_timezone)
    hour, minute = parse_run_time(run_time)
    current_utc = _coerce_utc(now_utc)
    local_now = current_utc.astimezone(tz).replace(second=0, microsecond=0)

    if normalized_frequency == "Hourly":
        candidate = local_now.replace(minute=minute, second=0, microsecond=0)
        if candidate <= local_now:
            candidate += timedelta(hours=1)
    elif normalized_frequency == "Daily":
        candidate = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= local_now:
            candidate += timedelta(days=1)
    elif normalized_frequency == "Weekly":
        normalized_day = normalize_day_of_week(day_of_week) or DAY_NAMES[local_now.weekday()]
        day_delta = (DAY_INDEX[normalized_day] - local_now.weekday()) % 7
        candidate = (local_now + timedelta(days=day_delta)).replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= local_now:
            candidate += timedelta(days=7)
    else:
        if day_of_month is None:
            day_of_month = local_now.day
        try:
            day_of_month = int(day_of_month)
        except Exception as exc:
            raise ValueError("Day of month must be a number between 1 and 31.") from exc
        if day_of_month < 1 or day_of_month > 31:
            raise ValueError("Day of month must be between 1 and 31.")

        candidate = _build_monthly_candidate(local_now.year, local_now.month, day_of_month, hour, minute, tz)
        if candidate <= local_now:
            next_month = 1 if local_now.month == 12 else local_now.month + 1
            next_year = local_now.year + 1 if next_month == 1 else local_now.year
            candidate = _build_monthly_candidate(next_year, next_month, day_of_month, hour, minute, tz)

    return candidate.astimezone(timezone.utc).replace(tzinfo=None)
