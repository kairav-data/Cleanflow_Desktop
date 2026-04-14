from typing import Dict, Any, List
import polars as pl
import os
import uuid
import logging
from datetime import datetime

from models import ValidationRule
from features.cleaner import DataCleaner
from features.validation import PolarsValidationEngine
from email_utils import send_pipeline_email

logger = logging.getLogger(__name__)

class PipelineOrchestrator:
    def __init__(self, session_id: str, initial_df: pl.DataFrame = None):
        self.session_id = session_id
        self.initial_df = initial_df

    def _topological_sort(self, nodes: List[Dict], edges: List[Dict]) -> List[str]:
        # Topo sort nodes based on edges
        adj = {n['id']: [] for n in nodes}
        in_degree = {n['id']: 0 for n in nodes}
        
        for e in edges:
            source = e.get('source')
            target = e.get('target')
            if source in adj and target in in_degree:
                adj[source].append(target)
                in_degree[target] += 1
                
        # Find roots
        queue = [n_id for n_id, deg in in_degree.items() if deg == 0]
        sorted_nodes = []
        
        while queue:
            curr = queue.pop(0)
            sorted_nodes.append(curr)
            for nxt in adj[curr]:
                in_degree[nxt] -= 1
                if in_degree[nxt] == 0:
                    queue.append(nxt)
                    
        return sorted_nodes

    async def execute_graph(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        config expects:
        {
           "nodes": [ { "id": "1", "type": "dataset|cleaner|validation|export", "data": { ... } } ],
           "edges": [ { "source": "1", "target": "2" } ]
        }
        """
        nodes = config.get("nodes", [])
        edges = config.get("edges", [])
        node_map = {n['id']: n for n in nodes}
        
        sorted_ids = self._topological_sort(nodes, edges)
        
        if self.initial_df is None:
            return {"success": False, "error": "No valid dataset loaded in memory for this session."}
            
        current_df = self.initial_df.clone()
        run_logs = []
        output_file_path = None

        try:
            for node_id in sorted_ids:
                node = node_map[node_id]
                node_type = node.get("type", "")
                data = node.get("data", {})
                
                # 1. Dataset Node
                if node_type == "dataset":
                    run_logs.append({"node": node_id, "type": node_type, "status": "success", "message": f"Loaded {len(current_df)} rows"})
                    
                # 2. Data Cleaner Node
                elif node_type == "cleaner":
                    eng = DataCleaner(self.session_id)
                    eng.df = current_df
                    res = await eng.execute({"rules": data.get("rules", [])})
                    if res.success:
                        current_df = pl.DataFrame(res.data)
                        run_logs.append({"node": node_id, "type": node_type, "status": "success", "message": f"Processed {len(current_df)} rows"})
                    else:
                        raise Exception(res.error)

                # 3. Validation Node
                elif node_type == "validation":
                    raw_rules = data.get("rules", [])
                    rules = [ValidationRule(**rule) for rule in raw_rules]
                    eng = PolarsValidationEngine(self.session_id)
                    eng.load_data(dataframe=current_df)
                    res = eng.validate(rules)
                    run_logs.append({
                        "node": node_id,
                        "type": node_type,
                        "status": "success",
                        "message": f"Validated {res.get('total_rows', 0)} rows: {res.get('valid_rows', 0)} valid, {res.get('invalid_rows', 0)} invalid"
                    })

                # 4. Export/Final Node
                elif node_type == "export":
                    os.makedirs("results", exist_ok=True)
                    out_filename = f"pipeline_out_{uuid.uuid4().hex[:8]}.xlsx"
                    out_path = os.path.join("results", out_filename)
                    current_df.write_excel(out_path)
                    output_file_path = out_path
                    run_logs.append({"node": node_id, "type": node_type, "status": "success", "message": f"Exported to {out_filename}"})

                # 5. Email Notification Node
                elif node_type == "email":
                    to_email  = data.get("toEmail", "").strip()
                    subject   = data.get("emailSubject", "Pipeline Alert").strip()
                    body      = data.get("emailBody", "").strip()

                    # Resolve dynamic macro tokens
                    today      = datetime.now().strftime("%Y-%m-%d %H:%M")
                    row_count  = str(len(current_df))
                    status_str = "Success" if all(l.get("status") == "success" for l in run_logs) else "Partial"
                    pipe_name  = config.get("pipelineName", "Untitled Pipeline")

                    def resolve(text: str) -> str:
                        return (text
                            .replace("{{TODAY_DATE}}", today)
                            .replace("{{STATUS}}", status_str)
                            .replace("{{ROW_COUNT}}", row_count)
                            .replace("{{PIPELINE_NAME}}", pipe_name))

                    subject = resolve(subject)
                    body    = resolve(body) or (
                        f"Pipeline '{pipe_name}' completed on {today}.\n"
                        f"Status: {status_str}\n"
                        f"Rows processed: {row_count}"
                    )

                    if not to_email:
                        run_logs.append({
                            "node": node_id, "type": node_type, "status": "skipped",
                            "message": "Email skipped: Recipient email address not configured on node."
                        })
                    else:
                        result = send_pipeline_email(
                            to_email=to_email,
                            subject=subject,
                            body=body,
                            pipeline_name=pipe_name,
                        )
                        if result["success"]:
                            run_logs.append({
                                "node": node_id, "type": node_type, "status": "success",
                                "message": f"Email sent to {to_email} via Resend (admin@cleanflow.one)"
                            })
                        else:
                            run_logs.append({
                                "node": node_id, "type": node_type, "status": "error",
                                "message": f"Email failed: {result.get('error', 'Unknown error')}"
                            })

                else:
                    run_logs.append({
                        "node": node_id,
                        "type": node_type,
                        "status": "skipped",
                        "message": f"Pipeline execution for '{node_type}' nodes is not implemented yet"
                    })
                    
            return {
                "success": True,
                "logs": run_logs,
                "preview_data": current_df.head(100).to_dicts(), # preview top 100 for UI
                "output_file": output_file_path,
                "output_columns": current_df.columns,
                "output_row_count": len(current_df),
                "output_df": current_df,
            }
            
        except Exception as e:
            return {"success": False, "error": str(e), "logs": run_logs}
