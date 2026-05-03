import glob
import re

replacements = [
    # DataConnection.jsx: inactive tab text
    ("text-slate-500 hover:text-slate-700", "text-slate-800 hover:text-slate-900"),
    # DataConnection.jsx: separator buttons inactive text
    ("bg-white text-slate-400 border-slate-200 hover:border-brand-blue/30", "bg-white text-slate-800 border-slate-200 hover:border-brand-blue/30"),
    # DataConnection.jsx: custom separator input inactive text
    ("border-slate-200 text-slate-500", "border-slate-200 text-slate-800"),
    # Generic: placeholder text that shows as white
    ("text-slate-400 font-medium", "text-slate-600 font-medium"),
]

files = glob.glob("frontend/src/**/*.jsx", recursive=True) + glob.glob("frontend/src/**/*.tsx", recursive=True)

for filepath in files:
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            original = f.read()
        updated = original
        for old, new in replacements:
            updated = updated.replace(old, new)
        if updated != original:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(updated)
            print(f"Updated: {filepath}")
    except Exception as e:
        print(f"Error in {filepath}: {e}")

print("All done!")
