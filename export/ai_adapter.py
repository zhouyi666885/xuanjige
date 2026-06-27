"""
AI 模型接口适配器
支持: 豆包、通义千问、OpenAI 及兼容 OpenAI 格式的自定义接口
使用方式: 读取 ai_config.yaml 配置，提供统一的 chat_completion 接口
"""

import os
import yaml
import requests


def load_config(config_path: str = None) -> dict:
    """加载 AI 配置文件。"""
    if config_path is None:
        # 按优先级查找配置文件
        candidates = [
            os.path.join(os.path.dirname(__file__), "ai_config.yaml"),
            os.path.join(os.getcwd(), "ai_config.yaml"),
            "/etc/ai_config.yaml",
        ]
        for path in candidates:
            if os.path.exists(path):
                config_path = path
                break

    if config_path is None or not os.path.exists(config_path):
        raise FileNotFoundError("未找到 ai_config.yaml 配置文件")

    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_api_key(config: dict) -> str:
    """获取 API Key，优先从环境变量读取。"""
    provider_config = config["ai_provider"]
    env_var = provider_config.get("api_key_env", "")

    # 优先从环境变量获取
    if env_var and os.environ.get(env_var):
        return os.environ[env_var]

    # 其次使用配置文件中的值
    api_key = provider_config.get("api_key", "")
    if api_key and api_key != "YOUR_API_KEY":
        return api_key

    raise ValueError(
        f"未配置 API Key，请设置环境变量 {env_var} 或在 ai_config.yaml 中配置"
    )


def chat_completion(
    messages: list,
    config: dict = None,
    stream: bool = None,
    temperature: float = None,
    max_tokens: int = None,
) -> dict:
    """
    统一的对话补全接口，兼容 OpenAI Chat Completions API 格式。

    Args:
        messages: 消息列表，格式 [{"role": "user", "content": "..."}]
        config: AI 配置字典，为 None 时自动加载
        stream: 是否流式返回
        temperature: 温度参数
        max_tokens: 最大 token 数

    Returns:
        与 OpenAI Chat Completions API 响应格式一致的字典
    """
    if config is None:
        config = load_config()

    provider_config = config["ai_provider"]
    request_defaults = config.get("request_defaults", {})

    api_key = get_api_key(config)
    api_base = provider_config["api_base"].rstrip("/")
    model = provider_config["model"]

    url = f"{api_base}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature or request_defaults.get("temperature", 0.7),
        "max_tokens": max_tokens or request_defaults.get("max_tokens", 4096),
        "stream": stream if stream is not None else request_defaults.get("stream", True),
    }

    retry_policy = config.get("retry_policy", {})
    max_retries = retry_policy.get("max_retries", 3)
    retry_delay = retry_policy.get("retry_delay", 1.0)
    timeout = retry_policy.get("timeout", 60)

    last_error = None
    for attempt in range(max_retries):
        try:
            response = requests.post(
                url, headers=headers, json=payload, timeout=timeout
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            last_error = e
            if attempt < max_retries - 1:
                import time
                time.sleep(retry_delay * (attempt + 1))

    raise Exception(f"API 调用失败（重试 {max_retries} 次）: {last_error}")


def chat_completion_stream(messages: list, config: dict = None, **kwargs):
    """流式对话补全，返回生成器。"""
    if config is None:
        config = load_config()

    provider_config = config["ai_provider"]
    request_defaults = config.get("request_defaults", {})

    api_key = get_api_key(config)
    api_base = provider_config["api_base"].rstrip("/")
    model = provider_config["model"]

    url = f"{api_base}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    payload = {
        "model": model,
        "messages": messages,
        "temperature": kwargs.get("temperature", request_defaults.get("temperature", 0.7)),
        "max_tokens": kwargs.get("max_tokens", request_defaults.get("max_tokens", 4096)),
        "stream": True,
    }

    timeout = config.get("retry_policy", {}).get("timeout", 60)
    response = requests.post(url, headers=headers, json=payload, timeout=timeout, stream=True)
    response.raise_for_status()

    for line in response.iter_lines():
        if line:
            line = line.decode("utf-8")
            if line.startswith("data: "):
                data = line[6:]
                if data.strip() == "[DONE]":
                    break
                try:
                    import json
                    yield json.loads(data)
                except json.JSONDecodeError:
                    continue
