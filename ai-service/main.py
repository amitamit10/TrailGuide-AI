from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI  # noqa: E402
from routers import generate, chat, recommendations, replace, story, edit, import_doc, photos, weather, preview_replace  # noqa: E402

app = FastAPI(title="TrailGuide AI Service")

app.include_router(generate.router)
app.include_router(chat.router)
app.include_router(recommendations.router)
app.include_router(replace.router)
app.include_router(preview_replace.router)
app.include_router(story.router)
app.include_router(edit.router)
app.include_router(import_doc.router)
app.include_router(photos.router)
app.include_router(weather.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
