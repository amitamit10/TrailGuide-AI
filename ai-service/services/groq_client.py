import os
from groq import AsyncGroq

_client: AsyncGroq | None = None

def get_groq() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])
    return _client
