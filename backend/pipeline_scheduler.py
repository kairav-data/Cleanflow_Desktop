from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional, Set

from database import db
from pipeline_execution import execute_saved_pipeline


logger = logging.getLogger(__name__)


class PipelineSchedulerService:
    def __init__(
        self,
        *,
        session_store: Dict[str, Any],
        poll_interval_seconds: int = 30,
        batch_size: int = 10,
    ):
        self.session_store = session_store
        self.poll_interval_seconds = max(int(poll_interval_seconds or 30), 5)
        self.batch_size = max(int(batch_size or 10), 1)
        self._loop_task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._active_runs: Set[asyncio.Task] = set()

    async def start(self):
        await db.initialize_schedule_next_runs()
        if self._loop_task and not self._loop_task.done():
            return
        self._stop_event = asyncio.Event()
        self._loop_task = asyncio.create_task(self._run_loop(), name="cleanflow-pipeline-scheduler")
        logger.info("Pipeline scheduler started with a %ss poll interval.", self.poll_interval_seconds)

    async def stop(self):
        self._stop_event.set()

        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
            self._loop_task = None

        if self._active_runs:
            await asyncio.gather(*list(self._active_runs), return_exceptions=True)
        logger.info("Pipeline scheduler stopped.")

    async def _run_loop(self):
        while not self._stop_event.is_set():
            try:
                claimed = await db.claim_due_schedules(limit=self.batch_size)
                for schedule in claimed:
                    task = asyncio.create_task(
                        self._execute_claimed_schedule(schedule),
                        name=f"cleanflow-schedule-{schedule['id']}",
                    )
                    self._active_runs.add(task)
                    task.add_done_callback(self._active_runs.discard)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Pipeline scheduler poll failed.")

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.poll_interval_seconds)
            except asyncio.TimeoutError:
                continue

    async def _execute_claimed_schedule(self, schedule: Dict[str, Any]):
        try:
            result = await execute_saved_pipeline(
                schedule["pipeline_id"],
                user_email=schedule["user_email"],
                session_store=self.session_store,
                trigger="scheduled",
            )
            logger.info(
                "Executed scheduled pipeline '%s' for schedule '%s' with run %s (success=%s).",
                schedule.get("pipeline_name") or schedule["pipeline_id"],
                schedule.get("schedule_name") or schedule["id"],
                result.get("run_id"),
                bool(result.get("success")),
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "Scheduled execution crashed for schedule '%s' and pipeline '%s'.",
                schedule.get("schedule_name") or schedule["id"],
                schedule.get("pipeline_name") or schedule["pipeline_id"],
            )
