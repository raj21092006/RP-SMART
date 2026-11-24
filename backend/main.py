import psutil
import subprocess
import json
import httpx

from database import (
    init_db,
    create_conversation,
    save_message,
    get_messages,
    get_conversations,
    update_conversation_title
)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel


app = FastAPI(
    title="RP SMART API",
    description="Personal AI Assistant Backend",
    version="2.0.0"
)


@app.on_event("startup")
def startup_event():
    init_db()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
FAST_MODEL = "qwen2.5:3b"
BRAIN_MODEL = "qwen3:4b"

def select_model(message):

    text = message.lower()

    brain_keywords = [
        "explain in detail",
        "step by step",
        "analyze",
        "analysis",
        "debug",
        "debugging",
        "complex",
        "reason",
        "compare",
        "architecture",
        "write code",
        "python",
        "javascript",
        "fastapi",
        "react",
        "কেন",
        "বিশ্লেষণ",
        "বিস্তারিত",
        "ধাপে ধাপে",
        "সমাধান",
        "কোড",
        "প্রোগ্রামিং"
    ]

    if (
        any(word in text for word in brain_keywords)
        or len(text) > 500
        or "```" in text
    ):
        return BRAIN_MODEL

    return FAST_MODEL

class ChatRequest(BaseModel):
    message: str
    conversation_id: int | None = None
    weather_context: str | None = None


def make_event(event_type, **data):
    return json.dumps(
        {"type": event_type, **data},
        ensure_ascii=False
    ) + "\n"


def extract_visible_text(chunk, state):
    """Remove think tags while preserving streamed answer text."""

    state["pending"] += chunk
    output = ""

    while state["pending"]:

        if state["thinking"]:
            end_tag = "</think>"
            index = state["pending"].find(end_tag)

            if index != -1:
                state["pending"] = state["pending"][index + len(end_tag):]
                state["thinking"] = False
                continue

            keep = len(end_tag) - 1
            if len(state["pending"]) > keep:
                state["pending"] = state["pending"][-keep:]

            break

        start_tag = "<think>"
        index = state["pending"].find(start_tag)

        if index != -1:
            output += state["pending"][:index]
            state["pending"] = state["pending"][index + len(start_tag):]
            state["thinking"] = True
            continue

        keep = len(start_tag) - 1

        if len(state["pending"]) > keep:
            output += state["pending"][:-keep]
            state["pending"] = state["pending"][-keep:]

        break

    return output


@app.get("/")
def home():
    return {
        "message": "RP SMART Backend is running!",
        "assistant": "RP SMART",
        "status": "online"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/api/telemetry")
def system_telemetry():
    cpu = psutil.cpu_percent(interval=0.3)
    ram = psutil.virtual_memory().percent

    gpu = None
    temperature = None

    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=utilization.gpu,temperature.gpu",
                "--format=csv,noheader,nounits"
            ],
            capture_output=True,
            text=True,
            timeout=3
        )

        if result.returncode == 0:
            values = result.stdout.strip().split(",")
            gpu = int(values[0].strip())
            temperature = int(values[1].strip())

    except (FileNotFoundError, subprocess.TimeoutExpired, ValueError, IndexError):
        pass

    return {
        "cpu": cpu,
        "ram": ram,
        "gpu": gpu,
        "temperature": temperature
    }

@app.get("/api/conversations")
def list_conversations():
    conversations = get_conversations()

    return {
        "assistant": "RP SMART",
        "total": len(conversations),
        "conversations": conversations
    }


@app.get("/api/conversations/{conversation_id}/messages")
def conversation_messages(conversation_id: int):
    messages = get_messages(conversation_id)

    return {
        "assistant": "RP SMART",
        "conversation_id": conversation_id,
        "total": len(messages),
        "messages": messages
    }


@app.post("/api/chat")
async def chat(request: ChatRequest):

    if not request.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty"
        )

    conversation_id = request.conversation_id
    is_new_conversation = conversation_id is None

    if is_new_conversation:
        conversation_id = create_conversation()

    save_message(
        conversation_id,
        "user",
        request.message
    )

    if is_new_conversation:
        update_conversation_title(
            conversation_id,
            request.message.strip()[:40]
        )

    history = get_messages(conversation_id)

    messages = [
        {
            "role": item["role"],
            "content": item["content"]
        }
        for item in history
    ]
    system_prompt = """
You are RP SMART, a personal AI assistant created by RAJPATRA.

IDENTITY:
- Your name is RP SMART.
- Your creator is RAJPATRA.
- Never identify yourself as Qwen or Alibaba Cloud.
- You run using the Qwen AI model as your underlying engine.
- If asked about your creator, clearly answer RAJPATRA.

PERSONALITY:
- Be intelligent, friendly, professional and helpful.
- Give direct, accurate and natural answers.
- Keep simple answers short.
- Explain complex topics step by step.
- Never invent facts or pretend to know something you do not know.
- Follow the user's language.
- Do not reveal internal reasoning. Provide only the final answer.

You are RP SMART. Always maintain this identity.
"""

    if request.weather_context:
        system_prompt += "\n\nLIVE WEATHER CONTEXT:\n" + request.weather_context[:1500] + "\nUse this data for current weather questions. Do not invent missing details."
    messages.insert(0, {
        "role": "system",
        "content": system_prompt
    })
    selected_model = select_model(request.message)
    selected_model = FAST_MODEL
    print(f"RP SMART selected model: {selected_model}")

    payload = {
        "model": selected_model,
        "messages": messages,
        "stream": True,
        "think": False,
        "keep_alive": -1,
        "options": {
            "num_predict": 1024

        }
    }
    if selected_model == BRAIN_MODEL:
        payload["options"]["num_gpu"] = 0

    async def generate():

        assistant_reply = ""

        state = {
            "thinking": False,
            "pending": ""
        }

        try:
            yield make_event(
                "start",
                assistant="RP SMART",
                conversation_id=conversation_id
            )

            async with httpx.AsyncClient(timeout=300.0) as client:

                async with client.stream(
                    "POST",
                    OLLAMA_URL,
                    json=payload
                ) as response:

                    response.raise_for_status()

                    async for line in response.aiter_lines():

                        if not line:
                            continue

                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        message = data.get("message", {})
                        chunk = message.get("content", "")

                        if chunk:
                            visible = extract_visible_text(
                                chunk,
                                state
                            )

                            if visible:
                                assistant_reply += visible

                                yield make_event(
                                    "delta",
                                    text=visible
                                )

                        if data.get("error"):
                            raise RuntimeError(data["error"])

                        if data.get("done", False):
                            break

            if not state["thinking"]:
                remaining = state["pending"]
                assistant_reply += remaining
                state["pending"] = ""

                if remaining:
                    yield make_event(
                        "delta",
                        text=remaining
                    )

            assistant_reply = assistant_reply.strip()

            if not assistant_reply:
                yield make_event(
                    "error",
                    message="Model returned an empty response."
                )
                return

            save_message(
                conversation_id,
                "assistant",
                assistant_reply
            )

            yield make_event(
                "done",
                conversation_id=conversation_id
            )

        except httpx.RequestError:
            yield make_event(
                "error",
                message="Cannot connect to Ollama. Check Ollama server."
            )

        except httpx.HTTPStatusError as error:
            yield make_event(
                "error",
                message=f"Ollama error: {error.response.text}"
            )

        except Exception as error:
            yield make_event(
                "error",
                message=str(error)
            )

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


