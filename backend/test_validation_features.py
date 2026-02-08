import requests
import pandas as pd
import os
import time

BASE_URL = "http://localhost:8080"
CSV_PATH = "test_data.csv"

# Create dummy data
df = pd.DataFrame({
    'age': [25, 30, 'invalid', 40], # 'invalid' should fail integer check
    'email': ['valid@test.com', 'bad-email', 'ok@test.com', ''] # 'bad-email' should fail regex
})
df.to_csv(CSV_PATH, index=False)

def run_test():
    print("Uploading file...")
    try:
        with open(CSV_PATH, 'rb') as f:
            files = {'file': f}
            res = requests.post(f"{BASE_URL}/upload", files=files)
            if res.status_code != 200:
                print(f"Upload failed: {res.text}")
                return
            session_id = res.json()['session_id']
            print(f"Session ID: {session_id}")
    except Exception as e:
        print(f"Connection error: {e}")
        return

    print("Running Validation (Integer Check & Email Check)...")
    rules = [
        {
            "column": "age",
            "rule_type": "type_check",
            "params": {"type": "integer"}
        },
        {
            "column": "email",
            "rule_type": "regex_email",
            "params": {}
        }
    ]
    
    try:
        res = requests.post(f"{BASE_URL}/validate/{session_id}", json={"rules": rules})
        if res.status_code != 200:
             print(f"Validation failed: {res.text}")
        else:
             data = res.json()
             print("Validation Success!")
             print(f"Valid Rows: {data['valid_rows']}")     # Should be 2 (indices 0 and 2)
             print(f"Invalid Rows: {data['invalid_rows']}") # Should be 2 (indices 1 and 3)
    except Exception as e:
        print(f"Validation error: {e}")

if __name__ == "__main__":
    time.sleep(2) # Wait for server
    run_test()
    if os.path.exists(CSV_PATH):
        os.remove(CSV_PATH)
