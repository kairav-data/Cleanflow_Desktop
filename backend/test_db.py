import asyncio
from database import db
async def test():
    try:
        # Trying to fetch user jobs to trigger the error
        jobs = await db.get_user_jobs("admin@test.com")
        print(f"Success, found {len(jobs)} jobs")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
