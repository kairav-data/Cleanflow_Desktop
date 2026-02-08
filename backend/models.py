from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any, Union
from enum import Enum

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    hashed_password: str
    is_premium: bool = False
    
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class DataType(str, Enum):
    INTEGER = "integer"
    STRING = "string"
    FLOAT = "float"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    TIME = "time"
    CURRENCY = "currency"
    PERCENTAGE = "percentage"
    NUMERIC = "numeric" # Numbers only, no symbols/letters
    ALPHABETIC = "alphabetic" # A-Z, a-z
    ALPHANUMERIC = "alphanumeric"

class ValidationRuleType(str, Enum):
    # 1. Type & Format
    TYPE_CHECK = "type_check"
    DATE_FORMAT = "date_format" # params: formatStr
    
    # 2. Length & Size
    LENGTH_MIN = "length_min"
    LENGTH_MAX = "length_max"
    LENGTH_EXACT = "length_exact"
    LENGTH_BETWEEN = "length_between" # params: min, max
    
    # 3. Value Range
    VALUE_GT = "value_gt" # Greater Than
    VALUE_LT = "value_lt" # Less Than
    VALUE_BETWEEN = "value_between" # Inclusive
    VALUE_BETWEEN_EXC = "value_between_exclusive" 
    VALUE_NOT_EQ = "value_not_eq"
    VALUE_POSITIVE = "value_positive"
    VALUE_NEGATIVE = "value_negative"
    VALUE_NON_ZERO = "value_non_zero"
    
    # 4. Null & Completeness
    NOT_NULL = "not_null" # Must not be null
    NULL_ALLOWED = "null_allowed" # Explicitly allowing nulls (default behavior but useful for doc)
    CONDITIONAL_NULL = "conditional_null" # Not null if other col has valid value
    
    # 5. Pattern & Regex
    REGEX_CUSTOM = "regex_custom"
    REGEX_EMAIL = "regex_email"
    REGEX_PHONE = "regex_phone" # Generic logic or specific country
    REGEX_ZIP = "regex_zip"
    REGEX_NO_SPECIAL_CHARS = "regex_no_special_chars"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    
    # 6. Domain & Allowed Values
    ALLOWED_VALUES = "allowed_values" # List of values
    DISALLOWED_VALUES = "disallowed_values"
    
    # 7. Custom Rules
    CUSTOM_EXPRESSION = "custom_expression"
    COLUMN_COMPARE = "column_compare"
    CONDITIONAL_RULE = "conditional_rule"

class ValidationRule(BaseModel):
    column: str
    rule_type: ValidationRuleType
    params: Optional[dict] = None 
    # params examples:
    # {"type": "integer"}
    # {"min": 5, "max": 10}
    # {"regex": "^[A-Z]+$"}
    # {"values": ["US", "CA", "UK"]}
    # {"format": "%Y-%m-%d"}

class ValidationConfig(BaseModel):
    rules: List[ValidationRule]

class FileValidationResponse(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    id: str # session id to retrieve results later

# --- User History Models ---
class ValidationJobCreate(BaseModel):
    session_id: str
    file_name: str
    rules: List[dict]
    total_rows: int
    valid_rows: int
    invalid_rows: int
    column_stats: Optional[dict] = None

class ValidationJob(ValidationJobCreate):
    id: Optional[str] = None
    user_email: str
    created_at: str
    status: str = "completed"  # pending, running, completed, failed

# --- Database Connection Models ---
class DatabaseType(str, Enum):
    MSSQL = "mssql"
    MYSQL = "mysql"
    POSTGRESQL = "postgresql"
    ORACLE = "oracle"
    SQLITE = "sqlite"

class DatabaseConnectionCreate(BaseModel):
    name: str
    db_type: DatabaseType
    host: str
    port: int
    database: str
    username: str
    password: str

class DatabaseConnection(DatabaseConnectionCreate):
    id: Optional[str] = None
    user_email: str
    created_at: str

class DatabaseQueryRequest(BaseModel):
    connection_id: str
    query: str
