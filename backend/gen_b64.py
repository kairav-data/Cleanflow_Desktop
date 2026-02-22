import base64
with open(r'c:\Users\KAIRAV\cleanflow\frontend\src\assets\logo.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()
with open(r'c:\Users\KAIRAV\cleanflow\backend\logo_b64.py', 'w') as f:
    f.write(f'LOGO_BASE64 = "{b64}"\n')
