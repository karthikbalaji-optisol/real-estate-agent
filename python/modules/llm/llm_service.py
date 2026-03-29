"""
LLM integration via elsAi Foundry.

"""

from __future__ import annotations

from typing import Protocol

from elsai_model.openai import OpenAIConnector

from config import CHAT_MODEL_NAME, OPENAI_API_KEY
from shared.log_producer import get_logger

logger = get_logger('LLMService')


class LLMConnector(Protocol):
    def generate(
        self, system_prompt: str, user_prompt: str, temperature: float = 0
    ) -> str: ...


class OpenAIChat:
    """elsAi Foundry OpenAI wrapper"""

    def __init__(self, model_name: str, api_key: str) -> None:
        self._connector = OpenAIConnector(
            model_name=model_name,
            openai_api_key=api_key,
            temperature=0,
            implementation='native',
        )

    def generate(
        self, system_prompt: str, user_prompt: str, temperature: float = 0
    ) -> str:
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ]
        response = self._connector.invoke(messages=messages)
        if isinstance(response, str):
            return response
        return response.choices[0].message.content


_chat_model: LLMConnector | None = None


def get_chat_model() -> LLMConnector:
    global _chat_model
    if _chat_model is None:
        _chat_model = OpenAIChat(model_name=CHAT_MODEL_NAME, api_key=OPENAI_API_KEY)
        logger.info('Chat model initialised', model=CHAT_MODEL_NAME)
    return _chat_model
