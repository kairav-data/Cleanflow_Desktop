import logging
import sys
import os

def setup_logger(name: str) -> logging.Logger:
    """Configures and returns a logger instance."""
    logger = logging.getLogger(name)
    
    # Only configure if it doesn't already have handlers to avoid duplicate logs
    if not logger.handlers:
        # Default level to INFO, can be overridden by environment variable
        log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
        log_level = getattr(logging, log_level_str, logging.INFO)
        logger.setLevel(log_level)
        
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
    return logger
