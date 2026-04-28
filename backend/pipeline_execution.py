from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, Optional

from database import db
from features.pipeline_runner import PipelineOrchestrator
from features.validation import PolarsValidationEngine as ValidationEngine, RESULTS_DIR


logger = logging.getLogger(__name__)


async def execute_pipeline_runtime(
    config: Dict[str, Any],
    *,
    user_email: str,
    session_store: Dict[str, Any],
    session_id: str,
    pipeline_id: Optional[str] = None,
    trigger: str = "manual",
    initial_df: Optional[Any] = None,
) -> Dict[str, Any]:
    pipeline_name = str(config.get("pipelineName") or config.get("pipeline_name") or "Untitled Pipeline").strip() or "Untitled Pipeline"
    run_id = await db.create_pipeline_run({
        "id": str(uuid.uuid4()),
        "pipeline_id": pipeline_id,
        "pipeline_name": pipeline_name,
        "trigger": trigger,
        "node_count": len(config.get("nodes") or []),
        "status": "running",
        "user_email": user_email,
    })

    source_df = initial_df
    if source_df is None and session_id:
        engine = session_store.get(session_id)
        source_df = getattr(engine, "df", None) if engine is not None else None

    orchestrator = PipelineOrchestrator(
        session_id=session_id,
        initial_df=source_df,
        session_store=session_store,
        user_email=user_email,
    )
    result = await orchestrator.execute_graph(config)

    if not result.get("success"):
        await db.update_pipeline_run(run_id, user_email, {
            "status": "failed",
            "logs": result.get("logs", []),
            "error_message": result.get("error", "Pipeline execution failed"),
        })
        result["run_id"] = run_id
        return result

    await db.update_pipeline_run(run_id, user_email, {
        "status": "completed",
        "logs": result.get("logs", []),
        "output_file": result.get("output_file"),
    })
    result["run_id"] = run_id
    return result


async def execute_saved_pipeline(
    pipeline_id: str,
    *,
    user_email: str,
    session_store: Dict[str, Any],
    trigger: str = "scheduled",
) -> Dict[str, Any]:
    import os, re
    from datetime import datetime as _dt

    pipeline = await db.get_pipeline(pipeline_id, user_email)
    if not pipeline:
        raise ValueError("Saved pipeline not found.")

    config = {
        "pipelineId": pipeline["id"],
        "pipelineName": pipeline["name"],
        "nodes": pipeline.get("nodes", []),
        "edges": pipeline.get("edges", []),
    }
    session_id = f"pipeline_{uuid.uuid4().hex}"
    result = await execute_pipeline_runtime(
        config,
        user_email=user_email,
        session_store=session_store,
        session_id=session_id,
        pipeline_id=pipeline["id"],
        trigger=trigger,
    )

    # --- Auto-export output for scheduled/triggered runs if no export node produced a file ---
    if result.get("success") and not result.get("output_file"):
        output_df = result.get("output_df")
        if output_df is not None:
            try:
                os.makedirs(RESULTS_DIR, exist_ok=True)
                safe_name = re.sub(r"[^A-Za-z0-9_-]+", "_", pipeline["name"].strip()).strip("_") or "pipeline"
                timestamp = _dt.utcnow().strftime("%Y%m%d_%H%M%S")
                out_path = os.path.join(RESULTS_DIR, f"{safe_name}_{trigger}_{timestamp}.csv")
                output_df.write_csv(out_path)
                result["output_file"] = out_path
                # Update the run record with the auto-exported file path
                run_id = result.get("run_id")
                if run_id:
                    await db.update_pipeline_run(run_id, user_email, {"output_file": out_path})
                logger.info("Auto-exported scheduled pipeline output to %s", out_path)
            except Exception as export_exc:
                logger.warning("Auto-export of scheduled pipeline output failed: %s", export_exc)

    return result


def create_dataframe_session(dataframe: Any, session_store: Dict[str, Any]) -> Dict[str, Any]:
    output_engine = ValidationEngine()
    columns = output_engine.load_data(dataframe=dataframe)
    session_store[output_engine.session_id] = output_engine
    return {
        "session_id": output_engine.session_id,
        "columns": columns,
        "row_count": len(dataframe),
    }


def attach_output_session(result: Dict[str, Any], session_store: Dict[str, Any]) -> Dict[str, Any]:
    output_df = result.pop("output_df", None)
    if output_df is None:
        return result

    session_details = create_dataframe_session(output_df, session_store)
    result["output_session_id"] = session_details["session_id"]
    result["output_columns"] = session_details["columns"]
    result["output_row_count"] = session_details["row_count"]
    return result
